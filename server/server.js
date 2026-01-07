const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression'); // Gzip compression for responses
const rateLimit = require('express-rate-limit');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');

// Load centralized configuration (with fallbacks for backward compatibility)
const config = require('./config');

// Add near the top of the file, with other requires
const dbManager = require('./database-connection-manager');

// Backward compatibility: Set environment variables from config
// This ensures existing code still works during transition
// NOTE: BulkSMS has been replaced with The SMS Works (uses webhooks, no polling)
process.env.SMS_WORKS_SENDER_ID = config.sms.senderId;

process.env.EMAIL_USER = config.email.user;
process.env.EMAIL_PASSWORD = config.email.password;
process.env.GMAIL_USER = config.email.gmailUser;
process.env.GMAIL_PASS = config.email.gmailPass;

// Set environment variables programmatically (backward compatibility)
process.env.SUPABASE_URL = config.supabase.url;
process.env.SUPABASE_ANON_KEY = config.supabase.anonKey;
process.env.JWT_SECRET = config.JWT_SECRET;

// Database configuration - Now using centralized config with timeout protection
const { getSupabaseClient } = require('./config/supabase-client');
const supabase = getSupabaseClient();
// console.log('✅ Supabase client initialized using centralized config');

const authRoutes = require('./routes/auth-simple');
const leadRoutes = require('./routes/leads');
const userRoutes = require('./routes/users');
const statsRoutes = require('./routes/stats');
const templateRoutes = require('./routes/templates');
const salesRoutes = require('./routes/sales-supabase');
const messageRoutes = require('./routes/messages');
const messagesListRoutes = require('./routes/messages-list');
const retargetingRoutes = require('./routes/retargeting');
const financeRoutes = require('./routes/finance');
const uploadRoutes = require('./routes/upload');
const smsRoutes = require('./routes/sms');
// Legacy routes removed - no longer needed
// const legacyRoutes = require('./routes/legacy');
const bookerAnalyticsRoutes = require('./routes/booker-analytics');
const emailTestRoutes = require('./routes/email-test');
const usersPublicRoutes = require('./routes/usersPublic');
const salesapeRoutes = require('./routes/salesape');
const blockedSlotsRoutes = require('./routes/blocked-slots');
const callbackRemindersRoutes = require('./routes/callback-reminders');
const gmailAuthRoutes = require('./routes/gmail-auth');
const gravityFormsWebhookRoutes = require('./routes/gravity-forms-webhook');
const photosRoutes = require('./routes/photos');
const packagesRoutes = require('./routes/packages');
const invoicesRoutes = require('./routes/invoices');
const signatureRoutes = require('./routes/signature');
const contractsRoutes = require('./routes/contracts');
const stripeRoutes = require('./routes/stripe');
// TEMPORARILY DISABLED: const scheduler = require('./utils/scheduler');
// OLD IMAP-based email poller (replaced with Gmail API)
// const { startEmailPoller } = require('./utils/emailPoller');
const { startGmailPoller } = require('./utils/gmailPoller');
const FinanceReminderService = require('./services/financeReminderServiceSupabase');
// Removed legacy auto-sync import to avoid accidental background duplication
let startUltraFastSMSPolling = () => {};
try {
  // Keep optional import guarded
  ({ startUltraFastSMSPolling } = require('./ultra-fast-sms-poller'));
} catch {}

const app = express();
const server = http.createServer(app);

// Socket.IO setup with enhanced stability and reduced connection cycling
const io = socketIo(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? ['https://your-domain.com'] 
      : true, // Allow all origins in development
    methods: ['GET', 'POST'],
    credentials: true
  },
  // Optimized settings for better stability
  pingTimeout: 30000, // Increased to 30 seconds for better stability
  pingInterval: 10000, // Increased to 10 seconds for less aggressive pinging
  upgradeTimeout: 15000, // Increased upgrade timeout
  maxHttpBufferSize: 1e6, // 1MB limit to prevent memory issues
  allowUpgrades: true,
  transports: ['websocket', 'polling'],
  // Add connection state management
  allowEIO3: true, // Support older clients
  serveClient: false, // Don't serve client files
  // Better error handling
  connectTimeout: 45000, // 45 second connection timeout
  // Reduce connection cycling
  maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
  // Better memory management
  destroyUpgradeTimeout: 1000
});

