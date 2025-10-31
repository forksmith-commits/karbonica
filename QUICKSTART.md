# Quick Start Guide

Get the Karbonica platform running in 5 minutes!

## Prerequisites Check

Before starting, ensure you have:
- [ ] Node.js 18+ installed (`node --version`)
- [ ] PostgreSQL 14+ installed and running
- [ ] Redis 6+ installed and running

## Quick Setup

### 1. Install Dependencies (30 seconds)
```bash
npm install
```

### 2. Create Database (1 minute)
```bash
# Using psql
psql -U postgres
CREATE DATABASE karbonica_db;
\q

# Or using createdb command
createdb karbonica_db
```

### 3. Configure Environment (2 minutes)
```bash
# Copy the example file
copy .env.example .env
```

Edit `.env` and set these **required** values:
```env
DB_PASSWORD=your_postgres_password
JWT_SECRET=generate_a_secure_32_character_secret_here
```

**Generate JWT Secret:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Start the Application (30 seconds)
```bash
npm run dev
```

You should see:
```
[info]: Database connected successfully
[info]: Redis connected successfully
[info]: Server started { port: 3000, environment: 'development' }
```

### 5. Test It Works (30 seconds)
Open another terminal and run:
```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "services": {
    "database": { "status": "up" },
    "redis": { "status": "up" }
  }
}
```

## ✅ Success!

Your Karbonica platform is now running! 

## What's Next?

1. **Review the architecture**: Check `ARCHITECTURE.md`
2. **Read the setup guide**: See `SETUP.md` for detailed configuration
3. **Implement next task**: Open `.kiro/specs/karbonica-carbon-registry/tasks.md` and start Task 2

## Troubleshooting

### Database Connection Failed
```bash
# Check if PostgreSQL is running
# Windows: Check Services
# macOS: brew services list
# Linux: sudo systemctl status postgresql

# Verify database exists
psql -U postgres -l | grep karbonica_db
```

### Redis Connection Failed
```bash
# Check if Redis is running
redis-cli ping
# Should return: PONG

# Start Redis if not running
# Windows: redis-server.exe
# macOS: brew services start redis
# Linux: sudo systemctl start redis
```

### Port 3000 Already in Use
Change the port in `.env`:
```env
PORT=3001
```

## Development Commands

```bash
npm run dev          # Start with hot reload
npm test             # Run tests
npm run build        # Build for production
npm start            # Run production build
npm run lint         # Check code style
npm run format       # Format code
```

## Need Help?

- Check `SETUP.md` for detailed setup instructions
- Check `ARCHITECTURE.md` for technical details
- Review the requirements: `.kiro/specs/karbonica-carbon-registry/requirements.md`
- Review the design: `.kiro/specs/karbonica-carbon-registry/design.md`
