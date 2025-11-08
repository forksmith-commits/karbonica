/**
 * COT (Carbon Offset Token) Metadata Service
 *
 * Generates CIP-25 compliant metadata for Carbon Offset Tokens
 * Requirements: COT minting, blockchain integration
 */

// TODO: Improve metadata generation

import { Project } from '../entities/Project';
import { CreditEntry } from '../entities/CreditEntry';

export interface COTMetadata {
  name: string;
  description: string;
  image?: string;
  project: {
    id: string;
    title: string;
    type: string;
    location: string;
    country: string;
  };
  credit: {
    serialNumber: string;
    quantity: number;
    vintage: number;
    issuedAt: string;
  };
  verification: {
    verificationId: string;
    verifiedAt: string;
    methodology?: string;
    standard?: string;
  };
  registry: {
    name: string;
    url: string;
    version: string;
  };
}

export class COTMetadataService {
  /**
   * Truncate string to fit within Cardano's 64-byte metadata limit
   * Cardano metadata strings have a maximum length of 64 bytes (UTF-8 encoded)
   */
  private truncateMetadataString(value: string, maxBytes: number = 64): string {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder('utf-8', { fatal: false });
    const bytes = encoder.encode(value);
    
    if (bytes.length <= maxBytes) {
      return value;
    }
    
    // Truncate to maxBytes, ensuring we don't break UTF-8 sequences
    let truncated = bytes.slice(0, maxBytes);
    // Remove any incomplete UTF-8 sequences at the end
    while (truncated.length > 0 && (truncated[truncated.length - 1] & 0xC0) === 0x80) {
      truncated = truncated.slice(0, -1);
    }
    
    return decoder.decode(truncated) + '...';
  }

  /**
   * Generate CIP-25 compliant metadata for a COT token
   * All string values must be <= 64 bytes to comply with Cardano metadata limits
   */
  generateCOTMetadata(credit: CreditEntry, project: Project, verificationId: string): COTMetadata {
    // Truncate project title for description to ensure it fits within 64 bytes
    const baseDescription = `COT: ${credit.quantity} tons CO2e`;
    const remainingBytes = 64 - new TextEncoder().encode(baseDescription).length - 3; // -3 for " - " separator
    const truncatedTitle = this.truncateMetadataString(project.title, Math.max(0, remainingBytes));
    const description = remainingBytes > 0 
      ? `${baseDescription} - ${truncatedTitle}`
      : baseDescription;
    
    return {
      name: this.truncateMetadataString(`Karbonica COT - ${credit.creditId}`),
      description: this.truncateMetadataString(description),
      image: this.truncateMetadataString(this.generateTokenImage(project)),
      project: {
        id: project.id,
        title: this.truncateMetadataString(project.title),
        type: this.truncateMetadataString(project.type || ''),
        location: this.truncateMetadataString(project.location || ''),
        country: this.truncateMetadataString(project.country || ''),
      },
      credit: {
        serialNumber: this.truncateMetadataString(credit.creditId),
        quantity: credit.quantity,
        vintage: credit.vintage,
        issuedAt: credit.issuedAt.toISOString(),
      },
      verification: {
        verificationId: this.truncateMetadataString(verificationId),
        verifiedAt: new Date().toISOString(),
        methodology: this.truncateMetadataString('VCS'), // TODO: Get from project
        standard: this.truncateMetadataString('Verra VCS'), // TODO: Get from project
      },
      registry: {
        name: this.truncateMetadataString('Karbonica'),
        url: this.truncateMetadataString('https://karbonica.io'),
        version: this.truncateMetadataString('1.0'),
      },
    };
  }

  /**
   * Format metadata for CIP-25 on-chain storage
   */
  formatForCIP25(metadata: COTMetadata, policyId: string, assetName: string): Record<string, unknown> {
    return {
      '721': {
        [policyId]: {
          [assetName]: metadata,
        },
      },
    };
  }

  /**
   * Generate token image URL (placeholder for now)
   * TODO: Integrate with IPFS or image generation service
   * Returns a short URL that fits within 64-byte limit
   */
  private generateTokenImage(project: Project): string {
    // Use a shorter URL format to fit within 64-byte limit
    // In production, this would be an IPFS hash or short URL
    // For now, use project ID hash to create shorter URL
    const shortId = project.id.substring(0, 8);
    return `https://karbonica.io/p/${shortId}`;
  }

  /**
   * Validate metadata completeness
   */
  validateMetadata(metadata: COTMetadata): string[] {
    const errors: string[] = [];

    if (!metadata.name) errors.push('Name is required');
    if (!metadata.description) errors.push('Description is required');
    if (!metadata.project?.id) errors.push('Project ID is required');
    if (!metadata.credit?.serialNumber) errors.push('Serial number is required');
    if (!metadata.credit?.quantity || metadata.credit.quantity <= 0) {
      errors.push('Valid quantity is required');
    }
    if (!metadata.verification?.verificationId) {
      errors.push('Verification ID is required');
    }

    return errors;
  }
}
