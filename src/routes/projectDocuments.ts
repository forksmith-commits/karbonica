import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { ProjectDocumentRepository } from '../infrastructure/repositories/ProjectDocumentRepository';
import { ProjectRepository } from '../infrastructure/repositories/ProjectRepository';
import { StorageService } from '../infrastructure/services/StorageService';
import {
  ProjectDocumentResponse,
  ProjectDocumentListResponse,
  uploadProjectDocumentSchema,
} from '../application/dto/projectDocument.dto';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { Resource, Action } from '../middleware/permissions';
import { UserRole } from '../domain/entities/User';
import { logger } from '../utils/logger';

const router = Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max file size
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

// Lazy initialization
const getRepositories = () => {
  const projectDocumentRepository = new ProjectDocumentRepository();
  const projectRepository = new ProjectRepository();
  const storageService = new StorageService();
  return { projectDocumentRepository, projectRepository, storageService };
};

/**
 * @swagger
 * /api/v1/projects/{id}/documents:
 *   post:
 *     summary: Upload a document for a project
 *     tags: [Project Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Project ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *               - name
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
 *     responses:
 *       201:
 *         description: Document uploaded successfully
 *       400:
 *         description: Validation error or invalid file
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Only project owner can upload documents
 *       404:
 *         description: Project not found
 *       413:
 *         description: File too large
 */
