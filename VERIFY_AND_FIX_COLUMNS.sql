-- ============================================
-- STEP 1: VERIFY WHICH COLUMNS ARE MISSING
-- ============================================
-- Run this first to see what's missing

SELECT 
  'messages' as table_name,
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_name = 'messages'
ORDER BY column_name;

-- Expected columns that should exist:
-- - delivery_attempts
-- - delivery_provider  
-- - delivery_status
-- - provider_message_id

-- ============================================
-- STEP 2: ADD MISSING COLUMNS
-- ============================================
-- If any columns are missing from Step 1, run this:

ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS delivery_status TEXT DEFAULT 'sent';

ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS provider_message_id TEXT;

ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS delivery_provider TEXT;

ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS delivery_attempts INTEGER DEFAULT 0;

-- ============================================
-- STEP 3: VERIFY COLUMNS WERE ADDED
-- ============================================
-- Run this to confirm all columns now exist

SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'messages' AND column_name = 'delivery_status'
    ) THEN '✅ delivery_status EXISTS'
    ELSE '❌ delivery_status MISSING'
  END as status_check
UNION ALL
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'messages' AND column_name = 'provider_message_id'
    ) THEN '✅ provider_message_id EXISTS'
    ELSE '❌ provider_message_id MISSING'
  END
UNION ALL
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'messages' AND column_name = 'delivery_provider'
    ) THEN '✅ delivery_provider EXISTS'
    ELSE '❌ delivery_provider MISSING'
  END
UNION ALL
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'messages' AND column_name = 'delivery_attempts'
    ) THEN '✅ delivery_attempts EXISTS'
    ELSE '❌ delivery_attempts MISSING'
  END;

-- ============================================
-- IMPORTANT: Make sure you're running this in the CORRECT Supabase project!
-- Project URL should be: https://ziqsvwoyafespvaychlg.supabase.co
-- ============================================

