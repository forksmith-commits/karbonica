import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthService } from '../AuthService';
import { IUserRepository } from '../../../domain/repositories/IUserRepository';
import { User, UserRole } from '../../../domain/entities/User';
import { CryptoUtils } from '../../../utils/crypto';

// Mock user repository
class MockUserRepository implements IUserRepository {
  private users: Map<string, User> = new Map();

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) || null;
  }

  async findByEmail(email: string): Promise<User | null> {
    return Array.from(this.users.values()).find((u) => u.email === email) || null;
  }

  async findByWalletAddress(address: string): Promise<User | null> {
    return Array.from(this.users.values()).find((u) => u.walletAddress === address) || null;
  }

  async save(user: User): Promise<User> {
    this.users.set(user.id, user);
    return user;
  }

  async update(user: User): Promise<User> {
    this.users.set(user.id, user);
    return user;
  }

  async delete(id: string): Promise<void> {
    this.users.delete(id);
  }

  clear(): void {
    this.users.clear();
  }
}

describe('AuthService - User Registration', () => {
  let authService: AuthService;
  let mockRepository: MockUserRepository;

  beforeEach(() => {
    mockRepository = new MockUserRepository();
    authService = new AuthService(mockRepository);
  });

  describe('Email Validation', () => {
    it('should reject invalid email format', async () => {
      await expect(
        authService.register({
          email: 'invalid-email',
          password: 'Password123',
          name: 'Test User',
          role: UserRole.DEVELOPER,
        })
      ).rejects.toThrow('Invalid email format');
    });

    it('should accept valid email format', async () => {
      const result = await authService.register({
        email: 'valid@example.com',
        password: 'Password123',
        name: 'Test User',
        role: UserRole.DEVELOPER,
      });

      expect(result.user.email).toBe('valid@example.com');
    });

    it('should normalize email to lowercase', async () => {
      const result = await authService.register({
        email: 'Test@Example.COM',
        password: 'Password123',
        name: 'Test User',
        role: UserRole.DEVELOPER,
      });

      expect(result.user.email).toBe('test@example.com');
    });
  });

  describe('Password Hashing', () => {
    it('should hash password with bcrypt', async () => {
      const password = 'Password123';
      const result = await authService.register({
        email: 'test@example.com',
        password,
        name: 'Test User',
        role: UserRole.DEVELOPER,
      });

      const savedUser = await mockRepository.findById(result.user.id);
      expect(savedUser?.passwordHash).toBeDefined();
      expect(savedUser?.passwordHash).not.toBe(password);
      expect(savedUser?.passwordHash).toMatch(/^\$2[aby]\$/);
    });

    it('should verify hashed password', async () => {
      const password = 'Password123';
      const result = await authService.register({
        email: 'test@example.com',
        password,
        name: 'Test User',
        role: UserRole.DEVELOPER,
      });

      const savedUser = await mockRepository.findById(result.user.id);
      const isValid = await CryptoUtils.verifyPassword(password, savedUser!.passwordHash);

      expect(isValid).toBe(true);
    });
  });

  describe('Duplicate Email Rejection', () => {
    it('should reject registration with existing email', async () => {
      // Register first user
      await authService.register({
        email: 'test@example.com',
        password: 'Password123',
        name: 'First User',
        role: UserRole.DEVELOPER,
      });

      // Attempt to register with same email
      await expect(
        authService.register({
          email: 'test@example.com',
          password: 'DifferentPass123',
          name: 'Second User',
          role: UserRole.BUYER,
        })
      ).rejects.toThrow('Email already registered');
    });

    it('should reject registration with existing email (case insensitive)', async () => {
      // Register first user
      await authService.register({
        email: 'test@example.com',
        password: 'Password123',
        name: 'First User',
        role: UserRole.DEVELOPER,
      });

      // Attempt to register with same email in different case
      await expect(
        authService.register({
          email: 'TEST@EXAMPLE.COM',
          password: 'DifferentPass123',
          name: 'Second User',
          role: UserRole.BUYER,
        })
      ).rejects.toThrow('Email already registered');
    });
  });

  describe('Successful Registration Flow', () => {
    it('should successfully register a new user', async () => {
      const result = await authService.register({
        email: 'newuser@example.com',
        password: 'Password123',
        name: 'New User',
        company: 'Test Company',
        role: UserRole.DEVELOPER,
      });

      expect(result.user).toBeDefined();
      expect(result.user.id).toBeDefined();
      expect(result.user.email).toBe('newuser@example.com');
      expect(result.user.name).toBe('New User');
      expect(result.user.company).toBe('Test Company');
      expect(result.user.role).toBe(UserRole.DEVELOPER);
      expect(result.user.emailVerified).toBe(false);
      expect(result.user.createdAt).toBeInstanceOf(Date);
    });

    it('should generate verification token', async () => {
      const result = await authService.register({
        email: 'newuser@example.com',
        password: 'Password123',
        name: 'New User',
        role: UserRole.DEVELOPER,
      });

      expect(result.verificationToken).toBeDefined();
      expect(result.verificationToken.length).toBe(64);
      expect(result.verificationToken).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should not return password hash in response', async () => {
      const result = await authService.register({
        email: 'newuser@example.com',
        password: 'Password123',
        name: 'New User',
        role: UserRole.DEVELOPER,
      });

      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('should set default values correctly', async () => {
      const result = await authService.register({
        email: 'newuser@example.com',
        password: 'Password123',
        name: 'New User',
        role: UserRole.DEVELOPER,
      });

      expect(result.user.emailVerified).toBe(false);
      expect(result.user.walletAddress).toBeNull();
      expect(result.user.company).toBeNull();
    });

    it('should save user to repository', async () => {
      const result = await authService.register({
        email: 'newuser@example.com',
        password: 'Password123',
        name: 'New User',
        role: UserRole.DEVELOPER,
      });

      const savedUser = await mockRepository.findById(result.user.id);
      expect(savedUser).toBeDefined();
      expect(savedUser?.email).toBe('newuser@example.com');
    });

    it('should support all user roles', async () => {
      const roles = [UserRole.DEVELOPER, UserRole.VERIFIER, UserRole.ADMINISTRATOR, UserRole.BUYER];

      for (const role of roles) {
        const result = await authService.register({
          email: `${role}@example.com`,
          password: 'Password123',
          name: `${role} User`,
          role,
        });

        expect(result.user.role).toBe(role);
      }
    });
  });
});
