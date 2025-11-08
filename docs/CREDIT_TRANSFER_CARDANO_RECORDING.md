# Credit Transfer Cardano Recording

## Overview

Task 32 implements optional recording of credit transfer metadata on the Cardano blockchain. This provides an immutable audit trail of credit transfers, separate from the actual COT (Carbon Offset Token) transfer.

## Implementation Details

### What Was Implemented

1. **Optional Metadata Recording**: When a credit transfer is completed successfully (including COT token transfer), the system optionally records the transfer details as metadata on the Cardano blockchain.

2. **CIP-20 Metadata Format**: The transfer metadata follows the CIP-20 standard and includes:
   - Action type: "transfer"
   - Credit ID (serial number)
   - Project ID and title
   - Quantity transferred
   - Vintage year
   - Sender and recipient IDs
   - Timestamp
   - Policy ID and asset name (for COT tokens)

3. **Non-Blocking Operation**: If the metadata recording fails, it doesn't fail the entire transfer. The transfer is still completed in the database and the COT tokens are still transferred.

### How It Works

```
Credit Transfer Flow:
1. Validate transfer (ownership, quantity, status)
2. Update database (change owner, status)
3. Transfer COT tokens on Cardano (if available)
4. ✨ Record transfer metadata on Cardano (Task 32) ✨
5. Create transaction record
6. Commit database transaction
```

### Code Changes

#### 1. CreditService.ts
- Added `CardanoTransactionService` as an optional dependency
- Added metadata recording logic after successful COT token transfer
- Records transfer details as CIP-20 metadata on Cardano
- Stores the metadata transaction hash in the credit transaction record

#### 2. credits.ts (Routes)
- Instantiates `CardanoTransactionService` in `getCreditService()`
- Passes it to `CreditService` constructor
- Uses `InMemoryBlockchainTransactionRepository` for transaction tracking

### Transaction Details

The metadata recording transaction:
- **Recipient**: The credit recipient's wallet address
- **Amount**: 1.5 ADA (minimal output to carry metadata)
- **Metadata**: Transfer details in CIP-20 format (label 674)
- **Purpose**: Creates an immutable record of the transfer on-chain

### Benefits

1. **Immutable Audit Trail**: Transfer details are permanently recorded on the Cardano blockchain
2. **Transparency**: Anyone can verify the transfer by checking the blockchain
3. **Compliance**: Provides cryptographic proof of credit transfers for regulatory purposes
4. **Separate from Token Transfer**: The metadata recording is independent of the COT token transfer

### Verification

To verify a transfer on Cardano Preview testnet:
1. Get the `metadataRecordTxHash` from the credit transaction record
2. Visit: `https://preview.cardanoscan.io/transaction/{metadataRecordTxHash}`
3. Check the "Metadata" tab to see the transfer details

### Example Metadata

```json
{
  "674": {
    "carbon_credit": {
      "version": "1.0",
      "action": "transfer",
      "credit_id": "KRB-2024-001-000001",
      "project_id": "uuid-here",
      "projectTitle": "Amazon Rainforest Conservation",
      "quantity": "1000",
      "vintage": 2024,
      "senderId": "sender-uuid",
      "recipientId": "recipient-uuid",
      "timestamp": "2024-01-15T10:30:00Z",
      "policyId": "policy-id-here",
      "assetName": "asset-name-here"
    }
  }
}
```

### Requirements Satisfied

- **Requirement 15.14**: "WHEN credit transfer occurs THEN the system SHALL optionally record transfer details on Cardano with metadata"

### Testing

The implementation can be tested using:
1. The existing `scripts/test-credit-transfer.js` script
2. The Postman collection: `scripts/Credit-Transfer-Test.postman_collection.json`
3. Manual testing via the API endpoints

### Future Enhancements

1. Add a dedicated database table for blockchain transaction records (instead of in-memory)
2. Implement transaction monitoring to confirm metadata recording
3. Add API endpoint to retrieve transfer metadata from blockchain
4. Generate transfer certificates with blockchain proof

## Related Files

- `src/application/services/CreditService.ts` - Main implementation
- `src/routes/credits.ts` - Service instantiation
- `src/domain/services/CardanoTransactionService.ts` - Transaction building and submission
- `src/domain/repositories/IBlockchainTransactionRepository.ts` - Transaction tracking

## Notes

- The metadata recording is **optional** and only happens if:
  - `CardanoTransactionService` is available
  - COT token transfer was successful
  - Recipient has a wallet address
- Failures in metadata recording are logged but don't fail the transfer
- The metadata transaction sends 1.5 ADA to the recipient as confirmation
