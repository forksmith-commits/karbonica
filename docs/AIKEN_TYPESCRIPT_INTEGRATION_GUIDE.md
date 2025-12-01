# Aiken Smart Contract ↔ TypeScript Backend Integration Guide

## Overview

Yes, you **can absolutely execute Aiken/Plutus smart contracts from a TypeScript backend**. Here's the complete architecture and workflow.

## How It Works: The Complete Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    Development Phase                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  1. Write Aiken Validators                                       │
│     └─> validators/project_validator.ak                          │
│                                                                   │
│  2. Compile Aiken → Plutus                                       │
│     └─> aiken build                                              │
│     └─> plutus.json (compiled validators)                        │
│                                                                   │
│  3. Deploy to Cardano                                            │
│     └─> Get validator addresses/hashes                           │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                    Runtime Phase                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  TypeScript Backend                                              │
│  ├─> Load plutus.json                                            │
│  ├─> Build transaction (MeshJS/Lucid/CSL)                        │
│  │   ├─> Add validator script                                    │
│  │   ├─> Add datum (inline or hash)                              │
│  │   ├─> Add redeemer                                            │
│  │   └─> Add required signers                                    │
│  ├─> Sign with platform wallet                                   │
│  └─> Submit to Cardano                                           │
│      └─> Blockfrost API                                          │
│                                                                   │
│  Cardano Blockchain                                              │
│  ├─> Receive transaction                                         │
│  ├─> Execute Plutus validator                                    │
│  │   └─> Validate datum/redeemer/context                         │
│  ├─> Success: Commit to ledger                                   │
│  └─> Failure: Reject transaction                                 │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Concepts

### 1. **Aiken Compiles to Plutus**
- Aiken is a high-level language
- Compiles to Plutus Core (Untyped Plutus Core - UPLC)
- Output: `plutus.json` with compiled validators

### 2. **TypeScript Uses Libraries to Build Transactions**
- **MeshJS**: High-level, user-friendly (recommended)
- **Lucid**: Lightweight, flexible
- **Cardano Serialization Library (CSL)**: Low-level, full control

### 3. **Smart Contracts Are NOT Called Like APIs**
- Smart contracts are **validators** that verify transactions
- Your backend **builds transactions** that the validator checks
- The validator runs **on-chain** when the transaction is submitted

### 4. **Data Flow**
```
Backend → Build Tx → Submit to Cardano → Validator Executes → Result
```

---

## Integration Architecture

### Library Comparison

| Feature | MeshJS | Lucid | CSL |
|---------|--------|-------|-----|
| **Ease of Use** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ |
| **Documentation** | Excellent | Good | Moderate |
| **Aiken Support** | ✅ Yes | ✅ Yes | ✅ Yes |
| **TypeScript** | Native | Native | Bindings |
| **Learning Curve** | Easy | Moderate | Steep |
| **Plutus V3** | ✅ Yes | ✅ Yes | ✅ Yes |
| **Bundle Size** | Large | Small | Medium |
| **Best For** | Full apps | Lightweight apps | Custom needs |

**Recommendation for Karbonica**: **MeshJS** (easiest integration, good docs, active development)

---

## Implementation: Step-by-Step

### Step 1: Set Up Aiken Project

```bash
cd karbonica
mkdir on-chain
cd on-chain
aiken new validators
cd validators
```

### Step 2: Write Aiken Validator

**File**: `on-chain/validators/project_validator.ak`

```aiken
use aiken/list
use aiken/transaction.{ScriptContext, Spend, Transaction}
use cardano/assets

pub type ProjectDatum {
  project_id: ByteArray,
  developer: VerificationKeyHash,
  carbon_offset_amount: Int,
  validator_group: Multisig,
  votes_count: VotesCount,
  approved: Bool,
}

pub type ProjectRedeemer {
  CastVote { voter: VerificationKeyHash, vote: Vote }
  MintCOT { amount: Int }
}

validator project_validator {
  spend(
    datum: Option<ProjectDatum>,
    redeemer: ProjectRedeemer,
    _oref: OutputReference,
    ctx: ScriptContext,
  ) {
    when redeemer is {
      MintCOT { amount } -> {
        expect Some(project_datum) = datum

        and {
          // Project must be approved
          project_datum.approved == True,
          // Multisig verification
          verify_multisig(
            ctx.transaction.extra_signatories,
            project_datum.validator_group.signers,
            project_datum.validator_group.required
          ),
        }
      }
      _ -> False
    }
  }
}

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
```

