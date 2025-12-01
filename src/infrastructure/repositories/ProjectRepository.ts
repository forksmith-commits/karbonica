import { Pool } from 'pg';
import { Project, ProjectType, ProjectStatus } from '../../domain/entities/Project';
import {
  IProjectRepository,
  ProjectFilters,
  PaginationOptions,
} from '../../domain/repositories/IProjectRepository';
import { database } from '../../config/database';

export class ProjectRepository implements IProjectRepository {
  private pool: Pool;

  constructor() {
    this.pool = database.getPool();
  }

  async findById(id: string): Promise<Project | null> {
    const query = `
      SELECT 
        id, developer_id as "developerId", title, type, description,
        location, country, 
        ST_Y(coordinates::geometry) as latitude,
        ST_X(coordinates::geometry) as longitude,
        emissions_target as "emissionsTarget", start_date as "startDate",
        status, created_at as "createdAt", updated_at as "updatedAt"
      FROM projects
      WHERE id = $1
    `;

    const result = await this.pool.query(query, [id]);

    if (!result.rows[0]) {
      return null;
    }

    return this.mapRowToProject(result.rows[0]);
  }

  async findByDeveloper(
    developerId: string,
    filters?: ProjectFilters,
    pagination?: PaginationOptions
  ): Promise<Project[]> {
    const conditions: string[] = ['developer_id = $1'];
    const values: any[] = [developerId];
    let paramIndex = 2;

    if (filters?.status) {
      conditions.push(`status = $${paramIndex}`);
      values.push(filters.status);
      paramIndex++;
    }

    if (filters?.type) {
      conditions.push(`type = $${paramIndex}`);
      values.push(filters.type);
      paramIndex++;
    }

    if (filters?.country) {
      conditions.push(`country = $${paramIndex}`);
      values.push(filters.country);
      paramIndex++;
    }

    // SECURITY FIX: Whitelist allowed sort columns to prevent SQL injection
    const ALLOWED_SORT_COLUMNS = ['created_at', 'updated_at', 'title', 'status', 'type', 'id'];
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
        id, developer_id as "developerId", title, type, description,
        location, country,
        ST_Y(coordinates::geometry) as latitude,
        ST_X(coordinates::geometry) as longitude,
        emissions_target as "emissionsTarget", start_date as "startDate",
        status, created_at as "createdAt", updated_at as "updatedAt"
      FROM projects
      WHERE ${whereClause}
      ORDER BY ${sortBy} ${sortOrder}, id ${sortOrder}
      LIMIT $${paramIndex}
    `;

    values.push(limit);

    const result = await this.pool.query(query, values);
    return result.rows.map((row) => this.mapRowToProject(row));
  }

  async findAll(filters?: ProjectFilters, pagination?: PaginationOptions): Promise<Project[]> {
    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (filters?.status) {
      conditions.push(`status = $${paramIndex}`);
      values.push(filters.status);
      paramIndex++;
    }

    if (filters?.type) {
      conditions.push(`type = $${paramIndex}`);
      values.push(filters.type);
      paramIndex++;
    }

    if (filters?.developerId) {
      conditions.push(`developer_id = $${paramIndex}`);
      values.push(filters.developerId);
      paramIndex++;
    }

    if (filters?.country) {
      conditions.push(`country = $${paramIndex}`);
      values.push(filters.country);
      paramIndex++;
    }

    // SECURITY FIX: Whitelist allowed sort columns to prevent SQL injection
    const ALLOWED_SORT_COLUMNS = ['created_at', 'updated_at', 'title', 'status', 'type', 'id'];
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

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT
        id, developer_id as "developerId", title, type, description,
        location, country,
        ST_Y(coordinates::geometry) as latitude,
        ST_X(coordinates::geometry) as longitude,
        emissions_target as "emissionsTarget", start_date as "startDate",
        status, created_at as "createdAt", updated_at as "updatedAt"
      FROM projects
      ${whereClause}
      ORDER BY ${sortBy} ${sortOrder}, id ${sortOrder}
      LIMIT $${paramIndex}
    `;

    values.push(limit);

    const result = await this.pool.query(query, values);
    return result.rows.map((row) => this.mapRowToProject(row));
  }

