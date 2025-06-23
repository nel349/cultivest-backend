import algosdk from 'algosdk';
import CryptoJS from 'crypto-js';
import dotenv from 'dotenv';
import { supabase, handleDatabaseError } from './supabase';

// Load environment variables
dotenv.config();

// Algorand configuration
const algodUrl = process.env.ALGORAND_ALGOD_URL || 'https://testnet-api.algonode.cloud';
const algodToken = process.env.ALGORAND_ALGOD_TOKEN || ''; // Empty for AlgoNode
const network = process.env.ALGORAND_NETWORK || 'testnet';
const usdcAssetId = parseInt(process.env.USDC_ASSET_ID || '10458941'); // USDCa on testnet

// Encryption key for private keys
const encryptionKey = process.env.ENCRYPTION_KEY || 'fallback-key-change-in-production';

// Initialize Algorand client
// AlgoNode doesn't require a token, PureStake does
const algodClient = new algosdk.Algodv2(algodToken, algodUrl, algodToken ? '' : undefined);

export interface WalletGenerationResult {
  success: boolean;
  walletId?: string;
  algorandAddress?: string;
  error?: string;
  transactionIds?: string[];
}

export interface WalletInfo {
  walletId: string;
  userId: string;
  algorandAddress: string;
  encryptedPrivateKey: string;
  balance: {
    algo: number;
    usdca: number;
  };
  onChainBalance?: {
    algo: number;
    usdca: number;
    lastUpdated: string;
    isOptedIntoUSDCa?: boolean;
  };
  createdAt: string;
}

/**
 * Generate a new Algorand wallet with encrypted private key storage
 */
export const generateWallet = async (userId: string): Promise<WalletGenerationResult> => {
  try {
    console.log(`🔐 Generating new Algorand wallet for user: ${userId}`);

    // Generate new Algorand account
    const account = algosdk.generateAccount();
    const address = account.addr;
    const privateKey = algosdk.secretKeyToMnemonic(account.sk);

    console.log(`✅ Generated Algorand address: ${address}`);

    // Encrypt private key before storing
    const encryptedPrivateKey = CryptoJS.AES.encrypt(privateKey, encryptionKey).toString();

    // Store wallet in database
    const { data: newWallet, error: walletError } = await supabase
      .from('wallets')
      .insert({
        user_id: userId,
        algorand_address: address,
        encrypted_private_key: encryptedPrivateKey,
        asset_id: usdcAssetId,
        balance_usdca: 0,
        balance_algo: 0
      })
      .select('wallet_id')
      .single();

    if (walletError) {
      console.error('❌ Failed to store wallet in database:', walletError);
      const dbError = handleDatabaseError(walletError);
      return {
        success: false,
        error: `Database error: ${dbError.error}`
      };
    }

    console.log(`✅ Wallet stored in database with ID: ${newWallet.wallet_id}`);

    // For testnet, we can optionally fund the account or opt into USDCa
    // This would require a funded account to pay for transactions
    const transactionIds: string[] = [];

    // TODO: Implement USDCa opt-in transaction
    // This requires the account to have some ALGO for transaction fees
    // For hackathon, we'll skip this step

    console.log(`🎉 Wallet creation completed successfully!`);

    return {
      success: true,
      walletId: newWallet.wallet_id,
      algorandAddress: address,
      transactionIds
    };

  } catch (error) {
    console.error('❌ Wallet generation failed:', error);
    return {
      success: false,
      error: (error as Error).message
    };
  }
};

/**
 * Get live on-chain balance for an Algorand address
 */
