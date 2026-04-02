const express = require('express');
const { google } = require('googleapis');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');

/**
 * Gmail OAuth2 Authentication Routes
 * Use these routes to authenticate and get your Gmail API refresh token
 */

// OAuth2 configuration
const CREDENTIALS_PATH = path.join(__dirname, '../config/gmail-credentials.json');
const TOKEN_PATH = path.join(__dirname, '../config/gmail-token.json');

// Scopes for Gmail API
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify'
];

/**
 * Get OAuth2 client from credentials
 */
async function getOAuth2Client() {
  try {
    // Try to load from file first
    const content = await fs.readFile(CREDENTIALS_PATH, 'utf8');
    const credentials = JSON.parse(content);

    const { client_id, client_secret, redirect_uris } = credentials.web || credentials.installed;
    return new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
  } catch (error) {
    // Fall back to environment variables
    const clientId = process.env.GMAIL_CLIENT_ID;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET;
    const redirectUri = process.env.GMAIL_REDIRECT_URI || 'http://localhost:5000/api/gmail/oauth2callback';

    if (!clientId || !clientSecret) {
      throw new Error('Gmail OAuth2 credentials not configured. Set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET in .env');
    }

    return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  }
}

/**
 * @route   GET /api/gmail/auth
 * @desc    Start OAuth2 authentication flow
 * @access  Public (for setup only - secure this in production!)
 */
router.get('/auth', async (req, res) => {
  try {
    console.log('🔐 Starting Gmail OAuth2 authentication flow...');

    const oauth2Client = await getOAuth2Client();

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent' // Force to get refresh token
    });

    console.log('🔐 Redirecting to Google authentication...');
    res.redirect(authUrl);

  } catch (error) {
    console.error('❌ OAuth2 auth error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start authentication',
      error: error.message,
      instructions: 'Set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET in your .env file or create gmail-credentials.json'
    });
  }
});

/**
 * @route   GET /api/gmail/oauth2callback
 * @desc    OAuth2 callback - receives authorization code from Google
 * @access  Public (OAuth2 callback)
 */