  async save(project: Project): Promise<Project> {
    const query = `
      INSERT INTO projects (
        id, developer_id, title, type, description,
        location, country, coordinates, emissions_target, start_date,
        status, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, ST_SetSRID(ST_MakePoint($8, $9), 4326), $10, $11, $12, $13, $14)
      RETURNING 
        id, developer_id as "developerId", title, type, description,
        location, country,
        ST_Y(coordinates::geometry) as latitude,
        ST_X(coordinates::geometry) as longitude,
        emissions_target as "emissionsTarget", start_date as "startDate",
        status, created_at as "createdAt", updated_at as "updatedAt"
    `;

    const values = [
      project.id,
      project.developerId,
      project.title,
      project.type,
      project.description,
      project.location,
      project.country,
      project.coordinates?.longitude || null,
      project.coordinates?.latitude || null,
      project.emissionsTarget,
      project.startDate,
      project.status,
      project.createdAt,
      project.updatedAt,
    ];

    const result = await this.pool.query(query, values);
    return this.mapRowToProject(result.rows[0]);
  }

  async update(project: Project): Promise<Project> {
    const query = `
      UPDATE projects
      SET 
        title = $2,
        type = $3,
        description = $4,
        location = $5,
        country = $6,
        coordinates = ST_SetSRID(ST_MakePoint($7, $8), 4326),
        emissions_target = $9,
        start_date = $10,
        status = $11,
        updated_at = $12
      WHERE id = $1
      RETURNING 
        id, developer_id as "developerId", title, type, description,
        location, country,
        ST_Y(coordinates::geometry) as latitude,
        ST_X(coordinates::geometry) as longitude,
        emissions_target as "emissionsTarget", start_date as "startDate",
        status, created_at as "createdAt", updated_at as "updatedAt"
    `;

    const values = [
      project.id,
      project.title,
      project.type,
      project.description,
      project.location,
      project.country,
      project.coordinates?.longitude || null,
      project.coordinates?.latitude || null,
      project.emissionsTarget,
      project.startDate,
      project.status,
      new Date(),
    ];

    const result = await this.pool.query(query, values);
    return this.mapRowToProject(result.rows[0]);
  }

  async delete(id: string): Promise<void> {
    const query = 'DELETE FROM projects WHERE id = $1';
    await this.pool.query(query, [id]);
  }

  async count(filters?: ProjectFilters): Promise<number> {
    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (filters?.status) {
      conditions.push(`status = $${paramIndex}`);
      values.push(filters.status);
      paramIndex++;
    }

    if (filters?.type) {
      conditions.push(`type = $${paramIndex}`);
      values.push(filters.type);
      paramIndex++;
    }

    if (filters?.developerId) {
      conditions.push(`developer_id = $${paramIndex}`);
      values.push(filters.developerId);
      paramIndex++;
    }

    if (filters?.country) {
      conditions.push(`country = $${paramIndex}`);
      values.push(filters.country);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `SELECT COUNT(*) as count FROM projects ${whereClause}`;
    const result = await this.pool.query(query, values);
    return parseInt(result.rows[0].count);
  }

  private mapRowToProject(row: any): Project {
    return {
      id: row.id,
      developerId: row.developerId,
      title: row.title,
      type: row.type as ProjectType,
      description: row.description,
      location: row.location,
      country: row.country,
      coordinates:
        row.latitude && row.longitude
          ? { latitude: parseFloat(row.latitude), longitude: parseFloat(row.longitude) }
          : null,
      emissionsTarget: parseFloat(row.emissionsTarget),
      startDate: new Date(row.startDate),
      status: row.status as ProjectStatus,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }
}