### Step 3: Compile Aiken

```bash
cd on-chain/validators
aiken build
aiken blueprint convert > plutus.json
```

**Output**: `plutus.json` contains compiled validators in CBOR format

### Step 4: Install TypeScript Dependencies

```bash
npm install @meshsdk/core @meshsdk/core-cst @meshsdk/provider
```

### Step 5: Create TypeScript Integration Layer

**File**: `src/infrastructure/services/AikenValidatorService.ts`

```typescript
import { MeshTxBuilder, BlockfrostProvider, resolveScriptHash, serializePlutusScript } from '@meshsdk/core';
import { applyParamsToScript } from '@meshsdk/core-cst';
import fs from 'fs';
import path from 'path';

interface PlutusValidator {
  title: string;
  compiledCode: string;
  hash: string;
}

export class AikenValidatorService {
  private validators: Map<string, PlutusValidator>;
  private provider: BlockfrostProvider;

  constructor() {
    // Load compiled validators
    const plutusJson = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, '../../../on-chain/validators/plutus.json'),
        'utf8'
      )
    );

    // Index validators by title
    this.validators = new Map();
    plutusJson.validators.forEach((v: any) => {
      this.validators.set(v.title, {
        title: v.title,
        compiledCode: v.compiledCode,
        hash: v.hash,
      });
    });

    // Initialize Blockfrost provider
    this.provider = new BlockfrostProvider(
      process.env.BLOCKFROST_API_KEY!
    );
  }

  /**
   * Get validator by name
   */
  getValidator(name: string): PlutusValidator {
    const validator = this.validators.get(name);
    if (!validator) {
      throw new Error(`Validator not found: ${name}`);
    }
    return validator;
  }

  /**
   * Get validator script address
   */
  getValidatorAddress(validatorName: string, network: 'testnet' | 'mainnet' = 'testnet'): string {
    const validator = this.getValidator(validatorName);
    const scriptHash = resolveScriptHash(validator.compiledCode, 'PlutusV3');

    // Generate address from script hash
    const addressPrefix = network === 'mainnet' ? 'addr' : 'addr_test';
    return `${addressPrefix}1${scriptHash}`;
  }

  /**
   * Build transaction to spend from validator
   */
  async buildSpendFromValidator(params: {
    validatorName: string;
    utxoToSpend: any;
    datum: any;
    redeemer: any;
    requiredSigners: string[];
    outputs: Array<{ address: string; amount: string; assets?: any }>;
    platformWalletAddress: string;
  }): Promise<string> {
    const validator = this.getValidator(params.validatorName);
    const txBuilder = new MeshTxBuilder({ fetcher: this.provider });

    // Spend from validator
    txBuilder
      .spendingPlutusScriptV3()
      .txIn(
        params.utxoToSpend.input.txHash,
        params.utxoToSpend.input.outputIndex,
        params.utxoToSpend.output.amount,
        params.utxoToSpend.output.address
      )
      .txInInlineDatumPresent()
      .txInRedeemerValue(params.redeemer)
      .spendingReferenceTxInInlineDatumPresent()
      .spendingReferenceTxInRedeemerValue(params.redeemer)
      .txInScript(validator.compiledCode);

    // Add required signers (for multisig)
    params.requiredSigners.forEach(signer => {
      txBuilder.requiredSignerHash(signer);
    });

    // Add outputs
    params.outputs.forEach(output => {
      txBuilder.txOut(output.address, output.amount);
      if (output.assets) {
        Object.entries(output.assets).forEach(([unit, quantity]) => {
          txBuilder.txOutAsset(unit, quantity as string);
        });
      }
    });

    // Add change address
    txBuilder.changeAddress(params.platformWalletAddress);

    // Complete and return unsigned transaction
    const unsignedTx = await txBuilder.complete();
    return unsignedTx;
  }

  /**
   * Build transaction to mint tokens using validator
   */
  async buildMintTransaction(params: {
    validatorName: string;
    policyId: string;
    assetName: string;
    quantity: number;
    redeemer: any;
    recipient: string;
    requiredSigners: string[];
    platformWalletAddress: string;
  }): Promise<string> {
    const validator = this.getValidator(params.validatorName);
    const txBuilder = new MeshTxBuilder({ fetcher: this.provider });

    // Build asset unit (policyId + hex-encoded asset name)
    const assetNameHex = Buffer.from(params.assetName).toString('hex');
    const assetUnit = params.policyId + assetNameHex;

    // Mint asset
    txBuilder
      .mintPlutusScriptV3()
      .mint(params.quantity.toString(), params.policyId, params.assetName)
      .mintingScript(validator.compiledCode)
      .mintRedeemerValue(params.redeemer);

    // Send minted tokens to recipient
    txBuilder
      .txOut(params.recipient, [])
      .txOutAsset(assetUnit, params.quantity.toString());

    // Add required signers
    params.requiredSigners.forEach(signer => {
      txBuilder.requiredSignerHash(signer);
    });

    // Change address
    txBuilder.changeAddress(params.platformWalletAddress);

    // Complete
    const unsignedTx = await txBuilder.complete();
    return unsignedTx;
  }

  /**
   * Build transaction to lock funds at validator with datum
   */
  async buildLockAtValidator(params: {
    validatorName: string;
    amount: string;
    datum: any;
    assets?: any;
    fromAddress: string;
  }): Promise<string> {
    const validatorAddress = this.getValidatorAddress(params.validatorName, 'testnet');
    const txBuilder = new MeshTxBuilder({ fetcher: this.provider });

    // Send to validator with inline datum
    txBuilder
      .txOut(validatorAddress, [{ unit: 'lovelace', quantity: params.amount }])
      .txOutInlineDatumValue(params.datum);

    // Add assets if provided
    if (params.assets) {
      Object.entries(params.assets).forEach(([unit, quantity]) => {
        txBuilder.txOutAsset(unit, quantity as string);
      });
    }

    // Change address
    txBuilder.changeAddress(params.fromAddress);

    const unsignedTx = await txBuilder.complete();
    return unsignedTx;
  }
}
```

