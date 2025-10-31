-- Quick fix: Add wallet_address column to users table
-- Run this directly in your database

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS wallet_address VARCHAR(255) UNIQUE;

CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON users(wallet_address);

-- Verify the column was added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'users' 
ORDER BY ordinal_position;
