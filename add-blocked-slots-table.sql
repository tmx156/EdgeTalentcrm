-- Create blocked_slots table for managing calendar availability
-- This allows admin users to close specific days or time slots

CREATE TABLE IF NOT EXISTS blocked_slots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL,
    time_slot TEXT, -- NULL means entire day is blocked, otherwise specific time like "10:00"
    slot_number INTEGER, -- 1, 2, or NULL for both slots
    reason TEXT, -- Why this slot is blocked (e.g., "Holiday", "Staff unavailable")
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_blocked_slots_date ON blocked_slots(date);
CREATE INDEX IF NOT EXISTS idx_blocked_slots_date_time ON blocked_slots(date, time_slot);

-- Add constraint to ensure slot_number is 1 or 2 when specified
ALTER TABLE blocked_slots
ADD CONSTRAINT check_slot_number
CHECK (slot_number IS NULL OR slot_number IN (1, 2));

-- Add RLS (Row Level Security) policies
ALTER TABLE blocked_slots ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read blocked slots (needed for booking validation)
CREATE POLICY "Anyone can view blocked slots" ON blocked_slots
    FOR SELECT USING (true);

-- Policy: Only admin users can insert/update/delete blocked slots
CREATE POLICY "Only admins can manage blocked slots" ON blocked_slots
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );

COMMENT ON TABLE blocked_slots IS 'Tracks blocked calendar days and time slots to prevent bookings';
COMMENT ON COLUMN blocked_slots.date IS 'Date of the blocked period';
COMMENT ON COLUMN blocked_slots.time_slot IS 'Specific time slot (e.g., "10:00") or NULL for full day block';
COMMENT ON COLUMN blocked_slots.slot_number IS 'Which slot column (1 or 2) or NULL for both';
COMMENT ON COLUMN blocked_slots.reason IS 'Reason for blocking this slot';
