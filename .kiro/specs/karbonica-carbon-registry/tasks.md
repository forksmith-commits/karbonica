# Implementation Plan - Karbonica Carbon Credit Registry Platform

## Overview

This implementation plan breaks down the Karbonica platform development into discrete, manageable coding tasks. Each task builds incrementally on previous work, following industry-standard test-driven development practices. The plan includes comprehensive testing at all levels (unit, integration, E2E) as is standard for production-grade carbon credit platforms.

## Technology Stack

**Backend**:
- Language: TypeScript/Node.js (or Python/Java/C# - technology agnostic)
- Database: PostgreSQL
- Cache: Redis
- Storage: S3-compatible
- Blockchain: Cardano Preview testnet via Blockfrost API

**Frontend**:
- Framework: React with TypeScript
- UI Components: shadcn/ui
- Animations: 
  - anime.js for complex animations
  - Framer Motion for React animations
  - react-spring for physics-based animations
  - Animate UI (https://animate-ui.com) for Radix UI components
- Styling: Tailwind CSS (via shadcn/ui)
- State Management: Zustand or React Query
- Cardano Wallet: @cardano-foundation/cardano-connect-with-wallet

## Task Execution Notes

- All tasks reference specific requirements from requirements.md
- Each task should be completed before moving to the next
- Testing tasks are integrated throughout (industry standard)
- All context documents (requirements.md, design.md) are available during implementation

---

## Phase 1: Foundation and Infrastructure

- [x] 1. Set up project structure and core dependencies

  - Initialize project with chosen tech stack (Node.js/TypeScript, Python, Java, or C#)
  - Configure database connection (PostgreSQL recommended)
  - Set up environment configuration management
  - Configure logging framework with structured JSON output
  - Set up distributed cache connection (Redis)
  - _Requirements: 13.1, 13.2_

- [x] 2. Implement database schema and migrations

  - Create users table with indexes
  - Create projects table with indexes
  - Create verification_requests table with indexes
  - Create verification_documents table
  - Create verification_events table
  - Create credit_entries table with indexes
  - Create credit_transactions table with indexes
  - Create cardano_wallets table with indexes
  - Create blockchain_transactions table with indexes
  - Create audit_logs table with partitioning by month
  - Create sessions table
  - _Requirements: All requirements reference these tables_

- [x] 2.1 Write database migration tests

  - Test schema creation
  - Test index creation
  - Test foreign key constraints
  - Test rollback functionality
  - _Requirements: Testing strategy_

---

## Phase 2: User Management and Authentication

- [x] 3. Implement user registration

  - Create User entity with validation
  - Implement email validation (format, uniqueness)
  - Implement password hashing with bcrypt (cost factor 12)
  - Create user repository with save method
  - Implement email verification token generation
  - Create POST /api/v1/auth/register endpoint
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 3.1 Write user registration tests

  - Test email validation
  - Test password hashing
  - Test duplicate email rejection
  - Test successful registration flow
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 4. Implement email verification

  - Create email service interface
  - Implement email verification token validation
  - Create GET /api/v1/auth/verify-email endpoint
  - Update user email_verified status
  - _Requirements: 1.4_

- [x] 5. Implement basic authentication (email/password)

  - Create authentication service
  - Implement password verification
  - Implement JWT token generation (access token 15 min, refresh token 7 days)
  - Create POST /api/v1/auth/login endpoint (returns challenge)
  - Implement account lockout after 5 failed attempts
  - _Requirements: 1.5, 1.6, 1.7_

- [x] 5.1 Write authentication tests
  
  - Test valid login
  - Test invalid credentials
  - Test account lockout
  - Test token generation
  - _Requirements: 1.5, 1.6, 1.7_

- [x] 6. Implement session management

  - Create session entity and repository
  - Implement session creation on successful auth
  - Implement session validation middleware
  - Implement session expiration (30 min inactivity)
  - Create POST /api/v1/auth/logout endpoint
  - Create POST /api/v1/auth/refresh endpoint
  - _Requirements: 1.8_

---

## Phase 3: Cardano Wallet Integration

- [x] 7. Set up Cardano integration dependencies

  - Install cardano-serialization-lib or cardano-multiplatform-lib
  - Install blockfrost-js SDK
  - Configure Blockfrost API key for Preview testnet
  - Create Cardano configuration module
  - _Requirements: 15.1, 15.6_

- [x] 8. Implement Cardano wallet linking

  - Create CardanoWallet entity and repository
  - Implement Cardano address validation (Bech32, Preview testnet)
  - Implement Ed25519 signature verification using Cardano libraries
  - Create challenge message generation
  - Create POST /api/v1/users/me/wallet endpoint [TODO]
  - Validate wallet address uniqueness
  - _Requirements: 2.3, 2.4, 2.8, 2.9, 15.10_

- [ ]* 8.1 Write Cardano wallet linking tests
  - Test address validation
  - Test signature verification
  - Test duplicate wallet rejection
  - Test wallet linking flow
  - _Requirements: 2.3, 2.4, 2.8, 2.9_

- [x] 9. Implement Cardano wallet authentication

  - Create POST /auth/verify-wallet endpoint
  - Verify wallet signature against challenge
  - Match wallet address to user account
  - Generate and return JWT tokens on success
  - _Requirements: 2.1, 2.2, 2.3, 2.5, 2.6_

- [x] 10. Implement wallet unlinking
  
  - Create DELETE /api/v1/users/me/wallet endpoint
  - Remove wallet association from user
  - _Requirements: 2.10_

---

## Phase 4: Role-Based Access Control

- [x] 11. Implement authorization middleware


  - Create authorization middleware for role checking
  - Implement permission validation based on user role
  - Create permission constants for each resource/action
  - _Requirements: 8.1-8.11_

- [x] 11.1 Write authorization tests

  - Test developer permissions
  - Test verifier permissions
  - Test administrator permissions
  - Test buyer permissions
  - Test unauthorized access rejection
  - _Requirements: 8.1-8.11_

- [ ] 12. Implement row-level security helpers



  - Create query filters for user-owned resources
  - Implement developer project access filter
  - Implement verifier verification access filter
  - Implement credit ownership filter
  - _Requirements: 8.2, 8.5, 8.6_

---

## Phase 5: Project Management

- [x] 13. Implement project registration

  - Create Project entity with validation
  - Implement project type enumeration
  - Implement emissions target validation (positive, < 10M)
  - Implement country code validation (ISO 3166-1)
  - Create project repository
  - Create POST /api/v1/projects endpoint
  - Set project status to "pending"
  - Assign current user as developer
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [ ] 13.1 Write project registration tests

  - Test valid project creation
  - Test emissions target validation
  - Test country code validation
  - Test project type validation
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 14. Implement project document upload

  - Create ProjectDocument entity
  - Integrate with S3-compatible storage service (Changed to SUPABASE's storage service)
  - Implement file upload with virus scanning
  - Create POST /api/v1/projects/:id/documents endpoint
  - Store document metadata in database
  - _Requirements: 3.10, 16.3, 16.4_

- [x] 15. Implement project retrieval and listing

  - Create GET /api/v1/projects/:id endpoint
  - Create GET /api/v1/projects endpoint with pagination
  - Implement cursor-based pagination
  - Implement filtering by status, type
  - Implement sorting
  - Apply row-level security (developers see own, buyers see verified)
  - _Requirements: 8.2, 10.9, 10.10, 10.11_

- [x] 16. Implement project update and deletion

  - Create PATCH /api/v1/projects/:id endpoint
  - Validate project is in "pending" status before allowing updates
  - Create DELETE /api/v1/projects/:id endpoint
  - Validate only developer can update/delete own projects
  - _Requirements: 3.8, 8.3, 8.4_

---

## Phase 6: Verification Workflow

- [x] 17. Implement verification request creation

  - Create VerificationRequest entity
  - Automatically create verification request when project is created
  - Set status to "pending" and progress to 0%
  - Link verification to project
  - _Requirements: 3.7, 4.2_

- [x] 18. Implement verifier assignment

  - Create POST /api/v1/verifications/:id/assign endpoint
  - Validate user is administrator
  - Update verification status to "in_review"
  - Update progress to 30%
  - Send notification to verifier A
  - Create timeline event
  - _Requirements: 4.1, 4.3, 8.7_

- [x] 19. Implement verification document upload
  
  - Create VerificationDocument entity
  - Create POST /api/v1/verifications/:id/documents endpoint
  - Upload file to storage
  - Store document metadata with uploader ID
  - Create timeline event
  - _Requirements: 4.4, 4.10_

- [x] 20. Implement verification timeline

  - Create VerificationEvent entity
  - Create POST /api/v1/verifications/:id/timeline endpoint
  - Create GET /api/v1/verifications/:id/timeline endpoint
  - Record timestamp, event type, message, user ID
  - _Requirements: 4.5, 4.10_

- [x] 21. Implement verification approval

  - Create POST /api/v1/verifications/:id/approve endpoint
  - Validate user is assigned verifier or administrator
  - Validate at least 3 documents are present
  - Update verification status to "approved"
  - Update progress to 100%
  - Update project status to "verified"
  - Create timeline event
  - _Requirements: 4.6, 4.7, 4.11, 8.8_

- [x] 22. Implement verification rejection

  - Create POST /api/v1/verifications/:id/reject endpoint
  - Require rejection reason
  - Update verification status to "rejected"
  - Update progress to 100%
  - Create timeline event
  - Send notification to developer
  - _Requirements: 4.8, 4.11_

- [x] 23. Implement verification listing and retrieval

  - Create GET /api/v1/verifications endpoint
  - Create GET /api/v1/verifications/:id endpoint
  - Apply row-level security (verifiers see assigned, developers see own)
  - Implement pagination and filtering
  - _Requirements: 4.11, 8.5, 8.6_

- [ ]* 23.1 Write verification workflow tests
  - Test verification creation
  - Test verifier assignment
  - Test document upload
  - Test approval with insufficient documents (should fail)
  - Test approval with sufficient documents
  - Test rejection
  - _Requirements: 4.1-4.11_

---

## Phase 7: Carbon Credit Issuance

- [x] 24. Implement credit issuance on verification approval

  - Create CreditEntry entity
  - Generate unique serial number (format: KRB-YYYY-XXX-NNNNNN)
  - Set quantity equal to project emissions target
  - Set owner to project developer
  - Set status to "active"
  - Set vintage to current year
  - Create credit transaction record with type "issuance"
  - Trigger on verification approval
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.8_

- [ ]* 24.1 Write credit issuance tests
  - Test credit creation on approval
  - Test serial number generation
  - Test quantity matches emissions target
  - Test owner is developer
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 25. Implement credit retrieval and listing

  - Create GET /api/v1/credits/:id endpoint
  - Create GET /api/v1/credits endpoint
  - Create GET /api/v1/users/:userId/credits endpoint
  - Apply row-level security (users see own credits)
  - Implement pagination and filtering by status, vintage
  - _Requirements: 8.9, 10.9_

---

## Phase 8: Cardano Blockchain Integration

- [x] 26. Implement platform wallet management

  - Create secure vault integration (AWS KMS, Azure Key Vault, or HashiCorp Vault)
  - Store platform wallet private key in vault
  - Implement wallet key retrieval with proper access controls
  - Create utility to check platform wallet balance
  - _Requirements: 15.2, 15.18_

- [x] 27. Implement Cardano transaction building
  - Create CardanoTransactionService
  - Implement transaction builder using cardano-serialization-lib
  - Implement protocol parameters fetching from Blockfrost
  - Implement UTxO selection for platform wallet
  - Implement transaction fee calculation
  - Implement CIP-20 metadata formatting
  - _Requirements: 15.3, 15.4, 15.5, 15.6_

- [ ]* 27.1 Write transaction building tests
  - Test metadata formatting
  - Test fee calculation
  - Test UTxO selection
  - _Requirements: 15.3, 15.4, 15.5_

- [x] 28. Implement Cardano transaction signing and submission
  - Implement Ed25519 transaction signing with platform wallet
  - Implement Blockfrost API client for transaction submission
  - Create BlockchainTransaction entity and repository
  - Store transaction hash, status "pending", submission timestamp
  - Implement rate limiting for Blockfrost API (50 req/sec)
  - _Requirements: 15.7, 15.8, 15.9, 15.16_

- [x] 29. Implement Cardano transaction monitoring
  - Implement transaction status polling (every 20 seconds)
  - Check for 6 confirmations
  - Update blockchain transaction status to "confirmed"
  - Store block number and block hash
  - Implement timeout handling (> 10 minutes)
  - _Requirements: 15.10, 15.11, 15.12, 15.13_

- [x] 30. Implement Cardano error handling and retry logic

  - Implement exponential backoff retry (max 3 attempts)
  - Handle transaction failures
  - Implement fallback mode when Blockfrost unavailable
  - Queue failed transactions for manual review
  - Implement alerting for blockchain issues
  - _Requirements: 15.14, 15.15, 15.17_

- [ ]* 30.1 Write Cardano integration tests
  - Test transaction submission to Preview testnet
  - Test transaction monitoring
  - Test retry logic
  - Test fallback mode
  - _Requirements: 15.7-15.17_

---

## Phase 9: Credit Transfer Operations

- [x] 31. Implement credit transfer

  - Create POST /api/v1/credits/:id/transfer endpoint
  - Validate user owns credits
  - Validate transfer quantity (positive, <= owned)
  - Validate credit status is "active"
  - Validate recipient user exists
  - Use serializable transaction isolation
  - Lock credit record FOR UPDATE
  - Update credit owner to recipient
  - Update credit status to "transferred"
  - Create credit transaction record with type "transfer"
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_

- [x] 32. Optionally record credit transfer on Cardano

  - Build Cardano transaction with transfer metadata
  - Submit to Cardano Preview testnet
  - Store transaction hash
  - Monitor for confirmation
  - _Requirements: 15.14_

- [ ]* 32.1 Write credit transfer tests
  - Test valid transfer
  - Test insufficient quantity rejection
  - Test non-owner rejection
  - Test invalid recipient rejection
  - Test transaction rollback on error
  - _Requirements: 6.1-6.12_

- [x] 33. Implement credit transaction history

  - Create GET /api/v1/credits/:id/transactions endpoint
  - Return all transactions for a credit
  - Include blockchain transaction hash if available
  - _Requirements: Transaction tracking_

---

## Phase 10: Credit Retirement with Cardano Recording

- [ ] 34. Implement credit retirement


  - Create POST /api/v1/credits/:id/retire endpoint
  - Validate user owns credits
  - Validate retirement quantity (positive, <= owned)
  - Validate credit status is "active"
  - Require retirement reason
  - Use serializable transaction isolation
  - Lock credit record FOR UPDATE
  - Update credit status to "retired"
  - Create credit transaction record with type "retirement"
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8_

- [ ] 35. Implement Cardano retirement recording
  - Build Cardano transaction with CIP-20 retirement metadata
  - Include credit_id, project_id, quantity, vintage, retired_by, reason, timestamp
  - Sign transaction with platform wallet
  - Submit to Cardano Preview testnet
  - Store transaction hash in credit transaction record
  - Monitor for 6 confirmations
  - Update blockchain transaction status
  - _Requirements: 7.9, 7.10, 7.11, 7.12, 7.13, 7.14_

- [ ] 36. Implement retirement certificate generation
  - Generate retirement certificate with certificate ID
  - Include Cardano transaction hash
  - Include Cardano Preview explorer link (preview.cardanoscan.io)
  - Return certificate in API response
  - _Requirements: 7.18, 15.15, 15.20_

- [ ]* 36.1 Write credit retirement tests
  - Test valid retirement
  - Test insufficient quantity rejection
  - Test non-owner rejection
  - Test Cardano transaction submission
  - Test certificate generation
  - _Requirements: 7.1-7.20_

---

## Phase 11: Audit Logging and Compliance

- [ ] 37. Implement audit logging service
  - Create AuditLog entity and repository
  - Implement audit log creation with structured format
  - Log authentication attempts (success/failure)
  - Log authorization failures
  - Log data access (read/write/delete)
  - Log configuration changes
  - Include timestamp, event type, user ID, IP address, user agent
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_

- [ ] 38. Integrate audit logging throughout application
  - Add audit logging to authentication endpoints
  - Add audit logging to project operations
  - Add audit logging to verification operations
  - Add audit logging to credit operations
  - Add audit logging to Cardano transactions
  - _Requirements: 9.1-9.8, 7.20_

- [ ] 39. Implement audit log querying
  - Create GET /api/v1/audit-logs endpoint
  - Implement filtering by user, resource, event type, date range
  - Implement pagination
  - Restrict access to administrators
  - _Requirements: 9.9_

- [ ]* 39.1 Write audit logging tests
  - Test authentication logging
  - Test authorization failure logging
  - Test data change logging
  - Test audit log querying
  - _Requirements: 9.1-9.9_

---

## Phase 12: Event-Driven Architecture

- [ ] 40. Implement domain events
  - Create event publisher interface
  - Create domain event classes (ProjectRegistered, VerificationApproved, CreditsIssued, etc.)
  - Publish events after successful operations
  - _Requirements: Event-driven architecture from design_

- [ ] 41. Implement event handlers
  - Create event handler for ProjectRegistered (create verification request)
  - Create event handler for VerificationApproved (issue credits, send notifications)
  - Create event handler for CreditsIssued (send notification, update analytics)
  - Create event handler for CreditsTransferred (send notifications)
  - Create event handler for CreditsRetired (send notification)
  - _Requirements: Event handlers from design_

- [ ]* 41.1 Write event handling tests
  - Test event publishing
  - Test event handler execution
  - Test verification request creation on project registration
  - Test credit issuance on verification approval
  - _Requirements: Event-driven architecture_

---

## Phase 13: API Error Handling and Validation

- [ ] 42. Implement standardized error responses
  - Create error response formatter
  - Implement error codes (VALIDATION_ERROR, AUTHENTICATION_ERROR, etc.)
  - Return structured error responses with status, code, title, detail, source
  - Include request ID and trace ID in error responses
  - _Requirements: 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9, 10.12_

- [ ] 43. Implement input validation middleware
  - Create validation middleware for request bodies
  - Validate required fields
  - Validate field types and formats
  - Validate field lengths
  - Validate business rules
  - Return 400 Bad Request with field-specific errors
  - _Requirements: 10.1, 10.5_

- [ ]* 43.1 Write error handling tests
  - Test validation error responses
  - Test authentication error responses
  - Test authorization error responses
  - Test not found error responses
  - _Requirements: 10.3-10.9_

---

## Phase 14: Notification System

- [ ] 44. Implement notification service
  - Create notification service interface
  - Integrate with email service provider
  - Implement email templates for key events
  - Implement retry logic for failed email delivery
  - Queue failed emails for manual processing
  - _Requirements: 16.1, 16.2_

- [ ] 45. Implement notification triggers
  - Send email on user registration (verification link)
  - Send email on verifier assignment
  - Send email on verification approval/rejection
  - Send email on credit issuance
  - Send email on credit transfer (both parties)
  - Send email on credit retirement
  - _Requirements: 1.3, 4.1, 4.11, 5.7, 6.10, 7.19_

- [ ]* 45.1 Write notification tests
  - Test email sending
  - Test retry logic
  - Test notification triggers
  - _Requirements: 16.1, 16.2_

---

## Phase 15: Performance Optimization

- [ ] 46. Implement caching layer
  - Set up Redis cache connection
  - Implement cache-aside pattern for user profiles
  - Implement cache-aside pattern for project metadata
  - Implement cache-aside pattern for query results
  - Set TTL to 15 minutes for L2 cache
  - Implement cache invalidation on data changes
  - _Requirements: 12.7, 12.8_

- [ ] 47. Implement database query optimization
  - Add indexes on foreign keys
  - Add indexes on frequently queried columns (status, type, owner_id)
  - Optimize N+1 queries with eager loading
  - Implement connection pooling
  - _Requirements: 12.1, 12.2_

- [ ] 48. Implement API response optimization
  - Implement gzip compression for responses
  - Implement ETag support for conditional requests
  - Optimize pagination queries
  - Implement field filtering (sparse fieldsets)
  - _Requirements: 12.1, 12.2, 10.11_

- [ ]* 48.1 Write performance tests
  - Test API response times
  - Test cache hit rates
  - Test database query performance
  - _Requirements: 12.1-12.10_

---

## Phase 16: Monitoring and Observability

- [ ] 49. Implement structured logging
  - Configure structured JSON logging
  - Include trace ID, span ID, user ID in all logs
  - Log all API requests with duration
  - Log all database queries with duration
  - Log all external service calls
  - _Requirements: 13.1, 13.2_

- [ ] 50. Implement distributed tracing
  - Integrate distributed tracing library (Jaeger, Zipkin, or cloud provider)
  - Generate trace ID for each request
  - Propagate trace ID across service calls
  - Create spans for major operations
  - _Requirements: 13.2, 13.3_

- [ ] 51. Implement metrics collection
  - Integrate metrics library (Prometheus, CloudWatch, or Datadog)
  - Collect request rate, error rate, response time
  - Collect database connection pool metrics
  - Collect cache hit rate
  - Collect Cardano transaction metrics
  - _Requirements: 13.2, 13.5_

- [ ] 52. Implement health check endpoints
  - Create GET /health endpoint
  - Check database connectivity
  - Check cache connectivity
  - Check storage service connectivity
  - Check Blockfrost API connectivity
  - Return overall health status
  - _Requirements: 13.4, 13.5, 13.6_

- [ ] 53. Implement alerting
  - Configure alerts for error rate > 5%
  - Configure alerts for response time p99 > 5s
  - Configure alerts for service down
  - Configure alerts for Cardano transaction timeout
  - Configure alerts for platform wallet balance low
  - _Requirements: 13.7, 13.8, 15.13, 15.18_

- [ ]* 53.1 Write monitoring tests
  - Test health check endpoint
  - Test metrics collection
  - Test log formatting
  - _Requirements: 13.1-13.10_

---

## Phase 17: Security Hardening

- [ ] 54. Implement rate limiting
  - Implement rate limiting middleware
  - Set limit to 100 requests/minute per user
  - Set limit to 1000 requests/minute per IP
  - Return 429 Too Many Requests when exceeded
  - _Requirements: API security from design_

- [ ] 55. Implement CORS policy
  - Configure CORS middleware
  - Restrict allowed origins
  - Restrict allowed methods
  - Restrict allowed headers
  - _Requirements: API security from design_

- [ ] 56. Implement Content Security Policy
  - Configure CSP headers
  - Prevent XSS attacks
  - Restrict script sources
  - _Requirements: Security from design_

- [ ] 57. Implement input sanitization
  - Sanitize all user inputs
  - Use parameterized queries for database
  - Encode outputs based on context (HTML, JSON, URL)
  - _Requirements: 11.1, 11.2_

- [ ]* 57.1 Write security tests
  - Test rate limiting
  - Test CORS policy
  - Test SQL injection prevention
  - Test XSS prevention
  - _Requirements: 11.1, 11.2, 11.3_

---

## Phase 18: Testing and Quality Assurance

- [ ]* 58. Write integration tests for complete workflows
  - Test user registration and email verification flow
  - Test login with Cardano wallet authentication flow
  - Test project registration and verification approval flow
  - Test credit issuance on verification approval
  - Test credit transfer flow
  - Test credit retirement with Cardano recording flow
  - _Requirements: All requirements_

- [ ]* 59. Write end-to-end tests
  - Test complete user journey from registration to credit retirement
  - Test verifier workflow from assignment to approval
  - Test administrator operations
  - _Requirements: All requirements_

- [ ]* 60. Perform load testing
  - Test API with 1000 requests/second
  - Verify p95 response time < 500ms
  - Verify p99 response time < 1s
  - Verify 99.9% success rate
  - _Requirements: 12.1, 12.2, 12.3, 12.4_

- [ ]* 61. Perform security testing
  - Test for SQL injection vulnerabilities
  - Test for XSS vulnerabilities
  - Test for CSRF vulnerabilities
  - Test authentication bypass attempts
  - Test authorization escalation attempts
  - _Requirements: 11.1, 11.2, 11.3_

---

## Phase 19: Documentation and Deployment

- [ ] 62. Create API documentation
  - Document all API endpoints with request/response examples
  - Document authentication flow
  - Document error codes and responses
  - Document pagination, filtering, and sorting
  - Generate OpenAPI/Swagger specification
  - _Requirements: 10.1-10.12_

- [ ] 63. Create deployment documentation
  - Document environment variables and configuration
  - Document database setup and migrations
  - Document Cardano wallet setup
  - Document Blockfrost API key configuration
  - Document monitoring and alerting setup
  - _Requirements: Deployment from design_

- [ ] 64. Set up CI/CD pipeline
  - Configure automated testing on commit
  - Configure security scanning
  - Configure container build
  - Configure deployment to staging
  - Configure deployment to production with approval
  - _Requirements: Deployment from design_

- [ ] 65. Deploy to staging environment
  - Deploy application to staging
  - Run database migrations
  - Configure Cardano Preview testnet connection
  - Run smoke tests
  - Verify health checks
  - _Requirements: Deployment from design_

- [ ] 66. Deploy to production environment
  - Deploy application to production
  - Run database migrations
  - Configure production monitoring
  - Configure production alerting
  - Verify health checks
  - _Requirements: Deployment from design_

---

## Completion Checklist

After completing all tasks, verify:

- [ ] All API endpoints are functional and documented
- [ ] All database tables are created with proper indexes
- [ ] User registration and authentication work end-to-end
- [ ] Cardano wallet linking and verification work
- [ ] Project registration and verification workflow complete
- [ ] Credit issuance happens automatically on verification approval
- [ ] Credit transfers work with proper validation
- [ ] Credit retirements are recorded on Cardano Preview testnet
- [ ] Audit logs capture all important events
- [ ] Error handling is consistent across all endpoints
- [ ] Performance meets SLA targets (p95 < 500ms)
- [ ] Security controls are in place (rate limiting, CORS, input validation)
- [ ] Monitoring and alerting are configured
- [ ] Documentation is complete
- [ ] Application is deployed and operational

---

**Total Tasks**: 66 main tasks + 21 optional testing tasks
**Estimated Timeline**: 12-16 weeks for full implementation with a team of 2-3 developers
**Priority**: Core functionality tasks should be completed first, optional testing tasks can be done in parallel or deferred for MVP


---

## Phase 20: Frontend Foundation

- [ ] 67. Set up React frontend project
  - Initialize React project with Vite and TypeScript
  - Configure Tailwind CSS
  - Install and configure shadcn/ui
  - Install animation libraries (anime.js, framer-motion, react-spring)
  - Install Animate UI for Radix components
  - Configure routing (React Router)
  - Configure environment variables
  - _Requirements: Frontend architecture_

- [ ] 68. Set up frontend state management
  - Install and configure Zustand or React Query
  - Create API client with axios or fetch
  - Configure API base URL and interceptors
  - Implement token storage and refresh logic
  - _Requirements: Frontend architecture_

- [ ] 69. Create design system and theme
  - Configure Tailwind theme colors (carbon credit green theme)
  - Create typography scale
  - Create spacing scale
  - Create animation presets
  - Create reusable component variants
  - _Requirements: UI/UX design_

- [ ] 70. Implement layout components
  - Create AppLayout with header, sidebar, main content
  - Create Header component with navigation and user menu
  - Create Sidebar component with role-based navigation
  - Create Footer component
  - Implement responsive design (mobile, tablet, desktop)
  - Add smooth page transitions with Framer Motion
  - _Requirements: UI/UX design_

---

## Phase 21: Authentication UI

- [ ] 71. Implement registration page
  - Create registration form with shadcn/ui Form components
  - Implement email, password, name, company, role fields
  - Add form validation with zod
  - Implement password strength indicator
  - Add animated form transitions with anime.js
  - Handle registration API call
  - Show success message and redirect to email verification
  - _Requirements: 1.1, 1.2, 1.3_

- [ ] 72. Implement email verification page
  - Create email verification confirmation page
  - Handle verification token from URL
  - Call verification API endpoint
  - Show success/error message with animations
  - Redirect to login on success
  - _Requirements: 1.4_

- [ ] 73. Implement login page
  - Create login form with email and password
  - Add form validation
  - Handle login API call (returns challenge)
  - Show animated loading state
  - Transition to wallet connection on success
  - _Requirements: 1.5_

- [ ] 74. Implement Cardano wallet connection
  - Install @cardano-foundation/cardano-connect-with-wallet
  - Create wallet connection modal with Animate UI
  - Support Nami, Eternl, Flint, Lace wallets
  - Request wallet signature for challenge
  - Call verify-wallet API endpoint
  - Store JWT tokens securely
  - Redirect to dashboard on success
  - Add smooth wallet connection animations
  - _Requirements: 2.1, 2.2, 2.3, 2.5, 2.6, 2.10_

- [ ] 75. Implement protected routes
  - Create ProtectedRoute component
  - Check authentication status
  - Redirect to login if not authenticated
  - Implement role-based route protection
  - _Requirements: 8.1-8.11_

- [ ] 76. Write authentication UI tests
  - Test registration form validation
  - Test login flow
  - Test wallet connection flow
  - Test protected route behavior
  - _Requirements: 1.1-1.8, 2.1-2.10_

---

## Phase 22: Dashboard and User Profile

- [ ] 77. Implement dashboard page
  - Create dashboard layout with stats cards
  - Show user's projects count
  - Show user's credits balance
  - Show recent activity timeline
  - Add animated counters with react-spring
  - Add chart visualizations (recharts or visx)
  - Implement role-specific dashboard views
  - _Requirements: User experience_

- [ ] 78. Implement user profile page
  - Create profile view with user information
  - Show linked Cardano wallet address
  - Create profile edit form
  - Implement wallet linking/unlinking
  - Add profile update animations
  - _Requirements: User management_

- [ ] 79. Write dashboard and profile tests
  - Test dashboard rendering
  - Test stats calculations
  - Test profile editing
  - Test wallet linking
  - _Requirements: User management_

---

## Phase 23: Project Management UI

- [ ] 80. Implement project list page
  - Create project list with shadcn/ui Table or Card grid
  - Implement pagination with shadcn/ui Pagination
  - Implement filtering by status, type
  - Implement sorting
  - Add search functionality
  - Show project cards with animations on hover
  - Implement role-based filtering (developers see own, buyers see verified)
  - _Requirements: 3.9, 8.2, 10.9, 10.10, 10.11_

- [ ] 81. Implement project detail page
  - Create project detail view with tabs (Overview, Documents, Verification, Credits)
  - Show project information
  - Show project documents list
  - Show verification status with progress indicator
  - Show issued credits
  - Add animated progress bar with Framer Motion
  - Implement role-based actions (edit, delete for developers)
  - _Requirements: 3.1-3.10_

- [ ] 82. Implement project creation page
  - Create project creation form with multi-step wizard
  - Implement form steps: Basic Info, Location, Emissions, Documents
  - Add form validation with zod
  - Implement country selector with search
  - Implement project type selector
  - Add animated step transitions
  - Handle project creation API call
  - Show success animation and redirect
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [ ] 83. Implement project document upload
  - Create document upload component with drag-and-drop
  - Show upload progress with animated progress bar
  - Implement file type and size validation
  - Show uploaded documents list
  - Implement document delete functionality
  - Add upload animations with anime.js
  - _Requirements: 3.10_

- [ ] 84. Implement project edit page
  - Create project edit form (similar to creation)
  - Pre-fill form with existing data
  - Validate project is in "pending" status
  - Handle project update API call
  - Show success message
  - _Requirements: 3.8, 8.3_

- [ ] 85. Write project management UI tests
  - Test project list rendering and filtering
  - Test project creation flow
  - Test document upload
  - Test project editing
  - Test role-based access
  - _Requirements: 3.1-3.10_

---

## Phase 24: Verification Workflow UI

- [ ] 86. Implement verification list page (verifier view)
  - Create verification list with status badges
  - Implement filtering by status
  - Show assigned verifications for verifiers
  - Show all verifications for administrators
  - Add status badge animations
  - _Requirements: 4.11, 8.5, 8.6_

- [ ] 87. Implement verification detail page
  - Create verification detail view with tabs (Documents, Timeline, Comments)
  - Show verification information and progress
  - Show project details
  - Show uploaded documents with preview
  - Show timeline events with animated timeline component
  - Implement document upload for verifiers
  - Implement timeline event creation
  - Add animated progress indicator
  - _Requirements: 4.4, 4.5, 4.10_

- [ ] 88. Implement verification approval/rejection
  - Create approval modal with confirmation
  - Validate minimum 3 documents present
  - Create rejection modal with reason input
  - Handle approve/reject API calls
  - Show success animation
  - Update verification status with smooth transition
  - _Requirements: 4.6, 4.7, 4.8_

- [ ] 89. Implement verifier assignment (admin view)
  - Create verifier assignment modal
  - Show list of available verifiers
  - Handle assignment API call
  - Show success notification
  - _Requirements: 4.1, 8.7_

- [ ] 90. Write verification UI tests
  - Test verification list rendering
  - Test document upload
  - Test approval flow
  - Test rejection flow
  - Test verifier assignment
  - _Requirements: 4.1-4.11_

---

## Phase 25: Credit Management UI

- [ ] 91. Implement credit list page
  - Create credit list with shadcn/ui Table
  - Show credit serial number, quantity, vintage, status
  - Implement filtering by status, vintage
  - Implement pagination
  - Show user's own credits
  - Add animated credit cards with hover effects
  - _Requirements: 8.9, 10.9_

- [ ] 92. Implement credit detail page
  - Create credit detail view
  - Show credit information
  - Show project details
  - Show transaction history with animated timeline
  - Show Cardano transaction links
  - Implement transfer and retire actions
  - _Requirements: Credit management_

- [ ] 93. Implement credit transfer modal
  - Create transfer modal with recipient selection
  - Implement quantity input with validation
  - Show transfer preview
  - Handle transfer API call
  - Show success animation with confetti effect
  - Update credit list
  - _Requirements: 6.1-6.12_

- [ ] 94. Implement credit retirement modal
  - Create retirement modal with reason input
  - Implement quantity input with validation
  - Show retirement preview
  - Handle retirement API call
  - Show Cardano transaction submission progress
  - Display retirement certificate with download option
  - Add celebration animation on success
  - Show Cardano Preview explorer link
  - _Requirements: 7.1-7.20, 15.15, 15.20_

- [ ] 95. Implement retirement certificate view
  - Create retirement certificate component
  - Show certificate details (ID, credit info, Cardano tx hash)
  - Implement certificate download as PDF
  - Add Cardano Preview explorer link
  - Style certificate with professional design
  - _Requirements: 7.18, 15.15, 15.20_

- [ ] 96. Write credit management UI tests
  - Test credit list rendering
  - Test credit transfer flow
  - Test credit retirement flow
  - Test certificate generation
  - _Requirements: 6.1-6.12, 7.1-7.20_

---

## Phase 26: Admin Panel

- [ ] 97. Implement admin dashboard
  - Create admin-specific dashboard
  - Show platform statistics (total projects, verifications, credits)
  - Show recent activity across all users
  - Add animated charts and graphs
  - Implement real-time updates
  - _Requirements: Administrator role_

- [ ] 98. Implement user management page (admin)
  - Create user list with search and filtering
  - Show user roles and status
  - Implement user role change functionality
  - Implement user account lock/unlock
  - Add user activity view
  - _Requirements: 8.11_

- [ ] 99. Implement audit log viewer (admin)
  - Create audit log list with advanced filtering
  - Filter by user, resource, event type, date range
  - Implement log detail view
  - Add log export functionality
  - _Requirements: 9.1-9.9_

- [ ] 100. Write admin panel tests
  - Test admin dashboard rendering
  - Test user management
  - Test audit log viewing
  - Test role-based access
  - _Requirements: 8.11, 9.1-9.9_

---

## Phase 27: Notifications and Real-time Updates

- [ ] 101. Implement notification system
  - Create notification dropdown in header
  - Show unread notification count with animated badge
  - Implement notification list with mark as read
  - Add notification sound/toast for new notifications
  - Implement WebSocket connection for real-time notifications
  - Add notification animations with Framer Motion
  - _Requirements: Notification system_

- [ ] 102. Implement toast notifications
  - Create toast notification component with shadcn/ui Toast
  - Show success, error, warning, info toasts
  - Add animated toast entrance/exit
  - Implement toast queue management
  - _Requirements: User experience_

- [ ] 103. Write notification tests
  - Test notification rendering
  - Test mark as read functionality
  - Test real-time updates
  - Test toast notifications
  - _Requirements: Notification system_

---

## Phase 28: Advanced UI Features

- [ ] 104. Implement search functionality
  - Create global search component with Command palette (shadcn/ui Command)
  - Implement keyboard shortcuts (Cmd+K / Ctrl+K)
  - Search across projects, credits, users
  - Add animated search results
  - Implement search history
  - _Requirements: User experience_

- [ ] 105. Implement data visualization
  - Create charts for credit issuance over time
  - Create charts for project types distribution
  - Create charts for verification status
  - Add animated chart transitions with react-spring
  - Implement interactive tooltips
  - _Requirements: Analytics and reporting_

- [ ] 106. Implement export functionality
  - Add export buttons to lists (CSV, PDF)
  - Implement project report export
  - Implement credit transaction history export
  - Add loading animations during export
  - _Requirements: Reporting_

- [ ] 107. Implement dark mode
  - Configure dark mode theme with Tailwind
  - Create theme toggle component
  - Persist theme preference
  - Add smooth theme transition animations
  - _Requirements: User experience_

- [ ] 108. Implement accessibility features
  - Add ARIA labels to all interactive elements
  - Implement keyboard navigation
  - Add focus indicators
  - Test with screen readers
  - Ensure WCAG 2.1 AA compliance
  - _Requirements: Accessibility_

- [ ] 109. Write advanced UI feature tests
  - Test search functionality
  - Test data visualization
  - Test export functionality
  - Test dark mode
  - Test accessibility
  - _Requirements: User experience_

---

## Phase 29: Performance Optimization (Frontend)

- [ ] 110. Implement code splitting
  - Split routes with React.lazy
  - Implement component lazy loading
  - Add loading skeletons with animated placeholders
  - Optimize bundle size
  - _Requirements: 12.1, 12.2_

- [ ] 111. Implement image optimization
  - Use next-gen image formats (WebP, AVIF)
  - Implement lazy loading for images
  - Add image placeholders with blur effect
  - Optimize image sizes
  - _Requirements: Performance_

- [ ] 112. Implement caching strategies
  - Configure React Query caching
  - Implement optimistic updates
  - Add stale-while-revalidate strategy
  - Cache API responses
  - _Requirements: 12.7, 12.8_

- [ ] 113. Optimize animations
  - Use CSS transforms for better performance
  - Implement will-change for animated elements
  - Reduce animation complexity on low-end devices
  - Add reduced motion support
  - _Requirements: Performance_

- [ ] 114. Write frontend performance tests
  - Test page load times
  - Test Time to Interactive (TTI)
  - Test First Contentful Paint (FCP)
  - Test Largest Contentful Paint (LCP)
  - Test Cumulative Layout Shift (CLS)
  - _Requirements: 12.1, 12.2_

---

## Phase 30: End-to-End Testing

- [ ] 115. Set up E2E testing framework
  - Install and configure Playwright or Cypress
  - Create test utilities and helpers
  - Configure test environments
  - _Requirements: Testing strategy_

- [ ] 116. Write E2E tests for user flows
  - Test complete registration and login flow
  - Test project creation and verification flow
  - Test credit issuance flow
  - Test credit transfer flow
  - Test credit retirement with Cardano recording flow
  - _Requirements: All requirements_

- [ ] 117. Write E2E tests for admin flows
  - Test verifier assignment flow
  - Test verification approval flow
  - Test user management flow
  - Test audit log viewing
  - _Requirements: Administrator workflows_

- [ ] 118. Write E2E tests for error scenarios
  - Test network error handling
  - Test validation error handling
  - Test authentication error handling
  - Test authorization error handling
  - _Requirements: Error handling_

---

## Phase 31: Final Integration and Polish

- [ ] 119. Implement loading states
  - Add skeleton loaders for all data fetching
  - Add spinner for button actions
  - Add progress bars for long operations
  - Animate loading states with Framer Motion
  - _Requirements: User experience_

- [ ] 120. Implement empty states
  - Create empty state components for lists
  - Add illustrations and helpful messages
  - Add call-to-action buttons
  - Animate empty states
  - _Requirements: User experience_

- [ ] 121. Implement error boundaries
  - Create error boundary components
  - Add fallback UI for errors
  - Implement error reporting
  - Add retry functionality
  - _Requirements: Error handling_

- [ ] 122. Polish animations and transitions
  - Review all animations for consistency
  - Optimize animation performance
  - Add micro-interactions (button hover, focus states)
  - Implement page transition animations
  - Add loading animations for async operations
  - _Requirements: User experience_

- [ ] 123. Conduct accessibility audit
  - Run automated accessibility tests (axe, Lighthouse)
  - Test with keyboard navigation
  - Test with screen readers
  - Fix accessibility issues
  - Document accessibility features
  - _Requirements: Accessibility_

- [ ] 124. Conduct cross-browser testing
  - Test on Chrome, Firefox, Safari, Edge
  - Test on mobile browsers (iOS Safari, Chrome Mobile)
  - Fix browser-specific issues
  - Document browser support
  - _Requirements: Compatibility_

- [ ] 125. Optimize for mobile
  - Review responsive design on all pages
  - Optimize touch interactions
  - Reduce animation complexity on mobile
  - Test on various screen sizes
  - _Requirements: Mobile experience_

- [ ] 126. Final integration testing
  - Test complete user journeys end-to-end
  - Test all API integrations
  - Test Cardano wallet integration on Preview testnet
  - Test error scenarios
  - Test performance under load
  - _Requirements: All requirements_

---

## Completion Checklist

After completing all tasks, verify:

**Backend**:
- [ ] All API endpoints are functional and documented
- [ ] All database tables are created with proper indexes
- [ ] User registration and authentication work end-to-end
- [ ] Cardano wallet linking and verification work
- [ ] Project registration and verification workflow complete
- [ ] Credit issuance happens automatically on verification approval
- [ ] Credit transfers work with proper validation
- [ ] Credit retirements are recorded on Cardano Preview testnet
- [ ] Audit logs capture all important events
- [ ] Error handling is consistent across all endpoints
- [ ] Performance meets SLA targets (p95 < 500ms)
- [ ] Security controls are in place (rate limiting, CORS, input validation)
- [ ] Monitoring and alerting are configured
- [ ] Comprehensive test coverage (unit, integration, E2E)

**Frontend**:
- [ ] All pages are implemented and responsive
- [ ] Cardano wallet connection works with popular wallets
- [ ] All forms have proper validation and error handling
- [ ] Animations are smooth and performant
- [ ] Dark mode works correctly
- [ ] Accessibility standards are met (WCAG 2.1 AA)
- [ ] Loading and empty states are implemented
- [ ] Error boundaries catch and display errors gracefully
- [ ] Cross-browser compatibility verified
- [ ] Mobile experience is optimized
- [ ] Performance metrics meet targets (LCP < 2.5s, FID < 100ms, CLS < 0.1)
- [ ] E2E tests cover all critical user flows

**Deployment**:
- [ ] Documentation is complete
- [ ] CI/CD pipeline is configured
- [ ] Application is deployed to staging and tested
- [ ] Application is deployed to production
- [ ] Monitoring dashboards are set up
- [ ] Alerting is configured
- [ ] Backup and disaster recovery procedures are in place

---

**Total Tasks**: 126 tasks (66 backend + 60 frontend)
**Estimated Timeline**: 16-20 weeks for full implementation with a team of 3-4 developers (2 backend, 2 frontend)
**Testing**: Comprehensive testing integrated throughout (industry standard for production carbon credit platforms)
