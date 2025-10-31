# Postman Testing Guide - Session Management

This guide will walk you through testing all the authentication and session management endpoints.

## Prerequisites

1. Start your server: `npm run dev`
2. Ensure your database is running and migrations are applied
3. Open Postman

## Base URL

```
http://localhost:3000/api/v1
```

---

## Test Flow

### 1. Register a New User

**Endpoint:** `POST /api/v1/auth/register`

**Headers:**
```
Content-Type: application/json
```

**Body (raw JSON):**
```json
{
  "email": "testuser@example.com",
  "password": "TestPass123",
  "name": "Test User",
  "company": "Test Company",
  "role": "developer"
}
```

**Expected Response (201):**
```json
{
  "status": "success",
  "data": {
    "user": {
      "id": "uuid-here",
      "email": "testuser@example.com",
      "name": "Test User",
      "company": "Test Company",
      "role": "developer",
      "emailVerified": false,
      "createdAt": "2024-01-15T10:00:00.000Z"
    },
    "message": "Registration successful. Please check your email to verify your account."
  },
  "meta": {
    "timestamp": "2024-01-15T10:00:00.000Z",
    "requestId": "unknown"
  }
}
```

**Note:** The password should NOT appear in the response.

---

### 2. Login (Create Session)

**Endpoint:** `POST /api/v1/auth/login`

**Headers:**
```
Content-Type: application/json
```

**Body (raw JSON):**
```json
{
  "email": "testuser@example.com",
  "password": "TestPass123"
}
```

**Expected Response (200):**
```json
{
  "status": "success",
  "data": {
    "user": {
      "id": "uuid-here",
      "email": "testuser@example.com",
      "name": "Test User",
      "company": "Test Company",
      "role": "developer",
      "emailVerified": false,
      "lastLoginAt": "2024-01-15T10:05:00.000Z"
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "accessTokenExpiry": "2024-01-15T11:05:00.000Z",
      "refreshTokenExpiry": "2024-01-22T10:05:00.000Z"
    }
  },
  "meta": {
    "timestamp": "2024-01-15T10:05:00.000Z",
    "requestId": "unknown"
  }
}
```

**Important:** Copy the `accessToken` and `refreshToken` - you'll need them for subsequent requests!

---

### 3. Test Authenticated Endpoint (Session Validation)

To test that your session is working, you need an authenticated endpoint. Let's check if there's a health check or user profile endpoint.

**Endpoint:** Any protected endpoint (e.g., `GET /api/v1/user/profile` if it exists)

**Headers:**
```
Authorization: Bearer YOUR_ACCESS_TOKEN_HERE
Content-Type: application/json
```

**Expected Response:** Should return data without authentication errors.

**Test Invalid Token:**
- Try with no Authorization header → Should get 401
- Try with invalid token → Should get 401
- Try with "Bearer invalid_token" → Should get 401

---

### 4. Test Session Inactivity Timeout (30 minutes)

**Option A: Wait 30 minutes (not practical)**

**Option B: Manually test by modifying the database**

Connect to your database and run:
```sql
-- Update the last_activity_at to 31 minutes ago
UPDATE sessions 
SET last_activity_at = NOW() - INTERVAL '31 minutes'
WHERE user_id = 'YOUR_USER_ID';
```

Then try to access a protected endpoint with your access token. You should get:
```json
{
  "status": "error",
  "code": "AUTHENTICATION_FAILED",
  "title": "Authentication Failed",
  "detail": "Session expired due to inactivity"
}
```

**Option C: Modify the timeout constant temporarily**

In `src/middleware/authenticate.ts`, temporarily change:
```typescript
const SESSION_INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
```
to:
```typescript
const SESSION_INACTIVITY_TIMEOUT_MS = 10 * 1000; // 10 seconds for testing
```

Then:
1. Login to get a new token
2. Wait 11 seconds
3. Try to access a protected endpoint
4. Should get session expired error

**Don't forget to change it back!**

---

### 5. Test Logout (Delete Session)

**Endpoint:** `POST /api/v1/auth/logout`

**Headers:**
```
Authorization: Bearer YOUR_ACCESS_TOKEN_HERE
Content-Type: application/json
```

**Body:** None needed

**Expected Response (200):**
```json
{
  "status": "success",
  "data": {
    "message": "Logged out successfully"
  },
  "meta": {
    "timestamp": "2024-01-15T10:10:00.000Z",
    "requestId": "unknown"
  }
}
```

**After Logout:**
Try to use the same access token again on a protected endpoint. You should get:
```json
{
  "status": "error",
  "code": "AUTHENTICATION_FAILED",
  "title": "Authentication Failed",
  "detail": "Session not found or expired"
}
```

---

### 6. Test Token Refresh

First, login again to get fresh tokens.

**Endpoint:** `POST /api/v1/auth/refresh`

**Headers:**
```
Content-Type: application/json
```

**Body (raw JSON):**
```json
{
  "refreshToken": "YOUR_REFRESH_TOKEN_HERE"
}
```

**Expected Response (200):**
```json
{
  "status": "success",
  "data": {
    "tokens": {
      "accessToken": "NEW_ACCESS_TOKEN_HERE",
      "refreshToken": "NEW_REFRESH_TOKEN_HERE",
      "accessTokenExpiry": "2024-01-15T11:15:00.000Z",
      "refreshTokenExpiry": "2024-01-22T10:15:00.000Z"
    }
  },
  "meta": {
    "timestamp": "2024-01-15T10:15:00.000Z",
    "requestId": "unknown"
  }
}
```

