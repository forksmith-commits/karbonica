/**
 * CreditEntry Entity
 *
 * Represents a carbon credit entry issued for a verified project.
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.8
 */

export enum CreditStatus {
  ACTIVE = 'active',
  TRANSFERRED = 'transferred',
  RETIRED = 'retired',
}

export interface CreditEntry {
  id: string;
  creditId: string; // Unique serial number (format: KRB-YYYY-XXX-NNNNNN)
  projectId: string;
  ownerId: string;
  quantity: number; // Decimal(15,2)
  vintage: number; // Year
  status: CreditStatus;
  issuedAt: Date;
  lastActionAt: Date;
  createdAt: Date;
  updatedAt: Date;
  // COT (Carbon Offset Token) blockchain fields
  policyId?: string; // Cardano minting policy ID
  assetName?: string; // Token asset name (hex encoded)
  mintTxHash?: string; // Minting transaction hash
  tokenMetadata?: Record<string, unknown>; // On-chain token metadata
}

/**
 * Generate unique serial number for credit entry
 * Format: KRB-YYYY-XXX-NNNNNN
 * Where:
 * - KRB: Karbonica prefix
 * - YYYY: Current year (vintage)
 * - XXX: Project sequence number (3 digits)
 * - NNNNNN: Credit sequence number (6 digits)
 */
export function generateCreditSerialNumber(
  vintage: number,
  projectSequence: number,
  creditSequence: number
): string {
  const projectSeq = projectSequence.toString().padStart(3, '0');
  const creditSeq = creditSequence.toString().padStart(6, '0');
  return `KRB-${vintage}-${projectSeq}-${creditSeq}`;
}

/**
 * Validate credit entry data
 */
export function validateCreditEntry(credit: Partial<CreditEntry>): string[] {
  const errors: string[] = [];

  if (!credit.creditId) {
    errors.push('Credit ID is required');
  }

  if (!credit.projectId) {
    errors.push('Project ID is required');
  }

  if (!credit.ownerId) {
    errors.push('Owner ID is required');
  }

  if (!credit.quantity || credit.quantity <= 0) {
    errors.push('Quantity must be positive');
  }

  if (!credit.vintage || credit.vintage < 2000 || credit.vintage > 2100) {
    errors.push('Vintage must be between 2000 and 2100');
  }

  if (!credit.status || !Object.values(CreditStatus).includes(credit.status)) {
    errors.push('Valid status is required');
  }

  return errors;
}
