#!/usr/bin/env node

import { Pool } from 'pg';
import { config } from '../config';
import { logger } from '../utils/logger';
import { MigrationRunner } from './migrationRunner';

async function main() {
  const command = process.argv[2];

  // Create database connection
  const pool = new Pool({
    host: config.database.host,
    port: config.database.port,
    database: config.database.database,
    user: config.database.user,
    password: config.database.password,
    ssl:
      config.env === 'production' || config.database.host.includes('render.com')
        ? { rejectUnauthorized: false }
        : false,
  });

  const runner = new MigrationRunner(pool);

  try {
    switch (command) {
      case 'up':
        logger.info('Running pending migrations...');
        await runner.runPendingMigrations();
        break;

      case 'down':
        logger.info('Rolling back last migration...');
        await runner.rollbackLastMigration();
        break;

      case 'status':
        logger.info('Checking migration status...');
        const status = await runner.getStatus();
        console.log('\n=== Migration Status ===\n');
        console.log(`Applied migrations: ${status.applied.length}`);
        status.applied.forEach((m) => {
          console.log(`  ✓ ${m.name} (applied at ${m.appliedAt?.toISOString()})`);
        });
        console.log(`\nPending migrations: ${status.pending.length}`);
        status.pending.forEach((m) => {
          console.log(`  ○ ${m.name}`);
        });
        console.log('');
        break;

      default:
        console.log('Usage: npm run migrate [command]');
        console.log('');
        console.log('Commands:');
        console.log('  up      - Run all pending migrations');
        console.log('  down    - Rollback the last migration');
        console.log('  status  - Show migration status');
        process.exit(1);
    }
  } catch (error) {
    logger.error('Migration command failed', { error });
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
