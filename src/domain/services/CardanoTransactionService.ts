import { BlockfrostProvider, MeshTxBuilder } from '@meshsdk/core';
import { randomBytes } from 'crypto';

import { PlatformWalletService } from '../../infrastructure/services/PlatformWalletService';
import { getCardanoConfig } from '../../config/cardano';
import { logger } from '../../utils/logger';
import {
  BlockchainTransaction,
  BlockchainTransactionError,
} from '../entities/BlockchainTransaction';
import { BlockchainTransactionRepository } from '../repositories/IBlockchainTransactionRepository';
import { RateLimiter } from '../../infrastructure/services/RateLimiter';
import { TransactionMonitoringService } from '../../infrastructure/services/TransactionMonitoringService';
import { CardanoErrorHandler } from '../../infrastructure/services/CardanoErrorHandler';

export interface TransactionMetadata {
  [key: string]: any;
}

export interface TransactionInput {
  txHash: string;
  outputIndex: number;
  amount: string;
  address: string;
}

export interface TransactionOutput {
  address: string;
  amount: string;
  assets?: Array<{
    unit: string;
    quantity: string;
  }>;
}

export interface UnsignedTransaction {
  txBody: string; // CBOR hex
  txHash: string;
  fee: string;
  inputs: TransactionInput[];
  outputs: TransactionOutput[];
  metadata?: TransactionMetadata;
}

export interface BlockchainMetadata {
  creditId?: string;
  operationType?: 'transfer' | 'retirement' | 'issuance';
}

export class CardanoTransactionService {
  private platformWallet: PlatformWalletService;
  private blockchainTxRepo: BlockchainTransactionRepository;
  private rateLimiter: RateLimiter;
  private monitoringService: TransactionMonitoringService;
  private errorHandler: CardanoErrorHandler;

  constructor(
    platformWallet: PlatformWalletService,
    blockchainTxRepo: BlockchainTransactionRepository
  ) {
    this.platformWallet = platformWallet;
    this.blockchainTxRepo = blockchainTxRepo;
    this.rateLimiter = new RateLimiter(50, 1000); // 50 requests per second
    this.errorHandler = new CardanoErrorHandler(blockchainTxRepo);
    this.monitoringService = new TransactionMonitoringService(blockchainTxRepo, this.errorHandler);
  }

  async buildTransaction(
    outputs: TransactionOutput[],
    metadata?: TransactionMetadata
  ): Promise<UnsignedTransaction> {
    // Check if in fallback mode
    if (this.errorHandler.isFallbackMode()) {
      logger.warn('System in fallback mode - transaction will be queued', { outputs, metadata });
      throw new CardanoTransactionError(
        'System in fallback mode - Blockfrost API unavailable. Transaction will be queued for later processing.'
      );
    }

    return this.errorHandler.executeWithRetry(
      async () => {
        // Get the Mesh wallet from PlatformWalletService
        const meshWallet = await this.platformWallet.getMeshWallet();
        const utxos = await meshWallet.getUtxos();
        const changeAddress = await meshWallet.getChangeAddress();

        // Get the provider from PlatformWalletService
        const cardanoConfig = getCardanoConfig();
        const provider = new BlockfrostProvider(cardanoConfig.blockfrostApiKey);

        // Create transaction builder
        const txBuilder = new MeshTxBuilder({
          fetcher: provider,
          submitter: provider,
          verbose: true,
        });

        // Add outputs
        for (const output of outputs) {
          txBuilder.txOut(output.address, [
            {
              unit: 'lovelace',
              quantity: output.amount,
            },
          ]);
        }

        // Add metadata if provided (CIP-20 uses label 674)
        if (metadata) {
          txBuilder.metadataValue(674, {
            msg: [JSON.stringify(this.formatCip20Metadata(metadata))],
          });
        }

        // Set change address and select UTxOs
        const unsignedTx = await txBuilder
          .changeAddress(changeAddress)
          .selectUtxosFrom(utxos)
          .complete();

        // Calculate the fee for this transaction
        const calculatedFee = await this.calculateFee(outputs, metadata);

        return {
          txBody: unsignedTx, // This is already CBOR hex string
          txHash: '', // Will be set after signing
          fee: calculatedFee,
          inputs: [],
          outputs: outputs,
          metadata: metadata,
        };
      },
      {
        operationName: 'buildTransaction',
        metadata: { outputs, metadata },
      }
    );
  }

  async getProtocolParameters(): Promise<any> {
    // Get the provider from PlatformWalletService
    const cardanoConfig = getCardanoConfig();
    const provider = new BlockfrostProvider(cardanoConfig.blockfrostApiKey);
    return await provider.fetchProtocolParameters();
  }

