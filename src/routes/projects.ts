import { Router, Request, Response, NextFunction } from 'express';
import { ProjectService } from '../application/services/ProjectService';
import { ProjectRepository } from '../infrastructure/repositories/ProjectRepository';
import { VerificationRequestRepository } from '../infrastructure/repositories/VerificationRequestRepository';
import {
  createProjectRequestSchema,
  updateProjectRequestSchema,
  ProjectResponse,
  ProjectListResponse,
} from '../application/dto/project.dto';
import { validateRequest } from '../middleware/validation';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { UserRole } from '../domain/entities/User';
import { Resource, Action } from '../middleware/permissions';
import { ProjectFilters, PaginationOptions } from '../domain/repositories/IProjectRepository';

const router = Router();

// Lazy initialization to avoid database connection issues at module load
const getProjectService = () => {
  const projectRepository = new ProjectRepository();
  const verificationRequestRepository = new VerificationRequestRepository();
  return new ProjectService(projectRepository, verificationRequestRepository);
};

/**
 * @swagger
 * /api/v1/projects:
 *   post:
 *     summary: Create a new project
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - type
 *               - description
 *               - location
 *               - country
 *               - emissionsTarget
 *               - startDate
 *             properties:
 *               title:
 *                 type: string
 *                 maxLength: 200
 *               type:
 *                 type: string
 *                 enum: [forest_conservation, renewable_energy, energy_efficiency, methane_capture, soil_carbon, ocean_conservation, direct_air_capture]
 *               description:
 *                 type: string
 *                 minLength: 50
 *               location:
 *                 type: string
 *                 maxLength: 255
 *               country:
 *                 type: string
 *                 description: ISO 3166-1 alpha-3 country code
 *                 example: USA
 *               coordinates:
 *                 type: object
 *                 properties:
 *                   latitude:
 *                     type: number
 *                     minimum: -90
 *                     maximum: 90
 *                   longitude:
 *                     type: number
 *                     minimum: -180
 *                     maximum: 180
 *               emissionsTarget:
 *                 type: number
 *                 description: Emissions target in tons CO2e
 *                 minimum: 0.01
 *                 maximum: 9999999.99
 *               startDate:
 *                 type: string
 *                 format: date
 *     responses:
 *       201:
 *         description: Project created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Only developers can create projects
 */
