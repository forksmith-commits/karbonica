import { Pool } from 'pg';
import { readFileSync } from 'fs';
import dotenv from 'dotenv';

dotenv.config();

async function runMigration() {
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_HOST?.includes('render.com') ? { rejectUnauthorized: false } : false,
  });

  try {
    console.log('Running migration: 003_add_email_verification_tokens');

    const sql = readFileSync(
      'src/database/migrations/003_add_email_verification_tokens.sql',
      'utf-8'
    );

    await pool.query(sql);

    // Record migration
    await pool.query('INSERT INTO schema_migrations (migration_name) VALUES ($1)', [
      '003_add_email_verification_tokens',
    ]);

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
