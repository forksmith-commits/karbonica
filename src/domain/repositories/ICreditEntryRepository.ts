import { CreditEntry } from '../entities/CreditEntry';

export interface ICreditEntryRepository {
  /**
   * Find credit entry by ID
   */
  findById(id: string): Promise<CreditEntry | null>;

  /**
   * Find credit entry by credit ID (serial number)
   */
  findByCreditId(creditId: string): Promise<CreditEntry | null>;

  /**
   * Find credit entries by owner
   */
  findByOwner(ownerId: string, filters?: any, pagination?: any): Promise<CreditEntry[]>;

  /**
   * Find credit entries by project
   */
  findByProject(projectId: string): Promise<CreditEntry[]>;

  /**
   * Save new credit entry
   */
  save(creditEntry: CreditEntry): Promise<CreditEntry>;

  /**
   * Update existing credit entry
   */
  update(creditEntry: CreditEntry): Promise<CreditEntry>;

  /**
   * Lock credit entry for update (for transactions)
   */
  lockForUpdate(id: string): Promise<CreditEntry | null>;

  /**
   * Get next sequence number for credit serial generation
   */
  getNextCreditSequence(projectId: string, vintage: number): Promise<number>;

  /**
   * Get project sequence number for credit serial generation
   */
  getProjectSequence(projectId: string): Promise<number>;

  /**
   * Find all credit entries with filters and pagination (for administrators)
   */
  findAll(filters?: any, pagination?: any): Promise<CreditEntry[]>;

  /**
   * Count credit entries with filters
   */
  count(filters?: any): Promise<number>;

  /**
   * Get database client for transaction management
   */
  getClient(): Promise<any>;

  /**
   * Lock credit entry for update with client (for transactions)
   */
  lockForUpdateWithClient(client: any, id: string): Promise<CreditEntry | null>;

  /**
   * Update credit entry with client (for transactions)
   */
  updateWithClient(client: any, creditEntry: CreditEntry): Promise<CreditEntry>;
}
