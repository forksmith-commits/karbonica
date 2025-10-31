# Requirements Document - Karbonica Carbon Credit Registry Platform

## Introduction

The Karbonica Carbon Credit Registry Platform is a production-grade, multi-tenant system designed to manage the complete lifecycle of carbon offset projects. The platform handles project registration, multi-stage verification workflows, carbon credit issuance, trading, and retirement with full blockchain integration. The system ensures transparency, auditability, and compliance with international carbon credit standards (Verra VCS, Gold Standard, ISO 14064).

This platform serves four primary user roles: Developers (project creators), Verifiers (third-party validators), Administrators (system managers), and Buyers (credit purchasers). The system provides comprehensive audit trails, regulatory reporting, and integrates with blockchain networks for immutable transaction records.

## Requirements

### Requirement 1: User Registration and Authentication

**User Story:** As a new user, I want to register an account with email and password, and link my blockchain wallet, so that I can securely access the platform and participate in carbon credit activities.

#### Acceptance Criteria

1. WHEN a user submits registration with email, password, name, company, and role THEN the system SHALL validate the email format and uniqueness
2. WHEN a user submits registration THEN the system SHALL hash the password using bcrypt with cost factor 12
3. WHEN registration is successful THEN the system SHALL send an email verification link
4. WHEN a user clicks the verification link THEN the system SHALL mark the email as confirmed and create the user profile
5. WHEN a user attempts login with valid credentials THEN the system SHALL return a challenge requiring wallet verification
6. WHEN a user connects their wallet and signs the challenge THEN the system SHALL verify the signature and issue JWT access token (15 min expiry) and refresh token (7 day expiry)
7. IF a user fails login 5 times within 15 minutes THEN the system SHALL lock the account for 30 minutes
8. WHEN a user's session is inactive for 30 minutes THEN the system SHALL expire the session

### Requirement 2: Multi-Factor Authentication with Cardano Wallet

**User Story:** As a registered user, I want to authenticate using both my password and Cardano wallet signature, so that my account has enhanced security protection.

#### Acceptance Criteria

1. WHEN a user completes email/password authentication THEN the system SHALL generate a unique challenge ID and message
2. WHEN a user connects their Cardano wallet THEN the system SHALL request signature of the challenge message
3. WHEN a user submits Cardano wallet address and signature THEN the system SHALL verify the Ed25519 signature using Cardano cryptography
4. WHEN a user submits wallet address THEN the system SHALL validate it is a valid Cardano Preview testnet address (Bech32 format)
5. IF the wallet address is not linked to the account THEN the system SHALL reject the authentication
6. WHEN wallet verification succeeds THEN the system SHALL create a session and return access and refresh tokens
7. WHEN a user links a wallet address THEN the system SHALL validate the address format and ensure uniqueness across all users
8. WHEN a user links a wallet address THEN the system SHALL store the address, public key, and linking timestamp
9. IF a user attempts to link an already-used wallet address THEN the system SHALL reject the request
10. WHEN a user links a wallet THEN the system SHALL support popular Cardano wallets (Nami, Eternl, Flint, Lace)

### Requirement 3: Project Registration and Management

**User Story:** As a developer, I want to register carbon offset projects with detailed information and documentation, so that I can submit them for verification and eventual credit issuance.

#### Acceptance Criteria

1. WHEN a developer creates a project THEN the system SHALL require title, type, location, country, emissions target, start date, and description
2. WHEN a project is submitted THEN the system SHALL validate emissions target is positive and less than 10,000,000 tons
3. WHEN a project is submitted THEN the system SHALL validate the country code against ISO 3166-1 list
4. WHEN a project is submitted THEN the system SHALL validate project type is in approved methodology list (Forest Conservation, Renewable Energy, etc.)
5. WHEN a project is created THEN the system SHALL set status to "pending" and assign the current user as developer
6. WHEN a project is created THEN the system SHALL automatically create a linked verification request
7. WHEN a project is created THEN the system SHALL log an audit event "ProjectRegistered"
8. IF a developer attempts to modify a project after verification starts THEN the system SHALL reject the modification
9. WHEN a developer views their projects THEN the system SHALL display only projects they own
10. WHEN a developer uploads project documents THEN the system SHALL scan for viruses and store in secure cloud storage

### Requirement 4: Verification Workflow Management

**User Story:** As a verifier, I want to review assigned verification requests, upload verification documents, and approve or reject projects, so that I can ensure projects meet carbon credit standards.

#### Acceptance Criteria

