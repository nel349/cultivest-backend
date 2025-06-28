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

interface PendingInvestment {
  id: string;
  user_id: string;
  asset_type: number;
  amount_usd: number;
  wallet_address: string;
  status: string;
  moonpay_transaction_id?: string;
  crypto_amount?: number;
  investment_id?: string;
  position_nft_id?: string;
  error_message?: string;
  created_at: string;
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

    // Find pending investment by external transaction ID
    const pendingInvestment = await findPendingInvestment(externalTransactionId || id);
    
    if (!pendingInvestment) {
      console.error('❌ Pending investment not found for:', externalTransactionId || id);
      return res.status(404).json({ error: 'Pending investment not found' });
    }

    console.log('📊 Processing investment for user:', pendingInvestment.user_id);

    // Update with MoonPay transaction ID if not set
    if (!pendingInvestment.moonpay_transaction_id) {
      await updatePendingInvestment(pendingInvestment.id, { moonpay_transaction_id: id });
    }

    // Process based on MoonPay event type and status
    const isCreatedEvent = ['Transaction Created', 'transaction_created'].includes(webhookData.type);
    const isUpdatedEvent = ['Transaction Updated', 'transaction_updated'].includes(webhookData.type);
    const isFailedEvent = ['Transaction Failed', 'transaction_failed'].includes(webhookData.type);
    
    if (isCreatedEvent) {
      console.log(`📝 Transaction created: ${id}`);
      await updatePendingInvestment(pendingInvestment.id, { status: 'moonpay_initiated' });
      
    } else if (isUpdatedEvent) {
      // Check the status for completion, failure, or cancellation
      switch (status) {
        case 'completed':
          await handleMoonPayCompleted(pendingInvestment, finalCryptoAmount || 0, baseCurrencyAmount || pendingInvestment.amount_usd, finalCryptoCurrency || 'BTC');
          break;

        case 'failed':
          await handleMoonPayFailed(pendingInvestment, failureReason);
          break;

        case 'cancelled':
          await handleMoonPayCancelled(pendingInvestment);
          break;

        default:
          console.log(`ℹ️ Transaction updated to status ${status} - no action needed`);
          await updatePendingInvestment(pendingInvestment.id, { status: status });
      }
      
    } else if (isFailedEvent) {
      await handleMoonPayFailed(pendingInvestment, failureReason);
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
  pendingInvestment: PendingInvestment, 
  cryptoAmount: number, 
  usdAmount: number,
  cryptoCurrency: string
) {
  try {
    console.log(`✅ MoonPay completed for user ${pendingInvestment.user_id}: ${cryptoAmount} ${cryptoCurrency}`);

    // Mark pending investment as moonpay_completed
    await updatePendingInvestment(pendingInvestment.id, { 
      status: 'moonpay_completed',
      crypto_amount: cryptoAmount
    });

    // Convert crypto currency to asset type
    const assetTypeMap: { [key: string]: number } = {
      'BTC': 1,
      'ALGO': 2,
      'USDC': 3,
      'SOL': 4
    };

    const assetType = assetTypeMap[cryptoCurrency.toUpperCase()] || pendingInvestment.asset_type;

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

    // Call the users/invest endpoint internally
    const investmentResult = await createInvestmentRecord({
      userId: pendingInvestment.user_id,
      algorandAddress: pendingInvestment.wallet_address,
      assetType: assetType,
      holdings: holdings.toString(),
      purchaseValueUsd: Math.floor(usdAmount * 100), // Convert to cents
      portfolioName: 'My Portfolio',
      moonpayTransactionId: pendingInvestment.moonpay_transaction_id || undefined
    });

    if (investmentResult.success) {
      console.log('🎯 Investment and NFTs created successfully:', investmentResult.data);
      
      // Mark pending investment as completed
      await updatePendingInvestment(pendingInvestment.id, { 
        status: 'completed',
        investment_id: investmentResult.data.investmentId,
        position_nft_id: investmentResult.data.positionTokenId
      });

      console.log(`✅ Investment completed for user ${pendingInvestment.user_id}`);
    } else {
      throw new Error(`Investment creation failed: ${investmentResult.error}`);
    }

  } catch (error) {
    console.error('❌ Error handling MoonPay completion:', error);
    
    // Mark as failed
    await updatePendingInvestment(pendingInvestment.id, {
      status: 'failed',
      error_message: `Failed to process completed payment: ${error}`
    });
    
    throw error;
  }
}

/**
 * Handle failed MoonPay payment
 */
async function handleMoonPayFailed(pendingInvestment: PendingInvestment, failureReason?: string) {
  try {
    console.log(`❌ MoonPay failed for user ${pendingInvestment.user_id}: ${failureReason}`);

    await updatePendingInvestment(pendingInvestment.id, {
      status: 'failed',
      error_message: failureReason || 'Payment failed in MoonPay'
    });

  } catch (error) {
    console.error('❌ Error handling MoonPay failure:', error);
  }
}

/**
 * Handle cancelled MoonPay payment
 */
async function handleMoonPayCancelled(pendingInvestment: PendingInvestment) {
  try {
    console.log(`🚫 MoonPay cancelled for user ${pendingInvestment.user_id}`);

    await updatePendingInvestment(pendingInvestment.id, {
      status: 'cancelled'
    });

  } catch (error) {
    console.error('❌ Error handling MoonPay cancellation:', error);
  }
}

/**
 * Find pending investment by external transaction ID or MoonPay transaction ID
 */
async function findPendingInvestment(transactionId: string | undefined): Promise<PendingInvestment | null> {
  try {
    if (!transactionId) {
      console.warn('No transaction ID provided to find pending investment');
      return null;
    }

    // Try to find by external transaction ID first
    if (transactionId.startsWith('cultivest_')) {
      const investmentId = transactionId.replace('cultivest_', '');
      const { data, error } = await supabase
        .from('pending_investments')
        .select('*')
        .eq('id', investmentId)
        .single();

      if (!error && data) {
        return data;
      }
    }

    // Try to find by MoonPay transaction ID
    const { data, error } = await supabase
      .from('pending_investments')
      .select('*')
      .eq('moonpay_transaction_id', transactionId)
      .single();

    return error ? null : data;

  } catch (error) {
    console.error('Error finding pending investment:', error);
    return null;
  }
}

/**
 * Update pending investment record
 */
async function updatePendingInvestment(id: string, updates: Partial<PendingInvestment>) {
  const { error } = await supabase
    .from('pending_investments')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    console.error('Error updating pending investment:', error);
    throw error;
  }
}

