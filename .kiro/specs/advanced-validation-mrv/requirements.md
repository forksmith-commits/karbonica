# Requirements Document - Advanced Validation & Decentralized Governance System

## Introduction

This specification extends the existing Karbonica Carbon Credit Registry Platform with decentralized validation, zero-knowledge proofs for sensitive data, and enhanced governance mechanisms. The system transforms Karbonica from a traditional registry into a decentralized carbon standards body, similar to Verra or Gold Standard, but with distributed validators and blockchain-based transparency on Cardano Preview testnet.

The advanced system introduces new roles (Validators) and mechanisms (stake-weighted validation, ZKP circuits, DAO governance) to ensure integrity while maintaining privacy and decentralization. This builds upon the existing authentication, project management, and credit lifecycle features already implemented.

## Requirements

### Requirement 1: Validator Network and Staking

**User Story:** As a validator, I want to stake KARB tokens to participate in project validation, so that I can earn rewards for honest verification while risking stake slashing for fraudulent approvals.

#### Acceptance Criteria

1. WHEN a user registers as a validator THEN the system SHALL require minimum stake of 10,000 KARB tokens
2. WHEN a validator stakes tokens THEN the system SHALL lock the tokens in a smart contract with withdrawal delay of 14 days
3. WHEN a validator stakes tokens THEN the system SHALL record stake amount, staking timestamp, and validator status as "active"
4. WHEN a validator's stake falls below minimum THEN the system SHALL automatically set status to "inactive" and remove from validation pool
5. WHEN a validator requests unstaking THEN the system SHALL initiate 14-day unbonding period before tokens are released
6. WHEN a validator is slashed THEN the system SHALL reduce stake by penalty percentage (10-100% based on severity)
7. WHEN a validator is slashed THEN the system SHALL distribute slashed tokens to treasury (50%) and whistleblowers (50%)
8. WHEN calculating validator weight THEN the system SHALL use formula: weight = sqrt(staked_amount) to prevent plutocracy
9. WHEN selecting validators for a project THEN the system SHALL randomly select 5-7 validators weighted by stake
10. WHEN a validator has active disputes THEN the system SHALL temporarily suspend them from new assignments

### Requirement 2: Enhanced Verification with Cardano Recording

**User Story:** As a verifier, I want all verification decisions recorded immutably on Cardano Preview testnet, so that the validation process is transparent and tamper-proof.

#### Acceptance Criteria

1. WHEN a verification is approved THEN the system SHALL record approval on Cardano Preview testnet with CIP-20 metadata
2. WHEN recording verification THEN the system SHALL include project ID, verifier IDs, vote results, and timestamp in metadata
3. WHEN verification transaction is submitted THEN the system SHALL use Blockfrost API for Cardano Preview testnet
4. WHEN verification is recorded THEN the system SHALL wait for 6 confirmations before marking as finalized
5. WHEN verification transaction confirms THEN the system SHALL store transaction hash in database
6. WHEN verification is queried THEN the system SHALL provide Cardano Preview explorer link for transparency
7. WHEN verification is rejected THEN the system SHALL optionally record rejection on-chain with reason hash
8. WHEN blockchain recording fails THEN the system SHALL retry up to 3 times with exponential backoff
9. IF blockchain is unavailable THEN the system SHALL queue transactions and continue with database-only operation
10. WHEN verification certificate is generated THEN the system SHALL include Cardano transaction hash as proof

### Requirement 3: Zero-Knowledge Proof Integration for Sensitive Data

**User Story:** As a project developer, I want to prove carbon sequestration claims without revealing proprietary sensor data, so that I can maintain competitive advantage while ensuring trust.

#### Acceptance Criteria

1. WHEN a project registers with ZKP option THEN the system SHALL generate unique circuit parameters for the project
2. WHEN IoT devices submit data THEN the system SHALL accept encrypted data with ZK proof of validity
3. WHEN ZK proof is submitted THEN the system SHALL verify proof cryptographically without accessing raw data
4. WHEN ZK proof verification succeeds THEN the system SHALL accept claim as valid input for credit issuance
5. WHEN ZK proof verification fails THEN the system SHALL reject claim and notify project developer
6. WHEN generating ZK circuits THEN the system SHALL support common claim types (carbon sequestered > X tons, emissions reduced by Y%)
7. WHEN ZK proof is created THEN the system SHALL include public inputs (claim amount, timestamp, project ID) and private inputs (sensor readings)
8. WHEN validators review ZKP projects THEN the system SHALL show proof verification status and public claims only
9. WHEN ZK proof is stored THEN the system SHALL record proof, public inputs, verification result, and circuit version
10. WHEN project uses ZKP THEN the system SHALL charge additional verification fee to cover computational costs

