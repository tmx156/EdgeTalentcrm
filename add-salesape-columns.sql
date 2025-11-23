-- Add SalesApe tracking columns to leads table
-- Run this in your Supabase SQL Editor

ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS salesape_record_id TEXT,
ADD COLUMN IF NOT EXISTS salesape_sent_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS salesape_status TEXT,
ADD COLUMN IF NOT EXISTS salesape_initial_message_sent BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS salesape_user_engaged BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS salesape_goal_presented BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS salesape_goal_hit BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS salesape_follow_ups_ended BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS salesape_opted_out BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS salesape_conversation_summary TEXT,
ADD COLUMN IF NOT EXISTS salesape_full_transcript TEXT,
ADD COLUMN IF NOT EXISTS salesape_portal_link TEXT,
ADD COLUMN IF NOT EXISTS salesape_last_updated TIMESTAMP WITH TIME ZONE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_leads_salesape_record_id ON leads(salesape_record_id);
CREATE INDEX IF NOT EXISTS idx_leads_salesape_status ON leads(salesape_status);
CREATE INDEX IF NOT EXISTS idx_leads_salesape_goal_hit ON leads(salesape_goal_hit);

-- Add comment to document the columns
COMMENT ON COLUMN leads.salesape_record_id IS 'Airtable record ID from SalesApe';
COMMENT ON COLUMN leads.salesape_status IS 'Current status in SalesApe workflow';
COMMENT ON COLUMN leads.salesape_goal_hit IS 'Whether SalesApe achieved the goal (booking/conversion)';
COMMENT ON COLUMN leads.salesape_portal_link IS 'Link to view conversation in SalesApe portal';
