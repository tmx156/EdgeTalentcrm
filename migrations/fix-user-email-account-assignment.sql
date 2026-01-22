-- Fix user email account assignment to allow env var accounts
-- This changes the column to TEXT and removes the UUID foreign key constraint
-- so we can store 'primary', 'secondary', or UUIDs

-- Step 1: Drop the foreign key constraint
ALTER TABLE users
DROP CONSTRAINT IF EXISTS users_assigned_email_account_id_fkey;

-- Step 2: Change column type from UUID to TEXT
ALTER TABLE users
ALTER COLUMN assigned_email_account_id TYPE TEXT;

-- Add a comment explaining the column now accepts multiple types
COMMENT ON COLUMN users.assigned_email_account_id IS 'Email account for this user: UUID for database accounts, or "primary"/"secondary" for env var accounts';
