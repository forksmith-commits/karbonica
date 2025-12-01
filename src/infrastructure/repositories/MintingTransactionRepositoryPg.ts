import { Pool } from 'pg';
import { MintingTransaction, MintingOperationType } from '../../domain/entities/MintingTransaction';
import { MintingTransactionRepository } from '../../domain/repositories/IMintingTransactionRepository';
import { database } from '../../config/database';
import { logger } from '../../utils/logger';

// Type definitions for query options
interface FindOptions {
  where?: Record<string, unknown>;
  order?: Record<string, 'ASC' | 'DESC'>;
}

interface DatabaseRow {
  id: string;
  projectId: string;
  policyId: string;
  assetName: string;
  quantity: string;
  operation: string;
  txHash: string;
  metadata: string | Record<string, unknown> | null;
  policyScript: string | Record<string, unknown>;
  createdAt: Date | string;
  updatedAt: Date | string;
}

/**
 * PostgreSQL-based implementation of MintingTransactionRepository
 * Uses raw SQL queries similar to other repositories in this codebase
 * Note: This implements only the methods we need, not the full TypeORM Repository interface
 */
export class MintingTransactionRepositoryPg implements MintingTransactionRepository {
  private pool: Pool;

  constructor() {
    this.pool = database.getPool();
  }

  async findById(id: string): Promise<MintingTransaction | null> {
    const query = `
      SELECT 
        id, project_id as "projectId", policy_id as "policyId", 
        asset_name as "assetName", quantity, operation, tx_hash as "txHash",
        metadata, policy_script as "policyScript",
        created_at as "createdAt", updated_at as "updatedAt"
      FROM minting_transactions 
      WHERE id = $1
    `;

    try {
      const result = await this.pool.query(query, [id]);
      if (result.rows.length === 0) {
        return null;
      }
      return this.mapRowToMintingTransaction(result.rows[0]);
    } catch (error) {
      logger.error('Error finding minting transaction by ID', { error, id });
      throw error;
    }
  }

  async findByProjectId(projectId: string): Promise<MintingTransaction[]> {
    const query = `
      SELECT 
        id, project_id as "projectId", policy_id as "policyId", 
        asset_name as "assetName", quantity, operation, tx_hash as "txHash",
        metadata, policy_script as "policyScript",
        created_at as "createdAt", updated_at as "updatedAt"
      FROM minting_transactions 
      WHERE project_id = $1
      ORDER BY created_at DESC
    `;

    try {
      const result = await this.pool.query(query, [projectId]);
      return result.rows.map((row) => this.mapRowToMintingTransaction(row));
    } catch (error) {
      logger.error('Error finding minting transactions by project ID', { error, projectId });
      throw error;
    }
  }

  async findByPolicyId(policyId: string): Promise<MintingTransaction[]> {
    const query = `
      SELECT 
        id, project_id as "projectId", policy_id as "policyId", 
        asset_name as "assetName", quantity, operation, tx_hash as "txHash",
        metadata, policy_script as "policyScript",
        created_at as "createdAt", updated_at as "updatedAt"
      FROM minting_transactions 
      WHERE policy_id = $1
      ORDER BY created_at DESC
    `;

    try {
      const result = await this.pool.query(query, [policyId]);
      return result.rows.map((row) => this.mapRowToMintingTransaction(row));
    } catch (error) {
      logger.error('Error finding minting transactions by policy ID', { error, policyId });
      throw error;
    }
  }

  async findByTxHash(txHash: string): Promise<MintingTransaction | null> {
    const query = `
      SELECT 
        id, project_id as "projectId", policy_id as "policyId", 
        asset_name as "assetName", quantity, operation, tx_hash as "txHash",
        metadata, policy_script as "policyScript",
        created_at as "createdAt", updated_at as "updatedAt"
      FROM minting_transactions 
      WHERE tx_hash = $1
    `;

    try {
      const result = await this.pool.query(query, [txHash]);
      if (result.rows.length === 0) {
        return null;
      }
      return this.mapRowToMintingTransaction(result.rows[0]);
    } catch (error) {
      logger.error('Error finding minting transaction by tx hash', { error, txHash });
      throw error;
    }
  }

