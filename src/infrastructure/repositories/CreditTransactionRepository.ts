import { Pool, PoolClient } from 'pg';
import {
  CreditTransaction,
  TransactionType,
  TransactionStatus,
} from '../../domain/entities/CreditTransaction';
import { ICreditTransactionRepository } from '../../domain/repositories/ICreditTransactionRepository';
import { database } from '../../config/database';
import { logger } from '../../utils/logger';
import { PaginationOptions } from '../../application/services/CreditService';

export class CreditTransactionRepository implements ICreditTransactionRepository {
  private pool: Pool;

  constructor() {
    this.pool = database.getPool();
  }

  async findById(id: string): Promise<CreditTransaction | null> {
    const query = `
      SELECT 
        id, credit_id, transaction_type, sender_id, recipient_id, quantity, 
        status, blockchain_tx_hash, metadata, created_at, completed_at
      FROM credit_transactions 
      WHERE id = $1
    `;

    try {
      const result = await this.pool.query(query, [id]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToCreditTransaction(result.rows[0]);
    } catch (error) {
      logger.error('Error finding credit transaction by ID', { error, id });
      throw error;
    }
  }

  async findByCreditId(creditId: string): Promise<CreditTransaction[]> {
    const query = `
      SELECT 
        id, credit_id, transaction_type, sender_id, recipient_id, quantity, 
        status, blockchain_tx_hash, metadata, created_at, completed_at
      FROM credit_transactions 
      WHERE credit_id = $1
      ORDER BY created_at DESC
    `;

    try {
      const result = await this.pool.query(query, [creditId]);
      return result.rows.map((row) => this.mapRowToCreditTransaction(row));
    } catch (error) {
      logger.error('Error finding credit transactions by credit ID', { error, creditId });
      throw error;
    }
  }

  async findBySender(
    senderId: string,
    filters?: Record<string, unknown>,
    pagination?: PaginationOptions
  ): Promise<CreditTransaction[]> {
    let query = `
      SELECT 
        id, credit_id, transaction_type, sender_id, recipient_id, quantity, 
        status, blockchain_tx_hash, metadata, created_at, completed_at
      FROM credit_transactions 
      WHERE sender_id = $1
    `;

    const params: (string | number | undefined)[] = [senderId];
    let paramIndex = 2;

    // Apply filters
    if (filters?.transactionType) {
      query += ` AND transaction_type = $${paramIndex}`;
      params.push(filters.transactionType as string);
      paramIndex++;
    }

    if (filters?.status) {
      query += ` AND status = $${paramIndex}`;
      params.push(filters.status as string);
      paramIndex++;
    }

    // Apply sorting - SECURITY FIX: Whitelist allowed columns to prevent SQL injection
    const ALLOWED_SORT_COLUMNS = ['created_at', 'updated_at', 'completed_at', 'quantity', 'status', 'transaction_type', 'id'];
    const sortBy = pagination?.sortBy && ALLOWED_SORT_COLUMNS.includes(pagination.sortBy)
      ? pagination.sortBy
      : 'created_at';
    const sortOrder = pagination?.sortOrder?.toLowerCase() === 'asc' ? 'asc' : 'desc';
    query += ` ORDER BY ${sortBy} ${sortOrder}`;

    // Apply pagination - SECURITY FIX: Validate limit to prevent memory exhaustion
    const limit = pagination?.limit && pagination.limit > 0 && pagination.limit <= 100
      ? pagination.limit
      : 20;
    if (limit) {
      query += ` LIMIT $${paramIndex}`;
      params.push(limit);
      paramIndex++;
    }

    if (pagination?.offset) {
      query += ` OFFSET $${paramIndex}`;
      params.push(pagination.offset);
    }

    try {
      const result = await this.pool.query(query, params);
      return result.rows.map((row) => this.mapRowToCreditTransaction(row));
    } catch (error) {
      logger.error('Error finding credit transactions by sender', {
        error,
        senderId,
        filters,
        pagination,
      });
      throw error;
    }
  }

  async findByRecipient(
    recipientId: string,
    filters?: Record<string, unknown>,
    pagination?: PaginationOptions
  ): Promise<CreditTransaction[]> {
    let query = `
      SELECT 
        id, credit_id, transaction_type, sender_id, recipient_id, quantity, 
        status, blockchain_tx_hash, metadata, created_at, completed_at
      FROM credit_transactions 
      WHERE recipient_id = $1
    `;

    const params: (string | number | undefined)[] = [recipientId];
    let paramIndex = 2;

    // Apply filters
    if (filters?.transactionType) {
      query += ` AND transaction_type = $${paramIndex}`;
      params.push(filters.transactionType as string);
      paramIndex++;
    }

    if (filters?.status) {
      query += ` AND status = $${paramIndex}`;
      params.push(filters.status as string);
      paramIndex++;
    }

    // Apply sorting - SECURITY FIX: Whitelist allowed columns to prevent SQL injection
    const ALLOWED_SORT_COLUMNS = ['created_at', 'updated_at', 'completed_at', 'quantity', 'status', 'transaction_type', 'id'];
    const sortBy = pagination?.sortBy && ALLOWED_SORT_COLUMNS.includes(pagination.sortBy)
      ? pagination.sortBy
      : 'created_at';
    const sortOrder = pagination?.sortOrder?.toLowerCase() === 'asc' ? 'asc' : 'desc';
    query += ` ORDER BY ${sortBy} ${sortOrder}`;

    // Apply pagination - SECURITY FIX: Validate limit to prevent memory exhaustion
    const limit = pagination?.limit && pagination.limit > 0 && pagination.limit <= 100
      ? pagination.limit
      : 20;
    if (limit) {
      query += ` LIMIT $${paramIndex}`;
      params.push(limit);
      paramIndex++;
    }

    if (pagination?.offset) {
      query += ` OFFSET $${paramIndex}`;
      params.push(pagination.offset);
    }

    try {
      const result = await this.pool.query(query, params);
      return result.rows.map((row) => this.mapRowToCreditTransaction(row));
    } catch (error) {
      logger.error('Error finding credit transactions by recipient', {
        error,
        recipientId,
        filters,
        pagination,
      });
      throw error;
    }
  }

  async findByType(
    transactionType: string,
    filters?: Record<string, unknown>,
    pagination?: PaginationOptions
  ): Promise<CreditTransaction[]> {
    let query = `
      SELECT 
        id, credit_id, transaction_type, sender_id, recipient_id, quantity, 
        status, blockchain_tx_hash, metadata, created_at, completed_at
      FROM credit_transactions 
      WHERE transaction_type = $1
    `;

    const params: (string | number | undefined)[] = [transactionType];
    let paramIndex = 2;

    // Apply filters
    if (filters?.status) {
      query += ` AND status = $${paramIndex}`;
      params.push(filters.status as string);
      paramIndex++;
    }

    if (filters?.senderId) {
      query += ` AND sender_id = $${paramIndex}`;
      params.push(filters.senderId as string);
      paramIndex++;
    }

    if (filters?.recipientId) {
      query += ` AND recipient_id = $${paramIndex}`;
      params.push(filters.recipientId as string);
      paramIndex++;
    }

    // Apply sorting - SECURITY FIX: Whitelist allowed columns to prevent SQL injection
    const ALLOWED_SORT_COLUMNS = ['created_at', 'updated_at', 'completed_at', 'quantity', 'status', 'transaction_type', 'id'];
    const sortBy = pagination?.sortBy && ALLOWED_SORT_COLUMNS.includes(pagination.sortBy)
      ? pagination.sortBy
      : 'created_at';
    const sortOrder = pagination?.sortOrder?.toLowerCase() === 'asc' ? 'asc' : 'desc';
    query += ` ORDER BY ${sortBy} ${sortOrder}`;

    // Apply pagination - SECURITY FIX: Validate limit to prevent memory exhaustion
    const limit = pagination?.limit && pagination.limit > 0 && pagination.limit <= 100
      ? pagination.limit
      : 20;
    if (limit) {
      query += ` LIMIT $${paramIndex}`;
      params.push(limit);
      paramIndex++;
    }

    if (pagination?.offset) {
      query += ` OFFSET $${paramIndex}`;
      params.push(pagination.offset);
    }

    try {
      const result = await this.pool.query(query, params);
      return result.rows.map((row) => this.mapRowToCreditTransaction(row));
    } catch (error) {
      logger.error('Error finding credit transactions by type', {
        error,
        transactionType,
        filters,
        pagination,
      });
      throw error;
    }
  }

  async save(creditTransaction: CreditTransaction): Promise<CreditTransaction> {
    const query = `
      INSERT INTO credit_transactions (
        id, credit_id, transaction_type, sender_id, recipient_id, quantity, 
        status, blockchain_tx_hash, metadata, created_at, completed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING 
        id, credit_id, transaction_type, sender_id, recipient_id, quantity, 
        status, blockchain_tx_hash, metadata, created_at, completed_at
    `;

    const params = [
      creditTransaction.id,
      creditTransaction.creditId,
      creditTransaction.transactionType,
      creditTransaction.senderId || null,
      creditTransaction.recipientId || null,
      creditTransaction.quantity,
      creditTransaction.status,
      creditTransaction.blockchainTxHash || null,
      creditTransaction.metadata ? JSON.stringify(creditTransaction.metadata) : null,
      creditTransaction.createdAt,
      creditTransaction.completedAt || null,
    ];

    try {
      const result = await this.pool.query(query, params);
      return this.mapRowToCreditTransaction(result.rows[0]);
    } catch (error) {
      logger.error('Error saving credit transaction', { error, creditTransaction });
      throw error;
    }
  }

  async update(creditTransaction: CreditTransaction): Promise<CreditTransaction> {
    const query = `
      UPDATE credit_transactions 
      SET 
        status = $2,
        blockchain_tx_hash = $3,
        metadata = $4,
        completed_at = $5
      WHERE id = $1
      RETURNING 
        id, credit_id, transaction_type, sender_id, recipient_id, quantity, 
        status, blockchain_tx_hash, metadata, created_at, completed_at
    `;

    const params = [
      creditTransaction.id,
      creditTransaction.status,
      creditTransaction.blockchainTxHash || null,
      creditTransaction.metadata ? JSON.stringify(creditTransaction.metadata) : null,
      creditTransaction.completedAt || null,
    ];

    try {
      const result = await this.pool.query(query, params);

      if (result.rows.length === 0) {
        throw new Error('Credit transaction not found');
      }

      return this.mapRowToCreditTransaction(result.rows[0]);
    } catch (error) {
      logger.error('Error updating credit transaction', { error, creditTransaction });
      throw error;
    }
  }

  async count(filters?: Record<string, unknown>): Promise<number> {
    let query = 'SELECT COUNT(*) as count FROM credit_transactions WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (filters?.creditId) {
      query += ` AND credit_id = $${paramIndex}`;
      params.push(filters.creditId);
      paramIndex++;
    }

    if (filters?.transactionType) {
      query += ` AND transaction_type = $${paramIndex}`;
      params.push(filters.transactionType);
      paramIndex++;
    }

    if (filters?.senderId) {
      query += ` AND sender_id = $${paramIndex}`;
      params.push(filters.senderId);
      paramIndex++;
    }

    if (filters?.recipientId) {
      query += ` AND recipient_id = $${paramIndex}`;
      params.push(filters.recipientId);
      paramIndex++;
    }

    if (filters?.status) {
      query += ` AND status = $${paramIndex}`;
      params.push(filters.status);
      paramIndex++;
    }

    try {
      const result = await this.pool.query(query, params);
      return parseInt(result.rows[0].count);
    } catch (error) {
      logger.error('Error counting credit transactions', { error, filters });
      throw error;
    }
  }

