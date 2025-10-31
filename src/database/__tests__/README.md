# Database Migration Tests

This directory contains comprehensive tests for the database schema and migration system.

## Test Files

### 1. `schema.test.ts` - Schema Validation Tests
Static analysis tests that validate the migration SQL files without requiring a database connection.

**What it tests:**
- Migration file structure and existence
- All required tables are created
- All required indexes are created
- Foreign key constraints are properly defined
- Check constraints for data validation
- Table partitioning (audit_logs)
- Triggers for updated_at columns
- PostgreSQL extensions (uuid-ossp, postgis)
- Rollback script completeness
- Data types and default values
- Unique constraints
- Table comments for documentation

**Run with:**
```bash
npm test -- src/database/__tests__/schema.test.ts
```

### 2. `migrationRunner.test.ts` - Integration Tests
Full integration tests that require a running PostgreSQL database.

**What it tests:**
- Migration runner initialization
- Running pending migrations
- Schema creation verification
- Index creation verification
- Foreign key constraint enforcement
- Cascade delete behavior
- Migration rollback functionality
- Migration status tracking

**Prerequisites:**
- PostgreSQL server running
- Database credentials configured in `.env`
- User has permission to create/drop databases

**Run with:**
```bash
npm test -- src/database/__tests__/migrationRunner.test.ts
```

## Running All Tests

To run all database tests:
```bash
npm test -- src/database/__tests__/
```

## Database Setup for Integration Tests

The integration tests automatically:
1. Create a temporary test database
2. Run migrations
3. Execute tests
4. Clean up and drop the test database

Ensure your PostgreSQL user has `CREATEDB` privilege:
```sql
ALTER USER postgres CREATEDB;
```

## Test Coverage

The tests verify all requirements from the spec:
- ✅ Create users table with indexes
- ✅ Create projects table with indexes
- ✅ Create verification_requests table with indexes
- ✅ Create verification_documents table
- ✅ Create verification_events table
- ✅ Create credit_entries table with indexes
- ✅ Create credit_transactions table with indexes
- ✅ Create cardano_wallets table with indexes
- ✅ Create blockchain_transactions table with indexes
- ✅ Create audit_logs table with partitioning by month
- ✅ Create sessions table
- ✅ Test schema creation
- ✅ Test index creation
- ✅ Test foreign key constraints
- ✅ Test rollback functionality

## Migration Files

### Forward Migration
`src/database/migrations/001_initial_schema.sql`

Creates the complete database schema including:
- 12 tables with proper relationships
- 29+ indexes for query optimization
- Foreign key constraints with appropriate cascade rules
- Check constraints for data validation
- Partitioned audit_logs table (by month)
- Triggers for automatic updated_at timestamps
- PostgreSQL extensions (uuid-ossp, postgis)

### Rollback Migration
`src/database/migrations/001_initial_schema_rollback.sql`

Safely removes all schema objects in reverse dependency order.

## Running Migrations Manually

### Apply migrations
```bash
npm run migrate:up
```

### Rollback last migration
```bash
npm run migrate:down
```

### Check migration status
```bash
npm run migrate:status
```

## Notes

- The schema follows PostgreSQL best practices
- All tables use UUID primary keys
- Timestamps use TIMESTAMP type (not TIMESTAMPTZ for consistency)
- Monetary/quantity values use DECIMAL(15,2)
- Metadata fields use JSONB for flexibility
- Geographic coordinates use PostGIS GEOGRAPHY type
- Audit logs are partitioned by month for performance
- Foreign keys use appropriate ON DELETE actions (CASCADE, RESTRICT, SET NULL)
