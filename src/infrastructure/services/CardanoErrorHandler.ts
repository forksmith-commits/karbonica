import { logger } from '../../utils/logger';
import { BlockchainTransactionRepository } from '../../domain/repositories/IBlockchainTransactionRepository';
import { randomBytes } from 'crypto';

export interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  exponentialBase: number;
}

export interface FailedTransactionQueue {
  id: string;
  txHash?: string;
  error: string;
  timestamp: Date;
  metadata?: any;
  retryCount: number;
}

export class CardanoErrorHandler {
  private readonly blockchainTxRepo: BlockchainTransactionRepository;
  private readonly retryConfig: RetryConfig;
  private failedTransactionQueue: FailedTransactionQueue[] = [];
  private fallbackMode: boolean = false;
  private blockfrostUnavailableCount: number = 0;
  private readonly blockfrostUnavailableThreshold: number = 3;

  constructor(
    blockchainTxRepo: BlockchainTransactionRepository,
    retryConfig?: Partial<RetryConfig>
  ) {
    this.blockchainTxRepo = blockchainTxRepo;
    this.retryConfig = {
      maxAttempts: 3,
      baseDelayMs: 1000, // 1 second
      maxDelayMs: 8000, // 8 seconds
      exponentialBase: 2,
      ...retryConfig,
    };
  }

  /**
   * Execute an operation with exponential backoff retry
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: {
      operationName: string;
      txHash?: string;
      metadata?: any;
    }
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= this.retryConfig.maxAttempts; attempt++) {
      try {
        logger.info('Executing operation', {
          operation: context.operationName,
          attempt,
          maxAttempts: this.retryConfig.maxAttempts,
          txHash: context.txHash,
        });

        const result = await operation();

        // Reset Blockfrost unavailable count on success
        if (this.blockfrostUnavailableCount > 0) {
          this.blockfrostUnavailableCount = 0;
          if (this.fallbackMode) {
            logger.info('Blockfrost API recovered, exiting fallback mode');
            this.fallbackMode = false;
          }
        }

        return result;
      } catch (error) {
        lastError = error as Error;

        logger.warn('Operation failed', {
          operation: context.operationName,
          attempt,
          maxAttempts: this.retryConfig.maxAttempts,
          error: lastError.message,
          txHash: context.txHash,
        });

        // Check if error is retryable
        const isRetryable = this.isRetryableError(lastError);

        if (!isRetryable) {
          logger.error('Non-retryable error encountered', {
            operation: context.operationName,
            error: lastError.message,
            txHash: context.txHash,
          });
          throw lastError;
        }

        // Check if this is a Blockfrost unavailable error
        if (this.isBlockfrostUnavailableError(lastError)) {
          this.blockfrostUnavailableCount++;
          if (this.blockfrostUnavailableCount >= this.blockfrostUnavailableThreshold) {
            await this.enterFallbackMode();
          }
        }

        // If this is the last attempt, queue for manual review
        if (attempt === this.retryConfig.maxAttempts) {
          await this.queueForManualReview({
            // SECURITY FIX: Use crypto.randomBytes() instead of Math.random()
            id: `failed_${Date.now()}_${randomBytes(6).toString('hex')}`,
            txHash: context.txHash,
            error: lastError.message,
            timestamp: new Date(),
            metadata: context.metadata,
            retryCount: attempt,
          });

          // Alert operations team
          await this.alertOperationsTeam({
            severity: 'critical',
            message: `Operation failed after ${attempt} attempts: ${context.operationName}`,
            error: lastError.message,
            txHash: context.txHash,
            metadata: context.metadata,
          });

          throw new CardanoRetryExhaustedError(
            `Operation failed after ${attempt} attempts: ${lastError.message}`,
            lastError,
            context.txHash
          );
        }

        // Calculate delay with exponential backoff
        const delay = this.calculateBackoffDelay(attempt);
        logger.info('Retrying operation after delay', {
          operation: context.operationName,
          attempt,
          delayMs: delay,
          txHash: context.txHash,
        });

        await this.sleep(delay);
      }
    }

    // This should never be reached, but TypeScript requires it
    throw lastError!;
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoffDelay(attempt: number): number {
    const exponentialDelay =
      this.retryConfig.baseDelayMs * Math.pow(this.retryConfig.exponentialBase, attempt - 1);

    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.3 * exponentialDelay;

    const delay = Math.min(exponentialDelay + jitter, this.retryConfig.maxDelayMs);

    return Math.floor(delay);
  }

  /**
   * Check if an error is retryable
   */
  private isRetryableError(error: Error): boolean {
    const errorMessage = error.message.toLowerCase();
    const errorName = error.name.toLowerCase();

    // Network errors are retryable
    const networkErrors = [
      'network',
      'timeout',
      'econnrefused',
      'enotfound',
      'etimedout',
      'socket hang up',
      'connection reset',
    ];

    // Blockfrost API errors that are retryable
    const retryableApiErrors = [
      'rate limit',
      'too many requests',
      'service unavailable',
      'internal server error',
      'bad gateway',
      'gateway timeout',
      '429',
      '500',
      '502',
      '503',
      '504',
    ];

    // Cardano node errors that are retryable
    const retryableNodeErrors = ['utxo already spent', 'transaction too large', 'mempool full'];

    const allRetryableErrors = [...networkErrors, ...retryableApiErrors, ...retryableNodeErrors];

    return allRetryableErrors.some(
      (retryableError) =>
        errorMessage.includes(retryableError) || errorName.includes(retryableError)
    );
  }

