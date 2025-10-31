import { describe, it, expect } from 'vitest';
import { validateEmail, emailSchema, passwordSchema } from '../validation';

describe('Email Validation', () => {
  it('should validate correct email formats', () => {
    expect(validateEmail('user@example.com')).toBe(true);
    expect(validateEmail('test.user@domain.co.uk')).toBe(true);
    expect(validateEmail('user+tag@example.com')).toBe(true);
    expect(validateEmail('user_name@example.com')).toBe(true);
  });

  it('should reject invalid email formats', () => {
    expect(validateEmail('invalid')).toBe(false);
    expect(validateEmail('invalid@')).toBe(false);
    expect(validateEmail('@example.com')).toBe(false);
    expect(validateEmail('user@')).toBe(false);
    expect(validateEmail('user@domain')).toBe(false);
  });

  it('should validate email with zod schema', () => {
    expect(() => emailSchema.parse('user@example.com')).not.toThrow();
    expect(() => emailSchema.parse('invalid')).toThrow();
  });
});

describe('Password Validation', () => {
  it('should validate strong passwords', () => {
    expect(() => passwordSchema.parse('Password123')).not.toThrow();
    expect(() => passwordSchema.parse('MyP@ssw0rd')).not.toThrow();
    expect(() => passwordSchema.parse('Secure123Pass')).not.toThrow();
  });

  it('should reject passwords without uppercase letters', () => {
    expect(() => passwordSchema.parse('password123')).toThrow();
  });

  it('should reject passwords without lowercase letters', () => {
    expect(() => passwordSchema.parse('PASSWORD123')).toThrow();
  });

  it('should reject passwords without numbers', () => {
    expect(() => passwordSchema.parse('PasswordOnly')).toThrow();
  });

  it('should reject passwords that are too short', () => {
    expect(() => passwordSchema.parse('Pass1')).toThrow();
  });

  it('should reject passwords that are too long', () => {
    const longPassword = 'A1' + 'a'.repeat(127);
    expect(() => passwordSchema.parse(longPassword)).toThrow();
  });
});
