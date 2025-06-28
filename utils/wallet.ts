import algosdk from 'algosdk';
import CryptoJS from 'crypto-js';
import dotenv from 'dotenv';
import { supabase, handleDatabaseError } from './supabase';
import { generateBitcoinWallet, getBitcoinBalance } from './bitcoin';
import { generateSolanaWallet, getSolanaBalance } from './solana';

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
// For localnet, don't pass the third parameter. For AlgoNode (testnet/mainnet), pass empty string if token is empty
const algodClient = algodUrl.includes('localhost') 
  ? new algosdk.Algodv2(algodToken, algodUrl)
  : new algosdk.Algodv2(algodToken, algodUrl, algodToken ? '' : undefined);

export interface WalletGenerationResult {
  success: boolean;
  walletId?: string;
  bitcoinAddress?: string | undefined;
  algorandAddress?: string;
  solanaAddress?: string | undefined;
  error?: string;
  transactionIds?: string[];
  portfolioNFT?: {
    tokenId: string;
    transactionId: string;
    appId: string;
  } | undefined;
}

export interface WalletInfo {
  walletId: string;
  userId: string;
  bitcoinAddress?: string;
  algorandAddress?: string;
  solanaAddress?: string;
  encryptedBitcoinPrivateKey?: string;
  encryptedAlgorandPrivateKey?: string;
  encryptedSolanaPrivateKey?: string;
  balance: {
    btc: number;
    algo: number;
    usdca: number;
    sol: number;
  };
  onChainBalance?: {
    btc: number;
    algo: number;
    usdca: number;
    sol: number;
    lastUpdated: string;
    isOptedIntoUSDCa?: boolean;
  };
  createdAt: string;
}

/**
 * Generate new Bitcoin + Algorand + Solana wallets with encrypted private key storage
 */