### Requirement 4: Decentralized Project Validation Workflow

**User Story:** As a validator, I want to review project documentation and sensor data, then vote on approval, so that validation is distributed and consensus-based.

#### Acceptance Criteria

1. WHEN a project enters validation THEN the system SHALL assign 5-7 validators randomly weighted by stake
2. WHEN validators are assigned THEN the system SHALL send notification with project details, documentation, and deadline (14 days)
3. WHEN a validator reviews project THEN the system SHALL provide access to all documentation, monitoring data, and ZK proof status
4. WHEN a validator submits vote THEN the system SHALL accept vote as "approve", "reject", or "needs_more_info" with required comments
5. WHEN a validator votes "needs_more_info" THEN the system SHALL notify project developer and extend deadline by 7 days
6. WHEN calculating consensus THEN the system SHALL use stake-weighted voting: approval requires >66% of stake weight
7. WHEN consensus is reached THEN the system SHALL finalize validation and issue credits if approved
8. WHEN validation deadline expires THEN the system SHALL count non-votes as abstentions and calculate consensus from submitted votes
9. WHEN a validator consistently fails to vote THEN the system SHALL reduce their selection probability
10. WHEN validation is finalized THEN the system SHALL distribute rewards to participating validators proportional to stake weight

### Requirement 5: Validator Reputation and Slashing

**User Story:** As a platform operator, I want to slash validators who approve fraudulent projects, so that the network maintains integrity through economic incentives.

#### Acceptance Criteria

1. WHEN a project is later found fraudulent THEN the system SHALL allow dispute submission with evidence
2. WHEN a dispute is submitted THEN the system SHALL create dispute case and assign arbitration committee from DAO
3. WHEN arbitration committee reviews dispute THEN the system SHALL provide all project data, validation votes, and evidence
4. WHEN arbitration committee votes THEN the system SHALL require >75% consensus to uphold dispute
5. WHEN dispute is upheld THEN the system SHALL slash all validators who approved the fraudulent project
6. WHEN calculating slash amount THEN the system SHALL use severity-based percentage: minor (10%), moderate (30%), severe (100%)
7. WHEN validator is slashed THEN the system SHALL reduce reputation score permanently
8. WHEN validator reputation falls below threshold THEN the system SHALL ban validator from future assignments
9. WHEN slashing occurs THEN the system SHALL distribute slashed tokens to treasury and dispute submitter
10. WHEN validator is slashed THEN the system SHALL publish slashing event on-chain for transparency

### Requirement 6: Ex-Post Credit Issuance

**User Story:** As a platform operator, I want credits issued only for verified reductions that have already occurred, so that the registry maintains high integrity standards.

#### Acceptance Criteria

1. WHEN a project requests credit issuance THEN the system SHALL require monitoring data covering the claimed period
2. WHEN validating issuance request THEN the system SHALL verify claimed period is in the past (not future projections)
3. WHEN validators review monitoring data THEN the system SHALL verify actual reductions achieved vs baseline
4. WHEN validators review issuance THEN the system SHALL show actual vs projected reductions
5. WHEN credits are issued THEN the system SHALL mint quantity equal to verified actual reductions only
6. WHEN actual reductions are less than projected THEN the system SHALL issue proportional credits and flag project for review
7. WHEN project consistently under-delivers THEN the system SHALL require enhanced monitoring or suspend project
8. WHEN credits are issued THEN the system SHALL timestamp issuance and record on Cardano Preview testnet
9. WHEN credits are issued THEN the system SHALL prevent double-issuance by checking for overlapping periods
10. WHEN monitoring data is insufficient THEN the system SHALL reject issuance request and require additional data

### Requirement 7: DAO Governance for Registry Policies

**User Story:** As a KARB token holder, I want to vote on registry policies like methodologies, validator requirements, and fee structures, so that the platform evolves through community governance.

#### Acceptance Criteria

1. WHEN a governance proposal is created THEN the system SHALL require minimum 100,000 KARB tokens to propose
2. WHEN a proposal is submitted THEN the system SHALL validate proposal type (methodology, parameter change, treasury allocation)
3. WHEN a proposal enters voting THEN the system SHALL open 7-day voting period for all KARB holders
4. WHEN a token holder votes THEN the system SHALL weight vote by token balance at snapshot block
5. WHEN voting period ends THEN the system SHALL calculate results: approval requires >50% yes votes and >10% quorum
6. WHEN proposal passes THEN the system SHALL queue for execution after 2-day timelock
7. WHEN proposal is executed THEN the system SHALL apply changes automatically (update parameters, add methodology, etc.)
8. WHEN proposal fails THEN the system SHALL archive proposal and return proposer deposit minus fee
9. WHEN proposal is vetoed by emergency committee THEN the system SHALL cancel execution and refund deposit
10. WHEN governance action occurs THEN the system SHALL publish event on-chain and notify community

