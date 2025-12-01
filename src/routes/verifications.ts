import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { VerificationService } from '../application/services/VerificationService';
import { VerificationRequestRepository } from '../infrastructure/repositories/VerificationRequestRepository';
import { VerificationEventRepository } from '../infrastructure/repositories/VerificationEventRepository';
import { VerificationDocumentRepository } from '../infrastructure/repositories/VerificationDocumentRepository';
import { UserRepository } from '../infrastructure/repositories/UserRepository';
import { ProjectRepository } from '../infrastructure/repositories/ProjectRepository';
import { ConsoleEmailService } from '../infrastructure/services/ConsoleEmailService';
import { StorageService } from '../infrastructure/services/StorageService';
// Import getCreditService to ensure minting service is properly initialized
import { getCreditService } from './credits';
import {
  VerificationDocumentResponse,
  VerificationDocumentListResponse,
  uploadVerificationDocumentSchema,
} from '../application/dto/verificationDocument.dto';
import {
  VerificationEventResponse,
  VerificationEventListResponse,
  createVerificationEventSchema,
} from '../application/dto/verificationEvent.dto';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { requireAdmin } from '../middleware/authorize';
import { Resource, Action } from '../middleware/permissions';
import { UserRole } from '../domain/entities/User';
import { logger } from '../utils/logger';
import { config } from '../config';
import { VerificationFilters, PaginationOptions } from '../domain/repositories/IVerificationRequestRepository';

const router = Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max i size
  },
  fileFilter: (_req, file, cb) => {
    // Allow common document types
    const allowedMimeTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg',
      'image/png',
      'image/gif',
      'text/plain',
      'text/csv',
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error('Invalid file type. Only PDF, Word, Excel, images, and text files are allowed.')
      );
    }
  },
});

// Lazy initialization to avoid database connection issues at module load
const getVerificationService = () => {
  const verificationRepository = new VerificationRequestRepository();
  const verificationEventRepository = new VerificationEventRepository();
  const verificationDocumentRepository = new VerificationDocumentRepository();
  const userRepository = new UserRepository();
  const projectRepository = new ProjectRepository();
  const emailService = new ConsoleEmailService();

  // Use getCreditService() to ensure minting service is properly initialized
  // This ensures COT tokens can be minted when credits are issued
  const creditService = getCreditService();

  return new VerificationService(
    verificationRepository,
    verificationEventRepository,
    verificationDocumentRepository,
    userRepository,
    emailService,
    projectRepository,
    creditService
  );
};

const getRepositories = () => {
  const verificationDocumentRepository = new VerificationDocumentRepository();
  const verificationRepository = new VerificationRequestRepository();
  const storageService = new StorageService();
  return { verificationDocumentRepository, verificationRepository, storageService };
};

const getVerificationRepository = () => {
  return new VerificationRequestRepository();
};

/**
 * @swagger
 * /api/v1/verifications:
 *   get:
 *     summary: List all verification requests with filters and pagination
 *     tags: [Verifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, in_review, approved, rejected]
 *         description: Filter by verification status
 *       - in: query
 *         name: developerId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by developer ID
 *       - in: query
 *         name: verifierId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by verifier ID
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           minimum: 1
 *           maximum: 100
 *         description: Number of results to return
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *         description: Cursor for pagination
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
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
 *         description: Verification requests retrieved successfully
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
 *                     verifications:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           projectId:
 *                             type: string
 *                           developerId:
 *                             type: string
 *                           verifierId:
 *                             type: string
 *                             nullable: true
 *                           status:
 *                             type: string
 *                           progress:
 *                             type: integer
 *                           submittedAt:
 *                             type: string
 *                             format: date-time
 *                           assignedAt:
 *                             type: string
 *                             format: date-time
 *                             nullable: true
 *                           completedAt:
 *                             type: string
 *                             format: date-time
 *                             nullable: true
 *                           notes:
 *                             type: string
 *                             nullable: true
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                           updatedAt:
 *                             type: string
 *                             format: date-time
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
 *       403:
 *         description: Forbidden
 */