1. WHEN an administrator assigns a verifier to a verification request THEN the system SHALL send notification to the verifier
2. WHEN a verification request is created THEN the system SHALL set status to "pending" and progress to 0%
3. WHEN a verifier is assigned THEN the system SHALL update status to "in_review" and progress to 30%
4. WHEN a verifier uploads a document THEN the system SHALL store metadata, file URL, uploader ID, and timestamp
5. WHEN a verifier adds a timeline event THEN the system SHALL record timestamp, event type, message, and user ID
6. WHEN a verifier attempts to approve verification THEN the system SHALL validate at least 3 documents are present (project description, methodology, baseline assessment)
7. WHEN a verifier approves verification THEN the system SHALL update verification status to "approved", project status to "verified", and progress to 100%
8. WHEN a verifier rejects verification THEN the system SHALL require a rejection reason and update status to "rejected"
9. IF a non-assigned verifier attempts to approve/reject THEN the system SHALL reject the action unless user is administrator
10. WHEN verification status changes THEN the system SHALL create a timeline event and send notification to developer
11. WHEN a verifier views verifications THEN the system SHALL display only verifications assigned to them or all if administrator

### Requirement 5: Carbon Credit Issuance

**User Story:** As a developer, I want carbon credits automatically issued when my project is verified, so that I can trade or retire the credits.

#### Acceptance Criteria

1. WHEN a verification is approved THEN the system SHALL automatically issue carbon credits equal to the project's emissions target
2. WHEN credits are issued THEN the system SHALL generate a unique serial number
3. WHEN credits are issued THEN the system SHALL set owner to the project developer
4. WHEN credits are issued THEN the system SHALL set status to "active" and record vintage year
5. WHEN credits are issued THEN the system SHALL create a transaction record with type "issuance"
6. WHEN credits are issued THEN the system SHALL publish "CreditsIssued" domain event
7. WHEN credits are issued THEN the system SHALL send notification to the developer
8. WHEN credits are issued THEN the system SHALL log audit event with credit ID, project ID, quantity, and owner

### Requirement 6: Credit Transfer Operations

**User Story:** As a credit owner, I want to transfer credits to another user, so that I can sell or gift my carbon credits.

#### Acceptance Criteria

1. WHEN a user initiates credit transfer THEN the system SHALL validate the user owns the credits
2. WHEN a user initiates credit transfer THEN the system SHALL validate transfer quantity is positive and does not exceed owned amount
3. WHEN a user initiates credit transfer THEN the system SHALL validate credit status is "active"
4. WHEN a user initiates credit transfer THEN the system SHALL validate recipient user exists
5. WHEN transfer is validated THEN the system SHALL use serializable transaction isolation level
6. WHEN transfer executes THEN the system SHALL lock the credit record FOR UPDATE
7. WHEN transfer executes THEN the system SHALL update credit owner to recipient and status to "transferred"
8. WHEN transfer executes THEN the system SHALL create transaction record with type "transfer", sender, recipient, quantity, and status "completed"
9. WHEN transfer completes THEN the system SHALL publish "CreditsTransferred" domain event
10. WHEN transfer completes THEN the system SHALL send notifications to both sender and recipient
11. WHEN transfer completes THEN the system SHALL log audit event
12. IF any validation fails THEN the system SHALL rollback the transaction and return error

### Requirement 7: Credit Retirement Operations with Cardano Recording

**User Story:** As a credit owner, I want to retire credits permanently with immutable blockchain proof, so that I can claim the carbon offset and provide cryptographic evidence of retirement.

#### Acceptance Criteria

1. WHEN a user initiates credit retirement THEN the system SHALL validate the user owns the credits
2. WHEN a user initiates credit retirement THEN the system SHALL validate retirement quantity is positive and does not exceed owned amount
3. WHEN a user initiates credit retirement THEN the system SHALL validate credit status is "active"
4. WHEN a user initiates credit retirement THEN the system SHALL require a retirement reason
5. WHEN retirement is validated THEN the system SHALL use serializable transaction isolation level
6. WHEN retirement executes THEN the system SHALL lock the credit record FOR UPDATE
7. WHEN retirement executes THEN the system SHALL update credit status to "retired"
8. WHEN retirement executes THEN the system SHALL create transaction record with type "retirement" and metadata containing reason
9. WHEN retirement executes THEN the system SHALL build Cardano transaction with CIP-20 metadata containing credit ID, project ID, quantity, vintage, retired by, reason, and timestamp
10. WHEN Cardano transaction is built THEN the system SHALL sign it with platform wallet private key
11. WHEN Cardano transaction is signed THEN the system SHALL submit to Cardano Preview testnet via Blockfrost API
12. WHEN Cardano transaction is submitted THEN the system SHALL obtain transaction hash and store in database
13. WHEN Cardano transaction is submitted THEN the system SHALL monitor for 6 confirmations (approximately 2 minutes)
14. WHEN Cardano transaction reaches 6 confirmations THEN the system SHALL mark blockchain transaction as "confirmed"
15. IF Cardano transaction fails THEN the system SHALL retry up to 3 times with exponential backoff
16. IF Cardano transaction fails after retries THEN the system SHALL queue for manual review and alert operations team
17. WHEN retirement completes THEN the system SHALL publish "CreditsRetired" domain event
18. WHEN retirement completes THEN the system SHALL generate retirement certificate with certificate ID, transaction hash, and Cardano Preview explorer link
19. WHEN retirement completes THEN the system SHALL send notification to owner with blockchain proof
20. WHEN retirement completes THEN the system SHALL log audit event with Cardano transaction hash

