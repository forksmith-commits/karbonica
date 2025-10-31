# Design Document - Karbonica Carbon Credit Registry Platform

## Overview

The Karbonica Carbon Credit Registry Platform is designed as a production-grade, cloud-native system following Domain-Driven Design (DDD) and event-driven architecture principles. The platform manages the complete lifecycle of carbon offset projects from registration through verification to credit issuance, trading, and retirement.

### Design Goals

1. **Scalability**: Horizontal scaling to support growing user base and transaction volume
2. **Security**: Multi-layered security with encryption, authentication, and authorization
3. **Reliability**: 99.9% uptime with automated failover and disaster recovery
4. **Performance**: Sub-500ms API response times at p95
5. **Maintainability**: Clean architecture with clear separation of concerns
6. **Observability**: Comprehensive logging, metrics, and distributed tracing
7. **Compliance**: Full audit trails and regulatory reporting capabilities

### Technology Stack Considerations

This design is technology-agnostic but assumes:
- Relational database with ACID transactions (PostgreSQL, MySQL, SQL Server)
- Distributed cache (Redis, Memcached)
- Object storage (S3-compatible)
- Message queue for async processing (RabbitMQ, SQS, Azure Service Bus)
- Container orchestration (Kubernetes, ECS, AKS)
- **Blockchain**: Cardano Preview testnet for immutable transaction records

## Architecture

### Layered Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Presentation Layer                        │
│  - REST API Controllers                                      │
│  - Request/Response DTOs                                     │
│  - Input Validation                                          │
│  - Authentication Middleware                                 │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                   Application Layer                          │
│  - Application Services (Orchestration)                      │
│  - Workflow Management                                       │
│  - Transaction Coordination                                  │
│  - Event Publishing                                          │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                      Domain Layer                            │
│  - Domain Models (Entities, Value Objects)                   │
│  - Domain Services                                           │
│  - Business Rules & Invariants                               │
│  - Domain Events                                             │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                  Infrastructure Layer                        │
│  - Repository Implementations                                │
│  - Database Access                                           │
│  - External Service Clients                                  │
│  - Caching                                                   │
│  - Message Queue                                             │
└─────────────────────────────────────────────────────────────┘
```

### Service Architecture

The system is organized into domain-focused services that can be deployed as a monolith initially and split into microservices as needed:

1. **User Service**: Authentication, authorization, user management
2. **Project Service**: Project registration, metadata management
3. **Verification Service**: Verification workflow, document management
4. **Credit Service**: Credit issuance, transfers, retirements
5. **Compliance Service**: Audit logging, reporting
6. **Notification Service**: Email, in-app notifications
7. **Integration Service**: External API integrations (blockchain, storage, payment)

## Components and Interfaces

### 1. User Management Component

#### Entities

**User Entity**
```
User:
  - id: UUID (primary key)
  - email: String (unique, indexed)
  - passwordHash: String (bcrypt)
  - name: String
  - company: String
  - role: UserRole (enum)
  - walletAddress: String (unique, nullable, indexed)
  - emailVerified: Boolean
  - accountLocked: Boolean
  - failedLoginAttempts: Integer
  - lastLoginAt: Timestamp
  - createdAt: Timestamp
  - updatedAt: Timestamp
```

**Session Entity**
```
Session:
  - id: UUID (primary key)
  - userId: UUID (foreign key, indexed)
  - accessToken: String (hashed)
  - refreshToken: String (hashed)
  - expiresAt: Timestamp
  - ipAddress: String
  - userAgent: String
  - createdAt: Timestamp
```

#### Value Objects

- **Email**: Validated email format
- **WalletAddress**: Validated blockchain address format
- **UserRole**: Enum (developer, verifier, administrator, buyer)

#### Interfaces

**IUserRepository**
```
interface IUserRepository {
  findById(id: UUID): User
  findByEmail(email: String): User
  findByWalletAddress(address: String): User
  save(user: User): User
  update(user: User): User
  delete(id: UUID): void
}
```

**IAuthenticationService**
```
interface IAuthenticationService {
  register(email, password, name, company, role): User
  login(email, password): Challenge
  verifyWallet(challengeId, walletAddress, signature): AuthTokens
  refreshToken(refreshToken): AuthTokens
  logout(userId): void
  verifyEmail(token): void
}
```

### 2. Project Management Component

#### Entities

**Project Entity**
```
Project:
  - id: UUID (primary key)
  - developerId: UUID (foreign key, indexed)
  - title: String
  - type: ProjectType (enum)
  - description: Text
  - location: String
  - country: String (ISO 3166-1)
  - coordinates: Point (lat, long)
  - emissionsTarget: Decimal
  - startDate: Date
  - status: ProjectStatus (enum, indexed)
  - createdAt: Timestamp
  - updatedAt: Timestamp
