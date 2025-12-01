# Security Fixes Summary

**Date Started:** December 1, 2025
**Status:** IN PROGRESS

---

## Completed Fixes ✅

### 1. SQL Injection in ProjectRepository
**Severity:** CRITICAL
**Files Fixed:** `src/infrastructure/repositories/ProjectRepository.ts`

**Changes Made:**
- Added whitelist of allowed sort columns: `['created_at', 'updated_at', 'title', 'status', 'type', 'id']`
- Sanitized `sortOrder` parameter to only allow 'asc' or 'desc'
- Limited `limit` parameter to max 100 to prevent memory exhaustion
- Fixed 2 vulnerable query instances (lines 66-76 and 138-148)

**Before:**
```typescript
const sortBy = pagination?.sortBy || 'created_at';  // VULNERABLE!
query += ` ORDER BY ${sortBy} ${sortOrder}`;
```

**After:**
```typescript
const ALLOWED_SORT_COLUMNS = ['created_at', 'updated_at', 'title', 'status', 'type', 'id'];
const sortBy = pagination?.sortBy && ALLOWED_SORT_COLUMNS.includes(pagination.sortBy)
  ? pagination.sortBy
  : 'created_at';
const sortOrder = pagination?.sortOrder?.toLowerCase() === 'asc' ? 'asc' : 'desc';
```

---

## In Progress 🔄

### 2. SQL Injection in Other Repositories
**Severity:** CRITICAL
**Files Remaining:**
- `src/infrastructure/repositories/CreditEntryRepository.ts`
- `src/infrastructure/repositories/CreditTransactionRepository.ts`
- `src/infrastructure/repositories/VerificationRequestRepository.ts`
- `src/infrastructure/repositories/MintingTransactionRepositoryPg.ts`

**Action:** Apply same whitelist pattern as ProjectRepository

---

## Pending Fixes 📋

### Critical Priority

#### 3. Timing Attack in AuthService
**File:** `src/application/services/AuthService.ts:187-241`

**Fix Required:**
```typescript
// Always perform bcrypt comparison, even with dummy hash
const user = await this.userRepository.findByEmail(email.toLowerCase());
const DUMMY_HASH = '$2b$12$dummyhashfordummyhashfordummyhashfordummyhashfor';

const hashToCompare = user?.passwordHash || DUMMY_HASH;
const isPasswordValid = await CryptoUtils.verifyPassword(password, hashToCompare);

if (!user || !isPasswordValid) {
  logger.warn('Failed login attempt', { email });
  throw new Error('Invalid credentials');
}
```

#### 4. Account Lockout Bypass
**File:** `src/application/services/AuthService.ts:212-221`

**Fix Required:**
- Add `lockedUntil` field to User entity
- Store lockout expiry in database instead of setTimeout
- Check and auto-unlock during authentication

#### 5. Incomplete Wallet Signature Verification
**File:** `src/domain/services/CardanoWalletService.ts:199-206`

**Fix Required:**
- Implement proper COSE_Sign1 verification
- Verify Ed25519 signature cryptographically
- Validate public key matches address

#### 6. Insecure Random Number Generation
**Files:**
- `src/infrastructure/services/CardanoErrorHandler.ts:110, 159`
- `src/domain/services/CardanoTransactionService.ts:284, 373`
- `src/infrastructure/repositories/MintingTransactionRepositoryPg.ts:351`

**Fix Required:**
```typescript
// Replace Math.random() with crypto.randomBytes()
import { randomBytes } from 'crypto';
id: `failed_${Date.now()}_${randomBytes(6).toString('hex')}`
```

---

### High Priority

#### 7. CSRF Protection
**File:** `src/index.ts`

**Fix Required:**
```bash
npm install csurf
```

```typescript
import csrf from 'csurf';
const csrfProtection = csrf({ cookie: true });
this.app.use('/api', csrfProtection);
```

#### 8. CORS Configuration
**File:** `src/index.ts:46`

**Fix Required:**
```typescript
this.app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
}));
```

#### 9. Path Traversal in File Deletion
**File:** `src/routes/projectDocuments.ts:497-502`

**Fix Required:**
```typescript
const keyRegex = /^projects\/[a-f0-9-]+\/[a-f0-9-]+\.[a-z0-9]+$/;
if (!keyRegex.test(key)) {
  throw new Error('Invalid file key format');
}
```

---

### Medium Priority

#### 10. Session Fixation
**File:** `src/application/services/AuthService.ts:289-338`

**Fix Required:**
- Validate IP address change during token refresh
- Log suspicious changes
- Consider requiring re-authentication

#### 11. Missing Virus Scanning
**File:** `src/routes/projectDocuments.ts:110-293`

**Fix Required:**
```bash
npm install clamscan
```

#### 12. File Name Sanitization
**File:** `src/routes/projectDocuments.ts:136`

**Fix Required:**
```typescript
const sanitizeFilename = (filename: string): string => {
  return filename
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .replace(/\.{2,}/g, '.')
    .substring(0, 255);
};
```

---

## Testing Checklist

After all fixes:

- [ ] Run TypeScript compilation: `npm run build`
- [ ] Run linter: `npm run lint`
- [ ] Run all tests: `npm test`
- [ ] Test SQL injection prevention manually
- [ ] Test authentication timing (should be constant)
- [ ] Test account lockout persistence
- [ ] Test CORS with unauthorized origin
- [ ] Load test with concurrent credit transfers

---

## Environment Variables to Add

```env
# Frontend URL for CORS
FRONTEND_URL=http://localhost:3000

# For production, ensure these are NOT set:
# ALLOW_MOCK_SIGNATURES=false  # Never true in production!
```

---

## Next Steps

1. Complete SQL injection fixes in remaining repositories
2. Fix timing attack in authentication
3. Fix account lockout mechanism
4. Add CSRF protection
5. Configure CORS properly
6. Fix insecure random generation
7. Run comprehensive tests
8. Security review before production

---

## Estimated Time

- **Critical fixes:** 4-6 hours
- **High priority:** 3-4 hours
- **Medium priority:** 4-5 hours
- **Testing:** 2-3 hours
- **Total:** 13-18 hours (2-3 days)

---

##Notes

All fixes maintain backward compatibility with existing API contracts. No breaking changes to client code required.