### Requirement 8: Role-Based Access Control

**User Story:** As an administrator, I want to control what actions each user role can perform, so that the system maintains proper security and data integrity.

#### Acceptance Criteria

1. WHEN a developer creates a project THEN the system SHALL allow the action
2. WHEN a developer attempts to view another developer's project THEN the system SHALL deny access
3. WHEN a developer attempts to approve a verification THEN the system SHALL deny access
4. WHEN a verifier attempts to create a project THEN the system SHALL deny access
5. WHEN a verifier views verifications THEN the system SHALL display only assigned verifications
6. WHEN a verifier approves an assigned verification THEN the system SHALL allow the action
7. WHEN a verifier attempts to approve a non-assigned verification THEN the system SHALL deny access unless user is administrator
8. WHEN an administrator performs any action THEN the system SHALL allow the action
9. WHEN a buyer views projects THEN the system SHALL display only verified projects
10. WHEN a buyer attempts to create a project THEN the system SHALL deny access
11. WHEN any user attempts an unauthorized action THEN the system SHALL return 403 Forbidden and log the attempt

### Requirement 9: Audit Logging and Compliance

**User Story:** As a compliance officer, I want comprehensive audit logs of all system activities, so that I can ensure regulatory compliance and investigate issues.

#### Acceptance Criteria

1. WHEN a user authenticates THEN the system SHALL log timestamp, user ID, IP address, user agent, and authentication method
2. WHEN authentication fails THEN the system SHALL log the failure with reason
3. WHEN a project is created, updated, or deleted THEN the system SHALL log the action with user ID, project ID, and changes
4. WHEN a verification status changes THEN the system SHALL log the change with verifier ID, old status, new status, and reason
5. WHEN credits are issued, transferred, or retired THEN the system SHALL log the transaction with all parties and amounts
6. WHEN a user's role or permissions change THEN the system SHALL log the change with administrator ID
7. WHEN a configuration change occurs THEN the system SHALL log the change with user ID and old/new values
8. WHEN an authorization failure occurs THEN the system SHALL log the attempt with user ID, requested resource, and action
9. WHEN audit logs are queried THEN the system SHALL retain security logs for 1 year and audit logs for 7 years
10. WHEN audit logs are stored THEN the system SHALL use structured JSON format with consistent schema

### Requirement 10: API Design and Error Handling

**User Story:** As an API consumer, I want consistent, well-documented REST APIs with clear error messages, so that I can integrate with the platform reliably.

#### Acceptance Criteria

1. WHEN any API endpoint is called THEN the system SHALL use versioned URLs with format /api/v1/{resource}
2. WHEN a successful response is returned THEN the system SHALL use HTTP status 200 (OK), 201 (Created), or 204 (No Content)
3. WHEN an error occurs THEN the system SHALL return appropriate HTTP status code (400, 401, 403, 404, 409, 500)
4. WHEN an error occurs THEN the system SHALL return JSON error response with status, code, title, detail, and source pointer
5. WHEN validation fails THEN the system SHALL return 400 Bad Request with specific field errors
6. WHEN authentication fails THEN the system SHALL return 401 Unauthorized
7. WHEN authorization fails THEN the system SHALL return 403 Forbidden
8. WHEN a resource is not found THEN the system SHALL return 404 Not Found
9. WHEN a list endpoint is called THEN the system SHALL support cursor-based pagination with limit and cursor parameters
10. WHEN a list endpoint is called THEN the system SHALL support filtering with filter[field]=value syntax
11. WHEN a list endpoint is called THEN the system SHALL support sorting with sort=field or sort=-field for descending
12. WHEN any API response is returned THEN the system SHALL include meta object with timestamp and request ID

