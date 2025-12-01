# Multi-Validator Voting System & On-Chain Burning Implementation Plan

## Overview

This document outlines the implementation plan for transitioning from a single verifier model to a **5-validator voting system** with **on-chain COT/CET burning mechanism**, based on patterns from the karbonUmbrella repository.

## Goals

1. **Multi-Validator Voting**: 5 random validators assigned per project, each casts vote (upvote/downvote/neutral)
2. **Vote Aggregation**: Automatic approval/rejection based on vote tally
3. **Multi-Signature COT Minting**: Requires validator signatures for token issuance
4. **CET Token System**: Non-transferable emission tracking tokens
5. **Automatic Burning**: COT → CET burning at 1:1 ratio when transferred to buyer wallet

## Architecture Changes

### Current State
- Single verifier per project
- Manual approval/rejection
- COT minting on approval without multi-sig
- No CET tokens
- No automatic burning

### Target State
- 5 validators per project (randomly assigned)
- Voting-based approval (majority wins)
- Multi-sig COT minting requiring validator signatures
- CET minting for emission tracking
- Automatic COT/CET 1:1 burning mechanism

---

## Phase 1: Database Schema Changes

### 1.1 New Tables

#### `validator_assignments`
```sql
CREATE TABLE validator_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    verifier_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    vote VARCHAR(20) CHECK (vote IN ('upvote', 'downvote', 'neutral', 'pending')),
    vote_cast_at TIMESTAMP,
    vote_signature TEXT, -- Cardano signature for on-chain verification
    comments TEXT,
    UNIQUE(project_id, verifier_id)
);

CREATE INDEX idx_validator_assignments_project ON validator_assignments(project_id);
CREATE INDEX idx_validator_assignments_verifier ON validator_assignments(verifier_id);
CREATE INDEX idx_validator_assignments_vote ON validator_assignments(vote);
```

#### `project_votes`
```sql
CREATE TABLE project_votes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
    total_validators INT NOT NULL DEFAULT 5,
    upvotes INT NOT NULL DEFAULT 0,
    downvotes INT NOT NULL DEFAULT 0,
    neutral_votes INT NOT NULL DEFAULT 0,
    pending_votes INT NOT NULL DEFAULT 5,
    vote_deadline TIMESTAMP NOT NULL,
    final_decision VARCHAR(20) CHECK (final_decision IN ('approved', 'rejected', 'pending')),
    decided_at TIMESTAMP,
    multisig_tx_hash TEXT, -- Transaction hash with validator signatures
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_project_votes_decision ON project_votes(final_decision);
CREATE INDEX idx_project_votes_deadline ON project_votes(vote_deadline);
```

#### `cet_tokens` (Carbon Emission Tokens)
```sql
CREATE TABLE cet_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    location VARCHAR(255), -- Factory/facility location
    quantity DECIMAL(15, 2) NOT NULL,
    minting_tx_hash TEXT NOT NULL,
    policy_id TEXT NOT NULL,
    asset_name TEXT NOT NULL,
    minted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    burned_at TIMESTAMP,
    burn_tx_hash TEXT,
    metadata JSONB,
    CONSTRAINT cet_positive_quantity CHECK (quantity > 0)
);

CREATE INDEX idx_cet_tokens_user ON cet_tokens(user_id);
CREATE INDEX idx_cet_tokens_policy ON cet_tokens(policy_id, asset_name);
CREATE INDEX idx_cet_tokens_burned ON cet_tokens(burned_at) WHERE burned_at IS NULL;
```

#### `token_burns`
```sql
CREATE TABLE token_burns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    cot_quantity DECIMAL(15, 2) NOT NULL,
    cet_quantity DECIMAL(15, 2) NOT NULL,
    cot_policy_id TEXT NOT NULL,
    cot_asset_name TEXT NOT NULL,
    cet_policy_id TEXT NOT NULL,
    cet_asset_name TEXT NOT NULL,
    burn_tx_hash TEXT NOT NULL UNIQUE,
    burned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB,
    CONSTRAINT burn_1to1_ratio CHECK (cot_quantity = cet_quantity)
);

CREATE INDEX idx_token_burns_user ON token_burns(user_id);
CREATE INDEX idx_token_burns_tx ON token_burns(burn_tx_hash);
```

### 1.2 Schema Modifications

#### Update `verification_requests` table
```sql
ALTER TABLE verification_requests
ADD COLUMN voting_enabled BOOLEAN DEFAULT false,
ADD COLUMN requires_multisig BOOLEAN DEFAULT false;
```

