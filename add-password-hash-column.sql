-- Add password_hash column to users table
-- Run this in Supabase SQL Editor first, then run update-admin-password-hash.js

-- Add password_hash column if it doesn't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Copy existing password data to password_hash for users that don't have it
UPDATE users 
SET password_hash = password 
WHERE password_hash IS NULL AND password IS NOT NULL;

-- Verify the column was added
SELECT 
    column_name, 
    data_type, 
    is_nullable 
FROM information_schema.columns 
WHERE table_name = 'users' 
  AND column_name IN ('password', 'password_hash')
ORDER BY column_name;

