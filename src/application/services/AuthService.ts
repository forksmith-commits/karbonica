import { IUserRepository } from '../../domain/repositories/IUserRepository';
import { IEmailVerificationTokenRepository } from '../../domain/repositories/IEmailVerificationTokenRepository';
import { ISessionRepository } from '../../domain/repositories/ISessionRepository';
import { IEmailService } from '../../domain/services/IEmailService';
import { ICardanoWalletRepository } from '../../domain/repositories/ICardanoWalletRepository';
import { User, UserRole } from '../../domain/entities/User';
import { Session } from '../../domain/entities/Session';
import { CryptoUtils, AuthTokens } from '../../utils/crypto';
import { validateEmail } from '../../utils/validation';
import { logger } from '../../utils/logger';
import { CardanoWalletService } from '../../domain/services/CardanoWalletService';

export interface RegisterUserData {
  email: string;
  password: string;
  name: string;
  company?: string;
  role: UserRole;
}

export interface RegisterUserResult {
  user: Omit<User, 'passwordHash'>;
  verificationToken: string;
}

export interface LoginChallenge {
  challengeId: string;
  message: string;
  userId: string;
}

export interface LoginResult {
  user: Omit<User, 'passwordHash'>;
  tokens: AuthTokens;
}

export class AuthService {
  private readonly ACCOUNT_LOCKOUT_THRESHOLD = 5;
  private readonly ACCOUNT_LOCKOUT_DURATION_MS = 30 * 60 * 1000; // 30 minutes
  private walletService: CardanoWalletService;

  constructor(
    private userRepository: IUserRepository,
    private emailVerificationTokenRepository: IEmailVerificationTokenRepository,
    private sessionRepository: ISessionRepository,
    private emailService: IEmailService,
    walletRepository: ICardanoWalletRepository
  ) {
    this.walletService = new CardanoWalletService(walletRepository, userRepository);
  }

  async register(data: RegisterUserData): Promise<RegisterUserResult> {
    // Validate email format
    if (!validateEmail(data.email)) {
      throw new Error('Invalid email format');
    }

    // Check email uniqueness
    const existingUser = await this.userRepository.findByEmail(data.email);
    if (existingUser) {
      throw new Error('Email already registered');
    }

    // Hash password with bcrypt (cost factor 12)
    const passwordHash = await CryptoUtils.hashPassword(data.password);

    // Generate email verification token
    const verificationToken = CryptoUtils.generateVerificationToken();

    // Create user entity
    const now = new Date();
    const user: User = {
      id: CryptoUtils.generateId(),
      email: data.email.toLowerCase(),
      passwordHash,
      name: data.name,
      company: data.company || null,
      role: data.role,
      walletAddress: null,
      emailVerified: false,
      accountLocked: false,
      lockedUntil: null,
      failedLoginAttempts: 0,
      lastLoginAt: null,
      createdAt: now,
      updatedAt: now,
    };

    // Save user to database
    const savedUser = await this.userRepository.save(user);

    // Store verification token in database (expires in 24 hours)
    const tokenExpiry = new Date();
    tokenExpiry.setHours(tokenExpiry.getHours() + 24);

    await this.emailVerificationTokenRepository.save({
      id: CryptoUtils.generateId(),
      userId: savedUser.id,
      token: verificationToken,
      expiresAt: tokenExpiry,
      usedAt: null,
      createdAt: now,
    });

    // Send verification email
    try {
      await this.emailService.sendVerificationEmail(
        savedUser.email,
        savedUser.name,
        verificationToken
      );
    } catch (error) {
      logger.error('Failed to send verification email', {
        userId: savedUser.id,
        email: savedUser.email,
        error,
      });
      // Don't fail registration if email fails
    }

    logger.info('User registered successfully', {
      userId: savedUser.id,
      email: savedUser.email,
      role: savedUser.role,
    });

    // Return user without password hash
    const { passwordHash: _, ...userWithoutPassword } = savedUser;

    return {
      user: userWithoutPassword,
      verificationToken,
    };
  }

