export interface BlockchainTransaction {
  id: string;
  txHash: string;
  status: 'pending' | 'confirmed' | 'failed' | 'timeout';
  submissionTimestamp: Date;
  confirmationTimestamp?: Date;
  blockNumber?: number;
  blockHash?: string;
  errorMessage?: string;
  retryCount: number;
  metadata?: {
    creditId?: string;
    operationType?: 'transfer' | 'retirement' | 'issuance';
    [key: string]: any;
  };
}

export class BlockchainTransactionError extends Error {
  constructor(
    message: string,
    public readonly cause?: Error,
    public readonly txHash?: string
  ) {
    super(message);
    this.name = 'BlockchainTransactionError';
  }
}
