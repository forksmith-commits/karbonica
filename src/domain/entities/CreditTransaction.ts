/**
 * CreditTransaction Entity
 *
 * Represents a transaction record for credit operations (issuance, transfer, retirement).
 * Requirements: 5.8, 6.8, 7.8
 */

export enum TransactionType {
  ISSUANCE = 'issuance',
  TRANSFER = 'transfer',
  RETIREMENT = 'retirement',
}

export enum TransactionStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export interface CreditTransaction {
  id: string;
  creditId: string; // References CreditEntry.id
  transactionType: TransactionType;
  senderId?: string; // User ID (nullable for issuance)
  recipientId?: string; // User ID (nullable for retirement)
  quantity: number; // Decimal(15,2)
  status: TransactionStatus;
  blockchainTxHash?: string; // Cardano transaction hash (nullable)
  metadata?: Record<string, unknown>; // JSON metadata
  createdAt: Date;
  completedAt?: Date;
}

/**
 * Create issuance transaction metadata
 */
export function createIssuanceMetadata(
  projectId: string,
  verificationId: string
): Record<string, unknown> {
  return {
    projectId,
    verificationId,
    issuanceReason: 'Project verification approved',
    timestamp: new Date().toISOString(),
  };
}

/**
 * Create transfer transaction metadata
 */
export function createTransferMetadata(reason?: string): Record<string, unknown> {
  return {
    transferReason: reason || 'Credit transfer',
    timestamp: new Date().toISOString(),
  };
}

/**
 * Create retirement transaction metadata
 */
export function createRetirementMetadata(reason: string): Record<string, unknown> {
  return {
    retirementReason: reason,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Validate credit transaction data
 */
export function validateCreditTransaction(transaction: Partial<CreditTransaction>): string[] {
  const errors: string[] = [];

  if (!transaction.creditId) {
    errors.push('Credit ID is required');
  }

  if (
    !transaction.transactionType ||
    !Object.values(TransactionType).includes(transaction.transactionType)
  ) {
    errors.push('Valid transaction type is required');
  }

  if (!transaction.quantity || transaction.quantity <= 0) {
    errors.push('Quantity must be positive');
  }

  if (!transaction.status || !Object.values(TransactionStatus).includes(transaction.status)) {
    errors.push('Valid status is required');
  }

  // Validate sender/recipient based on transaction type
  if (transaction.transactionType === TransactionType.TRANSFER) {
    if (!transaction.senderId) {
      errors.push('Sender ID is required for transfer transactions');
    }
    if (!transaction.recipientId) {
      errors.push('Recipient ID is required for transfer transactions');
    }
  }

  if (transaction.transactionType === TransactionType.RETIREMENT) {
    if (!transaction.senderId) {
      errors.push('Sender ID is required for retirement transactions');
    }
  }

  return errors;
}