#### Update `projects` table
```sql
ALTER TABLE projects
ADD COLUMN voting_deadline TIMESTAMP,
ADD COLUMN validator_count INT DEFAULT 5;
```

### 1.3 Migration Script
```sql
-- Migration: 002_multi_validator_voting.sql
-- See above table definitions
```

---

## Phase 2: Aiken Smart Contracts

### 2.1 Project Structure

```
karbonica/on-chain/
├── aiken.toml
├── lib/
│   ├── types/
│   │   ├── datum.ak
│   │   ├── redeemer.ak
│   │   └── utils.ak
│   └── functions/
│       └── utils.ak
└── validators/
    ├── config_holder.ak          # Platform configuration
    ├── project_validator.ak      # Multi-sig approval
    ├── cot_minter.ak            # COT minting policy
    ├── cet_minter.ak            # CET minting policy
    └── burn_validator.ak        # COT/CET burning logic
```

### 2.2 Type Definitions

#### `lib/types/utils.ak`
```aiken
pub type Multisig {
  required: Int,  // e.g., 3 of 5
  signers: List<VerificationKeyHash>,
}

pub type Vote {
  Upvote
  Downvote
  Neutral
  Pending
}

pub type VotesCount {
  upvotes: Int,
  downvotes: Int,
  neutral: Int,
}
```

#### `lib/types/datum.ak`
```aiken
pub type ConfigDatum {
  platform_fee_address: Address,
  platform_fee_amount: Int,
  validator_multisig: Multisig,
  cot_policy_id: PolicyId,
  cet_policy_id: PolicyId,
  min_validators: Int,  // Default: 5
  approval_threshold: Int,  // e.g., 3 upvotes required
}

pub type ProjectDatum {
  project_id: ByteArray,
  developer: VerificationKeyHash,
  carbon_offset_amount: Int,
  validator_group: Multisig,
  votes_count: VotesCount,
  vote_deadline: POSIXTime,
  approved: Bool,
}

pub type CETDatum {
  owner: VerificationKeyHash,
  location: ByteArray,
  quantity: Int,
  minted_at: POSIXTime,
}
```

#### `lib/types/redeemer.ak`
```aiken
pub type ProjectRedeemer {
  CastVote { voter: VerificationKeyHash, vote: Vote }
  FinalizeVoting
  MintCOT { amount: Int }
}

pub type BurnRedeemer {
  BurnEmissions {
    cot_quantity: Int,
    cet_quantity: Int,
  }
}
```

### 2.3 Validator Implementations

