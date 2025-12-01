import { Router, Request, Response, NextFunction } from 'express';
import { AuthService } from '../application/services/AuthService';
import { UserRepository } from '../infrastructure/repositories/UserRepository';
import { EmailVerificationTokenRepository } from '../infrastructure/repositories/EmailVerificationTokenRepository';
import { SessionRepository } from '../infrastructure/repositories/SessionRepository';
import { CardanoWalletRepository } from '../infrastructure/repositories/CardanoWalletRepository';
import { ConsoleEmailService } from '../infrastructure/services/ConsoleEmailService';
import { SmtpEmailService } from '../infrastructure/services/SmtpEmailService';
import { MailgunEmailService } from '../infrastructure/services/MailgunEmailService';
import { MailerSendEmailService } from '../infrastructure/services/MailerSendEmailService';
import {
  registerRequestSchema,
  RegisterResponse,
  loginRequestSchema,
  LoginResponse,
  refreshTokenRequestSchema,
} from '../application/dto/auth.dto';
import { verifyWalletRequestSchema, VerifyWalletResponse } from '../application/dto/wallet.dto';
import { validateRequest } from '../middleware/validation';

const router = Router();

// Lazy initialization to avoid database connection issues at module load
const getAuthService = () => {
  const userRepository = new UserRepository();
  const emailVerificationTokenRepository = new EmailVerificationTokenRepository();
  const sessionRepository = new SessionRepository();
  const walletRepository = new CardanoWalletRepository();

  // Choose email service based on configuration
  let emailService;
  switch (process.env.EMAIL_SERVICE) {
    case 'mailersend':
      emailService = new MailerSendEmailService();
      break;
    case 'mailgun':
      emailService = new MailgunEmailService();
      break;
    case 'smtp':
      emailService = new SmtpEmailService();
      break;
    default:
      emailService = new ConsoleEmailService();
  }

  return new AuthService(
    userRepository,
    emailVerificationTokenRepository,
    sessionRepository,
    emailService,
    walletRepository
  );
};

/**
 * @swagger
 * /api/v1/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - name
 *               - role
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *               name:
 *                 type: string
 *               company:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [developer, verifier, administrator, buyer]
 *     responses:
 *       201:
 *         description: User registered successfully
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
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *                     message:
 *                       type: string
 *       409:
 *         description: Email already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  '/register',
  validateRequest(registerRequestSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authService = getAuthService();
      const result = await authService.register(req.body);

      const response: RegisterResponse = {
        status: 'success',
        data: {
          user: {
            id: result.user.id,
            email: result.user.email,
            name: result.user.name,
            company: result.user.company,
            role: result.user.role,
            emailVerified: result.user.emailVerified,
            createdAt: result.user.createdAt,
          },
          message: 'Registration successful. Please check your email to verify your account.',
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: (req.headers['x-request-id'] as string) || 'unknown',
        },
      };

      res.status(201).json(response);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Email already registered') {
          return res.status(409).json({
            status: 'error',
            code: 'EMAIL_ALREADY_EXISTS',
            title: 'Email Already Registered',
            detail: 'An account with this email address already exists',
            meta: {
              timestamp: new Date().toISOString(),
              requestId: (req.headers['x-request-id'] as string) || 'unknown',
            },
          });
        }

        if (error.message === 'Invalid email format') {
          return res.status(400).json({
            status: 'error',
            code: 'INVALID_EMAIL',
            title: 'Invalid Email',
            detail: 'The provided email address is not valid',
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
 * /api/v1/auth/login:
 *   post:
 *     summary: Login with email and password
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
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
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *                     tokens:
 *                       type: object
 *                       properties:
 *                         accessToken:
 *                           type: string
 *                         refreshToken:
 *                           type: string
 *                         accessTokenExpiry:
 *                           type: string
 *                           format: date-time
 *                         refreshTokenExpiry:
 *                           type: string
 *                           format: date-time
 *       401:
 *         description: Invalid credentials or account locked
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  '/login',
  validateRequest(loginRequestSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body;
      const ipAddress = (req.ip || req.socket.remoteAddress || 'unknown') as string;
      const userAgent = req.headers['user-agent'] || 'unknown';

      const authService = getAuthService();
      const result = await authService.login(email, password, ipAddress, userAgent);

      const response: LoginResponse = {
        status: 'success',
        data: {
          user: {
            id: result.user.id,
            email: result.user.email,
            name: result.user.name,
            company: result.user.company,
            role: result.user.role,
            emailVerified: result.user.emailVerified,
            lastLoginAt: result.user.lastLoginAt,
          },
          tokens: result.tokens,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: (req.headers['x-request-id'] as string) || 'unknown',
        },
      };

      res.status(200).json(response);
    } catch (error) {
      if (error instanceof Error) {
        if (
          error.message === 'Invalid credentials' ||
          error.message === 'Account is locked. Please try again later.' ||
          error.message === 'Account locked due to too many failed login attempts'
        ) {
          return res.status(401).json({
            status: 'error',
            code: 'AUTHENTICATION_FAILED',
            title: 'Authentication Failed',
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
 * /api/v1/auth/logout:
 *   post:
 *     summary: Logout user
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 *       401:
 *         description: Unauthorized
 */
