# Getting Started with Karbonica Carbon Registry

## Prerequisites

Before running the application, make sure you have:

1. **Node.js** (v18 or higher)
2. **PostgreSQL** (v14 or higher) - Running locally or accessible remotely
3. **Redis** - Already configured (Redis Cloud)

## Initial Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Your `.env` file is already configured with:
- ✅ Redis Cloud connection
- ✅ Local file storage
- ✅ PostgreSQL connection (localhost)
- ✅ Blockfrost API key for Cardano

**Important**: Make sure PostgreSQL is running on your machine!

### 3. Create Database

Connect to PostgreSQL and create the database:

```bash
# Using psql command line
psql -U postgres

# Then in psql:
CREATE DATABASE karbonica_db;
\q
```

Or if you prefer a one-liner:
```bash
psql -U postgres -c "CREATE DATABASE karbonica_db;"
```

## Database Migrations

### Check Migration Status
See which migrations have been applied and which are pending:

```bash
npm run migrate:status
```

### Apply Migrations (Run Pending Migrations)
This will create all the database tables, indexes, and constraints:

```bash
npm run migrate:up
```

**What this does:**
- Creates 12 tables (users, projects, credits, etc.)
- Creates 29+ indexes for performance
- Sets up foreign key constraints
- Creates partitioned audit_logs table
- Enables PostgreSQL extensions (uuid-ossp, postgis)

### Rollback Last Migration
If you need to undo the last migration:

```bash
npm run migrate:down
```

**Warning**: This will drop all tables and data!

## Running the Application

### Development Mode (with auto-reload)
```bash
npm run dev
```

This starts the server with hot-reload. Any changes to TypeScript files will automatically restart the server.

### Production Build
```bash
# Build TypeScript to JavaScript
npm run build

# Run the built application
npm start
```

### Run Tests
```bash
# Run all tests once
npm test

# Run tests in watch mode (for development)
npm run test:watch

# Run specific test file
npm test -- src/database/__tests__/schema.test.ts
```

## Available NPM Scripts

| Command                  | Description                              |
| ------------------------ | ---------------------------------------- |
| `npm run dev`            | Start development server with hot-reload |
| `npm run build`          | Compile TypeScript to JavaScript         |
| `npm start`              | Run production build                     |
| `npm test`               | Run all tests once                       |
| `npm run test:watch`     | Run tests in watch mode                  |
| `npm run migrate:up`     | Apply pending migrations                 |
| `npm run migrate:down`   | Rollback last migration                  |
| `npm run migrate:status` | Check migration status                   |
| `npm run lint`           | Run ESLint                               |
| `npm run format`         | Format code with Prettier                |

## First Time Setup - Complete Flow

Here's the complete sequence to get up and running:

```bash
# 1. Install dependencies
npm install

# 2. Make sure PostgreSQL is running
# Check if it's running (Windows):
# Services -> PostgreSQL should be running

# 3. Create the database
psql -U postgres -c "CREATE DATABASE karbonica_db;"

# 4. Run migrations to create tables
npm run migrate:up

# 5. Start the development server
npm run dev
```

## Verify Everything is Working

Once the server starts, you should see:

```
{"level":"info","message":"Database connected successfully",...}
{"level":"info","message":"Redis connected successfully",...}
{"level":"info","message":"Server started","port":3000,...}
```

### Test the Health Endpoint

Open your browser or use curl:
```bash
curl http://localhost:3000/health
```

You should get:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "services": {
    "database": "connected",
    "redis": "connected"
  }
}
```

## Common Issues & Solutions

### Issue: "password authentication failed for user postgres"

**Solution**: Update `DB_PASSWORD` in `.env` with your PostgreSQL password.

### Issue: "database karbonica_db does not exist"

**Solution**: Create the database first:
```bash
psql -U postgres -c "CREATE DATABASE karbonica_db;"
```

### Issue: "Cannot find module 'pg'"

**Solution**: Install dependencies:
```bash
npm install
```

### Issue: "ECONNREFUSED" for Redis

**Solution**: Your Redis Cloud connection is already configured. Make sure the credentials are correct in `.env`.

### Issue: "Port 3000 is already in use"

**Solution**: Either:
- Stop the other application using port 3000
- Change `PORT=3001` in `.env`

## Project Structure

```
karbonica-carbon-registry/
├── src/
│   ├── config/           # Configuration files
│   ├── database/         # Database migrations and utilities
│   │   ├── migrations/   # SQL migration files
│   │   └── __tests__/    # Database tests
│   ├── middleware/       # Express middleware
│   ├── routes/          # API routes
│   ├── utils/           # Utility functions
│   └── index.ts         # Application entry point
├── .env                 # Environment variables (DO NOT COMMIT)
├── package.json         # Dependencies and scripts
└── tsconfig.json        # TypeScript configuration
```

## Next Steps

After getting the application running:

1. **Explore the API**: Check available endpoints (currently just `/health`)
2. **Review the Schema**: Look at `src/database/migrations/001_initial_schema.sql`
3. **Run Tests**: `npm test` to verify everything works
4. **Start Building**: Implement the next tasks from the spec

## Development Workflow

1. Make changes to TypeScript files
2. Server auto-reloads (in dev mode)
3. Test your changes: `npm test`
4. Check for errors: `npm run lint`
5. Format code: `npm run format`

## Need Help?

- Check logs in the console for error messages
- Review `src/database/__tests__/README.md` for database-specific help
- Check `TASK-2-SUMMARY.md` for schema documentation

---

**Quick Start Command (All-in-One)**:
```bash
npm install && psql -U postgres -c "CREATE DATABASE karbonica_db;" && npm run migrate:up && npm run dev
```
