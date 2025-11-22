-- Add SalesApe tracking columns to leads table
-- Run this SQL in your Supabase SQL editor

ALTER TABLE leads
ADD COLUMN IF NOT EXISTS salesape_initial_message_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS salesape_user_engaged BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS salesape_goal_presented BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS salesape_goal_hit BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS salesape_opted_out BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS salesape_follow_ups_ended BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS salesape_conversation_summary TEXT,
ADD COLUMN IF NOT EXISTS salesape_full_transcript TEXT,
ADD COLUMN IF NOT EXISTS salesape_conversation_url TEXT,
ADD COLUMN IF NOT EXISTS airtable_record_id TEXT;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_leads_salesape_status ON leads(salesape_user_engaged, salesape_goal_hit);
CREATE INDEX IF NOT EXISTS idx_leads_airtable_record_id ON leads(airtable_record_id);

-- Update existing leads with SalesApe data if they have salesape_id
UPDATE leads
SET airtable_record_id = salesape_id
WHERE salesape_id IS NOT NULL AND airtable_record_id IS NULL;