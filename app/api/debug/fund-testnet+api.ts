import express from 'express';
import { verifyJWT } from '../../../utils/auth';
import { supabase } from '../../../utils/supabase';
import { getOnChainBalance } from '../../../utils/wallet';

const router = express.Router();

interface FundTestnetRequest {
  userID: string;
  amount?: number; // ALGO amount to request from faucet
}

/**
 * Debug endpoint to fund testnet wallets using Algorand dispenser
 * This replaces MoonPay for testnet development
 */
router.post('/', async (req, res) => {
  try {
    const { userID, amount = 10 }: FundTestnetRequest = req.body;
    const authHeader = req.headers.authorization;

    // Validate request
    if (!userID) {
      return res.status(400).json({
        success: false,
        error: 'Missing userID parameter'
      });
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false,
        error: 'Authorization token required' 
      });
    }

    // Extract and verify JWT token
    const token = authHeader.split(' ')[1];
    const decoded = verifyJWT(token);
    
    if (!decoded || decoded.userId !== userID) {
      return res.status(401).json({ 
        success: false,
        error: 'Invalid or mismatched user token' 
      });
    }
    
    console.log('🚰 Testnet funding request for user:', decoded.userId);
    
    // Get user's wallet address
    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('wallet_id, algorand_address')
      .eq('user_id', userID)
      .single();

    if (walletError || !wallet) {
      return res.status(400).json({ 
        success: false,
        error: 'User wallet not found. Please create a wallet first.' 
      });
    }

    const walletAddress = wallet.algorand_address;
    console.log('💰 Funding wallet:', walletAddress);

    // Check current balance before funding
    const beforeBalance = await getOnChainBalance(walletAddress);
    
    // Create funding instructions for the user
    const fundingInstructions = {
      step1: {
        title: "Get ALGO from Testnet Dispenser",
        url: "https://dispenser.testnet.aws.algodev.network/",
        instructions: [
          `1. Go to: https://dispenser.testnet.aws.algodev.network/`,
          `2. Enter your wallet address: ${walletAddress}`,
          `3. Request ${amount} ALGO`,
          `4. Wait for transaction confirmation (30-60 seconds)`,
          `5. Come back and check your balance`
        ]
      },
      step2: {
        title: "Get USDCa from Asset Dispenser",
        url: "https://testnet.algoexplorer.io/asset/10458941",
        instructions: [
          `1. First, opt-in to USDCa asset (ID: 10458941)`,
          `2. Use AlgoKit or MyAlgo to opt-in`,
          `3. Or use our opt-in endpoint: POST /debug/opt-in-usdca`,
          `4. Then get test USDCa from community faucets`,
          `5. Check balance updates in your dashboard`
        ]
      },
      currentBalance: beforeBalance,
      walletAddress: walletAddress,
      network: "testnet"
    };

    // For development, we can also provide direct faucet URLs
    const quickFundingOptions = {
      algoDispenser: `https://dispenser.testnet.aws.algodev.network/?address=${walletAddress}`,
      algoExplorer: `https://testnet.algoexplorer.io/address/${walletAddress}`,
      usdcaAsset: "https://testnet.algoexplorer.io/asset/10458941"
    };

    return res.json({
      success: true,
      message: 'Testnet funding instructions provided',
      walletAddress: walletAddress,
      currentBalance: beforeBalance,
      fundingInstructions: fundingInstructions,
      quickLinks: quickFundingOptions,
      note: 'This is a testnet-only feature. In production, users fund via MoonPay.'
    });

  } catch (error) {
    console.error('Testnet funding error:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Internal server error' 
    });
  }
});

/**
 * Check funding status and update database balance
 */
router.get('/status/:userID', async (req, res) => {
  try {
    const { userID } = req.params;
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false,
        error: 'Authorization token required' 
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyJWT(token);
    
    if (!decoded || decoded.userId !== userID) {
      return res.status(401).json({ 
        success: false,
        error: 'Invalid or mismatched user token' 
      });
    }

    // Get user's wallet
    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('wallet_id, algorand_address')
      .eq('user_id', userID)
      .single();

    if (walletError || !wallet) {
      return res.status(404).json({ 
        success: false,
        error: 'Wallet not found' 
      });
    }

    // Get live balance
    const currentBalance = await getOnChainBalance(wallet.algorand_address);
    
    if (!currentBalance) {
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch current balance'
      });
    }

    // Update database with latest balance
    const { error: updateError } = await supabase
      .from('wallets')
      .update({
        balance_algo: currentBalance.algo,
        balance_usdca: currentBalance.usdca,
        last_synced: new Date().toISOString()
      })
      .eq('wallet_id', wallet.wallet_id);

    if (updateError) {
      console.error('Failed to update wallet balance:', updateError);
    }

    const fundingStatus = {
      walletAddress: wallet.algorand_address,
      currentBalance: currentBalance,
      algoFunded: currentBalance.algo > 0,
      usdcaFunded: currentBalance.usdca > 0,
      readyForInvestment: currentBalance.algo >= 0.1 && currentBalance.usdca >= 1,
      nextSteps: currentBalance.algo === 0 ? 
        "Get ALGO from testnet dispenser first" :
        currentBalance.usdca === 0 ?
        "Opt-in to USDCa asset and get test tokens" :
        "Ready to test investment features!"
    };

    return res.json({
      success: true,
      ...fundingStatus
    });

  } catch (error) {
    console.error('Funding status check error:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Internal server error' 
    });
  }
});

export default router;