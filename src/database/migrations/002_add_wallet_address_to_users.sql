-- Migration: 002_add_wallet_address_to_users
-- Description: Add wallet_address column to users table for direct wallet linking
-- Date: 2024-01-16

-- Add column only if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'wallet_address'
  ) THEN
    ALTER TABLE users ADD COLUMN wallet_address VARCHAR(255) UNIQUE;
  END IF;
END $$;

-- Create index only if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON users(wallet_address);

-- Add comment
COMMENT ON COLUMN users.wallet_address IS 'Optional Cardano wallet address linked to user account';
