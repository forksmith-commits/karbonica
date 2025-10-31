import { createClient, RedisClientType } from 'redis';
import { config } from './index';
import { logger } from '../utils/logger';

class RedisConnection {
  private client: RedisClientType | null = null;

  async connect(): Promise<RedisClientType> {
    if (this.client) {
      return this.client;
    }

    const redisConfig = {
      socket: {
        host: config.redis.host,
        port: config.redis.port,
      },
      password: config.redis.password,
      database: config.redis.db,
    };

    this.client = createClient(redisConfig);

    // Error handling
    this.client.on('error', (err) => {
      logger.error('Redis client error', { error: err });
    });

    this.client.on('connect', () => {
      logger.info('Redis connection established', {
        host: config.redis.host,
        port: config.redis.port,
      });
    });

    this.client.on('ready', () => {
      logger.info('Redis client ready');
    });

    this.client.on('reconnecting', () => {
      logger.warn('Redis client reconnecting');
    });

    await this.client.connect();

    return this.client;
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      logger.info('Redis connection closed');
    }
  }

  getClient(): RedisClientType {
    if (!this.client) {
      throw new Error('Redis not connected. Call connect() first.');
    }
    return this.client;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const client = this.getClient();
      const pong = await client.ping();
      return pong === 'PONG';
    } catch (error) {
      logger.error('Redis health check failed', { error });
      return false;
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const client = this.getClient();
    if (ttlSeconds) {
      await client.setEx(key, ttlSeconds, value);
    } else {
      await client.set(key, value);
    }
  }

  async get(key: string): Promise<string | null> {
    const client = this.getClient();
    return await client.get(key);
  }

  async del(key: string): Promise<void> {
    const client = this.getClient();
    await client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    const client = this.getClient();
    const result = await client.exists(key);
    return result === 1;
  }
}

export const redis = new RedisConnection();
