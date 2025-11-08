import { CreditTransaction } from '../entities/CreditTransaction';

export interface ICreditTransactionRepository {
  /**
   * Find credit transaction by ID
   */
  findById(id: string): Promise<CreditTransaction | null>;

  /**
   * Find credit transactions by credit ID
   */
  findByCreditId(creditId: string): Promise<CreditTransaction[]>;

  /**
   * Find credit transactions by sender
   */
  findBySender(senderId: string, filters?: any, pagination?: any): Promise<CreditTransaction[]>;

  /**
   * Find credit transactions by recipient
   */
  findByRecipient(
    recipientId: string,
    filters?: any,
    pagination?: any
  ): Promise<CreditTransaction[]>;

  /**
   * Find credit transactions by type
   */
  findByType(
    transactionType: string,
    filters?: any,
    pagination?: any
  ): Promise<CreditTransaction[]>;

  /**
   * Save new credit transaction
   */
  save(creditTransaction: CreditTransaction): Promise<CreditTransaction>;

  /**
   * Update existing credit transaction
   */
  update(creditTransaction: CreditTransaction): Promise<CreditTransaction>;

  /**
   * Count credit transactions with filters
   */
  count(filters?: any): Promise<number>;

  /**
   * Save new credit transaction with client (for transactions)
   */
  saveWithClient(client: any, creditTransaction: CreditTransaction): Promise<CreditTransaction>;
}