### Requirement 8: Methodology Registry and Standards

**User Story:** As a project developer, I want to select from approved methodologies aligned with international standards, so that my credits are recognized and credible.

#### Acceptance Criteria

1. WHEN platform initializes THEN the system SHALL include default methodologies (VCS, Gold Standard, CDM, ISO 14064)
2. WHEN a methodology is added THEN the system SHALL require DAO governance approval
3. WHEN a methodology is stored THEN the system SHALL include name, version, description, sector, baseline approach, and monitoring requirements
4. WHEN a project selects methodology THEN the system SHALL validate methodology is approved and active
5. WHEN a methodology is updated THEN the system SHALL version the methodology and allow projects to migrate
6. WHEN AI analyzes project THEN the system SHALL use methodology-specific algorithms and parameters
7. WHEN validators review project THEN the system SHALL check compliance with selected methodology requirements
8. WHEN methodology is deprecated THEN the system SHALL prevent new projects from using it but allow existing projects to continue
9. WHEN querying methodologies THEN the system SHALL provide API endpoint with filtering by sector and standard body
10. WHEN methodology is added THEN the system SHALL publish methodology details on IPFS for immutability

### Requirement 9: Interoperability with Traditional Registries

**User Story:** As a registry operator, I want to integrate with Verra, Gold Standard, and other registries, so that credits can be cross-referenced and double-issuance prevented.

#### Acceptance Criteria

1. WHEN a project is registered THEN the system SHALL allow linking to external registry ID (Verra, Gold Standard, etc.)
2. WHEN credits are issued THEN the system SHALL check external registry API for existing issuance of same project/period
3. WHEN external registry shows existing credits THEN the system SHALL reject issuance and alert project developer
4. WHEN credits are tokenized THEN the system SHALL record original registry serial number on-chain
5. WHEN credits are retired THEN the system SHALL optionally notify external registry via API webhook
6. WHEN external registry queries Karbonica THEN the system SHALL provide API endpoint to check credit status by serial number
7. WHEN credit is retired in external registry THEN the system SHALL accept webhook notification and mark credit as retired
8. WHEN integrating with registry THEN the system SHALL support OAuth 2.0 authentication for API access
9. WHEN API call to external registry fails THEN the system SHALL queue for retry and proceed with internal validation
10. WHEN credit provenance is queried THEN the system SHALL show full history including external registry linkage

### Requirement 10: KarbonNode IoT Integration

**User Story:** As a project developer, I want to connect KarbonNode IoT devices to automatically submit monitoring data, so that verification is continuous and tamper-resistant.

#### Acceptance Criteria

1. WHEN a KarbonNode device is registered THEN the system SHALL generate unique device ID and API key
2. WHEN a device submits data THEN the system SHALL authenticate using device API key
3. WHEN device data is received THEN the system SHALL validate data format, timestamp, and signature
4. WHEN device data is stored THEN the system SHALL record device ID, timestamp, sensor readings, location, and data hash
5. WHEN device submits data THEN the system SHALL optionally accept ZK proof of data validity
6. WHEN AI analyzes project THEN the system SHALL incorporate KarbonNode data as primary evidence
7. WHEN device data shows anomalies THEN the system SHALL alert project developer and validators
8. WHEN device goes offline THEN the system SHALL alert project developer after 24 hours
9. WHEN device data is queried THEN the system SHALL provide time-series API with aggregation functions
10. WHEN device is decommissioned THEN the system SHALL archive historical data and revoke API key

### Requirement 11: Credit Metadata and Provenance

**User Story:** As a credit buyer, I want to view detailed metadata about credits including project, methodology, validation history, and Cardano blockchain proof, so that I can verify authenticity.

#### Acceptance Criteria

1. WHEN credits are issued THEN the system SHALL create rich metadata including project ID, methodology, vintage, location, and validators
2. WHEN credits are tokenized THEN the system SHALL store metadata on IPFS and reference hash on Cardano Preview testnet
3. WHEN credit is queried THEN the system SHALL return metadata with project details, issuance date, current owner, and status
4. WHEN credit is transferred THEN the system SHALL append transfer event to provenance chain
5. WHEN credit is retired THEN the system SHALL append retirement event with reason and Cardano transaction hash
6. WHEN viewing credit THEN the system SHALL provide link to Cardano Preview explorer showing full transaction history
7. WHEN credit metadata is updated THEN the system SHALL version metadata and maintain historical versions
8. WHEN querying credits THEN the system SHALL support filtering by project type, vintage, methodology, and location
9. WHEN credit is displayed THEN the system SHALL show validation consensus percentage and validator list
10. WHEN credit provenance is exported THEN the system SHALL generate PDF certificate with QR code linking to Cardano blockchain proof

