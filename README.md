# Karbonica Carbon Credit Registry Platform

A production-grade carbon credit registry platform with Cardano blockchain integration.

## Features

- User registration and authentication with Cardano wallet integration
- Project registration and verification workflow
- Carbon credit issuance, transfer, and retirement
- Immutable blockchain records on Cardano Preview testnet
- Comprehensive audit logging and compliance
- Role-based access control (RBAC)

## Technology Stack

- **Backend**: Node.js with TypeScript
- **Database**: PostgreSQL
- **Cache**: Redis
- **Blockchain**: Cardano Preview testnet
- **API**: RESTful with Express.js

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL 14+
- Redis 6+
- Cardano wallet (for testing)

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy environment variables:
   ```bash
   copy .env.example .env
   ```

4. Configure your `.env` file with:
   - Database credentials
   - Redis connection details
   - JWT secret (generate a secure random string)
   - Blockfrost API key (get from https://blockfrost.io)

5. Set up PostgreSQL database:
   ```bash
   createdb karbonica_db
   ```

## Running the Application

### Development Mode
```bash
npm run dev
```

### Production Build
```bash
npm run build
npm start
```

### Testing
```bash
npm test
```

## Project Structure

```
src/
├── config/           # Configuration files
│   ├── index.ts      # Main config with environment validation
│   ├── database.ts   # PostgreSQL connection
│   └── redis.ts      # Redis connection
├── middleware/       # Express middleware
│   ├── errorHandler.ts
│   └── requestLogger.ts
├── routes/           # API routes
│   └── health.ts     # Health check endpoint
├── utils/            # Utility functions
│   └── logger.ts     # Structured logging
└── index.ts          # Application entry point
```

## API Endpoints

### Health Check
- `GET /health` - Check system health status

## Environment Variables

See `.env.example` for all available configuration options.

Key variables:
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` - Database configuration
- `REDIS_HOST`, `REDIS_PORT` - Redis configuration
- `JWT_SECRET` - Secret for JWT token signing
- `BLOCKFROST_API_KEY` - Cardano blockchain API key

## Logging

The application uses structured JSON logging with Winston. Logs include:
- Request/response logging with duration
- Authentication and authorization events
- Data access events
- Error tracking with stack traces

## Development

### Code Style
```bash
npm run lint
npm run format
```

### Database Migrations
Database migrations will be added in Phase 2 of the implementation.

## License

MIT
