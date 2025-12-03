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

-- Indexes for callback reminders
CREATE INDEX IF NOT EXISTS idx_callback_reminders_lead_id ON callback_reminders(lead_id);
CREATE INDEX IF NOT EXISTS idx_callback_reminders_user_id ON callback_reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_callback_reminders_callback_time ON callback_reminders(callback_time) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_callback_reminders_status ON callback_reminders(status) WHERE status = 'pending';

