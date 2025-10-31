# PowerShell script to test user registration endpoint
# Make sure the server is running (npm run dev) before running this script

$baseUrl = "http://localhost:3000/api/v1/auth"

Write-Host "`n=== Testing User Registration Endpoint ===" -ForegroundColor Cyan

# Test 1: Successful Registration
Write-Host "`n[Test 1] Successful Registration" -ForegroundColor Yellow
$body1 = @{
    email = "test$(Get-Random)@example.com"
    password = "Password123"
    name = "Test User"
    company = "Test Company"
    role = "developer"
} | ConvertTo-Json

try {
    $response1 = Invoke-RestMethod -Uri "$baseUrl/register" -Method Post -Body $body1 -ContentType "application/json"
    Write-Host "✓ Success: User registered" -ForegroundColor Green
    Write-Host "User ID: $($response1.data.user.id)"
    Write-Host "Email: $($response1.data.user.email)"
} catch {
    Write-Host "✗ Failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 2: Duplicate Email (should fail with 409)
Write-Host "`n[Test 2] Duplicate Email (should fail)" -ForegroundColor Yellow
$body2 = @{
    email = "duplicate@example.com"
    password = "Password123"
    name = "First User"
    role = "developer"
} | ConvertTo-Json

try {
    # Register first time
    Invoke-RestMethod -Uri "$baseUrl/register" -Method Post -Body $body2 -ContentType "application/json" | Out-Null
    
    # Try to register again with same email
    Invoke-RestMethod -Uri "$baseUrl/register" -Method Post -Body $body2 -ContentType "application/json"
    Write-Host "✗ Failed: Should have rejected duplicate email" -ForegroundColor Red
} catch {
    if ($_.Exception.Response.StatusCode -eq 409) {
        Write-Host "✓ Success: Duplicate email rejected (409)" -ForegroundColor Green
    } else {
        Write-Host "✗ Failed: Wrong error code" -ForegroundColor Red
    }
}

# Test 3: Invalid Email Format (should fail with 400)
Write-Host "`n[Test 3] Invalid Email Format (should fail)" -ForegroundColor Yellow
$body3 = @{
    email = "invalid-email"
    password = "Password123"
    name = "Test User"
    role = "developer"
} | ConvertTo-Json

try {
    Invoke-RestMethod -Uri "$baseUrl/register" -Method Post -Body $body3 -ContentType "application/json"
    Write-Host "✗ Failed: Should have rejected invalid email" -ForegroundColor Red
} catch {
    if ($_.Exception.Response.StatusCode -eq 400) {
        Write-Host "✓ Success: Invalid email rejected (400)" -ForegroundColor Green
    } else {
        Write-Host "✗ Failed: Wrong error code" -ForegroundColor Red
    }
}

# Test 4: Weak Password (should fail with 400)
Write-Host "`n[Test 4] Weak Password (should fail)" -ForegroundColor Yellow
$body4 = @{
    email = "weak@example.com"
    password = "weak"
    name = "Test User"
    role = "developer"
} | ConvertTo-Json

try {
    Invoke-RestMethod -Uri "$baseUrl/register" -Method Post -Body $body4 -ContentType "application/json"
    Write-Host "✗ Failed: Should have rejected weak password" -ForegroundColor Red
} catch {
    if ($_.Exception.Response.StatusCode -eq 400) {
        Write-Host "✓ Success: Weak password rejected (400)" -ForegroundColor Green
    } else {
        Write-Host "✗ Failed: Wrong error code" -ForegroundColor Red
    }
}

# Test 5: Missing Required Field (should fail with 400)
Write-Host "`n[Test 5] Missing Required Field (should fail)" -ForegroundColor Yellow
$body5 = @{
    email = "missing@example.com"
    password = "Password123"
    role = "developer"
} | ConvertTo-Json

try {
    Invoke-RestMethod -Uri "$baseUrl/register" -Method Post -Body $body5 -ContentType "application/json"
    Write-Host "✗ Failed: Should have rejected missing name field" -ForegroundColor Red
} catch {
    if ($_.Exception.Response.StatusCode -eq 400) {
        Write-Host "✓ Success: Missing field rejected (400)" -ForegroundColor Green
    } else {
        Write-Host "✗ Failed: Wrong error code" -ForegroundColor Red
    }
}

Write-Host "`n=== Testing Complete ===" -ForegroundColor Cyan
