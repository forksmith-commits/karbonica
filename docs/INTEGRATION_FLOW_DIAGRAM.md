# Aiken ↔ TypeScript Integration: Visual Flow

## The Big Picture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         YOUR TYPESCRIPT BACKEND                          │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌─────────────────┐                                                     │
│  │   Express API   │                                                     │
│  │  /api/v1/...    │                                                     │
│  └────────┬────────┘                                                     │
│           │                                                              │
│           ▼                                                              │
│  ┌─────────────────────────┐                                            │
│  │  Application Services   │                                            │
│  │  - CreditService        │                                            │
│  │  - ValidationService    │                                            │
│  └────────┬────────────────┘                                            │
│           │                                                              │
│           ▼                                                              │
│  ┌─────────────────────────────────────┐                                │
│  │   Domain Services (Blockchain)      │                                │
│  │   - MultiSigCOTMintingService       │                                │
│  │   - TokenBurningService             │                                │
│  └────────┬────────────────────────────┘                                │
│           │                                                              │
│           ▼                                                              │
│  ┌─────────────────────────────────────┐                                │
│  │   Infrastructure Layer              │                                │
│  │   - AikenValidatorService  ◄────────┼─── Loads plutus.json          │
│  │   - PlutusDataBuilder               │                                │
│  │   - MeshJS Transaction Builder      │                                │
│  └────────┬────────────────────────────┘                                │
│           │                                                              │
└───────────┼──────────────────────────────────────────────────────────────┘
            │
            │ Built Transaction (CBOR)
            │
            ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                         CARDANO BLOCKCHAIN                               │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌─────────────────────────┐                                            │
│  │   Blockfrost API        │                                            │
│  │   (Submit Transaction)  │                                            │
│  └────────┬────────────────┘                                            │
│           │                                                              │
│           ▼                                                              │
│  ┌─────────────────────────┐                                            │
│  │   Cardano Node          │                                            │
│  │   (Validate & Execute)  │                                            │
│  └────────┬────────────────┘                                            │
│           │                                                              │
│           ▼                                                              │
│  ┌──────────────────────────────────────┐                               │
│  │   PLUTUS SCRIPT EXECUTION            │                               │
│  │                                      │                               │
│  │   Your Aiken Validator Runs Here:   │                               │
│  │   ┌────────────────────────────┐    │                               │
│  │   │ spend(datum, redeemer, tx) │    │                               │
│  │   │   - Check multisig         │    │                               │
│  │   │   - Verify votes           │    │                               │
│  │   │   - Validate amounts       │    │                               │
│  │   │   - Return Bool            │    │                               │
│  │   └────────────────────────────┘    │                               │
│  │                                      │                               │
│  │   ✓ True  → Transaction commits     │                               │
│  │   ✗ False → Transaction rejected    │                               │
│  └──────────────────────────────────────┘                               │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## Detailed Transaction Flow

### Step 1: Developer Submits Project

```
User (Browser)
    │
    │ POST /api/v1/projects
    ▼
Express API
    │
    │ projectService.create()
    ▼
Database: INSERT INTO projects
    │
    │ validatorAssignmentService.assign()
    ▼
Database: INSERT INTO validator_assignments (5 random validators)
```

### Step 2: Validators Cast Votes

```
Validator 1-5 (Browser)
    │
    │ POST /api/v1/validators/assignments/:id/vote
    │ Body: { vote: 'upvote', signature: 'pubkeyhash_xxx' }
    ▼
Express API
    │
    │ validatorAssignmentService.castVote()
    ▼
Database: UPDATE validator_assignments SET vote = 'upvote'
    │
    │ projectVoteRepo.updateVoteCounts()
    ▼
Database: UPDATE project_votes SET upvotes = upvotes + 1
    │
    │ If all votes cast or deadline passed:
    │ projectVoteRepo.finalizeVote()
    ▼
Database: UPDATE project_votes SET final_decision = 'approved'
```

### Step 3: Mint COT with Multi-Sig (THE BLOCKCHAIN PART)