  /**
   * Check if error indicates Blockfrost is unavailable
   */
  private isBlockfrostUnavailableError(error: Error): boolean {
    const errorMessage = error.message.toLowerCase();

    const blockfrostUnavailableErrors = [
      'service unavailable',
      'bad gateway',
      'gateway timeout',
      'econnrefused',
      'enotfound',
      '502',
      '503',
      '504',
    ];

    return blockfrostUnavailableErrors.some((unavailableError) =>
      errorMessage.includes(unavailableError)
    );
  }

  /**
   * Enter fallback mode when Blockfrost is unavailable
   */
  private async enterFallbackMode(): Promise<void> {
    if (this.fallbackMode) return;

    this.fallbackMode = true;

    logger.warn('Entering fallback mode - Blockfrost API unavailable', {
      unavailableCount: this.blockfrostUnavailableCount,
      threshold: this.blockfrostUnavailableThreshold,
    });

    // Alert operations team
    await this.alertOperationsTeam({
      severity: 'critical',
      message: 'Blockfrost API unavailable - entering fallback mode',
      error: 'Multiple consecutive Blockfrost API failures',
      metadata: {
        unavailableCount: this.blockfrostUnavailableCount,
        threshold: this.blockfrostUnavailableThreshold,
      },
    });
  }

  /**
   * Check if system is in fallback mode
   */
  isFallbackMode(): boolean {
    return this.fallbackMode;
  }

  /**
   * Queue a failed transaction for manual review
   */
  private async queueForManualReview(failedTx: FailedTransactionQueue): Promise<void> {
    this.failedTransactionQueue.push(failedTx);

    logger.error('Transaction queued for manual review', {
      id: failedTx.id,
      txHash: failedTx.txHash,
      error: failedTx.error,
      retryCount: failedTx.retryCount,
      queueSize: this.failedTransactionQueue.length,
    });

    // Update blockchain transaction status if txHash exists
    if (failedTx.txHash) {
      const tx = await this.blockchainTxRepo.findByTxHash(failedTx.txHash);
      if (tx) {
        await this.blockchainTxRepo.updateStatus(tx.id, 'failed', {
          errorMessage: `Failed after ${failedTx.retryCount} attempts: ${failedTx.error}`,
          retryCount: failedTx.retryCount,
        });
      }
    }
  }

  /**
   * Get all failed transactions in the queue
   */
  getFailedTransactionQueue(): FailedTransactionQueue[] {
    return [...this.failedTransactionQueue];
  }

  /**
   * Clear a transaction from the failed queue
   */
  clearFromFailedQueue(id: string): boolean {
    const initialLength = this.failedTransactionQueue.length;
    this.failedTransactionQueue = this.failedTransactionQueue.filter((tx) => tx.id !== id);
    return this.failedTransactionQueue.length < initialLength;
  }