export const generateWallet = async (userId: string): Promise<WalletGenerationResult> => {
  try {
    console.log(`🔐 Generating new Bitcoin + Algorand + Solana wallets for user: ${userId}`);

    // Generate Bitcoin wallet first (Bitcoin-first approach)
    const bitcoinWallet = await generateBitcoinWallet();
    if (!bitcoinWallet.success) {
      return {
        success: false,
        error: `Bitcoin wallet generation failed: ${bitcoinWallet.error}`
      };
    }

    console.log(`✅ Generated Bitcoin address: ${bitcoinWallet.address}`);

    // Generate Algorand wallet
    const algorandAccount = algosdk.generateAccount();
    const algorandAddress = algorandAccount.addr.toString();
    const algorandPrivateKey = algosdk.secretKeyToMnemonic(algorandAccount.sk);

    console.log(`✅ Generated Algorand address: ${algorandAddress}`);

    // Generate Solana wallet
    const solanaWallet = generateSolanaWallet();
    console.log(`✅ Generated Solana address: ${solanaWallet.address}`);

    // Auto-fund the Algorand wallet in development/testnet
    if (process.env.NODE_ENV !== 'production') {
      try {
        console.log(`💰 Auto-funding new Algorand wallet for development...`);
        await fundAlgorandWallet(algorandAddress);
        console.log(`✅ Algorand wallet funded successfully`);
      } catch (fundingError) {
        console.error('⚠️ Auto-funding failed (wallet still created):', fundingError);
        // Don't fail wallet creation if funding fails
      }
    }

    // Encrypt all private keys before storing
    const encryptedBitcoinPrivateKey = bitcoinWallet.encryptedPrivateKey!;
    const encryptedAlgorandPrivateKey = CryptoJS.AES.encrypt(algorandPrivateKey, encryptionKey).toString();
    const encryptedSolanaPrivateKey = solanaWallet.encryptedPrivateKey;

    // Try to store with all blockchain fields first, fallback if columns don't exist
    console.log('🔍 Attempting to store Bitcoin + Algorand + Solana wallet...');
    
    let walletData: any = {
      user_id: userId,
      algorand_address: algorandAddress,
      encrypted_private_key: encryptedAlgorandPrivateKey, // Backward compatibility
      bitcoin_address: bitcoinWallet.address,
      encrypted_bitcoin_private_key: encryptedBitcoinPrivateKey,
      encrypted_algorand_private_key: encryptedAlgorandPrivateKey,
      solana_address: solanaWallet.address,
      encrypted_solana_private_key: encryptedSolanaPrivateKey,
      blockchain: 'multi-chain',
      asset_id: usdcAssetId,
      balance_btc: 0,
      balance_usdca: 0,
      balance_algo: 0,
      balance_sol: 0
    };

    console.log('🔍 Exact wallet data being inserted:', JSON.stringify(walletData, null, 2));
    console.log('🔍 Field lengths:', Object.entries(walletData).map(([k,v]) => `${k}: ${typeof v === 'string' ? v.length : typeof v}`));

    let { data: newWallet, error: walletError } = await supabase
      .from('wallets')
      .insert(walletData)
      .select('wallet_id')
      .single();

    // If newer columns don't exist, fallback to basic wallet storage
    if (walletError && (
      walletError.message.includes('bitcoin_address') ||
      walletError.message.includes('encrypted_bitcoin_private_key') ||
      walletError.message.includes('balance_btc') ||
      walletError.message.includes('solana_address') ||
      walletError.message.includes('encrypted_solana_private_key') ||
      walletError.message.includes('balance_sol')
    )) {
      console.log('💡 Multi-chain columns not available, trying basic Bitcoin + Algorand...');
      
      // Try Bitcoin + Algorand first
      walletData = {
        user_id: userId,
        algorand_address: algorandAddress,
        encrypted_private_key: encryptedAlgorandPrivateKey,
        bitcoin_address: bitcoinWallet.address,
        encrypted_bitcoin_private_key: encryptedBitcoinPrivateKey,
        encrypted_algorand_private_key: encryptedAlgorandPrivateKey,
        blockchain: 'multi-chain',
        asset_id: usdcAssetId,
        balance_btc: 0,
        balance_usdca: 0,
        balance_algo: 0
      };

      let result = await supabase
        .from('wallets')
        .insert(walletData)
        .select('wallet_id') 
        .single();
      
      // If Bitcoin columns still don't work, fallback to Algorand-only
      if (result.error && (
        result.error.message.includes('bitcoin_address') ||
        result.error.message.includes('encrypted_bitcoin_private_key') ||
        result.error.message.includes('balance_btc')
      )) {
        console.log('💡 Bitcoin columns not available, storing Algorand wallet only');
        
        walletData = {
          user_id: userId,
          algorand_address: algorandAddress,
          encrypted_private_key: encryptedAlgorandPrivateKey,
          asset_id: usdcAssetId,
          balance_usdca: 0,
          balance_algo: 0
        };

        result = await supabase
          .from('wallets')
          .insert(walletData)
          .select('wallet_id') 
          .single();
      }
      
      newWallet = result.data;
      walletError = result.error;
    }

    if (walletError || !newWallet) {
      console.error('❌ Failed to store wallet in database:', walletError);
      const dbError = handleDatabaseError(walletError);
      return {
        success: false,
        error: `Database error: ${dbError.error}`
      };
    }

    const bitcoinStored = walletData.bitcoin_address === bitcoinWallet.address;
    const solanaStored = walletData.solana_address === solanaWallet.address;
    
    if (bitcoinStored && solanaStored) {
      console.log(`✅ Bitcoin + Algorand + Solana wallet stored in database with ID: ${newWallet.wallet_id}`);
      console.log(`🪙 Bitcoin address: ${bitcoinWallet.address} (STORED)`);
      console.log(`🔷 Algorand address: ${algorandAddress} (STORED)`);
      console.log(`🟣 Solana address: ${solanaWallet.address} (STORED)`);
      console.log(`🔐 All private keys: ENCRYPTED and STORED`);
    } else if (bitcoinStored) {
      console.log(`✅ Bitcoin + Algorand wallet stored in database with ID: ${newWallet.wallet_id}`);
      console.log(`🪙 Bitcoin address: ${bitcoinWallet.address} (STORED)`);
      console.log(`🔷 Algorand address: ${algorandAddress} (STORED)`);
      console.log(`🟣 Solana address: ${solanaWallet.address} (generated but NOT stored - migration needed)`);
      console.log(`🔐 Bitcoin + Algorand keys: ENCRYPTED and STORED`);
    } else {
      console.log(`✅ Algorand wallet stored in database with ID: ${newWallet.wallet_id}`);
      console.log(`🔷 Algorand address: ${algorandAddress} (STORED)`);
      console.log(`🪙 Bitcoin address: ${bitcoinWallet.address} (generated but NOT stored - migration needed)`);
      console.log(`🟣 Solana address: ${solanaWallet.address} (generated but NOT stored - migration needed)`);
      console.log(`🔐 Algorand key: ENCRYPTED and STORED`);
    }

    const transactionIds: string[] = [];

    // Create Portfolio NFT for the new user
    let portfolioNFT = undefined;
    try {
      console.log(`🎨 Creating Portfolio NFT for new user: ${userId}`);
      
      // Dynamic import to avoid circular dependencies
      const { nftContractService } = await import('../services/nft-contract.service');
      const { userPortfolioService } = await import('../services/user-portfolio.service');
      
      // Mint portfolio NFT for the user
      const portfolioResult = await nftContractService.mintPortfolioToken({
        owner: algorandAddress.toString(),
        level: 1,
        metadataCid: 'QmDefaultOnboardingPortfolioMetadata'
      });

      if (portfolioResult.tokenId) {
        // Store in database
        const portfolioRecord = await userPortfolioService.storeUserPortfolio({
          userId: userId,
          portfolioTokenId: parseInt(portfolioResult.tokenId),
          portfolioAppId: parseInt(portfolioResult.appId),
          algorandAddress: algorandAddress.toString(),
          isPrimary: true,
          customName: 'My Portfolio'
        });
        
        if (portfolioRecord) {
                  portfolioNFT = {
          tokenId: portfolioResult.tokenId,
          transactionId: portfolioResult.transactionId,
          appId: portfolioResult.appId
        };
          console.log(`✅ Portfolio NFT created: Token ID ${portfolioResult.tokenId}`);
        }
      }
    } catch (nftError) {
      console.error('⚠️ Portfolio NFT creation failed (wallet still created):', nftError);
      // Don't fail wallet creation if NFT creation fails
    }

    console.log(`🎉 Multi-chain wallet creation completed successfully!`);
    
    if (bitcoinStored && solanaStored) {
      console.log(`🎯 Status: Full Bitcoin + Algorand + Solana support active`);
    } else if (bitcoinStored) {
      console.log(`📝 Status: Bitcoin + Algorand stored, Solana functional but not persisted`);
      console.log(`💡 Run add-solana-support.sql to enable Solana storage`);
    } else {
      console.log(`📝 Status: Algorand stored, Bitcoin + Solana functional but not persisted`);
      console.log(`💡 Run bitcoin-migration.sql and add-solana-support.sql to enable full multi-chain storage`);
    }

    return {
      success: true,
      walletId: newWallet.wallet_id,
      bitcoinAddress: bitcoinWallet.address || undefined, // Return Bitcoin address even if not stored yet
      algorandAddress: algorandAddress.toString(),
      solanaAddress: solanaWallet.address || undefined, // Return Solana address even if not stored yet
      transactionIds,
      portfolioNFT
    };

  } catch (error) {
    console.error('❌ Multi-chain wallet generation failed:', error);
    return {
      success: false,
      error: (error as Error).message
    };
  }
};