  async selectUtxos(requiredAmount: string): Promise<TransactionInput[]> {
    const meshWallet = await this.platformWallet.getMeshWallet();
    const utxos = await meshWallet.getUtxos();
    const walletAddress = await meshWallet.getChangeAddress();

    let totalAmount = 0n;
    const selectedUtxos: TransactionInput[] = [];

    for (const utxo of utxos) {
      const lovelaceAsset = utxo.output.amount.find((asset: any) => asset.unit === 'lovelace');
      const lovelace = lovelaceAsset ? BigInt(lovelaceAsset.quantity) : 0n;

      selectedUtxos.push({
        txHash: utxo.input.txHash,
        outputIndex: utxo.input.outputIndex,
        amount: lovelace.toString(),
        address: walletAddress,
      });

      totalAmount += lovelace;
      if (totalAmount >= BigInt(requiredAmount)) {
        break;
      }
    }

    return selectedUtxos;
  }

  async calculateFee(
    outputs: TransactionOutput[],
    metadata?: TransactionMetadata
  ): Promise<string> {
    try {
      // Get the Mesh wallet and provider from PlatformWalletService
      const meshWallet = await this.platformWallet.getMeshWallet();
      const utxos = await meshWallet.getUtxos();
      // const changeAddress = await meshWallet.getChangeAddress();

      // Get the provider from PlatformWalletService
      const cardanoConfig = getCardanoConfig();
      const provider = new BlockfrostProvider(cardanoConfig.blockfrostApiKey);

      // Create transaction builder
      const txBuilder = new MeshTxBuilder({
        fetcher: provider,
        verbose: true,
      });

      // Add outputs
      for (const output of outputs) {
        txBuilder.txOut(output.address, [
          {
            unit: 'lovelace',
            quantity: output.amount,
          },
        ]);
      }

      // Add metadata if provided (CIP-20 uses label 674)
      if (metadata) {
        txBuilder.metadataValue(674, { msg: [JSON.stringify(this.formatCip20Metadata(metadata))] });
      }

      // Get protocol parameters for fee estimation
      const protocolParams = await provider.fetchProtocolParameters();
      const baseFee = protocolParams.minFeeA || 44;
      const feePerByte = protocolParams.minFeeB || 155381;

      // Estimate transaction size based on inputs/outputs
      // Base transaction size + outputs + metadata + estimated inputs
      const estimatedInputs = Math.min(utxos.length, 3); // Estimate max 3 inputs needed
      const estimatedSize =
        200 + // Base transaction overhead
        outputs.length * 50 + // Each output ~50 bytes
        estimatedInputs * 180 + // Each input ~180 bytes
        (metadata ? 100 : 0); // Metadata overhead

      const estimatedFee = estimatedSize * feePerByte + baseFee;

      logger.info('Transaction fee calculated', {
        estimatedFee: estimatedFee.toString(),
        outputCount: outputs.length,
        hasMetadata: !!metadata,
        estimatedSize,
      });

      return estimatedFee.toString();
    } catch (error) {
      logger.error('Failed to calculate transaction fee', { error });
      throw new CardanoTransactionError('Failed to calculate transaction fee', error as Error);
    }
  }

  formatCip20Metadata(data: any): TransactionMetadata {
    // CIP-20 standard format for carbon credits
    return {
      carbon_credit: {
        version: '1.0',
        action: data.action, // "retirement", "transfer", "issuance"
        credit_id: data.creditId,
        project_id: data.projectId,
        quantity: data.quantity,
        vintage: data.vintage,
        timestamp: new Date().toISOString(),
        ...data,
      },
    };
  }

  async signTransaction(unsignedTxCbor: string): Promise<string> {
    return this.errorHandler.executeWithRetry(
      async () => {
        const meshWallet = await this.platformWallet.getMeshWallet();

        // Sign the transaction using Mesh SDK
        const signedTx = await meshWallet.signTx(unsignedTxCbor);

        logger.info('Transaction signed successfully', {
          txSize: signedTx.length,
        });

        return signedTx;
      },
      {
        operationName: 'signTransaction',
        metadata: { txCborLength: unsignedTxCbor.length },
      }
    );
  }