router.post(
  '/:id/documents',
  authenticate,
  authorize(Resource.PROJECT, Action.UPDATE),
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const projectId = req.params.id;
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
      const validation = uploadProjectDocumentSchema.safeParse({ body: req.body });
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

      const { projectDocumentRepository, projectRepository, storageService } = getRepositories();

      // Check if project exists
      const project = await projectRepository.findById(projectId);
      if (!project) {
        return res.status(404).json({
          status: 'error',
          code: 'NOT_FOUND',
          title: 'Project Not Found',
          detail: 'The requested project does not exist',
          meta: {
            timestamp: new Date().toISOString(),
            requestId: (req.headers['x-request-id'] as string) || 'unknown',
          },
        });
      }

      // Authorization: Only project owner can upload documents (or admin)
      if (userRole !== UserRole.ADMINISTRATOR && project.developerId !== userId) {
        return res.status(403).json({
          status: 'error',
          code: 'FORBIDDEN',
          title: 'Access Denied',
          detail: 'You do not have permission to upload documents for this project',
          meta: {
            timestamp: new Date().toISOString(),
            requestId: (req.headers['x-request-id'] as string) || 'unknown',
          },
        });
      }

      // Check if project is still in pending status
      if (project.status !== 'pending') {
        return res.status(400).json({
          status: 'error',
          code: 'VALIDATION_ERROR',
          title: 'Invalid Operation',
          detail: 'Documents can only be uploaded for projects in pending status',
          meta: {
            timestamp: new Date().toISOString(),
            requestId: (req.headers['x-request-id'] as string) || 'unknown',
          },
        });
      }

      // Upload file to storage
      logger.info('Uploading document to storage', {
        service: 'ProjectDocuments',
        projectId,
        filename: req.file.originalname,
        size: req.file.size,
        mimeType: req.file.mimetype,
      });

      const uploadResult = await storageService.uploadFile({
        buffer: req.file.buffer,
        filename: req.file.originalname,
        mimeType: req.file.mimetype,
        folder: `projects/${projectId}`,
      });

      // Save document metadata to database
      const document = await projectDocumentRepository.save({
        projectId,
        name: req.body.name,
        description: req.body.description,
        fileUrl: uploadResult.fileUrl,
        fileSize: uploadResult.fileSize,
        mimeType: req.file.mimetype,
        uploadedBy: userId,
      });

      logger.info('Document uploaded successfully', {
        service: 'ProjectDocuments',
        documentId: document.id,
        projectId,
        userId,
      });

      const response: ProjectDocumentResponse = {
        status: 'success',
        data: {
          document: {
            id: document.id,
            projectId: document.projectId,
            name: document.name,
            description: document.description,
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
        logger.error('Error uploading document', {
          service: 'ProjectDocuments',
          error: error.message,
          projectId: req.params.id,
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
      }

      return next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/projects/{id}/documents:
 *   get:
 *     summary: Get all documents for a project
 *     tags: [Project Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Project ID
 *     responses:
 *       200:
 *         description: Documents retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Project not found
 */
router.get(
  '/:id/documents',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const projectId = req.params.id;
      const userId = req.user!.id;
      const userRole = req.user!.role;

      const { projectDocumentRepository, projectRepository } = getRepositories();

      // Check if project exists
      const project = await projectRepository.findById(projectId);
      if (!project) {
        return res.status(404).json({
          status: 'error',
          code: 'NOT_FOUND',
          title: 'Project Not Found',
          detail: 'The requested project does not exist',
          meta: {
            timestamp: new Date().toISOString(),
            requestId: (req.headers['x-request-id'] as string) || 'unknown',
          },
        });
      }

      // Authorization: Check if user can view this project
      if (
        userRole === UserRole.DEVELOPER &&
        project.developerId !== userId &&
        project.status !== 'verified'
      ) {
        return res.status(403).json({
          status: 'error',
          code: 'FORBIDDEN',
          title: 'Access Denied',
          detail: 'You do not have permission to view documents for this project',
          meta: {
            timestamp: new Date().toISOString(),
            requestId: (req.headers['x-request-id'] as string) || 'unknown',
          },
        });
      }

      if (userRole === UserRole.BUYER && project.status !== 'verified') {
        return res.status(403).json({
          status: 'error',
          code: 'FORBIDDEN',
          title: 'Access Denied',
          detail: 'Buyers can only view documents for verified projects',
          meta: {
            timestamp: new Date().toISOString(),
            requestId: (req.headers['x-request-id'] as string) || 'unknown',
          },
        });
      }

      // Get all documents for the project
      const documents = await projectDocumentRepository.findByProject(projectId);

      const response: ProjectDocumentListResponse = {
        status: 'success',
        data: {
          documents: documents.map((doc) => ({
            id: doc.id,
            projectId: doc.projectId,
            name: doc.name,
            description: doc.description,
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
 * /api/v1/projects/{projectId}/documents/{documentId}:
 *   delete:
 *     summary: Delete a project document
 *     tags: [Project Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       204:
 *         description: Document deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Document or project not found
 */
router.delete(
  '/:projectId/documents/:documentId',
  authenticate,
  authorize(Resource.PROJECT, Action.UPDATE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { projectId, documentId } = req.params;
      const userId = req.user!.id;
      const userRole = req.user!.role;

      const { projectDocumentRepository, projectRepository, storageService } = getRepositories();

      // Check if project exists
      const project = await projectRepository.findById(projectId);
      if (!project) {
        return res.status(404).json({
          status: 'error',
          code: 'NOT_FOUND',
          title: 'Project Not Found',
          detail: 'The requested project does not exist',
          meta: {
            timestamp: new Date().toISOString(),
            requestId: (req.headers['x-request-id'] as string) || 'unknown',
          },
        });
      }

      // Authorization: Only project owner can delete documents (or admin)
      if (userRole !== UserRole.ADMINISTRATOR && project.developerId !== userId) {
        return res.status(403).json({
          status: 'error',
          code: 'FORBIDDEN',
          title: 'Access Denied',
          detail: 'You do not have permission to delete documents for this project',
          meta: {
            timestamp: new Date().toISOString(),
            requestId: (req.headers['x-request-id'] as string) || 'unknown',
          },
        });
      }

      // Check if document exists
      const document = await projectDocumentRepository.findById(documentId);
      if (!document || document.projectId !== projectId) {
        return res.status(404).json({
          status: 'error',
          code: 'NOT_FOUND',
          title: 'Document Not Found',
          detail: 'The requested document does not exist',
          meta: {
            timestamp: new Date().toISOString(),
            requestId: (req.headers['x-request-id'] as string) || 'unknown',
          },
        });
      }

      // Extract key from URL
      const urlParts = document.fileUrl.split('/');
      const key = urlParts.slice(-2).join('/'); // Get last two parts (folder/filename)

      // Delete from storage
      await storageService.deleteFile(key);

      // Delete from database
      await projectDocumentRepository.delete(documentId);

      logger.info('Document deleted successfully', {
        service: 'ProjectDocuments',
        documentId,
        projectId,
        userId,
      });

      res.status(204).send();
    } catch (error) {
      logger.error('Error deleting document', {
        service: 'ProjectDocuments',
        error: error instanceof Error ? error.message : 'Unknown error',
        documentId: req.params.documentId,
      });
      return next(error);
    }
  }
);

export const projectDocumentsRouter = router;