### Step 6: Create Datum/Redeemer Builders

**File**: `src/infrastructure/services/PlutusDataBuilder.ts`

```typescript
import { Data } from '@meshsdk/core';

/**
 * Build ProjectDatum for Aiken validator
 */
export function buildProjectDatum(params: {
  projectId: string;
  developer: string;
  carbonOffsetAmount: number;
  validatorGroup: {
    required: number;
    signers: string[];
  };
  votesCount: {
    upvotes: number;
    downvotes: number;
    neutral: number;
  };
  approved: boolean;
}): string {
  // Aiken datum structure as Plutus Data
  const datum = Data.to({
    alternative: 0,
    fields: [
      Data.Bytes(params.projectId),                    // project_id
      Data.Bytes(params.developer),                     // developer
      Data.Integer(params.carbonOffsetAmount),          // carbon_offset_amount
      {
        alternative: 0,
        fields: [
          Data.Integer(params.validatorGroup.required), // required
          Data.List(params.validatorGroup.signers.map(s => Data.Bytes(s))), // signers
        ],
      },                                                 // validator_group
      {
        alternative: 0,
        fields: [
          Data.Integer(params.votesCount.upvotes),
          Data.Integer(params.votesCount.downvotes),
          Data.Integer(params.votesCount.neutral),
        ],
      },                                                 // votes_count
      Data.Boolean(params.approved),                     // approved
    ],
  });

  return datum;
}

/**
 * Build MintCOT redeemer
 */
export function buildMintCOTRedeemer(amount: number): string {
  // Corresponds to: MintCOT { amount }
  const redeemer = Data.to({
    alternative: 1, // Index of MintCOT in ProjectRedeemer enum
    fields: [
      Data.Integer(amount),
    ],
  });

  return redeemer;
}

/**
 * Build CastVote redeemer
 */
export function buildCastVoteRedeemer(voter: string, vote: 'upvote' | 'downvote' | 'neutral'): string {
  // Map vote to Aiken enum index
  const voteIndex = {
    upvote: 0,
    downvote: 1,
    neutral: 2,
  }[vote];

  const redeemer = Data.to({
    alternative: 0, // Index of CastVote
    fields: [
      Data.Bytes(voter),
      { alternative: voteIndex, fields: [] },
    ],
  });

  return redeemer;
}

/**
 * Build BurnEmissions redeemer
 */
export function buildBurnEmissionsRedeemer(cotQuantity: number, cetQuantity: number): string {
  const redeemer = Data.to({
    alternative: 0, // BurnEmissions
    fields: [
      Data.Integer(cotQuantity),
      Data.Integer(cetQuantity),
    ],
  });

  return redeemer;
}
```

### Step 7: Create High-Level Service

**File**: `src/domain/services/MultiSigCOTMintingService.ts`

