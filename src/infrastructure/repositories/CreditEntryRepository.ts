import { Pool, PoolClient } from 'pg';
import { CreditEntry, CreditStatus } from '../../domain/entities/CreditEntry';
import { ICreditEntryRepository } from '../../domain/repositories/ICreditEntryRepository';
import { CreditFilters, PaginationOptions } from '../../application/services/CreditService';
import { database } from '../../config/database';
import { logger } from '../../utils/logger';

export class CreditEntryRepository implements ICreditEntryRepository {
  private pool: Pool;

  constructor() {
    this.pool = database.getPool();
  }

  async findById(id: string): Promise<CreditEntry | null> {
    const query = `
      SELECT 
        id, credit_id, project_id, owner_id, quantity, vintage, status,
        issued_at, last_action_at, created_at, updated_at,
        policy_id, asset_name, mint_tx_hash, token_metadata
      FROM credit_entries 
      WHERE id = $1
    `;

    try {
      const result = await this.pool.query(query, [id]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToCreditEntry(result.rows[0]);
    } catch (error) {
      logger.error('Error finding credit entry by ID', { error, id });
      throw error;
    }
  }

  async findByCreditId(creditId: string): Promise<CreditEntry | null> {
    const query = `
      SELECT 
        id, credit_id, project_id, owner_id, quantity, vintage, status,
        issued_at, last_action_at, created_at, updated_at,
        policy_id, asset_name, mint_tx_hash, token_metadata
      FROM credit_entries 
      WHERE credit_id = $1
    `;

    try {
      const result = await this.pool.query(query, [creditId]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToCreditEntry(result.rows[0]);
    } catch (error) {
      logger.error('Error finding credit entry by credit ID', { error, creditId });
      throw error;
    }
  }

  async findByOwner(
    ownerId: string,
    filters?: CreditFilters,
    pagination?: PaginationOptions
  ): Promise<CreditEntry[]> {
    let query = `
      SELECT 
        id, credit_id, project_id, owner_id, quantity, vintage, status,
        issued_at, last_action_at, created_at, updated_at,
        policy_id, asset_name, mint_tx_hash, token_metadata
      FROM credit_entries 
      WHERE owner_id = $1
    `;

    const params: (string | number | undefined)[] = [ownerId];
    let paramIndex = 2;

    // Apply filters
    if (filters?.status) {
      query += ` AND status = $${paramIndex}`;
      params.push(filters.status);
      paramIndex++;
    }

    if (filters?.vintage) {
      query += ` AND vintage = $${paramIndex}`;
      params.push(filters.vintage);
      paramIndex++;
    }

    // Apply sorting - SECURITY FIX: Whitelist allowed columns to prevent SQL injection
    const ALLOWED_SORT_COLUMNS = ['created_at', 'updated_at', 'issued_at', 'quantity', 'status', 'vintage', 'id'];
    const sortBy = pagination?.sortBy && ALLOWED_SORT_COLUMNS.includes(pagination.sortBy)
      ? pagination.sortBy
      : 'created_at';
    const sortOrder = pagination?.sortOrder?.toLowerCase() === 'asc' ? 'asc' : 'desc';
    query += ` ORDER BY ${sortBy} ${sortOrder}`;

    // Apply pagination - SECURITY FIX: Validate limit to prevent memory exhaustion
    const limit = pagination?.limit && pagination.limit > 0 && pagination.limit <= 100
      ? pagination.limit
      : 20;
    query += ` LIMIT $${paramIndex}`;
    params.push(limit);
    paramIndex++;

    if (pagination?.cursor) {
      // Cursor-based pagination implementation would go here
      // For now, using simple offset
      if (pagination?.offset) {
        query += ` OFFSET $${paramIndex}`;
        params.push(pagination.offset);
      }
    }

    try {
      const result = await this.pool.query(query, params);
      return result.rows.map((row) => this.mapRowToCreditEntry(row));
    } catch (error) {
      logger.error('Error finding credit entries by owner', {
        error,
        ownerId,
        filters,
        pagination,
      });
      throw error;
    }
  }

  async findByProject(projectId: string): Promise<CreditEntry[]> {
    const query = `
      SELECT 
        id, credit_id, project_id, owner_id, quantity, vintage, status,
        issued_at, last_action_at, created_at, updated_at,
        policy_id, asset_name, mint_tx_hash, token_metadata
      FROM credit_entries 
      WHERE project_id = $1
      ORDER BY created_at DESC
    `;

    try {
      const result = await this.pool.query(query, [projectId]);
      return result.rows.map((row) => this.mapRowToCreditEntry(row));
    } catch (error) {
      logger.error('Error finding credit entries by project', { error, projectId });
      throw error;
    }
  }

  async save(creditEntry: CreditEntry): Promise<CreditEntry> {
    const query = `
      INSERT INTO credit_entries (
        id, credit_id, project_id, owner_id, quantity, vintage, status,
        issued_at, last_action_at, created_at, updated_at,
        policy_id, asset_name, mint_tx_hash, token_metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING 
        id, credit_id, project_id, owner_id, quantity, vintage, status,
        issued_at, last_action_at, created_at, updated_at,
        policy_id, asset_name, mint_tx_hash, token_metadata
    `;

    const params = [
      creditEntry.id,
      creditEntry.creditId,
      creditEntry.projectId,
      creditEntry.ownerId,
      creditEntry.quantity,
      creditEntry.vintage,
      creditEntry.status,
      creditEntry.issuedAt,
      creditEntry.lastActionAt,
      creditEntry.createdAt,
      creditEntry.updatedAt,
      creditEntry.policyId || null,
      creditEntry.assetName || null,
      creditEntry.mintTxHash || null,
      creditEntry.tokenMetadata ? JSON.stringify(creditEntry.tokenMetadata) : null,
    ];

    try {
      const result = await this.pool.query(query, params);
      return this.mapRowToCreditEntry(result.rows[0]);
    } catch (error) {
      logger.error('Error saving credit entry', { error, creditEntry });
      throw error;
    }
  }

  async update(creditEntry: CreditEntry): Promise<CreditEntry> {
    const query = `
      UPDATE credit_entries 
      SET 
        owner_id = $2,
        quantity = $3,
        status = $4,
        last_action_at = $5,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING 
        id, credit_id, project_id, owner_id, quantity, vintage, status,
        issued_at, last_action_at, created_at, updated_at
    `;

    const params = [
      creditEntry.id,
      creditEntry.ownerId,
      creditEntry.quantity,
      creditEntry.status,
      creditEntry.lastActionAt,
    ];

    try {
      const result = await this.pool.query(query, params);

      if (result.rows.length === 0) {
        throw new Error('Credit entry not found');
      }

      return this.mapRowToCreditEntry(result.rows[0]);
    } catch (error) {
      logger.error('Error updating credit entry', { error, creditEntry });
      throw error;
    }
  }

  async lockForUpdate(id: string): Promise<CreditEntry | null> {
    const query = `
      SELECT 
        id, credit_id, project_id, owner_id, quantity, vintage, status,
        issued_at, last_action_at, created_at, updated_at,
        policy_id, asset_name, mint_tx_hash, token_metadata
      FROM credit_entries 
      WHERE id = $1
      FOR UPDATE
    `;

    try {
      const result = await this.pool.query(query, [id]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToCreditEntry(result.rows[0]);
    } catch (error) {
      logger.error('Error locking credit entry for update', { error, id });
      throw error;
    }
  }

  async getNextCreditSequence(projectId: string, vintage: number): Promise<number> {
    const query = `
      SELECT COALESCE(MAX(
        CAST(SUBSTRING(credit_id FROM 'KRB-[0-9]{4}-[0-9]{3}-([0-9]{6})') AS INTEGER)
      ), 0) + 1 as next_sequence
      FROM credit_entries 
      WHERE project_id = $1 AND vintage = $2
    `;

    try {
      const result = await this.pool.query(query, [projectId, vintage]);
      return result.rows[0].next_sequence || 1;
    } catch (error) {
      logger.error('Error getting next credit sequence', { error, projectId, vintage });
      throw error;
    }
  }

  async getProjectSequence(projectId: string): Promise<number> {
    // Get the project's creation date first
    const projectQuery = `
      SELECT created_at FROM projects WHERE id = $1
    `;

    const projectResult = await this.pool.query(projectQuery, [projectId]);
    if (!projectResult.rows[0]) {
      throw new Error(`Project ${projectId} not found`);
    }

    const projectCreatedAt = projectResult.rows[0].created_at;

    // Count projects created before or at the same time as this project
    const query = `
      SELECT COUNT(*) + 1 as sequence
      FROM projects 
      WHERE created_at <= $1
    `;

    try {
      const result = await this.pool.query(query, [projectCreatedAt]);
      const sequence = parseInt(result.rows[0]?.sequence || '1', 10);
      return sequence;
    } catch (error) {
      logger.error('Error getting project sequence', { error, projectId });
      // Fallback: use a hash of the project ID to generate a sequence
      const hash = projectId.split('').reduce((a, b) => {
        a = (a << 5) - a + b.charCodeAt(0);
        return a & a;
      }, 0);
      return (Math.abs(hash) % 999) + 1; // Ensure 3-digit sequence
    }
  }

  async findAll(filters?: CreditFilters, pagination?: PaginationOptions): Promise<CreditEntry[]> {
    let query = `
      SELECT 
        id, credit_id, project_id, owner_id, quantity, vintage, status,
        issued_at, last_action_at, created_at, updated_at,
        policy_id, asset_name, mint_tx_hash, token_metadata
      FROM credit_entries 
      WHERE 1=1
    `;

    const params: unknown[] = [];
    let paramIndex = 1;

    // Apply filters
    if (filters?.ownerId) {
      query += ` AND owner_id = $${paramIndex}`;
      params.push(filters.ownerId);
      paramIndex++;
    }

    if (filters?.projectId) {
      query += ` AND project_id = $${paramIndex}`;
      params.push(filters.projectId);
      paramIndex++;
    }

    if (filters?.status) {
      query += ` AND status = $${paramIndex}`;
      params.push(filters.status);
      paramIndex++;
    }

    if (filters?.vintage) {
      query += ` AND vintage = $${paramIndex}`;
      params.push(filters.vintage);
      paramIndex++;
    }

    // Apply sorting - SECURITY FIX: Whitelist allowed columns to prevent SQL injection
    const ALLOWED_SORT_COLUMNS = ['created_at', 'updated_at', 'issued_at', 'quantity', 'status', 'vintage', 'id'];
    const sortBy = pagination?.sortBy && ALLOWED_SORT_COLUMNS.includes(pagination.sortBy)
      ? pagination.sortBy
      : 'created_at';
    const sortOrder = pagination?.sortOrder?.toLowerCase() === 'asc' ? 'asc' : 'desc';
    query += ` ORDER BY ${sortBy} ${sortOrder}`;

    // Apply pagination - SECURITY FIX: Validate limit to prevent memory exhaustion
    const limit = pagination?.limit && pagination.limit > 0 && pagination.limit <= 100
      ? pagination.limit
      : 20;
    query += ` LIMIT $${paramIndex}`;
    params.push(limit);
    paramIndex++;

    if (pagination?.cursor) {
      // Cursor-based pagination implementation would go here
      // For now, using simple offset
      if (pagination?.offset) {
        query += ` OFFSET $${paramIndex}`;
        params.push(pagination.offset);
      }
    }

    try {
      const result = await this.pool.query(query, params);
      return result.rows.map((row) => this.mapRowToCreditEntry(row));
    } catch (error) {
      logger.error('Error finding all credit entries', {
        error,
        filters,
        pagination,
      });
      throw error;
    }
  }

  async count(filters?: CreditFilters): Promise<number> {
    let query = 'SELECT COUNT(*) as count FROM credit_entries WHERE 1=1';
    const params: unknown[] = [];
    let paramIndex = 1;

    if (filters?.ownerId) {
      query += ` AND owner_id = $${paramIndex}`;
      params.push(filters.ownerId);
      paramIndex++;
    }

    if (filters?.projectId) {
      query += ` AND project_id = $${paramIndex}`;
      params.push(filters.projectId);
      paramIndex++;
    }

    if (filters?.status) {
      query += ` AND status = $${paramIndex}`;
      params.push(filters.status);
      paramIndex++;
    }

    if (filters?.vintage) {
      query += ` AND vintage = $${paramIndex}`;
      params.push(filters.vintage);
      paramIndex++;
    }

    try {
      const result = await this.pool.query(query, params);
      return parseInt(result.rows[0].count);
    } catch (error) {
      logger.error('Error counting credit entries', { error, filters });
      throw error;
    }
  }

  async getClient(): Promise<PoolClient> {
    return await this.pool.connect();
  }

  async lockForUpdateWithClient(client: PoolClient, id: string): Promise<CreditEntry | null> {
    const query = `
      SELECT 
        id, credit_id, project_id, owner_id, quantity, vintage, status,
        issued_at, last_action_at, created_at, updated_at,
        policy_id, asset_name, mint_tx_hash, token_metadata
      FROM credit_entries 
      WHERE id = $1
      FOR UPDATE
    `;

    try {
      const result = await client.query(query, [id]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToCreditEntry(result.rows[0]);
    } catch (error) {
      logger.error('Error locking credit entry for update with client', { error, id });
      throw error;
    }
  }

  async updateWithClient(client: PoolClient, creditEntry: CreditEntry): Promise<CreditEntry> {
    const query = `
      UPDATE credit_entries 
      SET 
        owner_id = $2,
        quantity = $3,
        status = $4,
        last_action_at = $5,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING 
        id, credit_id, project_id, owner_id, quantity, vintage, status,
        issued_at, last_action_at, created_at, updated_at
    `;

    const params = [
      creditEntry.id,
      creditEntry.ownerId,
      creditEntry.quantity,
      creditEntry.status,
      creditEntry.lastActionAt,
    ];

    try {
      const result = await client.query(query, params);

      if (result.rows.length === 0) {
        throw new Error('Credit entry not found');
      }

      return this.mapRowToCreditEntry(result.rows[0]);
    } catch (error) {
      logger.error('Error updating credit entry with client', { error, creditEntry });
      throw error;
    }
  }

  private mapRowToCreditEntry(row: Record<string, unknown>): CreditEntry {
    // Handle token_metadata - could be string (TEXT/JSON) or already parsed object (JSONB)
    let tokenMetadata: Record<string, unknown> | undefined;
    if (row.token_metadata) {
      if (typeof row.token_metadata === 'string') {
        tokenMetadata = JSON.parse(row.token_metadata) as Record<string, unknown>;
      } else if (typeof row.token_metadata === 'object' && row.token_metadata !== null) {
        tokenMetadata = row.token_metadata as Record<string, unknown>;
      }
    }

    return {
      id: String(row.id),
      creditId: String(row.credit_id),
      projectId: String(row.project_id),
      ownerId: String(row.owner_id),
      quantity: parseFloat(String(row.quantity)),
      vintage: Number(row.vintage),
      status: row.status as CreditStatus,
      issuedAt: new Date(row.issued_at as string | Date),
      lastActionAt: new Date(row.last_action_at as string | Date),
      createdAt: new Date(row.created_at as string | Date),
      updatedAt: new Date(row.updated_at as string | Date),
      policyId: row.policy_id ? String(row.policy_id) : undefined,
      assetName: row.asset_name ? String(row.asset_name) : undefined,
      mintTxHash: row.mint_tx_hash ? String(row.mint_tx_hash) : undefined,
      tokenMetadata,
    };
  }
}
