-- =====================================================
-- Add Missing Columns to Supabase Schema
-- =====================================================
-- Run this in Supabase SQL Editor to add missing columns
-- that the application code expects
-- =====================================================

-- 1. Add is_active column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Update existing users to be active by default
UPDATE users 
SET is_active = TRUE 
WHERE is_active IS NULL;

-- Add index for active users
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active) WHERE is_active = TRUE;

-- 2. Add booking_status column to leads table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS booking_status TEXT;

-- booking_status values: 'Reschedule', 'Arrived', 'Left', 'No Show', 'No Sale', etc.
-- This is used to track additional booking states beyond just status

-- Add index for booking_status
CREATE INDEX IF NOT EXISTS idx_leads_booking_status ON leads(booking_status) WHERE booking_status IS NOT NULL;

-- 3. Add read_status column to messages table
-- The schema has 'read' boolean, but code expects 'read_status' BOOLEAN
ALTER TABLE messages ADD COLUMN IF NOT EXISTS read_status BOOLEAN DEFAULT FALSE;

-- Sync existing 'read' boolean to 'read_status' boolean for compatibility
UPDATE messages 
SET read_status = COALESCE(read, FALSE)
WHERE read_status IS NULL;

-- Add index for read_status
CREATE INDEX IF NOT EXISTS idx_messages_read_status ON messages(read_status) WHERE read_status = FALSE;

-- Note: Both 'read' and 'read_status' boolean columns exist for backward compatibility

-- 4. Add reschedule_reason column to leads (if missing)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS reschedule_reason TEXT;

-- 5. Add cancellation_reason column to leads (if missing)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

-- 6. Add leads_assigned, bookings_made, show_ups to users (if missing)
ALTER TABLE users ADD COLUMN IF NOT EXISTS leads_assigned INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bookings_made INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS show_ups INTEGER DEFAULT 0;

-- Verify columns were added
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name IN ('users', 'leads', 'messages')
  AND column_name IN ('is_active', 'booking_status', 'read_status', 'reschedule_reason', 'cancellation_reason', 'leads_assigned', 'bookings_made', 'show_ups')
ORDER BY table_name, column_name;

