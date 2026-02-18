-- =====================================================
-- MIGRATE DATABASE CONSTRAINTS FOR 3-SLOT CALENDAR
-- =====================================================
-- Run this on Supabase SQL Editor to allow booking_slot = 3

-- 1. Update leads.booking_slot constraint (drop old, add new)
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_booking_slot_check;
ALTER TABLE leads ADD CONSTRAINT leads_booking_slot_check
  CHECK (booking_slot IN (1, 2, 3));

-- 2. Update blocked_slots.slot_number constraint (drop old, add new)
ALTER TABLE blocked_slots DROP CONSTRAINT IF EXISTS check_slot_number;
ALTER TABLE blocked_slots ADD CONSTRAINT check_slot_number
  CHECK (slot_number IS NULL OR slot_number IN (1, 2, 3));

-- 3. Update comments
COMMENT ON COLUMN leads.booking_slot IS 'Calendar slot assignment: 1, 2, or 3 for triple-column booking system';
COMMENT ON COLUMN blocked_slots.slot_number IS 'Which slot column (1, 2, or 3) or NULL for all';

-- 4. Verify constraints updated
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid IN ('leads'::regclass, 'blocked_slots'::regclass)
  AND conname IN ('leads_booking_slot_check', 'check_slot_number');
