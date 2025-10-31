import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Database Schema Migration', () => {
  const migrationPath = join(__dirname, '../migrations/001_initial_schema.sql');
  const rollbackPath = join(__dirname, '../migrations/001_initial_schema_rollback.sql');

  let migrationSql: string;
  let rollbackSql: string;

  describe('Migration File Structure', () => {
    it('should have migration file', () => {
      expect(() => {
        migrationSql = readFileSync(migrationPath, 'utf-8');
      }).not.toThrow();
    });

    it('should have rollback file', () => {
      expect(() => {
        rollbackSql = readFileSync(rollbackPath, 'utf-8');
      }).not.toThrow();
    });

    it('migration file should not be empty', () => {
      migrationSql = readFileSync(migrationPath, 'utf-8');
      expect(migrationSql.length).toBeGreaterThan(0);
    });

    it('rollback file should not be empty', () => {
      rollbackSql = readFileSync(rollbackPath, 'utf-8');
      expect(rollbackSql.length).toBeGreaterThan(0);
    });
  });

  describe('Required Tables', () => {
    beforeAll(() => {
      migrationSql = readFileSync(migrationPath, 'utf-8');
    });

    const requiredTables = [
      'users',
      'sessions',
      'cardano_wallets',
      'projects',
      'project_documents',
      'verification_requests',
      'verification_documents',
      'verification_events',
      'credit_entries',
      'credit_transactions',
      'blockchain_transactions',
      'audit_logs',
    ];

    requiredTables.forEach((tableName) => {
      it(`should create ${tableName} table`, () => {
        const tableRegex = new RegExp(`CREATE TABLE ${tableName}`, 'i');
        expect(migrationSql).toMatch(tableRegex);
      });
    });
  });

  describe('Required Indexes', () => {
    beforeAll(() => {
      migrationSql = readFileSync(migrationPath, 'utf-8');
    });

    const requiredIndexes = [
      // Users indexes
      'idx_users_email',
      'idx_users_role',

      // Sessions indexes
      'idx_sessions_user_id',
      'idx_sessions_expires_at',

      // Cardano wallets indexes
      'idx_cardano_wallets_user_id',
      'idx_cardano_wallets_address',

      // Projects indexes
      'idx_projects_developer_id',
      'idx_projects_status',
      'idx_projects_type',

      // Verification requests indexes
      'idx_verification_requests_project_id',
      'idx_verification_requests_developer_id',
      'idx_verification_requests_verifier_id',
      'idx_verification_requests_status',

      // Verification documents indexes
      'idx_verification_documents_verification_id',

      // Verification events indexes
      'idx_verification_events_verification_id',

      // Credit entries indexes
      'idx_credit_entries_credit_id',
      'idx_credit_entries_project_id',
      'idx_credit_entries_owner_id',
      'idx_credit_entries_status',

      // Credit transactions indexes
      'idx_credit_transactions_credit_id',
      'idx_credit_transactions_sender_id',
      'idx_credit_transactions_recipient_id',
      'idx_credit_transactions_transaction_type',

      // Blockchain transactions indexes
      'idx_blockchain_transactions_credit_transaction_id',
      'idx_blockchain_transactions_tx_hash',
      'idx_blockchain_transactions_tx_status',

      // Audit logs indexes
      'idx_audit_logs_timestamp',
      'idx_audit_logs_event_type',
      'idx_audit_logs_user_id',
    ];

    requiredIndexes.forEach((indexName) => {
      it(`should create ${indexName} index`, () => {
        const indexRegex = new RegExp(`CREATE INDEX ${indexName}`, 'i');
        expect(migrationSql).toMatch(indexRegex);
      });
    });
  });

  describe('Foreign Key Constraints', () => {
    beforeAll(() => {
      migrationSql = readFileSync(migrationPath, 'utf-8');
    });

    const foreignKeys = [
      { table: 'sessions', column: 'user_id', references: 'users' },
      { table: 'cardano_wallets', column: 'user_id', references: 'users' },
      { table: 'projects', column: 'developer_id', references: 'users' },
      { table: 'project_documents', column: 'project_id', references: 'projects' },
      { table: 'verification_requests', column: 'project_id', references: 'projects' },
      { table: 'verification_requests', column: 'developer_id', references: 'users' },
      {
        table: 'verification_documents',
        column: 'verification_id',
        references: 'verification_requests',
      },
      {
        table: 'verification_events',
        column: 'verification_id',
        references: 'verification_requests',
      },
      { table: 'credit_entries', column: 'project_id', references: 'projects' },
      { table: 'credit_entries', column: 'owner_id', references: 'users' },
      { table: 'credit_transactions', column: 'credit_id', references: 'credit_entries' },
      {
        table: 'blockchain_transactions',
        column: 'credit_transaction_id',
        references: 'credit_transactions',
      },
    ];

    foreignKeys.forEach(({ table, column, references }) => {
      it(`should have foreign key constraint on ${table}.${column} referencing ${references}`, () => {
        // Look for REFERENCES keyword in the table definition
        const tableSection = migrationSql.match(
          new RegExp(`CREATE TABLE ${table}[\\s\\S]*?;`, 'i')
        );
        expect(tableSection).toBeTruthy();

        if (tableSection) {
          const fkRegex = new RegExp(`${column}[\\s\\S]*?REFERENCES ${references}`, 'i');
          expect(tableSection[0]).toMatch(fkRegex);
        }
      });
    });
  });

  describe('Check Constraints', () => {
    beforeAll(() => {
      migrationSql = readFileSync(migrationPath, 'utf-8');
    });

    it('should have role check constraint on users table', () => {
      expect(migrationSql).toMatch(
        /role.*CHECK.*\(role IN \('developer', 'verifier', 'administrator', 'buyer'\)\)/i
      );
    });

    it('should have type check constraint on projects table', () => {
      expect(migrationSql).toMatch(/type.*CHECK.*\(type IN/i);
    });

    it('should have emissions_target check constraint on projects table', () => {
      expect(migrationSql).toMatch(
        /emissions_target.*CHECK.*\(emissions_target > 0 AND emissions_target < 10000000\)/i
      );
    });

    it('should have status check constraint on projects table', () => {
      expect(migrationSql).toMatch(
        /status.*CHECK.*\(status IN \('pending', 'verified', 'rejected'\)\)/i
      );
    });

    it('should have status check constraint on verification_requests table', () => {
      expect(migrationSql).toMatch(
        /status.*CHECK.*\(status IN \('pending', 'in_review', 'approved', 'rejected'\)\)/i
      );
    });

    it('should have progress check constraint on verification_requests table', () => {
      expect(migrationSql).toMatch(/progress.*CHECK.*\(progress >= 0 AND progress <= 100\)/i);
    });

    it('should have quantity check constraint on credit_entries table', () => {
      expect(migrationSql).toMatch(/quantity.*CHECK.*\(quantity > 0\)/i);
    });

    it('should have vintage check constraint on credit_entries table', () => {
      expect(migrationSql).toMatch(/vintage.*CHECK.*\(vintage >= 2000 AND vintage <= 2100\)/i);
    });

    it('should have status check constraint on credit_entries table', () => {
      expect(migrationSql).toMatch(
        /status.*CHECK.*\(status IN \('active', 'transferred', 'retired'\)\)/i
      );
    });

    it('should have transaction_type check constraint on credit_transactions table', () => {
      expect(migrationSql).toMatch(
        /transaction_type.*CHECK.*\(transaction_type IN \('issuance', 'transfer', 'retirement'\)\)/i
      );
    });
  });

  describe('Partitioning', () => {
    beforeAll(() => {
      migrationSql = readFileSync(migrationPath, 'utf-8');
    });

    it('should partition audit_logs table by timestamp', () => {
      expect(migrationSql).toMatch(
        /CREATE TABLE audit_logs[\s\S]*?PARTITION BY RANGE \(timestamp\)/i
      );
    });

    it('should create audit_logs partitions for 2024', () => {
      const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];

      months.forEach((month) => {
        const partitionRegex = new RegExp(
          `CREATE TABLE audit_logs_2024_${month} PARTITION OF audit_logs`,
          'i'
        );
        expect(migrationSql).toMatch(partitionRegex);
      });
    });
  });

  describe('Triggers', () => {
    beforeAll(() => {
      migrationSql = readFileSync(migrationPath, 'utf-8');
    });

    it('should create update_updated_at_column function', () => {
      expect(migrationSql).toMatch(/CREATE OR REPLACE FUNCTION update_updated_at_column\(\)/i);
    });

    const triggeredTables = ['users', 'projects', 'verification_requests', 'credit_entries'];

    triggeredTables.forEach((tableName) => {
      it(`should create updated_at trigger for ${tableName} table`, () => {
        const triggerRegex = new RegExp(
          `CREATE TRIGGER update_${tableName}_updated_at BEFORE UPDATE ON ${tableName}`,
          'i'
        );
        expect(migrationSql).toMatch(triggerRegex);
      });
    });
  });

  describe('Extensions', () => {
    beforeAll(() => {
      migrationSql = readFileSync(migrationPath, 'utf-8');
    });

    it('should enable uuid-ossp extension', () => {
      expect(migrationSql).toMatch(/CREATE EXTENSION IF NOT EXISTS "uuid-ossp"/i);
    });

    it('should enable postgis extension', () => {
      expect(migrationSql).toMatch(/CREATE EXTENSION IF NOT EXISTS "postgis"/i);
    });
  });

  describe('Rollback Script', () => {
    beforeAll(() => {
      rollbackSql = readFileSync(rollbackPath, 'utf-8');
    });

    const tablesToDrop = [
      'audit_logs',
      'blockchain_transactions',
      'credit_transactions',
      'credit_entries',
      'verification_events',
      'verification_documents',
      'verification_requests',
      'project_documents',
      'projects',
      'cardano_wallets',
      'sessions',
      'users',
    ];

    tablesToDrop.forEach((tableName) => {
      it(`should drop ${tableName} table`, () => {
        const dropRegex = new RegExp(`DROP TABLE IF EXISTS ${tableName}`, 'i');
        expect(rollbackSql).toMatch(dropRegex);
      });
    });

    it('should drop triggers', () => {
      expect(rollbackSql).toMatch(/DROP TRIGGER IF EXISTS/i);
    });

    it('should drop update_updated_at_column function', () => {
      expect(rollbackSql).toMatch(/DROP FUNCTION IF EXISTS update_updated_at_column/i);
    });
  });

  describe('Data Types', () => {
    beforeAll(() => {
      migrationSql = readFileSync(migrationPath, 'utf-8');
    });

    it('should use UUID for primary keys', () => {
      expect(migrationSql).toMatch(/id UUID PRIMARY KEY/i);
    });

    it('should use DECIMAL for monetary/quantity values', () => {
      expect(migrationSql).toMatch(/DECIMAL\(15,2\)/i);
    });

    it('should use TIMESTAMP for date/time fields', () => {
      expect(migrationSql).toMatch(/TIMESTAMP/i);
    });

    it('should use JSONB for metadata fields', () => {
      expect(migrationSql).toMatch(/JSONB/i);
    });

    it('should use GEOGRAPHY for coordinates', () => {
      expect(migrationSql).toMatch(/GEOGRAPHY\(POINT\)/i);
    });
  });

  describe('Default Values', () => {
    beforeAll(() => {
      migrationSql = readFileSync(migrationPath, 'utf-8');
    });

    it('should set default UUID generation for id columns', () => {
      expect(migrationSql).toMatch(/id UUID PRIMARY KEY DEFAULT uuid_generate_v4\(\)/i);
    });

    it('should set default CURRENT_TIMESTAMP for created_at columns', () => {
      expect(migrationSql).toMatch(/created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP/i);
    });

    it('should set default values for boolean fields', () => {
      expect(migrationSql).toMatch(/email_verified BOOLEAN DEFAULT FALSE/i);
      expect(migrationSql).toMatch(/account_locked BOOLEAN DEFAULT FALSE/i);
    });

    it('should set default status values', () => {
      expect(migrationSql).toMatch(/status VARCHAR\(50\) NOT NULL DEFAULT 'pending'/i);
    });
  });

  describe('Unique Constraints', () => {
    beforeAll(() => {
      migrationSql = readFileSync(migrationPath, 'utf-8');
    });

    const uniqueColumns = [
      { table: 'users', column: 'email' },
      { table: 'cardano_wallets', column: 'user_id' },
      { table: 'cardano_wallets', column: 'address' },
      { table: 'verification_requests', column: 'project_id' },
      { table: 'credit_entries', column: 'credit_id' },
      { table: 'blockchain_transactions', column: 'tx_hash' },
    ];

    uniqueColumns.forEach(({ table, column }) => {
      it(`should have unique constraint on ${table}.${column}`, () => {
        const tableSection = migrationSql.match(
          new RegExp(`CREATE TABLE ${table}[\\s\\S]*?;`, 'i')
        );
        expect(tableSection).toBeTruthy();

        if (tableSection) {
          const uniqueRegex = new RegExp(`${column}.*UNIQUE`, 'i');
          expect(tableSection[0]).toMatch(uniqueRegex);
        }
      });
    });
  });

  describe('Comments', () => {
    beforeAll(() => {
      migrationSql = readFileSync(migrationPath, 'utf-8');
    });

    it('should have table comments for documentation', () => {
      expect(migrationSql).toMatch(/COMMENT ON TABLE users IS/i);
      expect(migrationSql).toMatch(/COMMENT ON TABLE projects IS/i);
      expect(migrationSql).toMatch(/COMMENT ON TABLE credit_entries IS/i);
    });
  });
});
