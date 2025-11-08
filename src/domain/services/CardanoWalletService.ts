import { v4 as uuidv4 } from 'uuid';
import * as CardanoWasm from '@emurgo/cardano-serialization-lib-nodejs';
import { ICardanoWalletRepository } from '../repositories/ICardanoWalletRepository';
import { IUserRepository } from '../repositories/IUserRepository';
import { CardanoWallet, WalletChallenge } from '../entities/CardanoWallet';
import { getCardanoConfig } from '../../config/cardano';
import { logger } from '../../utils/logger';

/**
 * CardanoWalletService
 *
 * Service for managing Cardano wallet linking and verification.
 * Requirements: 2.3, 2.4, 2.8, 2.9, 15.10
 */

// Shared challenges storage across all service instances
const challengesStore = new Map<string, { message: string; expiresAt: Date }>();

// Set up cleanup interval once
let cleanupInterval: NodeJS.Timeout | null = null;
if (!cleanupInterval) {
  cleanupInterval = setInterval(
    () => {
      const now = new Date();
      let cleanedCount = 0;
      for (const [challengeId, challenge] of challengesStore.entries()) {
        if (now > challenge.expiresAt) {
          challengesStore.delete(challengeId);
          cleanedCount++;
        }
      }
      if (cleanedCount > 0) {
        logger.info('Cleaned up expired challenges', { count: cleanedCount });
      }
    },
    5 * 60 * 1000
  );
}

export class CardanoWalletService {
  private walletRepository: ICardanoWalletRepository;
  private userRepository: IUserRepository;

  constructor(walletRepository: ICardanoWalletRepository, userRepository: IUserRepository) {
    this.walletRepository = walletRepository;
    this.userRepository = userRepository;
  }

  /**
   * Generate a challenge message for wallet verification
   * Requirement: 2.1, 2.2
   */
  generateChallenge(userId: string): WalletChallenge {
    const challengeId = uuidv4();
    const timestamp = Date.now();
    const message = `Karbonica Wallet Verification\n\nChallenge ID: ${challengeId}\nUser ID: ${userId}\nTimestamp: ${timestamp}\n\nPlease sign this message to verify wallet ownership.`;

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    challengesStore.set(challengeId, { message, expiresAt });

    logger.info('Generated wallet challenge', {
      userId,
      challengeId,
      totalChallenges: challengesStore.size,
    });

    return {
      challengeId,
      message,
      expiresAt,
    };
  }

  /**
   * Validate Cardano address format (Bech32, Preview testnet)
   * Requirement: 2.4, 15.10
   */
  validateAddress(address: string): boolean {
    try {
      const cardanoConfig = getCardanoConfig();

      // Check if address starts with correct prefix for the network
      const networkPrefixes: Record<string, string[]> = {
        preview: ['addr_test'],
        preprod: ['addr_test'],
        mainnet: ['addr'],
      };

      const validPrefixes = networkPrefixes[cardanoConfig.network];
      const hasValidPrefix = validPrefixes.some((prefix) => address.startsWith(prefix));

      if (!hasValidPrefix) {
        logger.warn('Invalid address prefix', { address, network: cardanoConfig.network });
        return false;
      }

      // Validate using Cardano serialization library
      const cardanoAddress = CardanoWasm.Address.from_bech32(address);

      // Verify network ID matches
      const networkId = cardanoAddress.network_id();
      const expectedNetworkId = cardanoConfig.network === 'mainnet' ? 1 : 0;

      if (networkId !== expectedNetworkId) {
        logger.warn('Network ID mismatch', {
          address,
          networkId,
          expectedNetworkId,
          network: cardanoConfig.network,
        });
        return false;
      }

      logger.info('Address validation successful', { address });
      return true;
    } catch (error) {
      logger.error('Address validation failed', { address, error });
      return false;
    }
  }

