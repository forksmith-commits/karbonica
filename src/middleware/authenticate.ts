import { Request, Response, NextFunction } from 'express';
import { CryptoUtils } from '../utils/crypto';
import { SessionRepository } from '../infrastructure/repositories/SessionRepository';
import { UserRepository } from '../infrastructure/repositories/UserRepository';
import { AuthenticationError } from './errorHandler';
import { logger } from '../utils/logger';

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
      };
      sessionId?: string;
    }
  }
}

const SESSION_INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Middleware to authenticate requests using JWT access tokens and validate sessions
 * Implements session expiration based on 30 minutes of inactivity
 */
export const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('No authentication token provided');
    }

    const token = authHeader.substring(7);

    // Verify JWT token
    let payload;
    try {
      payload = CryptoUtils.verifyToken(token);
    } catch (error) {
      throw new AuthenticationError('Invalid or expired token');
    }

    // Hash the token to look up in database
    const hashedToken = CryptoUtils.hashToken(token);

    // Find session by access token
    const sessionRepository = new SessionRepository();
    const session = await sessionRepository.findByAccessToken(hashedToken);

    if (!session) {
      throw new AuthenticationError('Session not found or expired');
    }

    // Check session expiration (30 min inactivity)
    const now = new Date();
    const lastActivity = session.lastActivityAt || session.createdAt;
    const inactivityDuration = now.getTime() - lastActivity.getTime();

    if (inactivityDuration > SESSION_INACTIVITY_TIMEOUT_MS) {
      // Session expired due to inactivity
      await sessionRepository.delete(session.id);
      throw new AuthenticationError('Session expired due to inactivity');
    }

    // Update last activity timestamp
    session.lastActivityAt = now;
    await sessionRepository.update(session);

    // Verify user still exists and is not locked
    const userRepository = new UserRepository();
    const user = await userRepository.findById(payload.userId);

    if (!user) {
      await sessionRepository.delete(session.id);
      throw new AuthenticationError('User not found');
    }

    if (user.accountLocked) {
      await sessionRepository.delete(session.id);
      throw new AuthenticationError('Account is locked');
    }

    // Attach user info to request
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
    };
    req.sessionId = session.id;

    logger.debug('Request authenticated', {
      userId: user.id,
      email: user.email,
      role: user.role,
      sessionId: session.id,
    });

    next();
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return next(error);
    }

    logger.error('Authentication middleware error', { error });
    return next(new AuthenticationError('Authentication failed'));
  }
};

/**
 * Optional authentication middleware - does not fail if no token provided
 * Useful for endpoints that work differently for authenticated vs anonymous users
 */
export const optionalAuthenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No token provided, continue without authentication
      return next();
    }

    // If token is provided, validate it
    await authenticate(req, _res, next);
  } catch (error) {
    // If authentication fails with optional auth, continue without user
    next();
  }
};
