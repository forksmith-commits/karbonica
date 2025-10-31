import { Pool, PoolConfig } from 'pg';
import { config } from './index';
import { logger } from '../utils/logger';

class DatabaseConnection {
  private pool: Pool | null = null;

  async connect(): Promise<Pool> {
    if (this.pool) {
      return this.pool;
    }

    const poolConfig: PoolConfig = {
      host: config.database.host,
      port: config.database.port,
      database: config.database.database,
      user: config.database.user,
      password: config.database.password,
      min: config.database.pool.min,
      max: config.database.pool.max,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      ssl:
        config.env === 'production' || config.database.host.includes('render.com')
          ? { rejectUnauthorized: false }
          : false,
    };

    this.pool = new Pool(poolConfig);

    // Test connection
    try {
      const client = await this.pool.connect();
      logger.info('Database connection established', {
        host: config.database.host,
        database: config.database.database,
      });
      client.release();
    } catch (error) {
      logger.error('Failed to connect to database', { error });
      throw error;
    }

    // Handle pool errors
    this.pool.on('error', (err) => {
      logger.error('Unexpected database pool error', { error: err });
    });

    return this.pool;
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      logger.info('Database connection closed');
    }
  }

  getPool(): Pool {
    if (!this.pool) {
      throw new Error('Database not connected. Call connect() first.');
    }
    return this.pool;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const pool = this.getPool();
      const result = await pool.query('SELECT 1 as health');
      return result.rows[0].health === 1;
    } catch (error) {
      logger.error('Database health check failed', { error });
      return false;
    }
  }
}

export const database = new DatabaseConnection();
