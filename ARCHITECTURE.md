# Architecture Overview

## Project Structure

```
karbonica-carbon-registry/
├── src/
│   ├── config/              # Configuration and connections
│   │   ├── index.ts         # Environment config with validation
│   │   ├── database.ts      # PostgreSQL connection pool
│   │   └── redis.ts         # Redis client connection
│   ├── middleware/          # Express middleware
│   │   ├── errorHandler.ts # Global error handling
│   │   └── requestLogger.ts # HTTP request logging
│   ├── routes/              # API route handlers
│   │   └── health.ts        # Health check endpoint
│   ├── utils/               # Utility functions
│   │   └── logger.ts        # Structured logging with Winston
│   └── index.ts             # Application entry point
├── .env.example             # Environment variables template
├── .gitignore               # Git ignore rules
├── package.json             # Dependencies and scripts
├── tsconfig.json            # TypeScript configuration
├── vitest.config.ts         # Test configuration
├── README.md                # Project documentation    
├── SETUP.md                 # Setup instructions
└── ARCHITECTURE.md          # This file
```

## Technology Stack

### Core
- **Runtime**: Node.js 18+
- **Language**: TypeScript 5.3+
- **Framework**: Express.js 4.x

### Data Layer
- **Database**: PostgreSQL 14+ (ACID transactions, relational data)
- **Cache**: Redis 6+ (session storage, query caching)

### Security
- **Authentication**: JWT tokens (access + refresh)
- **Password Hashing**: bcrypt (cost factor 12)
- **Security Headers**: Helmet.js
- **CORS**: Configurable cross-origin policies

### Logging & Monitoring
- **Logger**: Winston (structured JSON logging)
- **Request Tracking**: UUID-based request IDs
- **Health Checks**: Database and Redis connectivity

### Development Tools
- **Build**: TypeScript compiler
- **Dev Server**: tsx with watch mode
- **Testing**: Vitest
- **Linting**: ESLint with TypeScript support
- **Formatting**: Prettier

## Configuration Management

### Environment Variables
All configuration is managed through environment variables with:
- **Validation**: Zod schema validation on startup
- **Type Safety**: Strongly typed config object
- **Defaults**: Sensible defaults for development
- **Security**: Secrets never committed to repository

### Configuration Layers
1. `.env.example` - Template with all available options
2. `.env` - Local environment (gitignored)
3. `src/config/index.ts` - Validated config object

## Database Connection

### Connection Pooling
- Min connections: 2
- Max connections: 10
- Idle timeout: 30 seconds
- Connection timeout: 5 seconds

### Health Checks
- Automatic connection testing on startup
- Health endpoint queries database status
- Error handling with automatic reconnection

## Redis Connection

### Features
- Automatic reconnection on failure
- Connection event logging
- Helper methods for common operations (get, set, del, exists)
- TTL support for cache expiration

### Use Cases
- Session storage
- Query result caching
- Rate limiting counters
- Temporary data storage

## Logging Strategy

### Log Levels
- **error**: Application errors, exceptions
- **warn**: Warning conditions, degraded performance
- **info**: General informational messages
- **debug**: Detailed debugging information

### Structured Logging
All logs include:
- Timestamp (ISO 8601)
- Log level
- Message
- Service name
- Environment
- Contextual metadata (userId, requestId, etc.)

### Log Types
1. **HTTP Requests**: Method, path, status, duration, userId
2. **Authentication**: Login attempts, success/failure
3. **Authorization**: Permission checks, access denials
4. **Data Access**: CRUD operations with resource details
5. **Errors**: Stack traces, error context

## Error Handling

### Error Types
- `ValidationError` (400): Invalid input data
- `AuthenticationError` (401): Missing or invalid credentials
- `AuthorizationError` (403): Insufficient permissions
- `NotFoundError` (404): Resource not found
- Generic errors (500): Unexpected server errors

### Error Response Format
```json
{
  "status": "error",
  "code": "ERROR_CODE",
  "title": "Error Name",
  "detail": "Detailed error message",
  "meta": {
    "timestamp": "2024-01-15T10:30:00.000Z",
    "requestId": "uuid"
  }
}
```

## Middleware Pipeline

1. **Helmet**: Security headers
2. **CORS**: Cross-origin resource sharing
3. **Body Parser**: JSON and URL-encoded parsing
4. **Request Logger**: HTTP request logging with timing
5. **Route Handlers**: Business logic
6. **Error Handler**: Global error handling and formatting

## Health Check Endpoint

### Endpoint
`GET /health`

### Response
```json
{
  "status": "healthy|unhealthy",
  "timestamp": "ISO 8601 timestamp",
  "services": {
    "database": { "status": "up|down" },
    "redis": { "status": "up|down" }
  }
}
```

### Status Codes
- `200`: All services healthy
- `503`: One or more services unhealthy

## Graceful Shutdown

The application handles shutdown signals:
- `SIGTERM`: Graceful shutdown (container orchestration)
- `SIGINT`: Graceful shutdown (Ctrl+C)

Shutdown process:
1. Stop accepting new requests
2. Close database connections
3. Close Redis connections
4. Exit process

## Development Workflow

### Local Development
```bash
npm run dev          # Start with hot reload
npm test             # Run tests once
npm run test:watch   # Run tests in watch mode
npm run lint         # Check code style
npm run format       # Format code
```

### Production Build
```bash
npm run build        # Compile TypeScript
npm start            # Run compiled code
```

## Next Steps

After completing Task 1 (project setup), the next tasks will add:
- Database schema and migrations (Task 2)
- User management and authentication (Tasks 3-6)
- Cardano wallet integration (Tasks 7-10)
- Role-based access control (Tasks 11-12)
- And more...

See `.kiro/specs/karbonica-carbon-registry/tasks.md` for the complete implementation plan.
