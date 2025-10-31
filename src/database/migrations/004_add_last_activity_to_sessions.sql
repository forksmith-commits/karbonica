-- Migration: 004_add_last_activity_to_sessions
-- Description: Add last_activity_at column to sessions table for inactivity tracking
-- Date: 2024-01-15

ALTER TABLE sessions 
ADD COLUMN last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Update existing sessions to have last_activity_at = created_at
UPDATE sessions 
SET last_activity_at = created_at 
WHERE last_activity_at IS NULL;

-- Add index for efficient cleanup queries
CREATE INDEX idx_sessions_last_activity_at ON sessions(last_activity_at);

COMMENT ON COLUMN sessions.last_activity_at IS 'Timestamp of last activity for session inactivity tracking (30 min timeout)';
