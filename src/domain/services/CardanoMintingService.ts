import {
  ForgeScript,
  MeshTxBuilder,
  resolveScriptHash,
  stringToHex,
  NativeScript,
  deserializeAddress,
  BlockfrostProvider,
} from '@meshsdk/core';
import { getCardanoConfig } from '../../config/cardano';
import { MintingTransaction, MintingOperationType } from '../entities/MintingTransaction';
import { MintingTransactionRepository } from '../repositories/IMintingTransactionRepository';
import { PlatformWalletService } from '../../infrastructure/services/PlatformWalletService';
import { logger } from '../../utils/logger';

export interface MintingPolicyConfig {
  type: 'all' | 'any' | 'before' | 'after';
  slot?: number;
  keyHash?: string;
  scripts?: string[];
}

export interface MintAssetParams {
  projectId: string;
  assetName: string;
  quantity: string;
  metadata?: Record<string, unknown>;
  policyConfig?: MintingPolicyConfig;
}
export interface BurnAssetParams {
  projectId: string;
  policyId: string;
  assetName: string;
  quantity: string;
}

export class CardanoMintingService {
  constructor(
    private mintingTxRepo: MintingTransactionRepository,
    private platformWalletService: PlatformWalletService
  ) {}


  /**
   * Create a minting policy script
   */
  async createMintingPolicy(
    config?: MintingPolicyConfig
  ): Promise<{ script: ForgeScript; scriptCbor: string }> {
    const wallet = await this.platformWalletService.getMeshWallet();
    const address = await wallet.getChangeAddress();
    const { pubKeyHash: keyHash } = deserializeAddress(address);

    // Default: simple signature-based policy
    if (!config) {
      // Use ForgeScript.withOneSignature for signature-based policies
      // This is the recommended approach for simple signature policies
      const script = ForgeScript.withOneSignature(address);
      // For signature-based policies, Mesh SDK can use the address directly
      return { script, scriptCbor: address };
    }

    // Time-locked policy with native script
    if (config.type === 'before' && config.slot) {
      const nativeScript: NativeScript = {
        type: 'all',
        scripts: [
          { type: 'before', slot: config.slot.toString() },
          { type: 'sig', keyHash: keyHash },
        ],
      };
      const script = ForgeScript.fromNativeScript(nativeScript);
      // ForgeScript object should be passed directly to mintingScript()
      // Store JSON for resolveScriptHash, but use ForgeScript object for minting
      return { script, scriptCbor: JSON.stringify(nativeScript) };
    }

    if (config.type === 'after' && config.slot) {
      const nativeScript: NativeScript = {
        type: 'all',
        scripts: [
          { type: 'after', slot: config.slot.toString() },
          { type: 'sig', keyHash: keyHash },
        ],
      };
      const script = ForgeScript.fromNativeScript(nativeScript);
      // ForgeScript object should be passed directly to mintingScript()
      // Store JSON for resolveScriptHash, but use ForgeScript object for minting
      return { script, scriptCbor: JSON.stringify(nativeScript) };
    }

    // Multi-sig policies
    if (config.type === 'all' && config.scripts) {
      const nativeScript: NativeScript = {
        type: 'all',
        scripts: config.scripts.map((s) => ({ type: 'sig', keyHash: s })),
      };
      const script = ForgeScript.fromNativeScript(nativeScript);
      // ForgeScript object should be passed directly to mintingScript()
      // Store JSON for resolveScriptHash, but use ForgeScript object for minting
      return { script, scriptCbor: JSON.stringify(nativeScript) };
    }

    if (config.type === 'any' && config.scripts) {
      const nativeScript: NativeScript = {
        type: 'any',
        scripts: config.scripts.map((s) => ({ type: 'sig', keyHash: s })),
      };
      const script = ForgeScript.fromNativeScript(nativeScript);
      // ForgeScript object should be passed directly to mintingScript()
      // Store JSON for resolveScriptHash, but use ForgeScript object for minting
      return { script, scriptCbor: JSON.stringify(nativeScript) };
    }

    // Use ForgeScript.withOneSignature for signature-based policies
    const script = ForgeScript.withOneSignature(address);
    return { script, scriptCbor: address };
  }