### Requirement 12: Validator Rewards and Economics

**User Story:** As a validator, I want to earn rewards for participating in validation, so that I am incentivized to provide quality reviews.

#### Acceptance Criteria

1. WHEN validation is completed THEN the system SHALL distribute rewards from validation fee pool
2. WHEN calculating rewards THEN the system SHALL allocate proportional to validator stake weight
3. WHEN validator votes in consensus THEN the system SHALL award full reward share
4. WHEN validator votes against consensus THEN the system SHALL award reduced reward (50%)
5. WHEN validator fails to vote THEN the system SHALL award no reward
6. WHEN validation fee is collected THEN the system SHALL split: 70% to validators, 20% to treasury, 10% to AI infrastructure
7. WHEN validator maintains high reputation THEN the system SHALL apply reputation multiplier (1.0x - 1.5x) to rewards
8. WHEN validator is slashed THEN the system SHALL forfeit rewards for that validation round
9. WHEN rewards are distributed THEN the system SHALL record distribution on-chain for transparency
10. WHEN validator claims rewards THEN the system SHALL transfer KARB tokens to validator wallet

### Requirement 13: Dispute Resolution and Arbitration

**User Story:** As a stakeholder, I want to submit disputes about project validity or validator misconduct, so that issues can be resolved fairly through arbitration.

#### Acceptance Criteria

1. WHEN a dispute is submitted THEN the system SHALL require dispute bond of 1,000 KARB tokens
2. WHEN dispute is created THEN the system SHALL assign arbitration committee of 5 DAO members randomly
3. WHEN arbitration committee is assigned THEN the system SHALL notify members and provide dispute evidence
4. WHEN arbitrators review dispute THEN the system SHALL provide 14-day review period
5. WHEN arbitrators vote THEN the system SHALL require >75% consensus to uphold dispute
6. WHEN dispute is upheld THEN the system SHALL execute remediation (slash validators, revoke credits, etc.)
7. WHEN dispute is rejected THEN the system SHALL forfeit dispute bond to treasury
8. WHEN dispute is upheld THEN the system SHALL return dispute bond plus reward from slashed stake
9. WHEN arbitration completes THEN the system SHALL publish decision on-chain with reasoning
10. WHEN dispute involves credit retirement THEN the system SHALL freeze credits pending resolution

### Requirement 14: Performance and Scalability for Validation Network

**User Story:** As a platform operator, I want the validation network to scale to thousands of validators and projects, so that the platform can grow without performance degradation.

#### Acceptance Criteria

1. WHEN selecting validators THEN the system SHALL complete selection in <1 second for pool of 10,000 validators
2. WHEN calculating consensus THEN the system SHALL aggregate votes in <5 seconds for 100 validators
3. WHEN AI analyzes project THEN the system SHALL complete analysis in <10 minutes for standard project
4. WHEN ZK proof is verified THEN the system SHALL complete verification in <30 seconds
5. WHEN querying validator stats THEN the system SHALL use materialized views refreshed every 5 minutes
6. WHEN distributing rewards THEN the system SHALL batch process up to 1,000 validators in single transaction
7. WHEN storing monitoring data THEN the system SHALL use time-series database optimized for IoT data
8. WHEN querying credit provenance THEN the system SHALL cache blockchain data with 5-minute TTL
9. WHEN system is under load THEN the system SHALL maintain p95 API response time <1 second
10. WHEN validator network grows THEN the system SHALL horizontally scale validation assignment service

### Requirement 15: Security and Anti-Fraud Measures

**User Story:** As a security officer, I want comprehensive fraud detection and prevention mechanisms, so that the platform resists manipulation and maintains integrity.

#### Acceptance Criteria

1. WHEN validator votes are submitted THEN the system SHALL detect collusion patterns (same validators always voting together)
2. WHEN collusion is detected THEN the system SHALL flag validators for investigation and reduce selection probability
3. WHEN project data is submitted THEN the system SHALL verify data signatures and timestamps to prevent tampering
4. WHEN ZK proof is submitted THEN the system SHALL verify proof was generated with approved circuit
5. WHEN validator stake changes THEN the system SHALL monitor for suspicious patterns (stake just before vote, unstake after)
6. WHEN credit is transferred THEN the system SHALL check for wash trading patterns
7. WHEN project submits monitoring data THEN the system SHALL verify data consistency with historical patterns
8. WHEN validator is assigned THEN the system SHALL check for conflicts of interest (same company as project developer)
9. WHEN fraud is detected THEN the system SHALL automatically freeze involved accounts and alert security team
10. WHEN suspicious activity is detected THEN the system SHALL record evidence on Cardano Preview testnet for immutable audit trail

