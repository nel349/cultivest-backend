#!/usr/bin/env node

/**
 * Get the deployer/authorized minter address from environment variables
 * Usage: node scripts/get-deployer-address.js
 */

require('dotenv').config();
const algosdk = require('algosdk');

// Try to get mnemonic from environment variables
const mnemonic = process.env.AUTHORIZED_MINTER_MNEMONIC || 
                process.env.DEPLOYER_MNEMONIC || 
                process.env.TESTNET_DISPENSER_MNEMONIC;

if (!mnemonic) {
  console.log('❌ No mnemonic found in environment variables!');
  console.log('');
  console.log('💡 Please set one of these in your .env file:');
  console.log('   - AUTHORIZED_MINTER_MNEMONIC');
  console.log('   - DEPLOYER_MNEMONIC');
  console.log('   - TESTNET_DISPENSER_MNEMONIC');
  process.exit(1);
}

try {
  // Convert mnemonic to account
  const account = algosdk.mnemonicToSecretKey(mnemonic);
  
  console.log('✅ Deployer/Authorized Minter Address:');
  console.log('═'.repeat(60));
  console.log(`📍 Address: ${account.addr}`);
  console.log('═'.repeat(60));
  console.log('');
  console.log('🎯 Next steps:');
  console.log('1. Fund this address with testnet ALGOs:');
  console.log('   👉 https://testnet.algoexplorer.io/dispenser');
  console.log('');
  console.log('2. This address will be used for:');
  console.log('   ✅ Deploying smart contracts');
  console.log('   ✅ Acting as authorized minter');
  console.log('   ✅ Auto-funding new user wallets');
  console.log('');
  console.log('3. Check balance on testnet:');
  console.log(`   👉 https://testnet.algoexplorer.io/address/${account.addr}`);
  
} catch (error) {
  console.error('❌ Error processing mnemonic:', error.message);
  console.log('💡 Make sure your mnemonic phrase is valid in your .env file');
  process.exit(1);
} 