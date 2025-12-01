export enum UserRole {
  DEVELOPER = 'developer',
  VERIFIER = 'verifier',
  ADMINISTRATOR = 'administrator',
  BUYER = 'buyer',
}

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  company: string | null;
  role: UserRole;
  walletAddress: string | null;
  emailVerified: boolean;
  accountLocked: boolean;
  lockedUntil: Date | null;
  failedLoginAttempts: number;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserData {
  email: string;
  password: string;
  name: string;
  company?: string;
  role: UserRole;
}
