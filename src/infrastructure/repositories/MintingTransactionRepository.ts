import { Repository } from 'typeorm';
import { MintingTransaction } from '../../domain/entities/MintingTransaction';
import { MintingTransactionRepository } from '../../domain/repositories/IMintingTransactionRepository';

export class MintingTransactionRepositoryImpl
  extends Repository<MintingTransaction>
  implements MintingTransactionRepository {
  async findByProjectId(projectId: string): Promise<MintingTransaction[]> {
    return this.find({
      where: { projectId },
      order: { createdAt: 'DESC' },
    });
  }

  async findByPolicyId(policyId: string): Promise<MintingTransaction[]> {
    return this.find({
      where: { policyId },
      order: { createdAt: 'DESC' },
    });
  }

  async findByTxHash(txHash: string): Promise<MintingTransaction | null> {
    return this.findOne({ where: { txHash } });
  }
}
