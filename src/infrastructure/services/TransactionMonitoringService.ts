import { BlockfrostProvider } from '@meshsdk/core';
import { BlockchainTransactionRepository } from '../../domain/repositories/BlockchainTransactionRepository';
import { BlockchainTransaction } from '../../domain/entities/BlockchainTransaction';
import { getCardanoConfig } from '../../config/cardano';
import { logger } from '../../utils/logger';

export interface TransactionStatus {
  confirmed: boolean;
  confirmations: number;
  blockNumber?: number;
  blockHash?: string;
  slot?: number;
}

export class TransactionMonitoringService {
  private readonly provider: BlockfrostProvider;
  private readonly blockchainTxRepo: BlockchainTransactionRepository;
  private readonly pollingInterval: number = 20000; // 20 seconds
  private readonly timeoutDuration: number = 10 * 60 * 1000; // 10 minutes
  private readonly requiredConfirmations: number = 6;
  private monitoringIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(blockchainTxRepo: BlockchainTransactionRepository) {
    this.blockchainTxRepo = blockchainTxRepo;
    const cardanoConfig = getCardanoConfig();
    this.provider = new BlockfrostProvider(cardanoConfig.blockfrostApiKey);
  }

  /**
   * Start monitoring a transaction
   */
  async startMonitoring(txHash: string): Promise<void> {
    // Check if already monitoring
    if (this.monitoringIntervals.has(txHash)) {
      logger.warn('Transaction already being monitored', { txHash });
      return;
    }

    logger.info('Starting transaction monitoring', { txHash });

    // Set up polling interval
    const intervalId = setInterval(async () => {
      await this.checkTransactionStatus(txHash);
    }, this.pollingInterval);

    this.monitoringIntervals.set(txHash, intervalId);

    // Set up timeout
    setTimeout(async () => {
      await this.handleTimeout(txHash);
    }, this.timeoutDuration);

    // Do initial check
    await this.checkTransactionStatus(txHash);
  }

  /**
   * Stop monitoring a transaction
   */
  stopMonitoring(txHash: string): void {
    const intervalId = this.monitoringIntervals.get(txHash);
    if (intervalId) {
      clearInterval(intervalId);
      this.monitoringIntervals.delete(txHash);
      logger.info('Stopped monitoring transaction', { txHash });
    }
  }

  /**
   * Check transaction status on Cardano network
   */
  private async checkTransactionStatus(txHash: string): Promise<void> {
    try {
      const transaction = await this.blockchainTxRepo.findByTxHash(txHash);
      if (!transaction) {
        logger.error('Transaction not found in database', { txHash });
        this.stopMonitoring(txHash);
        return;
      }

      // Skip if already confirmed or failed
      if (transaction.status === 'confirmed' || transaction.status === 'failed') {
        this.stopMonitoring(txHash);
        return;
      }

      // Get transaction status from Blockfrost
      const txStatus = await this.getTransactionStatus(txHash);

      if (txStatus.confirmed && txStatus.confirmations >= this.requiredConfirmations) {
        // Transaction is confirmed with enough confirmations
        await this.blockchainTxRepo.updateStatus(transaction.id, 'confirmed', {
          confirmationTimestamp: new Date(),
          blockNumber: txStatus.blockNumber,
          blockHash: txStatus.blockHash,
        });

        logger.info('Transaction confirmed', {
          txHash,
          confirmations: txStatus.confirmations,
          blockNumber: txStatus.blockNumber,
        });

        this.stopMonitoring(txHash);
      } else if (txStatus.confirmed) {
        // Transaction is in a block but needs more confirmations
        logger.info('Transaction in block, waiting for confirmations', {
          txHash,
          confirmations: txStatus.confirmations,
          required: this.requiredConfirmations,
        });
      } else {
        // Transaction still pending
        logger.debug('Transaction still pending', { txHash });
      }
    } catch (error) {
      logger.error('Error checking transaction status', { txHash, error });

      // Type guard for error object
      const isErrorWithStatus = (err: unknown): err is { message?: string; status?: number } => {
        return typeof err === 'object' && err !== null;
      };

      // If transaction not found on network after some time, it might have failed
      //   const errorObj = error as any;
      if (
        isErrorWithStatus(error) &&
        (error.message?.includes('not found') || error.status === 404)
      ) {
        const transaction = await this.blockchainTxRepo.findByTxHash(txHash);
        if (transaction) {
          const timeSinceSubmission = Date.now() - transaction.submissionTimestamp.getTime();
          if (timeSinceSubmission > 5 * 60 * 1000) {
            // 5 minutes
            await this.blockchainTxRepo.updateStatus(transaction.id, 'failed', {
              errorMessage: 'Transaction not found on network',
            });
            this.stopMonitoring(txHash);
          }
        }
      }
    }
  }

  /**
   * Get transaction status from Blockfrost API
   */
  private async getTransactionStatus(txHash: string): Promise<TransactionStatus> {
    try {
      // Get transaction details
      const tx = await this.provider.fetchTxInfo(txHash);

      // Get current latest block
      const latestBlock = await this.provider.fetchLatestBlock();

      // Calculate confirmations based on slot difference
      // In Cardano, blocks are produced roughly every 20 seconds on average
      const currentSlot = parseInt(latestBlock.slot);
      const txSlot = parseInt(tx.slot);
      const slotDifference = currentSlot - txSlot;

      // Estimate confirmations: each block is roughly 20 seconds apart
      const estimatedConfirmations = Math.floor(slotDifference / 20);

      return {
        confirmed: true,
        confirmations: Math.max(0, estimatedConfirmations),
        blockNumber: undefined, // Block height not available in Mesh SDK response
        blockHash: tx.block,
        slot: parseInt(tx.slot),
      };
    } catch (error) {
      const errorObj = error as any;
      if (errorObj?.status === 404) {
        // Transaction not yet in a block
        return {
          confirmed: false,
          confirmations: 0,
        };
      }
      throw error;
    }
  }

  /**
   * Handle transaction timeout
   */
  private async handleTimeout(txHash: string): Promise<void> {
    try {
      const transaction = await this.blockchainTxRepo.findByTxHash(txHash);
      if (!transaction) return;

      // Only timeout if still pending
      if (transaction.status === 'pending') {
        await this.blockchainTxRepo.updateStatus(transaction.id, 'timeout', {
          errorMessage: 'Transaction timed out after 10 minutes',
        });

        logger.warn('Transaction timed out', { txHash });
        this.stopMonitoring(txHash);
      }
    } catch (error) {
      logger.error('Error handling transaction timeout', { txHash, error });
    }
  }

  /**
   * Start monitoring all pending transactions
   */
  async startMonitoringPendingTransactions(): Promise<void> {
    try {
      const pendingTransactions = await this.blockchainTxRepo.findPendingTransactions();

      logger.info('Starting monitoring for pending transactions', {
        count: pendingTransactions.length,
      });

      for (const tx of pendingTransactions) {
        await this.startMonitoring(tx.txHash);
      }
    } catch (error) {
      logger.error('Error starting monitoring for pending transactions', { error });
    }
  }

  /**
   * Stop all monitoring
   */
  stopAllMonitoring(): void {
    for (const [txHash, intervalId] of this.monitoringIntervals) {
      clearInterval(intervalId);
      logger.info('Stopped monitoring transaction', { txHash });
    }
    this.monitoringIntervals.clear();
  }
}
