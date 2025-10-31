# Session Management Implementation

## Overview

This document describes the session management implementation for the Karbonica Carbon Credit Registry Platform, completed as part of Task 6 from the implementation plan.

## Implementation Summary

### ✅ Completed Components

1. **Session Entity** (`src/domain/entities/Session.ts`)
   - Added `lastActivityAt` field for inactivity tracking
   - Tracks session creation and last activity timestamps

2. **Session Repository** (`src/infrastructure/repositories/SessionRepository.ts`)
   - Implemented `update()` method for updating session activity
   - Implemented `deleteInactive()` method for cleaning up inactive sessions
   - Updated all query methods to include `lastActivityAt` field

3. **Session Validation Middleware** (`src/middleware/authenticate.ts`)
   - Validates JWT access tokens
   - Checks session existence in database
   - Enforces 30-minute inactivity timeout
   - Updates `lastActivityAt` on each authenticated request
   - Verifies user account status (not locked, exists)
   - Attaches user info to request object
   - Includes `optionalAuthenticate` for endpoints that work with/without auth

4. **Session Cleanup Utility** (`src/utils/sessionCleanup.ts`)
   - Automated cleanup of expired sessions (based on `expires_at`)
   - Automated cleanup of inactive sessions (30 min inactivity)
   - Runs every 5 minutes
   - Integrated into application lifecycle

5. **Database Migration** (`src/database/migrations/004_add_last_activity_to_sessions.sql`)
   - Added `last_activity_at` column to sessions table
   - Added index for efficient cleanup queries
   - Includes rollback migration

6. **Logout Endpoint** (`POST /api/v1/auth/logout`)
   - Already implemented in `src/routes/auth.ts`
   - Deletes all sessions for the user

7. **Refresh Token Endpoint** (`POST /api/v1/auth/refresh`)
   - Already implemented in `src/routes/auth.ts`
   - Generates new access and refresh tokens
   - Creates new session with updated tokens

## Key Features

### Session Inactivity Timeout

- **Timeout Duration**: 30 minutes
- **Tracking**: `lastActivityAt` timestamp updated on every authenticated request
- **Enforcement**: Middleware checks inactivity duration and deletes expired sessions
- **Cleanup**: Background job runs every 5 minutes to clean up inactive sessions

### Session Validation Flow

```
1. Extract Bearer token from Authorization header
2. Verify JWT signature and expiration
3. Hash token and look up session in database
4. Check session hasn't expired (refresh token expiry)
5. Check session hasn't been inactive for > 30 minutes
6. Verify user still exists and account is not locked
7. Update lastActivityAt timestamp
8. Attach user info to request
9. Continue to route handler
```

### Security Features

- JWT tokens are hashed before storage (SHA-256)
- Session validation on every authenticated request
- Automatic cleanup of expired/inactive sessions
- Account lockout detection
- User existence verification

## Usage

### Protecting Routes

```typescript
import { authenticate } from '../middleware/authenticate';

// Apply to specific route
router.get('/protected', authenticate, async (req, res) => {
  // req.user contains { id, email, role }
  // req.sessionId contains the session ID
  res.json({ user: req.user });
});

// Apply to all routes in router
router.use(authenticate);
```

### Optional Authentication

```typescript
import { optionalAuthenticate } from '../middleware/authenticate';

// Route works with or without authentication
router.get('/public', optionalAuthenticate, async (req, res) => {
  if (req.user) {
    // User is authenticated
  } else {
    // Anonymous user
  }
});
```

## Configuration

### Environment Variables

No additional environment variables required. Session timeout is configured in the middleware:

- `SESSION_INACTIVITY_TIMEOUT_MS`: 30 minutes (1,800,000 ms)
- `CLEANUP_INTERVAL_MS`: 5 minutes (300,000 ms)

### Database

The migration adds the `last_activity_at` column to the sessions table:

```bash
npm run migrate:up
```

## Testing

### Unit Tests

- `src/middleware/__tests__/authenticate.test.ts` - Middleware validation tests
- All tests pass successfully

### Integration Tests

- `src/test/auth/logout.test.ts` - Logout functionality (2 tests passed)
- `src/test/auth/refresh-token.test.ts` - Token refresh functionality

## API Endpoints

### POST /api/v1/auth/logout

Logs out the user by deleting all their sessions.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "message": "Logged out successfully"
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "req-123"
  }
}
```

### POST /api/v1/auth/refresh

Refreshes the access token using a valid refresh token.

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "tokens": {
      "accessToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
      "accessTokenExpiry": "2024-01-15T10:45:00Z",
      "refreshTokenExpiry": "2024-01-22T10:30:00Z"
    }
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "req-123"
  }
}
```

## Requirements Verification

✅ **Requirement 1.8**: Session management with 30-minute inactivity timeout
- Sessions expire after 30 minutes of inactivity
- `lastActivityAt` timestamp tracks activity
- Middleware validates and updates session activity
- Background cleanup removes inactive sessions

## Next Steps

To use the authentication middleware in your routes:

1. Import the middleware: `import { authenticate } from '../middleware/authenticate';`
2. Apply to routes: `router.get('/protected', authenticate, handler);`
3. Access user info in handlers: `req.user` and `req.sessionId`

The session cleanup scheduler starts automatically when the application starts and stops gracefully on shutdown.
