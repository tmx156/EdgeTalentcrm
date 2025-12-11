-- =====================================================
-- CALLBACK REMINDERS TABLE - Complete Schema
-- =====================================================
-- Run this in your Supabase SQL Editor to create the table
-- =====================================================

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- CALLBACK REMINDERS TABLE
-- =====================================================
-- Table to store scheduled callback reminders for leads
CREATE TABLE IF NOT EXISTS callback_reminders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Callback details
    callback_time TIMESTAMPTZ NOT NULL, -- When to trigger the reminder (UK time converted to UTC)
    callback_note TEXT, -- Optional note from the booker
    
    -- Status tracking
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'notified', 'completed', 'cancelled')),
    notified_at TIMESTAMPTZ, -- When notification was sent
    completed_at TIMESTAMPTZ, -- When callback was completed
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_callback_reminders_lead_id ON callback_reminders(lead_id);
CREATE INDEX IF NOT EXISTS idx_callback_reminders_user_id ON callback_reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_callback_reminders_callback_time ON callback_reminders(callback_time) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_callback_reminders_status ON callback_reminders(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_callback_reminders_user_status_time ON callback_reminders(user_id, status, callback_time) WHERE status = 'pending';

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================
-- Enable RLS
ALTER TABLE callback_reminders ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own callback reminders
CREATE POLICY "Users can view their own callback reminders" ON callback_reminders
    FOR SELECT USING (auth.uid() = user_id);

-- Policy: Users can insert their own callback reminders
CREATE POLICY "Users can insert their own callback reminders" ON callback_reminders
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own callback reminders
CREATE POLICY "Users can update their own callback reminders" ON callback_reminders
    FOR UPDATE USING (auth.uid() = user_id);

-- Policy: Admins can view all callback reminders
CREATE POLICY "Admins can view all callback reminders" ON callback_reminders
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================
COMMENT ON TABLE callback_reminders IS 'Scheduled callback reminders for leads - triggers notifications at specified UK time';
COMMENT ON COLUMN callback_reminders.callback_time IS 'When to trigger the reminder (stored as UTC, represents UK local time)';
COMMENT ON COLUMN callback_reminders.status IS 'Reminder status: pending (not yet triggered), notified (notification sent), completed (callback done), cancelled (no longer needed)';






















