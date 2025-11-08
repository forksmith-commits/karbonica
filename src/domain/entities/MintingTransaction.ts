export enum MintingOperationType {
  MINT = 'MINT',
  BURN = 'BURN',
}

/**
 * MintingTransaction entity
 * Represents a minting or burning transaction on the Cardano blockchain
 * Note: This is a plain TypeScript interface (not a TypeORM entity)
 * since we use raw PostgreSQL queries via MintingTransactionRepositoryPg
 */
export interface MintingTransaction {
  id: string;
  projectId: string;
  policyId: string;
  assetName: string;
  quantity: string; // BigInt as string
  operation: MintingOperationType;
  txHash: string;
  metadata?: Record<string, unknown> | null;
  policyScript: Record<string, unknown>; // JSON object with cbor and policyId
  createdAt: Date;
  updatedAt: Date;
}
