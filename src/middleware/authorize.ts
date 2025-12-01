import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../domain/entities/User';
import { Resource, Action, hasPermission } from './permissions';
import { AuthorizationError } from './errorHandler';
import { logger } from '../utils/logger';

/**
 * Authorization middleware factory
 * Creates middleware that checks if the authenticated user has permission
 * to perform a specific action on a resource
 *
 * Based on Requirements 8.1-8.11
 */
export function authorize(resource: Resource, action: Action) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      // User must be authenticated first
      if (!req.user) {
        throw new AuthorizationError('Authentication required');
      }

      const { id: userId, role, email } = req.user;

      // Check if user's role has permission for this action on this resource
      const permitted = hasPermission(role as UserRole, resource, action);

      if (!permitted) {
        logger.warn('Authorization failed', {
          userId,
          email,
          role,
          resource,
          action,
          path: req.path,
          method: req.method,
        });

        throw new AuthorizationError(
          `Role '${role}' does not have permission to '${action}' on '${resource}'`
        );
      }

      logger.debug('Authorization successful', {
        userId,
        role,
        resource,
        action,
      });

      next();
    } catch (error) {
      if (error instanceof AuthorizationError) {
        return next(error);
      }

      logger.error('Authorization middleware error', { error });
      return next(new AuthorizationError('Authorization failed'));
    }
  };
}

/**
 * Middleware to check if user has a specific role
 * Useful for endpoints that require a specific role
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        throw new AuthorizationError('Authentication required');
      }

      const { role, id: userId, email } = req.user;

      if (!allowedRoles.includes(role as UserRole)) {
        logger.warn('Role check failed', {
          userId,
          email,
          userRole: role,
          allowedRoles,
          path: req.path,
          method: req.method,
        });

        throw new AuthorizationError(`Access denied. Required roles: ${allowedRoles.join(', ')}`);
      }

      logger.debug('Role check successful', {
        userId,
        role,
        allowedRoles,
      });

      next();
    } catch (error) {
      if (error instanceof AuthorizationError) {
        return next(error);
      }

      logger.error('Role check middleware error', { error });
      return next(new AuthorizationError('Authorization failed'));
    }
  };
}

/**
 * Middleware to check if user is an administrator
 * Shorthand for requireRole(UserRole.ADMINISTRATOR)
 */
export const requireAdmin = requireRole(UserRole.ADMINISTRATOR);

/**
 * Middleware to check if user is a developer
 */
export const requireDeveloper = requireRole(UserRole.DEVELOPER);

/**
 * Middleware to check if user is a verifier
 */
export const requireVerifier = requireRole(UserRole.VERIFIER);

/**
 * Middleware to check if user is a buyer
 */
export const requireBuyer = requireRole(UserRole.BUYER);

/**
 * Middleware to check if user is either a verifier or administrator
 * Useful for verification endpoints
 */
export const requireVerifierOrAdmin = requireRole(UserRole.VERIFIER, UserRole.ADMINISTRATOR);