```

**ProjectDocument Entity**
```
ProjectDocument:
  - id: UUID (primary key)
  - projectId: UUID (foreign key, indexed)
  - name: String
  - description: Text
  - fileUrl: String
  - fileSize: Integer
  - mimeType: String
  - uploadedBy: UUID (foreign key)
  - uploadedAt: Timestamp
```

#### Value Objects

- **ProjectType**: Enum (forest_conservation, renewable_energy, energy_efficiency, etc.)
- **ProjectStatus**: Enum (pending, verified, rejected)
- **Location**: Country code + coordinates
- **EmissionsTarget**: Quantity + unit (tons CO2e)

#### Interfaces

**IProjectRepository**
```
interface IProjectRepository {
  findById(id: UUID): Project
  findByDeveloper(developerId: UUID, filters, pagination): Project[]
  findAll(filters, pagination): Project[]
  save(project: Project): Project
  update(project: Project): Project
  delete(id: UUID): void
}
```

**IProjectService**
```
interface IProjectService {
  createProject(developerId, projectData): Project
  updateProject(projectId, projectData): Project
  getProject(projectId): Project
  listProjects(filters, pagination): ProjectList
  uploadDocument(projectId, file, metadata): ProjectDocument
  deleteDocument(projectId, documentId): void
}
```

### 3. Verification Workflow Component

#### Entities

**VerificationRequest Entity**
```
VerificationRequest:
  - id: UUID (primary key)
  - projectId: UUID (foreign key, unique, indexed)
  - developerId: UUID (foreign key, indexed)
  - verifierId: UUID (foreign key, nullable, indexed)
  - status: VerificationStatus (enum, indexed)
  - progress: Integer (0-100)
  - submittedAt: Timestamp
  - assignedAt: Timestamp (nullable)
  - completedAt: Timestamp (nullable)
  - notes: Text
  - createdAt: Timestamp
  - updatedAt: Timestamp
```

**VerificationDocument Entity**
```
VerificationDocument:
  - id: UUID (primary key)
  - verificationId: UUID (foreign key, indexed)
  - name: String
  - description: Text
  - documentType: String
  - fileUrl: String
  - fileSize: Integer
  - mimeType: String
  - uploadedBy: UUID (foreign key)
  - uploadedAt: Timestamp
```

**VerificationEvent Entity**
```
VerificationEvent:
  - id: UUID (primary key)
  - verificationId: UUID (foreign key, indexed)
  - eventType: String
  - message: Text
  - userId: UUID (foreign key)
  - metadata: JSON
  - createdAt: Timestamp
```

#### Value Objects

- **VerificationStatus**: Enum (pending, in_review, approved, rejected)
- **VerificationProgress**: Integer (0-100)
- **DocumentType**: Enum (project_description, methodology, baseline_assessment, monitoring_report, etc.)

#### State Machine

```
States: pending → in_review → (approved | rejected)

Transitions:
  - pending → in_review: assign_verifier
  - in_review → approved: approve (requires min 3 documents)
  - in_review → rejected: reject (requires reason)

Actions on approve:
  - Update verification status
  - Update project status to "verified"
  - Issue carbon credits
  - Create timeline event
  - Send notifications
  - Publish VerificationApproved event
```

#### Interfaces

**IVerificationRepository**
```
interface IVerificationRepository {
  findById(id: UUID): VerificationRequest
  findByProject(projectId: UUID): VerificationRequest
  findByVerifier(verifierId: UUID, filters, pagination): VerificationRequest[]
  findAll(filters, pagination): VerificationRequest[]
  save(verification: VerificationRequest): VerificationRequest
  update(verification: VerificationRequest): VerificationRequest
}
```

**IVerificationService**
```
interface IVerificationService {
  createVerification(projectId): VerificationRequest
  assignVerifier(verificationId, verifierId): VerificationRequest
  uploadDocument(verificationId, file, metadata): VerificationDocument
  addTimelineEvent(verificationId, eventType, message): VerificationEvent
  approve(verificationId, notes): VerificationRequest
  reject(verificationId, reason): VerificationRequest
  getVerification(verificationId): VerificationRequest
  listVerifications(filters, pagination): VerificationList
}
```

### 4. Credit Management Component

#### Entities

**CreditEntry Entity**
```
CreditEntry:
  - id: UUID (primary key)
  - creditId: String (unique serial number, indexed)
  - projectId: UUID (foreign key, indexed)
  - ownerId: UUID (foreign key, indexed)
  - quantity: Decimal
  - vintage: Integer (year)
  - status: CreditStatus (enum, indexed)
  - issuedAt: Timestamp
  - lastActionAt: Timestamp
  - createdAt: Timestamp
  - updatedAt: Timestamp