router.get(
  '/',
  authenticate,
  authorize(Resource.VERIFICATION, Action.READ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const userRole = req.user!.role;

      const filters: VerificationFilters = {};
      const sortOrderQuery = req.query.sortOrder as string;

      // SECURITY: Whitelist allowed sort columns to prevent SQL injection
      const ALLOWED_SORT_COLUMNS = ['created_at', 'updated_at', 'submitted_at', 'assigned_at', 'completed_at', 'reviewed_at', 'status', 'id'];
      const requestedSortBy = req.query.sortBy as string;
      const validatedSortBy = ALLOWED_SORT_COLUMNS.includes(requestedSortBy)
        ? requestedSortBy
        : 'created_at';

      const pagination: PaginationOptions = {
        limit: parseInt(req.query.limit as string) || 20,
        cursor: req.query.cursor as string,
        sortBy: validatedSortBy,
        sortOrder: sortOrderQuery === 'asc' ? 'asc' : 'desc',
      };

      // Apply filters based on query parameters
      if (req.query.status) {
        filters.status = req.query.status as string;
      }

      if (req.query.developerId) {
        filters.developerId = req.query.developerId as string;
      }

      if (req.query.verifierId) {
        filters.verifierId = req.query.verifierId as string;
      }

      const verificationRepository = getVerificationRepository();
      let verifications;
      let totalCount;

      // Apply role-based filtering
      if (userRole === 'developer') {
        // Developers see only their own verification requests
        verifications = await verificationRepository.findByDeveloper(userId, filters, pagination);
        totalCount = await verificationRepository.count({ ...filters, developerId: userId });
      } else if (userRole === 'verifier') {
        // Verifiers see only their assigned verification requests
        verifications = await verificationRepository.findByVerifier(userId, filters, pagination);
        totalCount = await verificationRepository.count({ ...filters, verifierId: userId });
      } else {
        // Administrators see all verification requests
        verifications = await verificationRepository.findAll(filters, pagination);
        totalCount = await verificationRepository.count(filters);
      }

      // Generate next cursor from last item
      let nextCursor: string | null = null;
      if (verifications.length === pagination.limit) {
        const lastVerification = verifications[verifications.length - 1];
        const sortBy = pagination.sortBy || 'created_at';

        if (sortBy === 'created_at') {
          nextCursor = lastVerification.createdAt.toISOString();
        } else if (sortBy === 'updated_at') {
          nextCursor = lastVerification.updatedAt.toISOString();
        } else if (sortBy === 'submitted_at') {
          nextCursor = lastVerification.submittedAt.toISOString();
        }
      }

      const response = {
        status: 'success',
        data: {
          verifications: verifications.map((verification) => ({
            id: verification.id,
            projectId: verification.projectId,
            developerId: verification.developerId,
            verifierId: verification.verifierId,
            status: verification.status,
            progress: verification.progress,
            submittedAt: verification.submittedAt.toISOString(),
            assignedAt: verification.assignedAt ? verification.assignedAt.toISOString() : null,
            completedAt: verification.completedAt ? verification.completedAt.toISOString() : null,
            notes: verification.notes,
            createdAt: verification.createdAt.toISOString(),
            updatedAt: verification.updatedAt.toISOString(),
          })),
          pagination: {
            total: totalCount,
            limit: pagination.limit,
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
      return next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/verifications/{id}:
 *   get:
 *     summary: Get verification request by ID
 *     tags: [Verifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Verification request ID
 *     responses:
 *       200:
 *         description: Verification request retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Verification request not found
 */
router.get(
  '/:id',
  authenticate,
  authorize(Resource.VERIFICATION, Action.READ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const verificationId = req.params.id;
      const userId = req.user!.id;
      const userRole = req.user!.role;

      const verificationRepository = getVerificationRepository();
      const verification = await verificationRepository.findById(verificationId);

      if (!verification) {
        return res.status(404).json({
          status: 'error',
          code: 'NOT_FOUND',
          title: 'Verification Not Found',
          detail: 'The requested verification does not exist',
          meta: {
            timestamp: new Date().toISOString(),
            requestId: (req.headers['x-request-id'] as string) || 'unknown',
          },
        });
      }

      // Authorization: check if user can access this verification
      if (userRole === 'developer' && verification.developerId !== userId) {
        return res.status(403).json({
          status: 'error',
          code: 'FORBIDDEN',
          title: 'Access Denied',
          detail: 'You do not have permission to view this verification',
          meta: {
            timestamp: new Date().toISOString(),
            requestId: (req.headers['x-request-id'] as string) || 'unknown',
          },
        });
      }

      if (userRole === 'verifier' && verification.verifierId !== userId) {
        return res.status(403).json({
          status: 'error',
          code: 'FORBIDDEN',
          title: 'Access Denied',
          detail: 'You can only view verifications assigned to you',
          meta: {
            timestamp: new Date().toISOString(),
            requestId: (req.headers['x-request-id'] as string) || 'unknown',
          },
        });
      }

      const response = {
        status: 'success',
        data: {
          verification: {
            id: verification.id,
            projectId: verification.projectId,
            developerId: verification.developerId,
            verifierId: verification.verifierId,
            status: verification.status,
            progress: verification.progress,
            submittedAt: verification.submittedAt.toISOString(),
            assignedAt: verification.assignedAt ? verification.assignedAt.toISOString() : null,
            completedAt: verification.completedAt ? verification.completedAt.toISOString() : null,
            notes: verification.notes,
            createdAt: verification.createdAt.toISOString(),
            updatedAt: verification.updatedAt.toISOString(),
          },
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: (req.headers['x-request-id'] as string) || 'unknown',
        },
      };

      res.status(200).json(response);
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/verifications/{id}/assign:
 *   post:
 *     summary: Assign a verifier to a verification request
 *     tags: [Verifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Verification request ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - verifierId
 *             properties:
 *               verifierId:
 *                 type: string
 *                 format: uuid
 *                 description: ID of the verifier to assign
 *     responses:
 *       200:
 *         description: Verifier assigned successfully
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
 *                     verification:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         projectId:
 *                           type: string
 *                         developerId:
 *                           type: string
 *                         verifierId:
 *                           type: string
 *                         status:
 *                           type: string
 *                           enum: [pending, in_review, approved, rejected]
 *                         progress:
 *                           type: integer
 *                           minimum: 0
 *                           maximum: 100
 *                         submittedAt:
 *                           type: string
 *                           format: date-time
 *                         assignedAt:
 *                           type: string
 *                           format: date-time
 *                         completedAt:
 *                           type: string
 *                           format: date-time
 *                           nullable: true
 *                         notes:
 *                           type: string
 *                           nullable: true
 *                         createdAt:
 *                           type: string
 *                           format: date-time
 *                         updatedAt:
 *                           type: string
 *                           format: date-time
 *                 meta:
 *                   type: object
 *                   properties:
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                     requestId:
 *                       type: string
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Only administrators can assign verifiers
 *       404:
 *         description: Verification request or verifier not found
 */
router.post(
  '/:id/assign',
  authenticate,
  authorize(Resource.VERIFICATION, Action.ASSIGN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const verificationId = req.params.id;
      const { verifierId } = req.body;
      const userId = req.user!.id;
      const userRole = req.user!.role;

      // Validate request body
      if (!verifierId) {
        return res.status(400).json({
          status: 'error',
          code: 'VALIDATION_ERROR',
          title: 'Validation Failed',
          detail: 'verifierId is required',
          source: {
            pointer: '/data/attributes/verifierId',
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: (req.headers['x-request-id'] as string) || 'unknown',
          },
        });
      }

      const verificationService = getVerificationService();
      const verification = await verificationService.assignVerifier(
        verificationId,
        verifierId,
        userId,
        userRole as UserRole
      );

      const response = {
        status: 'success',
        data: {
          verification: {
            id: verification.id,
            projectId: verification.projectId,
            developerId: verification.developerId,
            verifierId: verification.verifierId,
            status: verification.status,
            progress: verification.progress,
            submittedAt: verification.submittedAt.toISOString(),
            assignedAt: verification.assignedAt ? verification.assignedAt.toISOString() : null,
            completedAt: verification.completedAt ? verification.completedAt.toISOString() : null,
            notes: verification.notes,
            createdAt: verification.createdAt.toISOString(),
            updatedAt: verification.updatedAt.toISOString(),
          },
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: (req.headers['x-request-id'] as string) || 'unknown',
        },
      };

      logger.info('Verifier assigned successfully', {
        verificationId,
        verifierId,
        assignedBy: userId,
      });

      res.status(200).json(response);
    } catch (error) {
      if (error instanceof Error) {
        // Handle not found errors
        if (
          error.message === 'Verification request not found' ||
          error.message === 'Verifier not found'
        ) {
          return res.status(404).json({
            status: 'error',
            code: 'NOT_FOUND',
            title: 'Not Found',
            detail: error.message,
            meta: {
              timestamp: new Date().toISOString(),
              requestId: (req.headers['x-request-id'] as string) || 'unknown',
            },
          });
        }

        // Handle authorization errors
        if (error.message.includes('Only administrators')) {
          return res.status(403).json({
            status: 'error',
            code: 'FORBIDDEN',
            title: 'Access Denied',
            detail: error.message,
            meta: {
              timestamp: new Date().toISOString(),
              requestId: (req.headers['x-request-id'] as string) || 'unknown',
            },
          });
        }

        // Handle validation errors
        if (error.message.includes('must have')) {
          return res.status(400).json({
            status: 'error',
            code: 'VALIDATION_ERROR',
            title: 'Validation Failed',
            detail: error.message,
            meta: {
              timestamp: new Date().toISOString(),
              requestId: (req.headers['x-request-id'] as string) || 'unknown',
            },
          });
        }
      }

      return next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/verifications/{id}/documents:
 *   post:
 *     summary: Upload a document for a verification request
 *     tags: [Verifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Verification request ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *               - name
 *               - documentType
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Document file (max 50MB)
 *               name:
 *                 type: string
 *                 maxLength: 255
 *                 description: Document name
 *               description:
 *                 type: string
 *                 maxLength: 1000
 *                 description: Document description (optional)
 *               documentType:
 *                 type: string
 *                 maxLength: 100
 *                 description: Type of document (e.g., project_description, methodology, baseline_assessment)
 *     responses:
 *       201:
 *         description: Document uploaded successfully
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
 *                     document:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         verificationId:
 *                           type: string
 *                         name:
 *                           type: string
 *                         description:
 *                           type: string
 *                           nullable: true
 *                         documentType:
 *                           type: string
 *                         fileUrl:
 *                           type: string
 *                         fileSize:
 *                           type: integer
 *                         mimeType:
 *                           type: string
 *                         uploadedBy:
 *                           type: string
 *                         uploadedAt:
 *                           type: string
 *                           format: date-time
 *       400:
 *         description: Validation error or invalid file
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Only assigned verifier, developer, or administrator can upload documents
 *       404:
 *         description: Verification request not found
 *       413:
 *         description: File too large
 */
router.post(
  '/:id/documents',
  authenticate,
  authorize(Resource.VERIFICATION, Action.UPDATE),
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const verificationId = req.params.id;
      const userId = req.user!.id;
      const userRole = req.user!.role;

      // Validate file was uploaded
      if (!req.file) {
        return res.status(400).json({
          status: 'error',
          code: 'VALIDATION_ERROR',
          title: 'Validation Failed',
          detail: 'File is required',
          meta: {
            timestamp: new Date().toISOString(),
            requestId: (req.headers['x-request-id'] as string) || 'unknown',
          },
        });
      }

      // Validate request body
      const validation = uploadVerificationDocumentSchema.safeParse({ body: req.body });
      if (!validation.success) {
        return res.status(400).json({
          status: 'error',
          code: 'VALIDATION_ERROR',
          title: 'Validation Failed',
          detail: validation.error.errors[0].message,
          source: {
            pointer: validation.error.errors[0].path.join('/'),
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: (req.headers['x-request-id'] as string) || 'unknown',
          },
        });
      }

      const { verificationRepository, storageService } = getRepositories();

      // Check if verification exists
      const verification = await verificationRepository.findById(verificationId);
      if (!verification) {
        return res.status(404).json({
          status: 'error',
          code: 'NOT_FOUND',
          title: 'Verification Not Found',
          detail: 'The requested verification does not exist',
          meta: {
            timestamp: new Date().toISOString(),
            requestId: (req.headers['x-request-id'] as string) || 'unknown',
          },
        });
      }

      // Upload file to storage
      logger.info('Uploading verification document to storage', {
        service: 'VerificationDocuments',
        verificationId,
        filename: req.file.originalname,
        size: req.file.size,
        mimeType: req.file.mimetype,
      });

      const uploadResult = await storageService.uploadFile({
        buffer: req.file.buffer,
        filename: req.file.originalname,
        mimeType: req.file.mimetype,
        folder: `verifications/${verificationId}`,
      });

      // Use verification service to upload document (handles authorization and timeline events)
      const verificationService = getVerificationService();
      const document = await verificationService.uploadDocument(
        verificationId,
        {
          verificationId,
          name: req.body.name,
          description: req.body.description,
          documentType: req.body.documentType,
          fileUrl: uploadResult.fileUrl,
          fileSize: uploadResult.fileSize,
          mimeType: req.file.mimetype,
          uploadedBy: userId,
        },
        userId,
        userRole as UserRole
      );

      logger.info('Verification document uploaded successfully', {
        service: 'VerificationDocuments',
        documentId: document.id,
        verificationId,
        userId,
      });

      const response: VerificationDocumentResponse = {
        status: 'success',
        data: {
          document: {
            id: document.id,
            verificationId: document.verificationId,
            name: document.name,
            description: document.description,
            documentType: document.documentType,
            fileUrl: document.fileUrl,
            fileSize: document.fileSize,
            mimeType: document.mimeType,
            uploadedBy: document.uploadedBy,
            uploadedAt: document.uploadedAt.toISOString(),
          },
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: (req.headers['x-request-id'] as string) || 'unknown',
        },
      };

      res.status(201).json(response);
    } catch (error) {
      if (error instanceof Error) {
        logger.error('Error uploading verification document', {
          service: 'VerificationDocuments',
          error: error.message,
          verificationId: req.params.id,
        });

        // Handle multer errors
        if (error.message.includes('File too large')) {
          return res.status(413).json({
            status: 'error',
            code: 'FILE_TOO_LARGE',
            title: 'File Too Large',
            detail: 'File size exceeds the maximum allowed size of 50MB',
            meta: {
              timestamp: new Date().toISOString(),
              requestId: (req.headers['x-request-id'] as string) || 'unknown',
            },
          });
        }

        if (error.message.includes('Invalid file type')) {
          return res.status(400).json({
            status: 'error',
            code: 'INVALID_FILE_TYPE',
            title: 'Invalid File Type',
            detail: error.message,
            meta: {
              timestamp: new Date().toISOString(),
              requestId: (req.headers['x-request-id'] as string) || 'unknown',
            },
          });
        }

        // Handle authorization errors
        if (error.message.includes('permission')) {
          return res.status(403).json({
            status: 'error',
            code: 'FORBIDDEN',
            title: 'Access Denied',
            detail: error.message,
            meta: {
              timestamp: new Date().toISOString(),
              requestId: (req.headers['x-request-id'] as string) || 'unknown',
            },
          });
        }

        // Handle not found errors
        if (error.message.includes('not found')) {
          return res.status(404).json({
            status: 'error',
            code: 'NOT_FOUND',
            title: 'Not Found',
            detail: error.message,
            meta: {
              timestamp: new Date().toISOString(),
              requestId: (req.headers['x-request-id'] as string) || 'unknown',
            },
          });
        }
      }

      return next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/verifications/{id}/documents:
 *   get:
 *     summary: Get all documents for a verification request
 *     tags: [Verifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Verification request ID
 *     responses:
 *       200:
 *         description: Documents retrieved successfully
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
 *                     documents:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           verificationId:
 *                             type: string
 *                           name:
 *                             type: string
 *                           description:
 *                             type: string
 *                             nullable: true
 *                           documentType:
 *                             type: string
 *                           fileUrl:
 *                             type: string
 *                           fileSize:
 *                             type: integer
 *                           mimeType:
 *                             type: string
 *                           uploadedBy:
 *                             type: string
 *                           uploadedAt:
 *                             type: string
 *                             format: date-time
 *                     count:
 *                       type: integer
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Verification request not found
 */
router.get(
  '/:id/documents',
  authenticate,
  authorize(Resource.VERIFICATION, Action.READ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const verificationId = req.params.id;
      const userId = req.user!.id;
      const userRole = req.user!.role;

      const { verificationDocumentRepository, verificationRepository } = getRepositories();

      // Check if verification exists
      const verification = await verificationRepository.findById(verificationId);
      if (!verification) {
        return res.status(404).json({
          status: 'error',
          code: 'NOT_FOUND',
          title: 'Verification Not Found',
          detail: 'The requested verification does not exist',
          meta: {
            timestamp: new Date().toISOString(),
            requestId: (req.headers['x-request-id'] as string) || 'unknown',
          },
        });
      }

      // Authorization: check if user can access this verification
      if (userRole === 'developer' && verification.developerId !== userId) {
        return res.status(403).json({
          status: 'error',
          code: 'FORBIDDEN',
          title: 'Access Denied',
          detail: 'You do not have permission to view documents for this verification',
          meta: {
            timestamp: new Date().toISOString(),
            requestId: (req.headers['x-request-id'] as string) || 'unknown',
          },
        });
      }

      if (userRole === 'verifier' && verification.verifierId !== userId) {
        return res.status(403).json({
          status: 'error',
          code: 'FORBIDDEN',
          title: 'Access Denied',
          detail: 'You can only view documents for verifications assigned to you',
          meta: {
            timestamp: new Date().toISOString(),
            requestId: (req.headers['x-request-id'] as string) || 'unknown',
          },
        });
      }

      // Get all documents for the verification
      const documents = await verificationDocumentRepository.findByVerification(verificationId);

      const response: VerificationDocumentListResponse = {
        status: 'success',
        data: {
          documents: documents.map((doc) => ({
            id: doc.id,
            verificationId: doc.verificationId,
            name: doc.name,
            description: doc.description,
            documentType: doc.documentType,
            fileUrl: doc.fileUrl,
            fileSize: doc.fileSize,
            mimeType: doc.mimeType,
            uploadedBy: doc.uploadedBy,
            uploadedAt: doc.uploadedAt.toISOString(),
          })),
          count: documents.length,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: (req.headers['x-request-id'] as string) || 'unknown',
        },
      };

      res.status(200).json(response);
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/verifications/{id}/timeline:
 *   post:
 *     summary: Add a timeline event to a verification request
 *     tags: [Verifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Verification request ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - eventType
 *               - message
 *             properties:
 *               eventType:
 *                 type: string
 *                 maxLength: 100
 *                 description: Type of event (e.g., comment, status_change, document_review)
 *               message:
 *                 type: string
 *                 maxLength: 1000
 *                 description: Event message or description
 *               metadata:
 *                 type: object
 *                 description: Additional event metadata (optional)
 *     responses:
 *       201:
 *         description: Timeline event created successfully
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
 *                     event:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         verificationId:
 *                           type: string
 *                         eventType:
 *                           type: string
 *                         message:
 *                           type: string
 *                         userId:
 *                           type: string
 *                         metadata:
 *                           type: object
 *                           nullable: true
 *                         createdAt:
 *                           type: string
 *                           format: date-time
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Only assigned verifier, developer, or administrator can add timeline events
 *       404:
 *         description: Verification request not found
 */
router.post(
  '/:id/timeline',
  authenticate,
  authorize(Resource.VERIFICATION, Action.UPDATE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const verificationId = req.params.id;
      const userId = req.user!.id;
      const userRole = req.user!.role;

      // Validate request body
      const validation = createVerificationEventSchema.safeParse({ body: req.body });
      if (!validation.success) {
        return res.status(400).json({
          status: 'error',
          code: 'VALIDATION_ERROR',
          title: 'Validation Failed',
          detail: validation.error.errors[0].message,
          source: {
            pointer: validation.error.errors[0].path.join('/'),
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: (req.headers['x-request-id'] as string) || 'unknown',
          },
        });
      }

      const { eventType, message, metadata } = req.body;

      const verificationService = getVerificationService();
      const event = await verificationService.addTimelineEvent(
        verificationId,
        eventType,
        message,
        userId,
        userRole as UserRole,
        metadata
      );

      const response: VerificationEventResponse = {
        status: 'success',
        data: {
          event: {
            id: event.id,
            verificationId: event.verificationId,
            eventType: event.eventType,
            message: event.message,
            userId: event.userId,
            metadata: event.metadata,
            createdAt: event.createdAt.toISOString(),
          },
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: (req.headers['x-request-id'] as string) || 'unknown',
        },
      };

      logger.info('Timeline event created successfully', {
        verificationId,
        eventId: event.id,
        eventType,
        userId,
      });

      res.status(201).json(response);
    } catch (error) {
      if (error instanceof Error) {
        logger.error('Error creating timeline event', {
          service: 'VerificationTimeline',
          error: error.message,
          verificationId: req.params.id,
        });

        // Handle not found errors
        if (error.message.includes('not found')) {
          return res.status(404).json({
            status: 'error',
            code: 'NOT_FOUND',
            title: 'Not Found',
            detail: error.message,
            meta: {
              timestamp: new Date().toISOString(),
              requestId: (req.headers['x-request-id'] as string) || 'unknown',
            },
          });
        }

        // Handle authorization errors
        if (error.message.includes('permission')) {
          return res.status(403).json({
            status: 'error',
            code: 'FORBIDDEN',
            title: 'Access Denied',
            detail: error.message,
            meta: {
              timestamp: new Date().toISOString(),
              requestId: (req.headers['x-request-id'] as string) || 'unknown',
            },
          });
        }
      }

      return next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/verifications/{id}/timeline:
 *   get:
 *     summary: Get timeline events for a verification request
 *     tags: [Verifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Verification request ID
 *     responses:
 *       200:
 *         description: Timeline events retrieved successfully
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
 *                     events:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           verificationId:
 *                             type: string
 *                           eventType:
 *                             type: string
 *                           message:
 *                             type: string
 *                           userId:
 *                             type: string
 *                           metadata:
 *                             type: object
 *                             nullable: true
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                     count:
 *                       type: integer
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Only assigned verifier, developer, or administrator can view timeline events
 *       404:
 *         description: Verification request not found
 */
router.get(
  '/:id/timeline',
  authenticate,
  authorize(Resource.VERIFICATION, Action.READ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const verificationId = req.params.id;
      const userId = req.user!.id;
      const userRole = req.user!.role;

      const verificationService = getVerificationService();
      const events = await verificationService.getTimelineEvents(
        verificationId,
        userId,
        userRole as UserRole
      );

      const response: VerificationEventListResponse = {
        status: 'success',
        data: {
          events: events.map((event) => ({
            id: event.id,
            verificationId: event.verificationId,
            eventType: event.eventType,
            message: event.message,
            userId: event.userId,
            metadata: event.metadata,
            createdAt: event.createdAt.toISOString(),
          })),
          count: events.length,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: (req.headers['x-request-id'] as string) || 'unknown',
        },
      };

      res.status(200).json(response);
    } catch (error) {
      if (error instanceof Error) {
        logger.error('Error retrieving timeline events', {
          service: 'VerificationTimeline',
          error: error.message,
          verificationId: req.params.id,
        });

        // Handle not found errors
        if (error.message.includes('not found')) {
          return res.status(404).json({
            status: 'error',
            code: 'NOT_FOUND',
            title: 'Not Found',
            detail: error.message,
            meta: {
              timestamp: new Date().toISOString(),
              requestId: (req.headers['x-request-id'] as string) || 'unknown',
            },
          });
        }

        // Handle authorization errors
        if (error.message.includes('permission')) {
          return res.status(403).json({
            status: 'error',
            code: 'FORBIDDEN',
            title: 'Access Denied',
            detail: error.message,
            meta: {
              timestamp: new Date().toISOString(),
              requestId: (req.headers['x-request-id'] as string) || 'unknown',
            },
          });
        }
      }

      return next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/verifications/{id}/approve:
 *   post:
 *     summary: Approve a verification request
 *     tags: [Verifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Verification request ID
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notes:
 *                 type: string
 *                 maxLength: 1000
 *                 description: Optional approval notes
 *     responses:
 *       200:
 *         description: Verification approved successfully
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
 *                     verification:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         projectId:
 *                           type: string
 *                         developerId:
 *                           type: string
 *                         verifierId:
 *                           type: string
 *                         status:
 *                           type: string
 *                           enum: [pending, in_review, approved, rejected]
 *                         progress:
 *                           type: integer
 *                           minimum: 0
 *                           maximum: 100
 *                         submittedAt:
 *                           type: string
 *                           format: date-time
 *                         assignedAt:
 *                           type: string
 *                           format: date-time
 *                         completedAt:
 *                           type: string
 *                           format: date-time
 *                         notes:
 *                           type: string
 *                           nullable: true
 *                         createdAt:
 *                           type: string
 *                           format: date-time
 *                         updatedAt:
 *                           type: string
 *                           format: date-time
 *                 meta:
 *                   type: object
 *                   properties:
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                     requestId:
 *                       type: string
 *       400:
 *         description: Validation error - insufficient documents or invalid status
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Only assigned verifier or administrator can approve
 *       404:
 *         description: Verification request not found
 */
router.post(
  '/:id/approve',
  authenticate,
  authorize(Resource.VERIFICATION, Action.APPROVE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const verificationId = req.params.id;
      const { notes } = req.body;
      const userId = req.user!.id;
      const userRole = req.user!.role;

      // Validate notes if provided
      if (notes && typeof notes !== 'string') {
        return res.status(400).json({
          status: 'error',
          code: 'VALIDATION_ERROR',
          title: 'Validation Failed',
          detail: 'Notes must be a string',
          source: {
            pointer: '/data/attributes/notes',
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: (req.headers['x-request-id'] as string) || 'unknown',
          },
        });
      }

      if (notes && notes.length > 1000) {
        return res.status(400).json({
          status: 'error',
          code: 'VALIDATION_ERROR',
          title: 'Validation Failed',
          detail: 'Notes cannot exceed 1000 characters',
          source: {
            pointer: '/data/attributes/notes',
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: (req.headers['x-request-id'] as string) || 'unknown',
          },
        });
      }

      const verificationService = getVerificationService();
      const verification = await verificationService.approve(
        verificationId,
        notes || null,
        userId,
        userRole as UserRole
      );

      const response = {
        status: 'success',
        data: {
          verification: {
            id: verification.id,
            projectId: verification.projectId,
            developerId: verification.developerId,
            verifierId: verification.verifierId,
            status: verification.status,
            progress: verification.progress,
            submittedAt: verification.submittedAt.toISOString(),
            assignedAt: verification.assignedAt ? verification.assignedAt.toISOString() : null,
            completedAt: verification.completedAt ? verification.completedAt.toISOString() : null,
            notes: verification.notes,
            createdAt: verification.createdAt.toISOString(),
            updatedAt: verification.updatedAt.toISOString(),
          },
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: (req.headers['x-request-id'] as string) || 'unknown',
        },
      };

      logger.info('Verification approved successfully', {
        verificationId,
        projectId: verification.projectId,
        approvedBy: userId,
        status: verification.status,
        progress: verification.progress,
      });

      res.status(200).json(response);
    } catch (error) {
      if (error instanceof Error) {
        logger.error('Error approving verification', {
          service: 'VerificationApproval',
          error: error.message,
          verificationId: req.params.id,
          userId: req.user?.id,
        });

        // Handle not found errors
        if (error.message === 'Verification request not found') {
          return res.status(404).json({
            status: 'error',
            code: 'NOT_FOUND',
            title: 'Verification Not Found',
            detail: error.message,
            meta: {
              timestamp: new Date().toISOString(),
              requestId: (req.headers['x-request-id'] as string) || 'unknown',
            },
          });
        }

        // Handle authorization errors
        if (error.message.includes('permission')) {
          return res.status(403).json({
            status: 'error',
            code: 'FORBIDDEN',
            title: 'Access Denied',
            detail: error.message,
            meta: {
              timestamp: new Date().toISOString(),
              requestId: (req.headers['x-request-id'] as string) || 'unknown',
            },
          });
        }

        // Handle validation errors
        if (
          error.message.includes('documents must be uploaded') ||
          error.message.includes('must be in review status')
        ) {
          return res.status(400).json({
            status: 'error',
            code: 'VALIDATION_ERROR',
            title: 'Validation Failed',
            detail: error.message,
            meta: {
              timestamp: new Date().toISOString(),
              requestId: (req.headers['x-request-id'] as string) || 'unknown',
            },
          });
        }
      }

      return next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/verifications/{id}/reject:
 *   post:
 *     summary: Reject a verification request
 *     tags: [Verifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Verification request ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *                 maxLength: 1000
 *                 description: Rejection reason (required)
 *     responses:
 *       200:
 *         description: Verification rejected successfully
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
 *                     verification:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         projectId:
 *                           type: string
 *                         developerId:
 *                           type: string
 *                         verifierId:
 *                           type: string
 *                         status:
 *                           type: string
 *                           enum: [pending, in_review, approved, rejected]
 *                         progress:
 *                           type: integer
 *                           minimum: 0
 *                           maximum: 100
 *                         submittedAt:
 *                           type: string
 *                           format: date-time
 *                         assignedAt:
 *                           type: string
 *                           format: date-time
 *                         completedAt:
 *                           type: string
 *                           format: date-time
 *                         notes:
 *                           type: string
 *                           nullable: true
 *                         createdAt:
 *                           type: string
 *                           format: date-time
 *                         updatedAt:
 *                           type: string
 *                           format: date-time
 *                 meta:
 *                   type: object
 *                   properties:
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                     requestId:
 *                       type: string
 *       400:
 *         description: Validation error - missing reason or invalid status
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Only assigned verifier or administrator can reject
 *       404:
 *         description: Verification request not found
 */
router.post(
  '/:id/reject',
  authenticate,
  authorize(Resource.VERIFICATION, Action.APPROVE), // Using same permission as approve
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const verificationId = req.params.id;
      const { reason } = req.body;
      const userId = req.user!.id;
      const userRole = req.user!.role;

      // Validate reason is provided
      if (!reason) {
        return res.status(400).json({
          status: 'error',
          code: 'VALIDATION_ERROR',
          title: 'Validation Failed',
          detail: 'Rejection reason is required',
          source: {
            pointer: '/data/attributes/reason',
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: (req.headers['x-request-id'] as string) || 'unknown',
          },
        });
      }

      if (typeof reason !== 'string') {
        return res.status(400).json({
          status: 'error',
          code: 'VALIDATION_ERROR',
          title: 'Validation Failed',
          detail: 'Reason must be a string',
          source: {
            pointer: '/data/attributes/reason',
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: (req.headers['x-request-id'] as string) || 'unknown',
          },
        });
      }

      if (reason.trim().length === 0) {
        return res.status(400).json({
          status: 'error',
          code: 'VALIDATION_ERROR',
          title: 'Validation Failed',
          detail: 'Rejection reason cannot be empty',
          source: {
            pointer: '/data/attributes/reason',
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: (req.headers['x-request-id'] as string) || 'unknown',
          },
        });
      }

      if (reason.length > 1000) {
        return res.status(400).json({
          status: 'error',
          code: 'VALIDATION_ERROR',
          title: 'Validation Failed',
          detail: 'Rejection reason cannot exceed 1000 characters',
          source: {
            pointer: '/data/attributes/reason',
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: (req.headers['x-request-id'] as string) || 'unknown',
          },
        });
      }

      const verificationService = getVerificationService();
      const verification = await verificationService.reject(
        verificationId,
        reason,
        userId,
        userRole as UserRole
      );

      const response = {
        status: 'success',
        data: {
          verification: {
            id: verification.id,
            projectId: verification.projectId,
            developerId: verification.developerId,
            verifierId: verification.verifierId,
            status: verification.status,
            progress: verification.progress,
            submittedAt: verification.submittedAt.toISOString(),
            assignedAt: verification.assignedAt ? verification.assignedAt.toISOString() : null,
            completedAt: verification.completedAt ? verification.completedAt.toISOString() : null,
            notes: verification.notes,
            createdAt: verification.createdAt.toISOString(),
            updatedAt: verification.updatedAt.toISOString(),
          },
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: (req.headers['x-request-id'] as string) || 'unknown',
        },
      };

      logger.info('Verification rejected successfully', {
        verificationId,
        projectId: verification.projectId,
        rejectedBy: userId,
        status: verification.status,
        progress: verification.progress,
        rejectionReason: reason,
      });

      res.status(200).json(response);
    } catch (error) {
      if (error instanceof Error) {
        logger.error('Error rejecting verification', {
          service: 'VerificationRejection',
          error: error.message,
          verificationId: req.params.id,
          userId: req.user?.id,
        });

        // Handle not found errors
        if (error.message === 'Verification request not found') {
          return res.status(404).json({
            status: 'error',
            code: 'NOT_FOUND',
            title: 'Verification Not Found',
            detail: error.message,
            meta: {
              timestamp: new Date().toISOString(),
              requestId: (req.headers['x-request-id'] as string) || 'unknown',
            },
          });
        }

        // Handle authorization errors
        if (error.message.includes('permission')) {
          return res.status(403).json({
            status: 'error',
            code: 'FORBIDDEN',
            title: 'Access Denied',
            detail: error.message,
            meta: {
              timestamp: new Date().toISOString(),
              requestId: (req.headers['x-request-id'] as string) || 'unknown',
            },
          });
        }

        // Handle validation errors
        if (
          error.message.includes('reason is required') ||
          error.message.includes('must be in review status') ||
          error.message.includes('cannot exceed')
        ) {
          return res.status(400).json({
            status: 'error',
            code: 'VALIDATION_ERROR',
            title: 'Validation Failed',
            detail: error.message,
            meta: {
              timestamp: new Date().toISOString(),
              requestId: (req.headers['x-request-id'] as string) || 'unknown',
            },
          });
        }
      }

      return next(error);
    }
  }
);

/**
 * Development-only endpoint: Unapprove a verification
 * This allows resetting an approved verification back to in_review for testing
 * Only available in development mode
 */
if (config.env === 'development') {
  router.post(
    '/:id/unapprove',
    authenticate,
    requireAdmin,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const verificationId = req.params.id;
        const userId = req.user!.id;
        const userRole = req.user!.role;

        const verificationService = getVerificationService();
        const verification = await verificationService.unapprove(
          verificationId,
          userId,
          userRole as UserRole
        );

        const response = {
          status: 'success',
          data: {
            verification: {
              id: verification.id,
              projectId: verification.projectId,
              developerId: verification.developerId,
              verifierId: verification.verifierId,
              status: verification.status,
              progress: verification.progress,
              submittedAt: verification.submittedAt.toISOString(),
              assignedAt: verification.assignedAt ? verification.assignedAt.toISOString() : null,
              completedAt: verification.completedAt ? verification.completedAt.toISOString() : null,
              notes: verification.notes,
              createdAt: verification.createdAt.toISOString(),
              updatedAt: verification.updatedAt.toISOString(),
            },
            message: 'Verification unapproved and reset to in_review status (Development mode)',
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: (req.headers['x-request-id'] as string) || 'unknown',
            environment: 'development',
          },
        };

        logger.info('Verification unapproved successfully (Development mode)', {
          verificationId,
          projectId: verification.projectId,
          unapprovedBy: userId,
          status: verification.status,
          progress: verification.progress,
        });

        res.status(200).json(response);
      } catch (error) {
        if (error instanceof Error) {
          logger.error('Error unapproving verification', {
            service: 'VerificationUnapproval',
            error: error.message,
            verificationId: req.params.id,
            userId: req.user?.id,
          });

          // Handle not found errors
          if (error.message === 'Verification request not found') {
            return res.status(404).json({
              status: 'error',
              code: 'NOT_FOUND',
              title: 'Verification Not Found',
              detail: error.message,
              meta: {
                timestamp: new Date().toISOString(),
                requestId: (req.headers['x-request-id'] as string) || 'unknown',
              },
            });
          }

          // Handle authorization errors
          if (error.message.includes('permission') || error.message.includes('administrator')) {
            return res.status(403).json({
              status: 'error',
              code: 'FORBIDDEN',
              title: 'Access Denied',
              detail: error.message,
              meta: {
                timestamp: new Date().toISOString(),
                requestId: (req.headers['x-request-id'] as string) || 'unknown',
              },
            });
          }

          // Handle validation errors
          if (error.message.includes('must be approved')) {
            return res.status(400).json({
              status: 'error',
              code: 'VALIDATION_ERROR',
              title: 'Validation Failed',
              detail: error.message,
              meta: {
                timestamp: new Date().toISOString(),
                requestId: (req.headers['x-request-id'] as string) || 'unknown',
              },
            });
          }
        }

        return next(error);
      }
    }
  );
}

export const verificationsRouter = router;