```typescript
import { AikenValidatorService } from '../../infrastructure/services/AikenValidatorService';
import { PlutusDataBuilder, buildProjectDatum, buildMintCOTRedeemer } from '../../infrastructure/services/PlutusDataBuilder';
import { PlatformWalletService } from '../../infrastructure/services/PlatformWalletService';
import { CardanoWallet } from '@meshsdk/core';

export class MultiSigCOTMintingService {
  constructor(
    private aikenValidator: AikenValidatorService,
    private platformWallet: PlatformWalletService
  ) {}

  /**
   * Mint COT tokens with multi-validator signatures
   */
  async mintCOTWithMultiSig(params: {
    projectId: string;
    developerId: string;
    carbonOffsetAmount: number;
    validatorSigners: string[]; // Validator pub key hashes
    approvalVotes: {
      upvotes: number;
      downvotes: number;
      neutral: number;
    };
  }): Promise<{ txHash: string; mintedAmount: number }> {
    // 1. Build project datum
    const projectDatum = buildProjectDatum({
      projectId: params.projectId,
      developer: params.developerId,
      carbonOffsetAmount: params.carbonOffsetAmount,
      validatorGroup: {
        required: 3, // 3 of 5 multisig
        signers: params.validatorSigners,
      },
      votesCount: params.approvalVotes,
      approved: true,
    });

    // 2. Build redeemer for MintCOT action
    const redeemer = buildMintCOTRedeemer(params.carbonOffsetAmount);

    // 3. Get developer's wallet address
    const developerAddress = await this.getDeveloperAddress(params.developerId);

    // 4. Get platform wallet address
    const platformAddress = await this.platformWallet.getAddress();

    // 5. Build minting transaction
    const unsignedTx = await this.aikenValidator.buildMintTransaction({
      validatorName: 'project_validator.mint',
      policyId: process.env.COT_POLICY_ID!,
      assetName: 'COT',
      quantity: params.carbonOffsetAmount,
      redeemer,
      recipient: developerAddress,
      requiredSigners: params.validatorSigners,
      platformWalletAddress: platformAddress,
    });

    // 6. Sign with platform wallet
    const platformWallet = await this.platformWallet.getWallet();
    const signedTx = await platformWallet.signTx(unsignedTx, true);

    // 7. Submit to blockchain
    const txHash = await platformWallet.submitTx(signedTx);

    return {
      txHash,
      mintedAmount: params.carbonOffsetAmount,
    };
  }

  private async getDeveloperAddress(userId: string): Promise<string> {
    // Fetch from database/wallet service
    // Implementation depends on your wallet storage
    throw new Error('Not implemented');
  }
}
```

### Step 8: Use in Your Application Service

**File**: `src/application/services/CreditService.ts`

```typescript
export class CreditService {
  constructor(
    // ... existing dependencies
    private multiSigMintingService: MultiSigCOTMintingService,
    private validatorAssignmentRepo: IValidatorAssignmentRepository
  ) {}

  async issueCreditsWithMultiSig(projectId: string): Promise<CreditEntry> {
    // 1. Get project details
    const project = await this.projectRepo.findById(projectId);
    if (!project) {
      throw new NotFoundError('Project not found');
    }

    // 2. Get validator assignments and votes
    const assignments = await this.validatorAssignmentRepo.findByProjectId(projectId);

    const upvotes = assignments.filter(a => a.vote === 'upvote').length;
    const downvotes = assignments.filter(a => a.vote === 'downvote').length;
    const neutral = assignments.filter(a => a.vote === 'neutral').length;

    // 3. Get validator pub key hashes (who voted upvote)
    const validatorSigners = assignments
      .filter(a => a.vote === 'upvote')
      .map(a => a.voteSignature!); // These should be pub key hashes

    // 4. Mint COT with multisig
    const result = await this.multiSigMintingService.mintCOTWithMultiSig({
      projectId: project.id,
      developerId: project.developerId,
      carbonOffsetAmount: project.estimatedCarbonOffset,
      validatorSigners,
      approvalVotes: { upvotes, downvotes, neutral },
    });

    // 5. Create credit entry
    const creditEntry = await this.creditEntryRepo.create({
      id: uuid(),
      projectId: project.id,
      ownerId: project.developerId,
      serialNumber: await this.generateSerialNumber(project),
      quantity: project.estimatedCarbonOffset,
      status: 'issued',
      vintageYear: project.vintageYear,
      issuedAt: new Date(),
      blockchainTxHash: result.txHash,
    });

    return creditEntry;
  }
}
```

---

## Environment Setup

### Required Environment Variables