  async saveWithClient(
    client: PoolClient,
    creditTransaction: CreditTransaction
  ): Promise<CreditTransaction> {
    const query = `
      INSERT INTO credit_transactions (
        id, credit_id, transaction_type, sender_id, recipient_id, quantity, 
        status, blockchain_tx_hash, metadata, created_at, completed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING 
        id, credit_id, transaction_type, sender_id, recipient_id, quantity, 
        status, blockchain_tx_hash, metadata, created_at, completed_at
    `;

    const params = [
      creditTransaction.id,
      creditTransaction.creditId,
      creditTransaction.transactionType,
      creditTransaction.senderId || null,
      creditTransaction.recipientId || null,
      creditTransaction.quantity,
      creditTransaction.status,
      creditTransaction.blockchainTxHash || null,
      creditTransaction.metadata ? JSON.stringify(creditTransaction.metadata) : null,
      creditTransaction.createdAt,
      creditTransaction.completedAt || null,
    ];

    try {
      const result = await client.query(query, params);
      return this.mapRowToCreditTransaction(result.rows[0]);
    } catch (error) {
      logger.error('Error saving credit transaction with client', { error, creditTransaction });
      throw error;
    }
  }

  private mapRowToCreditTransaction(row: Record<string, unknown>): CreditTransaction {
    return {
      id: row.id as string,
      creditId: row.credit_id as string,
      transactionType: row.transaction_type as TransactionType,
      senderId: row.sender_id as string | undefined,
      recipientId: row.recipient_id as string | undefined,
      quantity: parseFloat(row.quantity as string),
      status: row.status as TransactionStatus,
      blockchainTxHash: row.blockchain_tx_hash as string | undefined,
      metadata: row.metadata
        ? typeof row.metadata === 'string'
          ? JSON.parse(row.metadata)
          : row.metadata
        : undefined,
      createdAt: new Date(row.created_at as string),
      completedAt: row.completed_at ? new Date(row.completed_at as string) : undefined,
    };
  }
}