```

**CreditTransaction Entity**
```
CreditTransaction:
  - id: UUID (primary key)
  - creditId: UUID (foreign key, indexed)
  - transactionType: TransactionType (enum, indexed)
  - senderId: UUID (foreign key, nullable, indexed)
  - recipientId: UUID (foreign key, nullable, indexed)
  - quantity: Decimal
  - status: TransactionStatus (enum)
  - blockchainTxHash: String (nullable)
  - metadata: JSON
  - createdAt: Timestamp
  - completedAt: Timestamp
```

#### Value Objects

- **CreditStatus**: Enum (active, transferred, retired)
- **TransactionType**: Enum (issuance, transfer, retirement)
- **TransactionStatus**: Enum (pending, completed, failed)
- **SerialNumber**: Unique identifier format (e.g., KRB-2024-001-000001)
- **Vintage**: Year (validation: current year or past)

#### Interfaces

**ICreditRepository**
```
interface ICreditRepository {
  findById(id: UUID): CreditEntry
  findByCreditId(creditId: String): CreditEntry
  findByOwner(ownerId: UUID, filters, pagination): CreditEntry[]
  findByProject(projectId: UUID): CreditEntry[]
  save(credit: CreditEntry): CreditEntry
  update(credit: CreditEntry): CreditEntry
  lockForUpdate(id: UUID): CreditEntry
}
```

**ICreditService**
```
interface ICreditService {
  issueCredits(projectId, quantity, ownerId): CreditEntry
  transferCredits(creditId, recipientId, quantity): CreditTransaction
  retireCredits(creditId, quantity, reason): CreditTransaction
  getCredit(creditId): CreditEntry
  listCredits(filters, pagination): CreditList
  getTransactionHistory(creditId): CreditTransaction[]
}
```

### 5. Cardano Blockchain Integration Component

#### Overview

The Karbonica platform integrates with Cardano Preview testnet to provide immutable, transparent records of carbon credit transactions. This integration ensures auditability, prevents double-spending, and provides cryptographic proof of credit retirement.

#### Cardano Preview Testnet

**Network Details**:
- Network: Cardano Preview testnet
- Purpose: Testing and development before mainnet deployment
- Features: Full Cardano functionality with test ADA
- Block time: ~20 seconds
- Finality: ~2 minutes (6 confirmations)

#### Integration Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  Karbonica Platform                          │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         Credit Service                                │   │
│  │  - Transfer credits                                   │   │
│  │  - Retire credits                                     │   │
│  └────────────────────┬─────────────────────────────────┘   │
│                       │                                       │
│  ┌────────────────────▼─────────────────────────────────┐   │
│  │    Cardano Integration Service                        │   │
│  │  - Wallet management                                  │   │
│  │  - Transaction building                               │   │
│  │  - Transaction submission                             │   │
│  │  - Transaction monitoring                             │   │
│  │  - Signature verification                             │   │
│  └────────────────────┬─────────────────────────────────┘   │
└───────────────────────┼───────────────────────────────────────┘
                        │
                        │ Cardano Node API
                        │ (Preview Testnet)
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              Cardano Preview Testnet                         │
│  - Immutable transaction ledger                              │
│  - Smart contract execution (Plutus)                         │
│  - Native token support                                      │
│  - Metadata storage                                          │
└─────────────────────────────────────────────────────────────┘
```

#### Cardano Entities

**CardanoWallet Entity**
```
CardanoWallet:
  - id: UUID (primary key)
  - userId: UUID (foreign key, unique, indexed)
  - address: String (Cardano address, unique)
  - stakeAddress: String (nullable)
  - publicKey: String
  - linkedAt: Timestamp
  - lastVerifiedAt: Timestamp
  - isActive: Boolean
  - createdAt: Timestamp
```

