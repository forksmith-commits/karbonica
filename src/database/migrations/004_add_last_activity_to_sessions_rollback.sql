-- Rollback Migration: 004_add_last_activity_to_sessions
-- Description: Remove last_activity_at column from sessions table

DROP INDEX IF EXISTS idx_sessions_last_activity_at;

ALTER TABLE sessions 
DROP COLUMN IF EXISTS last_activity_at;