### Requirement 11: Data Security and Encryption

**User Story:** As a security officer, I want all sensitive data encrypted and protected, so that user information and business data remain confidential.

#### Acceptance Criteria

1. WHEN a password is stored THEN the system SHALL hash it using bcrypt with cost factor 12
2. WHEN data is transmitted THEN the system SHALL use TLS 1.3 encryption
3. WHEN data is stored at rest THEN the system SHALL use AES-256-GCM encryption
4. WHEN API keys are generated THEN the system SHALL store SHA-256 hash only
5. WHEN JWT tokens are created THEN the system SHALL sign them using RS256 algorithm
6. WHEN encryption keys are managed THEN the system SHALL rotate keys every 90 days
7. WHEN encryption keys are stored THEN the system SHALL use secure vault or HSM for production
8. WHEN files are uploaded THEN the system SHALL scan for viruses before storage
9. WHEN sensitive data is logged THEN the system SHALL mask or redact PII
10. WHEN database queries execute THEN the system SHALL use parameterized queries to prevent SQL injection

### Requirement 12: Performance and Scalability

**User Story:** As a system operator, I want the platform to handle high load and scale horizontally, so that performance remains consistent as usage grows.

#### Acceptance Criteria

1. WHEN API requests are processed THEN the system SHALL achieve p95 response time under 500ms and p99 under 1 second
2. WHEN database queries execute THEN the system SHALL achieve p95 query time under 100ms
3. WHEN the system is under load THEN the system SHALL maintain 99.9% uptime (max 43 minutes downtime per month)
4. WHEN error rate is measured THEN the system SHALL maintain error rate below 0.1%
5. WHEN application services are deployed THEN the system SHALL be stateless to enable horizontal scaling
6. WHEN database load increases THEN the system SHALL route read operations to read replicas
7. WHEN cache is queried THEN the system SHALL achieve cache hit rate above 80%
8. WHEN user sessions are stored THEN the system SHALL use distributed cache (Redis) for session data
9. WHEN auto-scaling triggers fire THEN the system SHALL scale up when CPU > 70% or memory > 80%
10. WHEN auto-scaling is configured THEN the system SHALL maintain minimum 2 instances and maximum 20 instances

### Requirement 13: Monitoring and Observability

**User Story:** As a DevOps engineer, I want comprehensive monitoring, logging, and tracing, so that I can quickly identify and resolve issues.

#### Acceptance Criteria

1. WHEN application logs are generated THEN the system SHALL use structured JSON format with timestamp, level, service, traceId, userId, and action
2. WHEN a request is processed THEN the system SHALL generate distributed trace with unique traceId propagated across all services
3. WHEN metrics are collected THEN the system SHALL track request rate, error rate, response time percentiles, and active connections
4. WHEN health checks are performed THEN the system SHALL expose /health endpoint with status of database, cache, storage, and queue
5. WHEN liveness probe fails THEN the system SHALL restart the service
6. WHEN readiness probe fails THEN the system SHALL remove service from load balancer
7. WHEN error rate exceeds 5% THEN the system SHALL trigger critical alert via PagerDuty and SMS
8. WHEN response time p99 exceeds 5 seconds THEN the system SHALL trigger critical alert
9. WHEN errors occur THEN the system SHALL capture error message, stack trace, request context, user context, and breadcrumbs
10. WHEN logs are stored THEN the system SHALL aggregate logs in central log store with retention of 90 days for access logs

### Requirement 14: Disaster Recovery and High Availability

**User Story:** As a business continuity manager, I want automated backups and failover capabilities, so that the platform can recover quickly from failures.

#### Acceptance Criteria

1. WHEN database backups are scheduled THEN the system SHALL perform full backup daily at 2 AM UTC
2. WHEN database backups are scheduled THEN the system SHALL perform incremental backup every 6 hours
3. WHEN database backups are scheduled THEN the system SHALL perform transaction log backup every 15 minutes
4. WHEN backups are stored THEN the system SHALL retain daily backups for 30 days, weekly for 90 days, and monthly for 1 year
5. WHEN backups are stored THEN the system SHALL replicate to different region for disaster recovery
6. WHEN primary database fails THEN the system SHALL automatically failover to standby database within 1 hour (RTO)
7. WHEN disaster recovery is measured THEN the system SHALL achieve maximum 15 minutes data loss for critical data (RPO)
8. WHEN health checks fail 3 consecutive times THEN the system SHALL switch traffic to standby region
9. WHEN file storage is configured THEN the system SHALL enable versioning and cross-region replication
10. WHEN disaster recovery is tested THEN the system SHALL perform quarterly DR drills including database restore and failover tests

