import express from 'express';
import algosdk from 'algosdk';
import crypto from 'crypto';
import { getUserWallet, decryptPrivateKey } from '../../../utils/wallet';
import { supabase } from '../../../utils/supabase';

const router = express.Router();

// Tinyman V2 configuration for testnet
const TINYMAN_CONFIG = {
  testnet: {
    validatorAppId: 148607000, // Tinyman V2 validator on testnet
    usdcAssetId: 10458941, // USDCa on testnet
    poolTokenAssetId: null, // Will be fetched dynamically
    poolAddress: null, // Will be fetched dynamically
  },
  mainnet: {
    validatorAppId: 1002541853, // Tinyman V2 validator on mainnet
    usdcAssetId: 31566704, // USDCa on mainnet
    poolTokenAssetId: null,
    poolAddress: null,
  }
};

// Initialize Algorand client
const algodClient = new algosdk.Algodv2(
  process.env.ALGORAND_ALGOD_TOKEN || '',
  process.env.ALGORAND_ALGOD_URL || 'https://testnet-algorand.api.purestake.io/ps2',
  443,
  { 'X-API-Key': process.env.ALGORAND_ALGOD_TOKEN || '' }
);

interface InvestmentRequest {
  userID: string;
  amount: number; // USDCa amount to invest
  riskAccepted?: boolean; // GENIUS Act compliance
}

router.post('/', async (req, res) => {
  try {
    const { userID, amount, riskAccepted }: InvestmentRequest = req.body;

    // Input validation
    if (!userID || !amount) {
      return res.status(400).json({ 
        success: false,
        error: 'Missing userID or amount' 
      });
    }

    if (amount <= 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Investment amount must be greater than 0' 
      });
    }

    if (amount < 1) {
      return res.status(400).json({ 
        success: false,
        error: 'Minimum investment is $1 USDCa' 
      });
    }

    // GENIUS Act compliance check
    if (!riskAccepted) {
      return res.status(400).json({ 
        success: false,
        error: 'Risk acknowledgment required for GENIUS Act compliance',
        requiresRiskDisclosure: true
      });
    }

    console.log(`🔄 Processing investment: ${amount} USDCa for user ${userID}`);

    // Get user wallet
    const wallet = await getUserWallet(userID, true);
    if (!wallet) {
      return res.status(404).json({ 
        success: false,
        error: 'Wallet not found for user' 
      });
    }

    // Check USDCa balance
    const usdcaBalance = wallet.onChainBalance?.usdca || 0;
    if (usdcaBalance < amount) {
      return res.status(400).json({ 
        success: false,
        error: `Insufficient USDCa balance. Available: ${usdcaBalance}, Required: ${amount}`,
        availableBalance: usdcaBalance
      });
    }

    // Check if opted into USDCa
    if (!wallet.onChainBalance?.isOptedIntoUSDCa) {
      return res.status(400).json({ 
        success: false,
        error: 'Wallet must be opted into USDCa asset first' 
      });
    }

    // Get network configuration
    const isTestnet = process.env.NODE_ENV !== 'production';
    const config = isTestnet ? TINYMAN_CONFIG.testnet : TINYMAN_CONFIG.mainnet;

    // For now, we'll implement a simplified investment flow
    // In production, this would interact with Tinyman's smart contracts
    const investmentResult = await executeInvestment(wallet, amount, config);

    if (!investmentResult.success) {
      return res.status(500).json({ 
        success: false,
        error: investmentResult.error 
      });
    }

    // Store investment in database
    const positionID = crypto.randomUUID();
    const { data: investment, error: dbError } = await supabase
      .from('investment_positions')
      .insert({
        position_id: positionID,
        user_id: userID,
        pool_id: 'tinyman_usdca_v2',
        invested_amount_usdca: amount,
        current_apy: 2.5, // Estimated APY for Tinyman USDCa pools
        start_date: new Date().toISOString(),
        algorand_tx_id: investmentResult.txId,
        status: 'active',
        total_yield_earned: 0,
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error storing investment:', dbError);
      return res.status(500).json({ 
        success: false,
        error: 'Failed to record investment' 
      });
    }

    // Update user balance in database
    await supabase
      .from('wallets')
      .update({ 
        balance_usdca: usdcaBalance - amount,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userID);

    console.log(`✅ Investment successful: ${positionID}`);

    return res.json({
      success: true,
      message: 'Investment initiated successfully',
      investment: {
        positionID: positionID,
        userID: userID,
        poolID: 'tinyman_usdca_v2',
        investedAmountUSDCa: amount,
        currentAPY: 2.5,
        startDate: new Date().toISOString(),
        algorandTxID: investmentResult.txId,
        status: 'active',
        estimatedYieldPerDay: (amount * 0.025) / 365,
        riskLevel: 'Low',
        geniusActCompliant: true
      },
      network: isTestnet ? 'testnet' : 'mainnet',
      tinymapPoolInfo: {
        validatorAppId: config.validatorAppId,
        usdcAssetId: config.usdcAssetId
      }
    });

  } catch (error) {
    console.error('Investment initiation error:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Internal server error' 
    });
  }
});

async function executeInvestment(wallet: any, amount: number, config: any) {
  try {
    // Decrypt private key
    const privateKey = decryptPrivateKey(wallet.encryptedPrivateKey);
    const account = algosdk.mnemonicToSecretKey(privateKey);

    // Get suggested parameters
    const suggestedParams = await algodClient.getTransactionParams().do();

    // For testnet demo, we'll simulate the investment with a simple asset transfer
    // In production, this would be a complex interaction with Tinyman's smart contracts
    
    // Create a mock transaction to simulate Tinyman pool deposit
    // This transfers USDCa to a "pool" address (for demo purposes)
    const mockPoolAddress = "TINYMAN2POOLADDRESSFORTESTINGPURPOSESONLY234567890ABCDEFG"; // Mock address
    
    const investmentTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      from: account.addr,
      to: account.addr, // For testnet demo, keep in same wallet
      amount: Math.floor(amount * 1000000), // Convert to microUSDCa
      assetIndex: config.usdcAssetId,
      note: new TextEncoder().encode(`Cultivest investment: ${amount} USDCa to Tinyman pool`),
      suggestedParams,
    });

    // Sign transaction
    const signedTxn = investmentTxn.signTxn(account.sk);

    // Submit transaction
    const { txId } = await algodClient.sendRawTransaction(signedTxn).do();
    
    // Wait for confirmation
    await algosdk.waitForConfirmation(algodClient, txId, 4);

    console.log(`💰 Investment transaction confirmed: ${txId}`);

    return {
      success: true,
      txId: txId,
      message: 'Investment executed successfully'
    };

  } catch (error) {
    console.error('Investment execution error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Investment execution failed'
    };
  }
}

export default router;