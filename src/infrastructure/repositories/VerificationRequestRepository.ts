import { Pool } from 'pg';
import { VerificationRequest, VerificationStatus } from '../../domain/entities/VerificationRequest';
import {
  IVerificationRequestRepository,
  VerificationFilters,
  PaginationOptions,
} from '../../domain/repositories/IVerificationRequestRepository';
import { database } from '../../config/database';

export class VerificationRequestRepository implements IVerificationRequestRepository {
  private pool: Pool;

  constructor() {
    this.pool = database.getPool();
  }

  async findById(id: string): Promise<VerificationRequest | null> {
    const query = `
      SELECT 
        id, project_id as "projectId", developer_id as "developerId",
        verifier_id as "verifierId", status, progress,
        submitted_at as "submittedAt", assigned_at as "assignedAt",
        completed_at as "completedAt", notes,
        created_at as "createdAt", updated_at as "updatedAt"
      FROM verification_requests
      WHERE id = $1
    `;

    const result = await this.pool.query(query, [id]);

    if (!result.rows[0]) {
      return null;
    }

    return this.mapRowToVerificationRequest(result.rows[0]);
  }

  async findByProject(projectId: string): Promise<VerificationRequest | null> {
    const query = `
      SELECT 
        id, project_id as "projectId", developer_id as "developerId",
        verifier_id as "verifierId", status, progress,
        submitted_at as "submittedAt", assigned_at as "assignedAt",
        completed_at as "completedAt", notes,
        created_at as "createdAt", updated_at as "updatedAt"
      FROM verification_requests
      WHERE project_id = $1
    `;

    const result = await this.pool.query(query, [projectId]);

    if (!result.rows[0]) {
      return null;
    }

    return this.mapRowToVerificationRequest(result.rows[0]);
  }