  async submitTransaction(signedTxCbor: string, metadata?: BlockchainMetadata): Promise<string> {
    // Check if in fallback mode
    if (this.errorHandler.isFallbackMode()) {
      logger.warn('System in fallback mode - transaction will be queued', { metadata });

      // Create a pending transaction record for later processing
      const blockchainTx: BlockchainTransaction = {
        id: this.generateTransactionId(),
        // SECURITY FIX: Use crypto.randomBytes() instead of Math.random()
        txHash: `fallback_${Date.now()}_${randomBytes(6).toString('hex')}`,
        status: 'pending',
        submissionTimestamp: new Date(),
        retryCount: 0,
        metadata: {
          ...metadata,
          fallbackMode: true,
          signedTxCbor, // Store the signed transaction for later submission
        },
      };

      await this.blockchainTxRepo.save(blockchainTx);

      throw new CardanoTransactionError(
        'System in fallback mode - transaction queued for later submission'
      );
    }

    return this.errorHandler
      .executeWithRetry(
        async () => {
          // Apply rate limiting before submission
          await this.rateLimiter.checkLimit();

          const meshWallet = await this.platformWallet.getMeshWallet();

          // Submit the transaction using Mesh SDK
          const txHash = await meshWallet.submitTx(signedTxCbor);

          // Record the transaction in our database
          const blockchainTx: BlockchainTransaction = {
            id: this.generateTransactionId(),
            txHash,
            status: 'pending',
            submissionTimestamp: new Date(),
            retryCount: 0,
            metadata,
          };

          await this.blockchainTxRepo.save(blockchainTx);

          // Start monitoring the transaction
          await this.monitoringService.startMonitoring(txHash);

          logger.info('Transaction submitted successfully', {
            txHash,
            metadata,
          });

          return txHash;
        },
        {
          operationName: 'submitTransaction',
          metadata,
        }
      )
      .catch(async (error) => {
        // Handle transaction failure
        const tempTxHash = `failed_${Date.now()}`;
        await this.errorHandler.handleTransactionFailure(tempTxHash, error as Error, metadata);
        throw error;
      });
  }

  async buildSignAndSubmitTransaction(
    outputs: TransactionOutput[],
    metadata?: TransactionMetadata,
    blockchainMetadata?: BlockchainMetadata
  ): Promise<string> {
    try {
      // Build the transaction
      const unsignedTx = await this.buildTransaction(outputs, metadata);

      // Sign the transaction
      const signedTx = await this.signTransaction(unsignedTx.txBody);

      // Submit the transaction
      const txHash = await this.submitTransaction(signedTx, blockchainMetadata);

      return txHash;
    } catch (error) {
      logger.error('Failed to build, sign, and submit transaction', { error });
      throw new BlockchainTransactionError(
        'Failed to build, sign, and submit transaction',
        error as Error
      );
    }
  }
  private generateTransactionId(): string {
    // SECURITY FIX: Use crypto.randomBytes() instead of Math.random()
    return `tx_${Date.now()}_${randomBytes(6).toString('hex')}`;
  }

  /**
   * Get the monitoring service instance for starting/stopping transaction monitoring
   */
  getMonitoringService(): TransactionMonitoringService {
    return this.monitoringService;
  }

  /**
   * Get the error handler instance
   */
  getErrorHandler(): CardanoErrorHandler {
    return this.errorHandler;
  }

  /**
   * Start monitoring pending transactions (convenience method)
   */
  async startMonitoringPendingTransactions(): Promise<void> {
    await this.monitoringService.startMonitoringPendingTransactions();
  }

  /**
   * Stop all transaction monitoring (convenience method)
   */
  stopAllMonitoring(): void {
    this.monitoringService.stopAllMonitoring();
  }

  /**
   * Check if system is in fallback mode
   */
  isFallbackMode(): boolean {
    return this.errorHandler.isFallbackMode();
  }

  /**
   * Get failed transaction queue
   */
  getFailedTransactionQueue() {
    return this.errorHandler.getFailedTransactionQueue();
  }

  /**
   * Get error handler statistics
   */
  getErrorHandlerStatistics() {
    return this.errorHandler.getStatistics();
  }

  /**
   * Retry a failed transaction
   */
  async retryFailedTransaction(id: string): Promise<boolean> {
    return this.errorHandler.retryFailedTransaction(id, async () => {
      // Find the transaction in the database
      const tx = await this.blockchainTxRepo.findById(id);
      if (!tx || !tx.metadata?.signedTxCbor) {
        throw new Error('Transaction not found or missing signed transaction data');
      }

      // Resubmit the transaction
      const txHash = await this.submitTransaction(tx.metadata.signedTxCbor, tx.metadata);

      logger.info('Failed transaction resubmitted', { id, txHash });
    });
  }
}

export class CardanoTransactionError extends Error {
  constructor(
    message: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'CardanoTransactionError';
  }
}
