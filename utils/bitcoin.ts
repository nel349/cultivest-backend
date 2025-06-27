import * as bitcoin from 'bitcoinjs-lib';
import { ECPairFactory } from 'ecpair';
import * as ecc from 'tiny-secp256k1';
import CryptoJS from 'crypto-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize ECC library for Bitcoin operations
bitcoin.initEccLib(ecc);

// Create ECPair factory
const ECPair = ECPairFactory(ecc);

// Bitcoin configuration
const network = process.env.BITCOIN_NETWORK === 'mainnet' 
  ? bitcoin.networks.bitcoin 
  : bitcoin.networks.testnet;

// Encryption key for private keys
const encryptionKey = process.env.ENCRYPTION_KEY || 'fallback-key-change-in-production';

export interface BitcoinWalletGenerationResult {
  success: boolean;
  address?: string;
  encryptedPrivateKey?: string;
  error?: string;
}

/**
 * Generate a new Bitcoin wallet address with encrypted private key
 */
export const generateBitcoinWallet = (): BitcoinWalletGenerationResult => {
  try {
    console.log('🔐 Generating new Bitcoin wallet...');

    // Generate a random key pair with ECC
    const keyPair = ECPair.makeRandom({ network });
    
    // Validate the public key exists
    if (!keyPair.publicKey) {
      throw new Error('Failed to generate public key');
    }

    // Convert Uint8Array to Buffer for compatibility with bitcoinjs-lib
    const pubkeyBuffer = Buffer.from(keyPair.publicKey);

    // Create a P2WPKH (native segwit) address for better fees and modern compatibility
    const payment = bitcoin.payments.p2wpkh({ 
      pubkey: pubkeyBuffer, 
      network 
    });

    if (!payment.address) {
      throw new Error('Failed to generate Bitcoin address from payment');
    }

    // Get private key in WIF format
    const privateKeyWIF = keyPair.toWIF();

    // Encrypt private key before storing
    const encryptedPrivateKey = CryptoJS.AES.encrypt(privateKeyWIF, encryptionKey).toString();

    console.log(`✅ Generated Bitcoin address: ${payment.address}`);
    console.log(`📱 Network: ${network === bitcoin.networks.testnet ? 'testnet' : 'mainnet'}`);

    return {
      success: true,
      address: payment.address,
      encryptedPrivateKey
    };

  } catch (error) {
    console.error('❌ Bitcoin wallet generation failed:', error);
    console.error('🔍 Error details:', error);
    
    // Return a more specific error message
    const errorMessage = error instanceof Error ? error.message : 'Unknown error during Bitcoin wallet generation';
    return {
      success: false,
      error: errorMessage
    };
  }
};

/**
 * Decrypt Bitcoin private key for transaction signing
 */
