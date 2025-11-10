import { Router, Request, Response, NextFunction } from 'express';
import { CreditService } from '../application/services/CreditService';
import { CreditEntryRepository } from '../infrastructure/repositories/CreditEntryRepository';
import { CreditTransactionRepository } from '../infrastructure/repositories/CreditTransactionRepository';
import { ProjectRepository } from '../infrastructure/repositories/ProjectRepository';
import { UserRepository } from '../infrastructure/repositories/UserRepository';
import {
  CreditResponse,
  CreditListResponse,
  CreditEntryDto,
  CreditTransactionDto,
  CreditTransferResponse,
  CreditTransactionHistoryResponse,
  creditListQuerySchema,
  userCreditsQuerySchema,
  creditTransferRequestSchema,
} from '../application/dto/credit.dto';
import { authenticate } from '../middleware/authenticate';
import { authorize, requireAdmin } from '../middleware/authorize';
import { UserRole } from '../domain/entities/User';
import { Resource, Action } from '../middleware/permissions';
import { logger } from '../utils/logger';
import { CardanoMintingService } from '../domain/services/CardanoMintingService';
import { MintingTransactionRepositoryPg } from '../infrastructure/repositories/MintingTransactionRepositoryPg';
import { getPlatformWalletService } from '../config/platformWallet';
import { CardanoWalletRepository } from '../infrastructure/repositories/CardanoWalletRepository';
import { CreditFilters, PaginationOptions } from '../application/services/CreditService';
import { CreditEntry } from '../domain/entities/CreditEntry';
import { CardanoTransactionService } from '../domain/services/CardanoTransactionService';
import { InMemoryBlockchainTransactionRepository } from '../domain/repositories/IBlockchainTransactionRepository';

const router = Router();

// Helper function to map credit to DTO
const mapCreditToDto = (credit: CreditEntry): CreditEntryDto => ({
  id: credit.id,
  creditId: credit.creditId,
  projectId: credit.projectId,
  ownerId: credit.ownerId,
  quantity: credit.quantity,
  vintage: credit.vintage,
  status: credit.status,
  issuedAt: credit.issuedAt.toISOString(),
  lastActionAt: credit.lastActionAt.toISOString(),
  createdAt: credit.createdAt.toISOString(),
  updatedAt: credit.updatedAt.toISOString(),
  policyId: credit.policyId,
  assetName: credit.assetName,
  mintTxHash: credit.mintTxHash,
  tokenMetadata: credit.tokenMetadata,
});

// Lazy initialization to avoid database connection issues at module load
export const getCreditService = () => {
  const creditEntryRepository = new CreditEntryRepository();
  const creditTransactionRepository = new CreditTransactionRepository();
  const projectRepository = new ProjectRepository();
  const userRepository = new UserRepository();

  // Initialize Cardano minting service for token minting
  let cardanoMintingService: CardanoMintingService | undefined;
  try {
    logger.info('Initializing Cardano minting service...');
    const mintingTxRepository = new MintingTransactionRepositoryPg();
    logger.info('✅ Minting transaction repository created');

    logger.info('Attempting to get platform wallet service...');
    let platformWalletService;
    try {
      platformWalletService = getPlatformWalletService();
      logger.info('✅ Platform wallet service retrieved successfully', {
        hasService: !!platformWalletService,
      });
    } catch (walletError) {
      logger.error('Failed to get platform wallet service', {
        error:
          walletError instanceof Error
            ? {
                message: walletError.message,
                stack: walletError.stack,
                name: walletError.name,
              }
            : walletError,
      });
      throw walletError; // Re-throw to be caught by outer catch
    }

    logger.info('Creating CardanoMintingService instance...');
    cardanoMintingService = new CardanoMintingService(mintingTxRepository, platformWalletService);
    logger.info('✅ Cardano minting service initialized successfully for credit issuance', {
      hasMintingService: !!cardanoMintingService,
    });
  } catch (error) {
    logger.error(
      'Failed to initialize Cardano minting service - credits will be issued without token minting',
      {
        error:
          error instanceof Error
            ? {
                message: error.message,
                stack: error.stack,
                name: error.name,
              }
            : error,
        errorString: String(error),
        errorType: typeof error,
      }
    );
    // Continue without minting service - credits will still be issued in database
    cardanoMintingService = undefined;
  }

  // Initialize wallet repository to fetch wallet addresses from cardano_wallets table
  const walletRepository = new CardanoWalletRepository();

  // Initialize Cardano transaction service for optional transfer metadata recording
  let cardanoTransactionService: CardanoTransactionService | undefined;
  try {
    logger.info('Initializing Cardano transaction service for transfer metadata recording...');
    const blockchainTxRepository = new InMemoryBlockchainTransactionRepository();
    const platformWalletService = getPlatformWalletService();
    cardanoTransactionService = new CardanoTransactionService(
      platformWalletService,
      blockchainTxRepository
    );
    logger.info('✅ Cardano transaction service initialized successfully');
  } catch (error) {
    logger.warn(
      'Failed to initialize Cardano transaction service - transfer metadata recording will be skipped',
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    );
    cardanoTransactionService = undefined;
  }

  return new CreditService(
    creditEntryRepository,
    creditTransactionRepository,
    projectRepository,
    userRepository,
    cardanoMintingService,
    walletRepository,
    cardanoTransactionService
  );
};

