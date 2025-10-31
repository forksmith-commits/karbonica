import { Pool } from 'pg';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { logger } from '../utils/logger';

export interface Migration {
  id: number;
  name: string;
  filename: string;
  appliedAt?: Date;
}

export class MigrationRunner {
  private pool: Pool;
  private migrationsPath: string;

  constructor(pool: Pool, migrationsPath?: string) {
    this.pool = pool;
    this.migrationsPath = migrationsPath || join(__dirname, 'migrations');
  }

  /**
   * Initialize migrations table
   */
  async initialize(): Promise<void> {
    const query = `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        migration_name VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    
    await this.pool.query(query);
    logger.info('Migration tracking table initialized');
  }

  /**
   * Get list of applied migrations
   */
  async getAppliedMigrations(): Promise<Migration[]> {
    const result = await this.pool.query(
      'SELECT id, migration_name as name, applied_at FROM schema_migrations ORDER BY id'
    );
    
    return result.rows.map(row => ({
      id: row.id,
      name: row.name,
      filename: `${row.name}.sql`,
      appliedAt: row.applied_at,
    }));
  }

  /**
   * Get list of pending migrations
   */
  async getPendingMigrations(): Promise<Migration[]> {
    const appliedMigrations = await this.getAppliedMigrations();
    const appliedNames = new Set(appliedMigrations.map(m => m.name));
    
    const files = readdirSync(this.migrationsPath)
      .filter(f => f.endsWith('.sql') && !f.endsWith('_rollback.sql'))
      .sort();
    
    const pending: Migration[] = [];
    
    for (const file of files) {
      const name = file.replace('.sql', '');
      if (!appliedNames.has(name)) {
        pending.push({
          id: 0, // Will be assigned when applied
          name,
          filename: file,
        });
      }
    }
    
    return pending;
  }

  /**
   * Run a single migration
   */
  async runMigration(migration: Migration): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Read migration file
      const migrationPath = join(this.migrationsPath, migration.filename);
      const sql = readFileSync(migrationPath, 'utf-8');
      
      logger.info(`Applying migration: ${migration.name}`);
      
      // Execute migration
      await client.query(sql);
      
      // Record migration
      await client.query(
        'INSERT INTO schema_migrations (migration_name) VALUES ($1)',
        [migration.name]
      );
      
      await client.query('COMMIT');
      
      logger.info(`Migration applied successfully: ${migration.name}`);
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Migration failed: ${migration.name}`, { error });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Run all pending migrations
   */
  async runPendingMigrations(): Promise<void> {
    await this.initialize();
    
    const pending = await this.getPendingMigrations();
    
    if (pending.length === 0) {
      logger.info('No pending migrations');
      return;
    }
    
    logger.info(`Found ${pending.length} pending migration(s)`);
    
    for (const migration of pending) {
      await this.runMigration(migration);
    }
    
    logger.info('All migrations completed successfully');
  }

  /**
   * Rollback the last migration
   */
  async rollbackLastMigration(): Promise<void> {
    const applied = await this.getAppliedMigrations();
    
    if (applied.length === 0) {
      logger.info('No migrations to rollback');
      return;
    }
    
    const lastMigration = applied[applied.length - 1];
    const rollbackFilename = `${lastMigration.name}_rollback.sql`;
    const rollbackPath = join(this.migrationsPath, rollbackFilename);
    
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      logger.info(`Rolling back migration: ${lastMigration.name}`);
      
      // Read rollback file
      const sql = readFileSync(rollbackPath, 'utf-8');
      
      // Execute rollback
      await client.query(sql);
      
      // Remove migration record
      await client.query(
        'DELETE FROM schema_migrations WHERE migration_name = $1',
        [lastMigration.name]
      );
      
      await client.query('COMMIT');
      
      logger.info(`Migration rolled back successfully: ${lastMigration.name}`);
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Rollback failed: ${lastMigration.name}`, { error });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get migration status
   */
  async getStatus(): Promise<{
    applied: Migration[];
    pending: Migration[];
  }> {
    await this.initialize();
    
    const applied = await this.getAppliedMigrations();
    const pending = await this.getPendingMigrations();
    
    return { applied, pending };
  }
}
