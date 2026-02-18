-- =====================================================
-- ADD BOOKING SLOT COLUMN TO LEADS TABLE
-- =====================================================
-- This script adds a booking_slot column to support the new
-- slot-based calendar system with 3 columns (Slot 1, Slot 2, and Slot 3)

-- Add booking_slot column
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS booking_slot INTEGER DEFAULT 1
CHECK (booking_slot IN (1, 2, 3));

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_leads_booking_slot 
ON leads(booking_slot) 
WHERE deleted_at IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN leads.booking_slot IS 'Calendar slot assignment: 1, 2, or 3 for triple-column booking system';

-- =====================================================
-- MIGRATE EXISTING BOOKINGS TO SLOTS
-- =====================================================
-- Distribute existing bookings between slot 1 and slot 2
-- Strategy: Alternate based on hour of booking time
-- Even hours (10, 12, 14, 16) -> Slot 1
-- Odd hours (11, 13, 15) -> Slot 2
-- If no time_booked, use round-robin based on ID

-- Update bookings with time_booked (extract hour and assign slot)
UPDATE leads
SET booking_slot = CASE
  WHEN time_booked IS NOT NULL AND time_booked != '' THEN
    CASE 
      WHEN CAST(SPLIT_PART(time_booked, ':', 1) AS INTEGER) % 2 = 0 THEN 1
      ELSE 2
    END
  ELSE
    -- Round-robin for bookings without time
    CASE WHEN (ROW_NUMBER() OVER (ORDER BY created_at)) % 2 = 1 THEN 1 ELSE 2 END
END
WHERE date_booked IS NOT NULL
  AND deleted_at IS NULL
  AND booking_slot IS NULL;

-- Verify migration
SELECT 
  booking_slot,
  COUNT(*) as booking_count,
  COUNT(CASE WHEN time_booked IS NOT NULL THEN 1 END) as with_time,
  COUNT(CASE WHEN time_booked IS NULL THEN 1 END) as without_time
FROM leads
WHERE date_booked IS NOT NULL 
  AND deleted_at IS NULL
GROUP BY booking_slot
ORDER BY booking_slot;

-- Show sample of migrated bookings
SELECT 
  id,
  name,
  date_booked,
  time_booked,
  booking_slot,
  status
FROM leads
WHERE date_booked IS NOT NULL 
  AND deleted_at IS NULL
ORDER BY date_booked DESC, booking_slot
LIMIT 20;

