#!/usr/bin/env node

/**
 * Utility script to get the Algorand address from a mnemonic phrase
 * Usage: node scripts/get-address-from-mnemonic.js "your mnemonic phrase here"
 */

const algosdk = require('algosdk');

// Get mnemonic from command line argument or prompt for it
const mnemonic = process.argv[2];

if (!mnemonic) {
  console.log('❌ Usage: node scripts/get-address-from-mnemonic.js "your mnemonic phrase here"');
  console.log('📝 Or set AUTHORIZED_MNEMONIC environment variable');
  process.exit(1);
}

try {
  // Convert mnemonic to account
  const account = algosdk.mnemonicToSecretKey(mnemonic);
  
  console.log('✅ Algorand Account Information:');
  console.log('═'.repeat(50));
  console.log(`📍 Address: ${account.addr}`);
  console.log(`🔑 Public Key (Base32): ${algosdk.encodeAddress(account.addr)}`);
  console.log('═'.repeat(50));
  console.log('');
  console.log('💡 Use this address for:');
  console.log('   - Contract deployment');
  console.log('   - Setting as authorized minter');
  console.log('   - Funding with testnet faucet');
  console.log('   - Environment variable reference');
  
} catch (error) {
  console.error('❌ Error processing mnemonic:', error.message);
  console.log('💡 Make sure your mnemonic phrase is valid (usually 25 words)');
  process.exit(1);
} 