router.post('/logout', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Extract userId from token (would normally be done by auth middleware)
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        status: 'error',
        code: 'UNAUTHORIZED',
        title: 'Unauthorized',
        detail: 'No authentication token provided',
        meta: {
          timestamp: new Date().toISOString(),
          requestId: (req.headers['x-request-id'] as string) || 'unknown',
        },
      });
    }

    const token = authHeader.substring(7);
    const payload = require('../utils/crypto').CryptoUtils.verifyToken(token);

    const authService = getAuthService();
    await authService.logout(payload.userId);

    res.status(200).json({
      status: 'success',
      data: {
        message: 'Logged out successfully',
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: (req.headers['x-request-id'] as string) || 'unknown',
      },
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * @swagger
 * /api/v1/auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *       401:
 *         description: Invalid refresh token
 */
router.post(
  '/refresh',
  validateRequest(refreshTokenRequestSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { refreshToken } = req.body;

      const authService = getAuthService();
      const tokens = await authService.refreshToken(refreshToken);

      res.status(200).json({
        status: 'success',
        data: {
          tokens,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: (req.headers['x-request-id'] as string) || 'unknown',
        },
      });
    } catch (error) {
      if (error instanceof Error) {
        if (
          error.message === 'Invalid refresh token' ||
          error.message === 'Session not found' ||
          error.message === 'User not found'
        ) {
          return res.status(401).json({
            status: 'error',
            code: 'INVALID_REFRESH_TOKEN',
            title: 'Invalid Refresh Token',
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
 * /api/v1/auth/verify-wallet:
 *   post:
 *     summary: Authenticate with Cardano wallet signature
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - challengeId
 *               - address
 *               - signature
 *               - publicKey
 *             properties:
 *               challengeId:
 *                 type: string
 *                 format: uuid
 *               address:
 *                 type: string
 *                 description: Cardano wallet address (Bech32 format)
 *               signature:
 *                 type: string
 *                 description: Ed25519 signature (hex)
 *               publicKey:
 *                 type: string
 *                 description: Public key (hex)
 *     responses:
 *       200:
 *         description: Wallet authentication successful
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
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *                     tokens:
 *                       type: object
 *                       properties:
 *                         accessToken:
 *                           type: string
 *                         refreshToken:
 *                           type: string
 *                         accessTokenExpiry:
 *                           type: string
 *                           format: date-time
 *                         refreshTokenExpiry:
 *                           type: string
 *                           format: date-time
 *       400:
 *         description: Invalid signature or challenge
 *       401:
 *         description: Wallet not linked or account locked
 */
router.post(
  '/verify-wallet',
  validateRequest(verifyWalletRequestSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { challengeId, address, signature, publicKey } = req.body;
      const ipAddress = (req.ip || req.socket.remoteAddress || 'unknown') as string;
      const userAgent = req.headers['user-agent'] || 'unknown';

      const authService = getAuthService();
      const result = await authService.verifyWallet(
        challengeId,
        address,
        signature,
        publicKey,
        ipAddress,
        userAgent
      );

      const response: VerifyWalletResponse = {
        status: 'success',
        data: {
          user: {
            id: result.user.id,
            email: result.user.email,
            name: result.user.name,
            company: result.user.company,
            role: result.user.role,
            emailVerified: result.user.emailVerified,
            walletAddress: result.user.walletAddress ?? '',
            lastLoginAt: result.user.lastLoginAt,
          },
          tokens: result.tokens,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: (req.headers['x-request-id'] as string) || 'unknown',
        },
      };

      res.status(200).json(response);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Invalid signature or expired challenge') {
          return res.status(400).json({
            status: 'error',
            code: 'INVALID_SIGNATURE',
            title: 'Invalid Signature',
            detail: error.message,
            meta: {
              timestamp: new Date().toISOString(),
              requestId: (req.headers['x-request-id'] as string) || 'unknown',
            },
          });
        }

        if (error.message === 'Wallet address not linked to any account') {
          return res.status(401).json({
            status: 'error',
            code: 'WALLET_NOT_LINKED',
            title: 'Wallet Not Linked',
            detail:
              'This wallet address is not linked to any account. Please link your wallet first.',
            meta: {
              timestamp: new Date().toISOString(),
              requestId: (req.headers['x-request-id'] as string) || 'unknown',
            },
          });
        }

        if (
          error.message === 'Account is locked. Please contact support.' ||
          error.message === 'User not found'
        ) {
          return res.status(401).json({
            status: 'error',
            code: 'AUTHENTICATION_FAILED',
            title: 'Authentication Failed',
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
 * /api/v1/auth/verify-email:
 *   get:
 *     summary: Verify user email address
 *     tags: [Authentication]
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Email verification token
 *     responses:
 *       200:
 *         description: Email verified successfully
 *       400:
 *         description: Invalid, expired, or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/verify-email', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.query.token as string;

    if (!token) {
      return res.status(400).json({
        status: 'error',
        code: 'MISSING_TOKEN',
        title: 'Missing Verification Token',
        detail: 'Verification token is required',
        meta: {
          timestamp: new Date().toISOString(),
          requestId: (req.headers['x-request-id'] as string) || 'unknown',
        },
      });
    }

    const authService = getAuthService();
    await authService.verifyEmail(token);

    res.status(200).json({
      status: 'success',
      data: {
        message: 'Email verified successfully. You can now log in.',
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: (req.headers['x-request-id'] as string) || 'unknown',
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Invalid verification token') {
        return res.status(400).json({
          status: 'error',
          code: 'INVALID_TOKEN',
          title: 'Invalid Verification Token',
          detail: 'The verification token is invalid or does not exist',
          meta: {
            timestamp: new Date().toISOString(),
            requestId: (req.headers['x-request-id'] as string) || 'unknown',
          },
        });
      }

      if (error.message === 'Verification token already used') {
        return res.status(400).json({
          status: 'error',
          code: 'TOKEN_ALREADY_USED',
          title: 'Token Already Used',
          detail: 'This verification token has already been used',
          meta: {
            timestamp: new Date().toISOString(),
            requestId: (req.headers['x-request-id'] as string) || 'unknown',
          },
        });
      }

      if (error.message === 'Verification token expired') {
        return res.status(400).json({
          status: 'error',
          code: 'TOKEN_EXPIRED',
          title: 'Token Expired',
          detail: 'This verification token has expired. Please request a new one.',
          meta: {
            timestamp: new Date().toISOString(),
            requestId: (req.headers['x-request-id'] as string) || 'unknown',
          },
        });
      }

      if (error.message === 'Email already verified') {
        return res.status(400).json({
          status: 'error',
          code: 'ALREADY_VERIFIED',
          title: 'Email Already Verified',
          detail: 'This email address has already been verified',
          meta: {
            timestamp: new Date().toISOString(),
            requestId: (req.headers['x-request-id'] as string) || 'unknown',
          },
        });
      }

      if (error.message === 'User not found') {
        return res.status(404).json({
          status: 'error',
          code: 'USER_NOT_FOUND',
          title: 'User Not Found',
          detail: 'The user associated with this token was not found',
          meta: {
            timestamp: new Date().toISOString(),
            requestId: (req.headers['x-request-id'] as string) || 'unknown',
          },
        });
      }
    }

    return next(error);
  }
});

export const authRouter = router;