router.get('/oauth2callback', async (req, res) => {
  try {
    const { code } = req.query;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'No authorization code received'
      });
    }

    console.log('🔐 Received authorization code, exchanging for tokens...');

    const oauth2Client = await getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);

    console.log('✅ Tokens received successfully');
    console.log('📝 Refresh Token:', tokens.refresh_token ? '✅ Received' : '❌ Not received');

    // Save tokens to file
    try {
      await fs.mkdir(path.dirname(TOKEN_PATH), { recursive: true });
      await fs.writeFile(TOKEN_PATH, JSON.stringify(tokens, null, 2));
      console.log(`✅ Tokens saved to ${TOKEN_PATH}`);
    } catch (saveError) {
      console.error('⚠️ Failed to save tokens to file:', saveError.message);
    }

    // Display success page with instructions
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Gmail API Authentication Successful</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 50px auto;
            padding: 20px;
            background: #f5f5f5;
          }
          .container {
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          h1 { color: #4CAF50; }
          .success { color: #4CAF50; font-size: 48px; }
          .code-block {
            background: #f4f4f4;
            padding: 15px;
            border-radius: 5px;
            margin: 15px 0;
            font-family: monospace;
            overflow-x: auto;
          }
          .warning {
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin: 15px 0;
          }
          .info {
            background: #d1ecf1;
            border-left: 4px solid #0c5460;
            padding: 15px;
            margin: 15px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="success">✅</div>
          <h1>Gmail API Authentication Successful!</h1>

          <div class="info">
            <strong>📧 Email Account:</strong> hello@edgetalent.co.uk<br>
            <strong>🔑 Refresh Token:</strong> ${tokens.refresh_token ? 'Received ✅' : 'Not Received ❌'}
          </div>

          ${tokens.refresh_token ? `
            <h2>🔧 Setup Instructions</h2>

            <p>Add these environment variables to your Railway deployment:</p>

            <div class="code-block">
GMAIL_CLIENT_ID=${process.env.GMAIL_CLIENT_ID || 'your_client_id'}
GMAIL_CLIENT_SECRET=${process.env.GMAIL_CLIENT_SECRET || 'your_client_secret'}
GMAIL_REFRESH_TOKEN=${tokens.refresh_token}
GMAIL_EMAIL=hello@edgetalent.co.uk
            </div>

            <div class="warning">
              <strong>⚠️ Important:</strong> Keep your refresh token secure! Don't commit it to Git.
            </div>

            <p>Tokens have been saved to: <code>${TOKEN_PATH}</code></p>
          ` : `
            <div class="warning">
              <strong>⚠️ No Refresh Token Received</strong><br>
              This usually happens if you've already authorized this app before.
              Try revoking access at <a href="https://myaccount.google.com/permissions" target="_blank">Google Account Permissions</a>
              and run the authentication again.
            </div>
          `}

          <h2>📋 Token Details</h2>
          <div class="code-block">
${JSON.stringify(tokens, null, 2)}
          </div>

          <p style="margin-top: 30px;">
            <a href="/api/gmail/status">Check Gmail API Status →</a>
          </p>
        </div>
      </body>
      </html>
    `;

    res.send(html);

  } catch (error) {
    console.error('❌ OAuth2 callback error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete authentication',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/gmail/status
 * @desc    Check Gmail API configuration status
 * @access  Public
 */
router.get('/status', async (req, res) => {
  try {
    const status = {
      credentials: {
        clientId: process.env.GMAIL_CLIENT_ID ? '✅ Set' : '❌ Not set',
        clientSecret: process.env.GMAIL_CLIENT_SECRET ? '✅ Set' : '❌ Not set',
        refreshToken: process.env.GMAIL_REFRESH_TOKEN ? '✅ Set' : '❌ Not set',
        email: process.env.GMAIL_EMAIL || 'hello@edgetalent.co.uk'
      },
      tokenFile: {
        exists: false,
        path: TOKEN_PATH
      }
    };

    // Check if token file exists
    try {
      await fs.access(TOKEN_PATH);
      status.tokenFile.exists = true;
      const tokenContent = await fs.readFile(TOKEN_PATH, 'utf8');
      const tokens = JSON.parse(tokenContent);
      status.tokenFile.hasRefreshToken = !!tokens.refresh_token;
    } catch (error) {
      status.tokenFile.exists = false;
    }

    const allConfigured =
      (process.env.GMAIL_CLIENT_ID || status.tokenFile.exists) &&
      (process.env.GMAIL_CLIENT_SECRET || status.tokenFile.exists) &&
      (process.env.GMAIL_REFRESH_TOKEN || status.tokenFile.exists);

    res.json({
      success: true,
      configured: allConfigured,
      status,
      instructions: allConfigured
        ? 'Gmail API is configured and ready to use'
        : 'Visit /api/gmail/auth to start authentication flow'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to check status',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/gmail/health
 * @desc    Health check - test OAuth token validity for ALL Gmail accounts
 * @access  Admin only (requires auth)
 */
const { auth, adminAuth } = require('../middleware/auth');

router.get('/health', auth, adminAuth, async (req, res) => {
  try {
    const ACCOUNTS = {
      primary: {
        email: process.env.GMAIL_EMAIL || 'hello@edgetalent.co.uk',
        clientId: process.env.GMAIL_CLIENT_ID,
        clientSecret: process.env.GMAIL_CLIENT_SECRET,
        refreshToken: process.env.GMAIL_REFRESH_TOKEN
      },
      secondary: {
        email: process.env.GMAIL_EMAIL_2 || 'diary@edgetalent.co.uk',
        clientId: process.env.GMAIL_CLIENT_ID_2,
        clientSecret: process.env.GMAIL_CLIENT_SECRET_2,
        refreshToken: process.env.GMAIL_REFRESH_TOKEN_2
      },
      tertiary: {
        email: process.env.GMAIL_EMAIL_3 || 'bookings@edgetalent.co.uk',
        clientId: process.env.GMAIL_CLIENT_ID_3,
        clientSecret: process.env.GMAIL_CLIENT_SECRET_3,
        refreshToken: process.env.GMAIL_REFRESH_TOKEN_3
      },
      quaternary: {
        email: process.env.GMAIL_EMAIL_4 || 'appt@edgetalent.co.uk',
        clientId: process.env.GMAIL_CLIENT_ID_4,
        clientSecret: process.env.GMAIL_CLIENT_SECRET_4,
        refreshToken: process.env.GMAIL_REFRESH_TOKEN_4
      },
      quinary: {
        email: process.env.GMAIL_EMAIL_5 || 'book@edgetalent.co.uk',
        clientId: process.env.GMAIL_CLIENT_ID_5,
        clientSecret: process.env.GMAIL_CLIENT_SECRET_5,
        refreshToken: process.env.GMAIL_REFRESH_TOKEN_5
      },
      senary: {
        email: process.env.GMAIL_EMAIL_6 || 'photo@edgetalent.co.uk',
        clientId: process.env.GMAIL_CLIENT_ID_6,
        clientSecret: process.env.GMAIL_CLIENT_SECRET_6,
        refreshToken: process.env.GMAIL_REFRESH_TOKEN_6
      }
    };

    const results = [];

    for (const [key, account] of Object.entries(ACCOUNTS)) {
      const result = { key, email: account.email, status: 'unknown', error: null };

      if (!account.clientId || !account.clientSecret || !account.refreshToken) {
        result.status = 'not_configured';
        results.push(result);
        continue;
      }

      try {
        const oauth2Client = new google.auth.OAuth2(account.clientId, account.clientSecret);
        oauth2Client.setCredentials({ refresh_token: account.refreshToken });
        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
        const profile = await gmail.users.getProfile({ userId: 'me' });
        result.status = 'healthy';
        result.messagesTotal = profile.data.messagesTotal;
      } catch (err) {
        if (err.message?.includes('invalid_grant') || err.message?.includes('Token has been expired or revoked')) {
          result.status = 'token_expired';
          result.error = 'Refresh token expired or revoked';
          result.authUrl = `/api/gmail/${key === 'primary' ? 'auth' : 'auth' + key.replace('secondary','2').replace('tertiary','3').replace('quaternary','4').replace('quinary','5').replace('senary','6')}`;
        } else {
          result.status = 'error';
          result.error = err.message;
        }
      }

      results.push(result);
    }

    // Also check database email accounts
    const { getSupabaseClient } = require('../config/supabase-client');
    const supabase = getSupabaseClient();
    const emailAccountService = require('../utils/emailAccountService');

    const { data: dbAccounts } = await supabase
      .from('email_accounts')
      .select('id, name, email, is_active')
      .eq('is_active', true);

    if (dbAccounts) {
      for (const dbAcc of dbAccounts) {
        // Skip if already checked as env var account
        if (results.some(r => r.email === dbAcc.email)) continue;

        const result = { key: dbAcc.id, email: dbAcc.email, name: dbAcc.name, status: 'unknown', isDatabase: true };

        try {
          const fullAccount = await emailAccountService.getAccountById(dbAcc.id);
          if (!fullAccount || !fullAccount.client_id || !fullAccount.client_secret || !fullAccount.refresh_token) {
            result.status = 'not_configured';
            results.push(result);
            continue;
          }

          const oauth2Client = new google.auth.OAuth2(fullAccount.client_id, fullAccount.client_secret);
          oauth2Client.setCredentials({ refresh_token: fullAccount.refresh_token });
          const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
          await gmail.users.getProfile({ userId: 'me' });
          result.status = 'healthy';
        } catch (err) {
          if (err.message?.includes('invalid_grant') || err.message?.includes('Token has been expired or revoked')) {
            result.status = 'token_expired';
            result.error = 'Refresh token expired or revoked';
          } else {
            result.status = 'error';
            result.error = err.message;
          }
        }

        results.push(result);
      }
    }

    const healthy = results.filter(r => r.status === 'healthy').length;
    const expired = results.filter(r => r.status === 'token_expired').length;
    const configured = results.filter(r => r.status !== 'not_configured').length;

    res.json({
      success: true,
      summary: { total: results.length, configured, healthy, expired },
      accounts: results
    });

  } catch (error) {
    console.error('Gmail health check error:', error);
    res.status(500).json({ success: false, message: 'Health check failed', error: error.message });
  }
});

/**
 * @route   GET /api/gmail/auth2
 * @desc    Start OAuth2 authentication flow for SECONDARY account
 * @access  Public
 */
router.get('/auth2', async (req, res) => {
  try {
    console.log('🔐 Starting Gmail OAuth2 authentication flow for SECONDARY account...');

    const clientId = process.env.GMAIL_CLIENT_ID_2;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET_2;
    const redirectUri = process.env.GMAIL_REDIRECT_URI_2 || 'http://localhost:5000/api/gmail/oauth2callback2';

    if (!clientId || !clientSecret) {
      return res.status(500).json({
        success: false,
        message: 'Secondary Gmail account credentials not configured',
        instructions: 'Set GMAIL_CLIENT_ID_2 and GMAIL_CLIENT_SECRET_2 in your .env file'
      });
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent'
    });

    console.log('🔐 Redirecting to Google authentication for secondary account...');
    res.redirect(authUrl);

  } catch (error) {
    console.error('❌ OAuth2 auth error (secondary):', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start authentication for secondary account',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/gmail/oauth2callback2
 * @desc    OAuth2 callback for SECONDARY account
 * @access  Public
 */
router.get('/oauth2callback2', async (req, res) => {
  try {
    const { code } = req.query;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'No authorization code received'
      });
    }

    console.log('🔐 Received authorization code for secondary account, exchanging for tokens...');

    const clientId = process.env.GMAIL_CLIENT_ID_2;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET_2;
    const redirectUri = process.env.GMAIL_REDIRECT_URI_2 || 'http://localhost:5000/api/gmail/oauth2callback2';

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    const { tokens } = await oauth2Client.getToken(code);

    console.log('✅ Tokens received successfully for secondary account');
    console.log('📝 Refresh Token:', tokens.refresh_token ? '✅ Received' : '❌ Not received');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Gmail API - Secondary Account Authenticated</title>
        <style>
          body { font-family: Arial; max-width: 800px; margin: 50px auto; padding: 20px; background: #f5f5f5; }
          .container { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          h1 { color: #4CAF50; }
          .success { color: #4CAF50; font-size: 48px; }
          .code-block { background: #f4f4f4; padding: 15px; border-radius: 5px; margin: 15px 0; font-family: monospace; overflow-x: auto; }
          .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 15px 0; }
          .info { background: #d1ecf1; border-left: 4px solid #0c5460; padding: 15px; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="success">✅</div>
          <h1>Secondary Account Authenticated!</h1>
          <h2>diary@edgetalent.co.uk</h2>

          <div class="info">
            <strong>📧 Email:</strong> ${process.env.GMAIL_EMAIL_2 || 'diary@edgetalent.co.uk'}<br>
            <strong>🔑 Refresh Token:</strong> ${tokens.refresh_token ? 'Received ✅' : 'Not Received ❌'}
          </div>

          ${tokens.refresh_token ? `
            <h2>🔧 Add to .env (Line 71)</h2>
            <div class="code-block">GMAIL_REFRESH_TOKEN_2=${tokens.refresh_token}</div>
            <div class="warning"><strong>⚠️</strong> Keep this secure! Don't commit to Git.</div>
          ` : `
            <div class="warning"><strong>⚠️ No Refresh Token</strong><br>Revoke access at <a href="https://myaccount.google.com/permissions">Google Permissions</a> and try again.</div>
          `}

          <h2>📋 Full Response</h2>
          <div class="code-block">${JSON.stringify(tokens, null, 2)}</div>
        </div>
      </body>
      </html>
    `;

    res.send(html);

  } catch (error) {
    console.error('❌ OAuth2 callback error (secondary):', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete authentication for secondary account',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/gmail/auth3
 * @desc    Start OAuth2 authentication flow for TERTIARY account
 * @access  Public
 */
router.get('/auth3', async (req, res) => {
  try {
    console.log('🔐 Starting Gmail OAuth2 authentication flow for TERTIARY account...');
    console.log('🔐 GMAIL_CLIENT_ID_3 set:', !!process.env.GMAIL_CLIENT_ID_3);
    console.log('🔐 GMAIL_CLIENT_SECRET_3 set:', !!process.env.GMAIL_CLIENT_SECRET_3);
    console.log('🔐 GMAIL_REDIRECT_URI_3:', process.env.GMAIL_REDIRECT_URI_3 || 'not set');

    const clientId = process.env.GMAIL_CLIENT_ID_3;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET_3;
    const redirectUri = process.env.GMAIL_REDIRECT_URI_3 || 'https://edgetalentcrm-production.up.railway.app/api/gmail/oauth2callback3';

    if (!clientId || !clientSecret) {
      console.error('❌ Missing tertiary credentials - clientId:', !!clientId, 'clientSecret:', !!clientSecret);
      return res.status(500).json({
        success: false,
        message: 'Tertiary Gmail account credentials not configured',
        instructions: 'Set GMAIL_CLIENT_ID_3 and GMAIL_CLIENT_SECRET_3 in Railway environment variables',
        debug: {
          hasClientId: !!clientId,
          hasClientSecret: !!clientSecret
        }
      });
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent'
    });

    console.log('🔐 Redirecting to Google authentication for tertiary account...');
    res.redirect(authUrl);

  } catch (error) {
    console.error('❌ OAuth2 auth error (tertiary):', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start authentication for tertiary account',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/gmail/oauth2callback3
 * @desc    OAuth2 callback for TERTIARY account
 * @access  Public
 */
router.get('/oauth2callback3', async (req, res) => {
  try {
    const { code } = req.query;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'No authorization code received'
      });
    }

    console.log('🔐 Received authorization code for tertiary account, exchanging for tokens...');

    const clientId = process.env.GMAIL_CLIENT_ID_3;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET_3;
    const redirectUri = process.env.GMAIL_REDIRECT_URI_3 || 'https://edgetalentcrm-production.up.railway.app/api/gmail/oauth2callback3';

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    const { tokens } = await oauth2Client.getToken(code);

    console.log('✅ Tokens received successfully for tertiary account');
    console.log('📝 Refresh Token:', tokens.refresh_token ? '✅ Received' : '❌ Not received');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Gmail API - Tertiary Account Authenticated</title>
        <style>
          body { font-family: Arial; max-width: 800px; margin: 50px auto; padding: 20px; background: #f5f5f5; }
          .container { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          h1 { color: #4CAF50; }
          .success { color: #4CAF50; font-size: 48px; }
          .code-block { background: #f4f4f4; padding: 15px; border-radius: 5px; margin: 15px 0; font-family: monospace; overflow-x: auto; }
          .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 15px 0; }
          .info { background: #d1ecf1; border-left: 4px solid #0c5460; padding: 15px; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="success">✅</div>
          <h1>Tertiary Account Authenticated!</h1>
          <h2>${process.env.GMAIL_EMAIL_3 || 'Third Email Account'}</h2>

          <div class="info">
            <strong>📧 Email:</strong> ${process.env.GMAIL_EMAIL_3 || 'tertiary@example.com'}<br>
            <strong>🔑 Refresh Token:</strong> ${tokens.refresh_token ? 'Received ✅' : 'Not Received ❌'}
          </div>

          ${tokens.refresh_token ? `
            <h2>🔧 Add to Railway Environment Variables</h2>
            <div class="code-block">GMAIL_REFRESH_TOKEN_3=${tokens.refresh_token}</div>
            <div class="warning"><strong>⚠️</strong> Keep this secure! Don't commit to Git.</div>
          ` : `
            <div class="warning"><strong>⚠️ No Refresh Token</strong><br>Revoke access at <a href="https://myaccount.google.com/permissions">Google Permissions</a> and try again.</div>
          `}

          <h2>📋 Full Response</h2>
          <div class="code-block">${JSON.stringify(tokens, null, 2)}</div>
        </div>
      </body>
      </html>
    `;

    res.send(html);

  } catch (error) {
    console.error('❌ OAuth2 callback error (tertiary):', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete authentication for tertiary account',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/gmail/auth4
 * @desc    Start OAuth2 authentication flow for 4TH account (appt@edgetalent.co.uk)
 * @access  Public
 */
router.get('/auth4', async (req, res) => {
  try {
    console.log('🔐 Starting Gmail OAuth2 authentication flow for 4TH account...');

    const clientId = process.env.GMAIL_CLIENT_ID_4;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET_4;
    const redirectUri = process.env.GMAIL_REDIRECT_URI_4 || 'https://edgetalentcrm-production.up.railway.app/api/gmail/oauth2callback4';

    if (!clientId || !clientSecret) {
      return res.status(500).json({
        success: false,
        message: '4th Gmail account credentials not configured',
        instructions: 'Set GMAIL_CLIENT_ID_4 and GMAIL_CLIENT_SECRET_4 in Railway environment variables',
        debug: {
          hasClientId: !!clientId,
          hasClientSecret: !!clientSecret
        }
      });
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent'
    });

    console.log('🔐 Redirecting to Google authentication for 4th account...');
    res.redirect(authUrl);

  } catch (error) {
    console.error('❌ OAuth2 auth error (4th):', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start authentication for 4th account',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/gmail/oauth2callback4
 * @desc    OAuth2 callback for 4TH account (appt@edgetalent.co.uk)
 * @access  Public
 */
router.get('/oauth2callback4', async (req, res) => {
  try {
    const { code } = req.query;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'No authorization code received'
      });
    }

    console.log('🔐 Received authorization code for 4th account, exchanging for tokens...');

    const clientId = process.env.GMAIL_CLIENT_ID_4;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET_4;
    const redirectUri = process.env.GMAIL_REDIRECT_URI_4 || 'https://edgetalentcrm-production.up.railway.app/api/gmail/oauth2callback4';

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    const { tokens } = await oauth2Client.getToken(code);

    console.log('✅ Tokens received successfully for 4th account');
    console.log('📝 Refresh Token:', tokens.refresh_token ? '✅ Received' : '❌ Not received');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Gmail API - 4th Account Authenticated</title>
        <style>
          body { font-family: Arial; max-width: 800px; margin: 50px auto; padding: 20px; background: #f5f5f5; }
          .container { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          h1 { color: #4CAF50; }
          .success { color: #4CAF50; font-size: 48px; }
          .code-block { background: #f4f4f4; padding: 15px; border-radius: 5px; margin: 15px 0; font-family: monospace; overflow-x: auto; word-break: break-all; }
          .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 15px 0; }
          .info { background: #d1ecf1; border-left: 4px solid #0c5460; padding: 15px; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="success">✅</div>
          <h1>4th Account Authenticated!</h1>
          <h2>appt@edgetalent.co.uk</h2>

          <div class="info">
            <strong>📧 Email:</strong> ${process.env.GMAIL_EMAIL_4 || 'appt@edgetalent.co.uk'}<br>
            <strong>🔑 Refresh Token:</strong> ${tokens.refresh_token ? 'Received ✅' : 'Not Received ❌'}
          </div>

          ${tokens.refresh_token ? `
            <h2>🔧 Add to Railway Environment Variables</h2>
            <div class="code-block">GMAIL_REFRESH_TOKEN_4=${tokens.refresh_token}</div>
            <div class="warning"><strong>⚠️</strong> Keep this secure! Don't commit to Git.</div>
          ` : `
            <div class="warning"><strong>⚠️ No Refresh Token</strong><br>Revoke access at <a href="https://myaccount.google.com/permissions">Google Permissions</a> and try again.</div>
          `}

          <h2>📋 Full Response</h2>
          <div class="code-block">${JSON.stringify(tokens, null, 2)}</div>
        </div>
      </body>
      </html>
    `;

    res.send(html);

  } catch (error) {
    console.error('❌ OAuth2 callback error (4th):', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete authentication for 4th account',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/gmail/auth5
 * @desc    Start OAuth2 authentication flow for 5TH account (book@edgetalent.co.uk)
 * @access  Public
 */
router.get('/auth5', async (req, res) => {
  try {
    console.log('🔐 Starting Gmail OAuth2 authentication flow for 5TH account...');

    const clientId = process.env.GMAIL_CLIENT_ID_5;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET_5;
    const redirectUri = process.env.GMAIL_REDIRECT_URI_5 || 'https://edgetalentcrm-production.up.railway.app/api/gmail/oauth2callback5';

    if (!clientId || !clientSecret) {
      return res.status(500).json({
        success: false,
        message: '5th Gmail account credentials not configured',
        instructions: 'Set GMAIL_CLIENT_ID_5 and GMAIL_CLIENT_SECRET_5 in Railway environment variables',
        debug: {
          hasClientId: !!clientId,
          hasClientSecret: !!clientSecret
        }
      });
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent'
    });

    console.log('🔐 Redirecting to Google authentication for 5th account...');
    res.redirect(authUrl);

  } catch (error) {
    console.error('❌ OAuth2 auth error (5th):', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start authentication for 5th account',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/gmail/oauth2callback5
 * @desc    OAuth2 callback for 5TH account (book@edgetalent.co.uk)
 * @access  Public
 */
router.get('/oauth2callback5', async (req, res) => {
  try {
    const { code } = req.query;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'No authorization code received'
      });
    }

    console.log('🔐 Received authorization code for 5th account, exchanging for tokens...');

    const clientId = process.env.GMAIL_CLIENT_ID_5;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET_5;
    const redirectUri = process.env.GMAIL_REDIRECT_URI_5 || 'https://edgetalentcrm-production.up.railway.app/api/gmail/oauth2callback5';

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    const { tokens } = await oauth2Client.getToken(code);

    console.log('✅ Tokens received successfully for 5th account');
    console.log('📝 Refresh Token:', tokens.refresh_token ? '✅ Received' : '❌ Not received');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Gmail API - 5th Account Authenticated</title>
        <style>
          body { font-family: Arial; max-width: 800px; margin: 50px auto; padding: 20px; background: #f5f5f5; }
          .container { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          h1 { color: #4CAF50; }
          .success { color: #4CAF50; font-size: 48px; }
          .code-block { background: #f4f4f4; padding: 15px; border-radius: 5px; margin: 15px 0; font-family: monospace; overflow-x: auto; word-break: break-all; }
          .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 15px 0; }
          .info { background: #d1ecf1; border-left: 4px solid #0c5460; padding: 15px; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="success">✅</div>
          <h1>5th Account Authenticated!</h1>
          <h2>book@edgetalent.co.uk</h2>

          <div class="info">
            <strong>📧 Email:</strong> ${process.env.GMAIL_EMAIL_5 || 'book@edgetalent.co.uk'}<br>
            <strong>🔑 Refresh Token:</strong> ${tokens.refresh_token ? 'Received ✅' : 'Not Received ❌'}
          </div>

          ${tokens.refresh_token ? `
            <h2>🔧 Add to Railway Environment Variables</h2>
            <div class="code-block">GMAIL_REFRESH_TOKEN_5=${tokens.refresh_token}</div>
            <div class="warning"><strong>⚠️</strong> Keep this secure! Don't commit to Git.</div>
          ` : `
            <div class="warning"><strong>⚠️ No Refresh Token</strong><br>Revoke access at <a href="https://myaccount.google.com/permissions">Google Permissions</a> and try again.</div>
          `}

          <h2>📋 Full Response</h2>
          <div class="code-block">${JSON.stringify(tokens, null, 2)}</div>
        </div>
      </body>
      </html>
    `;

    res.send(html);

  } catch (error) {
    console.error('❌ OAuth2 callback error (5th):', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete authentication for 5th account',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/gmail/auth6
 * @desc    Start OAuth2 authentication flow for 6TH account (photo@edgetalent.co.uk)
 * @access  Public
 */
router.get('/auth6', async (req, res) => {
  try {
    console.log('🔐 Starting Gmail OAuth2 authentication flow for 6TH account...');

    const clientId = process.env.GMAIL_CLIENT_ID_6;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET_6;
    const redirectUri = process.env.GMAIL_REDIRECT_URI_6 || 'https://edgetalentcrm-production.up.railway.app/api/gmail/oauth2callback6';

    if (!clientId || !clientSecret) {
      return res.status(500).json({
        success: false,
        message: '6th Gmail account credentials not configured',
        instructions: 'Set GMAIL_CLIENT_ID_6 and GMAIL_CLIENT_SECRET_6 in Railway environment variables',
        debug: {
          hasClientId: !!clientId,
          hasClientSecret: !!clientSecret
        }
      });
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent'
    });

    console.log('🔐 Redirecting to Google authentication for 6th account...');
    res.redirect(authUrl);

  } catch (error) {
    console.error('❌ OAuth2 auth error (6th):', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start authentication for 6th account',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/gmail/oauth2callback6
 * @desc    OAuth2 callback for 6TH account (photo@edgetalent.co.uk)
 * @access  Public
 */
router.get('/oauth2callback6', async (req, res) => {
  try {
    const { code } = req.query;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'No authorization code received'
      });
    }

    console.log('🔐 Received authorization code for 6th account, exchanging for tokens...');

    const clientId = process.env.GMAIL_CLIENT_ID_6;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET_6;
    const redirectUri = process.env.GMAIL_REDIRECT_URI_6 || 'https://edgetalentcrm-production.up.railway.app/api/gmail/oauth2callback6';

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    const { tokens } = await oauth2Client.getToken(code);

    console.log('✅ Tokens received successfully for 6th account');
    console.log('📝 Refresh Token:', tokens.refresh_token ? '✅ Received' : '❌ Not received');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Gmail API - 6th Account Authenticated</title>
        <style>
          body { font-family: Arial; max-width: 800px; margin: 50px auto; padding: 20px; background: #f5f5f5; }
          .container { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          h1 { color: #4CAF50; }
          .success { color: #4CAF50; font-size: 48px; }
          .code-block { background: #f4f4f4; padding: 15px; border-radius: 5px; margin: 15px 0; font-family: monospace; overflow-x: auto; word-break: break-all; }
          .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 15px 0; }
          .info { background: #d1ecf1; border-left: 4px solid #0c5460; padding: 15px; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="success">✅</div>
          <h1>6th Account Authenticated!</h1>
          <h2>photo@edgetalent.co.uk</h2>

          <div class="info">
            <strong>📧 Email:</strong> ${process.env.GMAIL_EMAIL_6 || 'photo@edgetalent.co.uk'}<br>
            <strong>🔑 Refresh Token:</strong> ${tokens.refresh_token ? 'Received ✅' : 'Not Received ❌'}
          </div>

          ${tokens.refresh_token ? `
            <h2>🔧 Add to Railway Environment Variables</h2>
            <div class="code-block">GMAIL_REFRESH_TOKEN_6=${tokens.refresh_token}</div>
            <div class="warning"><strong>⚠️</strong> Keep this secure! Don't commit to Git.</div>
          ` : `
            <div class="warning"><strong>⚠️ No Refresh Token</strong><br>Revoke access at <a href="https://myaccount.google.com/permissions">Google Permissions</a> and try again.</div>
          `}

          <h2>📋 Full Response</h2>
          <div class="code-block">${JSON.stringify(tokens, null, 2)}</div>
        </div>
      </body>
      </html>
    `;

    res.send(html);

  } catch (error) {
    console.error('❌ OAuth2 callback error (6th):', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete authentication for 6th account',
      error: error.message
    });
  }
});

module.exports = router;
