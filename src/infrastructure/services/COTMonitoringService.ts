/**
 * COT Monitoring Service
 *
 * Tracks metrics and provides monitoring for COT operations
 * Provides insights into minting, transfer, and burning operations
 */

import { logger } from '../../utils/logger';

export interface COTMetrics {
  // Minting metrics
  totalMinted: number;
  mintingSuccessCount: number;
  mintingFailureCount: number;
  mintingSuccessRate: number;
  averageMintingTimeMs: number;

  // Transfer metrics
  totalTransferred: number;
  transferSuccessCount: number;
  transferFailureCount: number;
  transferSuccessRate: number;
  averageTransferTimeMs: number;

  // Burning metrics
  totalBurned: number;
  burningSuccessCount: number;
  burningFailureCount: number;
  burningSuccessRate: number;
  averageBurningTimeMs: number;

  // Overall metrics
  activeCOTs: number;
  totalOperations: number;
  overallSuccessRate: number;
}

interface OperationRecord {
  type: 'mint' | 'transfer' | 'burn';
  success: boolean;
  durationMs: number;
  timestamp: Date;
  creditId: string;
  error?: string;
}

export class COTMonitoringService {
  private operations: OperationRecord[] = [];
  private maxRecords = 10000; // Keep last 10k operations

  /**
   * Record a COT operation
   */
  recordOperation(
    type: 'mint' | 'transfer' | 'burn',
    success: boolean,
    durationMs: number,
    creditId: string,
    error?: string
  ): void {
    const record: OperationRecord = {
      type,
      success,
      durationMs,
      timestamp: new Date(),
      creditId,
      error,
    };

    this.operations.push(record);

    // Keep only last N records
    if (this.operations.length > this.maxRecords) {
      this.operations.shift();
    }

    // Log the operation
    if (success) {
      logger.info('COT operation recorded', {
        type,
        durationMs,
        creditId,
      });
    } else {
      logger.error('COT operation failure recorded', {
        type,
        durationMs,
        creditId,
        error,
      });
    }
  }

  /**
   * Get comprehensive metrics
   */
  getMetrics(): COTMetrics {
    const mintOps = this.operations.filter((op) => op.type === 'mint');
    const transferOps = this.operations.filter((op) => op.type === 'transfer');
    const burnOps = this.operations.filter((op) => op.type === 'burn');

    const mintSuccess = mintOps.filter((op) => op.success);
    const transferSuccess = transferOps.filter((op) => op.success);
    const burnSuccess = burnOps.filter((op) => op.success);

    const totalSuccess = mintSuccess.length + transferSuccess.length + burnSuccess.length;
    const totalOps = this.operations.length;

    return {
      // Minting
      totalMinted: mintSuccess.length,
      mintingSuccessCount: mintSuccess.length,
      mintingFailureCount: mintOps.length - mintSuccess.length,
      mintingSuccessRate: mintOps.length > 0 ? (mintSuccess.length / mintOps.length) * 100 : 0,
      averageMintingTimeMs:
        mintSuccess.length > 0
          ? mintSuccess.reduce((sum, op) => sum + op.durationMs, 0) / mintSuccess.length
          : 0,

      // Transfer
      totalTransferred: transferSuccess.length,
      transferSuccessCount: transferSuccess.length,
      transferFailureCount: transferOps.length - transferSuccess.length,
      transferSuccessRate:
        transferOps.length > 0 ? (transferSuccess.length / transferOps.length) * 100 : 0,
      averageTransferTimeMs:
        transferSuccess.length > 0
          ? transferSuccess.reduce((sum, op) => sum + op.durationMs, 0) / transferSuccess.length
          : 0,

      // Burning
      totalBurned: burnSuccess.length,
      burningSuccessCount: burnSuccess.length,
      burningFailureCount: burnOps.length - burnSuccess.length,
      burningSuccessRate: burnOps.length > 0 ? (burnSuccess.length / burnOps.length) * 100 : 0,
      averageBurningTimeMs:
        burnSuccess.length > 0
          ? burnSuccess.reduce((sum, op) => sum + op.durationMs, 0) / burnSuccess.length
          : 0,

      // Overall
      activeCOTs: mintSuccess.length - burnSuccess.length, // Minted - Burned
      totalOperations: totalOps,
      overallSuccessRate: totalOps > 0 ? (totalSuccess / totalOps) * 100 : 0,
    };
  }

  /**
   * Get recent failures
   */
  getRecentFailures(limit: number = 10): OperationRecord[] {
    return this.operations
      .filter((op) => !op.success)
      .slice(-limit)
      .reverse();
  }