  /**
   * Alert operations team about blockchain issues
   */
  private async alertOperationsTeam(alert: {
    severity: 'critical' | 'warning' | 'info';
    message: string;
    error?: string;
    txHash?: string;
    metadata?: any;
  }): Promise<void> {
    // Log the alert
    logger.error('ALERT: Blockchain issue detected', {
      severity: alert.severity,
      message: alert.message,
      error: alert.error,
      txHash: alert.txHash,
      metadata: alert.metadata,
      timestamp: new Date().toISOString(),
    });

    // In a production system, this would integrate with:
    // - PagerDuty for critical alerts
    // - Slack/Teams for team notifications
    // - Email for detailed reports
    // - SMS for urgent issues

    // For now, we'll just log it prominently
    console.error('🚨 BLOCKCHAIN ALERT 🚨', {
      severity: alert.severity,
      message: alert.message,
      error: alert.error,
      txHash: alert.txHash,
    });

    // TODO: Integrate with alerting service (PagerDuty, Slack, etc.)
    // Example:
    // await this.pagerDutyService.triggerAlert (alert);
    // await this.slackService.sendMessage(alert);
  }

  /**
   * Handle transaction failure
   */
  async handleTransactionFailure(txHash: string, error: Error, metadata?: any): Promise<void> {
    logger.error('Handling transaction failure', {
      txHash,
      error: error.message,
      metadata,
    });

    // Find the transaction in the database
    const tx = await this.blockchainTxRepo.findByTxHash(txHash);

    if (tx) {
      // Increment retry count
      const newRetryCount = tx.retryCount + 1;

      // Check if we should retry
      if (newRetryCount < this.retryConfig.maxAttempts) {
        logger.info('Transaction will be retried', {
          txHash,
          retryCount: newRetryCount,
          maxAttempts: this.retryConfig.maxAttempts,
        });

        await this.blockchainTxRepo.updateStatus(tx.id, 'pending', {
          retryCount: newRetryCount,
          errorMessage: error.message,
        });
      } else {
        // Max retries reached, mark as failed and queue for manual review
        logger.error('Transaction failed after max retries', {
          txHash,
          retryCount: newRetryCount,
          maxAttempts: this.retryConfig.maxAttempts,
        });

        await this.blockchainTxRepo.updateStatus(tx.id, 'failed', {
          retryCount: newRetryCount,
          errorMessage: `Failed after ${newRetryCount} attempts: ${error.message}`,
        });

        await this.queueForManualReview({
          id: tx.id,
          txHash,
          error: error.message,
          timestamp: new Date(),
          metadata: { ...tx.metadata, ...metadata },
          retryCount: newRetryCount,
        });

        await this.alertOperationsTeam({
          severity: 'critical',
          message: 'Transaction failed after max retries',
          error: error.message,
          txHash,
          metadata: { ...tx.metadata, ...metadata },
        });
      }
    }
  }

  /**
   * Retry a failed transaction from the queue
   */
  async retryFailedTransaction(id: string, retryOperation: () => Promise<void>): Promise<boolean> {
    const failedTx = this.failedTransactionQueue.find((tx) => tx.id === id);

    if (!failedTx) {
      logger.warn('Failed transaction not found in queue', { id });
      return false;
    }

    try {
      logger.info('Retrying failed transaction', {
        id,
        txHash: failedTx.txHash,
        previousRetryCount: failedTx.retryCount,
      });

      await retryOperation();

      // Remove from failed queue on success
      this.clearFromFailedQueue(id);

      logger.info('Failed transaction retry successful', {
        id,
        txHash: failedTx.txHash,
      });

      return true;
    } catch (error) {
      logger.error('Failed transaction retry failed', {
        id,
        txHash: failedTx.txHash,
        error: (error as Error).message,
      });

      // Update retry count
      failedTx.retryCount++;

      return false;
    }
  }

  /**
   * Sleep utility for delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get error handler statistics
   */
  getStatistics(): {
    fallbackMode: boolean;
    blockfrostUnavailableCount: number;
    failedQueueSize: number;
    retryConfig: RetryConfig;
  } {
    return {
      fallbackMode: this.fallbackMode,
      blockfrostUnavailableCount: this.blockfrostUnavailableCount,
      failedQueueSize: this.failedTransactionQueue.length,
      retryConfig: this.retryConfig,
    };
  }
}

export class CardanoRetryExhaustedError extends Error {
  constructor(
    message: string,
    public readonly cause?: Error,
    public readonly txHash?: string
  ) {
    super(message);
    this.name = 'CardanoRetryExhaustedError';
  }
}
