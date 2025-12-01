import { Pool } from 'pg';
import { User } from '../../domain/entities/User';
import { IUserRepository } from '../../domain/repositories/IUserRepository';
import { database } from '../../config/database';

export class UserRepository implements IUserRepository {
  private pool: Pool;

  constructor() {
    this.pool = database.getPool();
  }

  async findById(id: string): Promise<User | null> {
    const query = `
      SELECT
        id, email, password_hash as "passwordHash", name, company, role,
        wallet_address as "walletAddress", email_verified as "emailVerified",
        account_locked as "accountLocked", locked_until as "lockedUntil",
        failed_login_attempts as "failedLoginAttempts",
        last_login_at as "lastLoginAt", created_at as "createdAt", updated_at as "updatedAt"
      FROM users
      WHERE id = $1
    `;

    const result = await this.pool.query(query, [id]);
    return result.rows[0] || null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const query = `
      SELECT
        id, email, password_hash as "passwordHash", name, company, role,
        wallet_address as "walletAddress", email_verified as "emailVerified",
        account_locked as "accountLocked", locked_until as "lockedUntil",
        failed_login_attempts as "failedLoginAttempts",
        last_login_at as "lastLoginAt", created_at as "createdAt", updated_at as "updatedAt"
      FROM users
      WHERE email = $1
    `;

    const result = await this.pool.query(query, [email]);
    return result.rows[0] || null;
  }

  async findByWalletAddress(address: string): Promise<User | null> {
    const query = `
      SELECT
        id, email, password_hash as "passwordHash", name, company, role,
        wallet_address as "walletAddress", email_verified as "emailVerified",
        account_locked as "accountLocked", locked_until as "lockedUntil",
        failed_login_attempts as "failedLoginAttempts",
        last_login_at as "lastLoginAt", created_at as "createdAt", updated_at as "updatedAt"
      FROM users
      WHERE wallet_address = $1
    `;

    const result = await this.pool.query(query, [address]);
    return result.rows[0] || null;
  }

  async save(user: User): Promise<User> {
    const query = `
      INSERT INTO users (
        id, email, password_hash, name, company, role,
        wallet_address, email_verified, account_locked, locked_until,
        failed_login_attempts, last_login_at, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING
        id, email, password_hash as "passwordHash", name, company, role,
        wallet_address as "walletAddress", email_verified as "emailVerified",
        account_locked as "accountLocked", locked_until as "lockedUntil",
        failed_login_attempts as "failedLoginAttempts",
        last_login_at as "lastLoginAt", created_at as "createdAt", updated_at as "updatedAt"
    `;

    const values = [
      user.id,
      user.email,
      user.passwordHash,
      user.name,
      user.company,
      user.role,
      user.walletAddress,
      user.emailVerified,
      user.accountLocked,
      user.lockedUntil,
      user.failedLoginAttempts,
      user.lastLoginAt,
      user.createdAt,
      user.updatedAt,
    ];

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  async update(user: User): Promise<User> {
    const query = `
      UPDATE users
      SET
        email = $2,
        password_hash = $3,
        name = $4,
        company = $5,
        role = $6,
        wallet_address = $7,
        email_verified = $8,
        account_locked = $9,
        locked_until = $10,
        failed_login_attempts = $11,
        last_login_at = $12,
        updated_at = $13
      WHERE id = $1
      RETURNING
        id, email, password_hash as "passwordHash", name, company, role,
        wallet_address as "walletAddress", email_verified as "emailVerified",
        account_locked as "accountLocked", locked_until as "lockedUntil",
        failed_login_attempts as "failedLoginAttempts",
        last_login_at as "lastLoginAt", created_at as "createdAt", updated_at as "updatedAt"
    `;

    const values = [
      user.id,
      user.email,
      user.passwordHash,
      user.name,
      user.company,
      user.role,
      user.walletAddress,
      user.emailVerified,
      user.accountLocked,
      user.lockedUntil,
      user.failedLoginAttempts,
      user.lastLoginAt,
      new Date(),
    ];

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  async delete(id: string): Promise<void> {
    const query = 'DELETE FROM users WHERE id = $1';
    await this.pool.query(query, [id]);
  }

  async findAll(limit: number = 20, offset: number = 0): Promise<User[]> {
    const query = `
      SELECT
        id, email, password_hash as "passwordHash", name, company, role,
        wallet_address as "walletAddress", email_verified as "emailVerified",
        account_locked as "accountLocked", locked_until as "lockedUntil",
        failed_login_attempts as "failedLoginAttempts",
        last_login_at as "lastLoginAt", created_at as "createdAt", updated_at as "updatedAt"
      FROM users
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `;

    const result = await this.pool.query(query, [limit, offset]);
    return result.rows;
  }

  async count(): Promise<number> {
    const query = 'SELECT COUNT(*) as count FROM users';
    const result = await this.pool.query(query);
    return parseInt(result.rows[0].count);
  }
}