```env
# Aiken/Plutus Configuration
COT_POLICY_ID=<deployed_cot_minting_policy_hash>
CET_POLICY_ID=<deployed_cet_minting_policy_hash>
PROJECT_VALIDATOR_ADDRESS=<deployed_project_validator_address>
BURN_VALIDATOR_ADDRESS=<deployed_burn_validator_address>

# Cardano Network
CARDANO_NETWORK=preview
BLOCKFROST_API_KEY=previewYourApiKeyHere
BLOCKFROST_URL=https://cardano-preview.blockfrost.io/api/v0

# Platform Wallet (for signing transactions)
PLATFORM_WALLET_MNEMONIC=<24-word mnemonic>
# OR
PLATFORM_WALLET_PRIVATE_KEY=<private key>
```

---

## Deployment Workflow

### 1. Compile Aiken Validators

```bash
cd on-chain/validators
aiken build
aiken blueprint convert > plutus.json
```

### 2. Deploy Validators to Cardano

You have two options:

#### Option A: Manual Deployment (cardano-cli)

```bash
# Get validator address
cardano-cli address build \
  --payment-script-file project_validator.plutus \
  --testnet-magic 2

# Store address in .env
```

#### Option B: Programmatic Deployment (MeshJS)

```typescript
import { MeshTxBuilder, BlockfrostProvider } from '@meshsdk/core';
import fs from 'fs';

async function deployValidator() {
  const plutusJson = JSON.parse(fs.readFileSync('plutus.json', 'utf8'));
  const validator = plutusJson.validators[0];

  // The validator address is deterministic from the script
  const scriptHash = resolveScriptHash(validator.compiledCode, 'PlutusV3');
  const validatorAddress = `addr_test1${scriptHash}`;

  console.log('Validator deployed at:', validatorAddress);

  // Store in database/config
  return validatorAddress;
}
```

### 3. Update Backend Configuration

```typescript
// src/config/validators.ts
export const VALIDATOR_CONFIG = {
  projectValidator: {
    address: process.env.PROJECT_VALIDATOR_ADDRESS!,
    scriptHash: process.env.PROJECT_VALIDATOR_HASH!,
  },
  cotMinter: {
    policyId: process.env.COT_POLICY_ID!,
  },
  cetMinter: {
    policyId: process.env.CET_POLICY_ID!,
  },
};
```

---

## Testing Strategy

### 1. Unit Tests (Aiken)

```bash
cd on-chain/validators
aiken check
```

### 2. Integration Tests (TypeScript)

```typescript
describe('MultiSigCOTMinting', () => {
  it('should mint COT with 3-of-5 multisig', async () => {
    const result = await multiSigMintingService.mintCOTWithMultiSig({
      projectId: 'test-project-1',
      developerId: 'dev-1',
      carbonOffsetAmount: 1000,
      validatorSigners: [
        'validator1_pubkeyhash',
        'validator2_pubkeyhash',
        'validator3_pubkeyhash',
      ],
      approvalVotes: { upvotes: 3, downvotes: 1, neutral: 1 },
    });

    expect(result.txHash).toBeDefined();
    expect(result.mintedAmount).toBe(1000);
  });
});
```

### 3. Testnet Testing

```bash
# 1. Deploy to Preview testnet
# 2. Test with real transactions
# 3. Verify on Cardanoscan
```

---

## Common Patterns

### Pattern 1: Lock-Spend Workflow

```typescript
// Lock funds at validator
async lockAtValidator(amount: number, datum: any) {
  const tx = await aikenValidator.buildLockAtValidator({
    validatorName: 'project_validator',
    amount: amount.toString(),
    datum,
    fromAddress: platformWalletAddress,
  });

  return submitTx(tx);
}

// Later: Spend from validator
async spendFromValidator(utxo: any, redeemer: any) {
  const tx = await aikenValidator.buildSpendFromValidator({
    validatorName: 'project_validator',
    utxoToSpend: utxo,
    datum: utxo.datum,
    redeemer,
    requiredSigners: ['signer1', 'signer2'],
    outputs: [{ address: recipient, amount: '2000000' }],
    platformWalletAddress,
  });

  return submitTx(tx);
}
```

### Pattern 2: Reference Script Usage