  /**
   * Mint native tokens and send to a specific address
   */
  async mintAndSendAsset(
    params: MintAssetParams,
    recipientAddress: string
  ): Promise<MintingTransaction> {
    const { projectId, assetName, quantity, metadata, policyConfig } = params;

    logger.info('CardanoMintingService.mintAndSendAsset called', {
      projectId,
      assetName,
      quantity,
      recipientAddress,
      hasMetadata: !!metadata,
    });

    // Create minting policy
    logger.info('Getting platform wallet...');
    const wallet = await this.platformWalletService.getMeshWallet();
    logger.info('✅ Platform wallet retrieved');
    
    logger.info('Getting wallet UTXOs...');
    const utxos = await wallet.getUtxos();
    logger.info('✅ UTXOs retrieved', { utxoCount: utxos.length });

    // Create minting policy
    logger.info('Creating minting policy...');
    const { script: forgingScript, scriptCbor } = await this.createMintingPolicy(policyConfig);
    // resolveScriptHash expects a string, so we need to convert ForgeScript to string
    // For ForgeScript objects, we use the address or CBOR representation
    const scriptForHash = typeof forgingScript === 'string' ? forgingScript : scriptCbor;
    const policyId = resolveScriptHash(scriptForHash);
    const tokenNameHex = stringToHex(assetName);
    logger.info('✅ Minting policy created', { policyId, tokenNameHex });

    const txMetadata = metadata
      ? {
          [policyId]: {
            [assetName]: metadata,
          },
        }
      : undefined;

    // Build transaction with MeshTxBuilder
    logger.info('Building Cardano transaction...');
    const cardanoConfig = getCardanoConfig();
    const provider = new BlockfrostProvider(cardanoConfig.blockfrostApiKey);
    logger.info('✅ Blockfrost provider created', { network: cardanoConfig.network });

    const txBuilder = new MeshTxBuilder({
      fetcher: provider,
      verbose: true,
    });

    // Mint and send to recipient address
    logger.info('Constructing transaction: minting tokens and sending to recipient...');
    const changeAddress = await wallet.getChangeAddress();
    logger.info('Change address retrieved', { changeAddress });
    
    // According to Mesh SDK docs: mintingScript() accepts ForgeScript object directly
    // https://meshjs.dev/apis/txbuilder/minting
    // TypeScript types may be incomplete, but runtime accepts ForgeScript object
    let unsignedTx = txBuilder
      .mint(quantity, policyId, tokenNameHex)
      .mintingScript(forgingScript as unknown as string)
      .txOut(recipientAddress, [{ unit: policyId + tokenNameHex, quantity }])
      .changeAddress(changeAddress)
      .selectUtxosFrom(utxos);

    if (txMetadata) {
      logger.info('Adding CIP-25 metadata to transaction...');
      unsignedTx = unsignedTx.metadataValue('721', txMetadata);
    }

    logger.info('✅ Transaction built, completing...');
    const builtTx = await unsignedTx.complete();
    logger.info('✅ Transaction completed, signing...');
    
    const signedTx = await wallet.signTx(builtTx);
    logger.info('✅ Transaction signed, submitting to blockchain...');
    
    const txHash = await wallet.submitTx(signedTx);
    logger.info('🎉 Transaction submitted to Cardano blockchain!', { txHash });

    // Store minting record
    const mintingTx = this.mintingTxRepo.create({
      projectId,
      policyId,
      assetName,
      quantity,
      operation: MintingOperationType.MINT,
      txHash,
      metadata,
      policyScript: { cbor: scriptCbor, policyId },
    });

    await this.mintingTxRepo.save(mintingTx);
    return mintingTx;
  }

  /**
   * Mint native tokens (sends to platform wallet)
   */
  async mintAsset(params: MintAssetParams): Promise<MintingTransaction> {
    const { projectId, assetName, quantity, metadata, policyConfig } = params;

    // Create minting policy
    const wallet = await this.platformWalletService.getMeshWallet();
    const address = await wallet.getChangeAddress();
    const utxos = await wallet.getUtxos();

    // Create minting policy
    const { script: forgingScript, scriptCbor } = await this.createMintingPolicy(policyConfig);
    // resolveScriptHash expects a string, so we need to convert ForgeScript to string
    // For ForgeScript objects, we use the address or CBOR representation
    const scriptForHash = typeof forgingScript === 'string' ? forgingScript : scriptCbor;
    const policyId = resolveScriptHash(scriptForHash);
    const tokenNameHex = stringToHex(assetName);

    const txMetadata = metadata
      ? {
          [policyId]: {
            [assetName]: metadata,
          },
        }
      : undefined;

    // Build transaction with MeshTxBuilder
    const cardanoConfig = getCardanoConfig();
    const provider = new BlockfrostProvider(cardanoConfig.blockfrostApiKey);

    const txBuilder = new MeshTxBuilder({
      fetcher: provider,
      verbose: true,
    });

    // According to Mesh SDK docs: mintingScript() accepts ForgeScript object directly
    // https://meshjs.dev/apis/txbuilder/minting
    // TypeScript types may be incomplete, but runtime accepts ForgeScript object
    let unsignedTx = txBuilder
      .mint(quantity, policyId, tokenNameHex)
      .mintingScript(forgingScript as unknown as string)
      .changeAddress(address)
      .selectUtxosFrom(utxos);

    if (txMetadata) {
      unsignedTx = unsignedTx.metadataValue('721', txMetadata);
    }

    const builtTx = await unsignedTx.complete();
    const signedTx = await wallet.signTx(builtTx);
    const txHash = await wallet.submitTx(signedTx);

    // Store minting record
    const mintingTx = this.mintingTxRepo.create({
      projectId,
      policyId,
      assetName,
      quantity,
      operation: MintingOperationType.MINT,
      txHash,
      metadata,
      policyScript: { cbor: scriptCbor, policyId },
    });

    await this.mintingTxRepo.save(mintingTx);
    return mintingTx;
  }