#### `validators/project_validator.ak`
```aiken
use aiken/list
use aiken/transaction.{ScriptContext, Spend, Transaction}
use aiken/interval
use lib/types/datum.{ProjectDatum}
use lib/types/redeemer.{ProjectRedeemer, CastVote, FinalizeVoting, MintCOT}
use lib/types/utils.{Vote, Upvote, Downvote, Neutral}

validator project_validator {
  spend(
    datum: Option<ProjectDatum>,
    redeemer: ProjectRedeemer,
    _oref: OutputReference,
    ctx: ScriptContext,
  ) {
    when datum is {
      Some(project_datum) -> {
        let tx = ctx.transaction

        when redeemer is {
          // Action 1: Cast Vote
          CastVote { voter, vote } -> {
            // Find output continuing the project
            expect Some(output) =
              list.find(tx.outputs, fn(out) {
                out.address == ctx.script_address
              })

            expect Some(output_datum) = output.datum
            expect output_project_datum: ProjectDatum = output_datum

            and {
              // Voter must sign transaction
              list.has(tx.extra_signatories, voter),
              // Voter must be in validator group
              list.has(project_datum.validator_group.signers, voter),
              // Before deadline
              interval.is_before(tx.validity_range.upper_bound, project_datum.vote_deadline),
              // Update vote count correctly
              vote_count_updated(project_datum, output_project_datum, vote),
              // Other fields unchanged
              project_datum.project_id == output_project_datum.project_id,
              project_datum.developer == output_project_datum.developer,
            }
          }

          // Action 2: Finalize Voting
          FinalizeVoting -> {
            and {
              // After deadline
              interval.is_after(tx.validity_range.lower_bound, project_datum.vote_deadline),
              // Calculate approval
              project_datum.votes_count.upvotes > project_datum.votes_count.downvotes,
              // No further actions if rejected
              True
            }
          }

          // Action 3: Mint COT (after approval)
          MintCOT { amount } -> {
            // Get config from reference input
            expect Some(config_input) = list.head(tx.reference_inputs)
            expect Some(config_datum_data) = config_input.output.datum
            expect config_datum: ConfigDatum = config_datum_data

            and {
              // Project must be approved
              project_datum.approved == True,
              // Voting finalized (after deadline)
              interval.is_after(tx.validity_range.lower_bound, project_datum.vote_deadline),
              // Require multisig from validator group
              verify_multisig(
                tx.extra_signatories,
                project_datum.validator_group.signers,
                project_datum.validator_group.required
              ),
              // Mint exact amount to developer
              mint_to_developer(tx, config_datum.cot_policy_id, amount, project_datum.developer),
            }
          }
        }
      }
      None -> False
    }
  }
}

// Helper: Verify multisig threshold
fn verify_multisig(
  extra_signatories: List<VerificationKeyHash>,
  authorized_signers: List<VerificationKeyHash>,
  required: Int,
) -> Bool {
  let valid_sigs = list.filter(
    extra_signatories,
    fn(sig) { list.has(authorized_signers, sig) }
  )
  list.length(valid_sigs) >= required
}

// Helper: Vote count increment
fn vote_count_updated(
  input: ProjectDatum,
  output: ProjectDatum,
  vote: Vote,
) -> Bool {
  when vote is {
    Upvote -> output.votes_count.upvotes == input.votes_count.upvotes + 1
    Downvote -> output.votes_count.downvotes == input.votes_count.downvotes + 1
    Neutral -> output.votes_count.neutral == input.votes_count.neutral + 1
    _ -> False
  }
}

// Helper: Verify COT minting to developer
fn mint_to_developer(
  tx: Transaction,
  cot_policy: PolicyId,
  amount: Int,
  developer: VerificationKeyHash,
) -> Bool {
  // Find output to developer
  expect Some(dev_output) = list.find(
    tx.outputs,
    fn(out) { out.address.payment_credential == VerificationKeyCredential(developer) }
  )

  // Verify COT tokens in output
  let cot_qty = assets.quantity_of(dev_output.value, cot_policy, "COT")
  cot_qty == amount
}
```

#### `validators/cot_minter.ak`
```aiken
use aiken/transaction.{Mint, ScriptContext}
use lib/types/redeemer.{ProjectRedeemer}

validator cot_minter {
  mint(
    redeemer: ProjectRedeemer,
    _policy_id: PolicyId,
    ctx: ScriptContext,
  ) {
    when redeemer is {
      MintCOT { amount } -> {
        // Delegate to project_validator for authorization
        // This minting policy is parameterized with project_validator address
        let tx = ctx.transaction

        // Must spend from project_validator (proves authorization)
        expect Some(_project_input) = list.find(
          tx.inputs,
          fn(input) { input.output.address == project_validator_address }
        )

        // Mint positive amount
        amount > 0
      }

      _ -> False
    }
  }
}
```

#### `validators/cet_minter.ak`
```aiken
use aiken/transaction.{Mint, ScriptContext}
use lib/types/datum.{CETDatum}

validator cet_minter {
  mint(
    redeemer: CETDatum,
    policy_id: PolicyId,
    ctx: ScriptContext,
  ) {
    let tx = ctx.transaction
    let CETDatum { owner, location, quantity, minted_at } = redeemer

    // Extract minted quantity
    expect [Pair(token_name, qty)] =
      tx.mint
      |> assets.tokens(policy_id)
      |> dict.to_pairs()

    if qty > 0 {
      // MINTING PATH
      and {
        // Quantity matches
        qty == quantity,
        // Owner must sign
        list.has(tx.extra_signatories, owner),
        // Tokens sent to CET script address (non-transferable)
        tokens_sent_to_cet_script(tx, policy_id, token_name, qty),
      }
    } else {
      // BURNING PATH (negative quantity)
      // Handled by burn_validator
      False
    }
  }
}
```

