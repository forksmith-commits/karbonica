# Test email verification implementation

$baseUrl = "http://localhost:3000/api/v1"

Write-Host "Testing Email Verification Implementation" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Test 1: Register a new user
Write-Host "Test 1: Register a new user" -ForegroundColor Yellow
$registerData = @{
    email = "verify-test-$(Get-Random)@example.com"
    password = "SecurePass123!"
    name = "Verification Test User"
    company = "Test Company"
    role = "developer"
} | ConvertTo-Json

try {
    $registerResponse = Invoke-RestMethod -Uri "$baseUrl/auth/register" -Method Post -Body $registerData -ContentType "application/json"
    Write-Host "✓ Registration successful" -ForegroundColor Green
    Write-Host "  User ID: $($registerResponse.data.user.id)" -ForegroundColor Gray
    Write-Host "  Email: $($registerResponse.data.user.email)" -ForegroundColor Gray
    Write-Host "  Email Verified: $($registerResponse.data.user.emailVerified)" -ForegroundColor Gray
    
    $userId = $registerResponse.data.user.id
    $userEmail = $registerResponse.data.user.email
    
    # Check console output for verification token
    Write-Host ""
    Write-Host "  Check the server console for the verification email with token" -ForegroundColor Cyan
    Write-Host ""
    
} catch {
    Write-Host "✗ Registration failed" -ForegroundColor Red
    Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Test 2: Try to verify with invalid token
Write-Host "Test 2: Verify with invalid token" -ForegroundColor Yellow
try {
    $verifyResponse = Invoke-RestMethod -Uri "$baseUrl/auth/verify-email?token=invalid_token_123" -Method Get
    Write-Host "✗ Should have failed with invalid token" -ForegroundColor Red
} catch {
    $errorResponse = $_.ErrorDetails.Message | ConvertFrom-Json
    if ($errorResponse.code -eq "INVALID_TOKEN") {
        Write-Host "✓ Correctly rejected invalid token" -ForegroundColor Green
        Write-Host "  Error code: $($errorResponse.code)" -ForegroundColor Gray
    } else {
        Write-Host "✗ Unexpected error: $($errorResponse.code)" -ForegroundColor Red
    }
}
Write-Host ""

# Test 3: Try to verify without token
Write-Host "Test 3: Verify without token parameter" -ForegroundColor Yellow
try {
    $verifyResponse = Invoke-RestMethod -Uri "$baseUrl/auth/verify-email" -Method Get
    Write-Host "✗ Should have failed without token" -ForegroundColor Red
} catch {
    $errorResponse = $_.ErrorDetails.Message | ConvertFrom-Json
    if ($errorResponse.code -eq "MISSING_TOKEN") {
        Write-Host "✓ Correctly rejected missing token" -ForegroundColor Green
        Write-Host "  Error code: $($errorResponse.code)" -ForegroundColor Gray
    } else {
        Write-Host "✗ Unexpected error: $($errorResponse.code)" -ForegroundColor Red
    }
}
Write-Host ""

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Manual verification test required:" -ForegroundColor Yellow
Write-Host "1. Check the server console for the verification token" -ForegroundColor White
Write-Host "2. Copy the token from the console output" -ForegroundColor White
Write-Host "3. Run: Invoke-RestMethod -Uri '$baseUrl/auth/verify-email?token=YOUR_TOKEN' -Method Get" -ForegroundColor White
Write-Host "4. Verify the response shows success" -ForegroundColor White
Write-Host ""
