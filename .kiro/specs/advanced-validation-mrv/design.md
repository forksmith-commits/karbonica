# Design Document - Advanced Validation & Decentralized Governance System

## Overview

This design extends the existing Karbonica Carbon Credit Registry Platform with decentralized validation, zero-knowledge proofs, and DAO governance. The system builds upon the existing layered architecture (Presentation, Application, Domain, Infrastructure) and integrates seamlessly with the current User, Project, Verification, and Credit services.

### Design Goals

1. **Decentralization**: Distribute validation power across stake-weighted validator network
2. **Transparency**: Record all validation decisions on Cardano Preview testnet
3. **Privacy**: Enable ZK proofs for sensitive project data
4. **Governance**: Community-driven policy and methodology decisions
5. **Integrity**: Economic incentives (staking/slashing) ensure honest validation
6. **Interoperability**: Integrate with existing Karbonica services and external registries
7. **Scalability**: Support thousands of validators and projects

### Technology Stack Extensions

Building on existing stack (Node.js, TypeScript, PostgreSQL, Redis, Express):
- **Blockchain**: Cardano Preview testnet via Blockfrost API
- **Smart Contracts**: Plutus contracts for staking and governance (future phase)
- **ZK Proofs**: snarkjs or circom for zero-knowledge circuits
- **IPFS**: Distributed storage for metadata and documents
- **Message Queue**: For async validator notifications and blockchain submissions

## Architecture

### Extended Service Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Existing Services                         │
│  - User Service (auth, wallet linking)                       │
│  - Project Service (registration, documents)                 │
│  - Verification Service (workflow, documents)                │
│  - Credit Service (issuance, transfer, retirement)           │
│  - Compliance Service (audit logs)                           │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ Extends
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    New Services                              │
│  - Validator Service (staking, selection, voting)            │
│  - Governance Service (proposals, voting, execution)         │
│  - ZKP Service (proof generation, verification)              │
│  - Methodology Service (registry, versioning)                │
│  - Blockchain Service (enhanced Cardano integration)         │
└─────────────────────────────────────────────────────────────┘
```

### Integration with Existing Verification Flow

```
Current Flow:
Project → Verification Request → Verifier Assignment → Review → Approve/Reject