export const decryptBitcoinPrivateKey = (encryptedPrivateKey: string): string => {
  try {
    console.log('🔐 Attempting to decrypt Bitcoin private key...');
    
    if (!encryptedPrivateKey) {
      throw new Error('No encrypted private key provided');
    }
    
    if (!encryptionKey) {
      throw new Error('No encryption key available');
    }
    
    const bytes = CryptoJS.AES.decrypt(encryptedPrivateKey, encryptionKey);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    
    if (!decrypted) {
      throw new Error('Decryption resulted in empty string - wrong encryption key or corrupted data');
    }
    
    console.log('✅ Bitcoin private key decrypted successfully');
    return decrypted;
  } catch (error) {
    console.error('🔒 Bitcoin decryption error:', error);
    throw new Error(`Failed to decrypt Bitcoin private key: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Get Bitcoin network status and test balance API
 */
export const getBitcoinNetworkStatus = async () => {
  // Test with a known address that should have some balance
  const testAddress = network === bitcoin.networks.testnet 
    ? 'tb1q37kwfqz8rsypragqnw9pp3jkdwadqhp97z4wcq' // Known testnet address with activity
    : 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhkv4k'; // Known mainnet address
  
  let balanceApiStatus = 'unknown';
  let testBalance = 0;
  
  try {
    testBalance = await getBitcoinBalance(testAddress);
    balanceApiStatus = 'working';
  } catch (error) {
    balanceApiStatus = 'error';
    console.error('Bitcoin balance API test failed:', error);
  }
  
  return {
    network: network === bitcoin.networks.testnet ? 'testnet' : 'mainnet',
    addressType: 'P2WPKH (Native SegWit)',
    encryptionEnabled: true,
    balanceAPI: {
      status: balanceApiStatus,
      provider: 'BlockCypher',
      testAddress,
      testBalance
    }
  };
};

/**
 * Get Bitcoin balance for an address using BlockCypher API
 */
export const getBitcoinBalance = async (address: string): Promise<number> => {
  try {
    console.log(`🔍 Fetching Bitcoin balance for: ${address}`);
    
    // Validate address format and determine network compatibility
    const isTestnetAddress = /^(tb1[a-z0-9]{39,}|[2mn][a-km-zA-HJ-NP-Z1-9]{25,34})$/.test(address);
    const isMainnetAddress = /^(bc1[a-z0-9]{39,}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/.test(address);
    const currentNetwork = network === bitcoin.networks.testnet ? 'testnet' : 'mainnet';
    
    console.log(`🔍 Address analysis: ${address}`);
    console.log(`🔍 Current network: ${currentNetwork}`);
    console.log(`🔍 Address appears to be: ${isTestnetAddress ? 'testnet' : isMainnetAddress ? 'mainnet' : 'unknown'}`);
    
    // Auto-detect network based on address if there's a mismatch
    let networkPath;
    if (isTestnetAddress) {
      networkPath = 'test3';
      if (currentNetwork === 'mainnet') {
        console.log(`⚠️ Testnet address detected but configured for mainnet - using testnet API`);
      }
    } else if (isMainnetAddress) {
      networkPath = 'main';
      if (currentNetwork === 'testnet') {
        console.log(`⚠️ Mainnet address detected but configured for testnet - using mainnet API`);
      }
    } else {
      throw new Error(`Invalid Bitcoin address format: ${address}`);
    }
    
    const apiUrl = `https://api.blockcypher.com/v1/btc/${networkPath}/addrs/${address}/balance`;
    console.log(`📡 Calling BlockCypher API: ${apiUrl}`);
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.log(`📭 Address ${address} not found on blockchain (new address with 0 balance)`);
        return 0;
      }
      throw new Error(`BlockCypher API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as any;
    
    // BlockCypher returns balance in satoshis, convert to BTC
    const confirmedSatoshis = data.balance || 0;
    const unconfirmedSatoshis = data.unconfirmed_balance || 0;
    const totalSatoshis = confirmedSatoshis + unconfirmedSatoshis;
    const totalBTC = totalSatoshis / 100000000; // 1 BTC = 100,000,000 satoshis
    
    console.log(`💰 Bitcoin balance for ${address}: ${totalBTC} BTC (${totalSatoshis} satoshis total)`);
    console.log(`🔍 Balance details:`, {
      address: data.address,
      confirmedBalance: confirmedSatoshis / 100000000,
      unconfirmedBalance: unconfirmedSatoshis / 100000000,
      totalBalance: totalBTC,
      totalSatoshis: totalSatoshis,
      totalReceived: (data.total_received || 0) / 100000000,
      totalSent: (data.total_sent || 0) / 100000000,
      numTx: data.n_tx || 0
    });
    
    if (unconfirmedSatoshis > 0) {
      console.log(`⏳ Note: ${unconfirmedSatoshis / 100000000} BTC is unconfirmed and pending blockchain confirmation`);
    }
    
    return totalBTC;
    
  } catch (error) {
    console.error('❌ Error fetching Bitcoin balance:', error);
    
    // Return 0 on error but log it - don't break the application
    if (error instanceof Error) {
      console.error(`🔍 Bitcoin balance error details: ${error.message}`);
    }
    
    return 0;
  }
};