router.post(
  '/',
  authenticate,
  authorize(Resource.PROJECT, Action.CREATE),
  validateRequest(createProjectRequestSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const projectData = {
        ...req.body,
        developerId: userId,
        startDate: new Date(req.body.startDate),
      };

      const projectService = getProjectService();
      const project = await projectService.createProject(projectData);

      const response: ProjectResponse = {
        status: 'success',
        data: {
          project: {
            id: project.id,
            developerId: project.developerId,
            title: project.title,
            type: project.type,
            description: project.description,
            location: project.location,
            country: project.country,
            coordinates: project.coordinates,
            emissionsTarget: project.emissionsTarget,
            startDate: project.startDate.toISOString().split('T')[0],
            status: project.status,
            createdAt: project.createdAt.toISOString(),
            updatedAt: project.updatedAt.toISOString(),
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
        // Handle validation errors
        if (
          error.message.includes('Invalid') ||
          error.message.includes('must be') ||
          error.message.includes('required') ||
          error.message.includes('cannot be')
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
 * /api/v1/projects/{id}:
 *   get:
 *     summary: Get project by ID
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Project retrieved successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Project not found
 */
router.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = req.params.id;
    const userId = req.user!.id;
    const userRole = req.user!.role;

    const projectService = getProjectService();
    const project = await projectService.getProjectById(projectId);

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

    // Authorization: developers can only see their own projects (unless verified)
    // buyers can only see verified projects
    // verifiers and administrators can see all projects
    if (userRole === UserRole.DEVELOPER && project.developerId !== userId) {
      return res.status(403).json({
        status: 'error',
        code: 'FORBIDDEN',
        title: 'Access Denied',
        detail: 'You do not have permission to view this project',
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
        detail: 'Buyers can only view verified projects',
        meta: {
          timestamp: new Date().toISOString(),
          requestId: (req.headers['x-request-id'] as string) || 'unknown',
        },
      });
    }

    const response: ProjectResponse = {
      status: 'success',
      data: {
        project: {
          id: project.id,
          developerId: project.developerId,
          title: project.title,
          type: project.type,
          description: project.description,
          location: project.location,
          country: project.country,
          coordinates: project.coordinates,
          emissionsTarget: project.emissionsTarget,
          startDate: project.startDate.toISOString().split('T')[0],
          status: project.status,
          createdAt: project.createdAt.toISOString(),
          updatedAt: project.updatedAt.toISOString(),
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
});

/**
 * @swagger
 * /api/v1/projects:
 *   get:
 *     summary: List projects with filters and cursor-based pagination
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, verified, rejected]
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *       - in: query
 *         name: country
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *         description: Cursor for pagination (timestamp from last item)
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: created_at
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: Projects retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const userRole = req.user!.role;

    const filters: ProjectFilters = {};
    const sortOrderQuery = req.query.sortOrder as string;

    // SECURITY: Whitelist allowed sort columns to prevent SQL injection
    const ALLOWED_SORT_COLUMNS = ['created_at', 'updated_at', 'title', 'status', 'type', 'id'];
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

    if (req.query.type) {
      filters.type = req.query.type as string;
    }

    if (req.query.country) {
      filters.country = req.query.country as string;
    }

    // Apply role-based filtering
    const projectService = getProjectService();
    let projects;

    if (userRole === UserRole.DEVELOPER) {
      // Developers see only their own projects
      projects = await projectService.getProjectsByDeveloper(userId, filters, pagination);
    } else if (userRole === UserRole.BUYER) {
      // Buyers see only verified projects
      filters.status = 'verified';
      projects = await projectService.getAllProjects(filters, pagination);
    } else {
      // Verifiers and administrators see all projects
      projects = await projectService.getAllProjects(filters, pagination);
    }

    // Get total count for pagination
    const totalCount = await projectService.countProjects(
      userRole === UserRole.DEVELOPER ? { ...filters, developerId: userId } : filters
    );

    // Generate next cursor from last item
    let nextCursor: string | null = null;
    if (projects.length === pagination.limit) {
      const lastProject = projects[projects.length - 1];
      const sortBy = pagination.sortBy || 'created_at';

      if (sortBy === 'created_at') {
        nextCursor = lastProject.createdAt.toISOString();
      } else if (sortBy === 'updated_at') {
        nextCursor = lastProject.updatedAt.toISOString();
      } else if (sortBy === 'start_date') {
        nextCursor = lastProject.startDate.toISOString();
      }
    }

    const response: ProjectListResponse = {
      status: 'success',
      data: {
        projects: projects.map((project) => ({
          id: project.id,
          developerId: project.developerId,
          title: project.title,
          type: project.type,
          description: project.description,
          location: project.location,
          country: project.country,
          coordinates: project.coordinates,
          emissionsTarget: project.emissionsTarget,
          startDate: project.startDate.toISOString().split('T')[0],
          status: project.status,
          createdAt: project.createdAt.toISOString(),
          updatedAt: project.updatedAt.toISOString(),
        })),
        pagination: {
          total: totalCount,
          limit: pagination.limit ?? 20,
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
});

/**
 * @swagger
 * /api/v1/projects/{id}:
 *   patch:
 *     summary: Update a project
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 maxLength: 200
 *               type:
 *                 type: string
 *                 enum: [forest_conservation, renewable_energy, energy_efficiency, methane_capture, soil_carbon, ocean_conservation, direct_air_capture]
 *               description:
 *                 type: string
 *                 minLength: 50
 *               location:
 *                 type: string
 *                 maxLength: 255
 *               country:
 *                 type: string
 *                 description: ISO 3166-1 alpha-3 country code
 *                 example: USA
 *               coordinates:
 *                 type: object
 *                 properties:
 *                   latitude:
 *                     type: number
 *                     minimum: -90
 *                     maximum: 90
 *                   longitude:
 *                     type: number
 *                     minimum: -180
 *                     maximum: 180
 *               emissionsTarget:
 *                 type: number
 *                 description: Emissions target in tons CO2e
 *                 minimum: 0.01
 *                 maximum: 9999999.99
 *               startDate:
 *                 type: string
 *                 format: date
 *     responses:
 *       200:
 *         description: Project updated successfully
 *       400:
 *         description: Validation error or project cannot be updated
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Only the project developer can update
 *       404:
 *         description: Project not found
 */
router.patch(
  '/:id',
  authenticate,
  authorize(Resource.PROJECT, Action.UPDATE),
  validateRequest(updateProjectRequestSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const projectId = req.params.id;
      const userId = req.user!.id;
      const updateData = { ...req.body };

      // Convert startDate string to Date if provided
      if (updateData.startDate) {
        updateData.startDate = new Date(updateData.startDate);
      }

      const projectService = getProjectService();
      const updatedProject = await projectService.updateProject(projectId, userId, updateData);

      const response: ProjectResponse = {
        status: 'success',
        data: {
          project: {
            id: updatedProject.id,
            developerId: updatedProject.developerId,
            title: updatedProject.title,
            type: updatedProject.type,
            description: updatedProject.description,
            location: updatedProject.location,
            country: updatedProject.country,
            coordinates: updatedProject.coordinates,
            emissionsTarget: updatedProject.emissionsTarget,
            startDate: updatedProject.startDate.toISOString().split('T')[0],
            status: updatedProject.status,
            createdAt: updatedProject.createdAt.toISOString(),
            updatedAt: updatedProject.updatedAt.toISOString(),
          },
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: (req.headers['x-request-id'] as string) || 'unknown',
        },
      };

      res.status(200).json(response);
    } catch (error) {
      if (error instanceof Error) {
        // Handle not found
        if (error.message === 'Project not found') {
          return res.status(404).json({
            status: 'error',
            code: 'NOT_FOUND',
            title: 'Project Not Found',
            detail: error.message,
            meta: {
              timestamp: new Date().toISOString(),
              requestId: (req.headers['x-request-id'] as string) || 'unknown',
            },
          });
        }

        // Handle authorization errors
        if (error.message.includes('Unauthorized')) {
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
          error.message.includes('Cannot update') ||
          error.message.includes('Invalid') ||
          error.message.includes('must be')
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
 * /api/v1/projects/{id}:
 *   delete:
 *     summary: Delete a project
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       204:
 *         description: Project deleted successfully
 *       400:
 *         description: Project cannot be deleted
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Only the project developer can delete
 *       404:
 *         description: Project not found
 */
router.delete(
  '/:id',
  authenticate,
  authorize(Resource.PROJECT, Action.DELETE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const projectId = req.params.id;
      const userId = req.user!.id;

      const projectService = getProjectService();
      await projectService.deleteProject(projectId, userId);

      res.status(204).send();
    } catch (error) {
      if (error instanceof Error) {
        // Handle not found
        if (error.message === 'Project not found') {
          return res.status(404).json({
            status: 'error',
            code: 'NOT_FOUND',
            title: 'Project Not Found',
            detail: error.message,
            meta: {
              timestamp: new Date().toISOString(),
              requestId: (req.headers['x-request-id'] as string) || 'unknown',
            },
          });
        }

        // Handle authorization errors
        if (error.message.includes('Unauthorized')) {
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
        if (error.message.includes('Cannot delete')) {
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

export const projectsRouter = router;
