import express from 'express';
import { supabase } from '../../../utils/supabase';
import { moonPayService } from '../../../utils/moonpay';

const router = express.Router();

interface MoonPayWebhookData {
  type: string;
  data: {
    id: string;
    status: string;
    cryptoAmount?: number;
    cryptoCurrency?: string;
    baseCurrencyAmount?: number;
    baseCurrency?: string;
    walletAddress?: string;
    externalTransactionId?: string;
    failureReason?: string;
    feeAmount?: number;
    networkFeeAmount?: number;
  };
}

interface Investment {
  investment_id: string;
  user_id: string;
  wallet_id?: string;
  investment_type: string;
  target_asset: string;
  amount_usd: number;
  estimated_btc?: number;
  estimated_algo?: number;
  estimated_sol?: number;
  bitcoin_price_usd?: number;
  algo_price_usd?: number;
  solana_price_usd?: number;
  fees_paid?: number;
  moonpay_url?: string;
  moonpay_transaction_id?: string;
  status: string;
  risk_acknowledged: boolean;
  created_at: string;
  completed_at?: string;
  updated_at?: string;
}

/**
 * MoonPay Webhook Handler
 * Processes payment completion and creates investments + NFTs
 * POST /api/moonpay/webhook
 */
router.post('/', async (req, res) => {
  try {
    const signature = req.headers['moonpay-signature-v2'] as string;
    const payload = JSON.stringify(req.body);

    console.log('🌙 MoonPay webhook received:', {
      type: req.body.type,
      status: req.body.data?.status || req.body.status,
      transactionId: req.body.data?.id || req.body.id
    });
    
    // Debug: Log full payload for development
    if (process.env.NODE_ENV !== 'production') {
      console.log('📋 Full webhook payload:', JSON.stringify(req.body, null, 2));
    }

    // Verify webhook signature
    try {
      if (!moonPayService.verifyWebhookSignature(payload, signature)) {
        console.error('❌ Invalid MoonPay webhook signature');
        return res.status(401).json({ error: 'Invalid signature' });
      }
    } catch (signatureError) {
      console.error('❌ Signature verification failed:', signatureError);
      // In development/testing, continue processing but log the error
      if (process.env.NODE_ENV === 'production') {
        return res.status(401).json({ error: 'Signature verification failed' });
      }
      console.warn('⚠️ Continuing in development mode despite signature error');
    }

    const webhookData: MoonPayWebhookData = req.body;

    // Handle MoonPay event types (both buy and sell events)
    const buyEventTypes = [
      'transaction_created',
      'transaction_updated', 
      'transaction_failed',
      'Transaction Created',
      'Transaction Updated', 
      'Transaction Failed'
    ];
    
    const sellEventTypes = [
      'sell_transaction_created',
      'sell_transaction_updated', 
      'sell_transaction_failed'
    ];
    
    // Skip sell transactions early (Cultivest is for buying crypto)
    if (sellEventTypes.includes(webhookData.type)) {
      console.log('ℹ️ Sell transaction webhook received, skipping processing:', webhookData.type);
      return res.json({ success: true, message: 'Sell transaction - no action needed' });
    }
    
    const allHandledEvents = [...buyEventTypes, ...sellEventTypes];
    
    if (!allHandledEvents.includes(webhookData.type)) {
      console.log('ℹ️ Webhook type not handled:', webhookData.type);
      return res.json({ success: true, message: 'Webhook type not handled' });
    }

    // Extract data from webhook (handle MoonPay's complex structure)
    let data;
    if (typeof webhookData.data === 'string') {
      // Parse JSON string data
      try {
        data = JSON.parse(webhookData.data);
      } catch (error) {
        console.error('Failed to parse webhook data JSON:', error);
        data = webhookData;
      }
    } else {
      // Use nested data or fallback to root
      data = webhookData.data || webhookData;
    }
    
    const { 
      id, 
      status, 
      quoteCurrencyAmount,
      cryptoAmount, 
      cryptoCurrency, 
      baseCurrencyAmount, 
      externalTransactionId, 
      failureReason,
      currency 
    } = data;
    
    // Extract crypto currency from nested structure
    const finalCryptoCurrency = cryptoCurrency || currency?.code?.toLowerCase();
    const finalCryptoAmount = cryptoAmount || quoteCurrencyAmount;
    
    console.log('📊 Extracted transaction data:', {
      id,
      status,
      externalTransactionId,
      cryptoCurrency: finalCryptoCurrency,
      cryptoAmount: finalCryptoAmount,
      baseCurrencyAmount
    });

    // Process based on MoonPay event type and status
    const isCreatedEvent = ['Transaction Created', 'transaction_created'].includes(webhookData.type);
    const isUpdatedEvent = ['Transaction Updated', 'transaction_updated'].includes(webhookData.type);
    const isFailedEvent = ['Transaction Failed', 'transaction_failed'].includes(webhookData.type);

    // Find investment by external transaction ID or MoonPay transaction ID
    let investment = await findInvestment(externalTransactionId || id);
    
    // If no investment found and this is a pending status update, create one
    if (!investment && status === 'pending' && isUpdatedEvent) {
      console.log('💡 Creating missing investment record for transaction:', id);
      
      // Double-check if another webhook already created this record (race condition protection)
      investment = await findInvestment(id);
      if (investment) {
        console.log('🔄 Investment already exists, using existing record:', investment.investment_id);
      } else {
        // Extract wallet address and derive user info
        const walletAddress = data.walletAddress;
        if (!walletAddress) {
          console.error('❌ No wallet address in webhook data to create investment');
          return res.status(400).json({ error: 'No wallet address provided' });
        }
        
        // Look up user by wallet address
        const user = await findUserByWalletAddress(walletAddress);
        if (!user) {
          console.error('❌ No user found for wallet address:', walletAddress);
          return res.status(404).json({ error: 'User not found for wallet address' });
        }
        
        // Map crypto currency to target asset
        const targetAssetMap: { [key: string]: string } = {
          'btc': 'BTC',
          'algo': 'ALGO', 
          'usdc': 'USDC',
          'sol': 'SOL'
        };
        
        const targetAsset = targetAssetMap[finalCryptoCurrency?.toLowerCase() || 'btc'] || 'BTC';
        
        // Create investment record with duplicate protection
        investment = await createInvestmentRecord({
          userId: user.user_id,
          targetAsset: targetAsset,
          amountUsd: baseCurrencyAmount || 0,
          moonpayTransactionId: id
        });
        
        if (investment) {
          console.log('✅ Created investment:', investment.investment_id);
        }
      }
    }
    
    // If no investment found but this is a failed/cancelled event, create a failed record
    if (!investment && (isFailedEvent || status === 'failed' || status === 'cancelled')) {
      console.log('💡 Creating failed investment record for transaction:', id);
      
      // Double-check if another webhook already created this record (race condition protection)
      investment = await findInvestment(id);
      if (investment) {
        console.log('🔄 Failed investment already exists, using existing record:', investment.investment_id);
      } else {
        // Extract wallet address and derive user info
        const walletAddress = data.walletAddress;
        if (walletAddress) {
          const user = await findUserByWalletAddress(walletAddress);
          if (user) {
            // Map crypto currency to target asset
            const targetAssetMap: { [key: string]: string } = {
              'btc': 'BTC',
              'algo': 'ALGO', 
              'usdc': 'USDC',
              'sol': 'SOL'
            };
            
            const targetAsset = targetAssetMap[finalCryptoCurrency?.toLowerCase() || 'btc'] || 'BTC';
            
            // Create failed investment record
            investment = await createInvestmentRecord({
              userId: user.user_id,
              targetAsset: targetAsset,
              amountUsd: baseCurrencyAmount || 0,
              moonpayTransactionId: id
            });
            
            if (investment) {
              console.log('✅ Created failed investment record:', investment.investment_id);
            }
          }
        }
      }
    }
    
    if (!investment) {
      console.error('❌ Investment not found for:', externalTransactionId || id);
      return res.status(404).json({ error: 'Investment not found' });
    }

    console.log('📊 Processing investment for user:', investment.user_id);

    // Update with MoonPay transaction ID if not set
    if (!investment.moonpay_transaction_id) {
      await updateInvestment(investment.investment_id, { moonpay_transaction_id: id });
    }

    // Process based on MoonPay event type and status    
    if (isCreatedEvent) {
      console.log(`📝 Transaction created: ${id}`);
      await updateInvestment(investment.investment_id, { status: 'processing' });
      
    } else if (isUpdatedEvent) {
      // Check the status for completion, failure, or cancellation
      switch (status) {
        case 'completed':
          await handleMoonPayCompleted(investment, finalCryptoAmount || 0, baseCurrencyAmount || investment.amount_usd, finalCryptoCurrency || 'BTC');
          break;

        case 'failed':
          await handleMoonPayFailed(investment, failureReason);
          break;

        case 'cancelled':
          await handleMoonPayCancelled(investment);
          break;

        default:
          console.log(`ℹ️ Transaction updated to status ${status} - no action needed`);
          await updateInvestment(investment.investment_id, { status: 'processing' });
      }
      
    } else if (isFailedEvent) {
      await handleMoonPayFailed(investment, failureReason);
    }

    return res.json({ success: true, message: 'Webhook processed successfully' });

  } catch (error) {
    console.error('❌ MoonPay webhook error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Handle successful MoonPay payment - create investment and NFTs
 */
async function handleMoonPayCompleted(
  investment: Investment, 
  cryptoAmount: number, 
  usdAmount: number,
  cryptoCurrency: string
) {
  try {
    console.log(`✅ MoonPay completed for user ${investment.user_id}: ${cryptoAmount} ${cryptoCurrency}`);

    // Get user's wallet address for NFT creation
    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('algorand_address')
      .eq('user_id', investment.user_id)
      .single();

    if (walletError || !wallet) {
      throw new Error('Could not find user wallet for NFT creation');
    }

    // Convert crypto currency to asset type
    const assetTypeMap: { [key: string]: number } = {
      'BTC': 1,
      'ALGO': 2,
      'USDC': 3,
      'SOL': 4
    };

    const assetType = assetTypeMap[cryptoCurrency.toUpperCase()] || 1;

    // Convert crypto amount to holdings (smallest unit)
    let holdings: bigint;
    switch (assetType) {
      case 1: // Bitcoin (satoshis)
        holdings = BigInt(Math.floor(cryptoAmount * 100000000));
        break;
      case 2: // Algorand (microalgos)
        holdings = BigInt(Math.floor(cryptoAmount * 1000000));
        break;
      case 3: // USDC (microUSDC)
        holdings = BigInt(Math.floor(cryptoAmount * 1000000));
        break;
      case 4: // Solana (lamports)
        holdings = BigInt(Math.floor(cryptoAmount * 1000000000));
        break;
      default:
        holdings = BigInt(Math.floor(cryptoAmount * 1000000)); // Default to 6 decimals
    }

    // Call the actual investment creation logic
    const investmentResult = await createUserInvestment({
      userId: investment.user_id,
      algorandAddress: wallet.algorand_address,
      assetType: assetType,
      holdings: holdings.toString(),
      purchaseValueUsd: Math.floor(usdAmount * 100), // Convert to cents
      portfolioName: 'My Portfolio',
      moonpayTransactionId: investment.moonpay_transaction_id || undefined
    });

    if (investmentResult.success) {
      console.log('🎯 Investment and NFTs created successfully:', investmentResult.data);
      
      // Mark investment as completed
      await updateInvestment(investment.investment_id, { 
        status: 'completed',
        completed_at: new Date().toISOString()
      });

      console.log(`✅ Investment completed for user ${investment.user_id}`);
    } else {
      throw new Error(`Investment creation failed: ${investmentResult.error}`);
    }

  } catch (error) {
    console.error('❌ Error handling MoonPay completion:', error);
    
    // Mark as failed
    await updateInvestment(investment.investment_id, {
      status: 'failed'
    });
    
    throw error;
  }
}

/**
 * Handle failed MoonPay payment
 */
async function handleMoonPayFailed(investment: Investment, failureReason?: string) {
  try {
    console.log(`❌ MoonPay failed for user ${investment.user_id}: ${failureReason}`);

    // Check if auto-funding is enabled for this user in dev mode
    const isDevMode = process.env.NODE_ENV !== 'production';
    let autoFundOnFailure = false;
    
    if (isDevMode) {
      try {
        const { data: userPrefs } = await supabase
          .from('user_preferences')
          .select('auto_fund_on_failure')
          .eq('user_id', investment.user_id)
          .single();
        
        autoFundOnFailure = userPrefs?.auto_fund_on_failure || false;
        console.log(`🔍 User ${investment.user_id} auto-fund preference: ${autoFundOnFailure}`);
      } catch (error) {
        console.log(`🔍 No auto-fund preference found for user ${investment.user_id}, defaulting to false`);
        autoFundOnFailure = false;
      }
    }
    
    if (isDevMode && autoFundOnFailure) {
      console.log('🚀 Dev mode + autoFundOnFailure detected - attempting auto-funding and investment creation');
      
      try {
        // Get wallet addresses for the user
        const { data: walletData } = await supabase
          .from('wallets')
          .select('bitcoin_address, algorand_address, solana_address')
          .eq('user_id', investment.user_id)
          .single();

        if (!walletData) {
          console.error('❌ No wallet found for user:', investment.user_id);
          await updateInvestment(investment.investment_id, { status: 'failed' });
          return;
        }

        // Determine target asset and wallet
        const targetAsset = investment.target_asset?.toLowerCase() || 'btc';
        let targetWallet = '';
        
        switch (targetAsset) {
          case 'btc':
            targetWallet = walletData.bitcoin_address;
            break;
          case 'algo':
            targetWallet = walletData.algorand_address;
            break;
          case 'sol':
            targetWallet = walletData.solana_address;
            break;
          default:
            targetWallet = walletData.bitcoin_address; // Default to Bitcoin
        }

        if (!targetWallet) {
          console.error(`❌ No ${targetAsset.toUpperCase()} wallet found for user:`, investment.user_id);
          await updateInvestment(investment.investment_id, { status: 'failed' });
          return;
        }

        // Step 1: Fund wallet via faucet (currently only Bitcoin supported)
        if (targetAsset === 'btc') {
          console.log('⚡ Auto-funding Bitcoin wallet via faucet...');
          const { sendBitcoin } = await import('../../../utils/bitcoin');
          
          const faucetPrivateKey = process.env.BTC_TESTNET_FAUCET_PRIVATE_KEY;
          if (!faucetPrivateKey) {
            console.error('❌ BTC_TESTNET_FAUCET_PRIVATE_KEY not configured');
            await updateInvestment(investment.investment_id, { status: 'failed' });
            return;
          }

          const faucetResult = await sendBitcoin(
            faucetPrivateKey,
            targetWallet,
            546 // 546 satoshis minimum
          );

          if (!faucetResult.success) {
            console.error('❌ Auto-funding failed:', faucetResult.error);
            await updateInvestment(investment.investment_id, { status: 'failed' });
            return;
          }

          console.log('✅ Bitcoin wallet auto-funded via faucet:', faucetResult.mempoolUrl);
        }

        // Step 2: Create investment using existing logic
        console.log('💼 Auto-creating investment...');
        
        const assetTypeMap = { 'btc': 1, 'algo': 2, 'usdc': 3, 'sol': 4 };
        const assetType = assetTypeMap[targetAsset as keyof typeof assetTypeMap] || 1;
        const holdings = targetAsset === 'btc' ? '546' : '1000000'; // 546 sats for BTC, 1 unit for others
        
        const investmentResult = await createUserInvestment({
          userId: investment.user_id,
          algorandAddress: walletData.algorand_address, // Algorand is used for NFTs regardless of target asset
          assetType: assetType,
          holdings: holdings,
          purchaseValueUsd: Math.round((investment.amount_usd || 10) * 100), // Convert to cents
          portfolioName: `${targetAsset.toUpperCase()} Portfolio`,
          moonpayTransactionId: investment.moonpay_transaction_id || undefined
        });

        if (investmentResult.success) {
          console.log('✅ Auto-investment created successfully');
          await updateInvestment(investment.investment_id, {
            status: 'completed'
          });
        } else {
          console.error('❌ Auto-investment creation failed:', investmentResult.error);
          await updateInvestment(investment.investment_id, { status: 'failed' });
        }

      } catch (autoFundError) {
        console.error('❌ Auto-funding process failed:', autoFundError);
        await updateInvestment(investment.investment_id, { status: 'failed' });
      }
    } else {
      // Normal failure handling
      await updateInvestment(investment.investment_id, {
        status: 'failed'
      });
    }

  } catch (error) {
    console.error('❌ Error handling MoonPay failure:', error);
  }
}

/**
 * Handle cancelled MoonPay payment
 */
async function handleMoonPayCancelled(investment: Investment) {
  try {
    console.log(`🚫 MoonPay cancelled for user ${investment.user_id}`);

    await updateInvestment(investment.investment_id, {
      status: 'cancelled'
    });

  } catch (error) {
    console.error('❌ Error handling MoonPay cancellation:', error);
  }
}

/**
 * Find investment by external transaction ID or MoonPay transaction ID
 */
async function findInvestment(transactionId: string | undefined): Promise<Investment | null> {
  try {
    if (!transactionId) {
      console.warn('No transaction ID provided to find investment');
      return null;
    }

    // Try to find by MoonPay transaction ID
    const { data, error } = await supabase
      .from('investments')
      .select('*')
      .eq('moonpay_transaction_id', transactionId)
      .single();

    return error ? null : data;

  } catch (error) {
    console.error('Error finding investment:', error);
    return null;
  }
}

/**
 * Update investment record
 */
async function updateInvestment(investmentId: string, updates: Partial<Investment>) {
  const { error } = await supabase
    .from('investments')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('investment_id', investmentId);

  if (error) {
    console.error('Error updating investment:', error);
    throw error;
  }
}

/**
 * Create user investment with NFTs - extracted from users/invest endpoint
 * This is the same logic used by the main investment API
 */
async function createUserInvestment(params: {
  userId: string;
  algorandAddress: string;
  assetType: number;
  holdings: string;
  purchaseValueUsd: number;
  portfolioName: string;
  moonpayTransactionId?: string | undefined;
}): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    // Import services
    const { userPortfolioService } = await import('../../../services/user-portfolio.service');
    const { nftContractService } = await import('../../../services/nft-contract.service');
    const { v4: uuidv4 } = await import('uuid');

    const { userId, algorandAddress, assetType, holdings, purchaseValueUsd, portfolioName, moonpayTransactionId } = params;

    const calculatedHoldings = holdings;
    const calculatedPurchaseValue = purchaseValueUsd;

    // Step 1: Get or create user's primary portfolio
    let userPortfolio = await userPortfolioService.getUserPrimaryPortfolio(userId);
    
    if (!userPortfolio) {
      console.log(`Creating primary portfolio for user ${userId}`);
      
      const portfolioResult = await nftContractService.mintPortfolioToken({
        owner: algorandAddress,
        level: 1,
        metadataCid: 'QmDefaultPortfolioMetadata'
      });

      if (!portfolioResult.tokenId) {
        throw new Error('Failed to create portfolio for user');
      }

      userPortfolio = await userPortfolioService.storeUserPortfolio({
        userId,
        portfolioTokenId: parseInt(portfolioResult.tokenId),
        portfolioAppId: parseInt(portfolioResult.appId),
        algorandAddress: algorandAddress,
        isPrimary: true,
        customName: portfolioName || 'My Portfolio'
      });

      console.log(`Created portfolio token ${portfolioResult.tokenId} for user ${userId}`);
    }

    // Step 2: Check if this is user's first investment
    const { data: existingInvestments } = await supabase
      .from('investments')
      .select('investment_id')
      .eq('user_id', userId)
      .eq('status', 'completed');
    
    const isFirstInvestment = !existingInvestments || existingInvestments.length === 0;
    console.log(`🎯 First investment check for user ${userId}: ${isFirstInvestment ? 'YES - First investment!' : 'No - Has previous investments'}`);
    
    // Step 3: Create investment table record
    const investmentId = uuidv4();
    
    // Map asset types to target assets for database
    const targetAssetMapping = { 1: 'BTC', 2: 'ALGO', 3: 'USDC', 4: 'SOL' };
    const targetAsset = targetAssetMapping[assetType as keyof typeof targetAssetMapping];
    
    const investmentData = {
      investment_id: investmentId,
      user_id: userId,
      investment_type: `${targetAsset.toLowerCase()}_purchase`,
      target_asset: targetAsset,
      amount_usd: (calculatedPurchaseValue / 100),
      status: 'completed',
      risk_acknowledged: true,
      created_at: new Date().toISOString(),
      moonpay_transaction_id: moonpayTransactionId || null,
      is_first_investment: isFirstInvestment
    };

    const { data: investment, error: investmentError } = await supabase
      .from('investments')
      .insert(investmentData)
      .select()
      .single();

    if (investmentError) {
      console.error('Failed to create investment record:', investmentError);
      throw new Error('Failed to create investment record');
    }

    // Step 3.5: Update user's first investment timestamp if this is their first
    if (isFirstInvestment) {
      console.log(`🎉 Updating user ${userId} first investment timestamp`);
      const { error: userUpdateError } = await supabase
        .from('users')
        .update({ 
          first_investment_completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);
      
      if (userUpdateError) {
        console.error('Failed to update user first investment timestamp:', userUpdateError);
        // Don't throw error - investment already created successfully
      } else {
        console.log(`✅ Marked first investment completion for user ${userId}`);
      }
    }

    // Step 4: Mint position NFT
    const positionResult = await nftContractService.mintPositionToken({
      owner: algorandAddress,
      assetType,
      holdings: BigInt(calculatedHoldings),
      purchaseValueUsd: BigInt(calculatedPurchaseValue)
    });

    if (!positionResult.tokenId) {
      throw new Error('Failed to mint position token');
    }

    console.log(`Minted position token ${positionResult.tokenId} for user ${userId}`);

    // Step 5: Add position to user's portfolio
    console.log(`🔍 Portfolio Debug - About to add position to portfolio:`);
    console.log(`- Portfolio Token ID: ${userPortfolio.portfolioTokenId}`);
    console.log(`- Position Token ID: ${positionResult.tokenId}`);
    console.log(`- Owner Address: ${algorandAddress}`);
    console.log(`- Portfolio App ID: ${userPortfolio.portfolioAppId}`);
    
    const portfolioAddResult = await nftContractService.addPositionToPortfolio({
      portfolioTokenId: BigInt(userPortfolio.portfolioTokenId),
      positionTokenId: BigInt(positionResult.tokenId),
      owner: algorandAddress
    });

    console.log(`Added position ${positionResult.tokenId} to portfolio ${userPortfolio.portfolioTokenId}`);

    // Step 6: Return complete investment result
    const assetTypeNames = {
      1: 'Bitcoin',
      2: 'Algorand',
      3: 'USDC',
      4: 'Solana'
    };

    return {
      success: true,
      data: {
        investment: {
          positionTokenId: positionResult.tokenId,
          portfolioTokenId: userPortfolio.portfolioTokenId.toString(),
          assetType: assetType.toString(),
          assetTypeName: assetTypeNames[assetType as keyof typeof assetTypeNames],
          holdings: calculatedHoldings.toString(),
          purchaseValueUsd: calculatedPurchaseValue.toString(),
          owner: algorandAddress,
          investmentId: investment.investment_id,
          status: investment.status,
          isFirstInvestment: isFirstInvestment
        },
        portfolio: {
          id: userPortfolio.id,
          tokenId: userPortfolio.portfolioTokenId.toString(),
          customName: userPortfolio.customName,
          isPrimary: userPortfolio.isPrimary
        },
        blockchain: {
          positionTransactionId: positionResult.transactionId,
          portfolioTransactionId: portfolioAddResult.transactionId,
          positionAppId: positionResult.appId,
          portfolioAppId: userPortfolio.portfolioAppId.toString()
        },
        celebration: {
          isFirstInvestment: isFirstInvestment,
          message: isFirstInvestment ? 
            `🎉 Congratulations on your first ${assetTypeNames[assetType as keyof typeof assetTypeNames]} investment!` : 
            'Investment completed successfully'
        }
      }
    };

  } catch (error) {
    console.error('❌ Investment creation error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Find user by wallet address (Bitcoin, Algorand, or Solana)
 * Searches the wallets table and joins with users table
 */
async function findUserByWalletAddress(walletAddress: string): Promise<any | null> {
  try {
    // Check if it's a Bitcoin address (testnet starts with tb1, mainnet with bc1, 1, or 3)
    if (walletAddress.startsWith('tb1') || walletAddress.startsWith('bc1') || 
        walletAddress.match(/^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/)) {
      const { data, error } = await supabase
        .from('wallets')
        .select('user_id, users(*)')
        .eq('bitcoin_address', walletAddress)
        .single();

      if (!error && data) return data.users;
    }

    // Check if it's an Algorand address (58 character base32)
    if (walletAddress.length === 58) {
      const { data, error } = await supabase
        .from('wallets')
        .select('user_id, users(*)')
        .eq('algorand_address', walletAddress)
        .single();

      if (!error && data) return data.users;
    }

    // Check if it's a Solana address (base58, 32-44 characters)
    if (walletAddress.length >= 32 && walletAddress.length <= 44) {
      const { data, error } = await supabase
        .from('wallets')
        .select('user_id, users(*)')
        .eq('solana_address', walletAddress)
        .single();

      if (!error && data) return data.users;
    }

    console.warn('No user found for wallet address:', walletAddress);
    return null;

  } catch (error) {
    console.error('Error finding user by wallet address:', error);
    return null;
  }
}

/**
 * Create a new investment record
 */
async function createInvestmentRecord(params: {
  userId: string;
  targetAsset: string;
  amountUsd: number;
  moonpayTransactionId: string;
}): Promise<Investment | null> {
  const { userId, targetAsset, amountUsd, moonpayTransactionId } = params;
  
  const { data, error } = await supabase
    .from('investments')
    .insert({
      user_id: userId,
      investment_type: `${targetAsset.toLowerCase()}_purchase`,
      target_asset: targetAsset,
      amount_usd: amountUsd,
      status: 'pending_payment',
      risk_acknowledged: false,
      moonpay_transaction_id: moonpayTransactionId,
      created_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating investment:', error);
    return null;
  }

  return data;
}

export default router; 