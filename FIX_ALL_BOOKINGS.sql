-- FIX ALL BOOKINGS: Set ever_booked = true for all booked leads
-- Run this in Supabase SQL Editor or PostgreSQL

-- Update all leads where status is 'Booked' and they have a booked_at timestamp
UPDATE leads
SET ever_booked = true
WHERE status = 'Booked'
  AND booked_at IS NOT NULL
  AND (ever_booked = false OR ever_booked IS NULL);

-- Verify the fix
SELECT
  id,
  name,
  status,
  ever_booked,
  booked_at,
  date_booked
FROM leads
WHERE booked_at >= CURRENT_DATE
ORDER BY booked_at DESC;
