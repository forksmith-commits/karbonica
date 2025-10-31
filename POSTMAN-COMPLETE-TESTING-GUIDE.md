# Complete Postman Testing Guide - Email Verification Flow

## Prerequisites

1. ✅ Server running: `npm run dev`
2. ✅ Server accessible at: `http://localhost:3000`
3. ✅ Mailgun packages installed (if using real emails)
4. ✅ Authorized recipient added in Mailgun (if using real emails)

---

## Test Flow Overview

```
1. Register User → 2. Receive Email → 3. Verify Email → 4. Confirm Verification
```

---

## Test 1: Register a New User ✉️

### Request Details:
- **Method:** `POST`
- **URL:** `http://localhost:3000/api/v1/auth/register`
- **Headers:**
  ```
  Content-Type: application/json
  ```
- **Body (raw JSON):**
```json
{
  "email": "your-email@example.com",
  "password": "SecurePass123!",
  "name": "John Doe",
  "company": "Acme Corp",
  "role": "developer"
}
```

**Important Notes:**
- Use a valid email format
- Password must be strong (min 8 chars, uppercase, lowercase, number, special char)
- Role must be one of: `developer`, `verifier`, `administrator`, `buyer`
- If using Mailgun sandbox, use an authorized recipient email

### Expected Response (201 Created):
```json
{
  "status": "success",
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "your-email@example.com",
      "name": "John Doe",
      "company": "Acme Corp",
      "role": "developer",
      "emailVerified": false,
      "createdAt": "2024-01-15T10:30:00.000Z"
    },
    "message": "Registration successful. Please check your email to verify your account."
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00.000Z",
    "requestId": "req-123"
  }
}
```

**Key Points to Check:**
- ✅ Status code is `201`
- ✅ `emailVerified` is `false`
- ✅ User `id` is returned (save this for later)
- ✅ Success message mentions email verification

---

## Test 2: Get Verification Token 🔑

### If EMAIL_SERVICE=console (Console Emails):
Look at your **server terminal** where `npm run dev` is running. You'll see:

```
========================================
📧 EMAIL VERIFICATION
========================================
To: your-email@example.com
Name: John Doe

Hi John Doe,

Thank you for registering with Karbonica!

Please verify your email address by clicking the link below:

http://localhost:5173/verify-email?token=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6...

Or use this token directly:
Token: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2

This link will expire in 24 hours.
========================================
```

**Copy the token** (the long hex string)

### If EMAIL_SERVICE=mailgun (Real Emails):
1. Check your email inbox
2. Open the "Verify Your Email - Karbonica" email
3. You'll see a beautiful HTML email with a green button
4. Either:
   - Click the "Verify Email Address" button (opens in browser)
   - Or copy the token from the URL in the email

---

## Test 3: Verify Email Address ✅

### Request Details:
- **Method:** `GET`
- **URL:** `http://localhost:3000/api/v1/auth/verify-email?token=YOUR_TOKEN_HERE`
  - Replace `YOUR_TOKEN_HERE` with the token from Test 2
- **Headers:** None required
- **Body:** None

### Example URL:
```
http://localhost:3000/api/v1/auth/verify-email?token=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
```

### Expected Response (200 OK):
```json
{
  "status": "success",
  "data": {
    "message": "Email verified successfully. You can now log in."
  },
  "meta": {
    "timestamp": "2024-01-15T10:35:00.000Z",
    "requestId": "req-124"
  }
}
```

**Key Points to Check:**
- ✅ Status code is `200`
- ✅ Success message confirms verification
- ✅ User can now log in (email is verified in database)

---

## Test 4: Try to Verify Again (Should Fail) ❌

### Request Details:
- **Method:** `GET`
- **URL:** Same as Test 3 (use the same token again)

### Expected Response (400 Bad Request):
```json
{
  "status": "error",
  "code": "ALREADY_VERIFIED",
  "title": "Email Already Verified",
  "detail": "This email address has already been verified",
  "meta": {
    "timestamp": "2024-01-15T10:36:00.000Z",
    "requestId": "req-125"
  }
}
```

**Key Points to Check:**
- ✅ Status code is `400`
- ✅ Error code is `ALREADY_VERIFIED`
- ✅ Tokens can only be used once

---

## Additional Test Cases

### Test 5: Invalid Token ❌

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
    "timestamp": "2024-01-15T10:37:00.000Z",
    "requestId": "req-126"
  }
}
```

---

### Test 6: Missing Token ❌

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
    "timestamp": "2024-01-15T10:38:00.000Z",
    "requestId": "req-127"
  }
}
```

---

### Test 7: Duplicate Email Registration ❌

**Request:**
- **Method:** `POST`
- **URL:** `http://localhost:3000/api/v1/auth/register`
- **Body:** Same email as Test 1

**Expected Response (409 Conflict):**
```json
{
  "status": "error",
  "code": "EMAIL_ALREADY_EXISTS",
  "title": "Email Already Registered",
  "detail": "An account with this email address already exists",
  "meta": {
    "timestamp": "2024-01-15T10:39:00.000Z",
    "requestId": "req-128"
  }
}
```

---

### Test 8: Invalid Email Format ❌

