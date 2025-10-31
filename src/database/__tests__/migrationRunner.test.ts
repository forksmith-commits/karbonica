import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Pool } from 'pg';
import { MigrationRunner } from '../migrationRunner';
import { config } from '../../config';

describe('MigrationRunner', () => {
  let pool: Pool;
  let runner: MigrationRunner;
  let testDbName: string;

  beforeAll(async () => {
    // Create a test database
    testDbName = `karbonica_test_${Date.now()}`;
    
    // Connect to default postgres database to create test database
    const adminPool = new Pool({
      host: config.database.host,
      port: config.database.port,
      database: 'postgres',
      user: config.database.user,
      password: config.database.password,
    });

    await adminPool.query(`CREATE DATABASE ${testDbName}`);
    await adminPool.end();

    // Connect to test database
    pool = new Pool({
      host: config.database.host,
      port: config.database.port,
      database: testDbName,
      user: config.database.user,
      password: config.database.password,
    });

    runner = new MigrationRunner(pool);
  });

  afterAll(async () => {
    // Close pool
    await pool.end();

    // Drop test database
    const adminPool = new Pool({
      host: config.database.host,
      port: config.database.port,
      database: 'postgres',
      user: config.database.user,
      password: config.database.password,
    });

    await adminPool.query(`DROP DATABASE IF EXISTS ${testDbName}`);
    await adminPool.end();
  });

  beforeEach(async () => {
    // Clean up any existing migrations
    await pool.query('DROP TABLE IF EXISTS schema_migrations CASCADE');
  });

  describe('initialize', () => {
    it('should create schema_migrations table', async () => {
      await runner.initialize();

      const result = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'schema_migrations'
        );
      `);

      expect(result.rows[0].exists).toBe(true);
    });

    it('should be idempotent', async () => {
      await runner.initialize();
      await runner.initialize(); // Should not throw

      const result = await pool.query(`
        SELECT COUNT(*) as count FROM information_schema.tables 
        WHERE table_name = 'schema_migrations'
      `);

      expect(result.rows[0].count).toBe('1');
    });
  });

  describe('runPendingMigrations', () => {
    it('should run all pending migrations', async () => {
      await runner.runPendingMigrations();

      const status = await runner.getStatus();
      expect(status.applied.length).toBeGreaterThan(0);
      expect(status.pending.length).toBe(0);
    });

    it('should create all required tables', async () => {
      await runner.runPendingMigrations();

      const expectedTables = [
        'users',
        'sessions',
        'cardano_wallets',
        'projects',
        'project_documents',
        'verification_requests',
        'verification_documents',
        'verification_events',
        'credit_entries',
        'credit_transactions',
        'blockchain_transactions',
        'audit_logs',
      ];

      for (const tableName of expectedTables) {
        const result = await pool.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = $1
          );
        `, [tableName]);

        expect(result.rows[0].exists).toBe(true);
      }
    });

    it('should create indexes on users table', async () => {
      await runner.runPendingMigrations();

      const result = await pool.query(`
        SELECT indexname FROM pg_indexes 
        WHERE tablename = 'users' AND indexname != 'users_pkey'
        ORDER BY indexname;
      `);

      const indexNames = result.rows.map(row => row.indexname);
      expect(indexNames).toContain('idx_users_email');
      expect(indexNames).toContain('idx_users_role');
    });

    it('should create indexes on projects table', async () => {
      await runner.runPendingMigrations();

      const result = await pool.query(`
        SELECT indexname FROM pg_indexes 
        WHERE tablename = 'projects' AND indexname != 'projects_pkey'
        ORDER BY indexname;
      `);

      const indexNames = result.rows.map(row => row.indexname);
      expect(indexNames).toContain('idx_projects_developer_id');
      expect(indexNames).toContain('idx_projects_status');
      expect(indexNames).toContain('idx_projects_type');
    });

    it('should create indexes on verification_requests table', async () => {
      await runner.runPendingMigrations();

      const result = await pool.query(`
        SELECT indexname FROM pg_indexes 
        WHERE tablename = 'verification_requests' AND indexname != 'verification_requests_pkey'
        ORDER BY indexname;
      `);

      const indexNames = result.rows.map(row => row.indexname);
      expect(indexNames).toContain('idx_verification_requests_project_id');
      expect(indexNames).toContain('idx_verification_requests_developer_id');
      expect(indexNames).toContain('idx_verification_requests_verifier_id');
      expect(indexNames).toContain('idx_verification_requests_status');
    });

    it('should create indexes on credit_entries table', async () => {
      await runner.runPendingMigrations();

      const result = await pool.query(`
        SELECT indexname FROM pg_indexes 
        WHERE tablename = 'credit_entries' AND indexname != 'credit_entries_pkey'
        ORDER BY indexname;
      `);

      const indexNames = result.rows.map(row => row.indexname);
      expect(indexNames).toContain('idx_credit_entries_credit_id');
      expect(indexNames).toContain('idx_credit_entries_project_id');
      expect(indexNames).toContain('idx_credit_entries_owner_id');
      expect(indexNames).toContain('idx_credit_entries_status');
    });

    it('should create indexes on credit_transactions table', async () => {
      await runner.runPendingMigrations();

      const result = await pool.query(`
        SELECT indexname FROM pg_indexes 
        WHERE tablename = 'credit_transactions' AND indexname != 'credit_transactions_pkey'
        ORDER BY indexname;
      `);

      const indexNames = result.rows.map(row => row.indexname);
      expect(indexNames).toContain('idx_credit_transactions_credit_id');
      expect(indexNames).toContain('idx_credit_transactions_sender_id');
      expect(indexNames).toContain('idx_credit_transactions_recipient_id');
      expect(indexNames).toContain('idx_credit_transactions_transaction_type');
    });

    it('should create indexes on cardano_wallets table', async () => {
      await runner.runPendingMigrations();

      const result = await pool.query(`
        SELECT indexname FROM pg_indexes 
        WHERE tablename = 'cardano_wallets' AND indexname != 'cardano_wallets_pkey'
        ORDER BY indexname;
      `);

      const indexNames = result.rows.map(row => row.indexname);
      expect(indexNames).toContain('idx_cardano_wallets_user_id');
      expect(indexNames).toContain('idx_cardano_wallets_address');
    });

    it('should create indexes on blockchain_transactions table', async () => {
      await runner.runPendingMigrations();

      const result = await pool.query(`
        SELECT indexname FROM pg_indexes 
        WHERE tablename = 'blockchain_transactions' AND indexname != 'blockchain_transactions_pkey'
        ORDER BY indexname;
      `);

      const indexNames = result.rows.map(row => row.indexname);
      expect(indexNames).toContain('idx_blockchain_transactions_credit_transaction_id');
      expect(indexNames).toContain('idx_blockchain_transactions_tx_hash');
      expect(indexNames).toContain('idx_blockchain_transactions_tx_status');
    });

    it('should create partitioned audit_logs table', async () => {
      await runner.runPendingMigrations();

      // Check if audit_logs is partitioned
      const result = await pool.query(`
        SELECT partattrs FROM pg_partitioned_table pt
        JOIN pg_class c ON pt.partrelid = c.oid
        WHERE c.relname = 'audit_logs';
      `);

      expect(result.rows.length).toBe(1);
    });

    it('should create audit_logs partitions', async () => {
      await runner.runPendingMigrations();

      const result = await pool.query(`
        SELECT tablename FROM pg_tables 
        WHERE tablename LIKE 'audit_logs_2024_%'
        ORDER BY tablename;
      `);

      expect(result.rows.length).toBeGreaterThan(0);
      expect(result.rows.some(row => row.tablename === 'audit_logs_2024_01')).toBe(true);
    });
  });

  describe('foreign key constraints', () => {
    beforeEach(async () => {
      await runner.runPendingMigrations();
    });

    it('should enforce foreign key constraint on projects.developer_id', async () => {
      await expect(
        pool.query(`
          INSERT INTO projects (id, developer_id, title, type, description, location, country, emissions_target, start_date)
          VALUES (gen_random_uuid(), gen_random_uuid(), 'Test', 'forest_conservation', 'Test', 'Test', 'USA', 1000, '2024-01-01')
        `)
      ).rejects.toThrow();
    });

    it('should enforce foreign key constraint on verification_requests.project_id', async () => {
      await expect(
        pool.query(`
          INSERT INTO verification_requests (id, project_id, developer_id)
          VALUES (gen_random_uuid(), gen_random_uuid(), gen_random_uuid())
        `)
      ).rejects.toThrow();
    });

    it('should enforce foreign key constraint on credit_entries.project_id', async () => {
      await expect(
        pool.query(`
          INSERT INTO credit_entries (id, credit_id, project_id, owner_id, quantity, vintage)
          VALUES (gen_random_uuid(), 'TEST-001', gen_random_uuid(), gen_random_uuid(), 1000, 2024)
        `)
      ).rejects.toThrow();
    });

    it('should enforce foreign key constraint on credit_transactions.credit_id', async () => {
      await expect(
        pool.query(`
          INSERT INTO credit_transactions (id, credit_id, transaction_type, quantity)
          VALUES (gen_random_uuid(), gen_random_uuid(), 'issuance', 1000)
        `)
      ).rejects.toThrow();
    });

    it('should cascade delete sessions when user is deleted', async () => {
      // Create user
      const userResult = await pool.query(`
        INSERT INTO users (email, password_hash, name, role)
        VALUES ('test@example.com', 'hash', 'Test User', 'developer')
        RETURNING id
      `);
      const userId = userResult.rows[0].id;

      // Create session
      await pool.query(`
        INSERT INTO sessions (user_id, access_token_hash, refresh_token_hash, expires_at)
        VALUES ($1, 'hash1', 'hash2', NOW() + INTERVAL '1 hour')
      `, [userId]);

      // Delete user
      await pool.query('DELETE FROM users WHERE id = $1', [userId]);

      // Check session is deleted
      const sessionResult = await pool.query(
        'SELECT COUNT(*) as count FROM sessions WHERE user_id = $1',
        [userId]
      );
      expect(sessionResult.rows[0].count).toBe('0');
    });
  });

  describe('rollbackLastMigration', () => {
    it('should rollback the last migration', async () => {
      await runner.runPendingMigrations();

      const beforeStatus = await runner.getStatus();
      const appliedCount = beforeStatus.applied.length;

      await runner.rollbackLastMigration();

      const afterStatus = await runner.getStatus();
      expect(afterStatus.applied.length).toBe(appliedCount - 1);
      expect(afterStatus.pending.length).toBe(1);
    });

    it('should drop all tables on rollback', async () => {
      await runner.runPendingMigrations();
      await runner.rollbackLastMigration();

      const result = await pool.query(`
        SELECT tablename FROM pg_tables 
        WHERE schemaname = 'public' AND tablename != 'schema_migrations'
      `);

      expect(result.rows.length).toBe(0);
    });

    it('should handle rollback when no migrations applied', async () => {
      await runner.initialize();
      
      // Should not throw
      await expect(runner.rollbackLastMigration()).resolves.not.toThrow();
    });
  });

  describe('getStatus', () => {
    it('should return correct status', async () => {
      const status = await runner.getStatus();

      expect(status).toHaveProperty('applied');
      expect(status).toHaveProperty('pending');
      expect(Array.isArray(status.applied)).toBe(true);
      expect(Array.isArray(status.pending)).toBe(true);
    });

    it('should show all migrations as pending initially', async () => {
      await runner.initialize();
      const status = await runner.getStatus();

      expect(status.applied.length).toBe(0);
      expect(status.pending.length).toBeGreaterThan(0);
    });

    it('should show all migrations as applied after running', async () => {
      await runner.runPendingMigrations();
      const status = await runner.getStatus();

      expect(status.applied.length).toBeGreaterThan(0);
      expect(status.pending.length).toBe(0);
    });
  });
});
