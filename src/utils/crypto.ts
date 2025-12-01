import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt, { SignOptions } from 'jsonwebtoken';
import { config } from '../config';

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
}

export interface RefreshTokenPayload {
  userId: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiry: Date;
  refreshTokenExpiry: Date;
}

export class CryptoUtils {
  /**
   * Hash a password using bcrypt with configured cost factor
   */
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, config.security.bcryptRounds);
  }

  /**
   * Verify a password against a hash
   */
  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Generate a secure random token for email verification
   */
  static generateVerificationToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generate a unique ID
   */
  static generateId(): string {
    return crypto.randomUUID();
  }

  /**
   * Generate JWT access and refresh tokens
   */
  static generateAuthTokens(payload: TokenPayload): AuthTokens {
    // Type-safe JWT secret
    const secret: string = config.jwt.secret;

    // Access token with full payload
    const accessTokenPayload: TokenPayload = {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
    };
    const accessToken = jwt.sign(
      accessTokenPayload,
      secret,
      { expiresIn: config.jwt.accessExpiry } as SignOptions
    );

    // Refresh token with minimal payload
    const refreshTokenPayload: RefreshTokenPayload = {
      userId: payload.userId,
    };
    const refreshToken = jwt.sign(
      refreshTokenPayload,
      secret,
      { expiresIn: config.jwt.refreshExpiry } as SignOptions
    );

    // Calculate expiry dates
    const accessTokenExpiry = new Date();
    accessTokenExpiry.setMinutes(accessTokenExpiry.getMinutes() + 15);

    const refreshTokenExpiry = new Date();
    refreshTokenExpiry.setDate(refreshTokenExpiry.getDate() + 7);

    return {
      accessToken,
      refreshToken,
      accessTokenExpiry,
      refreshTokenExpiry,
    };
  }

  /**
   * Verify and decode a JWT token
   */
  static verifyToken(token: string): TokenPayload {
    return jwt.verify(token, config.jwt.secret) as TokenPayload;
  }

  /**
   * Hash a token for storage (to prevent token theft if database is compromised)
   */
  static hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
