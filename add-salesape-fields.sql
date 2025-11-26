-- Add SalesApe integration fields to leads table
-- These fields track the AI conversation and engagement status

ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS salesape_sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS salesape_last_updated TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS salesape_record_id TEXT,
ADD COLUMN IF NOT EXISTS salesape_status TEXT,
ADD COLUMN IF NOT EXISTS salesape_initial_message_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS salesape_user_engaged BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS salesape_goal_presented BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS salesape_goal_hit BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS salesape_follow_ups_ended BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS salesape_opted_out BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS salesape_conversation_summary TEXT,
ADD COLUMN IF NOT EXISTS salesape_full_transcript TEXT,
ADD COLUMN IF NOT EXISTS salesape_portal_link TEXT;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_leads_salesape_sent_at ON leads(salesape_sent_at) WHERE salesape_sent_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_salesape_status ON leads(salesape_status) WHERE salesape_status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_salesape_goal_hit ON leads(salesape_goal_hit) WHERE salesape_goal_hit = TRUE;
CREATE INDEX IF NOT EXISTS idx_leads_salesape_user_engaged ON leads(salesape_user_engaged) WHERE salesape_user_engaged = TRUE;

-- Comments for documentation
COMMENT ON COLUMN leads.salesape_sent_at IS 'When the lead was sent to SalesApe AI';
COMMENT ON COLUMN leads.salesape_last_updated IS 'Last time SalesApe updated this lead';
COMMENT ON COLUMN leads.salesape_record_id IS 'SalesApe Airtable record ID';
COMMENT ON COLUMN leads.salesape_status IS 'Current SalesApe engagement status';
COMMENT ON COLUMN leads.salesape_initial_message_sent IS 'Has SalesApe sent the first message';
COMMENT ON COLUMN leads.salesape_user_engaged IS 'Has the lead responded to SalesApe';
COMMENT ON COLUMN leads.salesape_goal_presented IS 'Has SalesApe presented the booking goal';
COMMENT ON COLUMN leads.salesape_goal_hit IS 'Has the lead booked through SalesApe';
COMMENT ON COLUMN leads.salesape_follow_ups_ended IS 'Has SalesApe ended follow-up sequence';
COMMENT ON COLUMN leads.salesape_opted_out IS 'Has the lead opted out';
COMMENT ON COLUMN leads.salesape_conversation_summary IS 'Brief summary of the conversation';
COMMENT ON COLUMN leads.salesape_full_transcript IS 'Complete conversation transcript';
COMMENT ON COLUMN leads.salesape_portal_link IS 'Link to view conversation in SalesApe portal';