#### `validators/burn_validator.ak`
```aiken
use aiken/transaction.{Spend, ScriptContext}
use lib/types/datum.{CETDatum}
use lib/types/redeemer.{BurnRedeemer, BurnEmissions}

validator burn_validator {
  spend(
    datum: Option<CETDatum>,
    redeemer: BurnRedeemer,
    _oref: OutputReference,
    ctx: ScriptContext,
  ) {
    when redeemer is {
      BurnEmissions { cot_quantity, cet_quantity } -> {
        let tx = ctx.transaction

        // Extract COT burn from mint (negative)
        expect [Pair(_, cot_qty)] =
          tx.mint
          |> assets.tokens(config.cot_policy_id)
          |> dict.to_pairs()

        // Extract CET burn from mint (negative)
        expect [Pair(_, cet_qty)] =
          tx.mint
          |> assets.tokens(config.cet_policy_id)
          |> dict.to_pairs()

        and {
          // Both must be burning (negative)
          cot_qty < 0,
          cet_qty < 0,
          // Enforce 1:1 ratio
          cot_qty == cet_qty,
          // Quantities match redeemer
          cot_qty == -cot_quantity,
          cet_qty == -cet_quantity,
        }
      }
    }
  }
}
```

### 2.4 Configuration Setup

#### `aiken.toml`
```toml
name = "karbonica/validators"
version = "1.0.0"
plutus = "v3"
compiler = "1.1.17"

[dependencies]
aiken-lang/stdlib = "2.2.0"

[[dependencies.source]]
name = "aiken-lang/stdlib"
version = "2.2.0"
source = "github"

[config]
network = "preview"
```

---

## Phase 3: Backend Implementation

### 3.1 Domain Entities

#### `src/domain/entities/ValidatorAssignment.ts`
```typescript
export interface ValidatorAssignment {
  id: string;
  projectId: string;
  verifierId: string;
  assignedAt: Date;
  vote: 'upvote' | 'downvote' | 'neutral' | 'pending';
  voteCastAt?: Date;
  voteSignature?: string;
  comments?: string;
}
```

#### `src/domain/entities/ProjectVote.ts`
```typescript
export interface ProjectVote {
  id: string;
  projectId: string;
  totalValidators: number;
  upvotes: number;
  downvotes: number;
  neutralVotes: number;
  pendingVotes: number;
  voteDeadline: Date;
  finalDecision: 'approved' | 'rejected' | 'pending';
  decidedAt?: Date;
  multisigTxHash?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

#### `src/domain/entities/CETToken.ts`
```typescript
export interface CETToken {
  id: string;
  userId: string;
  location?: string;
  quantity: number;
  mintingTxHash: string;
  policyId: string;
  assetName: string;
  mintedAt: Date;
  burnedAt?: Date;
  burnTxHash?: string;
  metadata?: Record<string, any>;
}
```

### 3.2 Repository Interfaces

#### `src/domain/repositories/IValidatorAssignmentRepository.ts`
```typescript
export interface IValidatorAssignmentRepository {
  create(assignment: ValidatorAssignment): Promise<ValidatorAssignment>;
  findByProjectId(projectId: string): Promise<ValidatorAssignment[]>;
  findByVerifierId(verifierId: string): Promise<ValidatorAssignment[]>;
  castVote(
    projectId: string,
    verifierId: string,
    vote: 'upvote' | 'downvote' | 'neutral',
    signature: string,
    comments?: string
  ): Promise<ValidatorAssignment>;
  findPendingAssignments(verifierId: string): Promise<ValidatorAssignment[]>;
}
```

#### `src/domain/repositories/IProjectVoteRepository.ts`
```typescript
export interface IProjectVoteRepository {
  create(projectVote: ProjectVote): Promise<ProjectVote>;
  findByProjectId(projectId: string): Promise<ProjectVote | null>;
  updateVoteCounts(projectId: string): Promise<ProjectVote>;
  finalizeVote(projectId: string, decision: 'approved' | 'rejected', txHash?: string): Promise<ProjectVote>;
  findPendingVotes(): Promise<ProjectVote[]>;
  findExpiredVotes(): Promise<ProjectVote[]>;
}
```

#### `src/domain/repositories/ICETTokenRepository.ts`
```typescript
export interface ICETTokenRepository {
  create(token: CETToken): Promise<CETToken>;
  findByUserId(userId: string): Promise<CETToken[]>;
  findUnburnedByUserId(userId: string): Promise<CETToken[]>;
  markAsBurned(tokenId: string, burnTxHash: string): Promise<CETToken>;
  getTotalEmissions(userId: string): Promise<number>;
}
```

### 3.3 Application Services

#### `src/application/services/ValidatorAssignmentService.ts`
```typescript
import { randomInt } from 'crypto';

export class ValidatorAssignmentService {
  constructor(
    private validatorAssignmentRepo: IValidatorAssignmentRepository,
    private userRepo: IUserRepository,
    private projectVoteRepo: IProjectVoteRepository
  ) {}

