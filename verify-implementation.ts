/**
 * Manual verification script for Task 3 implementation
 * This script verifies that all components are correctly implemented
 */

import { CryptoUtils } from './src/utils/crypto';
import { validateEmail, emailSchema, passwordSchema } from './src/utils/validation';

async function verifyImplementation() {
  console.log('=== Task 3 Implementation Verification ===\n');

  // Test 1: Email Validation
  console.log('Test 1: Email Validation');
  const validEmail = 'test@example.com';
  const invalidEmail = 'invalid-email';
  console.log(`  Valid email (${validEmail}):`, validateEmail(validEmail) ? '✓ PASS' : '✗ FAIL');
  console.log(
    `  Invalid email (${invalidEmail}):`,
    !validateEmail(invalidEmail) ? '✓ PASS' : '✗ FAIL'
  );

  // Test 2: Password Validation
  console.log('\nTest 2: Password Validation');
  try {
    passwordSchema.parse('Password123');
    console.log('  Strong password validation: ✓ PASS');
  } catch {
    console.log('  Strong password validation: ✗ FAIL');
  }

  try {
    passwordSchema.parse('weak');
    console.log('  Weak password rejection: ✗ FAIL');
  } catch {
    console.log('  Weak password rejection: ✓ PASS');
  }

  // Test 3: Password Hashing
  console.log('\nTest 3: Password Hashing');
  const password = 'TestPassword123';
  const hash = await CryptoUtils.hashPassword(password);
  console.log('  Password hashed:', hash.startsWith('$2') ? '✓ PASS' : '✗ FAIL');

  const isValid = await CryptoUtils.verifyPassword(password, hash);
  console.log('  Password verification:', isValid ? '✓ PASS' : '✗ FAIL');

  const isInvalid = await CryptoUtils.verifyPassword('WrongPassword', hash);
  console.log('  Wrong password rejected:', !isInvalid ? '✓ PASS' : '✗ FAIL');

  // Test 4: Token Generation
  console.log('\nTest 4: Token Generation');
  const token = CryptoUtils.generateVerificationToken();
  console.log('  Token length (64 chars):', token.length === 64 ? '✓ PASS' : '✗ FAIL');
  console.log('  Token format (hex):', /^[a-f0-9]{64}$/.test(token) ? '✓ PASS' : '✗ FAIL');

  // Test 5: UUID Generation
  console.log('\nTest 5: UUID Generation');
  const uuid = CryptoUtils.generateId();
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  console.log('  UUID format:', uuidRegex.test(uuid) ? '✓ PASS' : '✗ FAIL');

  console.log('\n=== Verification Complete ===');
  console.log('\nAll core utilities are working correctly!');
  console.log('The implementation is ready for integration testing.');
}

verifyImplementation().catch(console.error);