**Request:**
- **Method:** `POST`
- **URL:** `http://localhost:3000/api/v1/auth/register`
- **Body:**
```json
{
  "email": "not-an-email",
  "password": "SecurePass123!",
  "name": "Test User",
  "role": "developer"
}
```

**Expected Response (400 Bad Request):**
```json
{
  "status": "error",
  "code": "INVALID_EMAIL",
  "title": "Invalid Email",
  "detail": "The provided email address is not valid",
  "meta": {
    "timestamp": "2024-01-15T10:40:00.000Z",
    "requestId": "req-129"
  }
}
```

---

## Postman Collection Setup

### Create a Collection:

1. **Open Postman**
2. **Click "New" → "Collection"**
3. **Name it:** "Karbonica - Email Verification"

### Add Requests:

#### Folder 1: Happy Path ✅
1. **1. Register User** (POST)
2. **2. Verify Email** (GET)

#### Folder 2: Error Cases ❌
3. **3. Verify Again - Already Verified** (GET)
4. **4. Invalid Token** (GET)
5. **5. Missing Token** (GET)
6. **6. Duplicate Email** (POST)
7. **7. Invalid Email Format** (POST)

---

## Environment Variables (Optional)

Create a Postman environment for easier testing:

### Variables:
```
base_url = http://localhost:3000
api_version = v1
verification_token = (set manually after registration)
test_email = your-email@example.com
```

### Usage in Requests:
- **URL:** `{{base_url}}/api/{{api_version}}/auth/register`
- **Verify URL:** `{{base_url}}/api/{{api_version}}/auth/verify-email?token={{verification_token}}`

---

## Quick Test Script (PowerShell)

Save this as `test-email-flow.ps1`:

```powershell
$baseUrl = "http://localhost:3000/api/v1"
$email = "test-$(Get-Random)@example.com"

Write-Host "Testing Email Verification Flow" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan

# Test 1: Register
Write-Host "`n1. Registering user..." -ForegroundColor Yellow
$registerData = @{
    email = $email
    password = "SecurePass123!"
    name = "Test User"
    company = "Test Co"
    role = "developer"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/auth/register" -Method Post -Body $registerData -ContentType "application/json"
    Write-Host "   ✓ Registration successful" -ForegroundColor Green
    Write-Host "   Email: $($response.data.user.email)" -ForegroundColor Gray
    Write-Host "   Email Verified: $($response.data.user.emailVerified)" -ForegroundColor Gray
    
    Write-Host "`n2. Check server console for verification token!" -ForegroundColor Yellow
    Write-Host "   Then run: Invoke-RestMethod -Uri '$baseUrl/auth/verify-email?token=YOUR_TOKEN' -Method Get" -ForegroundColor Cyan
} catch {
    Write-Host "   ✗ Failed: $($_.Exception.Message)" -ForegroundColor Red
}
```

Run with:
```powershell
powershell -ExecutionPolicy Bypass -File test-email-flow.ps1
```

---

## Troubleshooting

### Issue: "Connection refused"
**Solution:** Make sure your server is running (`npm run dev`)

### Issue: "Email not received" (Mailgun)
**Solution:** 
1. Check spam folder
2. Verify email is authorized in Mailgun
3. Check Mailgun logs: https://app.mailgun.com/app/logs
4. Make sure `EMAIL_SERVICE=mailgun` in .env

### Issue: "Token not found in console"
**Solution:** 
1. Make sure `EMAIL_SERVICE=console` in .env
2. Look at the terminal where server is running
3. Scroll up to find the email output

### Issue: "INVALID_TOKEN"
**Solution:**
1. Make sure you copied the entire token
2. Token might have expired (24 hours)
3. Register a new user to get a fresh token

### Issue: "Database error"
**Solution:**
1. Make sure database migration ran
2. Check database connection in .env
3. Verify `email_verification_tokens` table exists

---

## Success Checklist ✅

After completing all tests, you should have:

- ✅ Successfully registered a user
- ✅ Received verification email (console or real)
- ✅ Verified email with token
- ✅ Confirmed token can't be reused
- ✅ Tested error cases (invalid token, missing token, etc.)
- ✅ Confirmed duplicate emails are rejected
- ✅ Validated email format checking works

---

## What's Been Implemented

### Features:
1. ✅ User registration with email verification
2. ✅ Email verification token generation (64-char hex, 24-hour expiry)
3. ✅ Email sending (Console or Mailgun)
4. ✅ Email verification endpoint
5. ✅ Token validation (exists, not used, not expired)
6. ✅ User email_verified status update
7. ✅ Comprehensive error handling

### Security:
1. ✅ Secure random tokens (256-bit entropy)
2. ✅ Single-use tokens
3. ✅ Token expiration (24 hours)
4. ✅ Email uniqueness validation
5. ✅ Password hashing (bcrypt, cost 12)

### API Endpoints:
1. ✅ `POST /api/v1/auth/register` - Register user
2. ✅ `GET /api/v1/auth/verify-email?token=XXX` - Verify email

---

## Next Steps

After email verification is working:
1. Implement login endpoint
2. Add JWT token generation
3. Implement password reset flow
4. Add session management
5. Implement protected routes

---

Happy testing! 🚀

If you encounter any issues, check the troubleshooting section or let me know!