Enhanced Flow:
Project → Verification Request → Validator Selection (5-7) → 
Distributed Review → Stake-Weighted Voting → Consensus → 
Cardano Recording → Approve/Reject → Credit Issuance
```

## Components and Interfaces

### 1. Validator Management Component

#### Entities

**Validator Entity**
```typescript
Validator {
  id: UUID
  userId: UUID  // Links to existing User
  stakeAmount: Decimal  // KARB tokens staked
  stakedAt: Timestamp
  status: ValidatorStatus  // active, inactive, suspended, slashed
  reputationScore: Decimal  // 0-100
  totalValidations: Integer
  successfulValidations: Integer
  slashingHistory: SlashEvent[]
  withdrawalRequestedAt: Timestamp | null
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

**ValidatorStake Entity**
```typescript
ValidatorStake {
  id: UUID
  validatorId: UUID
  amount: Decimal
  stakeType: 'stake' | 'unstake'
  status: 'pending' | 'active' | 'unbonding' | 'withdrawn'
  unbondingCompletesAt: Timestamp | null
  cardanoTxHash: String | null
  createdAt: Timestamp
}
```


**ValidationAssignment Entity**
```typescript
ValidationAssignment {
  id: UUID
  verificationRequestId: UUID  // Links to existing VerificationRequest
  validatorId: UUID
  assignedAt: Timestamp
  deadline: Timestamp
  vote: 'approve' | 'reject' | 'needs_more_info' | null
  voteComment: Text | null
  votedAt: Timestamp | null
  rewardAmount: Decimal | null
  status: 'assigned' | 'voted' | 'expired' | 'rewarded'
}
```

**ValidatorSlashing Entity**
```typescript
ValidatorSlashing {
  id: UUID
  validatorId: UUID
  disputeId: UUID
  slashPercentage: Decimal  // 10-100%
  slashedAmount: Decimal
  reason: Text
  evidenceHash: String  // IPFS hash
  cardanoTxHash: String
  slashedAt: Timestamp
}
```

#### Value Objects

- **ValidatorStatus**: Enum (active, inactive, suspended, slashed)
- **StakeWeight**: Calculated as sqrt(stakeAmount) to prevent plutocracy
- **ReputationScore**: 0-100, affected by voting accuracy and slashing

#### Interfaces

**IValidatorRepository**
```typescript
interface IValidatorRepository {
  findById(id: UUID): Validator
  findByUserId(userId: UUID): Validator
  findActive(minStake: Decimal): Validator[]
  save(validator: Validator): Validator
  update(validator: Validator): Validator
  updateReputation(validatorId: UUID, newScore: Decimal): void
}
```

**IValidatorService**
```typescript
interface IValidatorService {
  registerValidator(userId: UUID, stakeAmount: Decimal): Validator
  stakeTokens(validatorId: UUID, amount: Decimal): ValidatorStake
  requestUnstake(validatorId: UUID, amount: Decimal): ValidatorStake
  completeUnstake(stakeId: UUID): void
  selectValidators(verificationId: UUID, count: number): Validator[]
  calculateStakeWeight(stakeAmount: Decimal): Decimal
  updateReputation(validatorId: UUID): void
  slashValidator(validatorId: UUID, percentage: Decimal, reason: String): void
}
```

### 2. Decentralized Validation Component

#### Entities

**ValidationRound Entity** (extends existing VerificationRequest)
```typescript
ValidationRound {
  id: UUID
  verificationRequestId: UUID  // Links to existing
  requiredValidators: Integer  // 5-7
  assignedValidators: Integer
  votesReceived: Integer
  approveVotes: Integer
  rejectVotes: Integer
  approveStakeWeight: Decimal
  rejectStakeWeight: Decimal
  consensusThreshold: Decimal  // 66%
  consensusReached: Boolean
  consensusResult: 'approved' | 'rejected' | null
  deadline: Timestamp
  cardanoTxHash: String | null  // Verification result on-chain
  status: 'pending' | 'voting' | 'completed' | 'expired'
  createdAt: Timestamp
  completedAt: Timestamp | null
}
```

**ValidatorVote Entity**
```typescript
ValidatorVote {
  id: UUID
  validationRoundId: UUID
  validatorId: UUID
  vote: 'approve' | 'reject' | 'needs_more_info'
  stakeWeight: Decimal  // At time of vote
  comment: Text
  evidenceUrls: String[]
  votedAt: Timestamp
  cardanoTxHash: String | null  // Optional on-chain vote record
}
```

#### Interfaces

**IValidationRoundService**
```typescript
interface IValidationRoundService {
  createRound(verificationId: UUID): ValidationRound
  assignValidators(roundId: UUID): ValidationAssignment[]
  submitVote(roundId: UUID, validatorId: UUID, vote: Vote): ValidatorVote
  calculateConsensus(roundId: UUID): ConsensusResult
  finalizeRound(roundId: UUID): void
  recordOnCardano(roundId: UUID): String  // Returns tx hash
  distributeRewards(roundId: UUID): void
}
```

### 3. DAO Governance Component

#### Entities

**GovernanceProposal Entity**
```typescript
GovernanceProposal {
  id: UUID
  proposerId: UUID
  proposalType: ProposalType  // methodology, parameter, treasury
  title: String
  description: Text
  proposalData: JSONB  // Type-specific data
  requiredDeposit: Decimal  // 100,000 KARB
  depositPaid: Boolean
  votingStartsAt: Timestamp
  votingEndsAt: Timestamp
  executionDelay: Integer  // 2 days timelock
  status: ProposalStatus
  yesVotes: Decimal  // Stake-weighted
  noVotes: Decimal
  totalVotes: Decimal
  quorumThreshold: Decimal  // 10%
  approvalThreshold: Decimal  // 50%
  executedAt: Timestamp | null
  cardanoTxHash: String | null
  createdAt: Timestamp
}
```

**GovernanceVote Entity**
```typescript
GovernanceVote {
  id: UUID
  proposalId: UUID
  voterId: UUID
  voteChoice: 'yes' | 'no' | 'abstain'
  stakeWeight: Decimal  // Snapshot at voting start
  votedAt: Timestamp
  cardanoTxHash: String | null
}
```

**Methodology Entity**
```typescript
Methodology {
  id: UUID
  name: String
  version: String
  standardBody: String  // VCS, Gold Standard, CDM, ISO
  sector: String  // forestry, renewable_energy, etc.
  description: Text
  baselineApproach: Text
  monitoringRequirements: JSONB
  ipfsHash: String  // Full methodology document
  approvedByProposalId: UUID | null
  status: 'active' | 'deprecated'
  createdAt: Timestamp
  deprecatedAt: Timestamp | null
}
```

#### Value Objects

- **ProposalType**: Enum (add_methodology, update_parameter, treasury_allocation, emergency_action)
- **ProposalStatus**: Enum (draft, voting, passed, rejected, executed, cancelled)

#### Interfaces

**IGovernanceService**
```typescript
interface IGovernanceService {
  createProposal(proposerId: UUID, proposal: ProposalData): GovernanceProposal
  startVoting(proposalId: UUID): void
  submitVote(proposalId: UUID, voterId: UUID, choice: VoteChoice): GovernanceVote
  calculateResults(proposalId: UUID): ProposalResult
  executeProposal(proposalId: UUID): void
  cancelProposal(proposalId: UUID, reason: String): void
}
```

**IMethodologyService**
```typescript
interface IMethodologyService {
  addMethodology(methodology: MethodologyData): Methodology
  getMethodology(id: UUID): Methodology
  listMethodologies(filters: Filters): Methodology[]
  deprecateMethodology(id: UUID): void
  validateProjectMethodology(projectId: UUID, methodologyId: UUID): Boolean
}
```

### 4. Zero-Knowledge Proof Component

#### Entities

**ZKPCircuit Entity**
```typescript
ZKPCircuit {
  id: UUID
  name: String
  version: String
  circuitType: String  // carbon_sequestration, emissions_reduction
  description: Text
  wasmUrl: String  // Compiled circuit
  zkeyUrl: String  // Proving key
  verificationKeyHash: String
  status: 'active' | 'deprecated'
  createdAt: Timestamp
}
```

**ZKProof Entity**
```typescript
ZKProof {
  id: UUID
  projectId: UUID
  circuitId: UUID
  publicInputs: JSONB  // Claim amount, timestamp, project ID
  proof: JSONB  // ZK proof data
  verificationResult: Boolean
  verifiedAt: Timestamp
  ipfsHash: String  // Proof stored on IPFS
  createdAt: Timestamp
}
```

#### Interfaces

**IZKPService**
```typescript
interface IZKPService {
  generateCircuit(circuitType: String): ZKPCircuit
  submitProof(projectId: UUID, circuitId: UUID, proof: ProofData): ZKProof
  verifyProof(proofId: UUID): Boolean
  getProof(proofId: UUID): ZKProof
  listProjectProofs(projectId: UUID): ZKProof[]
}
```

### 5. Enhanced Cardano Integration Component

#### Entities

**CardanoTransaction Entity** (extends existing BlockchainTransaction)
```typescript
CardanoTransaction {
  id: UUID
  transactionType: TransactionType  // verification, issuance, retirement, governance, staking
  entityId: UUID  // ID of related entity (validation round, proposal, etc.)
  txHash: String
  txStatus: 'pending' | 'confirmed' | 'failed'
  blockNumber: Integer | null
  blockHash: String | null
  confirmations: Integer
  metadata: JSONB  // CIP-20 formatted
  fee: Decimal  // ADA
  submittedAt: Timestamp
  confirmedAt: Timestamp | null
  retryCount: Integer
  errorMessage: String | null
}
```

**IPFSDocument Entity**
```typescript
IPFSDocument {
  id: UUID
  entityType: String  // methodology, proposal, proof, certificate
  entityId: UUID
  ipfsHash: String
  fileName: String
  fileSize: Integer
  mimeType: String
  uploadedAt: Timestamp
}
```

#### Interfaces

**ICardanoService** (extends existing)
```typescript
interface ICardanoService {
  // Existing methods
  submitRetirement(creditId: UUID, metadata: Object): String
  
  // New methods
  recordVerification(roundId: UUID, result: ConsensusResult): String
  recordIssuance(creditId: UUID, metadata: Object): String
  recordGovernanceVote(proposalId: UUID, voteData: Object): String
  recordStaking(validatorId: UUID, amount: Decimal): String
  recordSlashing(validatorId: UUID, amount: Decimal): String
  queryTransaction(txHash: String): TransactionDetails
  waitForConfirmations(txHash: String, count: Integer): Boolean
}
```

**IIPFSService**
```typescript
interface IIPFSService {
  uploadDocument(file: Buffer, metadata: Object): String  // Returns IPFS hash
  uploadJSON(data: Object): String
  retrieveDocument(ipfsHash: String): Buffer
  retrieveJSON(ipfsHash: String): Object
  pinDocument(ipfsHash: String): void
}
```

### 6. Dispute Resolution Component

#### Entities

**Dispute Entity**
```typescript
Dispute {
  id: UUID
  disputeType: 'fraudulent_project' | 'validator_misconduct' | 'governance_violation'
  targetEntityType: String  // project, validator, proposal
  targetEntityId: UUID
  submitterId: UUID
  bondAmount: Decimal  // 1,000 KARB
  description: Text
  evidenceUrls: String[]
  evidenceIpfsHash: String
  status: DisputeStatus
  arbitrationCommittee: UUID[]  // 5 DAO members
  votesFor: Integer
  votesAgainst: Integer
  resolution: Text | null
  remediation: JSONB | null  // Actions taken
  cardanoTxHash: String | null
  createdAt: Timestamp
  resolvedAt: Timestamp | null
}
```

**ArbitrationVote Entity**
```typescript
ArbitrationVote {
  id: UUID
  disputeId: UUID
  arbitratorId: UUID
  vote: 'uphold' | 'reject'
  reasoning: Text
  votedAt: Timestamp
}
```

#### Value Objects

- **DisputeStatus**: Enum (submitted, under_review, voting, upheld, rejected, executed)

#### Interfaces

**IDisputeService**
```typescript
interface IDisputeService {
  submitDispute(submitterId: UUID, dispute: DisputeData): Dispute
  assignArbitrators(disputeId: UUID): UUID[]
  submitArbitrationVote(disputeId: UUID, arbitratorId: UUID, vote: Vote): ArbitrationVote
  calculateDisputeResult(disputeId: UUID): DisputeResult
  executeRemediation(disputeId: UUID): void
  refundBond(disputeId: UUID): void
}
```

## Data Models

### Database Schema Extensions

#### Validators Table
```sql
CREATE TABLE validators (
  id UUID PRIMARY KEY,
  user_id UUID UNIQUE NOT NULL REFERENCES users(id),
  stake_amount DECIMAL(20,2) NOT NULL DEFAULT 0,
  staked_at TIMESTAMP,
  status VARCHAR(50) NOT NULL DEFAULT 'inactive',
  reputation_score DECIMAL(5,2) NOT NULL DEFAULT 100.0,
  total_validations INTEGER NOT NULL DEFAULT 0,
  successful_validations INTEGER NOT NULL DEFAULT 0,
  withdrawal_requested_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_validators_user ON validators(user_id);
CREATE INDEX idx_validators_status ON validators(status);
CREATE INDEX idx_validators_stake ON validators(stake_amount);
```

#### Validator Stakes Table
```sql
CREATE TABLE validator_stakes (
  id UUID PRIMARY KEY,
  validator_id UUID NOT NULL REFERENCES validators(id),
  amount DECIMAL(20,2) NOT NULL,
  stake_type VARCHAR(20) NOT NULL,
  status VARCHAR(50) NOT NULL,
  unbonding_completes_at TIMESTAMP,
  cardano_tx_hash VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_stakes_validator ON validator_stakes(validator_id);
CREATE INDEX idx_stakes_status ON validator_stakes(status);
```

#### Validation Rounds Table
```sql
CREATE TABLE validation_rounds (
  id UUID PRIMARY KEY,
  verification_request_id UUID UNIQUE NOT NULL REFERENCES verification_requests(id),
  required_validators INTEGER NOT NULL DEFAULT 5,
  assigned_validators INTEGER NOT NULL DEFAULT 0,
  votes_received INTEGER NOT NULL DEFAULT 0,
  approve_votes INTEGER NOT NULL DEFAULT 0,
  reject_votes INTEGER NOT NULL DEFAULT 0,
  approve_stake_weight DECIMAL(20,2) NOT NULL DEFAULT 0,
  reject_stake_weight DECIMAL(20,2) NOT NULL DEFAULT 0,
  consensus_threshold DECIMAL(5,2) NOT NULL DEFAULT 66.0,
  consensus_reached BOOLEAN DEFAULT FALSE,
  consensus_result VARCHAR(50),
  deadline TIMESTAMP NOT NULL,
  cardano_tx_hash VARCHAR(255),
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE INDEX idx_rounds_verification ON validation_rounds(verification_request_id);
CREATE INDEX idx_rounds_status ON validation_rounds(status);
```

#### Validation Assignments Table
```sql
CREATE TABLE validation_assignments (
  id UUID PRIMARY KEY,
  validation_round_id UUID NOT NULL REFERENCES validation_rounds(id),
  validator_id UUID NOT NULL REFERENCES validators(id),
  assigned_at TIMESTAMP NOT NULL,
  deadline TIMESTAMP NOT NULL,
  vote VARCHAR(50),
  vote_comment TEXT,
  voted_at TIMESTAMP,
  reward_amount DECIMAL(20,2),
  status VARCHAR(50) NOT NULL DEFAULT 'assigned',
  UNIQUE(validation_round_id, validator_id)
);

CREATE INDEX idx_assignments_round ON validation_assignments(validation_round_id);
CREATE INDEX idx_assignments_validator ON validation_assignments(validator_id);
CREATE INDEX idx_assignments_status ON validation_assignments(status);
```

#### Validator Votes Table
```sql
CREATE TABLE validator_votes (
  id UUID PRIMARY KEY,
  validation_round_id UUID NOT NULL REFERENCES validation_rounds(id),
  validator_id UUID NOT NULL REFERENCES validators(id),
  vote VARCHAR(50) NOT NULL,
  stake_weight DECIMAL(20,2) NOT NULL,
  comment TEXT,
  evidence_urls TEXT[],
  voted_at TIMESTAMP NOT NULL,
  cardano_tx_hash VARCHAR(255),
  UNIQUE(validation_round_id, validator_id)
);

CREATE INDEX idx_votes_round ON validator_votes(validation_round_id);
CREATE INDEX idx_votes_validator ON validator_votes(validator_id);
```

#### Governance Proposals Table
```sql
CREATE TABLE governance_proposals (
  id UUID PRIMARY KEY,
  proposer_id UUID NOT NULL REFERENCES users(id),
  proposal_type VARCHAR(50) NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  proposal_data JSONB NOT NULL,
  required_deposit DECIMAL(20,2) NOT NULL,
  deposit_paid BOOLEAN DEFAULT FALSE,
  voting_starts_at TIMESTAMP,
  voting_ends_at TIMESTAMP,
  execution_delay INTEGER NOT NULL DEFAULT 172800,
  status VARCHAR(50) NOT NULL DEFAULT 'draft',
  yes_votes DECIMAL(20,2) NOT NULL DEFAULT 0,
  no_votes DECIMAL(20,2) NOT NULL DEFAULT 0,
  total_votes DECIMAL(20,2) NOT NULL DEFAULT 0,
  quorum_threshold DECIMAL(5,2) NOT NULL DEFAULT 10.0,
  approval_threshold DECIMAL(5,2) NOT NULL DEFAULT 50.0,
  executed_at TIMESTAMP,
  cardano_tx_hash VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_proposals_proposer ON governance_proposals(proposer_id);
CREATE INDEX idx_proposals_status ON governance_proposals(status);
CREATE INDEX idx_proposals_type ON governance_proposals(proposal_type);
```

#### Governance Votes Table
```sql
CREATE TABLE governance_votes (
  id UUID PRIMARY KEY,
  proposal_id UUID NOT NULL REFERENCES governance_proposals(id),
  voter_id UUID NOT NULL REFERENCES users(id),
  vote_choice VARCHAR(20) NOT NULL,
  stake_weight DECIMAL(20,2) NOT NULL,
  voted_at TIMESTAMP NOT NULL,
  cardano_tx_hash VARCHAR(255),
  UNIQUE(proposal_id, voter_id)
);

CREATE INDEX idx_gov_votes_proposal ON governance_votes(proposal_id);
CREATE INDEX idx_gov_votes_voter ON governance_votes(voter_id);
```

#### Methodologies Table
```sql
CREATE TABLE methodologies (
  id UUID PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  version VARCHAR(50) NOT NULL,
  standard_body VARCHAR(100) NOT NULL,
  sector VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  baseline_approach TEXT,
  monitoring_requirements JSONB,
  ipfs_hash VARCHAR(255) NOT NULL,
  approved_by_proposal_id UUID REFERENCES governance_proposals(id),
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deprecated_at TIMESTAMP,
  UNIQUE(name, version)
);

CREATE INDEX idx_methodologies_status ON methodologies(status);
CREATE INDEX idx_methodologies_sector ON methodologies(sector);
```

#### ZKP Circuits Table
```sql
CREATE TABLE zkp_circuits (
  id UUID PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  version VARCHAR(50) NOT NULL,
  circuit_type VARCHAR(100) NOT NULL,
  description TEXT,
  wasm_url VARCHAR(500) NOT NULL,
  zkey_url VARCHAR(500) NOT NULL,
  verification_key_hash VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(name, version)
);

CREATE INDEX idx_circuits_type ON zkp_circuits(circuit_type);
CREATE INDEX idx_circuits_status ON zkp_circuits(status);
```

#### ZK Proofs Table
```sql
CREATE TABLE zk_proofs (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id),
  circuit_id UUID NOT NULL REFERENCES zkp_circuits(id),
  public_inputs JSONB NOT NULL,
  proof JSONB NOT NULL,
  verification_result BOOLEAN NOT NULL,
  verified_at TIMESTAMP NOT NULL,
  ipfs_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_proofs_project ON zk_proofs(project_id);
CREATE INDEX idx_proofs_circuit ON zk_proofs(circuit_id);
```

#### Disputes Table
```sql
CREATE TABLE disputes (
  id UUID PRIMARY KEY,
  dispute_type VARCHAR(50) NOT NULL,
  target_entity_type VARCHAR(50) NOT NULL,
  target_entity_id UUID NOT NULL,
  submitter_id UUID NOT NULL REFERENCES users(id),
  bond_amount DECIMAL(20,2) NOT NULL,
  description TEXT NOT NULL,
  evidence_urls TEXT[],
  evidence_ipfs_hash VARCHAR(255),
  status VARCHAR(50) NOT NULL DEFAULT 'submitted',
  arbitration_committee UUID[],
  votes_for INTEGER NOT NULL DEFAULT 0,
  votes_against INTEGER NOT NULL DEFAULT 0,
  resolution TEXT,
  remediation JSONB,
  cardano_tx_hash VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP
);

CREATE INDEX idx_disputes_target ON disputes(target_entity_type, target_entity_id);
CREATE INDEX idx_disputes_submitter ON disputes(submitter_id);
CREATE INDEX idx_disputes_status ON disputes(status);
```

#### IPFS Documents Table
```sql
CREATE TABLE ipfs_documents (
  id UUID PRIMARY KEY,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  ipfs_hash VARCHAR(255) NOT NULL UNIQUE,
  file_name VARCHAR(255),
  file_size BIGINT,
  mime_type VARCHAR(100),
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ipfs_entity ON ipfs_documents(entity_type, entity_id);
CREATE INDEX idx_ipfs_hash ON ipfs_documents(ipfs_hash);
```

## Error Handling

### New Error Types

```typescript
class InsufficientStakeError extends Error {
  constructor(required: Decimal, actual: Decimal) {
    super(`Insufficient stake: required ${required}, actual ${actual}`)
  }
}

class ConsensusNotReachedError extends Error {
  constructor(roundId: UUID) {
    super(`Consensus not reached for validation round ${roundId}`)
  }
}

class ZKProofVerificationError extends Error {
  constructor(proofId: UUID, reason: String) {
    super(`ZK proof verification failed: ${reason}`)
  }
}

class GovernanceQuorumError extends Error {
  constructor(proposalId: UUID, quorum: Decimal) {
    super(`Proposal ${proposalId} did not reach quorum: ${quorum}%`)
  }
}
```

## Testing Strategy

### Unit Tests

- Validator selection algorithm (stake-weighted randomness)
- Consensus calculation (stake-weighted voting)
- Reputation score updates
- ZK proof verification logic
- Governance vote counting
- Slashing calculations

### Integration Tests

- Complete validation round flow
- Staking and unstaking with Cardano
- Governance proposal lifecycle
- Dispute resolution process
- IPFS document upload/retrieval
- Cardano transaction submission and monitoring

### End-to-End Tests

- Project validation with multiple validators
- Governance proposal creation and execution
- Validator slashing after dispute
- Credit issuance with ZK proof
- Full audit trail verification on Cardano

## Security Considerations

### Validator Security

1. **Sybil Resistance**: Minimum stake requirement prevents cheap validator creation
2. **Collusion Detection**: Monitor voting patterns for suspicious correlations
3. **Stake Locking**: 14-day unbonding period prevents quick exit after fraud
4. **Reputation System**: Long-term incentive for honest behavior

### Governance Security

1. **Proposal Deposit**: 100,000 KARB prevents spam proposals
2. **Timelock**: 2-day delay allows community to review before execution
3. **Emergency Veto**: Multi-sig committee can cancel malicious proposals
4. **Quorum Requirement**: Prevents low-participation attacks

### ZKP Security

1. **Circuit Verification**: Only approved circuits accepted
2. **Proof Validation**: Cryptographic verification before acceptance
3. **Public Input Validation**: Ensure claims match public inputs
4. **Circuit Versioning**: Track and audit circuit updates

### Blockchain Security

1. **Transaction Signing**: Secure key management (HSM/KMS)
2. **Confirmation Waiting**: 6 confirmations before finalization
3. **Retry Logic**: Exponential backoff prevents spam
4. **Fee Management**: Monitor and alert on low wallet balance

## Performance Optimizations

### Validator Selection

- Pre-compute stake weights daily
- Cache active validator list (5-minute TTL)
- Use weighted reservoir sampling for O(n) selection

### Consensus Calculation

- Materialize vote aggregations in real-time
- Index by validation round for fast queries
- Cache consensus results after finalization

### Blockchain Integration

- Batch multiple transactions when possible
- Queue submissions during high network congestion
- Cache blockchain queries (5-minute TTL)
- Use webhooks instead of polling when available

### IPFS Integration

- Pin frequently accessed documents
- Use CDN for popular content
- Implement local cache layer
- Batch uploads when possible

## Monitoring and Observability

### Metrics

- Validator participation rate
- Consensus time (time to reach 66% threshold)
- Slashing events per month
- Governance proposal success rate
- ZK proof verification time
- Cardano transaction confirmation time
- IPFS upload/retrieval latency

### Alerts

- Validator participation below 80%
- Consensus not reached within deadline
- Slashing event occurred
- Governance proposal failed to execute
- ZK proof verification failure rate > 5%
- Cardano transaction timeout
- IPFS service unavailable

### Dashboards

- Validator network health (active validators, total stake, reputation distribution)
- Validation pipeline (pending rounds, voting progress, consensus rate)
- Governance activity (active proposals, voting participation, execution queue)
- Blockchain integration (transaction volume, confirmation times, fee costs)

## Migration Strategy

### Phase 1: Database Schema
- Add new tables for validators, validation rounds, governance
- Migrate existing verification_requests to support validation rounds
- Add indexes for performance

### Phase 2: Validator Network
- Deploy validator registration and staking
- Implement validator selection algorithm
- Integrate with existing verification workflow

### Phase 3: Governance
- Deploy governance proposal system
- Migrate existing methodologies to governance-approved
- Enable community voting

### Phase 4: ZKP Integration
- Deploy ZK circuit infrastructure
- Enable optional ZKP for projects
- Integrate with validation workflow

### Phase 5: Enhanced Blockchain
- Extend Cardano integration for all transaction types
- Implement IPFS for metadata storage
- Enable full on-chain audit trail

## API Design

### Validator Endpoints

```
POST   /api/v1/validators/register
POST   /api/v1/validators/:id/stake
POST   /api/v1/validators/:id/unstake
GET    /api/v1/validators/:id
GET    /api/v1/validators
GET    /api/v1/validators/:id/assignments
GET    /api/v1/validators/:id/reputation
```

### Validation Endpoints

```
GET    /api/v1/validation-rounds/:id
POST   /api/v1/validation-rounds/:id/vote
GET    /api/v1/validation-rounds/:id/consensus
GET    /api/v1/validation-rounds/:id/assignments
```

### Governance Endpoints

```
POST   /api/v1/governance/proposals
GET    /api/v1/governance/proposals
GET    /api/v1/governance/proposals/:id
POST   /api/v1/governance/proposals/:id/vote
POST   /api/v1/governance/proposals/:id/execute
GET    /api/v1/methodologies
GET    /api/v1/methodologies/:id
```

### ZKP Endpoints

```
POST   /api/v1/zkp/circuits
GET    /api/v1/zkp/circuits
POST   /api/v1/zkp/proofs
GET    /api/v1/zkp/proofs/:id
POST   /api/v1/zkp/proofs/:id/verify
```

### Dispute Endpoints

```
POST   /api/v1/disputes
GET    /api/v1/disputes
GET    /api/v1/disputes/:id
POST   /api/v1/disputes/:id/arbitrate
```

## Conclusion

This design extends the existing Karbonica platform with decentralized validation, governance, and enhanced blockchain integration while maintaining compatibility with current services. The architecture supports gradual rollout through phased migration and provides clear interfaces for future enhancements.