/**
 * Call the users/invest endpoint internally to create investment + NFTs
 */
async function createInvestmentRecord(params: {
  userId: string;
  algorandAddress: string;
  assetType: number;
  holdings: string;
  purchaseValueUsd: number;
  portfolioName: string;
  moonpayTransactionId?: string | undefined;
}): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    // Import the investment logic (we'll need to make this reusable)
    const { userPortfolioService } = await import('../../../services/user-portfolio.service');
    const { nftContractService } = await import('../../../services/nft-contract.service');
    const { v4: uuidv4 } = await import('uuid');

    const { userId, algorandAddress, assetType, holdings, purchaseValueUsd, portfolioName, moonpayTransactionId } = params;

    // Step 1: Get or create user's primary portfolio
    let userPortfolio = await userPortfolioService.getUserPrimaryPortfolio(userId);
    
    if (!userPortfolio) {
      console.log(`Creating primary portfolio for user ${userId}`);
      
      const portfolioResult = await nftContractService.mintPortfolioToken({
        owner: algorandAddress,
        level: 1,
        metadataCid: 'QmDefaultPortfolioMetadata'
      });
      
      // NFT service methods throw on error, so if we get here, it succeeded
      const portfolioTokenId = parseInt(portfolioResult.tokenId || '0');
      
      userPortfolio = await userPortfolioService.storeUserPortfolio({
        userId,
        algorandAddress,
        portfolioTokenId: portfolioTokenId,
        portfolioAppId: parseInt(portfolioResult.appId),
        isPrimary: true,
        customName: portfolioName || 'My Portfolio'
      });
    }

    // Step 2: Create investment record
    const investmentId = uuidv4();
    const { error: investmentError } = await supabase
      .from('investments')
      .insert({
        investment_id: investmentId,
        user_id: userId,
        target_asset: assetType,
        amount_invested_usd: purchaseValueUsd,
        estimated_crypto_amount: holdings,
        wallet_address: algorandAddress,
        status: 'completed',
        moonpay_transaction_id: moonpayTransactionId || null,
        created_at: new Date().toISOString()
      });

    if (investmentError) {
      throw new Error(`Investment record creation failed: ${investmentError.message}`);
    }

    // Step 3: Create Position NFT
    const positionResult = await nftContractService.mintPositionToken({
      owner: algorandAddress,
      assetType: assetType,
      holdings: BigInt(holdings),
      purchaseValueUsd: BigInt(purchaseValueUsd)
    });

    // NFT service methods throw on error, so if we get here, it succeeded

    // Step 4: Add position to portfolio
    if (userPortfolio && positionResult.tokenId) {
      await nftContractService.addPositionToPortfolio({
        portfolioTokenId: BigInt(userPortfolio.portfolioTokenId),
        positionTokenId: BigInt(positionResult.tokenId),
        owner: algorandAddress
      });
    }

    console.log(`🎯 Investment completed successfully:`, {
      investmentId,
      positionTokenId: positionResult.tokenId,
      portfolioTokenId: userPortfolio?.portfolioTokenId
    });

    return {
      success: true,
      data: {
        investmentId,
        positionTokenId: positionResult.tokenId,
        portfolioTokenId: userPortfolio?.portfolioTokenId,
        transactionId: positionResult.transactionId
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

export default router; 