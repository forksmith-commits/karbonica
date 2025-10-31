-- Rollback Migration: 003_add_email_verification_tokens
-- Description: Remove email verification tokens table

DROP TABLE IF EXISTS email_verification_tokens;
