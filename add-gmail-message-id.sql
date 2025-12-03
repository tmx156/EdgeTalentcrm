-- Migration: Add gmail_message_id column to messages table
-- This column stores the Gmail API message ID for deduplication and tracking
-- Run this in your Supabase SQL editor

-- Add gmail_message_id column if it doesn't exist
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS gmail_message_id TEXT;

-- Create an index on gmail_message_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_messages_gmail_message_id
ON messages(gmail_message_id);

-- Add a comment to the column
COMMENT ON COLUMN messages.gmail_message_id IS 'Gmail API message ID for deduplication and tracking';

-- Optional: Add a unique constraint to prevent duplicate Gmail messages
-- (Commented out by default - uncomment if you want strict uniqueness)
-- ALTER TABLE messages
-- ADD CONSTRAINT unique_gmail_message_id UNIQUE (gmail_message_id, lead_id);

SELECT 'Migration completed successfully! gmail_message_id column added to messages table.' AS result;
