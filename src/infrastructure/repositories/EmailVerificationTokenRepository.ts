import { Pool } from 'pg';
import {
  EmailVerificationToken,
  IEmailVerificationTokenRepository,
} from '../../domain/repositories/IEmailVerificationTokenRepository';
import { database } from '../../config/database';

export class EmailVerificationTokenRepository implements IEmailVerificationTokenRepository {
  private pool: Pool;

  constructor() {
    this.pool = database.getPool();
  }

  async save(token: EmailVerificationToken): Promise<EmailVerificationToken> {
    const query = `
      INSERT INTO email_verification_tokens (
        id, user_id, token, expires_at, used_at, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING 
        id,
        user_id as "userId",
        token,
        expires_at as "expiresAt",
        used_at as "usedAt",
        created_at as "createdAt"
    `;

    const values = [
      token.id,
      token.userId,
      token.token,
      token.expiresAt,
      token.usedAt,
      token.createdAt,
    ];

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  async findByToken(token: string): Promise<EmailVerificationToken | null> {
    const query = `
      SELECT 
        id,
        user_id as "userId",
        token,
        expires_at as "expiresAt",
        used_at as "usedAt",
        created_at as "createdAt"
      FROM email_verification_tokens
      WHERE token = $1
    `;

    const result = await this.pool.query(query, [token]);
    return result.rows[0] || null;
  }

  async markAsUsed(tokenId: string): Promise<void> {
    const query = `
      UPDATE email_verification_tokens
      SET used_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `;

    await this.pool.query(query, [tokenId]);
  }

  async deleteExpired(): Promise<void> {
    const query = `
      DELETE FROM email_verification_tokens
      WHERE expires_at < CURRENT_TIMESTAMP
    `;

    await this.pool.query(query);
  }

  async deleteByUserId(userId: string): Promise<void> {
    const query = `
      DELETE FROM email_verification_tokens
      WHERE user_id = $1
    `;

    await this.pool.query(query, [userId]);
  }
}
