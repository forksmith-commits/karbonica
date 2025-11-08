import { v4 as uuidv4 } from 'uuid';
import { ICreditEntryRepository } from '../../domain/repositories/ICreditEntryRepository';
import { ICreditTransactionRepository } from '../../domain/repositories/ICreditTransactionRepository';
import { IProjectRepository } from '../../domain/repositories/IProjectRepository';
import { IUserRepository } from '../../domain/repositories/IUserRepository';
import { ProjectStatus } from '../../domain/entities/Project';
import {
  CreditEntry,
  CreditStatus,
  generateCreditSerialNumber,
  validateCreditEntry,
} from '../../domain/entities/CreditEntry';
import {
  CreditTransaction,
  TransactionType,
  TransactionStatus,
  createIssuanceMetadata,
  createTransferMetadata,
} from '../../domain/entities/CreditTransaction';
import { CardanoMintingService } from '../../domain/services/CardanoMintingService';
import { COTMetadataService, COTMetadata } from '../../domain/services/COTMetadataService';
import { cotErrorHandler } from '../../infrastructure/services/COTErrorHandler';
import { cotMonitoringService } from '../../infrastructure/services/COTMonitoringService';
import { logger } from '../../utils/logger';
import { ICardanoWalletRepository } from '../../domain/repositories/ICardanoWalletRepository';
import { CardanoTransactionService } from '../../domain/services/CardanoTransactionService';

// Type definitions for filters and pagination
export interface CreditFilters {
  ownerId?: string;
  projectId?: string;
  status?: string;
  vintage?: number;
}

