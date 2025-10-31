import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import express, { Application } from 'express';
import { authRouter } from '../auth';
import { database } from '../../config/database';
import { Pool } from 'pg';

// Setup test app
const createTestApp = (): Application => {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/auth', authRouter);
  return app;
};

describe('POST /api/v1/auth/register - Integration Tests', () => {
  let app: Application;
  let pool: Pool;

  beforeAll(async () => {
    app = createTestApp();
    pool = await database.connect();
  });

  afterAll(async () => {
    await database.disconnect();
  });

  beforeEach(async () => {
    // Clean up users table before each test
    await pool.query('DELETE FROM users');
  });

  describe('Successful Registration', () => {
    it('should register a new user with valid data', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'test@example.com',
          password: 'Password123',
          name: 'Test User',
          company: 'Test Company',
          role: 'developer',
        })
        .expect(201);

      expect(response.body.status).toBe('success');
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.email).toBe('test@example.com');
      expect(response.body.data.user.name).toBe('Test User');
      expect(response.body.data.user.company).toBe('Test Company');
      expect(response.body.data.user.role).toBe('developer');
      expect(response.body.data.user.emailVerified).toBe(false);
      expect(response.body.data.user.id).toBeDefined();
      expect(response.body.data.user.createdAt).toBeDefined();
      expect(response.body.data.message).toContain('Registration successful');
      expect(response.body.meta.timestamp).toBeDefined();
    });

    it('should register user without optional company field', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'test@example.com',
          password: 'Password123',
          name: 'Test User',
          role: 'buyer',
        })
        .expect(201);

      expect(response.body.data.user.company).toBeNull();
    });

    it('should not return password in response', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'test@example.com',
          password: 'Password123',
          name: 'Test User',
          role: 'developer',
        })
        .expect(201);

      expect(response.body.data.user.password).toBeUndefined();
      expect(response.body.data.user.passwordHash).toBeUndefined();
    });
  });

  describe('Email Validation', () => {
    it('should reject invalid email format', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'invalid-email',
          password: 'Password123',
          name: 'Test User',
          role: 'developer',
        })
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.code).toBe('VALIDATION_ERROR');
      expect(response.body.errors).toBeDefined();
    });

    it('should reject missing email', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          password: 'Password123',
          name: 'Test User',
          role: 'developer',
        })
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Password Validation', () => {
    it('should reject weak password (no uppercase)', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'test@example.com',
          password: 'password123',
          name: 'Test User',
          role: 'developer',
        })
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('should reject weak password (no lowercase)', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'test@example.com',
          password: 'PASSWORD123',
          name: 'Test User',
          role: 'developer',
        })
        .expect(400);

      expect(response.body.status).toBe('error');
    });

    it('should reject weak password (no number)', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'test@example.com',
          password: 'PasswordOnly',
          name: 'Test User',
          role: 'developer',
        })
        .expect(400);

      expect(response.body.status).toBe('error');
    });

    it('should reject short password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'test@example.com',
          password: 'Pass1',
          name: 'Test User',
          role: 'developer',
        })
        .expect(400);

      expect(response.body.status).toBe('error');
    });
  });

  describe('Duplicate Email Rejection', () => {
    it('should reject registration with existing email', async () => {
      // Register first user
      await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'test@example.com',
          password: 'Password123',
          name: 'First User',
          role: 'developer',
        })
        .expect(201);

      // Attempt to register with same email
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'test@example.com',
          password: 'DifferentPass123',
          name: 'Second User',
          role: 'buyer',
        })
        .expect(409);

      expect(response.body.status).toBe('error');
      expect(response.body.code).toBe('EMAIL_ALREADY_EXISTS');
      expect(response.body.title).toBe('Email Already Registered');
    });
  });

  describe('Required Fields Validation', () => {
    it('should reject missing name', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'test@example.com',
          password: 'Password123',
          role: 'developer',
        })
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('should reject missing role', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'test@example.com',
          password: 'Password123',
          name: 'Test User',
        })
        .expect(400);

      expect(response.body.status).toBe('error');
    });

    it('should reject invalid role', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'test@example.com',
          password: 'Password123',
          name: 'Test User',
          role: 'invalid_role',
        })
        .expect(400);

      expect(response.body.status).toBe('error');
    });
  });

  describe('Response Format', () => {
    it('should return proper response structure', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'test@example.com',
          password: 'Password123',
          name: 'Test User',
          role: 'developer',
        })
        .expect(201);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('meta');
      expect(response.body.meta).toHaveProperty('timestamp');
      expect(response.body.meta).toHaveProperty('requestId');
    });
  });
});