```
Admin/System Trigger
    │
    │ POST /api/v1/credits/issue
    ▼
CreditService.issueCreditsWithMultiSig()
    │
    │ 1. Check approval status
    │ 2. Get validator signatures
    ▼
MultiSigCOTMintingService.mintCOTWithMultiSig()
    │
    │ A. Build Plutus Datum
    │    PlutusDataBuilder.buildProjectDatum({
    │      projectId, developer, amount,
    │      validatorGroup: { required: 3, signers: [v1, v2, v3, v4, v5] },
    │      approved: true
    │    })
    │
    │ B. Build Plutus Redeemer
    │    PlutusDataBuilder.buildMintCOTRedeemer(1000)
    │
    ▼
AikenValidatorService.buildMintTransaction()
    │
    │ Uses MeshJS:
    │
    │ txBuilder
    │   .mintPlutusScriptV3()
    │   .mint(1000, COT_POLICY_ID, 'COT')
    │   .mintingScript(validator.compiledCode)  ◄─── Your Aiken validator!
    │   .mintRedeemerValue(redeemer)
    │   .requiredSignerHash(validator1_hash)
    │   .requiredSignerHash(validator2_hash)
    │   .requiredSignerHash(validator3_hash)
    │   .txOut(developerAddress, '1000 COT')
    │   .changeAddress(platformWalletAddress)
    │   .complete()
    │
    ▼
PlatformWalletService.signTx(unsignedTx)
    │
    │ Signs with platform wallet private key
    ▼
BlockfrostProvider.submitTx(signedTx)
    │
    │ Submits CBOR transaction to Cardano
    ▼
┌─────────────────────────────────────────┐
│       CARDANO BLOCKCHAIN                │
│                                         │
│  Your Aiken Validator Executes:        │
│                                         │
│  validator cot_minter {                 │
│    mint(redeemer, policy_id, ctx) {     │
│      // Check if project validator      │
│      // authorized this mint            │
│                                         │
│      expect Some(project_input) =       │
│        find_input_by_validator(         │
│          ctx.transaction.inputs         │
│        )                                │
│                                         │
│      // Verify multisig                 │
│      verify_multisig(                   │
│        ctx.transaction.extra_sigs,      │
│        project_datum.validator_group    │
│      )                                  │
│    }                                    │
│  }                                      │
│                                         │
│  ✓ Validation passes                   │
│  → Transaction commits to ledger        │
│  → 1000 COT minted to developer         │
└─────────────────────────────────────────┘
    │
    │ txHash returned
    ▼
Database: INSERT INTO credit_entries
    SET blockchain_tx_hash = txHash
```

---

## Key Insight: Smart Contracts Don't "Run" - They "Validate"

### Traditional Backend (e.g., REST API):

```javascript
// Your code executes and performs actions
function mintTokens(userId, amount) {
  const tokens = createTokens(amount);  // ← Action happens here
  database.save(userId, tokens);
  return tokens;
}
```

### Cardano Smart Contract (Aiken/Plutus):

```aiken
// Your code validates a transaction that ALREADY happened
validator cot_minter {
  mint(redeemer, policy_id, tx) {
    // Transaction already contains:
    // - mint: +1000 COT
    // - output to developer
    // - signatures

    // Your job: Check if this is allowed
    and {
      is_authorized(tx),      // ← Just checking
      has_multisig(tx),       // ← Just checking
      amount_correct(tx)      // ← Just checking
    }
    // Return true/false
  }
}
```

**Key Difference:**
- **Traditional**: Code performs action → Database updates
- **Cardano**: Transaction proposes action → Validator checks → Ledger updates

---

## What TypeScript Does vs What Aiken Does

| TypeScript Backend | Aiken Validator |
|-------------------|-----------------|
| Fetch data from database | Validate transaction structure |
| Apply business logic | Enforce on-chain rules |
| Build transactions | Execute validation logic |
| Sign with wallet | Check signatures present |
| Submit to Cardano | Return true/false |
| Store results in DB | (Ledger stores state) |

---

## Data Flow: Datum & Redeemer

```
TypeScript                        Cardano Blockchain
    │                                  │
    │ Build Datum                      │
    │ { projectId: "abc",              │
    │   approved: true,                │
    │   validators: [...] }            │
    │                                  │
    │ Encode to Plutus Data            │
    │ (CBOR format)                    │
    │                                  │
    │ Build Redeemer                   │
    │ MintCOT { amount: 1000 }         │
    │                                  │
    │ Create Transaction               │
    │ - Inputs: [validator UTXO]       │
    │ - Outputs: [COT to developer]    │
    │ - Mint: +1000 COT                │
    │ - Datum: {...}                   │
    │ - Redeemer: MintCOT              │
    │ - Signers: [v1, v2, v3]          │
    │                                  │
    │ Sign & Submit ───────────────────┼──► Transaction received
    │                                  │
    │                                  │   Decode CBOR
    │                                  │   Extract datum/redeemer
    │                                  │
    │                                  │   Execute validator:
    │                                  │   spend(datum, redeemer, tx) {
    │                                  │     // Your Aiken code runs
    │                                  │     verify_multisig(...)
    │                                  │     return true/false
    │                                  │   }
    │                                  │
    │                                  │   ✓ True → Commit
    │                                  │   ✗ False → Reject
    │                                  │
    │ Receive txHash ◄─────────────────┼─── Transaction committed
    │                                  │
    │ Store in database                │   State on ledger
    │                                  │
```