### Requirement 15: Cardano Blockchain Integration

**User Story:** As a platform operator, I want all credit retirements and transfers recorded on Cardano Preview testnet, so that there is an immutable, transparent audit trail of all carbon credit transactions.

#### Acceptance Criteria

1. WHEN platform initializes THEN the system SHALL connect to Cardano Preview testnet via Blockfrost API
2. WHEN platform wallet is configured THEN the system SHALL store private key in secure vault (AWS KMS, Azure Key Vault, or HashiCorp Vault)
3. WHEN credit retirement occurs THEN the system SHALL build Cardano transaction with metadata in CIP-20 format
4. WHEN Cardano transaction metadata is created THEN the system SHALL include credit_id, project_id, quantity, vintage, retired_by, retirement_reason, and timestamp
5. WHEN Cardano transaction is built THEN the system SHALL calculate transaction fees using current protocol parameters
6. WHEN Cardano transaction is built THEN the system SHALL ensure platform wallet has sufficient ADA for fees
7. WHEN Cardano transaction is signed THEN the system SHALL use Ed25519 signing with platform wallet private key
8. WHEN Cardano transaction is submitted THEN the system SHALL receive transaction hash from Blockfrost API
9. WHEN Cardano transaction is submitted THEN the system SHALL store transaction hash, status "pending", and submission timestamp
10. WHEN monitoring Cardano transaction THEN the system SHALL poll Blockfrost API every 20 seconds for confirmation status
11. WHEN Cardano transaction reaches 6 confirmations THEN the system SHALL update status to "confirmed" and store block number and block hash
12. WHEN Cardano transaction fails on-chain THEN the system SHALL update status to "failed" and log error details
13. WHEN Cardano transaction times out (> 10 minutes) THEN the system SHALL trigger alert and queue for manual review
14. WHEN credit transfer occurs THEN the system SHALL optionally record transfer details on Cardano with metadata
15. WHEN retirement certificate is generated THEN the system SHALL include Cardano Preview explorer link (preview.cardanoscan.io/transaction/{txHash})
16. WHEN Blockfrost API rate limit is reached THEN the system SHALL queue requests and retry with backoff
17. WHEN Blockfrost API is unavailable THEN the system SHALL continue operations and queue blockchain submissions for later
18. WHEN platform wallet balance is low (< 100 ADA) THEN the system SHALL alert operations team
19. WHEN querying blockchain data THEN the system SHALL cache responses for 60 seconds to reduce API calls
20. WHEN user views retirement certificate THEN the system SHALL display Cardano transaction hash and verification link

### Requirement 16: External Service Integration

**User Story:** As a system integrator, I want reliable integration with external services like email, storage, and Cardano blockchain, so that the platform can leverage third-party capabilities.

#### Acceptance Criteria

1. WHEN email notification is triggered THEN the system SHALL send via email service API with retry up to 3 times
2. WHEN email delivery fails after retries THEN the system SHALL queue for manual processing
3. WHEN file is uploaded THEN the system SHALL store in S3-compatible storage with pre-signed URLs
4. WHEN file is uploaded THEN the system SHALL apply access control lists and encryption at rest
5. WHEN Cardano transaction is submitted THEN the system SHALL use Blockfrost API for Cardano Preview testnet
6. WHEN Cardano transaction is submitted THEN the system SHALL include API key in request headers
7. WHEN Cardano transaction is submitted THEN the system SHALL respect rate limit of 50 requests/second
8. WHEN Cardano transaction is queried THEN the system SHALL poll for status every 20 seconds until confirmed
9. WHEN Cardano wallet signature is required THEN the system SHALL verify Ed25519 signature using Cardano Serialization Library
10. WHEN Cardano address is validated THEN the system SHALL verify Bech32 encoding and Preview testnet network tag
11. WHEN external service call fails THEN the system SHALL implement circuit breaker pattern with failure threshold of 5 failures in 10 seconds
12. WHEN circuit breaker opens THEN the system SHALL fail fast for 60 seconds before attempting half-open state
13. WHEN external service call is retried THEN the system SHALL use exponential backoff (1s, 2s, 4s) with max 3 attempts
14. IF external service returns 4xx error (except 429) THEN the system SHALL NOT retry the request
15. WHEN Blockfrost API is unavailable THEN the system SHALL operate in fallback mode (record in database, sync to blockchain later)
