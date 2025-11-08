/**
 * COT Error Handler Service
 *
 * Handles errors and retries for COT (Carbon Offset Token) operations
 * Provides centralized error handling, retry logic, and failure queuing
 */

import { logger } from '../../utils/logger';

export interface COTOperation {
  id: string;
  type: 'mint' | 'transfer' | 'burn';
  creditId: string;
  policyId?: string;
  assetName?: string;
  recipientAddress?: string;
  quantity: string;
  metadata?: Record<string, unknown>;
  attempts: number;
  maxAttempts: number;
  lastError?: string;
  createdAt: Date;
  lastAttemptAt?: Date;
}

export interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

export class COTErrorHandler {
  private failedOperations: Map<string, COTOperation> = new Map();
  private defaultRetryConfig: RetryConfig = {
    maxAttempts: 3,
    initialDelayMs: 1000, // 1 second
    maxDelayMs: 30000, // 30 seconds
    backoffMultiplier: 2,
  };

  /**
   * Execute operation with automatic retry logic
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationInfo: Omit<COTOperation, 'attempts' | 'maxAttempts' | 'createdAt'>,
    config?: Partial<RetryConfig>
  ): Promise<T> {
    const retryConfig = { ...this.defaultRetryConfig, ...config };
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
      try {
        logger.info('Executing COT operation', {
          operationId: operationInfo.id,
          type: operationInfo.type,
          attempt,
          maxAttempts: retryConfig.maxAttempts,
        });

        const result = await operation();

        // Success - remove from failed operations if it was there
        this.failedOperations.delete(operationInfo.id);

        logger.info('COT operation succeeded', {
          operationId: operationInfo.id,
          type: operationInfo.type,
          attempt,
        });

        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        logger.warn('COT operation failed', {
          operationId: operationInfo.id,
          type: operationInfo.type,
          attempt,
          maxAttempts: retryConfig.maxAttempts,
          error: lastError.message,
        });

        // If this was the last attempt, queue for manual review
        if (attempt === retryConfig.maxAttempts) {
          this.queueFailedOperation({
            ...operationInfo,
            attempts: attempt,
            maxAttempts: retryConfig.maxAttempts,
            lastError: lastError.message,
            createdAt: new Date(),
            lastAttemptAt: new Date(),
          });

          logger.error('COT operation failed after all retries - queued for manual review', {
            operationId: operationInfo.id,
            type: operationInfo.type,
            attempts: attempt,
            error: lastError.message,
          });

          throw lastError;
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          retryConfig.initialDelayMs * Math.pow(retryConfig.backoffMultiplier, attempt - 1),
          retryConfig.maxDelayMs
        );

        logger.info('Retrying COT operation after delay', {
          operationId: operationInfo.id,
          type: operationInfo.type,
          nextAttempt: attempt + 1,
          delayMs: delay,
        });

        await this.sleep(delay);
      }
    }

    // This should never be reached, but TypeScript needs it
    throw lastError || new Error('Operation failed');
  }

  /**
   * Queue failed operation for manual review
   */
  private queueFailedOperation(operation: COTOperation): void {
    this.failedOperations.set(operation.id, operation);

    // TODO: Send alert to operations team
    // This could be:
    // - Email notification
    // - Slack/Discord webhook
    // - PagerDuty alert
    // - Database record for admin dashboard

    logger.error('COT operation queued for manual review', {
      operationId: operation.id,
      type: operation.type,
      creditId: operation.creditId,
      attempts: operation.attempts,
      lastError: operation.lastError,
    });
  }

  /**
   * Get all failed operations
   */
  getFailedOperations(): COTOperation[] {
    return Array.from(this.failedOperations.values());
  }

  /**
   * Get failed operation by ID
   */
  getFailedOperation(operationId: string): COTOperation | undefined {
    return this.failedOperations.get(operationId);
  }

  /**
   * Remove operation from failed queue (after manual resolution)
   */
  resolveFailedOperation(operationId: string): boolean {
    return this.failedOperations.delete(operationId);
  }

  /**
   * Get count of failed operations by type
   */
  getFailedOperationStats(): Record<string, number> {
    const stats: Record<string, number> = {
      mint: 0,
      transfer: 0,
      burn: 0,
      total: 0,
    };

    for (const operation of this.failedOperations.values()) {
      stats[operation.type]++;
      stats.total++;
    }

    return stats;
  }

  /**
   * Check if operation should be retried based on error type
   */
  shouldRetry(error: Error): boolean {
    const retryableErrors = [
      'network',
      'timeout',
      'ECONNREFUSED',
      'ETIMEDOUT',
      'ENOTFOUND',
      'insufficient funds', // Temporary - wallet needs top-up
      'rate limit', // Temporary - wait and retry
      'congestion', // Temporary - network congestion
    ];

    const errorMessage = error.message.toLowerCase();
    return retryableErrors.some((retryable) => errorMessage.includes(retryable));
  }

  /**
   * Determine if error is permanent (should not retry)
   */
  isPermanentError(error: Error): boolean {
    const permanentErrors = [
      'invalid policy',
      'policy expired',
      'invalid signature',
      'invalid address',
      'asset not found',
      'insufficient balance', // Different from "insufficient funds" in platform wallet
    ];

    const errorMessage = error.message.toLowerCase();
    return permanentErrors.some((permanent) => errorMessage.includes(permanent));
  }

  /**
   * Sleep utility for delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Clear all failed operations (use with caution)
   */
  clearFailedOperations(): void {
    logger.warn('Clearing all failed COT operations', {
      count: this.failedOperations.size,
    });
    this.failedOperations.clear();
  }
}

// Singleton instance
export const cotErrorHandler = new COTErrorHandler();
