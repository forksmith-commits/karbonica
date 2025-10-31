import { IUserRepository } from '../../domain/repositories/IUserRepository';
import { IEmailVerificationTokenRepository } from '../../domain/repositories/IEmailVerificationTokenRepository';
import { ISessionRepository } from '../../domain/repositories/ISessionRepository';
import { IEmailService } from '../../domain/services/IEmailService';
import { User, CreateUserData, UserRole } from '../../domain/entities/User';
import { Session } from '../../domain/entities/Session';
import { CryptoUtils, AuthTokens } from '../../utils/crypto';
import { validateEmail } from '../../utils/validation';
import { logger } from '../../utils/logger';

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
  private loginChallenges: Map<string, { userId: string; expiresAt: Date }> = new Map();
  private readonly ACCOUNT_LOCKOUT_THRESHOLD = 5;
  private readonly ACCOUNT_LOCKOUT_DURATION_MS = 30 * 60 * 1000; // 30 minutes
  private readonly FAILED_LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

  constructor(
    private userRepository: IUserRepository,
    private emailVerificationTokenRepository: IEmailVerificationTokenRepository,
    private sessionRepository: ISessionRepository,
    private emailService: IEmailService
  ) {}

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
    const user = await this.userRepository.findByEmail(email.toLowerCase());

    if (!user) {
      logger.warn('Login attempt with non-existent email', { email });
      throw new Error('Invalid credentials');
    }

    // Check if account is locked
    if (user.accountLocked) {
      logger.warn('Login attempt on locked account', { userId: user.id, email });
      throw new Error('Account is locked. Please try again later.');
    }

    // Verify password
    const isPasswordValid = await CryptoUtils.verifyPassword(password, user.passwordHash);

    if (!isPasswordValid) {
      // Increment failed login attempts
      user.failedLoginAttempts += 1;

      // Lock account if threshold reached
      if (user.failedLoginAttempts >= this.ACCOUNT_LOCKOUT_THRESHOLD) {
        user.accountLocked = true;
        await this.userRepository.update(user);

        // Schedule unlock after 30 minutes
        setTimeout(async () => {
          const lockedUser = await this.userRepository.findById(user.id);
          if (lockedUser && lockedUser.accountLocked) {
            lockedUser.accountLocked = false;
            lockedUser.failedLoginAttempts = 0;
            await this.userRepository.update(lockedUser);
            logger.info('Account unlocked after timeout', { userId: user.id });
          }
        }, this.ACCOUNT_LOCKOUT_DURATION_MS);

        logger.warn('Account locked due to failed login attempts', {
          userId: user.id,
          email,
          attempts: user.failedLoginAttempts,
        });

        throw new Error('Account locked due to too many failed login attempts');
      }

      await this.userRepository.update(user);

      logger.warn('Failed login attempt', {
        userId: user.id,
        email,
        attempts: user.failedLoginAttempts,
      });

      throw new Error('Invalid credentials');
    }

    // Reset failed login attempts on successful password verification
    user.failedLoginAttempts = 0;
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
}