// Make io globally available for other modules
global.io = io;
// Also attach io to the Express app so routes can emit via req.app.get('io')
app.set('io', io);


// Attach io to each request for routes that expect req.io
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Global tracker for today's bookings (demo mode)
global.todaysBookings = [];

// Socket.IO connection handling with enhanced stability
io.on('connection', (socket) => {
  console.log(`✅ User connected: ${socket.id}`);

  // Track user session for better stability
  let userSession = {
    id: null,
    name: null,
    role: null,
    lastActivity: Date.now(),
    heartbeatCount: 0
  };

  // Store user session on socket for chat handler access
  socket.userSession = userSession;

  // Join user to their room (for user-specific notifications)
  socket.on('join', async (userData) => {
    if (userData && userData.id) {
      userSession.id = userData.id;
      userSession.name = userData.name;
      userSession.role = userData.role;
      userSession.lastActivity = Date.now();

      // Store user on socket for chat handler
      socket.user = userData;
      socket.userSession = userSession;

      socket.join(`user_${userData.id}`);
      // Admins join a dedicated room to receive all events
      if (String(userData.role).toLowerCase() === 'admin') {
        socket.join('admins');
      }
      // Keep legacy global room join for now if needed by other features
      socket.join('all_users'); // Join global room for system-wide updates
      console.log(`User ${userData.id} joined their room`);

      // Send welcome message
      socket.emit('welcome', {
        message: `Welcome ${userData.name}!`,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Handle heartbeat to keep connection alive
  socket.on('heartbeat', (data) => {
    userSession.lastActivity = Date.now();
    userSession.heartbeatCount++;
    
    // Respond to heartbeat
    socket.emit('heartbeat_ack', {
      timestamp: Date.now(),
      serverTime: new Date().toISOString()
    });
    
    // Log heartbeat every 10th time to avoid spam
    if (userSession.heartbeatCount % 10 === 0) {
      console.log(`💓 Heartbeat from ${userSession.name || 'user'}: ${userSession.heartbeatCount} beats`);
    }
  });

  // Handle pong response
  socket.on('pong', () => {
    userSession.lastActivity = Date.now();
  });

  // Handle disconnection with better logging and chat cleanup
  socket.on('disconnect', async (reason) => {
    const duration = userSession.lastActivity ?
      Math.round((Date.now() - userSession.lastActivity) / 1000) : 0;

    console.log(`❌ User disconnected: ${socket.id}`);
    console.log(`   User: ${userSession.name || 'Unknown'}`);
    console.log(`   Reason: ${reason}`);
    console.log(`   Session duration: ${duration}s`);
    console.log(`   Heartbeats: ${userSession.heartbeatCount}`);

  });

  // Handle lead updates with enhanced broadcasting
  socket.on('lead_update', (data) => {
    userSession.lastActivity = Date.now();
    
    // Broadcast to all users except sender (keep legacy), but also to admins
    socket.broadcast.emit('lead_updated', {
      ...data,
      updatedBy: userSession.name,
      timestamp: new Date().toISOString()
    });
    if (userSession.role && String(userSession.role).toLowerCase() === 'admin') {
      io.to('admins').emit('lead_updated', {
        ...data,
        updatedBy: userSession.name,
        timestamp: new Date().toISOString()
      });
    }
    
    console.log(`📱 Lead update broadcasted by ${userSession.name}: ${data.action}`);
  });

  // Handle calendar updates
  socket.on('calendar_update', (data) => {
    userSession.lastActivity = Date.now();
    
    // Broadcast to all users except sender
    socket.broadcast.emit('calendar_updated', {
      ...data,
      updatedBy: userSession.name,
      timestamp: new Date().toISOString()
    });
    
    console.log(`📅 Calendar update broadcasted by ${userSession.name}`);
  });

  // Handle stats updates
  socket.on('stats_update', (data) => {
    userSession.lastActivity = Date.now();
    
    // Broadcast to all users except sender
    socket.broadcast.emit('stats_updated', {
      ...data,
      updatedBy: userSession.name,
      timestamp: new Date().toISOString()
    });
    
    console.log(`📊 Stats update broadcasted by ${userSession.name}`);
  });

  // Handle diary updates with enhanced real-time features
  socket.on('diary_update', (data) => {
    userSession.lastActivity = Date.now();
    
    // Broadcast to all users except sender
    socket.broadcast.emit('diary_updated', {
      ...data,
      updatedBy: userSession.name,
      timestamp: new Date().toISOString()
    });
    
    console.log(`📅 Diary update broadcasted by ${userSession.name}: ${data.type}`);
  });

  // Handle booking updates specifically for real-time diary
  socket.on('booking_update', (data) => {
    userSession.lastActivity = Date.now();
    
    // Broadcast booking updates to all users for real-time diary updates
    io.emit('diary_updated', {
      type: 'DIARY_UPDATED',
      data: {
        leadId: data.leadId,
        leadName: data.leadName,
        oldStatus: data.oldStatus,
        newStatus: data.newStatus,
        dateBooked: data.dateBooked,
        timestamp: new Date().toISOString(),
        updatedBy: userSession.name,
        updatedAt: new Date().toISOString()
      }
    });
    
    console.log(`📅 Booking update broadcasted: ${data.leadName} - ${data.oldStatus} → ${data.newStatus}`);
  });

  // Handle user activity to prevent session timeout
  socket.on('user_activity', () => {
    userSession.lastActivity = Date.now();
  });


  // Set up periodic ping to keep connection alive
  const pingInterval = setInterval(() => {
    if (socket.connected) {
      socket.emit('ping');
    }
  }, 120000); // Send ping every 2 minutes (reduced from 25s to prevent DB load)

  // Clean up interval on disconnect
  socket.on('disconnect', () => {
    clearInterval(pingInterval);
  });
});

// Email poller setup removed during cleanup

// Trust proxy for rate limiting
app.set('trust proxy', 1);

// Security middleware with relaxed CSP for API connections
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", "https://*.railway.app", "https://*.supabase.co", "wss://*.railway.app"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      mediaSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'", "data:"],
    },
  },
}));

