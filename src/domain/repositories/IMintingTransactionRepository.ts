import { MintingTransaction } from '../entities/MintingTransaction';

/**
 * Repository interface for minting transactions
 * Note: This is a simplified interface that doesn't extend TypeORM Repository
 * to allow for PostgreSQL-based implementations
 */
export interface MintingTransactionRepository {
  findByProjectId(projectId: string): Promise<MintingTransaction[]>;
  findByPolicyId(policyId: string): Promise<MintingTransaction[]>;
  findByTxHash(txHash: string): Promise<MintingTransaction | null>;
  findOne(options?: { where?: Record<string, unknown> }): Promise<MintingTransaction | null>;
  create(entity: Partial<MintingTransaction>): MintingTransaction;
  save(entity: MintingTransaction): Promise<MintingTransaction>;
}
