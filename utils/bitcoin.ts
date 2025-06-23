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
 * Get Bitcoin network status
 */
export const getBitcoinNetworkStatus = () => {
  return {
    network: network === bitcoin.networks.testnet ? 'testnet' : 'mainnet',
    addressType: 'P2WPKH (Native SegWit)',
    encryptionEnabled: true
  };
};

/**
 * Get Bitcoin balance for an address (placeholder for future blockchain API integration)
 */
export const getBitcoinBalance = async (address: string): Promise<number> => {
  try {
    // TODO: Integrate with Bitcoin blockchain API (BlockCypher, Electrum, etc.)
    // For now, return 0 as placeholder
    console.log(`🔍 Fetching Bitcoin balance for: ${address}`);
    console.log('💡 Bitcoin balance fetching will be implemented with blockchain API integration');
    return 0;
  } catch (error) {
    console.error('Error fetching Bitcoin balance:', error);
    return 0;
  }
};