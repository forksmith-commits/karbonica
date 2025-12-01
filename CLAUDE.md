# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Karbonica is a Carbon Credit Registry Platform with Cardano blockchain integration. It manages carbon offset projects, verification workflows, credit issuance, and blockchain-based carbon offset tokens (COTs).

## Common Commands

### Development
```bash
npm run dev              # Start dev server with hot reload
npm start               # Start production server (requires build)
npm run build           # Compile TypeScript to dist/
```

### Testing
```bash
npm test                # Run all tests once
npm run test:watch      # Run tests in watch mode
npm run test:coverage   # Generate coverage report
```

Individual test files:
```bash
npm test -- src/routes/__tests__/credits.test.ts
npm test -- src/database/__tests__/schema.test.ts
```

### Code Quality
```bash
npm run lint            # ESLint check
npm run format          # Format with Prettier
```

### Database Migrations
```bash
npm run migrate:up      # Apply pending migrations
npm run migrate:down    # Rollback last migration
npm run migrate:status  # Check migration status
```

## Architecture Overview

### Clean Architecture Layers

The codebase follows Clean Architecture with clear separation:

**Domain Layer** (`src/domain/`)
- Core business entities and interfaces
- Domain services (CardanoWalletService, CardanoMintingService, CardanoTransactionService, COTMetadataService)
- Repository interfaces (I*Repository.ts)
- No dependencies on infrastructure or frameworks

**Application Layer** (`src/application/`)
- Application services (AuthService, CreditService, ProjectService, VerificationService)
- DTOs for request/response shapes
- Orchestrates domain services and repositories

**Infrastructure Layer** (`src/infrastructure/`)
- Concrete repository implementations (PostgreSQL)
- External service implementations (StorageService, EmailService, VaultService, PlatformWalletService)
- Framework-specific code

**Presentation Layer** (`src/routes/`)
- Express route handlers
- Input validation
- HTTP concerns

### Key Architectural Patterns

1. **Repository Pattern**: All data access goes through repository interfaces defined in `src/domain/repositories/`

2. **Service Pattern**: Business logic is in application services (`src/application/services/`), not routes

3. **Dependency Injection**: Services receive dependencies via constructors. See how services are instantiated in route files (e.g., `getCreditService()` in `src/routes/credits.ts`)

4. **Row-Level Security**: Database queries include user-specific filters based on role. See `src/utils/rowLevelSecurity.ts` and the usage guide at `src/utils/ROW_LEVEL_SECURITY_USAGE.md`

## Cardano Blockchain Integration

### Key Concepts

The platform integrates with Cardano Preview testnet via Blockfrost API:

- **COT (Carbon Offset Token)**: Native Cardano tokens minted for verified carbon credits
- **CIP-20 Metadata**: Transaction metadata standard for carbon credit operations
- **Platform Wallet**: System wallet that pays transaction fees and mints tokens

### Cardano Services

Located in `src/domain/services/`:

- **CardanoWalletService**: Wallet creation, linking, balance checking
- **CardanoMintingService**: COT minting on credit issuance
- **CardanoTransactionService**: Transaction building, submission, monitoring
- **COTMetadataService**: CIP-20 metadata generation

### Important Files

- `src/config/cardano.ts`: Cardano configuration and Blockfrost client
- `src/config/CARDANO_SETUP.md`: Setup and configuration guide
- `docs/CREDIT_TRANSFER_CARDANO_RECORDING.md`: Transfer metadata recording

### Cardano Environment Variables

```env
CARDANO_NETWORK=preview
BLOCKFROST_API_KEY=previewYourApiKeyHere
BLOCKFROST_URL=https://cardano-preview.blockfrost.io/api/v0
```

## Authentication & Authorization

### Role-Based Access Control (RBAC)

Four user roles:
- **DEVELOPER**: Creates/manages projects
- **VERIFIER**: Reviews verification requests
- **ADMINISTRATOR**: Full system access
- **BUYER**: Purchases/retires credits

### Middleware

Located in `src/middleware/`:

- `authenticate`: JWT token validation
- `authorize(resource, action)`: Permission-based authorization
- `requireRole(...roles)`: Role-based authorization
- Convenience helpers: `requireAdmin`, `requireDeveloper`, `requireVerifier`, `requireBuyer`, `requireVerifierOrAdmin`

See `src/middleware/AUTHORIZATION_USAGE.md` for detailed usage.

### Row-Level Security

All repository methods must apply row-level security filters:

```typescript
import { buildProjectAccessFilter } from '../utils/rowLevelSecurity';

const filter = buildProjectAccessFilter({ userId, role });
const query = `SELECT * FROM projects WHERE ${filter.clause}`;
const result = await pool.query(query, filter.params);
```

Available filters:
- `buildProjectAccessFilter`: Projects by role
- `buildVerificationAccessFilter`: Verifications by assignment
- `buildCreditOwnershipFilter`: Credits by ownership

See `src/utils/ROW_LEVEL_SECURITY_USAGE.md` for complete guide.

## Database

### Schema

- PostgreSQL with TypeORM
- 12 core tables (users, projects, verification_requests, credit_entries, cardano_wallets, etc.)
- Partitioned audit_logs table (monthly partitions)
- UUID primary keys
- DECIMAL(15,2) for monetary/quantity values
- JSONB for metadata fields

### Migration System

Custom migration runner in `src/database/migrationRunner.ts`:

- Forward migrations: `src/database/migrations/*_schema.sql`
- Rollback migrations: `src/database/migrations/*_rollback.sql`
- Migration tracking in `schema_migrations` table

See `src/database/__tests__/README.md` for testing approach.

## Key Workflows

### Credit Lifecycle