/**
 * @swagger
 * /api/v1/credits/{id}:
 *   get:
 *     summary: Get credit by ID
 *     tags: [Credits]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Credit entry ID
 *     responses:
 *       200:
 *         description: Credit retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     credit:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           format: uuid
 *                         creditId:
 *                           type: string
 *                           example: KRB-2024-001-000001
 *                         projectId:
 *                           type: string
 *                           format: uuid
 *                         ownerId:
 *                           type: string
 *                           format: uuid
 *                         quantity:
 *                           type: number
 *                           example: 1000.00
 *                         vintage:
 *                           type: integer
 *                           example: 2024
 *                         status:
 *                           type: string
 *                           enum: [active, transferred, retired]
 *                         issuedAt:
 *                           type: string
 *                           format: date-time
 *                         lastActionAt:
 *                           type: string
 *                           format: date-time
 *                         createdAt:
 *                           type: string
 *                           format: date-time
 *                         updatedAt:
 *                           type: string
 *                           format: date-time
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Users can only access their own credits
 *       404:
 *         description: Credit not found
 */
router.get(
  '/:id',
  authenticate,
  authorize(Resource.CREDIT, Action.READ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const creditId = req.params.id;
      const userId = req.user!.id;
      const userRole = req.user!.role as UserRole;

      const creditService = getCreditService();
      const credit = await creditService.getCreditById(creditId);

      if (!credit) {
        return res.status(404).json({
          status: 'error',
          code: 'NOT_FOUND',
          title: 'Credit Not Found',
          detail: 'The requested credit does not exist',
          meta: {
            timestamp: new Date().toISOString(),
            requestId: (req.headers['x-request-id'] as string) || 'unknown',
          },
        });
      }

      // Apply row-level security (Requirement 8.9: Users can only access their own credits)
      if (userRole !== UserRole.ADMINISTRATOR && credit.ownerId !== userId) {
        logger.warn('Unauthorized credit access attempt', {
          userId,
          userRole,
          creditId,
          creditOwnerId: credit.ownerId,
        });

        return res.status(403).json({
          status: 'error',
          code: 'FORBIDDEN',
          title: 'Access Denied',
          detail: 'You do not have permission to view this credit',
          meta: {
            timestamp: new Date().toISOString(),
            requestId: (req.headers['x-request-id'] as string) || 'unknown',
          },
        });
      }

      const creditDto = mapCreditToDto(credit);

      const response: CreditResponse = {
        status: 'success',
        data: {
          credit: creditDto,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: (req.headers['x-request-id'] as string) || 'unknown',
        },
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Error retrieving credit', {
        error,
        creditId: req.params.id,
        userId: req.user?.id,
      });
      return next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/credits:
 *   get:
 *     summary: List credits with filters and pagination
 *     tags: [Credits]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, transferred, retired]
 *         description: Filter by credit status
 *       - in: query
 *         name: vintage
 *         schema:
 *           type: integer
 *           minimum: 2000
 *           maximum: 2100
 *         description: Filter by vintage year
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of credits to return
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *         description: Cursor for pagination
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [created_at, updated_at, issued_at, vintage, quantity]
 *           default: created_at
 *         description: Field to sort by
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Credits retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     credits:
 *                       type: array
 *                       items:
 *                         type: object
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         cursor:
 *                           type: string
 *                           nullable: true
 *                         hasMore:
 *                           type: boolean
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/',
  authenticate,
  authorize(Resource.CREDIT, Action.READ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const userRole = req.user!.role as UserRole;

      // Validate query parameters
      const queryValidation = creditListQuerySchema.safeParse(req.query);
      if (!queryValidation.success) {
        return res.status(400).json({
          status: 'error',
          code: 'VALIDATION_ERROR',
          title: 'Invalid Query Parameters',
          detail: queryValidation.error.errors
            .map((e) => `${e.path.join('.')}: ${e.message}`)
            .join(', '),
          meta: {
            timestamp: new Date().toISOString(),
            requestId: (req.headers['x-request-id'] as string) || 'unknown',
          },
        });
      }

      const { status, vintage, limit, cursor, sortBy, sortOrder } = queryValidation.data;

      const filters: CreditFilters = {};
      if (status) filters.status = status;
      if (vintage) filters.vintage = vintage;

      const pagination: PaginationOptions = {
        limit,
        cursor,
        sortBy,
        sortOrder,
      };

      // Apply filters based on query parameters
      if (status) {
        filters.status = status;
      }

      if (vintage) {
        filters.vintage = vintage;
      }

      // Apply row-level security (Requirement 8.9: Users can only access their own credits)
      if (userRole !== UserRole.ADMINISTRATOR) {
        filters.ownerId = userId;
      }

      const creditService = getCreditService();

      // Get credits with filters and pagination
      let credits;
      if (userRole === UserRole.ADMINISTRATOR) {
        // Administrators can see all credits
        credits = await creditService.getAllCredits(filters, pagination);
      } else {
        // All other users see only their own credits
        credits = await creditService.getCreditsByOwner(userId, filters, pagination);
      }

      // Get total count for pagination
      const totalCount = await creditService.countCredits(filters);

      // Generate next cursor from last item
      let nextCursor: string | null = null;
      if (credits.length === limit) {
        const lastCredit = credits[credits.length - 1];

        if (sortBy === 'created_at') {
          nextCursor = lastCredit.createdAt.toISOString();
        } else if (sortBy === 'updated_at') {
          nextCursor = lastCredit.updatedAt.toISOString();
        } else if (sortBy === 'issued_at') {
          nextCursor = lastCredit.issuedAt.toISOString();
        } else if (sortBy === 'vintage') {
          nextCursor = lastCredit.vintage.toString();
        } else if (sortBy === 'quantity') {
          nextCursor = lastCredit.quantity.toString();
        }
      }

      const creditsDto: CreditEntryDto[] = credits.map((credit) => ({
        id: credit.id,
        creditId: credit.creditId,
        projectId: credit.projectId,
        ownerId: credit.ownerId,
        quantity: credit.quantity,
        vintage: credit.vintage,
        status: credit.status,
        issuedAt: credit.issuedAt.toISOString(),
        lastActionAt: credit.lastActionAt.toISOString(),
        createdAt: credit.createdAt.toISOString(),
        updatedAt: credit.updatedAt.toISOString(),
      }));

      const response: CreditListResponse = {
        status: 'success',
        data: {
          credits: creditsDto,
          pagination: {
            total: totalCount,
            limit,
            cursor: nextCursor,
            hasMore: nextCursor !== null,
          },
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: (req.headers['x-request-id'] as string) || 'unknown',
        },
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Error listing credits', { error, userId: req.user?.id });
      return next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/users/{userId}/credits:
 *   get:
 *     summary: Get credits owned by a specific user
 *     tags: [Credits]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: User ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, transferred, retired]
 *         description: Filter by credit status
 *       - in: query
 *         name: vintage
 *         schema:
 *           type: integer
 *           minimum: 2000
 *           maximum: 2100
 *         description: Filter by vintage year
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of credits to return
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *         description: Cursor for pagination
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [created_at, updated_at, issued_at, vintage, quantity]
 *           default: created_at
 *         description: Field to sort by
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: User credits retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Users can only access their own credits
 *       404:
 *         description: User not found
 */
router.get(
  '/users/:userId/credits',
  authenticate,
  authorize(Resource.CREDIT, Action.READ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const targetUserId = req.params.userId;
      const currentUserId = req.user!.id;
      const userRole = req.user!.role as UserRole;

      // Apply row-level security (Requirement 8.9: Users can only access their own credits)
      if (userRole !== UserRole.ADMINISTRATOR && targetUserId !== currentUserId) {
        logger.warn('Unauthorized user credits access attempt', {
          currentUserId,
          targetUserId,
          userRole,
        });

        return res.status(403).json({
          status: 'error',
          code: 'FORBIDDEN',
          title: 'Access Denied',
          detail: 'You do not have permission to view credits for this user',
          meta: {
            timestamp: new Date().toISOString(),
            requestId: (req.headers['x-request-id'] as string) || 'unknown',
          },
        });
      }

      // Validate query parameters
      const queryValidation = userCreditsQuerySchema.safeParse(req.query);
      if (!queryValidation.success) {
        return res.status(400).json({
          status: 'error',
          code: 'VALIDATION_ERROR',
          title: 'Invalid Query Parameters',
          detail: queryValidation.error.errors
            .map((e) => `${e.path.join('.')}: ${e.message}`)
            .join(', '),
          meta: {
            timestamp: new Date().toISOString(),
            requestId: (req.headers['x-request-id'] as string) || 'unknown',
          },
        });
      }

      const { status, vintage, limit, cursor, sortBy, sortOrder } = queryValidation.data;

      const filters: CreditFilters = {};
      if (status) filters.status = status;
      if (vintage) filters.vintage = vintage;

      const pagination: PaginationOptions = {
        limit,
        cursor,
        sortBy,
        sortOrder,
      };

      // Apply filters based on query parameters
      if (status) {
        filters.status = status;
      }

      if (vintage) {
        filters.vintage = vintage;
      }

      const creditService = getCreditService();

      // Get credits for the specified user
      const credits = await creditService.getCreditsByOwner(targetUserId, filters, pagination);

      // Get total count for pagination
      const totalCount = await creditService.countCredits({ ...filters, ownerId: targetUserId });

      // Generate next cursor from last item
      let nextCursor: string | null = null;
      if (credits.length === limit) {
        const lastCredit = credits[credits.length - 1];

        if (sortBy === 'created_at') {
          nextCursor = lastCredit.createdAt.toISOString();
        } else if (sortBy === 'updated_at') {
          nextCursor = lastCredit.updatedAt.toISOString();
        } else if (sortBy === 'issued_at') {
          nextCursor = lastCredit.issuedAt.toISOString();
        } else if (sortBy === 'vintage') {
          nextCursor = lastCredit.vintage.toString();
        } else if (sortBy === 'quantity') {
          nextCursor = lastCredit.quantity.toString();
        }
      }

      const creditsDto: CreditEntryDto[] = credits.map((credit) => ({
        id: credit.id,
        creditId: credit.creditId,
        projectId: credit.projectId,
        ownerId: credit.ownerId,
        quantity: credit.quantity,
        vintage: credit.vintage,
        status: credit.status,
        issuedAt: credit.issuedAt.toISOString(),
        lastActionAt: credit.lastActionAt.toISOString(),
        createdAt: credit.createdAt.toISOString(),
        updatedAt: credit.updatedAt.toISOString(),
      }));

      const response: CreditListResponse = {
        status: 'success',
        data: {
          credits: creditsDto,
          pagination: {
            total: totalCount,
            limit,
            cursor: nextCursor,
            hasMore: nextCursor !== null,
          },
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: (req.headers['x-request-id'] as string) || 'unknown',
        },
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Error retrieving user credits', {
        error,
        targetUserId: req.params.userId,
        currentUserId: req.user?.id,
      });
      return next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/credits/{id}/transfer:
 *   post:
 *     summary: Transfer credits to another user
 *     tags: [Credits]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Credit entry ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - recipientId
 *               - quantity
 *             properties:
 *               recipientId:
 *                 type: string
 *                 format: uuid
 *                 description: ID of the user receiving the credits
 *               quantity:
 *                 type: number
 *                 minimum: 0.01
 *                 description: Quantity of credits to transfer
 *     responses:
 *       200:
 *         description: Credits transferred successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     credit:
 *                       type: object
 *                       description: Updated credit entry
 *                     transaction:
 *                       type: object
 *                       description: Transfer transaction record
 *       400:
 *         description: Bad Request - Invalid input or validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - User does not own the credit
 *       404:
 *         description: Credit or recipient not found
 */
router.post(
  '/:id/transfer',
  authenticate,
  authorize(Resource.CREDIT, Action.UPDATE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const creditId = req.params.id;
      const userId = req.user!.id;

      // Validate request body
      const bodyValidation = creditTransferRequestSchema.safeParse(req.body);
      if (!bodyValidation.success) {
        return res.status(400).json({
          status: 'error',
          code: 'VALIDATION_ERROR',
          title: 'Invalid Request Body',
          detail: bodyValidation.error.errors
            .map((e) => `${e.path.join('.')}: ${e.message}`)
            .join(', '),
          source: {
            pointer: bodyValidation.error.errors.map((e) => `/data/${e.path.join('/')}`),
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: (req.headers['x-request-id'] as string) || 'unknown',
          },
        });
      }

      const { recipientId, quantity } = bodyValidation.data;

      // Validate user is not transferring to themselves
      if (recipientId === userId) {
        return res.status(400).json({
          status: 'error',
          code: 'VALIDATION_ERROR',
          title: 'Invalid Transfer',
          detail: 'Cannot transfer credits to yourself',
          meta: {
            timestamp: new Date().toISOString(),
            requestId: (req.headers['x-request-id'] as string) || 'unknown',
          },
        });
      }

      const creditService = getCreditService();

      // Transfer credits (Requirements 6.1-6.8)
      const { creditEntry, transaction } = await creditService.transferCredits(
        creditId,
        userId,
        recipientId,
        quantity
      );

      // Convert to DTOs
      const creditDto = mapCreditToDto(creditEntry);

      const transactionDto: CreditTransactionDto = {
        id: transaction.id,
        creditId: transaction.creditId,
        transactionType: transaction.transactionType,
        senderId: transaction.senderId,
        recipientId: transaction.recipientId,
        quantity: transaction.quantity,
        status: transaction.status,
        blockchainTxHash: transaction.blockchainTxHash,
        metadata: transaction.metadata,
        createdAt: transaction.createdAt.toISOString(),
        completedAt: transaction.completedAt?.toISOString(),
      };

      const response: CreditTransferResponse = {
        status: 'success',
        data: {
          credit: creditDto,
          transaction: transactionDto,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: (req.headers['x-request-id'] as string) || 'unknown',
        },
      };

      res.status(200).json(response);
    } catch (error: unknown) {
      logger.error('Error transferring credits', {
        error:
          error instanceof Error
            ? {
                message: error.message,
                stack: error.stack,
                name: error.name,
              }
            : error,
        creditId: req.params.id,
        userId: req.user?.id,
        body: req.body,
      });

      // Handle specific error cases
      if (error instanceof Error && error.message === 'Credit not found') {
        return res.status(404).json({
          status: 'error',
          code: 'NOT_FOUND',
          title: 'Credit Not Found',
          detail: 'The requested credit does not exist',
          meta: {
            timestamp: new Date().toISOString(),
            requestId: (req.headers['x-request-id'] as string) || 'unknown',
          },
        });
      }

      if (error instanceof Error && error.message === 'Recipient user not found') {
        return res.status(404).json({
          status: 'error',
          code: 'NOT_FOUND',
          title: 'Recipient Not Found',
          detail: 'The recipient user does not exist',
          meta: {
            timestamp: new Date().toISOString(),
            requestId: (req.headers['x-request-id'] as string) || 'unknown',
          },
        });
      }

      if (error instanceof Error && error.message === 'You do not own this credit') {
        return res.status(403).json({
          status: 'error',
          code: 'FORBIDDEN',
          title: 'Access Denied',
          detail: 'You do not have permission to transfer this credit',
          meta: {
            timestamp: new Date().toISOString(),
            requestId: (req.headers['x-request-id'] as string) || 'unknown',
          },
        });
      }

      if (
        error instanceof Error &&
        (error.message === 'Credit must be active to transfer' ||
          error.message === 'Transfer quantity must be positive' ||
          error.message === 'Transfer quantity exceeds owned amount')
      ) {
        return res.status(400).json({
          status: 'error',
          code: 'VALIDATION_ERROR',
          title: 'Invalid Transfer',
          detail: error.message,
          meta: {
            timestamp: new Date().toISOString(),
            requestId: (req.headers['x-request-id'] as string) || 'unknown',
          },
        });
      }

      return next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/credits/{id}/retire:
 *   post:
 *     summary: Retire credits permanently with COT token burning
 *     tags: [Credits]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Credit entry ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - quantity
 *               - reason
 *             properties:
 *               quantity:
 *                 type: number
 *                 minimum: 0.01
 *                 description: Quantity of credits to retire
 *               reason:
 *                 type: string
 *                 minLength: 1
 *                 description: Reason for retirement
 *     responses:
 *       200:
 *         description: Credits retired successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     credit:
 *                       type: object
 *                       description: Updated credit entry
 *                     transaction:
 *                       type: object
 *                       description: Retirement transaction record
 *                     burnTxHash:
 *                       type: string
 *                       description: COT token burn transaction hash
 *                     explorerUrl:
 *                       type: string
 *                       description: Cardano Preview explorer link
 *       400:
 *         description: Bad Request - Invalid input or validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - User does not own the credit
 *       404:
 *         description: Credit not found
 */
router.post(
  '/:id/retire',
  authenticate,
  authorize(Resource.CREDIT, Action.UPDATE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const creditId = req.params.id;
      const userId = req.user!.id;

      // Validate request body
      const { quantity, reason } = req.body;

      if (!quantity || quantity <= 0) {
        return res.status(400).json({
          status: 'error',
          code: 'VALIDATION_ERROR',
          title: 'Invalid Request Body',
          detail: 'Quantity must be positive',
          meta: {
            timestamp: new Date().toISOString(),
            requestId: (req.headers['x-request-id'] as string) || 'unknown',
          },
        });
      }

      if (!reason || reason.trim().length === 0) {
        return res.status(400).json({
          status: 'error',
          code: 'VALIDATION_ERROR',
          title: 'Invalid Request Body',
          detail: 'Retirement reason is required',
          meta: {
            timestamp: new Date().toISOString(),
            requestId: (req.headers['x-request-id'] as string) || 'unknown',
          },
        });
      }

      const creditService = getCreditService();

      // Retire credits (Requirements 7.1-7.20)
      const { creditEntry, transaction, burnTxHash } = await creditService.retireCredits(
        creditId,
        userId,
        quantity,
        reason
      );

      // Convert to DTOs
      const creditDto = mapCreditToDto(creditEntry);

      const transactionDto: CreditTransactionDto = {
        id: transaction.id,
        creditId: transaction.creditId,
        transactionType: transaction.transactionType,
        senderId: transaction.senderId,
        recipientId: transaction.recipientId,
        quantity: transaction.quantity,
        status: transaction.status,
        blockchainTxHash: transaction.blockchainTxHash,
        metadata: transaction.metadata,
        createdAt: transaction.createdAt.toISOString(),
        completedAt: transaction.completedAt?.toISOString(),
      };

      // Generate Cardano Preview explorer link
      const explorerUrl = burnTxHash
        ? `https://preview.cardanoscan.io/transaction/${burnTxHash}`
        : undefined;

      const response = {
        status: 'success',
        data: {
          credit: creditDto,
          transaction: transactionDto,
          burnTxHash,
          explorerUrl,
          certificate: {
            id: transaction.id,
            creditId: creditEntry.creditId,
            quantity: transaction.quantity,
            reason,
            retiredAt: transaction.completedAt?.toISOString(),
            blockchainProof: burnTxHash,
            explorerUrl,
          },
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: (req.headers['x-request-id'] as string) || 'unknown',
        },
      };

      res.status(200).json(response);
    } catch (error: unknown) {
      logger.error('Error retiring credits', {
        error,
        creditId: req.params.id,
        userId: req.user?.id,
        body: req.body,
      });

      // Handle specific error cases
      if (error instanceof Error && error.message === 'Credit not found') {
        return res.status(404).json({
          status: 'error',
          code: 'NOT_FOUND',
          title: 'Credit Not Found',
          detail: 'The requested credit does not exist',
          meta: {
            timestamp: new Date().toISOString(),
            requestId: (req.headers['x-request-id'] as string) || 'unknown',
          },
        });
      }

      if (error instanceof Error && error.message === 'You do not own this credit') {
        return res.status(403).json({
          status: 'error',
          code: 'FORBIDDEN',
          title: 'Access Denied',
          detail: 'You do not have permission to retire this credit',
          meta: {
            timestamp: new Date().toISOString(),
            requestId: (req.headers['x-request-id'] as string) || 'unknown',
          },
        });
      }

      if (
        error instanceof Error &&
        (error.message === 'Credit must be active to retire' ||
          error.message === 'Retirement quantity must be positive' ||
          error.message === 'Retirement quantity exceeds owned amount' ||
          error.message === 'Retirement reason is required')
      ) {
        return res.status(400).json({
          status: 'error',
          code: 'VALIDATION_ERROR',
          title: 'Invalid Retirement',
          detail: error.message,
          meta: {
            timestamp: new Date().toISOString(),
            requestId: (req.headers['x-request-id'] as string) || 'unknown',
          },
        });
      }

      if (error instanceof Error && error.message.includes('Unable to burn COT tokens')) {
        return res.status(500).json({
          status: 'error',
          code: 'BLOCKCHAIN_ERROR',
          title: 'Token Burning Failed',
          detail: error.message,
          meta: {
            timestamp: new Date().toISOString(),
            requestId: (req.headers['x-request-id'] as string) || 'unknown',
          },
        });
      }

      return next(error);
    }
  }
);

// Admin endpoint to manually trigger credit issuance (for debugging)
router.post(
  '/admin/issue-credits',
  authenticate,
  requireAdmin,
  async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const { projectId, verificationId } = req.body;

      if (!projectId || !verificationId) {
        return res.status(400).json({
          status: 'error',
          code: 'VALIDATION_ERROR',
          title: 'Missing Required Fields',
          detail: 'projectId and verificationId are required',
          meta: {
            timestamp: new Date().toISOString(),
            requestId: (req.headers['x-request-id'] as string) || 'unknown',
          },
        });
      }

      const creditService = getCreditService();
      const { creditEntry, transaction } = await creditService.issueCredits(
        projectId,
        verificationId
      );

      const response: CreditResponse = {
        status: 'success',
        data: {
          credit: mapCreditToDto(creditEntry),
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: (req.headers['x-request-id'] as string) || 'unknown',
        },
      };

      logger.info('Manual credit issuance completed', {
        creditId: creditEntry.creditId,
        transactionId: transaction.id,
        projectId,
        verificationId,
      });

      return res.status(201).json(response);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'An error occurred while issuing credits';
      logger.error('Error in manual credit issuance', {
        error:
          error instanceof Error
            ? {
                message: error.message,
                stack: error.stack,
                name: error.name,
              }
            : error,
        body: req.body,
      });
      return res.status(500).json({
        status: 'error',
        code: 'INTERNAL_ERROR',
        title: 'Credit Issuance Failed',
        detail: errorMessage,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: (req.headers['x-request-id'] as string) || 'unknown',
        },
      });
    }
  }
);

