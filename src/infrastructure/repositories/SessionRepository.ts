import { Pool } from 'pg';
import { Session } from '../../domain/entities/Session';
import { ISessionRepository } from '../../domain/repositories/ISessionRepository';
import { database } from '../../config/database';

export class SessionRepository implements ISessionRepository {
  private pool: Pool;

  constructor() {
    this.pool = database.getPool();
  }

  async findById(id: string): Promise<Session | null> {
    const query = `
      SELECT 
        id, user_id as "userId", access_token_hash as "accessToken",
        refresh_token_hash as "refreshToken", expires_at as "expiresAt",
        ip_address as "ipAddress", user_agent as "userAgent",
        created_at as "createdAt", last_activity_at as "lastActivityAt"
      FROM sessions
      WHERE id = $1
    `;

    const result = await this.pool.query(query, [id]);
    return result.rows[0] || null;
  }

  async findByAccessToken(token: string): Promise<Session | null> {
    const query = `
      SELECT 
        id, user_id as "userId", access_token_hash as "accessToken",
        refresh_token_hash as "refreshToken", expires_at as "expiresAt",
        ip_address as "ipAddress", user_agent as "userAgent",
        created_at as "createdAt", last_activity_at as "lastActivityAt"
      FROM sessions
      WHERE access_token_hash = $1 AND expires_at > NOW()
    `;

    const result = await this.pool.query(query, [token]);
    return result.rows[0] || null;
  }

  async findByRefreshToken(token: string): Promise<Session | null> {
    const query = `
      SELECT 
        id, user_id as "userId", access_token_hash as "accessToken",
        refresh_token_hash as "refreshToken", expires_at as "expiresAt",
        ip_address as "ipAddress", user_agent as "userAgent",
        created_at as "createdAt", last_activity_at as "lastActivityAt"
      FROM sessions
      WHERE refresh_token_hash = $1 AND expires_at > NOW()
    `;

    const result = await this.pool.query(query, [token]);
    return result.rows[0] || null;
  }

  async findByUserId(userId: string): Promise<Session[]> {
    const query = `
      SELECT 
        id, user_id as "userId", access_token_hash as "accessToken",
        refresh_token_hash as "refreshToken", expires_at as "expiresAt",
        ip_address as "ipAddress", user_agent as "userAgent",
        created_at as "createdAt", last_activity_at as "lastActivityAt"
      FROM sessions
      WHERE user_id = $1 AND expires_at > NOW()
      ORDER BY created_at DESC
    `;

    const result = await this.pool.query(query, [userId]);
    return result.rows;
  }

  async save(session: Session): Promise<Session> {
    const query = `
      INSERT INTO sessions (
        id, user_id, access_token_hash, refresh_token_hash, expires_at,
        ip_address, user_agent, created_at, last_activity_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING 
        id, user_id as "userId", access_token_hash as "accessToken",
        refresh_token_hash as "refreshToken", expires_at as "expiresAt",
        ip_address as "ipAddress", user_agent as "userAgent",
        created_at as "createdAt", last_activity_at as "lastActivityAt"
    `;

    const values = [
      session.id,
      session.userId,
      session.accessToken,
      session.refreshToken,
      session.expiresAt,
      session.ipAddress,
      session.userAgent,
      session.createdAt,
      session.lastActivityAt || session.createdAt,
    ];

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  async update(session: Session): Promise<Session> {
    const query = `
      UPDATE sessions
      SET 
        access_token_hash = $2,
        refresh_token_hash = $3,
        expires_at = $4,
        last_activity_at = $5
      WHERE id = $1
      RETURNING 
        id, user_id as "userId", access_token_hash as "accessToken",
        refresh_token_hash as "refreshToken", expires_at as "expiresAt",
        ip_address as "ipAddress", user_agent as "userAgent",
        created_at as "createdAt", last_activity_at as "lastActivityAt"
    `;

    const values = [
      session.id,
      session.accessToken,
      session.refreshToken,
      session.expiresAt,
      session.lastActivityAt || new Date(),
    ];

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  async delete(id: string): Promise<void> {
    const query = 'DELETE FROM sessions WHERE id = $1';
    await this.pool.query(query, [id]);
  }

  async deleteByUserId(userId: string): Promise<void> {
    const query = 'DELETE FROM sessions WHERE user_id = $1';
    await this.pool.query(query, [userId]);
  }

  async deleteExpired(): Promise<void> {
    const query = 'DELETE FROM sessions WHERE expires_at <= NOW()';
    await this.pool.query(query);
  }

  async deleteInactive(inactivityThresholdMs: number): Promise<void> {
    const query = `
      DELETE FROM sessions 
      WHERE EXTRACT(EPOCH FROM (NOW() - COALESCE(last_activity_at, created_at))) * 1000 > $1
    `;
    await this.pool.query(query, [inactivityThresholdMs]);
  }
}