```typescript
// Deploy validator as reference script (one-time)
async deployReferenceScript() {
  const validator = aikenValidator.getValidator('project_validator');

  // Lock at a specific address with the script
  const tx = await txBuilder
    .txOut(referenceScriptAddress, [])
    .txOutReferenceScript(validator.compiledCode, 'PlutusV3')
    .complete();

  return submitTx(tx);
}

// Use reference script (saves fees)
async useReferenceScript(utxoWithScript: any) {
  const tx = await txBuilder
    .txIn(utxoToSpend)
    .txInScript(utxoWithScript) // Reference the script
    .complete();

  return submitTx(tx);
}
```

### Pattern 3: Multi-Signature Collection

```typescript
async collectValidatorSignatures(projectId: string): Promise<string[]> {
  // Get validators who voted upvote
  const assignments = await validatorAssignmentRepo.findByProjectId(projectId);
  const approvers = assignments.filter(a => a.vote === 'upvote');

  // Get their wallet public key hashes
  const signers = await Promise.all(
    approvers.map(async a => {
      const user = await userRepo.findById(a.verifierId);
      const wallet = await cardanoWalletRepo.findByUserId(user.id);
      return wallet.publicKeyHash;
    })
  );

  return signers;
}
```

---

## Troubleshooting

### Issue 1: "Validator execution failed"

**Cause**: Datum/redeemer structure mismatch

**Solution**: Use `aiken check` to test validators, ensure Plutus Data encoding matches exactly

### Issue 2: "Required signer missing"

**Cause**: Transaction not signed by required pub key hashes

**Solution**: Ensure `requiredSignerHash()` matches actual signers in multisig group

### Issue 3: "Script not found"

**Cause**: Validator not included in transaction

**Solution**: Use `.txInScript()` to include the validator compiled code

### Issue 4: "Insufficient collateral"

**Cause**: Plutus scripts require collateral for execution

**Solution**: MeshJS handles this automatically, but ensure wallet has sufficient ADA (5 ADA recommended)

---

## Performance Considerations

### Transaction Fees

- **Simple tx**: ~0.17 ADA
- **Plutus script tx**: ~0.5-2 ADA (depends on script complexity)
- **Multi-sig**: +0.1 ADA per additional signer

### Optimization Tips

1. **Use reference scripts**: Deploy script once, reference it (saves ~70% fees)
2. **Batch operations**: Combine multiple actions in one transaction
3. **Minimize datum size**: Smaller datums = lower fees
4. **Use inline datums**: Faster than datum hashes

---

## Security Best Practices

1. **Validate all inputs**: Never trust user-provided datum/redeemer
2. **Test extensively on testnet**: Bugs cost real ADA on mainnet
3. **Audit Aiken validators**: Have validators reviewed by security experts
4. **Use time bounds**: Add validity intervals to prevent replay attacks
5. **Monitor transactions**: Alert on failed transactions
6. **Rate limit**: Prevent spam attacks on your validators

---

## Resources

- [MeshJS Documentation](https://meshjs.dev/)
- [Aiken Language Guide](https://aiken-lang.org/language-tour/primitive-types)
- [Cardano Serialization Library](https://github.com/Emurgo/cardano-serialization-lib)
- [Plutus Pioneer Program](https://plutus-pioneer-program.readthedocs.io/)
- [Blockfrost API](https://docs.blockfrost.io/)

---

## Next Steps

1. Set up Aiken development environment
2. Write and compile first validator
3. Test with MeshJS on Preview testnet
4. Integrate into backend services
5. Comprehensive testing
6. Mainnet deployment

---

## Example: Complete End-to-End Flow

```typescript
// 1. Compile Aiken validator
// (done once during deployment)

// 2. Initialize services
const aikenValidator = new AikenValidatorService();
const multiSigMinting = new MultiSigCOTMintingService(
  aikenValidator,
  platformWalletService
);

// 3. Project submitted → Validators assigned
await validatorAssignmentService.assignValidatorsToProject(projectId);

// 4. Validators cast votes
await validatorAssignmentService.castVote(
  projectId,
  validator1Id,
  'upvote',
  validator1Signature
);

// 5. Voting complete → Mint COT with multisig
const result = await multiSigMinting.mintCOTWithMultiSig({
  projectId,
  developerId,
  carbonOffsetAmount: 1000,
  validatorSigners: [validator1Hash, validator2Hash, validator3Hash],
  approvalVotes: { upvotes: 3, downvotes: 1, neutral: 1 },
});

// 6. Transaction submitted to Cardano
// 7. Validator executes on-chain
// 8. COT tokens minted to developer

console.log('COT minted! TX:', result.txHash);
```

That's the complete integration flow! Your TypeScript backend orchestrates everything, and Aiken validators enforce rules on-chain.