/**
 * Fund an Algorand wallet using AlgoKit's dispenser pattern
 */
const fundAlgorandWallet = async (algorandAddress: string): Promise<void> => {
  try {
    // Import AlgorandClient for proper dispenser access
    const { AlgorandClient } = await import('@algorandfoundation/algokit-utils');
    const { AlgoAmount } = await import('@algorandfoundation/algokit-utils/types/amount');
    
    // Configure Algorand client same as NFT service
    const algodConfig = {
      server: 'http://localhost',
      port: 4001,
      token: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    };
    
    const indexerConfig = {
      server: 'http://localhost',
      port: 8980,
      token: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    };

    const algorand = AlgorandClient.fromConfig({
      algodConfig,
      indexerConfig,
    });
    
    // Get localnet dispenser account (same as NFT service)
    const dispenserAccount = await algorand.account.localNetDispenser();
    
    console.log(`💰 Funding ${algorandAddress} from localnet dispenser ${dispenserAccount.addr}`);
    
    // Send 5 ALGO to the new wallet
    const fundingAmount = 5000000; // 5 ALGO in microALGO
    
    const response = await algorand.send.payment({
      sender: dispenserAccount.addr.toString(),
      receiver: algorandAddress,
      amount: AlgoAmount.MicroAlgos(fundingAmount),
      signer: dispenserAccount.signer
    });

    console.log(`✅ Wallet funded successfully: ${fundingAmount / 1000000} ALGO sent to ${algorandAddress}`);
    console.log(`💳 Transaction ID: ${response.txIds[0]}`);
    
  } catch (error) {
    console.error('Auto-funding error:', error);
    throw error;
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
    const algoBalance = Number(accountInfo.amount) / 1000000;
    
    // Find USDCa asset balance
    let usdcaBalance = 0;
    let isOptedIntoUSDCa = false;
    
    console.log(`🔍 Account has ${accountInfo.assets?.length || 0} assets:`, accountInfo.assets?.map((a: any) => a['asset-id']) || []);
    
    if (accountInfo.assets && accountInfo.assets.length > 0) {
      const usdcaAsset = accountInfo.assets.find((asset: any) => asset['asset-id'] === usdcAssetId);
      if (usdcaAsset) {
        isOptedIntoUSDCa = true;
        // USDCa has 6 decimal places
        usdcaBalance = Number(usdcaAsset.amount) / 1000000;
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
      bitcoinAddress: wallet.bitcoin_address || undefined, // May not exist in old schema
      algorandAddress: wallet.algorand_address,
      solanaAddress: wallet.solana_address || undefined, // May not exist in old schema
      encryptedBitcoinPrivateKey: wallet.encrypted_bitcoin_private_key || undefined, // May not exist in old schema
      encryptedAlgorandPrivateKey: wallet.encrypted_algorand_private_key || wallet.encrypted_private_key, // Backward compatibility
      encryptedSolanaPrivateKey: wallet.encrypted_solana_private_key || undefined, // May not exist in old schema
      balance: {
        btc: wallet.balance_btc || 0, // May not exist in old schema
        algo: wallet.balance_algo || 0,
        usdca: wallet.balance_usdca || 0,
        sol: wallet.balance_sol || 0 // May not exist in old schema
      },
      createdAt: wallet.created_at
    };

    // Optionally fetch live on-chain balances
    if (includeLiveBalance) {
      let btcBalance = 0;
      let algoBalance = 0;
      let usdcaBalance = 0;
      let solBalance = 0;
      let isOptedIntoUSDCa = false;

      // Fetch Bitcoin balance if address exists (may not exist in old schema)
      if (wallet.bitcoin_address) {
        btcBalance = await getBitcoinBalance(wallet.bitcoin_address);
      } else {
        console.log(`💡 Bitcoin address not found for user ${userId} - database migration needed`);
      }

      // Fetch Algorand balance if address exists
      if (wallet.algorand_address) {
        const algorandBalance = await getOnChainBalance(wallet.algorand_address);
        if (algorandBalance) {
          algoBalance = algorandBalance.algo;
          usdcaBalance = algorandBalance.usdca;
          isOptedIntoUSDCa = algorandBalance.isOptedIntoUSDCa || false;
        }
      }

      // Fetch Solana balance if address exists (may not exist in old schema)
      if (wallet.solana_address) {
        solBalance = await getSolanaBalance(wallet.solana_address);
      } else {
        console.log(`💡 Solana address not found for user ${userId} - database migration needed`);
      }

      walletInfo.onChainBalance = {
        btc: btcBalance,
        algo: algoBalance,
        usdca: usdcaBalance,
        sol: solBalance,
        lastUpdated: new Date().toISOString(),
        isOptedIntoUSDCa
      };

      // Auto-sync: Update database with live balances if different
      const currentBtc = walletInfo.balance?.btc || 0;
      const currentAlgo = walletInfo.balance?.algo || 0;
      const currentUsdca = walletInfo.balance?.usdca || 0;
      const currentSol = walletInfo.balance?.sol || 0;
      
      const btcChanged = Math.abs(btcBalance - currentBtc) > 0.00001; // Bitcoin precision
      const algoChanged = Math.abs(algoBalance - currentAlgo) > 0.001;
      const usdcaChanged = Math.abs(usdcaBalance - currentUsdca) > 0.001;
      const solChanged = Math.abs(solBalance - currentSol) > 0.000001; // Solana precision
      
      if (btcChanged || algoChanged || usdcaChanged || solChanged) {
        console.log(`🔄 Syncing multi-chain database balances for user ${userId}`);
        console.log(`  BTC: ${currentBtc} → ${btcBalance}`);
        console.log(`  ALGO: ${currentAlgo} → ${algoBalance}`);
        console.log(`  USDCa: ${currentUsdca} → ${usdcaBalance}`);
        console.log(`  SOL: ${currentSol} → ${solBalance}`);
        
        // Only update columns that exist in current schema
        const updateFields: any = {
          balance_algo: algoBalance,
          balance_usdca: usdcaBalance,
          updated_at: new Date().toISOString()
        };
        
        // Only add Bitcoin balance if column exists (after migration)
        if (wallet.balance_btc !== undefined) {
          updateFields.balance_btc = btcBalance;
        }

        // Only add Solana balance if column exists (after migration)
        if (wallet.balance_sol !== undefined) {
          updateFields.balance_sol = solBalance;
        }

        const { error: updateError } = await supabase
          .from('wallets')
          .update(updateFields)
          .eq('wallet_id', walletInfo.walletId);
        
        if (updateError) {
          console.error('❌ Multi-chain database sync failed:', updateError);
        } else {
          console.log('✅ Multi-chain database balances synced successfully');
        }
        
        // Update the returned wallet info
        walletInfo.balance.btc = btcBalance;
        walletInfo.balance.algo = algoBalance;
        walletInfo.balance.usdca = usdcaBalance;
        walletInfo.balance.sol = solBalance;
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
      lastRound: status.lastRound,
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