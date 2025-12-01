/**
 * Admin COT Management Routes
 *
 * Provides administrative endpoints for monitoring and managing COT operations
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { Resource, Action } from '../../middleware/permissions';
import { cotErrorHandler } from '../../infrastructure/services/COTErrorHandler';
import { cotMonitoringService } from '../../infrastructure/services/COTMonitoringService';
import { logger } from '../../utils/logger';

const router = Router();

/**
 * @swagger
 * /api/v1/admin/cot/metrics:
 *   get:
 *     summary: Get COT operation metrics
 *     tags: [Admin, COT]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: COT metrics retrieved successfully
 */
router.get(
  '/metrics',
  authenticate,
  authorize(Resource.ADMIN, Action.READ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const metrics = cotMonitoringService.getMetrics();
      const health = cotMonitoringService.getHealthStatus();

      res.status(200).json({
        status: 'success',
        data: {
          metrics,
          health,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: (req.headers['x-request-id'] as string) || 'unknown',
        },
      });
    } catch (error) {
      logger.error('Error retrieving COT metrics', { error });
      return next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/admin/cot/metrics/export:
 *   get:
 *     summary: Export COT metrics in Prometheus format
 *     tags: [Admin, COT]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Metrics exported successfully
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 */
router.get(
  '/metrics/export',
  authenticate,
  authorize(Resource.ADMIN, Action.READ),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const metricsText = cotMonitoringService.exportMetrics();

      res.setHeader('Content-Type', 'text/plain');
      res.status(200).send(metricsText);
    } catch (error) {
      logger.error('Error exporting COT metrics', { error });
      return next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/admin/cot/failures:
 *   get:
 *     summary: Get failed COT operations
 *     tags: [Admin, COT]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Failed operations retrieved successfully
 */
router.get(
  '/failures',
  authenticate,
  authorize(Resource.ADMIN, Action.READ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const failedOperations = cotErrorHandler.getFailedOperations();
      const stats = cotErrorHandler.getFailedOperationStats();
      const recentFailures = cotMonitoringService.getRecentFailures(20);

      res.status(200).json({
        status: 'success',
        data: {
          queuedOperations: failedOperations,
          stats,
          recentFailures,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: (req.headers['x-request-id'] as string) || 'unknown',
        },
      });
    } catch (error) {
      logger.error('Error retrieving failed COT operations', { error });
      return next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/admin/cot/failures/{operationId}/resolve:
 *   post:
 *     summary: Mark a failed operation as resolved
 *     tags: [Admin, COT]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: operationId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Operation marked as resolved
 */
router.post(
  '/failures/:operationId/resolve',
  authenticate,
  authorize(Resource.ADMIN, Action.UPDATE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { operationId } = req.params;

      const resolved = cotErrorHandler.resolveFailedOperation(operationId);

      if (!resolved) {
        return res.status(404).json({
          status: 'error',
          code: 'NOT_FOUND',
          title: 'Operation Not Found',
          detail: 'The specified failed operation was not found',
          meta: {
            timestamp: new Date().toISOString(),
            requestId: (req.headers['x-request-id'] as string) || 'unknown',
          },
        });
      }

      logger.info('Failed COT operation marked as resolved', {
        operationId,
        resolvedBy: req.user?.id,
      });

      res.status(200).json({
        status: 'success',
        data: {
          message: 'Operation marked as resolved',
          operationId,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: (req.headers['x-request-id'] as string) || 'unknown',
        },
      });
    } catch (error) {
      logger.error('Error resolving failed COT operation', { error });
      return next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/admin/cot/health:
 *   get:
 *     summary: Get COT system health status
 *     tags: [Admin, COT]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Health status retrieved successfully
 */
router.get(
  '/health',
  authenticate,
  authorize(Resource.ADMIN, Action.READ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const health = cotMonitoringService.getHealthStatus();
      const failedStats = cotErrorHandler.getFailedOperationStats();

      res.status(200).json({
        status: 'success',
        data: {
          health,
          failedOperationsQueue: failedStats,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: (req.headers['x-request-id'] as string) || 'unknown',
        },
      });
    } catch (error) {
      logger.error('Error retrieving COT health status', { error });
      return next(error);
    }
  }
);

export const cotAdminRouter = router;
