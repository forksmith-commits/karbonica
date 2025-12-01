import { MintingTransaction } from '../entities/MintingTransaction';

/**
 * Repository interface for minting transactions
 * Note: This extends TypeORM Repository, so methods match TypeORM's signatures
 */
export interface MintingTransactionRepository {
  findByProjectId(projectId: string): Promise<MintingTransaction[]>;
  findByPolicyId(policyId: string): Promise<MintingTransaction[]>;
  findByTxHash(txHash: string): Promise<MintingTransaction | null>;
  // TypeORM methods - using flexible signatures to avoid type conflicts
  findOne(options: any): Promise<MintingTransaction | null>;
  create(entity: Partial<MintingTransaction>): MintingTransaction;
  save(entity: MintingTransaction): Promise<MintingTransaction>;
}
