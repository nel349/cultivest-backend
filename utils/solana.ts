import { Keypair, Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import crypto from 'crypto';

// Solana configuration
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

// Encryption key for private keys (should match the one used for other wallets)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'fallback-key-change-in-production';

export interface SolanaWallet {
  address: string;
  privateKey: string; // Base58 encoded
  encryptedPrivateKey: string;
}

export interface SolanaBalance {
  sol: number;
  lamports: number;
  lastUpdated: string;
}

/**
 * Generate a new Solana wallet
 */
export const generateSolanaWallet = (): SolanaWallet => {
  try {
    const keypair = Keypair.generate();
    const address = keypair.publicKey.toBase58();
    const privateKey = Buffer.from(keypair.secretKey).toString('base64');
    
    // Encrypt the private key using modern crypto methods
    const algorithm = 'aes-256-cbc';
    const key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encryptedPrivateKey = cipher.update(privateKey, 'utf8', 'hex');
    encryptedPrivateKey += cipher.final('hex');
    
    // Prepend IV to encrypted data
    const encryptedWithIv = iv.toString('hex') + ':' + encryptedPrivateKey;

    return {
      address,
      privateKey,
      encryptedPrivateKey: encryptedWithIv
    };
  } catch (error) {
    console.error('Error generating Solana wallet:', error);
    throw new Error('Failed to generate Solana wallet');
  }
};

/**
 * Decrypt Solana private key
 */
export const decryptSolanaPrivateKey = (encryptedPrivateKey: string): string => {
  try {
    // Handle both old and new encryption formats
    if (encryptedPrivateKey.includes(':')) {
      // New format with IV
      const [ivHex, encrypted] = encryptedPrivateKey.split(':');
      const iv = Buffer.from(ivHex, 'hex');
      const algorithm = 'aes-256-cbc';
      const key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
      
      const decipher = crypto.createDecipheriv(algorithm, key, iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } else {
      // Legacy format (for backward compatibility)
      const decipher = crypto.createDecipher('aes-256-cbc', ENCRYPTION_KEY);
      let decrypted = decipher.update(encryptedPrivateKey, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    }
  } catch (error) {
    console.error('Error decrypting Solana private key:', error);
    throw new Error('Failed to decrypt Solana private key');
  }
};

/**
 * Get Solana balance for an address
 */
export const getSolanaBalance = async (address: string, rpcUrl?: string): Promise<number> => {
  try {
    const publicKey = new PublicKey(address);
    const conn = rpcUrl ? new Connection(rpcUrl, 'confirmed') : connection;
    const balance = await conn.getBalance(publicKey);
    return balance / LAMPORTS_PER_SOL; // Convert lamports to SOL
  } catch (error) {
    console.error('Error fetching Solana balance:', error);
    return 0;
  }
};

/**
 * Get detailed Solana balance information
 */
export const getSolanaBalanceDetails = async (address: string): Promise<SolanaBalance> => {
  try {
    const publicKey = new PublicKey(address);
    const lamports = await connection.getBalance(publicKey);
    const sol = lamports / LAMPORTS_PER_SOL;

    return {
      sol,
      lamports,
      lastUpdated: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error fetching Solana balance details:', error);
    return {
      sol: 0,
      lamports: 0,
      lastUpdated: new Date().toISOString()
    };
  }
};

/**
 * Validate Solana address format
 */
export const isValidSolanaAddress = (address: string): boolean => {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
};

/**
 * Get current SOL price in USD from CoinGecko
 */
export const getSolanaPrice = async (): Promise<number> => {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
    const data = await response.json() as { solana?: { usd: number } };
    return data.solana?.usd || 0;
  } catch (error) {
    console.error('Error fetching Solana price:', error);
    return 0;
  }
};

/**
 * Calculate estimated SOL amount for USD investment (with approximate fees)
 */
export const calculateEstimatedSolana = async (amountUSD: number) => {
  try {
    const solPrice = await getSolanaPrice();
    if (solPrice === 0) {
      throw new Error('Failed to fetch SOL price');
    }

    // Assume similar fee structure to Bitcoin for now
    // MoonPay fees are typically around 3.8% total
    const feePercentage = 0.038;
    const netAmount = amountUSD * (1 - feePercentage);
    const estimatedSOL = netAmount / solPrice;

    return {
      estimatedSOL,
      solPrice,
      totalFees: amountUSD * feePercentage,
      moonpayFee: amountUSD * 0.035, // Approximate
      networkFee: amountUSD * 0.003  // Approximate
    };
  } catch (error) {
    console.error('Error calculating estimated Solana:', error);
    throw error;
  }
};

/**
 * Get Solana network information
 */
export const getSolanaNetworkInfo = async () => {
  try {
    const version = await connection.getVersion();
    const slot = await connection.getSlot();
    
    return {
      network: SOLANA_RPC_URL.includes('devnet') ? 'devnet' : 
               SOLANA_RPC_URL.includes('testnet') ? 'testnet' : 'mainnet',
      rpcUrl: SOLANA_RPC_URL,
      version,
      currentSlot: slot,
      isHealthy: true
    };
  } catch (error) {
    console.error('Error getting Solana network info:', error);
    return {
      network: 'unknown',
      rpcUrl: SOLANA_RPC_URL,
      version: null,
      currentSlot: 0,
      isHealthy: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}; 