/**
 * @swagger
 * /api/v1/credits/{id}/transactions:
 *   get:
 *     summary: Get transaction history for a credit
 *     tags: [Credits]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Credit entry ID
 *     responses:
 *       200:
 *         description: Transaction history retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     transactions:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                           creditId:
 *                             type: string
 *                             format: uuid
 *                           transactionType:
 *                             type: string
 *                             enum: [issuance, transfer, retirement]
 *                           senderId:
 *                             type: string
 *                             format: uuid
 *                             nullable: true
 *                           recipientId:
 *                             type: string
 *                             format: uuid
 *                             nullable: true
 *                           quantity:
 *                             type: number
 *                             example: 1000.00
 *                           status:
 *                             type: string
 *                             enum: [pending, completed, failed]
 *                           blockchainTxHash:
 *                             type: string
 *                             nullable: true
 *                             description: Cardano blockchain transaction hash if available
 *                           metadata:
 *                             type: object
 *                             nullable: true
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                           completedAt:
 *                             type: string
 *                             format: date-time
 *                             nullable: true
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Users can only access transaction history for their own credits
 *       404:
 *         description: Credit not found
 */
router.get(
  '/:id/transactions',
  authenticate,
  authorize(Resource.CREDIT, Action.READ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const creditId = req.params.id;
      const userId = req.user!.id;
      const userRole = req.user!.role as UserRole;

      const creditService = getCreditService();

      // First, verify the credit exists and user has access to it
      const credit = await creditService.getCreditById(creditId);

      if (!credit) {
        return res.status(404).json({
          status: 'error',
          code: 'NOT_FOUND',
          title: 'Credit Not Found',
          detail: 'The requested credit does not exist',
          meta: {
            timestamp: new Date().toISOString(),
            requestId: (req.headers['x-request-id'] as string) || 'unknown',
          },
        });
      }

      // Apply row-level security (Users can only access their own credits)
      if (userRole !== UserRole.ADMINISTRATOR && credit.ownerId !== userId) {
        logger.warn('Unauthorized credit transaction history access attempt', {
          userId,
          userRole,
          creditId,
          creditOwnerId: credit.ownerId,
        });

        return res.status(403).json({
          status: 'error',
          code: 'FORBIDDEN',
          title: 'Access Denied',
          detail: 'You do not have permission to view transaction history for this credit',
          meta: {
            timestamp: new Date().toISOString(),
            requestId: (req.headers['x-request-id'] as string) || 'unknown',
          },
        });
      }

      // Get transaction history for the credit
      const transactions = await creditService.getTransactionHistory(creditId);

      // Convert to DTOs
      const transactionsDto: CreditTransactionDto[] = transactions.map((transaction) => ({
        id: transaction.id,
        creditId: transaction.creditId,
        transactionType: transaction.transactionType,
        senderId: transaction.senderId,
        recipientId: transaction.recipientId,
        quantity: transaction.quantity,
        status: transaction.status,
        blockchainTxHash: transaction.blockchainTxHash, // Include blockchain transaction hash if available
        metadata: transaction.metadata,
        createdAt: transaction.createdAt.toISOString(),
        completedAt: transaction.completedAt?.toISOString(),
      }));

      const response: CreditTransactionHistoryResponse = {
        status: 'success',
        data: {
          transactions: transactionsDto,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: (req.headers['x-request-id'] as string) || 'unknown',
        },
      };

      logger.info('Transaction history retrieved successfully', {
        creditId,
        userId,
        transactionCount: transactions.length,
      });

      res.status(200).json(response);
    } catch (error) {
      logger.error('Error retrieving credit transaction history', {
        error,
        creditId: req.params.id,
        userId: req.user?.id,
      });
      return next(error);
    }
  }
);

export const creditsRouter = router;
