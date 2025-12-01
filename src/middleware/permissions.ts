/**
 * Permission constants for role-based access control
 * Based on Requirements 8.1-8.11
 */

import { UserRole } from '../domain/entities/User';

export enum Resource {
  PROJECT = 'project',
  VERIFICATION = 'verification',
  CREDIT = 'credit',
  USER = 'user',
  AUDIT_LOG = 'audit_log',
  WALLET = 'wallet',
  ADMIN = 'admin',
}

export enum Action {
  CREATE = 'create',
  READ = 'read',
  UPDATE = 'update',
  DELETE = 'delete',
  APPROVE = 'approve',
  REJECT = 'reject',
  ASSIGN = 'assign',
  TRANSFER = 'transfer',
  RETIRE = 'retire',
  LINK = 'link',
  UNLINK = 'unlink',
}

/**
 * Permission matrix defining what each role can do
 * Based on requirements 8.1-8.11
 */
export const PERMISSIONS: Record<UserRole, Record<Resource, Action[]>> = {
  [UserRole.DEVELOPER]: {
    [Resource.PROJECT]: [Action.CREATE, Action.READ, Action.UPDATE, Action.DELETE],
    [Resource.VERIFICATION]: [Action.READ, Action.UPDATE], // Can view and upload documents to their own verifications
    [Resource.CREDIT]: [Action.READ, Action.TRANSFER, Action.RETIRE],
    [Resource.USER]: [Action.READ, Action.UPDATE], // Own profile only
    [Resource.AUDIT_LOG]: [], // No access
    [Resource.WALLET]: [Action.LINK, Action.UNLINK, Action.READ],
    [Resource.ADMIN]: [], // No access
  },
  [UserRole.VERIFIER]: {
    [Resource.PROJECT]: [Action.READ], // Can view projects under verification
    [Resource.VERIFICATION]: [Action.READ, Action.UPDATE, Action.APPROVE, Action.REJECT],
    [Resource.CREDIT]: [Action.READ], // Can view credits related to verifications
    [Resource.USER]: [Action.READ, Action.UPDATE], // Own profile only
    [Resource.AUDIT_LOG]: [], // No access
    [Resource.WALLET]: [Action.LINK, Action.UNLINK, Action.READ],
    [Resource.ADMIN]: [], // No access
  },
  [UserRole.ADMINISTRATOR]: {
    [Resource.PROJECT]: [Action.CREATE, Action.READ, Action.UPDATE, Action.DELETE],
    [Resource.VERIFICATION]: [
      Action.READ,
      Action.UPDATE,
      Action.APPROVE,
      Action.REJECT,
      Action.ASSIGN,
    ],
    [Resource.CREDIT]: [Action.CREATE, Action.READ, Action.UPDATE, Action.TRANSFER, Action.RETIRE],
    [Resource.USER]: [Action.CREATE, Action.READ, Action.UPDATE, Action.DELETE],
    [Resource.AUDIT_LOG]: [Action.READ],
    [Resource.WALLET]: [Action.LINK, Action.UNLINK, Action.READ],
    [Resource.ADMIN]: [Action.CREATE, Action.READ, Action.UPDATE, Action.DELETE],
  },
  [UserRole.BUYER]: {
    [Resource.PROJECT]: [Action.READ], // Can only view verified projects
    [Resource.VERIFICATION]: [], // No access
    [Resource.CREDIT]: [Action.READ, Action.TRANSFER, Action.RETIRE],
    [Resource.USER]: [Action.READ, Action.UPDATE], // Own profile only
    [Resource.AUDIT_LOG]: [], // No access
    [Resource.WALLET]: [Action.LINK, Action.UNLINK, Action.READ],
    [Resource.ADMIN]: [], // No access
  },
};

/**
 * Check if a role has permission to perform an action on a resource
 */
export function hasPermission(role: UserRole, resource: Resource, action: Action): boolean {
  const rolePermissions = PERMISSIONS[role];
  if (!rolePermissions) {
    return false;
  }

  const resourcePermissions = rolePermissions[resource];
  if (!resourcePermissions) {
    return false;
  }

  return resourcePermissions.includes(action);
}

/**
 * Check if user owns a resource (for row-level security)
 */
export interface ResourceOwnership {
  ownerId?: string;
  developerId?: string;
  verifierId?: string;
}

export function canAccessOwnResource(
  userId: string,
  role: UserRole,
  resource: ResourceOwnership
): boolean {
  // Administrators can access all resources
  if (role === UserRole.ADMINISTRATOR) {
    return true;
  }

  // Check if user owns the resource
  if (resource.ownerId && resource.ownerId === userId) {
    return true;
  }

  // Check if user is the developer of the resource
  if (resource.developerId && resource.developerId === userId) {
    return true;
  }

  // Check if user is the assigned verifier
  if (resource.verifierId && resource.verifierId === userId) {
    return true;
  }

  return false;
}
