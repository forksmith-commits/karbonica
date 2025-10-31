// Simple script to apply email verification migration
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function applyMigration() {
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_HOST?.includes('render.com')
      ? { rejectUnauthorized: false }
      : false,
  });

  try {
    console.log('🔧 Applying email verification migration...\n');

    // Read the migration SQL
    const migrationPath = path.join(__dirname, 'src/database/migrations/003_add_email_verification_tokens.sql');
    const sql = fs.readFileSync(migrationPath, 'utf-8');

    // Apply migration
    await pool.query(sql);
    console.log('✅ Migration SQL executed successfully!\n');

    // Record migration in schema_migrations table
    try {
      await pool.query(
        'INSERT INTO schema_migrations (migration_name) VALUES ($1)',
        ['003_add_email_verification_tokens']
      );
      console.log('✅ Migration recorded in schema_migrations\n');
    } catch (err) {
      if (err.code === '23505') {
        console.log('ℹ️  Migration already recorded (duplicate entry)\n');
      } else {
        throw err;
      }
    }

    // Verify table was created
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'email_verification_tokens'
    `);

    if (result.rows.length > 0) {
      console.log('✅ Table "email_verification_tokens" created successfully!\n');
      console.log('📋 Table structure:');
      console.log('   - id (UUID)');
      console.log('   - user_id (UUID, foreign key to users)');
      console.log('   - token (VARCHAR, unique)');
      console.log('   - expires_at (TIMESTAMP)');
      console.log('   - used_at (TIMESTAMP, nullable)');
      console.log('   - created_at (TIMESTAMP)\n');
      console.log('🎉 Migration complete! You can now test registration.\n');
    } else {
      console.log('❌ Table was not created. Check the SQL file.\n');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('\nError details:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

applyMigration();