  /**
   * Assign 5 random validators to a project
   */
  async assignValidatorsToProject(projectId: string): Promise<ValidatorAssignment[]> {
    // Get all verifiers
    const verifiers = await this.userRepo.findByRole('VERIFIER');

    if (verifiers.length < 5) {
      throw new ValidationError('Insufficient verifiers on platform (minimum 5 required)');
    }

    // Randomly select 5 verifiers
    const selectedVerifiers = this.selectRandomVerifiers(verifiers, 5);

    // Create assignments
    const assignments = await Promise.all(
      selectedVerifiers.map(verifier =>
        this.validatorAssignmentRepo.create({
          id: uuid(),
          projectId,
          verifierId: verifier.id,
          assignedAt: new Date(),
          vote: 'pending',
        })
      )
    );

    // Create project vote record
    const voteDeadline = new Date();
    voteDeadline.setDate(voteDeadline.getDate() + 14); // 14-day voting period

    await this.projectVoteRepo.create({
      id: uuid(),
      projectId,
      totalValidators: 5,
      upvotes: 0,
      downvotes: 0,
      neutralVotes: 0,
      pendingVotes: 5,
      voteDeadline,
      finalDecision: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return assignments;
  }

  /**
   * Cast a validator's vote
   */
  async castVote(
    projectId: string,
    verifierId: string,
    vote: 'upvote' | 'downvote' | 'neutral',
    signature: string,
    comments?: string
  ): Promise<void> {
    // Record the vote
    await this.validatorAssignmentRepo.castVote(
      projectId,
      verifierId,
      vote,
      signature,
      comments
    );

    // Update vote counts
    await this.projectVoteRepo.updateVoteCounts(projectId);

    // Check if all votes are in
    await this.checkAndFinalizeVoting(projectId);
  }

  /**
   * Check if voting is complete and finalize
   */
  private async checkAndFinalizeVoting(projectId: string): Promise<void> {
    const projectVote = await this.projectVoteRepo.findByProjectId(projectId);

    if (!projectVote) return;

    // If all votes cast or deadline passed
    const allVotesCast = projectVote.pendingVotes === 0;
    const deadlinePassed = new Date() > projectVote.voteDeadline;

    if (allVotesCast || deadlinePassed) {
      // Determine decision (simple majority)
      const decision = projectVote.upvotes > projectVote.downvotes
        ? 'approved'
        : 'rejected';

      await this.projectVoteRepo.finalizeVote(projectId, decision);
    }
  }

  /**
   * Randomly select N verifiers using cryptographically secure Fisher-Yates shuffle
   * SECURITY: Uses crypto.randomInt() instead of Math.random() to prevent bias
   */
  private selectRandomVerifiers(verifiers: User[], count: number): User[] {
    // Clamp count to array length
    const safeCount = Math.min(count, verifiers.length);

    // Create a copy to avoid mutating the original array
    const shuffled = [...verifiers];

    // Fisher-Yates shuffle with cryptographically secure random
    for (let i = shuffled.length - 1; i > 0; i--) {
      // Generate secure random index from 0 to i (inclusive)
      const j = randomInt(0, i + 1);

      // Swap elements at i and j
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // Return first safeCount elements
    return shuffled.slice(0, safeCount);
  }
}
```

#### `src/application/services/CETMintingService.ts`
```typescript
export class CETMintingService {
  constructor(
    private cetTokenRepo: ICETTokenRepository,
    private cardanoTransactionService: CardanoTransactionService,
    private platformWalletService: PlatformWalletService
  ) {}

  /**
   * Mint CET tokens for emission tracking
   */
  async mintCET(
    userId: string,
    location: string,
    quantity: number,
    metadata?: Record<string, any>
  ): Promise<CETToken> {
    // Build CET minting transaction
    const mintingTx = await this.buildCETMintingTransaction(
      userId,
      location,
      quantity,
      metadata
    );

    // Submit to blockchain
    const txHash = await this.cardanoTransactionService.submitTransaction(mintingTx);

    // Record in database
    const cetToken = await this.cetTokenRepo.create({
      id: uuid(),
      userId,
      location,
      quantity,
      mintingTxHash: txHash,
      policyId: process.env.CET_POLICY_ID!,
      assetName: this.generateAssetName(userId, quantity),
      mintedAt: new Date(),
      metadata,
    });

    return cetToken;
  }

  /**
   * Build CET minting transaction using Aiken validator
   */
  private async buildCETMintingTransaction(
    userId: string,
    location: string,
    quantity: number,
    metadata?: Record<string, any>
  ): Promise<string> {
    // Implementation using MeshJS + compiled Aiken validator
    // Details in Phase 4
    throw new Error('Not implemented');
  }

  private generateAssetName(userId: string, quantity: number): string {
    return `CET_${userId.substring(0, 8)}_${quantity}`;
  }
}
```

#### `src/application/services/TokenBurningService.ts`
```typescript
export class TokenBurningService {
  constructor(
    private cetTokenRepo: ICETTokenRepository,
    private creditEntryRepo: ICreditEntryRepository,
    private cardanoTransactionService: CardanoTransactionService
  ) {}

  /**
   * Burn COT and CET at 1:1 ratio
   */
  async burnTokens(
    userId: string,
    cotQuantity: number
  ): Promise<{ burnTxHash: string }> {
    // Verify user has sufficient CET tokens
    const unburnedCETs = await this.cetTokenRepo.findUnburnedByUserId(userId);
    const totalCET = unburnedCETs.reduce((sum, cet) => sum + cet.quantity, 0);

    if (totalCET < cotQuantity) {
      throw new ValidationError(
        `Insufficient CET tokens. Required: ${cotQuantity}, Available: ${totalCET}`
      );
    }

    // Build burning transaction (1:1 COT:CET ratio)
    const burnTx = await this.buildBurnTransaction(userId, cotQuantity, cotQuantity);

    // Submit to blockchain
    const txHash = await this.cardanoTransactionService.submitTransaction(burnTx);

    // Mark CET tokens as burned
    const cetsTourn = this.selectCETsForBurning(unburnedCETs, cotQuantity);
    await Promise.all(
      cetsTourn.map(cet => this.cetTokenRepo.markAsBurned(cet.id, txHash))
    );

    // Record burn transaction
    await this.recordBurnTransaction(userId, cotQuantity, cotQuantity, txHash);

    return { burnTxHash: txHash };
  }

  /**
   * Automatic burning when COT transferred to buyer
   */
  async handleCOTTransfer(
    senderId: string,
    recipientId: string,
    cotQuantity: number
  ): Promise<void> {
    // Check if recipient has CET tokens
    const recipientCETs = await this.cetTokenRepo.findUnburnedByUserId(recipientId);
    const totalRecipientCET = recipientCETs.reduce((sum, cet) => sum + cet.quantity, 0);

    // If recipient has sufficient CET, auto-burn
    if (totalRecipientCET >= cotQuantity) {
      await this.burnTokens(recipientId, cotQuantity);
      logger.info('Auto-burned COT/CET on transfer', {
        recipientId,
        quantity: cotQuantity,
      });
    }
  }

  private selectCETsForBurning(cets: CETToken[], quantity: number): CETToken[] {
    // FIFO selection
    const selected: CETToken[] = [];
    let remaining = quantity;

    for (const cet of cets) {
      if (remaining <= 0) break;
      selected.push(cet);
      remaining -= cet.quantity;
    }

    return selected;
  }

  private async buildBurnTransaction(
    userId: string,
    cotQuantity: number,
    cetQuantity: number
  ): Promise<string> {
    // Implementation using Aiken burn_validator
    // Details in Phase 4
    throw new Error('Not implemented');
  }

  private async recordBurnTransaction(
    userId: string,
    cotQuantity: number,
    cetQuantity: number,
    txHash: string
  ): Promise<void> {
    // Record in token_burns table
    await pool.query(
      `INSERT INTO token_burns
       (id, user_id, cot_quantity, cet_quantity, cot_policy_id, cot_asset_name,
        cet_policy_id, cet_asset_name, burn_tx_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        uuid(),
        userId,
        cotQuantity,
        cetQuantity,
        process.env.COT_POLICY_ID,
        'COT',
        process.env.CET_POLICY_ID,
        'CET',
        txHash,
      ]
    );
  }
}
```

### 3.4 Updated CreditService

#### Modify `src/application/services/CreditService.ts`
```typescript
export class CreditService {
  // Add new dependencies
  constructor(
    // ... existing dependencies
    private validatorAssignmentService: ValidatorAssignmentService,
    private projectVoteRepo: IProjectVoteRepository,
    private tokenBurningService: TokenBurningService
  ) {}

  /**
   * Issue credits after multi-validator approval
   */
  async issueCredits(projectId: string): Promise<CreditEntry> {
    // Check voting result
    const projectVote = await this.projectVoteRepo.findByProjectId(projectId);

    if (!projectVote || projectVote.finalDecision !== 'approved') {
      throw new ValidationError('Project not approved by validators');
    }

    // Get validator signatures
    const assignments = await this.validatorAssignmentService
      .validatorAssignmentRepo
      .findByProjectId(projectId);

    const approvalSignatures = assignments
      .filter(a => a.vote === 'upvote' && a.voteSignature)
      .map(a => a.voteSignature!);

    if (approvalSignatures.length < 3) {
      throw new ValidationError('Insufficient validator signatures (minimum 3 required)');
    }

    // Mint COT with multi-sig
    const cotMintingTx = await this.buildMultiSigCOTMinting(
      projectId,
      approvalSignatures
    );

    const txHash = await this.cardanoTransactionService.submitTransaction(cotMintingTx);

    // Create credit entry
    const creditEntry = await this.creditEntryRepo.create({
      // ... credit entry details
      blockchainTxHash: txHash,
    });

    return creditEntry;
  }

  /**
   * Transfer credit with automatic burning
   */
  async transferCredit(
    creditId: string,
    senderId: string,
    recipientId: string,
    quantity: number
  ): Promise<void> {
    // Perform transfer (existing logic)
    await this.performTransfer(creditId, senderId, recipientId, quantity);

    // Trigger automatic burning if recipient has CET
    await this.tokenBurningService.handleCOTTransfer(
      senderId,
      recipientId,
      quantity
    );
  }
}
```

---

## Phase 4: API Endpoints

### 4.1 Validator Assignment Routes

#### `src/routes/validators.ts`
```typescript
import express from 'express';
import { authenticate, requireRole } from '../middleware';

const router = express.Router();

/**
 * @swagger
 * /api/v1/validators/assignments/me:
 *   get:
 *     summary: Get my validator assignments
 *     tags: [Validators]
 */
router.get('/assignments/me', authenticate, requireRole('VERIFIER'), async (req, res) => {
  const assignments = await validatorAssignmentService
    .validatorAssignmentRepo
    .findByVerifierId(req.user!.id);

  res.json({
    status: 'success',
    data: { assignments },
  });
});

/**
 * @swagger
 * /api/v1/validators/assignments/:projectId/vote:
 *   post:
 *     summary: Cast vote for a project
 *     tags: [Validators]
 */
router.post('/assignments/:projectId/vote', authenticate, requireRole('VERIFIER'), async (req, res) => {
  const { projectId } = req.params;
  const { vote, signature, comments } = req.body;

  // Validate vote
  if (!['upvote', 'downvote', 'neutral'].includes(vote)) {
    throw new ValidationError('Invalid vote type');
  }

  await validatorAssignmentService.castVote(
    projectId,
    req.user!.id,
    vote,
    signature,
    comments
  );

  res.json({
    status: 'success',
    data: { message: 'Vote cast successfully' },
  });
});

/**
 * @swagger
 * /api/v1/validators/projects/:projectId/votes:
 *   get:
 *     summary: Get voting status for a project
 *     tags: [Validators]
 */
router.get('/projects/:projectId/votes', authenticate, async (req, res) => {
  const { projectId } = req.params;

  const projectVote = await projectVoteRepo.findByProjectId(projectId);
  const assignments = await validatorAssignmentRepo.findByProjectId(projectId);

  res.json({
    status: 'success',
    data: {
      projectVote,
      assignments,
    },
  });
});

export { router as validatorsRouter };
```

### 4.2 CET Token Routes

#### `src/routes/emissions.ts`
```typescript
/**
 * @swagger
 * /api/v1/emissions/mint:
 *   post:
 *     summary: Mint CET tokens for emission tracking
 *     tags: [Emissions]
 */
router.post('/mint', authenticate, async (req, res) => {
  const { location, quantity, metadata } = req.body;

  const cetToken = await cetMintingService.mintCET(
    req.user!.id,
    location,
    quantity,
    metadata
  );

  res.json({
    status: 'success',
    data: { cetToken },
  });
});

/**
 * @swagger
 * /api/v1/emissions/me:
 *   get:
 *     summary: Get my emission tokens
 *     tags: [Emissions]
 */
router.get('/me', authenticate, async (req, res) => {
  const tokens = await cetTokenRepo.findByUserId(req.user!.id);
  const totalEmissions = await cetTokenRepo.getTotalEmissions(req.user!.id);

  res.json({
    status: 'success',
    data: {
      tokens,
      totalEmissions,
    },
  });
});

/**
 * @swagger
 * /api/v1/emissions/burn:
 *   post:
 *     summary: Burn COT and CET tokens
 *     tags: [Emissions]
 */
router.post('/burn', authenticate, async (req, res) => {
  const { cotQuantity } = req.body;

  const result = await tokenBurningService.burnTokens(req.user!.id, cotQuantity);

  res.json({
    status: 'success',
    data: result,
  });
});

export { router as emissionsRouter };
```

---

## Phase 5: Integration & Testing

### 5.1 Aiken Compilation & Deployment

```bash
cd karbonica/on-chain
aiken build
aiken blueprint convert > plutus.json
```

### 5.2 Off-Chain Integration (MeshJS)

```typescript
import { MeshTxBuilder, resolveScriptHash } from '@meshsdk/core';
import plutusJson from './on-chain/plutus.json';

// Load validators
const projectValidator = plutusJson.validators.find(
  v => v.title === 'project_validator.spend'
);

// Build multi-sig COT minting transaction
async function buildMultiSigCOTMinting(
  projectId: string,
  validatorSignatures: string[]
): Promise<string> {
  const txBuilder = new MeshTxBuilder();

  // Add validator signatures as required signers
  validatorSignatures.forEach(sig => {
    txBuilder.requiredSignerHash(sig);
  });

  // Mint COT tokens
  txBuilder
    .mint({
      script: projectValidator,
      redeemer: {
        data: { alternative: 2, fields: [amount] }, // MintCOT action
      },
    })
    .mintAsset(cotPolicyId, 'COT', amount)
    .sendAsset(developerAddress, cotPolicyId, 'COT', amount);

  return txBuilder.complete();
}
```

### 5.3 Testing Plan

#### Unit Tests
- Validator assignment selection algorithm
- Vote aggregation logic
- 1:1 burn ratio validation

#### Integration Tests
- Multi-validator voting workflow
- COT minting with multi-sig
- Automatic burning on transfer

#### On-Chain Tests
```bash
aiken check
```

---

## Phase 6: Migration & Rollout

### 6.1 Database Migration
```bash
npm run migrate:up
```

### 6.2 Deploy Smart Contracts
```bash
# Compile Aiken validators
cd on-chain && aiken build

# Deploy to Cardano Preview
# (Manual deployment via cardano-cli or MeshJS)
```

### 6.3 Configuration Updates
```env
CET_POLICY_ID=<deployed_cet_policy_id>
COT_POLICY_ID=<deployed_cot_policy_id>
PROJECT_VALIDATOR_ADDRESS=<deployed_project_validator>
BURN_VALIDATOR_ADDRESS=<deployed_burn_validator>
MIN_VALIDATORS=5
APPROVAL_THRESHOLD=3
VOTING_PERIOD_DAYS=14
```

---

## Timeline Estimate

- **Phase 1** (Database): 2-3 days
- **Phase 2** (Aiken Contracts): 5-7 days
- **Phase 3** (Backend Services): 4-5 days
- **Phase 4** (API Endpoints): 2-3 days
- **Phase 5** (Integration & Testing): 3-4 days
- **Phase 6** (Migration & Rollout): 1-2 days

**Total**: ~17-24 days

---

## Key Decisions Required

1. **Approval Threshold**: How many upvotes required? (Suggested: 3 of 5)
2. **Voting Period**: How long before auto-finalization? (Suggested: 14 days)
3. **Tie-Breaking**: What happens on 2-2-1 split? (Suggested: Reject by default)
4. **CET Auto-Burn**: Should it be mandatory or optional on transfer?
5. **Validator Selection**: Truly random or weighted by reputation/experience?

---

## Next Steps

1. Review and approve this implementation plan
2. Set up Aiken development environment
3. Create database migration scripts
4. Begin implementing Aiken validators
5. Build off-chain integration layer
6. Comprehensive testing on Preview testnet
7. Production deployment

---

## References

- [KonmaORG/karbonUmbrella Repository](https://github.com/KonmaORG/karbonUmbrella)
- [Aiken Language Documentation](https://aiken-lang.org/)
- [Aiken Standard Library](https://aiken-lang.github.io/stdlib/)
- [MeshJS Documentation](https://meshjs.dev/)
- [Cardano CIP-20 (Transaction Messages)](https://cips.cardano.org/cips/cip20/)