  async find(options?: FindOptions): Promise<MintingTransaction[]> {
    let query = `
      SELECT 
        id, project_id as "projectId", policy_id as "policyId", 
        asset_name as "assetName", quantity, operation, tx_hash as "txHash",
        metadata, policy_script as "policyScript",
        created_at as "createdAt", updated_at as "updatedAt"
      FROM minting_transactions
    `;
    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (options?.where) {
      for (const [key, value] of Object.entries(options.where)) {
        const columnName = this.camelToSnake(key);
        conditions.push(`${columnName} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    // SECURITY FIX: Whitelist allowed columns and directions to prevent SQL injection
    if (options?.order) {
      const ALLOWED_COLUMNS = ['id', 'project_id', 'policy_id', 'asset_name', 'quantity', 'operation', 'tx_hash', 'metadata', 'policy_script', 'created_at', 'updated_at'];
      const ALLOWED_DIRECTIONS = ['asc', 'desc', 'ASC', 'DESC'];

      const orderClauses = Object.entries(options.order)
        .filter(([key, direction]) => {
          const snakeKey = this.camelToSnake(key);
          return ALLOWED_COLUMNS.includes(snakeKey) &&
                 ALLOWED_DIRECTIONS.includes(direction.toString());
        })
        .map(([key, direction]) => `${this.camelToSnake(key)} ${direction}`);

      if (orderClauses.length > 0) {
        query += ` ORDER BY ${orderClauses.join(', ')}`;
      }
    }

    try {
      const result = await this.pool.query(query, values);
      return result.rows.map((row) => this.mapRowToMintingTransaction(row));
    } catch (error) {
      logger.error('Error finding minting transactions', { error, options });
      throw error;
    }
  }

  async findOne(options?: { where?: Record<string, unknown> }): Promise<MintingTransaction | null> {
    if (!options || !options.where) {
      return null;
    }

    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(options.where)) {
      const columnName = this.camelToSnake(key);
      conditions.push(`${columnName} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }

    const query = `
      SELECT 
        id, project_id as "projectId", policy_id as "policyId", 
        asset_name as "assetName", quantity, operation, tx_hash as "txHash",
        metadata, policy_script as "policyScript",
        created_at as "createdAt", updated_at as "updatedAt"
      FROM minting_transactions 
      WHERE ${conditions.join(' AND ')}
      LIMIT 1
    `;

    try {
      const result = await this.pool.query(query, values);
      if (result.rows.length === 0) {
        return null;
      }
      return this.mapRowToMintingTransaction(result.rows[0]);
    } catch (error) {
      logger.error('Error finding one minting transaction', { error, options });
      throw error;
    }
  }

  async save(mintingTx: MintingTransaction): Promise<MintingTransaction> {
    // Check if entity exists
    const existing = await this.findById(mintingTx.id);
    if (existing) {
      return this.update(mintingTx);
    } else {
      return this.insert(mintingTx);
    }
  }

  // Create entity object (doesn't save to database - use save() for that)
  create(entity: Partial<MintingTransaction>): MintingTransaction {
    const now = new Date();
    return {
      id: entity.id || this.generateUUID(),
      projectId: entity.projectId!,
      policyId: entity.policyId!,
      assetName: entity.assetName!,
      quantity: entity.quantity!,
      operation: entity.operation!,
      txHash: entity.txHash!,
      metadata: entity.metadata,
      policyScript: entity.policyScript!,
      createdAt: entity.createdAt || now,
      updatedAt: entity.updatedAt || now,
    };
  }

  // Internal method to actually insert into database
  private async insert(mintingTx: MintingTransaction): Promise<MintingTransaction> {
    const query = `
      INSERT INTO minting_transactions (
        id, project_id, policy_id, asset_name, quantity, operation, 
        tx_hash, metadata, policy_script, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING 
        id, project_id as "projectId", policy_id as "policyId", 
        asset_name as "assetName", quantity, operation, tx_hash as "txHash",
        metadata, policy_script as "policyScript",
        created_at as "createdAt", updated_at as "updatedAt"
    `;

    try {
      const result = await this.pool.query(query, [
        mintingTx.id,
        mintingTx.projectId,
        mintingTx.policyId,
        mintingTx.assetName,
        mintingTx.quantity,
        mintingTx.operation,
        mintingTx.txHash,
        mintingTx.metadata ? JSON.stringify(mintingTx.metadata) : null,
        mintingTx.policyScript ? JSON.stringify(mintingTx.policyScript) : null,
        mintingTx.createdAt,
        mintingTx.updatedAt,
      ]);

      return this.mapRowToMintingTransaction(result.rows[0]);
    } catch (error) {
      logger.error('Error inserting minting transaction', { error, mintingTx });
      throw error;
    }
  }

  async update(mintingTx: MintingTransaction): Promise<MintingTransaction> {
    const query = `
      UPDATE minting_transactions 
      SET 
        project_id = $2,
        policy_id = $3,
        asset_name = $4,
        quantity = $5,
        operation = $6,
        tx_hash = $7,
        metadata = $8,
        policy_script = $9,
        updated_at = NOW()
      WHERE id = $1
      RETURNING 
        id, project_id as "projectId", policy_id as "policyId", 
        asset_name as "assetName", quantity, operation, tx_hash as "txHash",
        metadata, policy_script as "policyScript",
        created_at as "createdAt", updated_at as "updatedAt"
    `;

    try {
      const result = await this.pool.query(query, [
        mintingTx.id,
        mintingTx.projectId,
        mintingTx.policyId,
        mintingTx.assetName,
        mintingTx.quantity,
        mintingTx.operation,
        mintingTx.txHash,
        mintingTx.metadata ? JSON.stringify(mintingTx.metadata) : null,
        mintingTx.policyScript ? JSON.stringify(mintingTx.policyScript) : null,
      ]);

      if (result.rows.length === 0) {
        throw new Error(`Minting transaction with id ${mintingTx.id} not found`);
      }

      return this.mapRowToMintingTransaction(result.rows[0]);
    } catch (error) {
      logger.error('Error updating minting transaction', { error, mintingTx });
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    const query = `DELETE FROM minting_transactions WHERE id = $1`;

    try {
      await this.pool.query(query, [id]);
    } catch (error) {
      logger.error('Error deleting minting transaction', { error, id });
      throw error;
    }
  }


  private mapRowToMintingTransaction(row: DatabaseRow): MintingTransaction {
    return {
      id: row.id,
      projectId: row.projectId,
      policyId: row.policyId,
      assetName: row.assetName,
      quantity: row.quantity,
      operation: row.operation as MintingOperationType,
      txHash: row.txHash,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
      policyScript: typeof row.policyScript === 'string' ? JSON.parse(row.policyScript) : row.policyScript,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }

  private camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
  }

  // SECURITY FIX: Use crypto.randomUUID() instead of Math.random()
  private generateUUID(): string {
    // Use Node.js built-in crypto.randomUUID() which is cryptographically secure
    return require('crypto').randomUUID();
  }
}