  /**
   * Get operations for a specific credit
   */
  getCreditOperations(creditId: string): OperationRecord[] {
    return this.operations.filter((op) => op.creditId === creditId);
  }

  /**
   * Check if metrics indicate issues
   */
  getHealthStatus(): {
    healthy: boolean;
    issues: string[];
    warnings: string[];
  } {
    const metrics = this.getMetrics();
    const issues: string[] = [];
    const warnings: string[] = [];

    // Check success rates
    if (metrics.mintingSuccessRate < 90 && metrics.mintingSuccessCount > 10) {
      issues.push(`Low minting success rate: ${metrics.mintingSuccessRate.toFixed(1)}%`);
    } else if (metrics.mintingSuccessRate < 95 && metrics.mintingSuccessCount > 10) {
      warnings.push(`Minting success rate below 95%: ${metrics.mintingSuccessRate.toFixed(1)}%`);
    }

    if (metrics.transferSuccessRate < 90 && metrics.transferSuccessCount > 10) {
      issues.push(`Low transfer success rate: ${metrics.transferSuccessRate.toFixed(1)}%`);
    } else if (metrics.transferSuccessRate < 95 && metrics.transferSuccessCount > 10) {
      warnings.push(`Transfer success rate below 95%: ${metrics.transferSuccessRate.toFixed(1)}%`);
    }

    if (metrics.burningSuccessRate < 90 && metrics.burningSuccessCount > 10) {
      issues.push(`Low burning success rate: ${metrics.burningSuccessRate.toFixed(1)}%`);
    } else if (metrics.burningSuccessRate < 95 && metrics.burningSuccessCount > 10) {
      warnings.push(`Burning success rate below 95%: ${metrics.burningSuccessRate.toFixed(1)}%`);
    }

    // Check average times
    if (metrics.averageMintingTimeMs > 180000) {
      // 3 minutes
      warnings.push(`Slow minting: ${(metrics.averageMintingTimeMs / 1000).toFixed(1)}s average`);
    }

    if (metrics.averageTransferTimeMs > 180000) {
      warnings.push(
        `Slow transfers: ${(metrics.averageTransferTimeMs / 1000).toFixed(1)}s average`
      );
    }

    if (metrics.averageBurningTimeMs > 180000) {
      warnings.push(`Slow burning: ${(metrics.averageBurningTimeMs / 1000).toFixed(1)}s average`);
    }

    return {
      healthy: issues.length === 0,
      issues,
      warnings,
    };
  }

  /**
   * Clear all metrics (use with caution)
   */
  clearMetrics(): void {
    logger.warn('Clearing all COT metrics', {
      operationCount: this.operations.length,
    });
    this.operations = [];
  }

  /**
   * Export metrics for external monitoring systems
   */
  exportMetrics(): string {
    const metrics = this.getMetrics();

    // Prometheus-style metrics format
    return `
# HELP cot_minting_total Total number of COT tokens minted
# TYPE cot_minting_total counter
cot_minting_total ${metrics.totalMinted}

# HELP cot_minting_success_rate Success rate of minting operations
# TYPE cot_minting_success_rate gauge
cot_minting_success_rate ${metrics.mintingSuccessRate}

# HELP cot_transfer_total Total number of COT token transfers
# TYPE cot_transfer_total counter
cot_transfer_total ${metrics.totalTransferred}

# HELP cot_transfer_success_rate Success rate of transfer operations
# TYPE cot_transfer_success_rate gauge
cot_transfer_success_rate ${metrics.transferSuccessRate}

# HELP cot_burning_total Total number of COT tokens burned
# TYPE cot_burning_total counter
cot_burning_total ${metrics.totalBurned}

# HELP cot_burning_success_rate Success rate of burning operations
# TYPE cot_burning_success_rate gauge
cot_burning_success_rate ${metrics.burningSuccessRate}

# HELP cot_active_total Total number of active COT tokens
# TYPE cot_active_total gauge
cot_active_total ${metrics.activeCOTs}

# HELP cot_operations_total Total number of COT operations
# TYPE cot_operations_total counter
cot_operations_total ${metrics.totalOperations}

# HELP cot_overall_success_rate Overall success rate of all operations
# TYPE cot_overall_success_rate gauge
cot_overall_success_rate ${metrics.overallSuccessRate}
    `.trim();
  }
}

// Singleton instance
export const cotMonitoringService = new COTMonitoringService();
