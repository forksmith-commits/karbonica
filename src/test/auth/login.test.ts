import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AuthService } from '../../application/services/AuthService';
import { UserRepository } from '../../infrastructure/repositories/UserRepository';
import { EmailVerificationTokenRepository } from '../../infrastructure/repositories/EmailVerificationTokenRepository';
import { SessionRepository } from '../../infrastructure/repositories/SessionRepository';
import { ConsoleEmailService } from '../../infrastructure/services/ConsoleEmailService';
import { UserRole } from '../../domain/entities/User';
import { CryptoUtils } from '../../utils/crypto';
import { database } from '../../config/database';

describe('Authentication - Login', () => {
  let authService: AuthService;
  let userRepository: UserRepository;
  let sessionRepository: SessionRepository;
  let testUserId: string;

  beforeEach(async () => {
    // Initialize repositories and service
    userRepository = new UserRepository();
    const emailVerificationTokenRepository = new EmailVerificationTokenRepository();
    sessionRepository = new SessionRepository();
    const emailService = new ConsoleEmailService();

    authService = new AuthService(
      userRepository,
      emailVerificationTokenRepository,
      sessionRepository,
      emailService
    );

    // Create a test user
    const passwordHash = await CryptoUtils.hashPassword('TestPassword123!');
    const testUser = {
      id: CryptoUtils.generateId(),
      email: 'test@example.com',
      passwordHash,
      name: 'Test User',
      company: null,
      role: UserRole.DEVELOPER,
      walletAddress: null,
      emailVerified: true,
      accountLocked: false,
      failedLoginAttempts: 0,
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const savedUser = await userRepository.save(testUser);
    testUserId = savedUser.id;
  });

  afterEach(async () => {
    // Clean up test data
    if (testUserId) {
      await sessionRepository.deleteByUserId(testUserId);
      await userRepository.delete(testUserId);
    }
  });

  it('should successfully login with valid credentials', async () => {
    const result = await authService.login(
      'test@example.com',
      'TestPassword123!',
      '127.0.0.1',
      'test-agent'
    );

    expect(result).toBeDefined();
    expect(result.user).toBeDefined();
    expect(result.user.email).toBe('test@example.com');
    expect(result.user.name).toBe('Test User');
    expect(result.tokens).toBeDefined();
    expect(result.tokens.accessToken).toBeDefined();
    expect(result.tokens.refreshToken).toBeDefined();
    expect(result.tokens.accessTokenExpiry).toBeInstanceOf(Date);
    expect(result.tokens.refreshTokenExpiry).toBeInstanceOf(Date);

    // Verify session was created
    const sessions = await sessionRepository.findByUserId(testUserId);
    expect(sessions.length).toBe(1);
    expect(sessions[0].userId).toBe(testUserId);
    expect(sessions[0].ipAddress).toBe('127.0.0.1');
    expect(sessions[0].userAgent).toBe('test-agent');
  });

  it('should fail login with invalid email', async () => {
    await expect(
      authService.login('nonexistent@example.com', 'TestPassword123!', '127.0.0.1', 'test-agent')
    ).rejects.toThrow('Invalid credentials');
  });

  it('should fail login with invalid password', async () => {
    await expect(
      authService.login('test@example.com', 'WrongPassword123!', '127.0.0.1', 'test-agent')
    ).rejects.toThrow('Invalid credentials');

    // Verify failed login attempt was recorded
    const user = await userRepository.findByEmail('test@example.com');
    expect(user?.failedLoginAttempts).toBe(1);
  });

  it('should lock account after 5 failed login attempts', async () => {
    // Attempt 5 failed logins
    for (let i = 0; i < 5; i++) {
      try {
        await authService.login('test@example.com', 'WrongPassword', '127.0.0.1', 'test-agent');
      } catch (error) {
        // Expected to fail
      }
    }

    // Verify account is locked
    const user = await userRepository.findByEmail('test@example.com');
    expect(user?.accountLocked).toBe(true);
    expect(user?.failedLoginAttempts).toBe(5);

    // Verify login fails with locked account message
    await expect(
      authService.login('test@example.com', 'TestPassword123!', '127.0.0.1', 'test-agent')
    ).rejects.toThrow('Account is locked. Please try again later.');
  });

  it('should reset failed login attempts on successful login', async () => {
    // Make a failed login attempt
    try {
      await authService.login('test@example.com', 'WrongPassword', '127.0.0.1', 'test-agent');
    } catch (error) {
      // Expected to fail
    }

    // Verify failed attempt was recorded
    let user = await userRepository.findByEmail('test@example.com');
    expect(user?.failedLoginAttempts).toBe(1);

    // Successful login
    await authService.login('test@example.com', 'TestPassword123!', '127.0.0.1', 'test-agent');

    // Verify failed attempts were reset
    user = await userRepository.findByEmail('test@example.com');
    expect(user?.failedLoginAttempts).toBe(0);
  });

  it('should generate valid JWT tokens', async () => {
    const result = await authService.login(
      'test@example.com',
      'TestPassword123!',
      '127.0.0.1',
      'test-agent'
    );

    // Verify access token
    const accessPayload = CryptoUtils.verifyToken(result.tokens.accessToken);
    expect(accessPayload.userId).toBe(testUserId);
    expect(accessPayload.email).toBe('test@example.com');
    expect(accessPayload.role).toBe(UserRole.DEVELOPER);

    // Verify refresh token
    const refreshPayload = CryptoUtils.verifyToken(result.tokens.refreshToken);
    expect(refreshPayload.userId).toBe(testUserId);
  });

  it('should update lastLoginAt timestamp on successful login', async () => {
    const beforeLogin = new Date();

    await authService.login('test@example.com', 'TestPassword123!', '127.0.0.1', 'test-agent');

    const user = await userRepository.findByEmail('test@example.com');
    expect(user?.lastLoginAt).toBeDefined();
    expect(user?.lastLoginAt!.getTime()).toBeGreaterThanOrEqual(beforeLogin.getTime());
  });
});
