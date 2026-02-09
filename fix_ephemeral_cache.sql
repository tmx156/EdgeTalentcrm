-- Fix for Railway ephemeral storage issue
-- Run this in Supabase SQL Editor

-- Create table to track processed emails (survives Railway restarts)
CREATE TABLE IF NOT EXISTS processed_gmail_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_key TEXT NOT NULL,
  gmail_message_id TEXT NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_key, gmail_message_id)
);

-- Add index for fast lookups
CREATE INDEX IF NOT EXISTS idx_processed_gmail_lookup 
ON processed_gmail_messages(account_key, gmail_message_id);

-- Migrate existing data from file cache (if any)
-- This will be empty initially but prevents errors

-- Verify table exists
SELECT 'processed_gmail_messages table created' as status;