**BlockchainTransaction Entity**
```
BlockchainTransaction:
  - id: UUID (primary key)
  - creditTransactionId: UUID (foreign key, indexed)
  - txHash: String (Cardano tx hash, unique, indexed)
  - txStatus: String (pending, confirmed, failed)
  - blockNumber: Integer (nullable)
  - blockHash: String (nullable)
  - confirmations: Integer
  - metadata: JSONB (transaction metadata)
  - submittedAt: Timestamp
  - confirmedAt: Timestamp (nullable)
  - createdAt: Timestamp
```

#### Cardano Operations

**1. Wallet Linking**

When a user links their Cardano wallet:
```
1. User connects wallet (Nami, Eternl, Flint, etc.)
2. Frontend requests wallet address and public key
3. Backend generates challenge message
4. User signs challenge with wallet
5. Backend verifies signature using Cardano cryptography
6. Backend stores wallet address and public key
7. Wallet is linked to user account
```

**Signature Verification**:
- Use Cardano Serialization Library (CSL) or Cardano Multiplatform Library
- Verify Ed25519 signature
- Validate address format (Bech32 encoding)
- Ensure address belongs to Preview testnet

**2. Credit Retirement on Cardano**

When credits are retired:
```
1. User initiates retirement in Karbonica platform
2. System validates ownership and quantity
3. System builds Cardano transaction:
   - Input: Platform wallet UTxO
   - Output: Return change to platform wallet
   - Metadata: Credit retirement details (CIP-20 format)
4. System signs transaction with platform wallet
5. System submits transaction to Cardano Preview testnet
6. System monitors transaction for confirmations
7. After 6 confirmations, mark as confirmed
8. Store transaction hash in database
9. Generate retirement certificate with tx hash
```

**Transaction Metadata Format (CIP-20)**:
```json
{
  "674": {
    "msg": [
      "Karbonica Carbon Credit Retirement"
    ],
    "credit_id": "KRB-2024-001-000001",
    "project_id": "uuid",
    "quantity": "1000.00",
    "vintage": 2024,
    "retired_by": "user_id",
    "retirement_reason": "Corporate carbon neutrality",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

**3. Credit Transfer Recording**

When credits are transferred between users:
```
1. Transfer occurs in Karbonica database (primary record)
2. System builds Cardano transaction with metadata:
   - Transfer details (from, to, quantity)
   - Credit serial number
   - Timestamp
3. Submit transaction to Cardano Preview testnet
4. Monitor for confirmation
5. Update database with tx hash
```

**Note**: The Cardano transaction serves as an immutable audit trail. The primary source of truth for ownership remains in the Karbonica database for performance and query efficiency.

#### Cardano Integration Interfaces

**ICardanoWalletService**
```
interface ICardanoWalletService {
  linkWallet(userId: UUID, address: String, publicKey: String, signature: String): CardanoWallet
  verifySignature(address: String, message: String, signature: String): Boolean
  unlinkWallet(userId: UUID): void
  getWallet(userId: UUID): CardanoWallet
  validateAddress(address: String): Boolean
}
```

**ICardanoTransactionService**
```
interface ICardanoTransactionService {
  buildRetirementTransaction(creditId: UUID, metadata: Object): Transaction
  buildTransferRecordTransaction(creditTransactionId: UUID, metadata: Object): Transaction
  signTransaction(transaction: Transaction): SignedTransaction
  submitTransaction(signedTransaction: SignedTransaction): String (txHash)
  getTransactionStatus(txHash: String): TransactionStatus
  waitForConfirmation(txHash: String, confirmations: Integer): Boolean
  getTransactionMetadata(txHash: String): Object
}
```

**ICardanoNodeClient**
```
interface ICardanoNodeClient {
  submitTx(signedTx: String): String (txHash)
  queryTx(txHash: String): TransactionDetails
  queryUtxos(address: String): Utxo[]
  getProtocolParameters(): ProtocolParameters
  getLatestBlock(): BlockInfo
}
```

#### Cardano Node Connection

**Connection Methods**:

1. **Blockfrost API** (Recommended for Preview testnet):
   - Endpoint: `https://cardano-preview.blockfrost.io/api/v0`
   - Requires API key
   - RESTful API
   - Rate limits: 50 requests/second

2. **Cardano Node + Ogmios**:
   - Run local Cardano node synced to Preview testnet
   - Use Ogmios for WebSocket JSON-RPC interface
   - Full control, no rate limits
   - Requires infrastructure

3. **Cardano DB Sync + GraphQL**:
   - Run Cardano DB Sync for Preview testnet
   - Query via GraphQL (Cardano GraphQL)
   - Complex queries supported
   - Requires PostgreSQL database

