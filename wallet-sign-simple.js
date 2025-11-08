/**
 * Simple Wallet Signing Script for Browser Console
 * 
 * Quick script to get address, stake address, public key, and signature from Lace wallet.
 * 
 * Usage: await signMessage("Your message here")
 */

async function signMessage(message) {
  // Get Lace wallet
  if (!window.cardano?.lace) {
    throw new Error('Lace wallet not found. Please install Lace wallet extension.');
  }

  // Enable wallet
  const api = await window.cardano.lace.enable();
  console.log('✅ Wallet enabled, API methods:', Object.keys(api));
  
  // Get address - try different methods
  let address = null;
  let addresses = [];
  
  if (typeof api.getAddresses === 'function') {
    addresses = await api.getAddresses();
    address = addresses[0];
  } else if (typeof api.getUsedAddresses === 'function') {
    addresses = await api.getUsedAddresses();
    address = addresses[0];
  } else if (typeof api.getUnusedAddresses === 'function') {
    addresses = await api.getUnusedAddresses();
    address = addresses[0];
  } else if (typeof api.getChangeAddress === 'function') {
    address = await api.getChangeAddress();
  } else {
    // Try to get address from getNetworkId or other methods
    console.log('Available API methods:', Object.keys(api));
    throw new Error('Could not find method to get address. Available methods: ' + Object.keys(api).join(', '));
  }
  
  if (!address) {
    throw new Error('No address found in wallet');
  }
  
  console.log('✅ Address retrieved:', address);
  
  // Get stake address
  let stakeAddress = null;
  try {
    if (typeof api.getRewardAddresses === 'function') {
      const rewardAddresses = await api.getRewardAddresses();
      stakeAddress = rewardAddresses?.[0] || null;
    } else if (typeof api.getRewardAddress === 'function') {
      stakeAddress = await api.getRewardAddress();
    }
  } catch (e) {
    console.warn('⚠️ Stake address not available:', e.message);
  }

  // Convert message to hex
  const messageHex = Array.from(new TextEncoder().encode(message))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  console.log('📝 Message hex:', messageHex);

  // Sign message
  let signature = null;
  let publicKey = null;
  
  try {
    if (typeof api.signData === 'function') {
      const signResult = await api.signData(address, messageHex);
      signature = signResult?.signature || signResult;
      publicKey = signResult?.key || null;
    } else if (typeof api.signTx === 'function') {
      // Alternative signing method if signData doesn't exist
      throw new Error('signData not available. This wallet may not support message signing.');
    } else {
      throw new Error('No signing method found. Available methods: ' + Object.keys(api).join(', '));
    }
  } catch (e) {
    console.error('❌ Signing failed:', e);
    throw e;
  }
  
  // Try to get public key if not from sign result
  if (!publicKey) {
    try {
      if (typeof api.getPublicKey === 'function') {
        publicKey = await api.getPublicKey();
      }
    } catch (e) {
      console.warn('⚠️ Public key not directly available');
    }
  }

  const result = {
    address,
    stakeAddress,
    publicKey,
    signature,
    message,
    messageHex,
  };

  console.log('✅ Result:', result);
  console.log('\n📋 Copy these values:');
  console.log('Address:', address);
  console.log('Stake Address:', stakeAddress || 'null');
  console.log('Public Key:', publicKey || 'null');
  console.log('Signature:', signature);
  
  return result;
}

// Quick test: await signMessage("test message")