---

## File Organization

```
karbonica/
├── on-chain/                          # Aiken smart contracts
│   └── validators/
│       ├── aiken.toml
│       ├── lib/
│       │   ├── types/
│       │   │   ├── datum.ak           # Datum structures
│       │   │   ├── redeemer.ak        # Redeemer types
│       │   │   └── utils.ak           # Custom types
│       │   └── functions/
│       │       └── utils.ak           # Helper functions
│       ├── validators/
│       │   ├── project_validator.ak   # Main validator
│       │   ├── cot_minter.ak          # COT minting
│       │   ├── cet_minter.ak          # CET minting
│       │   └── burn_validator.ak      # Burning logic
│       └── plutus.json                # ← Compiled output
│
├── src/                               # TypeScript backend
│   ├── domain/
│   │   └── services/
│   │       └── MultiSigCOTMintingService.ts  # Uses validators
│   ├── infrastructure/
│   │   └── services/
│   │       ├── AikenValidatorService.ts      # Loads plutus.json
│   │       └── PlutusDataBuilder.ts          # Builds datum/redeemer
│   └── routes/
│       └── validators.ts              # API endpoints
│
└── .env
    ├── COT_POLICY_ID=...              # From deployed validator
    ├── CET_POLICY_ID=...
    └── PROJECT_VALIDATOR_ADDRESS=...
```

---

## Development Workflow

### Day-to-Day Development:

```bash
# 1. Make changes to Aiken validator
vim on-chain/validators/validators/project_validator.ak

# 2. Test locally
cd on-chain/validators
aiken check

# 3. Rebuild
aiken build

# 4. Update plutus.json
aiken blueprint convert > plutus.json

# 5. TypeScript automatically picks up new plutus.json
# (No redeployment needed during development)

# 6. Test TypeScript integration
npm test

# 7. Test on Preview testnet
npm run dev
# Submit test transaction

# 8. Verify on Cardanoscan
# https://preview.cardanoscan.io/transaction/<txHash>
```

### One-Time Deployment:

```bash
# Only when deploying to production or changing validator logic

# 1. Compile final version
cd on-chain/validators
aiken build

# 2. Get validator address
aiken blueprint address project_validator --network preview

# 3. Update .env with deployed addresses
echo "PROJECT_VALIDATOR_ADDRESS=addr_test1..." >> .env

# 4. Deploy (validator address is deterministic, no on-chain deployment needed)
# Just start using the address in your transactions!
```

---

## The "Aha!" Moment

### You Don't Deploy Validators Like APIs

**Traditional Web API:**
```
1. Write code
2. Deploy to server
3. API is "running"
4. Clients call API endpoints
```

**Cardano Validators:**
```
1. Write Aiken code
2. Compile to Plutus
3. Validator script gets EMBEDDED in transactions
4. Cardano node executes validator when transaction is submitted
5. Validator is NOT a running service - it's a SCRIPT
```

### Analogy

**Traditional:** Your validator is like a **security guard at a building** - always present, checks everyone

**Cardano:** Your validator is like **rules written in a contract** - the contract travels with each transaction, and a judge (Cardano node) reads and enforces it

---

## Cost Breakdown

### Development (One-Time):
- ✅ **FREE** - Writing Aiken code
- ✅ **FREE** - Compiling to Plutus
- ✅ **FREE** - Testing locally
- ~10 ADA - Testing on Preview testnet

### Production (Per Transaction):
- ~0.5-2 ADA - Plutus script execution fee
- ~0.17 ADA - Base transaction fee
- ~0.2 ADA - Minting fee
- **Total: ~1-2.5 ADA per mint**

---

## Security Model

### What Aiken Enforces On-Chain:
✓ Multisig threshold (3 of 5)
✓ Correct mint amounts
✓ Authorized signers only
✓ Valid datum structure
✓ 1:1 burn ratios

### What TypeScript Handles Off-Chain:
✓ User authentication
✓ Database integrity
✓ API rate limiting
✓ Email notifications
✓ Logging/monitoring

**Both layers work together for complete security!**

---

## Summary

**YES, you can execute Aiken smart contracts from TypeScript!**

The pattern is:
1. **Write** validators in Aiken
2. **Compile** to Plutus (plutus.json)
3. **Load** compiled validators in TypeScript (AikenValidatorService)
4. **Build** transactions using MeshJS
5. **Embed** validator scripts in transactions
6. **Submit** to Cardano via Blockfrost
7. **Validator executes** on Cardano nodes
8. **Result** returned to TypeScript

Your TypeScript backend **orchestrates** the process.
Your Aiken validators **enforce** the rules on-chain.

Perfect separation of concerns! 🚀