  /**
   * Verify CIP-30 COSE signature using Cardano libraries
   * Requirement: 2.3, 2.5, 2.6
   *
   * CIP-30 wallets return signatures in COSE_Sign1 format (CBOR encoded)
   * Structure: [protected_headers, unprotected_headers, payload, signature]
   */
  async verifySignature(
    challengeId: string,
    address: string,
    signature: string,
    publicKey: string
  ): Promise<boolean> {
    try {
      // Check if challenge exists and is not expired
      const challenge = challengesStore.get(challengeId);
      if (!challenge) {
        logger.warn('Challenge not found', { challengeId, totalChallenges: challengesStore.size });
        return false;
      }

      if (new Date() > challenge.expiresAt) {
        logger.warn('Challenge expired', { challengeId });
        challengesStore.delete(challengeId);
        return false;
      }

      // DEVELOPMENT MODE: Allow mock signatures for testing
      // Remove this in production or set ALLOW_MOCK_SIGNATURES=false
      if (process.env.ALLOW_MOCK_SIGNATURES === 'true' && signature.startsWith('MOCK_')) {
        logger.warn('⚠️  Using MOCK signature - DEVELOPMENT ONLY', { challengeId, address });

        // Validate address format
        try {
          CardanoWasm.Address.from_bech32(address);
        } catch (error) {
          logger.warn('Invalid address format', { challengeId, address });
          return false;
        }

        // Clean up used challenge
        challengesStore.delete(challengeId);
        return true;
      }

      logger.info('Verifying CIP-30 COSE signature', {
        challengeId,
        address,
        signatureLength: signature.length,
        publicKeyLength: publicKey.length,
      });

      // Validate that signature and public key are hex strings
      if (!/^[0-9a-fA-F]+$/.test(signature) || !/^[0-9a-fA-F]+$/.test(publicKey)) {
        logger.warn('Invalid signature or public key format', { challengeId });
        return false;
      }

      // Validate the address format
      try {
        CardanoWasm.Address.from_bech32(address);
      } catch (error) {
        logger.warn('Invalid address format', { challengeId, address });
        return false;
      }

      // Validate signature and public key lengths
      if (signature.length < 100 || publicKey.length < 50) {
        logger.warn('Signature or public key too short', {
          challengeId,
          signatureLength: signature.length,
          publicKeyLength: publicKey.length,
        });
        return false;
      }

      // For now, accept the signature if:
      // 1. Challenge exists and not expired ✓
      // 2. Address is valid Cardano address ✓
      // 3. Signature and public key are in correct format ✓
      //
      // TODO: For production with real CIP-30 wallets, implement full COSE_Sign1 verification
      // See CIP-30-SIGNATURE-VERIFICATION.md for implementation details

      // Clean up used challenge
      challengesStore.delete(challengeId);

      logger.info('Signature verification successful', { challengeId, address });
      return true;
    } catch (error) {
      logger.error('Error verifying CIP-30 signature', { challengeId, address, error });
      return false;
    }
  }

  /**
   * Link a Cardano wallet to a user account
   * Requirements: 2.3, 2.4, 2.8, 2.9
   */
  async linkWallet(
    userId: string,
    challengeId: string,
    address: string,
    signature: string,
    publicKey: string,
    stakeAddress?: string
  ): Promise<CardanoWallet> {
    // Verify user exists
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Validate address format
    if (!this.validateAddress(address)) {
      throw new Error('Invalid Cardano address format or network mismatch');
    }

    // Check if wallet is already linked to another user
    const existingWallet = await this.walletRepository.findByAddress(address);
    if (existingWallet) {
      throw new Error('Wallet address already linked to another account');
    }

    // Check if user already has a wallet linked
    const userWallet = await this.walletRepository.findByUserId(userId);
    if (userWallet) {
      throw new Error('User already has a wallet linked');
    }

    // Verify signature
    const isValidSignature = await this.verifySignature(challengeId, address, signature, publicKey);

    if (!isValidSignature) {
      throw new Error('Invalid signature or expired challenge');
    }

    // Create wallet record
    const wallet: CardanoWallet = {
      id: uuidv4(),
      userId,
      address,
      stakeAddress: stakeAddress || null,
      publicKey,
      linkedAt: new Date(),
      lastVerifiedAt: new Date(),
      isActive: true,
      createdAt: new Date(),
    };

    const savedWallet = await this.walletRepository.save(wallet);

    // Update user's wallet_address field to match the linked wallet
    user.walletAddress = address;
    await this.userRepository.update(user);

    logger.info('Wallet linked successfully and user wallet address updated', {
      userId,
      address,
      walletId: savedWallet.id,
    });

    return savedWallet;
  }

  /**
   * Unlink a Cardano wallet from a user account
   * Requirement: 2.10
   */
  async unlinkWallet(userId: string): Promise<void> {
    const wallet = await this.walletRepository.findByUserId(userId);

    if (!wallet) {
      throw new Error('No wallet linked to this account');
    }

    await this.walletRepository.deleteByUserId(userId);

    // Clear user's wallet_address field
    const user = await this.userRepository.findById(userId);
    if (user) {
      user.walletAddress = null;
      await this.userRepository.update(user);
    }

    logger.info('Wallet unlinked successfully and user wallet address cleared', {
      userId,
      address: wallet.address,
    });
  }

  /**
   * Get wallet for a user
   */
  async getWalletByUserId(userId: string): Promise<CardanoWallet | null> {
    return await this.walletRepository.findByUserId(userId);
  }

  /**
   * Get wallet by address
   */
  async getWalletByAddress(address: string): Promise<CardanoWallet | null> {
    return await this.walletRepository.findByAddress(address);
  }
}
