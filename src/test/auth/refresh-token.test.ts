import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AuthService } from '../../application/services/AuthService';
import { UserRepository } from '../../infrastructure/repositories/UserRepository';
import { EmailVerificationTokenRepository } from '../../infrastructure/repositories/EmailVerificationTokenRepository';
import { SessionRepository } from '../../infrastructure/repositories/SessionRepository';
import { ConsoleEmailService } from '../../infrastructure/services/ConsoleEmailService';
import { UserRole } from '../../domain/entities/User';
import { CryptoUtils } from '../../utils/crypto';

describe('Authentication - Refresh Token', () => {
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
      email: 'refresh-test@example.com',
      passwordHash,
      name: 'Refresh Test User',
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

  it('should successfully refresh tokens with valid refresh token', async () => {
    // Login to get initial tokens
    const loginResult = await authService.login(
      'refresh-test@example.com',
      'TestPassword123!',
      '127.0.0.1',
      'test-agent'
    );

    const oldRefreshToken = loginResult.tokens.refreshToken;
    const oldAccessToken = loginResult.tokens.accessToken;

    // Refresh tokens
    const newTokens = await authService.refreshToken(oldRefreshToken);

    expect(newTokens).toBeDefined();
    expect(newTokens.accessToken).toBeDefined();
    expect(newTokens.refreshToken).toBeDefined();
    expect(newTokens.accessToken).not.toBe(oldAccessToken);
    expect(newTokens.refreshToken).not.toBe(oldRefreshToken);

    // Verify new tokens are valid
    const accessPayload = CryptoUtils.verifyToken(newTokens.accessToken);
    expect(accessPayload.userId).toBe(testUserId);
    expect(accessPayload.email).toBe('refresh-test@example.com');

    const refreshPayload = CryptoUtils.verifyToken(newTokens.refreshToken);
    expect(refreshPayload.userId).toBe(testUserId);
  });

  it('should fail to refresh with invalid token', async () => {
    const invalidToken = 'invalid.token.here';

    await expect(authService.refreshToken(invalidToken)).rejects.toThrow('Invalid refresh token');
  });

  it('should fail to refresh with non-existent session', async () => {
    // Create a valid token but without a session
    const tokens = CryptoUtils.generateAuthTokens({
      userId: testUserId,
      email: 'refresh-test@example.com',
      role: UserRole.DEVELOPER,
    });

    await expect(authService.refreshToken(tokens.refreshToken)).rejects.toThrow(
      'Session not found'
    );
  });

  it('should create new session when refreshing tokens', async () => {
    // Login to get initial tokens
    const loginResult = await authService.login(
      'refresh-test@example.com',
      'TestPassword123!',
      '127.0.0.1',
      'test-agent'
    );

    // Get initial session count
    let sessions = await sessionRepository.findByUserId(testUserId);
    const initialSessionCount = sessions.length;

    // Refresh tokens
    await authService.refreshToken(loginResult.tokens.refreshToken);

    // Verify new session was created (old one deleted, new one created)
    sessions = await sessionRepository.findByUserId(testUserId);
    expect(sessions.length).toBe(initialSessionCount);
  });

  it('should preserve IP address and user agent when refreshing', async () => {
    // Login to get initial tokens
    const loginResult = await authService.login(
      'refresh-test@example.com',
      'TestPassword123!',
      '192.168.1.100',
      'Mozilla/5.0'
    );

    // Refresh tokens
    await authService.refreshToken(loginResult.tokens.refreshToken);

    // Verify session has same IP and user agent
    const sessions = await sessionRepository.findByUserId(testUserId);
    expect(sessions.length).toBe(1);
    expect(sessions[0].ipAddress).toBe('192.168.1.100');
    expect(sessions[0].userAgent).toBe('Mozilla/5.0');
  });

  it('should fail to refresh if user is deleted', async () => {
    // Login to get initial tokens
    const loginResult = await authService.login(
      'refresh-test@example.com',
      'TestPassword123!',
      '127.0.0.1',
      'test-agent'
    );

    // Delete user
    await userRepository.delete(testUserId);
    testUserId = ''; // Prevent cleanup from failing

    // Try to refresh
    await expect(authService.refreshToken(loginResult.tokens.refreshToken)).rejects.toThrow(
      'User not found'
    );
  });
});