1. **Project Creation**: Developer creates project → DRAFT status
2. **Verification Request**: Developer submits for verification → PENDING
3. **Verification Assignment**: Admin assigns to verifier
4. **Verification Review**: Verifier approves/rejects
5. **Credit Issuance**: On approval, credits issued + COT minted on Cardano
6. **Credit Transfer**: Owner transfers to another user + optional metadata recording
7. **Credit Retirement**: Owner retires credits + blockchain recording

### Verification Workflow

Verifiers can only view and approve **assigned** verifications (enforced by `buildVerificationAccessFilter`).

Verification events are logged in `verification_events` table with automatic status updates.

## Testing Strategy

### Test Structure

- Route tests: `src/routes/__tests__/*.test.ts`
- Service tests: `src/application/services/__tests__/*.test.ts`
- Database tests: `src/database/__tests__/*.test.ts`
- Test setup: `src/test/setup.ts`

### Test Database

Integration tests use a temporary database created/destroyed per test run. Ensure PostgreSQL user has `CREATEDB` privilege.

### Running Specific Tests

```bash
npm test -- src/routes/__tests__/credits.test.ts
npm test -- src/application/services/__tests__/CreditService.test.ts
```

## Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure:

**Required:**
- Database: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- Redis: `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`
- JWT: `JWT_SECRET`, `JWT_ACCESS_EXPIRY`, `JWT_REFRESH_EXPIRY`
- Cardano: `CARDANO_NETWORK`, `BLOCKFROST_API_KEY`, `BLOCKFROST_URL`

**Optional:**
- Storage: `STORAGE_PROVIDER` (supabase), Supabase config
- Email: `EMAIL_SERVICE` (console/mailersend), email provider config
- Vault: `VAULT_PROVIDER` (local-dev/aws-kms/azure-keyvault/hashicorp-vault)

### Platform Wallet

The platform wallet is initialized on startup and used for:
- Paying transaction fees
- Minting COT tokens
- Sending metadata transactions

Configuration in `.env`:
```env
PLATFORM_WALLET_NAME=karbonica-platform-wallet
PLATFORM_WALLET_MIN_BALANCE=100000000
PLATFORM_WALLET_ALERT_THRESHOLD=500000000
```

## Important Conventions

### Error Handling

Custom error classes in `src/utils/errors.ts`:
- `ValidationError`: 400 Bad Request
- `AuthenticationError`: 401 Unauthorized
- `AuthorizationError`: 403 Forbidden
- `NotFoundError`: 404 Not Found
- `ConflictError`: 409 Conflict

Global error handler in `src/middleware/errorHandler.ts` converts to JSON:API format.

### API Response Format

All responses follow JSON:API structure:

```json
{
  "status": "success|error",
  "data": { ... },
  "meta": {
    "timestamp": "ISO-8601",
    "requestId": "string"
  }
}
```

### Service Instantiation Pattern

Routes instantiate services with dependencies:

```typescript
function getCreditService(): CreditService {
  const userRepo = new UserRepository(pool);
  const creditRepo = new CreditEntryRepository(pool);
  // ... other dependencies
  return new CreditService(userRepo, creditRepo, ...);
}
```

This pattern is used in all route files.

### TypeScript Strict Mode

Project uses strict TypeScript settings:
- `strict: true`
- `noUnusedLocals: true`
- `noUnusedParameters: true`
- `noImplicitReturns: true`

Always run `npm run build` to check for type errors before committing.

## Logging

Winston logger configured in `src/utils/logger.ts`:

```typescript
import { logger } from '../utils/logger';

logger.info('Operation successful', { userId, action });
logger.error('Operation failed', { error, context });
```

Log levels: error, warn, info, http, debug

## Swagger/OpenAPI Documentation

API documentation available at `/api-docs` when server is running.

Swagger JSDoc annotations are in route files. Example:

```typescript
/**
 * @swagger
 * /api/v1/credits:
 *   get:
 *     summary: List user's credits
 *     tags: [Credits]
 */
```

## Security Considerations

1. **Never commit secrets**: Use `.env` for all sensitive config
2. **Row-level security**: Always apply in repository methods
3. **Input validation**: Validate all user input with Zod schemas
4. **SQL injection prevention**: Always use parameterized queries
5. **Authentication required**: Most endpoints require JWT token
6. **Audit logging**: Critical operations logged to audit_logs table

## Common Patterns

### Creating New Endpoints

1. Define route in `src/routes/*.ts`
2. Add authentication: `authenticate` middleware
3. Add authorization: `authorize(resource, action)` or `requireRole(...)`
4. Implement business logic in application service
5. Use repository for data access with row-level security
6. Add tests in `src/routes/__tests__/*.test.ts`
7. Add Swagger documentation

### Adding New Entities

1. Create entity in `src/domain/entities/*.ts`
2. Create repository interface in `src/domain/repositories/I*Repository.ts`
3. Create repository implementation in `src/infrastructure/repositories/*Repository.ts`
4. Add database migration in `src/database/migrations/`
5. Create DTOs in `src/application/dto/*.dto.ts`
6. Update services as needed

## Troubleshooting

### Build Errors

```bash
npm run build  # Check TypeScript compilation errors
npm run lint   # Check ESLint errors
```

### Database Connection Issues

Check `.env` database credentials and ensure PostgreSQL is running:
```bash
psql -h $DB_HOST -U $DB_USER -d $DB_NAME
```

### Cardano Integration Issues

- Verify Blockfrost API key is valid and matches network
- Check `BLOCKFROST_URL` corresponds to `CARDANO_NETWORK`
- Ensure platform wallet has sufficient ADA balance
- See `src/config/CARDANO_SETUP.md` for detailed troubleshooting

### Migration Issues

```bash
npm run migrate:status  # Check current state
npm run migrate:down    # Rollback if needed
npm run migrate:up      # Reapply
```
