// Standalone migration script (CommonJS to avoid tsx)
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Parse .env manually
const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    env[match[1].trim()] = match[2].trim();
  }
});

async function runMigration() {
  const client = new Client({
    host: env.DB_HOST,
    port: parseInt(env.DB_PORT || '5432'),
    database: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    ssl: env.DB_HOST?.includes('render.com')
      ? { rejectUnauthorized: false }
      : false,
  });

  try {
    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected!\n');

    console.log('📄 Reading migration file...');
    const migrationPath = path.join(__dirname, 'src', 'database', 'migrations', '003_add_email_verification_tokens.sql');
    const sql = fs.readFileSync(migrationPath, 'utf-8');
    console.log('✅ Migration file loaded\n');

    console.log('🔧 Applying migration...');
    await client.query(sql);
    console.log('✅ Migration SQL executed!\n');

    console.log('📝 Recording migration...');
    try {
      await client.query(
        'INSERT INTO schema_migrations (migration_name) VALUES ($1)',
        ['003_add_email_verification_tokens']
      );
      console.log('✅ Migration recorded\n');
    } catch (err) {
      if (err.code === '23505') {
        console.log('ℹ️  Migration already recorded\n');
      } else {
        throw err;
      }
    }

    console.log('🔍 Verifying table creation...');
    const result = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'email_verification_tokens'
      ORDER BY ordinal_position
    `);

    if (result.rows.length > 0) {
      console.log('✅ Table "email_verification_tokens" created successfully!\n');
      console.log('📋 Columns:');
      result.rows.forEach(row => {
        console.log(`   - ${row.column_name} (${row.data_type})`);
      });
      console.log('\n🎉 Migration complete! You can now test registration in Postman.\n');
    } else {
      console.log('❌ Table not found\n');
    }

  } catch (error) {
    console.error('\n❌ Migration failed!');
    console.error('Error:', error.message);
    if (error.code) {
      console.error('Error code:', error.code);
    }
    process.exit(1);
  } finally {
    await client.end();
    console.log('👋 Database connection closed');
  }
}

runMigration();
