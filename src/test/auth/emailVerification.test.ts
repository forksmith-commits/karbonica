import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { Pool } from 'pg';
import { config } from '../../config';

const API_BASE = `/api/${config.apiVersion}`;

// Test database connection
let pool: Pool;

beforeAll(async () => {
  pool = new Pool({
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

  // Ensure email_verification_tokens table exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS email_verification_tokens (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token VARCHAR(255) UNIQUE NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      used_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user_id ON email_verification_tokens(user_id);
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_token ON email_verification_tokens(token);
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_expires_at ON email_verification_tokens(expires_at);
  `);
});

afterAll(async () => {
  await pool.end();
});

beforeEach(async () => {
  // Clean up test data
  await pool.query(`DELETE FROM email_verification_tokens WHERE token LIKE 'test_%'`);
  await pool.query(`DELETE FROM users WHERE email LIKE 'test-verify%@example.com'`);
});

describe('Email Verification', () => {
  it('should create verification token on registration', async () => {
    const userData = {
      email: 'test-verify1@example.com',
      password: 'SecurePass123!',
      name: 'Test User',
      company: 'Test Company',
      role: 'developer',
    };

    const response = await request(`http://localhost:${config.port}`)
      .post(`${API_BASE}/auth/register`)
      .send(userData)
      .expect(201);

    expect(response.body.status).toBe('success');
    expect(response.body.data.user.emailVerified).toBe(false);

    // Check that verification token was created in database
    const userId = response.body.data.user.id;
    const tokenResult = await pool.query(
      'SELECT * FROM email_verification_tokens WHERE user_id = $1',
      [userId]
    );

    expect(tokenResult.rows.length).toBe(1);
    expect(tokenResult.rows[0].token).toBeTruthy();
    expect(tokenResult.rows[0].used_at).toBeNull();
  });

  it('should verify email with valid token', async () => {
    // First register a user
    const userData = {
      email: 'test-verify2@example.com',
      password: 'SecurePass123!',
      name: 'Test User 2',
      company: 'Test Company',
      role: 'developer',
    };

    const registerResponse = await request(`http://localhost:${config.port}`)
      .post(`${API_BASE}/auth/register`)
      .send(userData)
      .expect(201);

    const userId = registerResponse.body.data.user.id;

    // Get the verification token from database
    const tokenResult = await pool.query(
      'SELECT token FROM email_verification_tokens WHERE user_id = $1',
      [userId]
    );

    const token = tokenResult.rows[0].token;

    // Verify email
    const verifyResponse = await request(`http://localhost:${config.port}`)
      .get(`${API_BASE}/auth/verify-email?token=${token}`)
      .expect(200);

    expect(verifyResponse.body.status).toBe('success');
    expect(verifyResponse.body.data.message).toContain('verified successfully');

    // Check that user is now verified
    const userResult = await pool.query('SELECT email_verified FROM users WHERE id = $1', [userId]);

    expect(userResult.rows[0].email_verified).toBe(true);

    // Check that token is marked as used
    const usedTokenResult = await pool.query(
      'SELECT used_at FROM email_verification_tokens WHERE user_id = $1',
      [userId]
    );

    expect(usedTokenResult.rows[0].used_at).not.toBeNull();
  });

  it('should reject invalid verification token', async () => {
    const response = await request(`http://localhost:${config.port}`)
      .get(`${API_BASE}/auth/verify-email?token=invalid_token_12345`)
      .expect(400);

    expect(response.body.status).toBe('error');
    expect(response.body.code).toBe('INVALID_TOKEN');
  });

  it('should reject already used verification token', async () => {
    // Register and verify a user
    const userData = {
      email: 'test-verify3@example.com',
      password: 'SecurePass123!',
      name: 'Test User 3',
      company: 'Test Company',
      role: 'developer',
    };

    const registerResponse = await request(`http://localhost:${config.port}`)
      .post(`${API_BASE}/auth/register`)
      .send(userData)
      .expect(201);

    const userId = registerResponse.body.data.user.id;

    const tokenResult = await pool.query(
      'SELECT token FROM email_verification_tokens WHERE user_id = $1',
      [userId]
    );

    const token = tokenResult.rows[0].token;

    // Verify email first time
    await request(`http://localhost:${config.port}`)
      .get(`${API_BASE}/auth/verify-email?token=${token}`)
      .expect(200);

    // Try to verify again with same token
    const secondResponse = await request(`http://localhost:${config.port}`)
      .get(`${API_BASE}/auth/verify-email?token=${token}`)
      .expect(400);

    expect(secondResponse.body.status).toBe('error');
    expect(secondResponse.body.code).toBe('ALREADY_VERIFIED');
  });

  it('should reject expired verification token', async () => {
    // Register a user
    const userData = {
      email: 'test-verify4@example.com',
      password: 'SecurePass123!',
      name: 'Test User 4',
      company: 'Test Company',
      role: 'developer',
    };

    const registerResponse = await request(`http://localhost:${config.port}`)
      .post(`${API_BASE}/auth/register`)
      .send(userData)
      .expect(201);

    const userId = registerResponse.body.data.user.id;

    // Manually expire the token
    await pool.query(
      `UPDATE email_verification_tokens 
       SET expires_at = NOW() - INTERVAL '1 hour' 
       WHERE user_id = $1`,
      [userId]
    );

    const tokenResult = await pool.query(
      'SELECT token FROM email_verification_tokens WHERE user_id = $1',
      [userId]
    );

    const token = tokenResult.rows[0].token;

    // Try to verify with expired token
    const response = await request(`http://localhost:${config.port}`)
      .get(`${API_BASE}/auth/verify-email?token=${token}`)
      .expect(400);

    expect(response.body.status).toBe('error');
    expect(response.body.code).toBe('TOKEN_EXPIRED');
  });

  it('should reject verification without token parameter', async () => {
    const response = await request(`http://localhost:${config.port}`)
      .get(`${API_BASE}/auth/verify-email`)
      .expect(400);

    expect(response.body.status).toBe('error');
    expect(response.body.code).toBe('MISSING_TOKEN');
  });
});
