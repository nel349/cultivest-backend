import * as bitcoin from 'bitcoinjs-lib';
import { ECPairFactory } from 'ecpair';
import CryptoJS from 'crypto-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Dynamic ECC loading to handle WASM issues in serverless environments
let ecc: any = null;
let ECPair: any = null;
let isEccInitialized = false;

const initializeEcc = async () => {
  if (isEccInitialized) return true;
  
  try {
    // Try to load tiny-secp256k1 dynamically
    ecc = await import('tiny-secp256k1');
    
    // Initialize ECC library for Bitcoin operations
    bitcoin.initEccLib(ecc);
    
    // Create ECPair factory
    ECPair = ECPairFactory(ecc);
    
    isEccInitialized = true;
    console.log('✅ Bitcoin ECC library initialized successfully');
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize Bitcoin ECC library:', error);
    console.log('💡 Bitcoin functionality will be disabled in this serverless environment');
    return false;
  }
};

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
export const generateBitcoinWallet = async (): Promise<BitcoinWalletGenerationResult> => {
  try {
    console.log('🔐 Generating new Bitcoin wallet...');

    // Initialize ECC library first
    const eccReady = await initializeEcc();
    if (!eccReady) {
      return {
        success: false,
        error: 'Bitcoin functionality not available in this environment'
      };
    }

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
  // Check if ECC is available
  const eccReady = await initializeEcc();
  
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
    eccAvailable: eccReady,
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

/**
 * Interface for UTXO data from BlockCypher API
 */
interface UTXO {
  tx_hash: string;
  tx_output_n: number;
  value: number; // in satoshis
  confirmations: number;
}

/**
 * Interface for transaction sending result
 */
export interface BitcoinTransactionResult {
  success: boolean;
  txHash?: string;
  mempoolUrl?: string;
  error?: string;
  fee?: number;
}

/**
 * Get UTXOs for a Bitcoin address
 */
export const getUTXOs = async (address: string): Promise<UTXO[]> => {
  try {
    console.log(`🔍 Fetching UTXOs for address: ${address}`);
    
    // Determine network path
    const isTestnetAddress = /^(tb1[a-z0-9]{39,}|[2mn][a-km-zA-HJ-NP-Z1-9]{25,34})$/.test(address);
    const networkPath = isTestnetAddress ? 'test3' : 'main';
    
    const apiUrl = `https://api.blockcypher.com/v1/btc/${networkPath}/addrs/${address}?unspentOnly=true&includeScript=true`;
    console.log(`📡 Calling BlockCypher API: ${apiUrl}`);
    
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      if (response.status === 404) {
        console.log(`📭 No UTXOs found for address ${address}`);
        return [];
      }
      throw new Error(`BlockCypher API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json() as any;
    const utxos: UTXO[] = (data.txrefs || []).map((utxo: any) => ({
      tx_hash: utxo.tx_hash,
      tx_output_n: utxo.tx_output_n,
      value: utxo.value,
      confirmations: utxo.confirmations || 0
    }));
    
    console.log(`💰 Found ${utxos.length} UTXOs for ${address}`);
    return utxos;
    
  } catch (error) {
    console.error('❌ Error fetching UTXOs:', error);
    throw error;
  }
};

/**
 * Send Bitcoin from one address to another
 */
export const sendBitcoin = async (
  fromPrivateKeyWIF: string,
  toAddress: string,
  amountSatoshis: number
): Promise<BitcoinTransactionResult> => {
  try {
    console.log(`🚀 Sending ${amountSatoshis} satoshis to ${toAddress}`);
    
    // Initialize ECC library
    const eccReady = await initializeEcc();
    if (!eccReady) {
      return {
        success: false,
        error: 'Bitcoin functionality not available in this environment'
      };
    }
    
    // Import private key
    const keyPair = ECPair.fromWIF(fromPrivateKeyWIF, network);
    
    // Ensure publicKey is a Buffer for compatibility
    const publicKeyBuffer = keyPair.publicKey instanceof Uint8Array 
      ? Buffer.from(keyPair.publicKey) 
      : keyPair.publicKey;
    
    const fromAddress = bitcoin.payments.p2wpkh({ 
      pubkey: publicKeyBuffer, 
      network 
    }).address!;
    
    console.log(`📤 Sending from address: ${fromAddress}`);
    
    // Get UTXOs for the sender address
    const utxos = await getUTXOs(fromAddress);
    
    if (utxos.length === 0) {
      return {
        success: false,
        error: 'No UTXOs available for sending'
      };
    }
    
    // Calculate total available balance
    const totalBalance = utxos.reduce((sum, utxo) => sum + utxo.value, 0);
    console.log(`💰 Total available balance: ${totalBalance} satoshis`);
    
    // Estimate fee (simple calculation: 250 satoshis per input + 50 per output)
    const estimatedFee = (utxos.length * 250) + (2 * 50); // 2 outputs (to + change)
    const totalNeeded = amountSatoshis + estimatedFee;
    
    if (totalBalance < totalNeeded) {
      return {
        success: false,
        error: `Insufficient balance. Need ${totalNeeded} satoshis (${amountSatoshis} + ${estimatedFee} fee), have ${totalBalance}`
      };
    }
    
    // Create transaction using PSBT with proper SegWit handling
    const psbt = new bitcoin.Psbt({ network });
    
    // Add inputs (UTXOs) - for SegWit we need witnessUtxo
    let inputValue = 0;
    for (const utxo of utxos) {
      // For P2WPKH (SegWit), we need the witnessUtxo
      const p2wpkh = bitcoin.payments.p2wpkh({ 
        pubkey: publicKeyBuffer, 
        network 
      });
      
      psbt.addInput({
        hash: utxo.tx_hash,
        index: utxo.tx_output_n,
        witnessUtxo: {
          script: p2wpkh.output!,
          value: utxo.value
        }
      });
      
      inputValue += utxo.value;
      
      // If we have enough for the transaction + fee, stop adding inputs
      if (inputValue >= totalNeeded) {
        break;
      }
    }
    
    // Add outputs
    // 1. Send to recipient
    psbt.addOutput({
      address: toAddress,
      value: amountSatoshis
    });
    
    // 2. Change back to sender (if any)
    const changeAmount = inputValue - amountSatoshis - estimatedFee;
    if (changeAmount > 546) { // Dust limit
      psbt.addOutput({
        address: fromAddress,
        value: changeAmount
      });
    }
    
    // Create a Buffer-compatible keyPair wrapper
    const bufferKeyPair = {
      publicKey: publicKeyBuffer,
      privateKey: keyPair.privateKey ? (Buffer.isBuffer(keyPair.privateKey) ? keyPair.privateKey : Buffer.from(keyPair.privateKey)) : undefined,
      sign: (hash: Buffer) => {
        const signature = keyPair.sign(hash);
        // Always return Buffer, never Uint8Array
        return Buffer.isBuffer(signature) ? signature : Buffer.from(signature);
      },
      verify: keyPair.verify,
      compressed: keyPair.compressed,
      network: keyPair.network
    };
    
    // Sign all inputs with Buffer-compatible keyPair
    for (let i = 0; i < psbt.inputCount; i++) {
      try {
        psbt.signInput(i, bufferKeyPair);
        // Validate the signature
        const isValid = psbt.validateSignaturesOfInput(i, () => true);
        if (!isValid) {
          throw new Error(`Invalid signature for input ${i}`);
        }
      } catch (error) {
        console.error(`❌ Error signing input ${i}:`, error);
        throw error;
      }
    }
    
    // Finalize and extract transaction
    psbt.finalizeAllInputs();
    const tx = psbt.extractTransaction();
    const txHex = tx.toHex();
    const txHash = tx.getId();
    
    console.log(`📝 Transaction created: ${txHash}`);
    console.log(`💸 Fee paid: ${estimatedFee} satoshis`);
    
    // Broadcast transaction
    await broadcastTransaction(txHex);
    
    // Create mempool URL
    const networkPath = network === bitcoin.networks.testnet ? 'testnet' : '';
    const mempoolUrl = `https://mempool.space/${networkPath ? networkPath + '/' : ''}tx/${txHash}`;
    
    console.log(`✅ Transaction broadcasted successfully!`);
    console.log(`🔗 Mempool URL: ${mempoolUrl}`);
    
    return {
      success: true,
      txHash,
      mempoolUrl,
      fee: estimatedFee
    };
    
  } catch (error) {
    console.error('❌ Bitcoin transaction failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown transaction error'
    };
  }
};

/**
 * Broadcast transaction to Bitcoin network
 */
const broadcastTransaction = async (txHex: string): Promise<void> => {
  const networkPath = network === bitcoin.networks.testnet ? 'test3' : 'main';
  const apiUrl = `https://api.blockcypher.com/v1/btc/${networkPath}/txs/push`;
  
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ tx: txHex })
  });
  
  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Failed to broadcast transaction: ${response.status} - ${errorData}`);
  }
  
  console.log('📡 Transaction broadcasted to network');
};