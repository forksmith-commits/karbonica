# Testing Guide for User Registration

## Prerequisites

1. Make sure the database migrations have been run:
   ```bash
   npm run migrate:up
   ```

2. Ensure your `.env` file is configured with valid database credentials

## Option 1: Manual Testing with PowerShell Script (Easiest)

1. **Start the development server** (if not already running):
   ```bash
   npm run dev
   ```

2. **Open a new terminal** and run the test script:
   ```powershell
   .\test-registration.ps1
   ```

This will run 5 automated tests:
- ✓ Successful registration
- ✓ Duplicate email rejection (409)
- ✓ Invalid email format rejection (400)
- ✓ Weak password rejection (400)
- ✓ Missing required field rejection (400)

## Option 2: Manual Testing with HTTP Client

If you have the REST Client extension in VS Code:

1. Open `test-registration.http`
2. Click "Send Request" above each test case
3. View the responses inline

## Option 3: Manual Testing with curl

```bash
# Test successful registration
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Password123",
    "name": "Test User",
    "company": "Test Company",
    "role": "developer"
  }'
```

## Option 4: Run Automated Tests (Vitest)

**Note**: You need to stop the dev server first!

1. **Stop the dev server** (Ctrl+C in the terminal running `npm run dev`)

2. **Run the tests**:
   ```bash
   npm test
   ```

   Or run specific test files:
   ```bash
   # Run only validation tests
   npx vitest run src/utils/__tests__/validation.test.ts

   # Run only crypto tests
   npx vitest run src/utils/__tests__/crypto.test.ts

   # Run only service tests
   npx vitest run src/application/services/__tests__/AuthService.test.ts

   # Run only integration tests
   npx vitest run src/routes/__tests__/auth.test.ts
   ```

## Expected Responses

### Successful Registration (201 Created)
```json
{
  "status": "success",
  "data": {
    "user": {
      "id": "uuid-here",
      "email": "test@example.com",
      "name": "Test User",
      "company": "Test Company",
      "role": "developer",
      "emailVerified": false,
      "createdAt": "2024-01-01T00:00:00.000Z"
    },
    "message": "Registration successful. Please check your email to verify your account."
  },
  "meta": {
    "timestamp": "2024-01-01T00:00:00.000Z",
    "requestId": "unknown"
  }
}
```

### Duplicate Email (409 Conflict)
```json
{
  "status": "error",
  "code": "EMAIL_ALREADY_EXISTS",
  "title": "Email Already Registered",
  "detail": "An account with this email address already exists",
  "meta": {
    "timestamp": "2024-01-01T00:00:00.000Z",
    "requestId": "unknown"
  }
}
```

### Validation Error (400 Bad Request)
```json
{
  "status": "error",
  "code": "VALIDATION_ERROR",
  "title": "Validation Failed",
  "detail": "The request contains invalid data",
  "errors": [
    {
      "field": "password",
      "message": "Password must contain at least one uppercase letter"
    }
  ],
  "meta": {
    "timestamp": "2024-01-01T00:00:00.000Z",
    "requestId": "unknown"
  }
}
```

## Checking the Database

After successful registration, you can verify the user was created:

```bash
# Connect to your database and run:
SELECT id, email, name, role, email_verified, created_at 
FROM users 
ORDER BY created_at DESC 
LIMIT 5;
```

## Checking Logs

The verification token is logged (not sent via email yet). Check your console output for:

```json
{
  "level": "info",
  "message": "Email verification token generated",
  "userId": "uuid-here",
  "token": "64-character-hex-token"
}
```

## Troubleshooting

### "Database not connected" error
- Make sure migrations have been run: `npm run migrate:up`
- Check your `.env` file has correct database credentials
- Verify the database is accessible

### "Port 3000 already in use"
- Stop any other processes using port 3000
- Or change the PORT in your `.env` file

### Tests fail with connection errors
- Make sure the dev server is stopped before running `npm test`
- The tests will start their own server instance

## Next Steps

After testing registration, you can:
1. Implement email verification (Task 4)
2. Implement login/authentication (Task 5)
3. Test the complete authentication flow
