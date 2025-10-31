import { SessionRepository } from '../infrastructure/repositories/SessionRepository';
import { logger } from './logger';

const SESSION_INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // Run cleanup every 5 minutes

/**
 * Cleanup expired and inactive sessions
 * This should be run periodically as a background job
 */
export async function cleanupSessions(): Promise<void> {
  try {
    const sessionRepository = new SessionRepository();

    // Delete expired sessions (based on expires_at)
    await sessionRepository.deleteExpired();

    // Delete inactive sessions (based on last_activity_at)
    await sessionRepository.deleteInactive(SESSION_INACTIVITY_TIMEOUT_MS);

    logger.info('Session cleanup completed successfully');
  } catch (error) {
    logger.error('Session cleanup failed', { error });
  }
}

/**
 * Start the session cleanup scheduler
 * Call this when the application starts
 */
export function startSessionCleanupScheduler(): NodeJS.Timeout {
  logger.info('Starting session cleanup scheduler', {
    intervalMs: CLEANUP_INTERVAL_MS,
    inactivityTimeoutMs: SESSION_INACTIVITY_TIMEOUT_MS,
  });

  // Run immediately on start
  cleanupSessions();

  // Schedule periodic cleanup
  return setInterval(cleanupSessions, CLEANUP_INTERVAL_MS);
}

/**
 * Stop the session cleanup scheduler
 */
export function stopSessionCleanupScheduler(intervalId: NodeJS.Timeout): void {
  clearInterval(intervalId);
  logger.info('Session cleanup scheduler stopped');
}