  /**
   * Burn native tokens
   */
  async burnAsset(params: BurnAssetParams): Promise<MintingTransaction> {
    const { projectId, policyId, assetName, quantity } = params;

    const wallet = await this.platformWalletService.getMeshWallet();
    const address = await wallet.getChangeAddress();
    const utxos = await wallet.getUtxos();

    // Get original minting transaction to retrieve policy script
    const originalMint = await this.mintingTxRepo.findOne({
      where: { projectId, policyId, assetName, operation: MintingOperationType.MINT },
    });

    if (!originalMint) {
      throw new Error('Original minting transaction not found');
    }

    // Get script CBOR from original mint
    // policyScript is stored as Record<string, unknown> with 'cbor' and 'policyId' properties
    const scriptData = originalMint.policyScript as { cbor: string; policyId: string };
    if (!scriptData || !scriptData.cbor) {
      throw new Error('Invalid policy script data in original minting transaction');
    }
    const tokenNameHex = stringToHex(assetName);

    // Build burn transaction (negative quantity)
    const cardanoConfig = getCardanoConfig();
    const provider = new BlockfrostProvider(cardanoConfig.blockfrostApiKey);

    const txBuilder = new MeshTxBuilder({
      fetcher: provider,
      verbose: true,
    });

    const unsignedTx = await txBuilder
      .mint(`-${quantity}`, policyId, tokenNameHex)
      .mintingScript(scriptData.cbor)
      .changeAddress(address)
      .selectUtxosFrom(utxos)
      .complete();

    const signedTx = await wallet.signTx(unsignedTx);
    const txHash = await wallet.submitTx(signedTx);

    // Store burning record
    const burningTx = this.mintingTxRepo.create({
      projectId,
      policyId,
      assetName,
      quantity,
      operation: MintingOperationType.BURN,
      txHash,
      policyScript: originalMint.policyScript,
    });
    await this.mintingTxRepo.save(burningTx);
    return burningTx;
  }

  /**
   * Get minting history for a project
   */
  async getMintingHistory(projectId: string): Promise<MintingTransaction[]> {
    return this.mintingTxRepo.findByProjectId(projectId);
  }

  /**
   * Get all assets minted under a policy
   */
  async getAssetsByPolicy(policyId: string): Promise<MintingTransaction[]> {
    return this.mintingTxRepo.findByPolicyId(policyId);
  }

  /**
   * Transfer native tokens to another address
   */
  async transferAsset(
    policyId: string,
    assetName: string,
    quantity: string,
    recipientAddress: string
  ): Promise<string> {
    const wallet = await this.platformWalletService.getMeshWallet();
    const utxos = await wallet.getUtxos();
    const changeAddress = await wallet.getChangeAddress();

    const tokenNameHex = stringToHex(assetName);
    const assetUnit = policyId + tokenNameHex;

    // Build transaction with MeshTxBuilder
    const cardanoConfig = getCardanoConfig();
    const provider = new BlockfrostProvider(cardanoConfig.blockfrostApiKey);

    const txBuilder = new MeshTxBuilder({
      fetcher: provider,
      verbose: true,
    });

    // Send tokens to recipient
    const unsignedTx = await txBuilder
      .txOut(recipientAddress, [{ unit: assetUnit, quantity }])
      .changeAddress(changeAddress)
      .selectUtxosFrom(utxos)
      .complete();

    const signedTx = await wallet.signTx(unsignedTx);
    const txHash = await wallet.submitTx(signedTx);

    return txHash;
  }
}