**Recommended Approach**: Start with Blockfrost API for simplicity, migrate to self-hosted node for production.

#### Cardano Libraries

**Backend Integration**:
- **cardano-serialization-lib**: Transaction building and signing
- **@emurgo/cardano-serialization-lib-nodejs**: Node.js bindings
- **cardano-multiplatform-lib**: Cross-platform support
- **blockfrost-js**: Blockfrost API client

**Frontend Integration**:
- **@cardano-foundation/cardano-connect-with-wallet**: Wallet connection
- **@emurgo/cardano-serialization-lib-browser**: Browser bindings
- **lucid-cardano**: High-level transaction builder

#### Security Considerations

1. **Platform Wallet Security**:
   - Store private keys in secure vault (AWS KMS, Azure Key Vault, HashiCorp Vault)
   - Use hardware security module (HSM) for production
   - Implement key rotation policy
   - Separate wallets for different environments

2. **User Wallet Verification**:
   - Verify signature on every wallet link
   - Validate address format and network
   - Check address hasn't been linked to another account
   - Re-verify periodically (e.g., on sensitive operations)

3. **Transaction Security**:
   - Validate transaction before signing
   - Verify metadata integrity
   - Monitor for failed transactions
   - Implement retry logic with exponential backoff

4. **Rate Limiting**:
   - Respect Blockfrost rate limits
   - Implement request queuing
   - Cache blockchain queries
   - Use webhooks for transaction updates

#### Error Handling

**Blockchain-Specific Errors**:

1. **Wallet Connection Errors**:
   - Wallet not installed
   - User rejected connection
   - Invalid signature
   - Network mismatch (mainnet vs testnet)

2. **Transaction Errors**:
   - Insufficient funds (ADA for fees)
   - Invalid transaction format
   - UTxO already spent
   - Transaction too large
   - Network congestion

3. **Confirmation Errors**:
   - Transaction not found
   - Transaction failed on-chain
   - Timeout waiting for confirmation
   - Chain reorganization

**Error Recovery**:
- Retry failed submissions (max 3 attempts)
- Queue transactions for manual review if repeated failures
- Alert operations team for blockchain connectivity issues
- Maintain fallback mode (record in database only, sync to blockchain later)

#### Monitoring and Observability

**Metrics**:
- Transaction submission rate
- Transaction confirmation time
- Failed transaction rate
- Blockchain API response time
- Wallet verification success rate

**Alerts**:
- Transaction confirmation timeout (> 10 minutes)
- High transaction failure rate (> 5%)
- Blockchain API unavailable
- Platform wallet balance low

**Logging**:
- Log all transaction submissions with tx hash
- Log confirmation status changes
- Log wallet linking/unlinking events
- Log signature verification attempts

#### Testing Strategy

**Unit Tests**:
- Signature verification logic
- Transaction building
- Metadata formatting
- Address validation

**Integration Tests**:
- Submit transaction to Preview testnet
- Query transaction status
- Verify metadata on-chain
- Wallet connection flow

**End-to-End Tests**:
- Complete retirement flow with blockchain recording
- Transfer flow with blockchain audit trail
- Wallet linking and verification

**Testnet Strategy**:
- Use Cardano Preview testnet for all development and staging
- Obtain test ADA from Preview faucet
- Test with multiple wallet types (Nami, Eternl, Flint)
- Verify transactions on Preview testnet explorer (preview.cardanoscan.io)

### 6. Audit and Compliance Component

#### Entities

**AuditLog Entity**
```
AuditLog:
  - id: UUID (primary key)
  - timestamp: Timestamp (indexed)
  - eventType: String (indexed)
  - action: String
  - userId: UUID (foreign key, nullable, indexed)
  - resourceType: String
  - resourceId: UUID (nullable, indexed)
  - ipAddress: String
  - userAgent: String
  - changes: JSON
  - metadata: JSON
  - createdAt: Timestamp
```

#### Interfaces

**IAuditRepository**
```
interface IAuditRepository {
  save(auditLog: AuditLog): AuditLog
  findByUser(userId: UUID, filters, pagination): AuditLog[]
  findByResource(resourceType: String, resourceId: UUID): AuditLog[]
  findByEventType(eventType: String, filters, pagination): AuditLog[]
  findAll(filters, pagination): AuditLog[]
}
```

