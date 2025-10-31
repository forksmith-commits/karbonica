# Postman Testing Guide: Email Verification

## Prerequisites

1. Make sure your server is running:
   ```bash
   npm run dev
   ```

2. Server should be accessible at: `http://localhost:3000`

3. Have Postman installed and ready

## Step-by-Step Testing

### Step 1: Register a New User

**Request:**
- **Method:** `POST`
- **URL:** `http://localhost:3000/api/v1/auth/register`
- **Headers:**
  - `Content-Type: application/json`
- **Body (raw JSON):**
```json
{
  "email": "testuser@example.com",
  "password": "SecurePass123!",
  "name": "Test User",
  "company": "Test Company",
  "role": "developer"
}
```

**Expected Response (201 Created):**
```json
{
  "status": "success",
  "data": {
    "user": {
      "id": "some-uuid-here",
      "email": "testuser@example.com",
      "name": "Test User",
      "company": "Test Company",
      "role": "developer",
      "emailVerified": false,
      "createdAt": "2024-01-15T10:30:00Z"
    },
    "message": "Registration successful. Please check your email to verify your account."
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "req-123"
  }
}
```

**Important:** Note that `emailVerified` is `false`

### Step 2: Get the Verification Token

Since we're using `ConsoleEmailService` in development, the verification email is logged to your **server console** (not Postman).

**Look at your terminal/console where the server is running.** You should see output like this:

```
========================================
📧 EMAIL VERIFICATION
========================================
To: testuser@example.com
Name: Test User

Hi Test User,

Thank you for registering with Karbonica!

Please verify your email address by clicking the link below:

http://localhost:5173/verify-email?token=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2

Or use this token directly:
Token: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2

This link will expire in 24 hours.

If you did not create an account, please ignore this email.

Best regards,
The Karbonica Team
========================================
```

**Copy the token** (the long hex string after "Token:")

### Step 3: Verify the Email

**Request:**
- **Method:** `GET`
- **URL:** `http://localhost:3000/api/v1/auth/verify-email?token=YOUR_TOKEN_HERE`
  - Replace `YOUR_TOKEN_HERE` with the token you copied from the console
- **Headers:** None required

**Example:**
```
http://localhost:3000/api/v1/auth/verify-email?token=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
```

**Expected Response (200 OK):**
```json
{
  "status": "success",
  "data": {
    "message": "Email verified successfully. You can now log in."
  },
  "meta": {
    "timestamp": "2024-01-15T10:35:00Z",
    "requestId": "req-124"
  }
}
```

### Step 4: Try to Verify Again (Should Fail)

**Request:**
- **Method:** `GET`
- **URL:** Same as Step 3 (use the same token again)

**Expected Response (400 Bad Request):**
```json
{
  "status": "error",
  "code": "ALREADY_VERIFIED",
  "title": "Email Already Verified",
  "detail": "This email address has already been verified",
  "meta": {
    "timestamp": "2024-01-15T10:36:00Z",
    "requestId": "req-125"
  }
}
```

## Additional Test Cases

### Test Case 1: Invalid Token

**Request:**
- **Method:** `GET`
- **URL:** `http://localhost:3000/api/v1/auth/verify-email?token=invalid_token_123`

**Expected Response (400 Bad Request):**
```json
{
  "status": "error",
  "code": "INVALID_TOKEN",
  "title": "Invalid Verification Token",
  "detail": "The verification token is invalid or does not exist",
  "meta": {
    "timestamp": "2024-01-15T10:37:00Z",
    "requestId": "req-126"
  }
}
```

### Test Case 2: Missing Token

**Request:**
- **Method:** `GET`
- **URL:** `http://localhost:3000/api/v1/auth/verify-email`
  - (No token parameter)

**Expected Response (400 Bad Request):**
```json
{
  "status": "error",
  "code": "MISSING_TOKEN",
  "title": "Missing Verification Token",
  "detail": "Verification token is required",
  "meta": {
    "timestamp": "2024-01-15T10:38:00Z",
    "requestId": "req-127"
  }
}
```

### Test Case 3: Expired Token

To test this, you would need to:
1. Register a user
2. Manually update the token's `expires_at` in the database to a past date
3. Try to verify with that token

**Expected Response (400 Bad Request):**
```json
{
  "status": "error",
  "code": "TOKEN_EXPIRED",
  "title": "Token Expired",
  "detail": "This verification token has expired. Please request a new one.",
  "meta": {
    "timestamp": "2024-01-15T10:39:00Z",
    "requestId": "req-128"
  }
}
```

## Postman Collection Setup

You can create a Postman collection with these requests:

### Collection Structure:
```
📁 Karbonica - Email Verification
  📄 1. Register User (POST)
  📄 2. Verify Email (GET)
  📄 3. Verify Again - Should Fail (GET)
  📄 4. Invalid Token Test (GET)
  📄 5. Missing Token Test (GET)
```

### Environment Variables (Optional)

Create a Postman environment with:
- `base_url`: `http://localhost:3000`
- `api_version`: `v1`
- `verification_token`: (set this manually after registration)

Then use:
- URL: `{{base_url}}/api/{{api_version}}/auth/verify-email?token={{verification_token}}`

## Quick Test Script

Here's a quick PowerShell script to test the flow:

```powershell
# 1. Register user
$registerData = @{
    email = "quicktest@example.com"
    password = "SecurePass123!"
    name = "Quick Test"
    company = "Test Co"
    role = "developer"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/auth/register" -Method Post -Body $registerData -ContentType "application/json"

Write-Host "User registered! Check server console for verification token."
Write-Host "User ID: $($response.data.user.id)"
Write-Host "Email Verified: $($response.data.user.emailVerified)"
Write-Host ""
Write-Host "Copy the token from server console and run:"
Write-Host "Invoke-RestMethod -Uri 'http://localhost:3000/api/v1/auth/verify-email?token=YOUR_TOKEN' -Method Get"
```

## Troubleshooting

### Issue: Can't find the token in console

**Solution:** Make sure you're looking at the terminal where `npm run dev` is running. The token is printed there, not in Postman.

### Issue: Server not responding

**Solution:** 
1. Check if server is running: `npm run dev`
2. Verify port 3000 is not in use
3. Check `.env` file has correct database credentials

### Issue: Database error

**Solution:** Run the migration first:
```bash
npm run migrate:up
```

Or manually apply the migration SQL from:
`src/database/migrations/003_add_email_verification_tokens.sql`

### Issue: Token not found in database

**Solution:** Check that the registration completed successfully and the `email_verification_tokens` table exists in your database.

## Database Verification (Optional)

You can also verify the data directly in your database:

```sql
-- Check if token was created
SELECT * FROM email_verification_tokens 
WHERE user_id = 'YOUR_USER_ID';

-- Check if user email is verified
SELECT id, email, email_verified 
FROM users 
WHERE email = 'testuser@example.com';
```

## Summary

The complete flow is:
1. **POST** `/api/v1/auth/register` → Creates user with `emailVerified: false`
2. Check **server console** → Copy verification token
3. **GET** `/api/v1/auth/verify-email?token=XXX` → Verifies email
4. User's `emailVerified` is now `true` ✅

Happy testing! 🚀