  async findByDeveloper(
    developerId: string,
    filters?: VerificationFilters,
    pagination?: PaginationOptions
  ): Promise<VerificationRequest[]> {
    const conditions: string[] = ['developer_id = $1'];
    const values: any[] = [developerId];
    let paramIndex = 2;

    if (filters?.status) {
      conditions.push(`status = $${paramIndex}`);
      values.push(filters.status);
      paramIndex++;
    }

    // SECURITY FIX: Whitelist allowed sort columns to prevent SQL injection
    const ALLOWED_SORT_COLUMNS = ['created_at', 'updated_at', 'submitted_at', 'assigned_at', 'completed_at', 'reviewed_at', 'status', 'id'];
    const sortBy = pagination?.sortBy && ALLOWED_SORT_COLUMNS.includes(pagination.sortBy)
      ? pagination.sortBy
      : 'created_at';

    const sortOrder = pagination?.sortOrder?.toLowerCase() === 'asc' ? 'asc' : 'desc';

    const limit = pagination?.limit && pagination.limit > 0 && pagination.limit <= 100
      ? pagination.limit
      : 20;

    // Cursor-based pagination
    if (pagination?.cursor) {
      const cursorCondition =
        sortOrder === 'desc' ? `${sortBy} < $${paramIndex}` : `${sortBy} > $${paramIndex}`;
      conditions.push(cursorCondition);
      values.push(pagination.cursor);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    const query = `
      SELECT
        id, project_id as "projectId", developer_id as "developerId",
        verifier_id as "verifierId", status, progress,
        submitted_at as "submittedAt", assigned_at as "assignedAt",
        completed_at as "completedAt", notes,
        created_at as "createdAt", updated_at as "updatedAt"
      FROM verification_requests
      WHERE ${whereClause}
      ORDER BY ${sortBy} ${sortOrder}, id ${sortOrder}
      LIMIT $${paramIndex}
    `;

    values.push(limit);

    const result = await this.pool.query(query, values);
    return result.rows.map((row) => this.mapRowToVerificationRequest(row));
  }

  async findByVerifier(
    verifierId: string,
    filters?: VerificationFilters,
    pagination?: PaginationOptions
  ): Promise<VerificationRequest[]> {
    const conditions: string[] = ['verifier_id = $1'];
    const values: any[] = [verifierId];
    let paramIndex = 2;

    if (filters?.status) {
      conditions.push(`status = $${paramIndex}`);
      values.push(filters.status);
      paramIndex++;
    }

    // SECURITY FIX: Whitelist allowed sort columns to prevent SQL injection
    const ALLOWED_SORT_COLUMNS = ['created_at', 'updated_at', 'submitted_at', 'assigned_at', 'completed_at', 'reviewed_at', 'status', 'id'];
    const sortBy = pagination?.sortBy && ALLOWED_SORT_COLUMNS.includes(pagination.sortBy)
      ? pagination.sortBy
      : 'created_at';

    const sortOrder = pagination?.sortOrder?.toLowerCase() === 'asc' ? 'asc' : 'desc';

    const limit = pagination?.limit && pagination.limit > 0 && pagination.limit <= 100
      ? pagination.limit
      : 20;

    // Cursor-based pagination
    if (pagination?.cursor) {
      const cursorCondition =
        sortOrder === 'desc' ? `${sortBy} < $${paramIndex}` : `${sortBy} > $${paramIndex}`;
      conditions.push(cursorCondition);
      values.push(pagination.cursor);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    const query = `
      SELECT
        id, project_id as "projectId", developer_id as "developerId",
        verifier_id as "verifierId", status, progress,
        submitted_at as "submittedAt", assigned_at as "assignedAt",
        completed_at as "completedAt", notes,
        created_at as "createdAt", updated_at as "updatedAt"
      FROM verification_requests
      WHERE ${whereClause}
      ORDER BY ${sortBy} ${sortOrder}, id ${sortOrder}
      LIMIT $${paramIndex}
    `;

    values.push(limit);

    const result = await this.pool.query(query, values);
    return result.rows.map((row) => this.mapRowToVerificationRequest(row));
  }

  async findAll(
    filters?: VerificationFilters,
    pagination?: PaginationOptions
  ): Promise<VerificationRequest[]> {
    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (filters?.status) {
      conditions.push(`status = $${paramIndex}`);
      values.push(filters.status);
      paramIndex++;
    }

    if (filters?.developerId) {
      conditions.push(`developer_id = $${paramIndex}`);
      values.push(filters.developerId);
      paramIndex++;
    }

    if (filters?.verifierId) {
      conditions.push(`verifier_id = $${paramIndex}`);
      values.push(filters.verifierId);
      paramIndex++;
    }

    const sortBy = pagination?.sortBy || 'created_at';
    const sortOrder = pagination?.sortOrder || 'desc';
    const limit = pagination?.limit || 20;

    // Cursor-based pagination
    if (pagination?.cursor) {
      const cursorCondition =
        sortOrder === 'desc' ? `${sortBy} < $${paramIndex}` : `${sortBy} > $${paramIndex}`;
      conditions.push(cursorCondition);
      values.push(pagination.cursor);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT 
        id, project_id as "projectId", developer_id as "developerId",
        verifier_id as "verifierId", status, progress,
        submitted_at as "submittedAt", assigned_at as "assignedAt",
        completed_at as "completedAt", notes,
        created_at as "createdAt", updated_at as "updatedAt"
      FROM verification_requests
      ${whereClause}
      ORDER BY ${sortBy} ${sortOrder}, id ${sortOrder}
      LIMIT $${paramIndex}
    `;

    values.push(limit);

    const result = await this.pool.query(query, values);
    return result.rows.map((row) => this.mapRowToVerificationRequest(row));
  }

  async save(verification: VerificationRequest): Promise<VerificationRequest> {
    const query = `
      INSERT INTO verification_requests (
        id, project_id, developer_id, verifier_id, status, progress,
        submitted_at, assigned_at, completed_at, notes,
        created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING 
        id, project_id as "projectId", developer_id as "developerId",
        verifier_id as "verifierId", status, progress,
        submitted_at as "submittedAt", assigned_at as "assignedAt",
        completed_at as "completedAt", notes,
        created_at as "createdAt", updated_at as "updatedAt"
    `;

    const values = [
      verification.id,
      verification.projectId,
      verification.developerId,
      verification.verifierId,
      verification.status,
      verification.progress,
      verification.submittedAt,
      verification.assignedAt,
      verification.completedAt,
      verification.notes,
      verification.createdAt,
      verification.updatedAt,
    ];

    const result = await this.pool.query(query, values);
    return this.mapRowToVerificationRequest(result.rows[0]);
  }

  async update(verification: VerificationRequest): Promise<VerificationRequest> {
    const query = `
      UPDATE verification_requests
      SET 
        verifier_id = $2,
        status = $3,
        progress = $4,
        assigned_at = $5,
        completed_at = $6,
        notes = $7,
        updated_at = $8
      WHERE id = $1
      RETURNING 
        id, project_id as "projectId", developer_id as "developerId",
        verifier_id as "verifierId", status, progress,
        submitted_at as "submittedAt", assigned_at as "assignedAt",
        completed_at as "completedAt", notes,
        created_at as "createdAt", updated_at as "updatedAt"
    `;

    const values = [
      verification.id,
      verification.verifierId,
      verification.status,
      verification.progress,
      verification.assignedAt,
      verification.completedAt,
      verification.notes,
      new Date(),
    ];

    const result = await this.pool.query(query, values);
    return this.mapRowToVerificationRequest(result.rows[0]);
  }

  async count(filters?: VerificationFilters): Promise<number> {
    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (filters?.status) {
      conditions.push(`status = $${paramIndex}`);
      values.push(filters.status);
      paramIndex++;
    }

    if (filters?.developerId) {
      conditions.push(`developer_id = $${paramIndex}`);
      values.push(filters.developerId);
      paramIndex++;
    }

    if (filters?.verifierId) {
      conditions.push(`verifier_id = $${paramIndex}`);
      values.push(filters.verifierId);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `SELECT COUNT(*) as count FROM verification_requests ${whereClause}`;
    const result = await this.pool.query(query, values);
    return parseInt(result.rows[0].count);
  }

  private mapRowToVerificationRequest(row: any): VerificationRequest {
    return {
      id: row.id,
      projectId: row.projectId,
      developerId: row.developerId,
      verifierId: row.verifierId || null,
      status: row.status as VerificationStatus,
      progress: parseInt(row.progress),
      submittedAt: new Date(row.submittedAt),
      assignedAt: row.assignedAt ? new Date(row.assignedAt) : null,
      completedAt: row.completedAt ? new Date(row.completedAt) : null,
      notes: row.notes || null,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }
}