  async verifyEmail(token: string): Promise<void> {
    // Find token in database
    const verificationToken = await this.emailVerificationTokenRepository.findByToken(token);

    if (!verificationToken) {
      throw new Error('Invalid verification token');
    }

    // Check if token is already used
    if (verificationToken.usedAt) {
      throw new Error('Verification token already used');
    }

    // Check if token is expired
    if (new Date() > verificationToken.expiresAt) {
      throw new Error('Verification token expired');
    }

    // Get user
    const user = await this.userRepository.findById(verificationToken.userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Check if already verified
    if (user.emailVerified) {
      throw new Error('Email already verified');
    }

    // Update user email_verified status
    user.emailVerified = true;
    user.updatedAt = new Date();
    await this.userRepository.update(user);

    // Mark token as used
    await this.emailVerificationTokenRepository.markAsUsed(verificationToken.id);

    logger.info('Email verified successfully', {
      userId: user.id,
      email: user.email,
    });
  }

  async login(
    email: string,
    password: string,
    ipAddress: string,
    userAgent: string
  ): Promise<LoginResult> {
    // Find user by email
    let user = await this.userRepository.findByEmail(email.toLowerCase());

    // SECURITY FIX: Check if account lock has expired and auto-unlock if needed
    // This handles locks that persisted across server restarts
    if (user && user.accountLocked && user.lockedUntil) {
      const now = new Date();
      if (user.lockedUntil <= now) {
        // Lock has expired - auto-unlock
        try {
          const originalLockedUntil = user.lockedUntil;
          user.accountLocked = false;
          user.lockedUntil = null;
          user.failedLoginAttempts = 0;
          await this.userRepository.update(user);
          logger.info('Account auto-unlocked after lock expiry', {
            userId: user.id,
            email: user.email,
            lockedUntil: originalLockedUntil,
          });
        } catch (error) {
          logger.error('Failed to auto-unlock account', {
            userId: user.id,
            email: user.email,
            error,
          });
          // Continue with login flow - let the lock check handle it
        }
      }
    }

    // SECURITY FIX: Always perform bcrypt comparison to prevent timing attacks
    // Use dummy hash if user doesn't exist to maintain constant time
    const DUMMY_HASH = '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYIq8r8MiQu'; // Valid bcrypt format
    const hashToCompare = user?.passwordHash || DUMMY_HASH;

    // SECURITY FIX: Verify password FIRST to maintain constant time for ALL requests
    // This prevents timing side-channel for locked accounts and missing users
    const isPasswordValid = await CryptoUtils.verifyPassword(password, hashToCompare);

    // Now check if account is locked (after password verification to prevent timing attack)
    if (user?.accountLocked) {
      const lockMessage = user.lockedUntil
        ? `Account is locked until ${user.lockedUntil.toISOString()}. Please try again later.`
        : 'Account is locked. Please contact support.';

      logger.warn('Login attempt on locked account', {
        userId: user.id,
        email,
        lockedUntil: user.lockedUntil?.toISOString(),
      });

      throw new Error(lockMessage);
    }

    // Check if user exists AND password is valid
    if (!user || !isPasswordValid) {
      // Only increment failed attempts if user exists
      if (user && !isPasswordValid) {
        user.failedLoginAttempts += 1;

        // Lock account if threshold reached
        if (user.failedLoginAttempts >= this.ACCOUNT_LOCKOUT_THRESHOLD) {
          // SECURITY FIX: Use persistent lockedUntil timestamp instead of setTimeout
          const now = new Date();
          const lockedUntil = new Date(now.getTime() + this.ACCOUNT_LOCKOUT_DURATION_MS);

          user.accountLocked = true;
          user.lockedUntil = lockedUntil;

          try {
            await this.userRepository.update(user);

            logger.warn('Account locked due to failed login attempts', {
              userId: user.id,
              email,
              attempts: user.failedLoginAttempts,
              lockedUntil: lockedUntil.toISOString(),
            });
          } catch (error) {
            logger.error('Failed to lock account in database', {
              userId: user.id,
              email,
              error,
            });
            // Still throw the error to prevent login
          }

          throw new Error('Account locked due to too many failed login attempts');
        }

        try {
          await this.userRepository.update(user);
        } catch (error) {
          logger.error('Failed to update failed login attempts', {
            userId: user.id,
            email,
            error,
          });
        }

        logger.warn('Failed login attempt', {
          userId: user.id,
          email,
          attempts: user.failedLoginAttempts,
        });
      } else {
        // User doesn't exist - log without user details to prevent enumeration
        logger.warn('Failed login attempt - non-existent email', { email });
      }

      // Always throw same error message to prevent user enumeration
      throw new Error('Invalid credentials');
    }

    // Reset failed login attempts on successful password verification
    user.failedLoginAttempts = 0;
    user.lastLoginAt = new Date();
    user.lockedUntil = null; // Clear any residual lock timestamp

    try {
      await this.userRepository.update(user);
    } catch (error) {
      logger.error('Failed to update user on successful login', {
        userId: user.id,
        email,
        error,
      });
      // Don't fail the login for this - continue
    }

    // Generate JWT tokens
    const tokens = CryptoUtils.generateAuthTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    // Create session
    const session: Session = {
      id: CryptoUtils.generateId(),
      userId: user.id,
      accessToken: CryptoUtils.hashToken(tokens.accessToken),
      refreshToken: CryptoUtils.hashToken(tokens.refreshToken),
      expiresAt: tokens.refreshTokenExpiry,
      ipAddress,
      userAgent,
      createdAt: new Date(),
    };

    await this.sessionRepository.save(session);

    logger.info('User logged in successfully', {
      userId: user.id,
      email: user.email,
      ipAddress,
    });

    // Return user without password hash
    const { passwordHash: _, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      tokens,
    };
  }

  async logout(userId: string): Promise<void> {
    await this.sessionRepository.deleteByUserId(userId);
    logger.info('User logged out', { userId });
  }

  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    // Verify refresh token
    let payload;
    try {
      payload = CryptoUtils.verifyToken(refreshToken);
    } catch (error) {
      throw new Error('Invalid refresh token');
    }

    // Find session by hashed refresh token
    const hashedToken = CryptoUtils.hashToken(refreshToken);
    const session = await this.sessionRepository.findByRefreshToken(hashedToken);

    if (!session) {
      throw new Error('Session not found');
    }

    // Get user
    const user = await this.userRepository.findById(payload.userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Generate new tokens
    const tokens = CryptoUtils.generateAuthTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    // Update session with new tokens
    await this.sessionRepository.delete(session.id);

    const newSession: Session = {
      id: CryptoUtils.generateId(),
      userId: user.id,
      accessToken: CryptoUtils.hashToken(tokens.accessToken),
      refreshToken: CryptoUtils.hashToken(tokens.refreshToken),
      expiresAt: tokens.refreshTokenExpiry,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      createdAt: new Date(),
    };

    await this.sessionRepository.save(newSession);

    logger.info('Token refreshed', { userId: user.id });

    return tokens;
  }

  /**
   * Verify wallet authentication
   * Requirements: 2.1, 2.2, 2.3, 2.5, 2.6
   */
  async verifyWallet(
    challengeId: string,
    address: string,
    signature: string,
    publicKey: string,
    ipAddress: string,
    userAgent: string
  ): Promise<LoginResult> {
    // Verify signature against challenge
    const isValidSignature = await this.walletService.verifySignature(
      challengeId,
      address,
      signature,
      publicKey
    );

    if (!isValidSignature) {
      logger.warn('Wallet authentication failed - invalid signature', { address });
      throw new Error('Invalid signature or expired challenge');
    }

    // Match wallet address to user account
    const wallet = await this.walletService.getWalletByAddress(address);

    if (!wallet) {
      logger.warn('Wallet authentication failed - wallet not linked', { address });
      throw new Error('Wallet address not linked to any account');
    }

    // Get user
    const user = await this.userRepository.findById(wallet.userId);

    if (!user) {
      logger.error('Wallet authentication failed - user not found', {
        address,
        userId: wallet.userId,
      });
      throw new Error('User not found');
    }

    // Check if account is locked
    if (user.accountLocked) {
      logger.warn('Wallet authentication failed - account locked', {
        userId: user.id,
        address,
      });
      throw new Error('Account is locked. Please contact support.');
    }

    // Update last login timestamp
    user.lastLoginAt = new Date();
    await this.userRepository.update(user);

    // Generate JWT tokens
    const tokens = CryptoUtils.generateAuthTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    // Create session
    const session: Session = {
      id: CryptoUtils.generateId(),
      userId: user.id,
      accessToken: CryptoUtils.hashToken(tokens.accessToken),
      refreshToken: CryptoUtils.hashToken(tokens.refreshToken),
      expiresAt: tokens.refreshTokenExpiry,
      ipAddress,
      userAgent,
      createdAt: new Date(),
    };

    await this.sessionRepository.save(session);

    logger.info('Wallet authentication successful', {
      userId: user.id,
      address,
      ipAddress,
    });

    // Return user without password hash
    const { passwordHash: _, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      tokens,
    };
  }
}
