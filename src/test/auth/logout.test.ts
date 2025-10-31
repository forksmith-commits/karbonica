import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AuthService } from '../../application/services/AuthService';
import { UserRepository } from '../../infrastructure/repositories/UserRepository';
import { EmailVerificationTokenRepository } from '../../infrastructure/repositories/EmailVerificationTokenRepository';
import { SessionRepository } from '../../infrastructure/repositories/SessionRepository';
import { ConsoleEmailService } from '../../infrastructure/services/ConsoleEmailService';
import { UserRole } from '../../domain/entities/User';
import { CryptoUtils } from '../../utils/crypto';

describe('Authentication - Logout', () => {
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
      email: 'logout-test@example.com',
      passwordHash,
      name: 'Logout Test User',
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

  it('should successfully logout and delete all user sessions', async () => {
    // Login to create a session
    await authService.login(
      'logout-test@example.com',
      'TestPassword123!',
      '127.0.0.1',
      'test-agent'
    );

    // Verify session exists
    let sessions = await sessionRepository.findByUserId(testUserId);
    expect(sessions.length).toBe(1);

    // Logout
    await authService.logout(testUserId);

    // Verify all sessions are deleted
    sessions = await sessionRepository.findByUserId(testUserId);
    expect(sessions.length).toBe(0);
  });

  it('should delete multiple sessions on logout', async () => {
    // Login multiple times to create multiple sessions
    await authService.login(
      'logout-test@example.com',
      'TestPassword123!',
      '127.0.0.1',
      'test-agent-1'
    );
    await authService.login(
      'logout-test@example.com',
      'TestPassword123!',
      '192.168.1.1',
      'test-agent-2'
    );

    // Verify multiple sessions exist
    let sessions = await sessionRepository.findByUserId(testUserId);
    expect(sessions.length).toBe(2);

    // Logout
    await authService.logout(testUserId);

    // Verify all sessions are deleted
    sessions = await sessionRepository.findByUserId(testUserId);
    expect(sessions.length).toBe(0);
  });
});
