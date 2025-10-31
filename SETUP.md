# Setup Guide

This guide will help you set up the Karbonica Carbon Credit Registry Platform development environment.

## Step 1: Install Dependencies

Install Node.js dependencies:
```bash
npm install
```

## Step 2: Set Up PostgreSQL

### Install PostgreSQL
- **Windows**: Download from https://www.postgresql.org/download/windows/
- **macOS**: `brew install postgresql`
- **Linux**: `sudo apt-get install postgresql`

### Create Database
```bash
# Start PostgreSQL service
# Windows: Start from Services or pgAdmin
# macOS: brew services start postgresql
# Linux: sudo systemctl start postgresql

# Create database
createdb karbonica_db

# Or using psql:
psql -U postgres
CREATE DATABASE karbonica_db;
\q
```

## Step 3: Set Up Redis

### Install Redis
- **Windows**: Download from https://github.com/microsoftarchive/redis/releases or use WSL
- **macOS**: `brew install redis`
- **Linux**: `sudo apt-get install redis-server`

### Start Redis
```bash
# Windows: redis-server.exe
# macOS: brew services start redis
# Linux: sudo systemctl start redis
```

## Step 4: Configure Environment Variables

1. Copy the example environment file:
```bash
copy .env.example .env
```

2. Edit `.env` and update the following:

### Required Configuration
```env
# Database - Update with your PostgreSQL credentials
DB_PASSWORD=your_actual_password

# JWT Secret - Generate a secure random string (at least 32 characters)
JWT_SECRET=your_secure_jwt_secret_here_min_32_chars

# Blockfrost API Key (for Cardano integration)
# Get your free API key from https://blockfrost.io
BLOCKFROST_API_KEY=your_blockfrost_api_key
```

### Generate JWT Secret
You can generate a secure JWT secret using Node.js:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Step 5: Verify Setup

### Check Database Connection
```bash
psql -U postgres -d karbonica_db -c "SELECT version();"
```

### Check Redis Connection
```bash
redis-cli ping
# Should return: PONG
```

## Step 6: Run the Application

### Development Mode (with hot reload)
```bash
npm run dev
```

### Build and Run Production
```bash
npm run build
npm start
```

### Run Tests
```bash
npm test
```

## Step 7: Verify Installation

Once the application is running, test the health endpoint:
```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "services": {
    "database": {
      "status": "up"
    },
    "redis": {
      "status": "up"
    }
  }
}
```

## Troubleshooting

### Database Connection Issues
- Verify PostgreSQL is running
- Check database credentials in `.env`
- Ensure database `karbonica_db` exists
- Check firewall settings

### Redis Connection Issues
- Verify Redis is running: `redis-cli ping`
- Check Redis host and port in `.env`
- Ensure Redis is not password-protected (or set password in `.env`)

### Port Already in Use
If port 3000 is already in use, change the `PORT` in `.env`:
```env
PORT=3001
```

### Missing Dependencies
If you encounter module not found errors:
```bash
rm -rf node_modules package-lock.json
npm install
```

## Next Steps

After successful setup:
1. Review the requirements document: `.kiro/specs/karbonica-carbon-registry/requirements.md`
2. Review the design document: `.kiro/specs/karbonica-carbon-registry/design.md`
3. Check the implementation tasks: `.kiro/specs/karbonica-carbon-registry/tasks.md`
4. Proceed with Task 2: Implement database schema and migrations

## Development Tools

### Linting
```bash
npm run lint
```

### Code Formatting
```bash
npm run format
```

### Watch Mode for Tests
```bash
npm run test:watch
```

## Additional Resources

- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Redis Documentation](https://redis.io/documentation)
- [Express.js Documentation](https://expressjs.com/)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [Cardano Documentation](https://docs.cardano.org/)
- [Blockfrost API](https://docs.blockfrost.io/)