// Gzip compression - reduces payload size by 60-80%
app.use(compression({
  level: 6, // Balanced compression level (1-9)
  threshold: 1024, // Only compress responses > 1KB
  filter: (req, res) => {
    // Don't compress if client doesn't accept gzip
    if (req.headers['x-no-compression']) return false;
    // Use default filter (compresses text, json, etc.)
    return compression.filter(req, res);
  }
}));

// Rate limiting with proper configuration - more lenient for retry scenarios
const limiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes (reduced window)
  max: 150, // Increased limit to accommodate legitimate retries
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting for local development and health checks
  skip: (req) => {
    return (process.env.NODE_ENV === 'development' && 
           (req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1')) ||
           req.path === '/api/health'; // Always allow health checks
  },
  // Custom error message for rate limiting
  message: {
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many requests, please try again later.',
    retryAfter: 60000 // 1 minute
  }
});
// app.use(limiter); // DISABLED FOR LOCAL DEVELOPMENT

// CORS - More permissive for development
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://your-domain.com'] 
    : true, // Allow all origins in development
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-auth-token'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 86400 // 24 hours
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files for uploaded images with caching headers
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  maxAge: '1y', // Cache for 1 year
  etag: true,
  lastModified: true,
  setHeaders: (res, path) => {
    // Set appropriate cache headers for different image types
    if (path.endsWith('.jpg') || path.endsWith('.jpeg') || path.endsWith('.png') || path.endsWith('.webp')) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); // 1 year
      res.setHeader('Content-Type', 'image/jpeg'); // Default to JPEG
      
      if (path.endsWith('.png')) {
        res.setHeader('Content-Type', 'image/png');
      } else if (path.endsWith('.webp')) {
        res.setHeader('Content-Type', 'image/webp');
      }
    }
  }
}));

// Health check endpoint (before other middleware)
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    database: isDbConnected ? 'connected' : 'disconnected',
    server: 'running',
    timestamp: new Date().toISOString()
  });
});