**IAuditService**
```
interface IAuditService {
  logAuthentication(userId, action, success, metadata): void
  logAuthorization(userId, resource, action, allowed): void
  logDataAccess(userId, resourceType, resourceId, action): void
  logDataChange(userId, resourceType, resourceId, changes): void
  logSecurityEvent(eventType, userId, metadata): void
  queryLogs(filters, pagination): AuditLog[]
}
```

## Data Models

### Database Schema

#### Users Table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  company VARCHAR(255),
  role VARCHAR(50) NOT NULL,
  wallet_address VARCHAR(255) UNIQUE,
  email_verified BOOLEAN DEFAULT FALSE,
  account_locked BOOLEAN DEFAULT FALSE,
  failed_login_attempts INTEGER DEFAULT 0,
  last_login_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_wallet ON users(wallet_address);
CREATE INDEX idx_users_role ON users(role);
```

#### Projects Table
```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY,
  developer_id UUID NOT NULL REFERENCES users(id),
  title VARCHAR(200) NOT NULL,
  type VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  location VARCHAR(255) NOT NULL,
  country VARCHAR(3) NOT NULL,
  coordinates POINT,
  emissions_target DECIMAL(15,2) NOT NULL,
  start_date DATE NOT NULL,
  status VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_projects_developer ON projects(developer_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_type ON projects(type);
```

#### Verification Requests Table
```sql
CREATE TABLE verification_requests (
  id UUID PRIMARY KEY,
  project_id UUID UNIQUE NOT NULL REFERENCES projects(id),
  developer_id UUID NOT NULL REFERENCES users(id),
  verifier_id UUID REFERENCES users(id),
  status VARCHAR(50) NOT NULL,
  progress INTEGER DEFAULT 0,
  submitted_at TIMESTAMP NOT NULL,
  assigned_at TIMESTAMP,
  completed_at TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_verifications_project ON verification_requests(project_id);
CREATE INDEX idx_verifications_developer ON verification_requests(developer_id);
CREATE INDEX idx_verifications_verifier ON verification_requests(verifier_id);
CREATE INDEX idx_verifications_status ON verification_requests(status);
```

#### Credit Entries Table
```sql
CREATE TABLE credit_entries (
  id UUID PRIMARY KEY,
  credit_id VARCHAR(50) UNIQUE NOT NULL,
  project_id UUID NOT NULL REFERENCES projects(id),
  owner_id UUID NOT NULL REFERENCES users(id),
  quantity DECIMAL(15,2) NOT NULL,
  vintage INTEGER NOT NULL,
  status VARCHAR(50) NOT NULL,
  issued_at TIMESTAMP NOT NULL,
  last_action_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_credits_credit_id ON credit_entries(credit_id);
CREATE INDEX idx_credits_project ON credit_entries(project_id);
CREATE INDEX idx_credits_owner ON credit_entries(owner_id);
CREATE INDEX idx_credits_status ON credit_entries(status);
```

#### Credit Transactions Table
```sql
CREATE TABLE credit_transactions (
  id UUID PRIMARY KEY,
  credit_id UUID NOT NULL REFERENCES credit_entries(id),
  transaction_type VARCHAR(50) NOT NULL,
  sender_id UUID REFERENCES users(id),
  recipient_id UUID REFERENCES users(id),
  quantity DECIMAL(15,2) NOT NULL,
  status VARCHAR(50) NOT NULL,
  blockchain_tx_hash VARCHAR(255),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE INDEX idx_transactions_credit ON credit_transactions(credit_id);
CREATE INDEX idx_transactions_sender ON credit_transactions(sender_id);
CREATE INDEX idx_transactions_recipient ON credit_transactions(recipient_id);
CREATE INDEX idx_transactions_type ON credit_transactions(transaction_type);
```

#### Audit Logs Table
```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY,
  timestamp TIMESTAMP NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  action VARCHAR(100) NOT NULL,
  user_id UUID REFERENCES users(id),
  resource_type VARCHAR(100),
  resource_id UUID,
  ip_address VARCHAR(45),
  user_agent TEXT,
  changes JSONB,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_timestamp ON audit_logs(timestamp);
CREATE INDEX idx_audit_event_type ON audit_logs(event_type);
CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_resource ON audit_logs(resource_type, resource_id);

-- Partition by month for performance
CREATE TABLE audit_logs_2024_01 PARTITION OF audit_logs
  FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

### Data Relationships

```
User (1) ──────── (N) Project
  │                    │
  │                    │
  │                    ├── (1) VerificationRequest
  │                    │         │
  │                    │         ├── (N) VerificationDocument
  │                    │         └── (N) VerificationEvent
  │                    │
  │                    └── (N) CreditEntry
  │                              │
  └────────────────────────────  └── (N) CreditTransaction

User (1) ──────── (N) Session
User (1) ──────── (N) AuditLog
```

## Error Handling

### Error Response Structure

```json
{
  "errors": [
    {
      "status": "400",
      "code": "VALIDATION_ERROR",
      "title": "Validation Failed",
      "detail": "Emissions target must be a positive number",
      "source": {
        "pointer": "/data/attributes/emissionsTarget"
      }
    }
  ],
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "req-uuid",
    "traceId": "trace-uuid"
  }
}
```

### Error Categories

1. **Validation Errors (400)**
   - Invalid input format
   - Missing required fields
   - Business rule violations
   - Code: VALIDATION_ERROR

2. **Authentication Errors (401)**
   - Invalid credentials
   - Expired token
   - Missing authentication
   - Code: AUTHENTICATION_ERROR

3. **Authorization Errors (403)**
   - Insufficient permissions
   - Resource access denied
   - Code: AUTHORIZATION_ERROR

4. **Not Found Errors (404)**
   - Resource does not exist
   - Code: NOT_FOUND

5. **Conflict Errors (409)**
   - Duplicate resource
   - Concurrent modification
   - Code: CONFLICT

6. **Server Errors (500)**
   - Unexpected errors
   - Database errors
   - External service failures
   - Code: INTERNAL_ERROR

### Error Handling Strategy

1. **Input Validation**: Validate at API layer before processing
2. **Business Validation**: Validate domain rules in domain layer
3. **Transaction Rollback**: Automatic rollback on errors
4. **Error Logging**: Log all errors with context
5. **User-Friendly Messages**: Return clear, actionable error messages
6. **Error Tracking**: Capture errors in monitoring system (Sentry, Rollbar)

## Testing Strategy

### Unit Testing

**Scope**: Individual components, domain logic, business rules

**Coverage Target**: 80% code coverage

**Test Cases**:
- Domain entity validation
- Business rule enforcement
- Value object behavior
- Service method logic
- Repository queries

**Example**:
```
Test: User registration with invalid email
Given: Email "invalid-email"
When: User.create() is called
Then: ValidationError is thrown with message "Invalid email format"
```

### Integration Testing

**Scope**: Component interactions, database operations, API endpoints

**Test Cases**:
- API endpoint request/response
- Database CRUD operations
- Transaction management
- Authentication flow
- Authorization checks

**Example**:
```
Test: Project creation flow
Given: Authenticated developer user
When: POST /api/v1/projects with valid data
Then: Project is created in database
And: Verification request is created
And: Audit log is recorded
And: Response status is 201
```

### End-to-End Testing

**Scope**: Complete user workflows

**Test Cases**:
- User registration and email verification
- Login with wallet authentication
- Project registration and document upload
- Verification approval workflow
- Credit transfer and retirement

**Example**:
```
Test: Complete verification workflow
Given: Developer creates project
When: Admin assigns verifier
And: Verifier uploads documents
And: Verifier approves verification
Then: Project status is "verified"
And: Credits are issued
And: Developer receives notification
```

### Performance Testing

**Scope**: Load testing, stress testing, scalability

**Test Cases**:
- API response time under load
- Database query performance
- Concurrent user handling
- Cache effectiveness
- Auto-scaling behavior

**Targets**:
- 1000 requests/second
- p95 response time < 500ms
- p99 response time < 1s
- 99.9% success rate

### Security Testing

**Scope**: Vulnerability assessment, penetration testing

**Test Cases**:
- SQL injection attempts
- XSS attacks
- CSRF protection
- Authentication bypass attempts
- Authorization escalation attempts
- Rate limiting effectiveness

## Deployment Architecture

### Container Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Load Balancer / API Gateway               │
│  - SSL Termination                                           │
│  - Rate Limiting                                             │
│  - Request Routing                                           │
└────────────────────────┬────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
         ▼               ▼               ▼
    ┌────────┐      ┌────────┐      ┌────────┐
    │  API   │      │  API   │      │  API   │
    │ Server │      │ Server │      │ Server │
    │   1    │      │   2    │      │   3    │
    └────┬───┘      └────┬───┘      └────┬───┘
         │               │               │
         └───────────────┼───────────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
         ▼               ▼               ▼
    ┌────────┐      ┌────────┐      ┌────────┐
    │Primary │      │  Read  │      │ Redis  │
    │   DB   │◄────►│Replica │      │ Cache  │
    └────────┘      └────────┘      └────────┘
```

### Environment Strategy

1. **Development**: Local development, feature branches
2. **Staging**: Pre-production testing, integration testing
3. **Production**: Live environment, multi-region deployment

### CI/CD Pipeline

```
Code Commit → Build → Unit Tests → Integration Tests → 
Security Scan → Container Build → Push to Registry → 
Deploy to Staging → E2E Tests → Deploy to Production → 
Health Check → Rollback if Failed
```

### Monitoring and Alerting

**Metrics**:
- Request rate, error rate, response time
- CPU, memory, disk usage
- Database connections, query time
- Cache hit rate
- Queue depth

**Logs**:
- Application logs (structured JSON)
- Access logs
- Error logs
- Audit logs

**Traces**:
- Distributed tracing with trace ID
- Span tracking across services

**Alerts**:
- Critical: Error rate > 5%, Response time > 5s, Service down
- Warning: Error rate > 1%, Response time > 2s, High resource usage
- Info: Deployment events, configuration changes

## Security Considerations

### Authentication Security

1. **Password Requirements**: Min 8 chars, uppercase, lowercase, number, special char
2. **Password Hashing**: bcrypt with cost factor 12
3. **Account Lockout**: 5 failed attempts, 30-minute lockout
4. **Session Management**: 15-minute access token, 7-day refresh token
5. **Multi-Factor**: Wallet signature verification

### Authorization Security

1. **Role-Based Access Control**: Strict permission enforcement
2. **Row-Level Security**: Database-level access control
3. **Principle of Least Privilege**: Minimal permissions by default
4. **Permission Auditing**: Log all authorization checks

### Data Security

1. **Encryption at Rest**: AES-256-GCM for database and files
2. **Encryption in Transit**: TLS 1.3 for all communications
3. **Key Management**: Rotate keys every 90 days, use HSM in production
4. **Data Masking**: Mask PII in logs and non-production environments

### API Security

1. **Rate Limiting**: 100 requests/minute per user, 1000/minute per IP
2. **Input Validation**: Whitelist validation, type checking, length limits
3. **Output Encoding**: Context-specific encoding (HTML, JSON, URL)
4. **CORS Policy**: Restrict origins, methods, headers
5. **Content Security Policy**: Prevent XSS attacks

### Compliance

1. **GDPR**: Right to access, erasure, portability, consent management
2. **Audit Trails**: 7-year retention for compliance
3. **Data Classification**: Public, internal, confidential, restricted
4. **Carbon Standards**: Verra VCS, Gold Standard, ISO 14064 compliance

## Performance Optimization

### Caching Strategy

**L1 Cache (In-Memory)**:
- User sessions
- Configuration
- TTL: 5 minutes

**L2 Cache (Redis)**:
- User profiles
- Project metadata
- Query results
- TTL: 15 minutes

**Cache Invalidation**:
- Time-based (TTL)
- Event-based (on data change)
- Manual (explicit clear)

### Database Optimization

1. **Indexing**: Foreign keys, frequently queried columns, composite indexes
2. **Query Optimization**: Use EXPLAIN, avoid N+1 queries, use joins efficiently
3. **Connection Pooling**: Reuse connections, configure pool size
4. **Read Replicas**: Route read queries to replicas
5. **Partitioning**: Partition large tables (audit logs by month)

### API Optimization

1. **Pagination**: Cursor-based pagination, limit results
2. **Field Filtering**: Sparse fieldsets, request only needed fields
3. **Compression**: gzip compression for responses
4. **ETags**: Conditional requests, cache validation
5. **Async Processing**: Queue long-running tasks

### Scalability

1. **Horizontal Scaling**: Stateless services, load balancing
2. **Auto-Scaling**: Scale based on CPU, memory, request rate
3. **Database Scaling**: Read replicas, sharding if needed
4. **Caching**: Reduce database load
5. **CDN**: Cache static assets

## Conclusion

This design provides a comprehensive, production-ready architecture for the Karbonica Carbon Credit Registry Platform. The design emphasizes:

- **Clean Architecture**: Clear separation of concerns across layers
- **Domain-Driven Design**: Business logic organized around domains
- **Event-Driven**: Asynchronous processing for scalability
- **Security**: Multi-layered security controls
- **Observability**: Comprehensive monitoring and logging
- **Scalability**: Horizontal scaling and performance optimization
- **Reliability**: High availability and disaster recovery

The design is technology-agnostic and can be implemented with various tech stacks while maintaining the core architectural principles.