export interface PaginationOptions {
  limit?: number;
  cursor?: string;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export class CreditService {
  private cotMetadataService: COTMetadataService;

  constructor(
    private creditEntryRepository: ICreditEntryRepository,
    private creditTransactionRepository: ICreditTransactionRepository,
    private projectRepository: IProjectRepository,
    private userRepository: IUserRepository,
    private cardanoMintingService?: CardanoMintingService,
    private walletRepository?: ICardanoWalletRepository,
    private cardanoTransactionService?: CardanoTransactionService
  ) {
    this.cotMetadataService = new COTMetadataService();
  }

  /**
   * Issue carbon credits for a verified project
   * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.8
   */
  async issueCredits(
    projectId: string,
    verificationId: string
  ): Promise<{ creditEntry: CreditEntry; transaction: CreditTransaction }> {
    logger.info('Starting credit issuance process', { projectId, verificationId });

    // Get project details (Requirement 5.1)
    const project = await this.projectRepository.findById(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    // Validate project is verified
    if (project.status !== ProjectStatus.VERIFIED) {
      logger.warn('Project not verified, cannot issue credits', {
        projectId,
        projectStatus: project.status,
        expectedStatus: ProjectStatus.VERIFIED,
      });
      throw new Error(
        `Project must be verified before credits can be issued. Current status: ${project.status}`
      );
    }

    // Check if credits have already been issued for this project
    const existingCredits = await this.creditEntryRepository.findByProject(projectId);
    if (existingCredits.length > 0) {
      throw new Error('Credits have already been issued for this project');
    }

    // Validate project has emissions target
    if (!project.emissionsTarget || project.emissionsTarget <= 0) {
      logger.error('Project has invalid emissions target', {
        projectId,
        emissionsTarget: project.emissionsTarget,
      });
      throw new Error(
        `Project has invalid emissions target: ${project.emissionsTarget}. Must be greater than 0.`
      );
    }

    // Validate project developer exists
    const developer = await this.userRepository.findById(project.developerId);
    if (!developer) {
      throw new Error('Project developer not found');
    }

    // Get developer's wallet address from cardano_wallets table
    let developerWalletAddress: string | null = null;
    if (this.walletRepository) {
      try {
        const wallet = await this.walletRepository.findByUserId(developer.id);
        if (wallet && wallet.isActive) {
          developerWalletAddress = wallet.address;
          logger.info('Found linked wallet for developer', {
            developerId: developer.id,
            walletAddress: developerWalletAddress,
            walletId: wallet.id,
          });
        } else {
          logger.info('No active wallet found for developer', {
            developerId: developer.id,
            hasWallet: !!wallet,
            isActive: wallet?.isActive,
          });
        }
      } catch (error) {
        logger.warn('Error fetching wallet for developer, continuing without wallet', {
          developerId: developer.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    } else {
      // Fallback to users.wallet_address if wallet repository not available
      developerWalletAddress = developer.walletAddress;
      logger.info('Using wallet address from users table (wallet repository not available)', {
        developerId: developer.id,
        walletAddress: developerWalletAddress,
      });
    }

    // Generate unique serial number (Requirement 5.2)
    const vintage = new Date().getFullYear(); // Current year (Requirement 5.4)
    const projectSequence = await this.creditEntryRepository.getProjectSequence(projectId);
    const creditSequence = await this.creditEntryRepository.getNextCreditSequence(
      projectId,
      vintage
    );

    const creditId = generateCreditSerialNumber(vintage, projectSequence, creditSequence);

    // Create credit entry (Requirements 5.1, 5.2, 5.3, 5.4, 5.5)
    const now = new Date();
    const creditEntry: CreditEntry = {
      id: uuidv4(),
      creditId, // Unique serial number (KRB-YYYY-XXX-NNNNNN)
      projectId,
      ownerId: project.developerId, // Set owner to project developer (Requirement 5.3)
      quantity: project.emissionsTarget, // Set quantity equal to project emissions target (Requirement 5.1)
      vintage, // Set vintage to current year (Requirement 5.4)
      status: CreditStatus.ACTIVE, // Set status to "active" (Requirement 5.5)
      issuedAt: now,
      lastActionAt: now,
      createdAt: now,
      updatedAt: now,
    };

    // Validate credit entry data
    const validationErrors = validateCreditEntry(creditEntry);
    if (validationErrors.length > 0) {
      throw new Error(`Credit entry validation failed: ${validationErrors.join(', ')}`);
    }

    // Save credit entry (without blockchain data initially)
    const savedCreditEntry = await this.creditEntryRepository.save(creditEntry);

    // Mint COT (Carbon Offset Token) on Cardano blockchain
    let mintTxHash: string | undefined;
    let policyId: string | undefined;
    let assetName: string | undefined;
    let tokenMetadata: COTMetadata | undefined;

    // Log minting service and wallet status
    logger.info('Checking COT minting prerequisites', {
      hasMintingService: !!this.cardanoMintingService,
      hasWalletAddress: !!developerWalletAddress,
      developerId: developer.id,
      developerEmail: developer.email,
      creditId: savedCreditEntry.creditId,
      walletSource: this.walletRepository ? 'cardano_wallets table' : 'users.wallet_address',
    });

    if (this.cardanoMintingService && developerWalletAddress) {
      const mintStartTime = Date.now();
      try {
        logger.info('Starting COT token minting process', {
          creditId: savedCreditEntry.creditId,
          quantity: savedCreditEntry.quantity,
          developerWallet: developerWalletAddress,
          projectId: project.id,
        });

        // Generate COT metadata
        logger.info('Generating COT metadata...');
        const cotMetadata = this.cotMetadataService.generateCOTMetadata(
          savedCreditEntry,
          project,
          verificationId
        );
        logger.info('✅ COT metadata generated', { metadataKeys: Object.keys(cotMetadata) });

        // Validate metadata
        logger.info('Validating COT metadata...');
        const metadataErrors = this.cotMetadataService.validateMetadata(cotMetadata);
        if (metadataErrors.length > 0) {
          throw new Error(`COT metadata validation failed: ${metadataErrors.join(', ')}`);
        }
        logger.info('✅ COT metadata validated successfully');

        // Mint COT tokens with retry logic
        logger.info('Calling Cardano minting service to mint and send tokens...');
        const mintingResult = await cotErrorHandler.executeWithRetry(
          async () => {
            return await this.cardanoMintingService!.mintAndSendAsset(
              {
                projectId: project.id,
                assetName: savedCreditEntry.creditId,
                quantity: savedCreditEntry.quantity.toString(),
                metadata: cotMetadata as unknown as Record<string, unknown>,
              },
              developerWalletAddress!
            );
          },
          {
            id: savedCreditEntry.id,
            type: 'mint',
            creditId: savedCreditEntry.creditId,
            recipientAddress: developerWalletAddress,
            quantity: savedCreditEntry.quantity.toString(),
            metadata: cotMetadata as unknown as Record<string, unknown>,
          }
        );

        logger.info('✅ Minting transaction completed', {
          txHash: mintingResult.txHash,
          policyId: mintingResult.policyId,
          assetName: mintingResult.assetName,
        });

        mintTxHash = mintingResult.txHash;
        policyId = mintingResult.policyId;
        assetName = mintingResult.assetName;
        tokenMetadata = cotMetadata;

        // Update credit entry with blockchain data
        logger.info('Updating credit entry with blockchain data...');
        savedCreditEntry.mintTxHash = mintTxHash;
        savedCreditEntry.policyId = policyId;
        savedCreditEntry.assetName = assetName;
        savedCreditEntry.tokenMetadata = tokenMetadata as unknown as Record<string, unknown>;

        await this.creditEntryRepository.update(savedCreditEntry);
        logger.info('✅ Credit entry updated with blockchain data');

        // Record successful operation
        const mintDuration = Date.now() - mintStartTime;
        cotMonitoringService.recordOperation('mint', true, mintDuration, savedCreditEntry.creditId);

        logger.info('🎉 COT tokens minted and transferred successfully!', {
          creditId: savedCreditEntry.creditId,
          mintTxHash,
          policyId,
          assetName,
          developerWallet: developerWalletAddress,
          quantity: savedCreditEntry.quantity,
          durationMs: mintDuration,
        });
      } catch (error) {
        // Record failed operation
        const mintDuration = Date.now() - mintStartTime;
        cotMonitoringService.recordOperation(
          'mint',
          false,
          mintDuration,
          savedCreditEntry.creditId,
          error instanceof Error ? error.message : 'Unknown error'
        );

        logger.error('Failed to mint COT tokens', {
          error,
          creditId: savedCreditEntry.creditId,
          projectId,
          developerWallet: developerWalletAddress,
        });

        // Don't fail the entire issuance if minting fails
        // Credits are still issued in database, minting can be retried
        logger.warn('Credits issued without COT tokens - minting failed', {
          creditId: savedCreditEntry.creditId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    } else {
      if (!this.cardanoMintingService) {
        logger.warn('COT minting service not available - credits issued without tokens', {
          creditId: savedCreditEntry.creditId,
          reason: 'CardanoMintingService was not initialized',
        });
      }
      if (!developerWalletAddress) {
        logger.warn('Developer has no wallet address - credits issued without tokens', {
          creditId: savedCreditEntry.creditId,
          developerId: developer.id,
          developerEmail: developer.email,
          reason: 'Developer must link wallet address via /api/v1/wallet/link endpoint',
          hasWalletRepository: !!this.walletRepository,
        });
      }
    }

    // Create credit transaction record with type "issuance" (Requirement 5.8)
    const transaction: CreditTransaction = {
      id: uuidv4(),
      creditId: savedCreditEntry.id,
      transactionType: TransactionType.ISSUANCE,
      senderId: undefined, // No sender for issuance
      recipientId: project.developerId, // Developer receives the credits
      quantity: project.emissionsTarget,
      status: TransactionStatus.COMPLETED,
      blockchainTxHash: mintTxHash, // COT minting transaction hash
      metadata: {
        ...createIssuanceMetadata(projectId, verificationId),
        cotMinted: !!mintTxHash,
        policyId,
        assetName,
      },
      createdAt: now,
      completedAt: now,
    };

    const savedTransaction = await this.creditTransactionRepository.save(transaction);

    logger.info('Credits issued successfully', {
      projectId,
      verificationId,
      creditId: savedCreditEntry.creditId,
      creditEntryId: savedCreditEntry.id,
      transactionId: savedTransaction.id,
      quantity: savedCreditEntry.quantity,
      vintage: savedCreditEntry.vintage,
      ownerId: savedCreditEntry.ownerId,
      developerName: developer.name,
      developerEmail: developer.email,
      cotMinted: !!mintTxHash,
      mintTxHash,
      policyId,
    });

    return {
      creditEntry: savedCreditEntry,
      transaction: savedTransaction,
    };
  }

  /**
   * Get credit entry by ID
   */
  async getCreditById(creditId: string): Promise<CreditEntry | null> {
    return await this.creditEntryRepository.findById(creditId);
  }

  /**
   * Get credit entry by serial number
   */
  async getCreditByCreditId(creditId: string): Promise<CreditEntry | null> {
    return await this.creditEntryRepository.findByCreditId(creditId);
  }

  /**
   * Get credits owned by a user
   */
  async getCreditsByOwner(
    ownerId: string,
    filters?: CreditFilters,
    pagination?: PaginationOptions
  ): Promise<CreditEntry[]> {
    return await this.creditEntryRepository.findByOwner(ownerId, filters, pagination);
  }

  /**
   * Get credits for a project
   */
  async getCreditsByProject(projectId: string): Promise<CreditEntry[]> {
    return await this.creditEntryRepository.findByProject(projectId);
  }

  /**
   * Get transaction history for a credit
   */
  async getTransactionHistory(creditId: string): Promise<CreditTransaction[]> {
    return await this.creditTransactionRepository.findByCreditId(creditId);
  }

  /**
   * Get all credits (for administrators)
   */
  async getAllCredits(
    filters?: CreditFilters,
    pagination?: PaginationOptions
  ): Promise<CreditEntry[]> {
    return await this.creditEntryRepository.findAll(filters, pagination);
  }

  /**
   * Count credits with filters
   */
  async countCredits(filters?: CreditFilters): Promise<number> {
    return await this.creditEntryRepository.count(filters);
  }

  /**
   * Transfer credits to another user
   * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8
   *
   * This method performs the following operations:
   * 1. Validates the transfer (ownership, quantity, status)
   * 2. Updates credit ownership in the database
   * 3. Transfers COT tokens on Cardano (if available)
   * 4. Optionally records transfer metadata on Cardano blockchain (Task 32)
   * 5. Creates a transaction record
   *
   * The optional Cardano metadata recording (Task 32) creates an immutable audit trail
   * of the transfer on the blockchain, separate from the COT token transfer itself.
   */
  async transferCredits(
    creditId: string,
    senderId: string,
    recipientId: string,
    quantity: number
  ): Promise<{ creditEntry: CreditEntry; transaction: CreditTransaction }> {
    logger.info('Starting credit transfer process', {
      creditId,
      senderId,
      recipientId,
      quantity,
    });

    // Validate recipient user exists (Requirement 6.4)
    const recipient = await this.userRepository.findById(recipientId);
    if (!recipient) {
      throw new Error('Recipient user not found');
    }

    // Use serializable transaction isolation (Requirement 6.5)
    const client = await this.creditEntryRepository.getClient();

    try {
      await client.query('BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE');

      // Lock credit record FOR UPDATE (Requirement 6.6)
      const credit = await this.creditEntryRepository.lockForUpdateWithClient(client, creditId);

      if (!credit) {
        throw new Error('Credit not found');
      }

      // Validate user owns credits (Requirement 6.1)
      if (credit.ownerId !== senderId) {
        throw new Error('You do not own this credit');
      }

      // Validate credit status is "active" (Requirement 6.3)
      if (credit.status !== CreditStatus.ACTIVE) {
        throw new Error('Credit must be active to transfer');
      }

      // Validate transfer quantity (positive, <= owned) (Requirement 6.2)
      if (quantity <= 0) {
        throw new Error('Transfer quantity must be positive');
      }

      if (quantity > credit.quantity) {
        throw new Error('Transfer quantity exceeds owned amount');
      }

      // Update credit owner to recipient and status to "transferred" (Requirement 6.7)
      const now = new Date();
      credit.ownerId = recipientId;
      credit.status = CreditStatus.TRANSFERRED;
      credit.lastActionAt = now;
      credit.updatedAt = now;

      const updatedCredit = await this.creditEntryRepository.updateWithClient(client, credit);

      // Transfer COT tokens on Cardano blockchain (Phase 2)
      let tokenTransferTxHash: string | undefined;
      let tokenTransferStatus: 'completed' | 'pending' | 'skipped' = 'skipped';

      if (this.cardanoMintingService && credit.policyId && credit.assetName) {
        // Check if recipient has a wallet address
        if (recipient.walletAddress) {
          const transferStartTime = Date.now();
          try {
            logger.info('Transferring COT tokens on Cardano', {
              creditId: credit.creditId,
              policyId: credit.policyId,
              assetName: credit.assetName,
              quantity: credit.quantity,
              recipientWallet: recipient.walletAddress,
            });

            // Transfer tokens with retry logic
            tokenTransferTxHash = await cotErrorHandler.executeWithRetry(
              async () => {
                return await this.cardanoMintingService!.transferAsset(
                  credit.policyId!,
                  credit.assetName!,
                  credit.quantity.toString(),
                  recipient.walletAddress!
                );
              },
              {
                id: `transfer-${credit.id}`,
                type: 'transfer',
                creditId: credit.creditId,
                policyId: credit.policyId,
                assetName: credit.assetName,
                recipientAddress: recipient.walletAddress,
                quantity: credit.quantity.toString(),
              }
            );

            tokenTransferStatus = 'completed';

            // Record successful operation
            const transferDuration = Date.now() - transferStartTime;
            cotMonitoringService.recordOperation(
              'transfer',
              true,
              transferDuration,
              credit.creditId
            );

            logger.info('COT tokens transferred successfully', {
              creditId: credit.creditId,
              transferTxHash: tokenTransferTxHash,
              recipientWallet: recipient.walletAddress,
              durationMs: transferDuration,
            });
          } catch (error) {
            // Record failed operation
            const transferDuration = Date.now() - transferStartTime;
            cotMonitoringService.recordOperation(
              'transfer',
              false,
              transferDuration,
              credit.creditId,
              error instanceof Error ? error.message : 'Unknown error'
            );

            logger.error('Failed to transfer COT tokens', {
              error,
              creditId: credit.creditId,
              policyId: credit.policyId,
              recipientWallet: recipient.walletAddress,
            });

            // Rollback database transaction if token transfer fails
            await client.query('ROLLBACK');
            throw new Error(
              `Credit transfer failed: Unable to transfer COT tokens on blockchain. ${
                error instanceof Error ? error.message : 'Unknown error'
              }`
            );
          }
        } else {
          logger.warn('Recipient has no wallet address - COT tokens not transferred', {
            creditId: credit.creditId,
            recipientId,
            recipientEmail: recipient.email,
          });
          tokenTransferStatus = 'pending';
        }
      } else {
        if (!credit.policyId || !credit.assetName) {
          logger.info('Credit has no COT tokens - skipping blockchain transfer', {
            creditId: credit.creditId,
            hasPolicyId: !!credit.policyId,
            hasAssetName: !!credit.assetName,
          });
        }
      }

      // Optionally record transfer metadata on Cardano blockchain (Task 32)
      // This is separate from the COT token transfer - it records the transfer event as metadata
      let metadataRecordTxHash: string | undefined;

      if (this.cardanoTransactionService && tokenTransferStatus === 'completed') {
        try {
          logger.info('Recording transfer metadata on Cardano blockchain', {
            creditId: credit.creditId,
            senderId,
            recipientId,
            quantity,
          });

          // Get project details for metadata
          const project = await this.projectRepository.findById(credit.projectId);

          // Build transfer metadata in CIP-20 format
          const transferMetadata = {
            action: 'transfer',
            creditId: credit.creditId,
            projectId: credit.projectId,
            projectTitle: project?.title,
            quantity: quantity.toString(),
            vintage: credit.vintage,
            senderId,
            recipientId,
            timestamp: now.toISOString(),
            policyId: credit.policyId,
            assetName: credit.assetName,
          };

          // Submit metadata transaction to Cardano
          // The transaction sends a minimal amount to the recipient's wallet
          // The important part is the metadata that gets recorded on-chain
          metadataRecordTxHash = await this.cardanoTransactionService.buildSignAndSubmitTransaction(
            [
              {
                address: recipient.walletAddress!, // Send to recipient as confirmation
                amount: '1500000', // 1.5 ADA minimal output
              },
            ],
            transferMetadata,
            {
              creditId: credit.creditId,
              operationType: 'transfer',
            }
          );

          logger.info('Transfer metadata recorded on Cardano', {
            creditId: credit.creditId,
            metadataRecordTxHash,
            recipientWallet: recipient.walletAddress,
          });
        } catch (error) {
          // Don't fail the transfer if metadata recording fails
          logger.warn('Failed to record transfer metadata on Cardano', {
            error,
            creditId: credit.creditId,
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      // Create credit transaction record with type "transfer" (Requirement 6.8)
      const transaction: CreditTransaction = {
        id: uuidv4(),
        creditId: credit.id,
        transactionType: TransactionType.TRANSFER,
        senderId,
        recipientId,
        quantity,
        status: TransactionStatus.COMPLETED,
        blockchainTxHash: tokenTransferTxHash, // COT transfer transaction hash
        metadata: {
          ...createTransferMetadata(),
          cotTransferred: tokenTransferStatus === 'completed',
          cotTransferStatus: tokenTransferStatus,
          recipientHasWallet: !!recipient.walletAddress,
          policyId: credit.policyId,
          assetName: credit.assetName,
          metadataRecordTxHash, // Cardano metadata recording transaction hash
          metadataRecorded: !!metadataRecordTxHash,
        },
        createdAt: now,
        completedAt: now,
      };

      const savedTransaction = await this.creditTransactionRepository.saveWithClient(
        client,
        transaction
      );

      await client.query('COMMIT');

      logger.info('Credits transferred successfully', {
        creditId: credit.id,
        creditSerialNumber: credit.creditId,
        transactionId: savedTransaction.id,
        senderId,
        recipientId,
        quantity,
        senderName: 'N/A', // Would need to fetch sender details
        recipientName: recipient.name,
        recipientEmail: recipient.email,
        cotTransferred: tokenTransferStatus === 'completed',
        cotTransferStatus: tokenTransferStatus,
        tokenTransferTxHash,
        metadataRecorded: !!metadataRecordTxHash,
        metadataRecordTxHash,
      });

      return {
        creditEntry: updatedCredit,
        transaction: savedTransaction,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error transferring credits', {
        error,
        creditId,
        senderId,
        recipientId,
        quantity,
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Retire credits permanently with COT token burning
   * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9-7.20
   */
  async retireCredits(
    creditId: string,
    userId: string,
    quantity: number,
    reason: string
  ): Promise<{ creditEntry: CreditEntry; transaction: CreditTransaction; burnTxHash?: string }> {
    logger.info('Starting credit retirement process', {
      creditId,
      userId,
      quantity,
      reason,
    });

    // Validate retirement reason (Requirement 7.4)
    if (!reason || reason.trim().length === 0) {
      throw new Error('Retirement reason is required');
    }

    // Use serializable transaction isolation (Requirement 7.5)
    const client = await this.creditEntryRepository.getClient();

    try {
      await client.query('BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE');

      // Lock credit record FOR UPDATE (Requirement 7.6)
      const credit = await this.creditEntryRepository.lockForUpdateWithClient(client, creditId);

      if (!credit) {
        throw new Error('Credit not found');
      }

      // Validate user owns credits (Requirement 7.1)
      if (credit.ownerId !== userId) {
        throw new Error('You do not own this credit');
      }

      // Validate credit status is "active" (Requirement 7.3)
      if (credit.status !== CreditStatus.ACTIVE) {
        throw new Error('Credit must be active to retire');
      }

      // Validate retirement quantity (positive, <= owned) (Requirement 7.2)
      if (quantity <= 0) {
        throw new Error('Retirement quantity must be positive');
      }

      if (quantity > credit.quantity) {
        throw new Error('Retirement quantity exceeds owned amount');
      }

      // Update credit status to "retired" (Requirement 7.7)
      const now = new Date();
      credit.status = CreditStatus.RETIRED;
      credit.lastActionAt = now;
      credit.updatedAt = now;

      const updatedCredit = await this.creditEntryRepository.updateWithClient(client, credit);

      // Burn COT tokens on Cardano blockchain (Phase 3)
      let burnTxHash: string | undefined;
      let cotBurned = false;

      if (this.cardanoMintingService && credit.policyId && credit.assetName) {
        const burnStartTime = Date.now();
        try {
          logger.info('Burning COT tokens on Cardano', {
            creditId: credit.creditId,
            policyId: credit.policyId,
            assetName: credit.assetName,
            quantity: credit.quantity,
          });

          // Burn tokens with retry logic
          const burnResult = await cotErrorHandler.executeWithRetry(
            async () => {
              return await this.cardanoMintingService!.burnAsset({
                projectId: credit.projectId,
                policyId: credit.policyId!,
                assetName: credit.assetName!,
                quantity: credit.quantity.toString(),
              });
            },
            {
              id: `burn-${credit.id}`,
              type: 'burn',
              creditId: credit.creditId,
              policyId: credit.policyId,
              assetName: credit.assetName,
              quantity: credit.quantity.toString(),
            }
          );

          burnTxHash = burnResult.txHash;
          cotBurned = true;

          // Record successful operation
          const burnDuration = Date.now() - burnStartTime;
          cotMonitoringService.recordOperation('burn', true, burnDuration, credit.creditId);

          logger.info('COT tokens burned successfully', {
            creditId: credit.creditId,
            burnTxHash,
            policyId: credit.policyId,
            assetName: credit.assetName,
            durationMs: burnDuration,
          });
        } catch (error) {
          // Record failed operation
          const burnDuration = Date.now() - burnStartTime;
          cotMonitoringService.recordOperation(
            'burn',
            false,
            burnDuration,
            credit.creditId,
            error instanceof Error ? error.message : 'Unknown error'
          );

          logger.error('Failed to burn COT tokens', {
            error,
            creditId: credit.creditId,
            policyId: credit.policyId,
          });

          // Rollback database transaction if token burning fails
          await client.query('ROLLBACK');
          throw new Error(
            `Credit retirement failed: Unable to burn COT tokens on blockchain. ${
              error instanceof Error ? error.message : 'Unknown error'
            }`
          );
        }
      } else {
        if (!credit.policyId || !credit.assetName) {
          logger.info('Credit has no COT tokens - skipping token burning', {
            creditId: credit.creditId,
            hasPolicyId: !!credit.policyId,
            hasAssetName: !!credit.assetName,
          });
        }
      }

      // Create credit transaction record with type "retirement" (Requirement 7.8)
      const transaction: CreditTransaction = {
        id: uuidv4(),
        creditId: credit.id,
        transactionType: TransactionType.RETIREMENT,
        senderId: userId,
        recipientId: undefined, // No recipient for retirement
        quantity,
        status: TransactionStatus.COMPLETED,
        blockchainTxHash: burnTxHash, // COT burn transaction hash
        metadata: {
          retirementReason: reason,
          timestamp: now.toISOString(),
          cotBurned,
          policyId: credit.policyId,
          assetName: credit.assetName,
          // CIP-20 metadata for retirement recording
          creditId: credit.creditId,
          projectId: credit.projectId,
          vintage: credit.vintage,
          retiredBy: userId,
        },
        createdAt: now,
        completedAt: now,
      };

      const savedTransaction = await this.creditTransactionRepository.saveWithClient(
        client,
        transaction
      );

      await client.query('COMMIT');

      logger.info('Credits retired successfully', {
        creditId: credit.id,
        creditSerialNumber: credit.creditId,
        transactionId: savedTransaction.id,
        userId,
        quantity,
        reason,
        cotBurned,
        burnTxHash,
      });

      return {
        creditEntry: updatedCredit,
        transaction: savedTransaction,
        burnTxHash,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error retiring credits', {
        error,
        creditId,
        userId,
        quantity,
        reason,
      });
      throw error;
    } finally {
      client.release();
    }
  }
}
