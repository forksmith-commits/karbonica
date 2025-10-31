import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { config } from './config';
import { swaggerSpec } from './config/swagger';
import { database } from './config/database';
import { redis } from './config/redis';
import { logger } from './utils/logger';
import { healthRouter } from './routes/health';
import { authRouter } from './routes/auth';
import { adminUsersRouter } from './routes/admin/users';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { startSessionCleanupScheduler, stopSessionCleanupScheduler } from './utils/sessionCleanup';

class App {
  public app: Application;
  private sessionCleanupInterval?: NodeJS.Timeout;

  constructor() {
    this.app = express();
    this.initializeMiddleware();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private initializeMiddleware(): void {
    // Security middleware
    this.app.use(helmet());
    this.app.use(cors());

    // Body parsing middleware
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging middleware
    this.app.use(requestLogger);
  }

  private initializeRoutes(): void {
    // Health check endpoint
    this.app.use('/health', healthRouter);

    // Swagger API Documentation
    this.app.use(
      '/api-docs',
      swaggerUi.serve,
      swaggerUi.setup(swaggerSpec, {
        customCss: '.swagger-ui .topbar { display: none }',
        customSiteTitle: 'Karbonica API Docs',
      })
    );

    // Swagger JSON endpoint
    this.app.get('/api-docs.json', (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.send(swaggerSpec);
    });

    // API routes
    this.app.use(`/api/${config.apiVersion}/auth`, authRouter);
    this.app.use(`/api/${config.apiVersion}/admin/users`, adminUsersRouter);
  }

  private initializeErrorHandling(): void {
    this.app.use(errorHandler);
  }

  public async start(): Promise<void> {
    try {
      // Connect to database
      await database.connect();
      logger.info('Database connected successfully');

      // Connect to Redis
      await redis.connect();
      logger.info('Redis connected successfully');

      // Start session cleanup scheduler
      this.sessionCleanupInterval = startSessionCleanupScheduler();

      // Start server
      this.app.listen(config.port, () => {
        logger.info('Server started', {
          port: config.port,
          environment: config.env,
          apiVersion: config.apiVersion,
        });
      });
    } catch (error) {
      logger.error('Failed to start application', { error });
      process.exit(1);
    }
  }

  public async stop(): Promise<void> {
    try {
      // Stop session cleanup scheduler
      if (this.sessionCleanupInterval) {
        stopSessionCleanupScheduler(this.sessionCleanupInterval);
      }

      await database.disconnect();
      await redis.disconnect();
      logger.info('Application stopped gracefully');
    } catch (error) {
      logger.error('Error during shutdown', { error });
      process.exit(1);
    }
  }
}

// Create and start application
const application = new App();

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await application.stop();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await application.stop();
  process.exit(0);
});

// Start the application
application.start();

export default application;
