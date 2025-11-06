import { BlockchainTransaction } from '../../domain/entities/BlockchainTransaction';

export interface BlockchainTransactionRepository {
  save(transaction: BlockchainTransaction): Promise<BlockchainTransaction>;
  findById(id: string): Promise<BlockchainTransaction | null>;
  findByTxHash(txHash: string): Promise<BlockchainTransaction | null>;
  findPendingTransactions(): Promise<BlockchainTransaction[]>;
  updateStatus(
    id: string,
    status: BlockchainTransaction['status'],
    updates?: Partial<BlockchainTransaction>
  ): Promise<void>;
}

export class InMemoryBlockchainTransactionRepository implements BlockchainTransactionRepository {
  private transactions: Map<string, BlockchainTransaction> = new Map();

  async save(transaction: BlockchainTransaction): Promise<BlockchainTransaction> {
    this.transactions.set(transaction.id, transaction);
    return transaction;
  }

  async findById(id: string): Promise<BlockchainTransaction | null> {
    return this.transactions.get(id) || null;
  }

  async findByTxHash(txHash: string): Promise<BlockchainTransaction | null> {
    for (const tx of this.transactions.values()) {
      if (tx.txHash === txHash) return tx;
    }
    return null;
  }

  async findPendingTransactions(): Promise<BlockchainTransaction[]> {
    return Array.from(this.transactions.values()).filter((tx) => tx.status === 'pending');
  }

  async updateStatus(
    id: string,
    status: BlockchainTransaction['status'],
    updates?: Partial<BlockchainTransaction>
  ): Promise<void> {
    const tx = this.transactions.get(id);
    if (tx) {
      Object.assign(tx, { status, ...updates });
    }
  }
}
