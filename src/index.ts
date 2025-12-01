import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { config } from './config';
import { swaggerSpec } from './config/swagger';
import { database } from './config/database';
import { redis } from './config/redis';
import { initializePlatformWallet, validatePlatformWalletConfig } from './config/platformWallet';
import { logger } from './utils/logger';
import { healthRouter } from './routes/health';
import { authRouter } from './routes/auth';
import { walletRouter } from './routes/wallet';
import { projectsRouter } from './routes/projects';
import { projectDocumentsRouter } from './routes/projectDocuments';
import { verificationsRouter } from './routes/verifications';
import { creditsRouter } from './routes/credits';
import { adminUsersRouter } from './routes/admin/users';
import { cotAdminRouter } from './routes/admin/cot';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { startSessionCleanupScheduler, stopSessionCleanupScheduler } from './utils/sessionCleanup';

import { InMemoryBlockchainTransactionRepository } from './domain/repositories/IBlockchainTransactionRepository';
import { CardanoTransactionService } from './domain/services/CardanoTransactionService';
import { PlatformWalletService } from './infrastructure/services/PlatformWalletService';
import { FileDevVaultService } from './infrastructure/services/VaultService';



class App {
  public app: Application;
  private sessionCleanupInterval?: NodeJS.Timeout;
  public cardanoTransactionService?: CardanoTransactionService; // Add this line

  constructor() {
    this.app = express();
    this.initializeMiddleware();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private initializeMiddleware(): void {
    // Security middleware
    this.app.use(helmet());

    // SECURITY FIX: Configure CORS to only allow requests from trusted origins
    this.app.use(cors({
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      credentials: true,
      optionsSuccessStatus: 200,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }));

    // Body parsing middleware with size limits to prevent DoS
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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
    this.app.get('/api-docs.json', (_req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.send(swaggerSpec);
    });

    // API routes
    this.app.use(`/api/${config.apiVersion}/auth`, authRouter);
    this.app.use(`/api/${config.apiVersion}/users/me/wallet`, walletRouter);
    this.app.use(`/api/${config.apiVersion}/projects`, projectsRouter);
    this.app.use(`/api/${config.apiVersion}/projects`, projectDocumentsRouter);
    this.app.use(`/api/${config.apiVersion}/verifications`, verificationsRouter);
    this.app.use(`/api/${config.apiVersion}/credits`, creditsRouter);
    this.app.use(`/api/${config.apiVersion}`, creditsRouter); // For /users/:userId/credits endpoint
    this.app.use(`/api/${config.apiVersion}/admin/users`, adminUsersRouter);
    this.app.use(`/api/${config.apiVersion}/admin/cot`, cotAdminRouter);
  }

  private initializeErrorHandling(): void {
    this.app.use(errorHandler);
  }

  public async start(): Promise<void> {
    try {
      // Validate platform wallet configuration
      validatePlatformWalletConfig();
      logger.info('Platform wallet configuration validated');

      // Connect to database
      await database.connect();
      logger.info('Database connected successfully');

      // Connect to Redis
      await redis.connect();
      logger.info('Redis connected successfully');

      // Initialize platform wallet
      await initializePlatformWallet();
      logger.info('Platform wallet initialized successfully');

      // Initialize services
      const blockchainTxRepo = new InMemoryBlockchainTransactionRepository();

      // Create VaultService
      const vaultService = new FileDevVaultService();

      // Create PlatformWalletConfig
      const platformWalletConfig = {
        walletName: 'platform-wallet',
        vaultKeyPrefix: 'cardano-platform',
        minBalanceThreshold: 5000000, // 5 ADA in lovelace
        alertThreshold: 10000000, // 10 ADA in lovelace
      };

      // Create PlatformWalletService with required arguments
      const platformWalletService = new PlatformWalletService(vaultService, platformWalletConfig);

      // Create CardanoTransactionService
      this.cardanoTransactionService = new CardanoTransactionService(
        platformWalletService,
        blockchainTxRepo
      );

      logger.info('Cardano transaction service initialized successfully');

      // Start monitoring pending transactions on startup
      if (this.cardanoTransactionService) {
        await this.cardanoTransactionService.startMonitoringPendingTransactions();
      }

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

      // Stop all transaction monitoring
      if (this.cardanoTransactionService) {
        this.cardanoTransactionService.stopAllMonitoring();
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

export { application };
