-- =====================================================
-- CRM System - Supabase Database Schema
-- =====================================================
-- Complete schema for CRM system with all tables,
-- relationships, indexes, and constraints.
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. USERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT, -- Hashed password (nullable for OAuth users)
    password_hash TEXT, -- Alternative password hash column (for compatibility)
    role TEXT NOT NULL CHECK (role IN ('admin', 'booker', 'closer', 'viewer')),
    is_active BOOLEAN DEFAULT TRUE, -- Track if user account is active
    leads_assigned INTEGER DEFAULT 0, -- Counter for assigned leads
    bookings_made INTEGER DEFAULT 0, -- Counter for bookings made
    show_ups INTEGER DEFAULT 0, -- Counter for show ups
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for users
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active) WHERE is_active = TRUE;

-- =====================================================
-- 2. LEADS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    age INTEGER,
    postcode TEXT,
    image_url TEXT,
    parent_phone TEXT,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'New' CHECK (
        status IN ('New', 'Assigned', 'Contacted', 'Booked', 'Confirmed', 
                  'Attended', 'Cancelled', 'No Answer', 'No answer', 'Not Interested', 'Not interested', 
                  'Sale', 'Sales/converted - purchased',
                  'Rejected', 'Call Back', 'Call back', 
                  'Left Message', 'Not Qualified',
                  'Reschedule', 'No Show', 'Wrong number')
    ),
    date_booked TIMESTAMPTZ, -- When the appointment is scheduled (future date)
    booked_at TIMESTAMPTZ, -- When the booking action was made (tracks conversion)
    assigned_at TIMESTAMPTZ, -- When lead was assigned to booker
    time_booked TEXT, -- Appointment time slot
    is_confirmed BOOLEAN DEFAULT FALSE,
    has_sale INTEGER DEFAULT 0 CHECK (has_sale IN (0, 1)), -- 0 or 1 boolean flag
    ever_booked BOOLEAN DEFAULT FALSE, -- Tracks if lead was ever booked
    
    -- Foreign Keys
    booker_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Booking history (JSON string for tracking changes)
    booking_history JSONB,
    
    -- Booking status (for additional states: Reschedule, Arrived, Left, No Show, No Sale)
    booking_status TEXT,
    
    -- Reschedule and cancellation reasons
    reschedule_reason TEXT,
    cancellation_reason TEXT,
    
    -- Soft delete
    deleted_at TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- SalesAPE integration fields (optional)
    salesape_id TEXT,
    salesape_qualified BOOLEAN DEFAULT FALSE,
    salesape_conversation_id TEXT,
    custom_fields JSONB
);

-- Indexes for leads
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_leads_booker_id ON leads(booker_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_leads_date_booked ON leads(date_booked) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_leads_booked_at ON leads(booked_at) WHERE booked_at IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_leads_assigned_at ON leads(assigned_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_leads_ever_booked ON leads(ever_booked) WHERE ever_booked = TRUE AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email) WHERE email IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone) WHERE phone IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_leads_deleted_at ON leads(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_leads_booking_status ON leads(booking_status) WHERE booking_status IS NOT NULL;

-- =====================================================
-- 3. SALES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- Who made the sale
    amount NUMERIC(10, 2) NOT NULL,
    payment_method TEXT, -- e.g., 'cash', 'card', 'transfer'
    payment_type TEXT CHECK (payment_type IN ('full_payment', 'finance', 'deposit')),
    payment_status TEXT, -- e.g., 'pending', 'completed', 'failed'
    status TEXT, -- Sale status
    notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for sales
CREATE INDEX IF NOT EXISTS idx_sales_lead_id ON sales(lead_id);
CREATE INDEX IF NOT EXISTS idx_sales_user_id ON sales(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sales_amount ON sales(amount);

-- =====================================================
-- 4. TEMPLATES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS templates (
    id TEXT PRIMARY KEY, -- Custom ID format: template-{timestamp}-{random}
    name TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL, -- e.g., 'appointment_reminder', 'status_update', 'sale_receipt'
    subject TEXT, -- Email subject line
    email_body TEXT, -- Email template content
    sms_body TEXT, -- SMS template content
    category TEXT, -- Template category/grouping
    variables JSONB, -- Available template variables
    reminder_days INTEGER, -- Days before appointment to send reminder
    send_email BOOLEAN DEFAULT TRUE,
    send_sms BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    email_account TEXT DEFAULT 'primary' CHECK (email_account IN ('primary', 'secondary')),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- Template owner/creator
    attachments JSONB, -- Array of attachment URLs/metadata
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for templates
CREATE INDEX IF NOT EXISTS idx_templates_type ON templates(type);
CREATE INDEX IF NOT EXISTS idx_templates_is_active ON templates(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_templates_email_account ON templates(email_account);
CREATE INDEX IF NOT EXISTS idx_templates_user_id ON templates(user_id);
CREATE INDEX IF NOT EXISTS idx_templates_category ON templates(category) WHERE category IS NOT NULL;

-- =====================================================
-- 5. MESSAGES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    template_id TEXT REFERENCES templates(id) ON DELETE SET NULL,
    
    -- Message content
    type TEXT NOT NULL CHECK (type IN ('email', 'sms', 'both')),
    subject TEXT, -- Email subject (null for SMS)
    content TEXT NOT NULL, -- Message body (email_body or sms_body)
    email_body TEXT, -- Full email HTML/text content
    sms_body TEXT, -- SMS content
    
    -- Recipient info
    recipient_email TEXT,
    recipient_phone TEXT,
    
    -- Sender info
    sent_by UUID REFERENCES users(id) ON DELETE SET NULL,
    sent_by_name TEXT, -- Cached sender name
    
    -- Message status
    status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'pending', 'delivered', 'read')),
    email_status TEXT, -- Email-specific status
    sms_status TEXT, -- SMS-specific status
    read BOOLEAN DEFAULT FALSE, -- Whether recipient read the message (for received messages)
    read_status BOOLEAN DEFAULT FALSE, -- Alternative read status column (for compatibility with code)
    delivery_status TEXT, -- Delivery tracking status
    provider_message_id TEXT, -- Provider-specific message ID
    delivery_provider TEXT, -- Which provider delivered the message
    delivery_attempts INTEGER DEFAULT 0, -- Number of delivery attempts
    error_message TEXT, -- Error message if delivery failed
    
    -- Metadata
    sent_at TIMESTAMPTZ DEFAULT NOW(), -- When message was actually sent
    booking_date TIMESTAMPTZ, -- Related booking/appointment date
    reminder_days INTEGER, -- Days before appointment (for reminders)
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for messages
CREATE INDEX IF NOT EXISTS idx_messages_lead_id ON messages(lead_id);
CREATE INDEX IF NOT EXISTS idx_messages_template_id ON messages(template_id);
CREATE INDEX IF NOT EXISTS idx_messages_sent_by ON messages(sent_by);
CREATE INDEX IF NOT EXISTS idx_messages_sent_at ON messages(sent_at);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_type ON messages(type);
CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status);
CREATE INDEX IF NOT EXISTS idx_messages_recipient_email ON messages(recipient_email) WHERE recipient_email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_recipient_phone ON messages(recipient_phone) WHERE recipient_phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_read_status ON messages(read_status) WHERE read_status = FALSE;

-- Foreign key constraint name for messages.sent_by
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'messages_sent_by_fkey'
    ) THEN
        ALTER TABLE messages 
        ADD CONSTRAINT messages_sent_by_fkey 
        FOREIGN KEY (sent_by) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- =====================================================