**Test Invalid Refresh Token:**
```json
{
  "refreshToken": "invalid_token"
}
```

Expected error (401):
```json
{
  "status": "error",
  "code": "INVALID_REFRESH_TOKEN",
  "title": "Invalid Refresh Token",
  "detail": "Invalid refresh token"
}
```

---

## Advanced Testing Scenarios

### 7. Test Multiple Sessions

1. Login from "Device 1" (save tokens as Device1_AccessToken)
2. Login from "Device 2" (save tokens as Device2_AccessToken)
3. Both tokens should work independently
4. Logout from Device 1
5. Device 1 token should fail
6. Device 2 token should still work

### 8. Test Account Lockout (5 failed attempts)

Try logging in with wrong password 5 times:

**Request:**
```json
{
  "email": "testuser@example.com",
  "password": "WrongPassword123"
}
```

After 5 attempts, you should get:
```json
{
  "status": "error",
  "code": "AUTHENTICATION_FAILED",
  "title": "Authentication Failed",
  "detail": "Account locked due to too many failed login attempts"
}
```

The account will auto-unlock after 30 minutes.

### 9. Test Session Activity Updates

1. Login and get access token
2. Make a request to a protected endpoint
3. Check database: `SELECT last_activity_at FROM sessions WHERE user_id = 'YOUR_USER_ID'`
4. Wait a few seconds
5. Make another request to a protected endpoint
6. Check database again - `last_activity_at` should be updated

---

## Postman Collection Setup

### Create Environment Variables

1. Click "Environments" in Postman
2. Create new environment "Karbonica Dev"
3. Add variables:
   - `base_url`: `http://localhost:3000/api/v1`
   - `access_token`: (leave empty, will be set by tests)
   - `refresh_token`: (leave empty, will be set by tests)
   - `user_email`: `testuser@example.com`

### Use Variables in Requests

**URL:**
```
{{base_url}}/auth/login
```

**Authorization Header:**
```
Bearer {{access_token}}
```

### Auto-Save Tokens (Tests Tab)

In the login request, go to the "Tests" tab and add:

```javascript
// Parse response
const response = pm.response.json();

// Save tokens to environment
if (response.status === 'success' && response.data.tokens) {
    pm.environment.set('access_token', response.data.tokens.accessToken);
    pm.environment.set('refresh_token', response.data.tokens.refreshToken);
    console.log('Tokens saved to environment');
}
```

Now tokens will automatically be saved when you login!

---

## Troubleshooting

### "Database connection failed"
- Check if PostgreSQL is running
- Verify DATABASE_URL in .env file
- Run migrations: `npm run migrate:up`

### "Email service error" (doesn't affect testing)
- This is expected if you haven't configured an email service
- Registration still works, just email won't be sent
- Check console logs for the verification token

### "Session not found"
- Token might be expired
- Login again to get fresh tokens
- Check if you're using the correct token format: `Bearer <token>`

### "Invalid token"
- Make sure you're copying the full token
- Check for extra spaces in the Authorization header
- Verify JWT_SECRET is set in .env file

---

## Quick Test Checklist

- [ ] Register new user
- [ ] Login successfully
- [ ] Access protected endpoint with valid token
- [ ] Access protected endpoint without token (should fail)
- [ ] Access protected endpoint with invalid token (should fail)
- [ ] Logout successfully
- [ ] Try to use token after logout (should fail)
- [ ] Login again
- [ ] Refresh token successfully
- [ ] Old access token should not work after refresh
- [ ] New access token should work
- [ ] Test session inactivity timeout
- [ ] Test multiple failed login attempts (account lockout)

---

## Database Queries for Verification

```sql
-- View all sessions for a user
SELECT id, user_id, expires_at, ip_address, user_agent, created_at, last_activity_at
FROM sessions
WHERE user_id = 'YOUR_USER_ID';

-- View all users
SELECT id, email, name, role, email_verified, account_locked, failed_login_attempts, last_login_at
FROM users;

-- Delete all sessions (for testing)
DELETE FROM sessions WHERE user_id = 'YOUR_USER_ID';

-- Manually expire a session
UPDATE sessions 
SET last_activity_at = NOW() - INTERVAL '31 minutes'
WHERE user_id = 'YOUR_USER_ID';
```

---

## Expected Behavior Summary

| Action                                           | Expected Result                            |
| ------------------------------------------------ | ------------------------------------------ |
| Register with valid data                         | 201, user created, no password in response |
| Register with existing email                     | 409, error message                         |
| Login with correct credentials                   | 200, tokens returned, session created      |
| Login with wrong password                        | 401, error message                         |
| Access protected endpoint with valid token       | 200, data returned                         |
| Access protected endpoint without token          | 401, authentication error                  |
| Access protected endpoint after 30min inactivity | 401, session expired                       |
| Logout                                           | 200, session deleted                       |
| Use token after logout                           | 401, session not found                     |
| Refresh with valid refresh token                 | 200, new tokens returned                   |
| Refresh with invalid refresh token               | 401, error message                         |
| 5 failed login attempts                          | 401, account locked                        |

Happy testing! 🚀
