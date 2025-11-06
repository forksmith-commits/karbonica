import { BlockfrostProvider } from '@meshsdk/core';

async function debugLatestBlock() {
  try {
    const provider = new BlockfrostProvider('previewyZV8gILVy31lIdXSBwqscdbhs6H8gLGx');

    console.log('Fetching latest block...');
    const latestBlock = await provider.fetchLatestBlock();

    console.log('Latest block structure:');
    console.log(JSON.stringify(latestBlock, null, 2));

    console.log('\nLatest block properties:');
    console.log(Object.keys(latestBlock));

    // Test fetchTxInfo to see transaction structure with a real transaction
    console.log('\n--- Testing transaction structure ---');
    try {
      // Try to get a transaction from the latest block if it has any
      if (latestBlock.txCount && latestBlock.txCount > 0) {
        console.log('Latest block has transactions, but we need a specific tx hash to fetch');
      }

      // For now, let's try with a placeholder and catch the error to see the structure
      console.log('Attempting to fetch transaction info...');

      // You can replace this with an actual transaction hash from Cardano Preview testnet
      const sampleTxHash = '49f8295a3b135e7c91907c7532badbf5903858f7cc103b82c2ac0b019921fc98'; // This will fail, but we can see the error structure
      const tx = await provider.fetchTxInfo(sampleTxHash);

      console.log('Transaction structure:');
      console.log(JSON.stringify(tx, null, 2));
      console.log('\nTransaction properties:');
      console.log(Object.keys(tx));
    } catch (txError: any) {
      console.log('Transaction fetch failed (expected):', txError?.message || txError);
      console.log('Error status:', txError?.status);
    }

    // Test fetchBlockInfo
    console.log('\n--- Testing block info structure ---');
    try {
      const blockInfo = await provider.fetchBlockInfo(latestBlock.hash);
      console.log('Block info structure:');
      console.log(JSON.stringify(blockInfo, null, 2));
      console.log('\nBlock info properties:');
      console.log(Object.keys(blockInfo));
    } catch (blockError: any) {
      console.log('Block info fetch failed:', blockError?.message || blockError);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

debugLatestBlock();