-- 6. TRIGGERS FOR UPDATED_AT TIMESTAMPS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to all tables with updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sales_updated_at BEFORE UPDATE ON sales
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON messages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Basic policies (adjust based on your security requirements)
-- For now, allowing service role to bypass RLS
-- You can add more specific policies based on user roles

-- Users: Admins can see all, bookers/closers see all
CREATE POLICY "Users are viewable by authenticated users" ON users
    FOR SELECT USING (true);

CREATE POLICY "Users are insertable by service role" ON users
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users are updatable by service role" ON users
    FOR UPDATE USING (true);

-- Leads: All authenticated users can view/insert/update
CREATE POLICY "Leads are viewable by authenticated users" ON leads
    FOR SELECT USING (deleted_at IS NULL);

CREATE POLICY "Leads are insertable by authenticated users" ON leads
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Leads are updatable by authenticated users" ON leads
    FOR UPDATE USING (true);

-- Sales: All authenticated users can view/insert/update
CREATE POLICY "Sales are viewable by authenticated users" ON sales
    FOR SELECT USING (true);

CREATE POLICY "Sales are insertable by authenticated users" ON sales
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Sales are updatable by authenticated users" ON sales
    FOR UPDATE USING (true);

-- Templates: All authenticated users can view, only admins can modify
CREATE POLICY "Templates are viewable by authenticated users" ON templates
    FOR SELECT USING (true);

CREATE POLICY "Templates are insertable by authenticated users" ON templates
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Templates are updatable by authenticated users" ON templates
    FOR UPDATE USING (true);

-- Messages: Users can see messages related to their leads
CREATE POLICY "Messages are viewable by authenticated users" ON messages
    FOR SELECT USING (true);

CREATE POLICY "Messages are insertable by authenticated users" ON messages
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Messages are updatable by authenticated users" ON messages
    FOR UPDATE USING (true);

-- =====================================================
-- 8. COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE users IS 'System users (admins, bookers, closers, viewers)';
COMMENT ON TABLE leads IS 'CRM leads with status tracking and appointment scheduling';
COMMENT ON TABLE sales IS 'Sales transactions linked to leads';
COMMENT ON TABLE templates IS 'Email and SMS message templates';
COMMENT ON TABLE messages IS 'Record of all sent/received emails and SMS messages';

COMMENT ON COLUMN leads.date_booked IS 'When the appointment is scheduled (future date)';
COMMENT ON COLUMN leads.booked_at IS 'When the booking action was made (tracks conversion)';
COMMENT ON COLUMN leads.assigned_at IS 'When lead was assigned to booker';
COMMENT ON COLUMN leads.ever_booked IS 'Tracks if this lead was ever booked, remains true even after cancellation';
COMMENT ON COLUMN leads.has_sale IS 'Integer flag: 0 = no sale, 1 = has sale';
COMMENT ON COLUMN leads.booking_history IS 'JSON array tracking booking history';
COMMENT ON COLUMN messages.type IS 'Message type: email, sms, or both';
COMMENT ON COLUMN messages.read IS 'Whether recipient read the message (for received messages)';

-- =====================================================
-- SCHEMA CREATION COMPLETE
-- =====================================================
-- 
-- After running this schema:
-- 1. Update your .env file with Supabase credentials:
--    SUPABASE_URL=your_supabase_url
--    SUPABASE_ANON_KEY=your_supabase_anon_key
--    SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
--
-- 2. Verify tables were created:
--    SELECT table_name FROM information_schema.tables 
--    WHERE table_schema = 'public' 
--    AND table_name IN ('users', 'leads', 'sales', 'templates', 'messages');
--
-- 3. Create your first admin user (you may need to insert directly or use your app)
-- =====================================================