// Gmail Push Notification Health Check
app.get('/api/gmail/health', async (req, res) => {
  try {
    const GMAIL_PUSH_ENABLED = process.env.GMAIL_PUSH_ENABLED === 'true';

    if (!GMAIL_PUSH_ENABLED) {
      return res.json({
        pushEnabled: false,
        mode: 'polling',
        message: 'Using traditional polling mode. Set GMAIL_PUSH_ENABLED=true to enable push notifications.'
      });
    }

    const gmailWatcherService = require('./services/gmailWatcherService');
    const status = await gmailWatcherService.getWatchStatus();

    res.json({
      pushEnabled: true,
      mode: 'push-notifications',
      ...status
    });

  } catch (error) {
    res.status(500).json({
      pushEnabled: process.env.GMAIL_PUSH_ENABLED === 'true',
      error: error.message
    });
  }
});

// No-cache headers for all API routes to prevent stale data
app.use('/api/*', (req, res, next) => {
  // Disable caching for API responses
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
});

// Database health check middleware (before routes)
app.use('/api/*', (req, res, next) => {
  // Allow health checks and some GET requests even when DB is down
  const allowedPaths = ['/api/auth/me', '/api/health'];
  const isAllowedPath = allowedPaths.some(path => req.path.startsWith(path));
  
  if (!isDbConnected && req.method !== 'GET' && !isAllowedPath) {
    return res.status(503).json({
      message: 'Database connection unavailable. Please try again.',
      error: 'DB_DISCONNECTED',
      retryAfter: 5000
    });
  }
  
  // For critical operations like login, ensure connection is ready
  if (!isDbConnected && (req.path.includes('/auth/login') || req.path.includes('/auth/register'))) {
    return res.status(503).json({
      message: 'Database service temporarily unavailable. Please try again.',
      error: 'DB_DISCONNECTED',
      retryAfter: 3000
    });
  }
  
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/users', userRoutes);
app.use('/api/users-public', usersPublicRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/messages-list', messagesListRoutes);
app.use('/api/retargeting', retargetingRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/sms', smsRoutes);
// Legacy routes removed - no longer needed
// app.use('/api/legacy', legacyRoutes);
app.use('/api/booker-analytics', bookerAnalyticsRoutes);
app.use('/api/email-test', emailTestRoutes);
app.use('/api/salesape', salesapeRoutes);
// SalesApe Webhook Integration (for receiving updates from SalesApe)
const { router: salesapeWebhookRouter } = require('./routes/salesape-webhook');
app.use('/api/salesape-webhook', salesapeWebhookRouter);
// SalesApe Dashboard API
const salesapeDashboardRoutes = require('./routes/salesape-dashboard');
app.use('/api/salesape-dashboard', salesapeDashboardRoutes);
// Blocked Slots API (for calendar availability management)
app.use('/api/blocked-slots', blockedSlotsRoutes);
app.use('/api/callback-reminders', callbackRemindersRoutes);
// Photos API (for photographer image management)
app.use('/api/photos', photosRoutes);
// Packages API (for package definitions and pricing)
app.use('/api/packages', packagesRoutes);
// Invoices API (for invoice creation and management)
app.use('/api/invoices', invoicesRoutes);
// Signature API (for e-signature collection)
app.use('/api/signature', signatureRoutes);
// Contracts API (for Edge Talent contract signing)
app.use('/api/contracts', contractsRoutes);
// Public Booking API (for client self-service booking)
const publicBookingRoutes = require('./routes/public-booking');
app.use('/api/public/booking', publicBookingRoutes);
// Stripe API (for payment processing and card holds)
app.use('/api/stripe', stripeRoutes);
// Gmail API Authentication Routes
app.use('/api/gmail', gmailAuthRoutes);
// Gmail Push Notification Webhook Routes
const gmailWebhookRoutes = require('./routes/gmail-webhook');
app.use('/api/gmail/webhook', gmailWebhookRoutes);
// Gravity Forms Webhook Integration (for importing leads from Gravity Forms)
app.use('/api/gravity-forms-webhook', gravityFormsWebhookRoutes);
// TEMPORARILY DISABLED: app.use('/api/performance', require('./routes/performance'));

// --- Lightweight short link storage for long booking confirmations ---
// Uses Supabase for persistent storage
function generateId(length = 8) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let out = '';
  for (let i = 0; i < length; i++) {
    out += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }
  return out;
}

// Create short_links table if it doesn't exist
async function ensureShortLinksTable() {
  try {
    // Check if table exists by attempting a simple query
    const { data, error } = await supabase.from('short_links').select('id').limit(1);
    
    if (error && error.message.includes('relation "short_links" does not exist')) {
      console.log('📝 Creating short_links table in Supabase...');
      // Note: In a real Supabase setup, you'd create this table via the dashboard or migration
      // For now, we'll handle this gracefully in the API calls
      console.log('⚠️  Please create short_links table in Supabase with columns: id (text), content (text), created_at (timestamp)');
    }
  } catch (e) {
    console.warn('⚠️  Could not verify short_links table:', e.message);
  }
}

// Create short link for long SMS content
app.post('/api/short/sms', async (req, res) => {
  try {
    const { content } = req.body || {};
    if (!content || typeof content !== 'string') {
      return res.status(400).json({ error: 'INVALID_CONTENT', message: 'content is required' });
    }
    
    await ensureShortLinksTable();
    let id = generateId(8);
    
    // Ensure uniqueness by checking if ID exists
    let attempts = 0;
    while (attempts < 5) {
      const { data: existing } = await supabase
        .from('short_links')
        .select('id')
        .eq('id', id)
        .single();
      
      if (!existing) break; // ID is unique
      id = generateId(8);
      attempts++;
    }
    
    // Insert the short link
    const { data, error } = await supabase
      .from('short_links')
      .insert({
        id,
        content,
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) {
      console.error('❌ Failed to create short link in Supabase:', error);
      return res.status(500).json({ error: 'SHORT_LINK_ERROR', message: 'Database error' });
    }
    
    const base = process.env.PUBLIC_BASE_URL || 'http://localhost:5000';
    return res.json({ id, url: `${base}/c/${id}` });
  } catch (err) {
    console.error('❌ Failed to create short link:', err?.message || err);
    return res.status(500).json({ error: 'SHORT_LINK_ERROR' });
  }
});

// Public view for confirmation content
app.get('/c/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    await ensureShortLinksTable();
    
    const { data: row, error } = await supabase
      .from('short_links')
      .select('content, created_at')
      .eq('id', id)
      .single();
    
    if (error || !row) {
      return res.status(404).send('Not found');
    }
    
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Booking Confirmation</title>
<style>
  body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 20px; line-height: 1.5; }
  .card { max-width: 800px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 12px; box-shadow: 0 1px 2px rgba(0,0,0,0.04); }
  pre { white-space: pre-wrap; word-wrap: break-word; }
  .muted { color: #6b7280; font-size: 12px; margin-top: 16px; }
</style>
</head><body>
  <div class="card">
    <h1>Booking Confirmation</h1>
    <pre>${row.content.replace(/</g, '&lt;')}</pre>
    <div class="muted">Generated: ${new Date(row.created_at).toLocaleString()}</div>
  </div>
</body></html>`);
  } catch (err) {
    console.error('❌ Failed to render short link:', err?.message || err);
    return res.status(500).send('Server error');
  }
});

// Serve static files from React build
const buildPath = path.join(__dirname, '../client/build');
const indexPath = path.join(buildPath, 'index.html');

// Check if build directory exists
if (fs.existsSync(buildPath)) {
  console.log('✅ React build directory found:', buildPath);
  app.use(express.static(buildPath, {
    maxAge: '1y',
    etag: true,
    lastModified: true
  }));
} else {
  console.error('❌ React build directory not found:', buildPath);
  console.error('⚠️  Frontend will not be served. Run "npm run build" in the client directory.');
}

// Handle React routing - serve index.html for all non-API routes
// This must be AFTER all API routes
app.get('*', (req, res) => {
  // Don't serve index.html for API routes
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ message: 'API endpoint not found' });
  }
  
  // Check if index.html exists
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(500).send(`
      <html>
        <head><title>Build Error</title></head>
        <body style="font-family: Arial; padding: 40px; text-align: center;">
          <h1>⚠️ Build Not Found</h1>
          <p>The React build directory is missing.</p>
          <p>Expected path: ${buildPath}</p>
          <p>Please ensure the build completed successfully.</p>
        </body>
      </html>
    `);
  }
});

// Enhanced error handling middleware with database awareness
app.use((err, req, res, next) => {
  console.error(`❌ Server Error: ${err.message}`);
  
  // Handle SQLite connection errors gracefully
  if (!isDbConnected) {
    return res.status(503).json({ 
      message: 'Database temporarily unavailable. Please try again.',
      error: 'DB_CONNECTION_ERROR',
      retryAfter: 5000
    });
  }
  
  // Handle other errors
  res.status(500).json({ 
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : 'INTERNAL_SERVER_ERROR'
  });
});

// Global database connection state
let isDbConnected = true; // Supabase connection status

// Test database connection
const testDatabaseConnection = async () => {
  try {
    // Check if dbManager.client was initialized
    if (!dbManager.client) {
      console.error('❌ Database client not initialized - SUPABASE_SERVICE_ROLE_KEY is missing or invalid');
      console.error('⚠️  Server will start in LIMITED MODE');
      isDbConnected = false;
      return false;
    }

    // Test using dbManager (service role key) instead of anon key
    // This ensures we're testing with the correct permissions
    const { data, error } = await dbManager.client.from('users').select('id').limit(1);

    if (error) {
      // Log more details about the error
      console.error('❌ Database connection test failed:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });

      // Check if it's an API key issue
      if (error.message && error.message.includes('Invalid API key')) {
        const keyPreview = config.supabase.serviceRoleKey
          ? `${config.supabase.serviceRoleKey.substring(0, 20)}...`
          : 'NOT SET';
        console.error('❌ SUPABASE_SERVICE_ROLE_KEY appears invalid or missing');
        console.error('   Key preview:', keyPreview);
        console.error('   Please verify SUPABASE_SERVICE_ROLE_KEY in Railway environment variables');
        console.error('   Get it from: Supabase Dashboard → Settings → API → service_role key');
      }

      throw error;
    }

    console.log('✅ Database connected successfully');
    isDbConnected = true;
    return true;
  } catch (err) {
    console.error('❌ Database connection error:', err.message);
    isDbConnected = false;
    return false;
  }
};

// Make connection status globally available
global.isDatabaseConnected = () => isDbConnected;

// Graceful shutdown handling
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT. Graceful shutdown initiated...');

  // Stop Gmail watcher if using push notifications
  const GMAIL_PUSH_ENABLED = process.env.GMAIL_PUSH_ENABLED === 'true';
  if (GMAIL_PUSH_ENABLED) {
    try {
      const gmailWatcherService = require('./services/gmailWatcherService');
      await gmailWatcherService.stopWatching();
      console.log('✅ Gmail watcher stopped gracefully');
    } catch (e) {
      console.error('⚠️  Error stopping Gmail watcher:', e?.message || e);
    }
  }

  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM. Graceful shutdown initiated...');

  // Stop Gmail watcher if using push notifications
  const GMAIL_PUSH_ENABLED = process.env.GMAIL_PUSH_ENABLED === 'true';
  if (GMAIL_PUSH_ENABLED) {
    try {
      const gmailWatcherService = require('./services/gmailWatcherService');
      await gmailWatcherService.stopWatching();
      console.log('✅ Gmail watcher stopped gracefully');
    } catch (e) {
      console.error('⚠️  Error stopping Gmail watcher:', e?.message || e);
    }
  }

  process.exit(0);
});

// Start server with better error handling
const PORT = process.env.PORT || 5000;

// Wrap startup in try-catch to prevent crashes
testDatabaseConnection().then(() => {
  server.listen(PORT, '0.0.0.0', async () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🔌 WebSocket server ready for real-time sync`);
    console.log(`🗄️  Connected to Supabase database`);
    
    // DISABLED: Start the message scheduler
    // scheduler.start();

    // SMS Configuration
    console.log('📡 Using The SMS Works for SMS sending');
    console.log('📡 Incoming SMS handled via webhook at /api/sms/webhook');
    console.log('📡 Configure your webhook URL in The SMS Works dashboard to receive incoming messages');

    // Note: The SMS Works uses webhooks for incoming messages, no polling needed
    // If you need polling for legacy BulkSMS support, uncomment below:
    // try {
    //   const { startBulkSmsPolling } = require('./utils/bulkSmsPoller');
    //   if (typeof startBulkSmsPolling === 'function') {
    //     startBulkSmsPolling();
    //   }
    // } catch (e) {
    //   console.error('❌ Failed to start BulkSMS reply poller:', e?.message || e);
    // }

    // GMAIL API: Start Gmail monitoring (Push Notifications or Polling)
    // Wrap in try-catch to prevent server crash if Gmail setup fails
    try {
      const GMAIL_PUSH_ENABLED = process.env.GMAIL_PUSH_ENABLED === 'true';

      if (GMAIL_PUSH_ENABLED) {
        // Use Gmail Push Notifications (Real-time, event-driven)
        try {
          console.log('📧 Starting Gmail Push Notification System...');

          // Set up Socket.IO for message processor
          const gmailMessageProcessor = require('./services/gmailMessageProcessor');
          gmailMessageProcessor.setSocketIO(io);

          // Start watching both Gmail accounts
          const gmailWatcherService = require('./services/gmailWatcherService');
          await gmailWatcherService.startWatching();

          console.log('✅ Gmail Push Notification System started successfully');
          console.log('📊 Monitoring both hello@ and diary@ accounts');
        } catch (e) {
          console.error('❌ Failed to start Gmail Push Notification System:', e?.message || e);
          console.error('💡 Falling back to polling mode...');

          // Fallback to polling
          try {
            startGmailPoller(io);
            console.log('✅ Gmail API poller started (fallback mode)');
          } catch (fallbackError) {
            console.error('❌ Both push and polling failed:', fallbackError?.message || fallbackError);
            console.error('⚠️  Server will continue without Gmail polling');
          }
        }
      } else {
        // Use traditional polling (Backward compatibility)
        try {
          console.log('📧 Starting Gmail API Poller (Polling Mode)...');
          startGmailPoller(io);
          console.log('✅ Gmail API poller started successfully');
          console.log('💡 To enable push notifications, set GMAIL_PUSH_ENABLED=true');
        } catch (e) {
          console.error('❌ Failed to start Gmail API poller:', e?.message || e);
          console.error('💡 Run /api/gmail/auth to set up Gmail API authentication');
          console.error('⚠️  Server will continue without Gmail polling');
        }
      }
    } catch (gmailError) {
      console.error('❌ Critical error in Gmail setup:', gmailError?.message || gmailError);
      console.error('⚠️  Server will continue without Gmail features');
    }

    // ENABLED: Finance Reminder Service (now converted to Supabase)
    try {
      const financeReminderService = new FinanceReminderService();
      financeReminderService.startReminderScheduler();
      console.log('✅ Finance reminder service started (Supabase)');
    } catch (e) {
      console.error('❌ Failed to start finance reminder service:', e?.message || e);
    }

    // ENABLED: Callback Reminder Service
    try {
      const CallbackReminderService = require('./services/callbackReminderService');
      const callbackReminderService = new CallbackReminderService();
      callbackReminderService.start();
      console.log('✅ Callback reminder service started');
    } catch (e) {
      console.error('❌ Failed to start callback reminder service:', e?.message || e);
    }

    // Start SalesApe sync service (polls Airtable for status updates)
    try {
      const salesapeSyncService = require('./services/salesapeSync');
      salesapeSyncService.start();
      console.log('✅ SalesApe sync service started');
    } catch (e) {
      console.error('❌ Failed to start SalesApe sync service:', e?.message || e);
      console.error('   This service polls SalesApe\'s Airtable for status updates');
      console.error('   Webhook updates will still work if configured in SalesApe');
    }
  });
}).catch((error) => {
  // Start server even if Supabase connection fails
  console.error('❌ Database connection test failed:', error?.message || error);
  console.log('⚠️  Starting server in limited mode - database features may not work');
  
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT} (limited mode)`);
    console.log(`🔌 WebSocket server ready for real-time sync`);
    console.log('⚠️  Database features will not work until Supabase is connected');
  });
});

// Handle unhandled promise rejections to prevent crashes
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit - let the server continue running
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  // Don't exit immediately - log and continue
  console.error('⚠️  Server will attempt to continue running');
});

module.exports = { app, io };