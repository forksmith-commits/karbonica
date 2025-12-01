import { Router, Request, Response } from 'express';
import { UserRepository } from '../../infrastructure/repositories/UserRepository';
import { authenticate } from '../../middleware/authenticate';

const router = Router();

// Apply authentication middleware to all admin routes
router.use(authenticate);

/**
 * @swagger
 * /api/v1/admin/users:
 *   get:
 *     summary: Get all users
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: List of users
 *       401:
 *         description: Unauthorized
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userRepository = new UserRepository();
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    // Get all users (you'll need to add this method to UserRepository)
    const users = await userRepository.findAll(limit, offset);

    res.json({
      status: 'success',
      data: {
        users: users.map((user) => {
          const { passwordHash, ...userWithoutPassword } = user;
          return userWithoutPassword;
        }),
        pagination: {
          page,
          limit,
          total: users.length,
        },
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: (req.headers['x-request-id'] as string) || 'unknown',
      },
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      code: 'INTERNAL_ERROR',
      title: 'Internal Server Error',
      detail: error instanceof Error ? error.message : 'Unknown error',
      meta: {
        timestamp: new Date().toISOString(),
        requestId: (req.headers['x-request-id'] as string) || 'unknown',
      },
    });
  }
});

/**
 * @swagger
 * /api/v1/admin/users/{id}:
 *   get:
 *     summary: Get user by ID
 *     tags: [Admin]
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
 *         description: User details
 *       404:
 *         description: User not found
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userRepository = new UserRepository();
    const user = await userRepository.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        status: 'error',
        code: 'USER_NOT_FOUND',
        title: 'User Not Found',
        detail: 'The requested user does not exist',
        meta: {
          timestamp: new Date().toISOString(),
          requestId: (req.headers['x-request-id'] as string) || 'unknown',
        },
      });
    }

    const { passwordHash, ...userWithoutPassword } = user;

    return res.json({
      status: 'success',
      data: { user: userWithoutPassword },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: (req.headers['x-request-id'] as string) || 'unknown',
      },
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      code: 'INTERNAL_ERROR',
      title: 'Internal Server Error',
      detail: error instanceof Error ? error.message : 'Unknown error',
      meta: {
        timestamp: new Date().toISOString(),
        requestId: (req.headers['x-request-id'] as string) || 'unknown',
      },
    });
  }
});

/**
 * @swagger
 * /api/v1/admin/users/{id}:
 *   delete:
 *     summary: Delete user
 *     tags: [Admin]
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
 *         description: User deleted successfully
 *       404:
 *         description: User not found
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userRepository = new UserRepository();
    const user = await userRepository.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        status: 'error',
        code: 'USER_NOT_FOUND',
        title: 'User Not Found',
        detail: 'The requested user does not exist',
        meta: {
          timestamp: new Date().toISOString(),
          requestId: (req.headers['x-request-id'] as string) || 'unknown',
        },
      });
    }

    await userRepository.delete(req.params.id);

    return res.json({
      status: 'success',
      data: {
        message: 'User deleted successfully',
        deletedUserId: req.params.id,
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: (req.headers['x-request-id'] as string) || 'unknown',
      },
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      code: 'INTERNAL_ERROR',
      title: 'Internal Server Error',
      detail: error instanceof Error ? error.message : 'Unknown error',
      meta: {
        timestamp: new Date().toISOString(),
        requestId: (req.headers['x-request-id'] as string) || 'unknown',
      },
    });
  }
});

/**
 * @swagger
 * /api/v1/admin/users/email/{email}:
 *   delete:
 *     summary: Delete user by email
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *           format: email
 *     responses:
 *       200:
 *         description: User deleted successfully
 *       404:
 *         description: User not found
 */
router.delete('/email/:email', async (req: Request, res: Response) => {
  try {
    const userRepository = new UserRepository();
    const user = await userRepository.findByEmail(req.params.email);

    if (!user) {
      return res.status(404).json({
        status: 'error',
        code: 'USER_NOT_FOUND',
        title: 'User Not Found',
        detail: 'No user found with that email address',
        meta: {
          timestamp: new Date().toISOString(),
          requestId: (req.headers['x-request-id'] as string) || 'unknown',
        },
      });
    }

    await userRepository.delete(user.id);

    return res.json({
      status: 'success',
      data: {
        message: 'User deleted successfully',
        deletedUserId: user.id,
        deletedEmail: user.email,
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: (req.headers['x-request-id'] as string) || 'unknown',
      },
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      code: 'INTERNAL_ERROR',
      title: 'Internal Server Error',
      detail: error instanceof Error ? error.message : 'Unknown error',
      meta: {
        timestamp: new Date().toISOString(),
        requestId: (req.headers['x-request-id'] as string) || 'unknown',
      },
    });
  }
});

export const adminUsersRouter = router;
