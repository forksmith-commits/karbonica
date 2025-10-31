# Apply email verification migration directly to database

Write-Host "Applying Email Verification Migration" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Read .env file
$envFile = Get-Content .env
$dbHost = ($envFile | Select-String "DB_HOST=(.+)").Matches.Groups[1].Value
$dbPort = ($envFile | Select-String "DB_PORT=(.+)").Matches.Groups[1].Value
$dbName = ($envFile | Select-String "DB_NAME=(.+)").Matches.Groups[1].Value
$dbUser = ($envFile | Select-String "DB_USER=(.+)").Matches.Groups[1].Value
$dbPassword = ($envFile | Select-String "DB_PASSWORD=(.+)").Matches.Groups[1].Value

Write-Host "Database: $dbName" -ForegroundColor Gray
Write-Host "Host: $dbHost" -ForegroundColor Gray
Write-Host ""

# Read migration SQL
$migrationSql = Get-Content "src/database/migrations/003_add_email_verification_tokens.sql" -Raw

Write-Host "Migration SQL:" -ForegroundColor Yellow
Write-Host $migrationSql -ForegroundColor Gray
Write-Host ""

Write-Host "To apply this migration, you have two options:" -ForegroundColor Yellow
Write-Host ""
Write-Host "Option 1: Use psql command line" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -c `"$($migrationSql -replace '"','\"')`"" -ForegroundColor White
Write-Host ""

Write-Host "Option 2: Use a database GUI tool" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "1. Open pgAdmin, DBeaver, or any PostgreSQL client" -ForegroundColor White
Write-Host "2. Connect to your database with these credentials:" -ForegroundColor White
Write-Host "   Host: $dbHost" -ForegroundColor Gray
Write-Host "   Port: $dbPort" -ForegroundColor Gray
Write-Host "   Database: $dbName" -ForegroundColor Gray
Write-Host "   User: $dbUser" -ForegroundColor Gray
Write-Host "3. Run the SQL from: src/database/migrations/003_add_email_verification_tokens.sql" -ForegroundColor White
Write-Host ""

Write-Host "Option 3: Copy SQL and run manually" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "The SQL has been displayed above. Copy it and run it in your database client." -ForegroundColor White
Write-Host ""