export const getOnChainBalance = async (algorandAddress: string) => {
  try {
    console.log(`🔍 Fetching on-chain balance for: ${algorandAddress}`);
    
    const accountInfo = await algodClient.accountInformation(algorandAddress).do();
    
    // Convert microAlgos to Algos (1 ALGO = 1,000,000 microAlgos)
    const algoBalance = accountInfo.amount / 1000000;
    
    // Find USDCa asset balance
    let usdcaBalance = 0;
    let isOptedIntoUSDCa = false;
    
    console.log(`🔍 Account has ${accountInfo.assets?.length || 0} assets:`, accountInfo.assets?.map((a: any) => a['asset-id']) || []);
    
    if (accountInfo.assets && accountInfo.assets.length > 0) {
      const usdcaAsset = accountInfo.assets.find((asset: any) => asset['asset-id'] === usdcAssetId);
      if (usdcaAsset) {
        isOptedIntoUSDCa = true;
        // USDCa has 6 decimal places
        usdcaBalance = usdcaAsset.amount / 1000000;
        console.log(`✅ Found USDCa asset ${usdcAssetId}: ${usdcaBalance} USDCa`);
      } else {
        console.log(`❌ USDCa asset ${usdcAssetId} not found in wallet assets`);
      }
    } else {
      console.log(`❌ No assets found in wallet - not opted into USDCa yet`);
    }
    
    console.log(`💰 On-chain balances - ALGO: ${algoBalance}, USDCa: ${usdcaBalance} (opted in: ${isOptedIntoUSDCa})`);
    
    return {
      algo: algoBalance,
      usdca: usdcaBalance,
      isOptedIntoUSDCa: isOptedIntoUSDCa,
      lastUpdated: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('Error fetching on-chain balance:', error);
    return null;
  }
};

/**
 * Get wallet information for a user with optional live balance fetching
 */
export const getUserWallet = async (
  userId: string, 
  includeLiveBalance: boolean = false
): Promise<WalletInfo | null> => {
  try {
    const { data: wallet, error } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !wallet) {
      return null;
    }

    const walletInfo: WalletInfo = {
      walletId: wallet.wallet_id,
      userId: wallet.user_id,
      algorandAddress: wallet.algorand_address,
      encryptedPrivateKey: wallet.encrypted_private_key,
      balance: {
        algo: wallet.balance_algo || 0,
        usdca: wallet.balance_usdca || 0
      },
      createdAt: wallet.created_at
    };

    // Optionally fetch live on-chain balance
    if (includeLiveBalance) {
      const onChainBalance = await getOnChainBalance(wallet.algorand_address);
      if (onChainBalance) {
        walletInfo.onChainBalance = onChainBalance;
        
        // Auto-sync: Update database with live balance if different
        const currentAlgo = walletInfo.balance?.algo || 0;
        const currentUsdca = walletInfo.balance?.usdca || 0;
        const algoChanged = Math.abs(onChainBalance.algo - currentAlgo) > 0.001;
        const usdcaChanged = Math.abs(onChainBalance.usdca - currentUsdca) > 0.001;
        
        if (algoChanged || usdcaChanged) {
          console.log(`🔄 Syncing database balance for ${wallet.algorand_address}`);
          console.log(`  ALGO: ${currentAlgo} → ${onChainBalance.algo}`);
          console.log(`  USDCa: ${currentUsdca} → ${onChainBalance.usdca}`);
          console.log(`  Updating wallet_id: ${walletInfo.walletId}`);
          
          const { data: updateResult, error: updateError } = await supabase
            .from('wallets')
            .update({
              balance_algo: onChainBalance.algo,
              balance_usdca: onChainBalance.usdca,
              updated_at: new Date().toISOString()
            })
            .eq('wallet_id', walletInfo.walletId);
          
          if (updateError) {
            console.error('❌ Database sync failed:', updateError);
          } else {
            console.log('✅ Database balance synced successfully');
          }
          
          // Update the returned wallet info
          walletInfo.balance.algo = onChainBalance.algo;
          walletInfo.balance.usdca = onChainBalance.usdca;
        }
      }
    }

    return walletInfo;

  } catch (error) {
    console.error('Error fetching user wallet:', error);
    return null;
  }
};

/**
 * Decrypt private key for transaction signing (use with caution)
 */
export const decryptPrivateKey = (encryptedPrivateKey: string): string => {
  try {
    console.log('🔐 Attempting to decrypt private key...');
    console.log('🔑 Encryption key available:', !!encryptionKey);
    console.log('📝 Encrypted key length:', encryptedPrivateKey?.length || 0);
    
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
    
    console.log('✅ Private key decrypted successfully');
    return decrypted;
  } catch (error) {
    console.error('🔒 Decryption error details:', error);
    console.error('🔒 Encrypted key preview:', encryptedPrivateKey?.substring(0, 50) + '...');
    throw new Error(`Failed to decrypt private key: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Check if user already has a wallet
 */
export const userHasWallet = async (userId: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from('wallets')
      .select('wallet_id')
      .eq('user_id', userId)
      .single();

    return !error && !!data;
  } catch (error) {
    return false;
  }
};

/**
 * Get Algorand network status and configuration
 */
export const getAlgorandStatus = async () => {
  try {
    // Check if we can connect to Algorand network
    const status = await algodClient.status().do();
    
    return {
      connected: true,
      network: network,
      lastRound: status['last-round'],
      algodUrl: algodUrl,
      usdcAssetId: usdcAssetId,
      hasToken: !!algodToken && algodToken !== 'your_algorand_api_key_here',
      usingAlgoNode: algodUrl.includes('algonode.cloud')
    };
  } catch (error) {
    return {
      connected: false,
      network: network,
      error: (error as Error).message,
      algodUrl: algodUrl,
      usdcAssetId: usdcAssetId,
      hasToken: !!algodToken && algodToken !== 'your_algorand_api_key_here'
    };
  }
};

/**
 * Create USDCa opt-in transaction (for future implementation)
 */
export const createUSDCOptInTransaction = async (
  address: string
): Promise<string | null> => {
  try {
    // This would create an asset opt-in transaction for USDCa
    // Requires the account to have ALGO for transaction fees
    // Implementation depends on having a funded testnet account
    
    console.log(`📝 USDCa opt-in transaction would be created for ${address}`);
    console.log(`💡 For hackathon: Skipping actual transaction to avoid gas fees`);
    
    return null; // Return mock transaction ID for now
  } catch (error) {
    console.error('USDCa opt-in failed:', error);
    return null;
  }
};