-- ============================================================================
-- TEMPLATES TABLE - FULL SCHEMA
-- Complete table definition with all columns
-- ============================================================================

-- Drop existing table (WARNING: This will delete all data!)
-- DROP TABLE IF EXISTS templates CASCADE;

-- Create templates table with complete schema
CREATE TABLE IF NOT EXISTS templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    subject TEXT,
    content TEXT,
    email_body TEXT,
    sms_body TEXT,
    category TEXT,
    is_active BOOLEAN DEFAULT true NOT NULL,
    is_default BOOLEAN DEFAULT false NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    send_email BOOLEAN DEFAULT true NOT NULL,
    send_sms BOOLEAN DEFAULT false NOT NULL,
    reminder_days INTEGER DEFAULT 5,
    email_account TEXT DEFAULT 'primary' NOT NULL,
    attachments TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_templates_user_id ON templates(user_id);
CREATE INDEX IF NOT EXISTS idx_templates_type ON templates(type);
CREATE INDEX IF NOT EXISTS idx_templates_is_active ON templates(is_active);
CREATE INDEX IF NOT EXISTS idx_templates_category ON templates(category);
CREATE INDEX IF NOT EXISTS idx_templates_email_account ON templates(email_account);
CREATE INDEX IF NOT EXISTS idx_templates_created_by ON templates(created_by);

-- Create function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_update_templates_updated_at ON templates;
CREATE TRIGGER trigger_update_templates_updated_at
    BEFORE UPDATE ON templates
    FOR EACH ROW
    EXECUTE FUNCTION update_templates_updated_at();

-- Enable Row Level Security (RLS)
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Admin can see all templates
CREATE POLICY "Admin can view all templates" ON templates
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );

-- Users can view their own templates
CREATE POLICY "Users can view own templates" ON templates
    FOR SELECT
    USING (user_id = auth.uid());

-- Users can view active booking confirmation templates
CREATE POLICY "Users can view active booking confirmations" ON templates
    FOR SELECT
    USING (
        is_active = true
        AND (type = 'booking_confirmation' OR category = 'booking_confirmation')
    );

-- Admin can insert any template
CREATE POLICY "Admin can insert templates" ON templates
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );

-- Users can insert their own templates
CREATE POLICY "Users can insert own templates" ON templates
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- Admin can update any template
CREATE POLICY "Admin can update all templates" ON templates
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );

-- Users can update their own templates
CREATE POLICY "Users can update own templates" ON templates
    FOR UPDATE
    USING (user_id = auth.uid());

-- Admin can delete any template
CREATE POLICY "Admin can delete all templates" ON templates
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );

-- Users can delete their own templates
CREATE POLICY "Users can delete own templates" ON templates
    FOR DELETE
    USING (user_id = auth.uid());

-- Grant permissions
GRANT ALL ON templates TO authenticated;
GRANT SELECT ON templates TO anon;
