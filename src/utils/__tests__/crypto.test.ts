import { describe, it, expect } from 'vitest';
import { CryptoUtils } from '../crypto';

describe('CryptoUtils', () => {
  describe('Password Hashing', () => {
    it('should hash a password', async () => {
      const password = 'TestPassword123';
      const hash = await CryptoUtils.hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(0);
      expect(hash).toMatch(/^\$2[aby]\$/); // bcrypt hash format
    });

    it('should generate different hashes for the same password', async () => {
      const password = 'TestPassword123';
      const hash1 = await CryptoUtils.hashPassword(password);
      const hash2 = await CryptoUtils.hashPassword(password);

      expect(hash1).not.toBe(hash2); // bcrypt uses salt
    });

    it('should verify correct password', async () => {
      const password = 'TestPassword123';
      const hash = await CryptoUtils.hashPassword(password);
      const isValid = await CryptoUtils.verifyPassword(password, hash);

      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'TestPassword123';
      const wrongPassword = 'WrongPassword123';
      const hash = await CryptoUtils.hashPassword(password);
      const isValid = await CryptoUtils.verifyPassword(wrongPassword, hash);

      expect(isValid).toBe(false);
    });
  });

  describe('Token Generation', () => {
    it('should generate a verification token', () => {
      const token = CryptoUtils.generateVerificationToken();

      expect(token).toBeDefined();
      expect(token.length).toBe(64); // 32 bytes = 64 hex characters
      expect(token).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should generate unique tokens', () => {
      const token1 = CryptoUtils.generateVerificationToken();
      const token2 = CryptoUtils.generateVerificationToken();

      expect(token1).not.toBe(token2);
    });
  });

  describe('ID Generation', () => {
    it('should generate a UUID', () => {
      const id = CryptoUtils.generateId();

      expect(id).toBeDefined();
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it('should generate unique IDs', () => {
      const id1 = CryptoUtils.generateId();
      const id2 = CryptoUtils.generateId();

      expect(id1).not.toBe(id2);
    });
  });
});
