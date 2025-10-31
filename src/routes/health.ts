import { Router, Request, Response } from 'express';
import { database } from '../config/database';
import { redis } from '../config/redis';
import { logger } from '../utils/logger';

export const healthRouter = Router();

healthRouter.get('/', async (req: Request, res: Response) => {
  try {
    // Check database connectivity
    const dbHealthy = await database.healthCheck();
    
    // Check Redis connectivity
    const redisHealthy = await redis.healthCheck();

    // Overall health status
    const isHealthy = dbHealthy && redisHealthy;
    const statusCode = isHealthy ? 200 : 503;

    const healthStatus = {
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      services: {
        database: {
          status: dbHealthy ? 'up' : 'down',
        },
        redis: {
          status: redisHealthy ? 'up' : 'down',
        },
      },
    };

    if (!isHealthy) {
      logger.warn('Health check failed', healthStatus);
    }

    res.status(statusCode).json(healthStatus);
  } catch (error) {
    logger.error('Health check error', { error });
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
    });
  }
});
