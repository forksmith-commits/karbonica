import { z } from 'zod';
import { UserRole } from '../../domain/entities/User';
import { emailSchema, passwordSchema } from '../../utils/validation';

export const registerRequestSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().min(1).max(255),
  company: z.string().max(255).optional(),
  role: z.nativeEnum(UserRole),
});

export type RegisterRequest = z.infer<typeof registerRequestSchema>;

export interface RegisterResponse {
  status: string;
  data: {
    user: {
      id: string;
      email: string;
      name: string;
      company: string | null;
      role: UserRole;
      emailVerified: boolean;
      createdAt: Date;
    };
    message: string;
  };
  meta: {
    timestamp: string;
    requestId: string;
  };
}

export const loginRequestSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;

export interface LoginResponse {
  status: string;
  data: {
    user: {
      id: string;
      email: string;
      name: string;
      company: string | null;
      role: UserRole;
      emailVerified: boolean;
      lastLoginAt: Date | null;
    };
    tokens: {
      accessToken: string;
      refreshToken: string;
      accessTokenExpiry: Date;
      refreshTokenExpiry: Date;
    };
  };
  meta: {
    timestamp: string;
    requestId: string;
  };
}

export const refreshTokenRequestSchema = z.object({
  refreshToken: z.string().min(1),
});

export type RefreshTokenRequest = z.infer<typeof refreshTokenRequestSchema>;
