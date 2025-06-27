import express from 'express';
import { verifyJWT } from '../../../utils/auth';
import { supabase } from '../../../utils/supabase';

const router = express.Router();

// Algorand configuration
const usdcAssetId = parseInt(process.env.USDC_ASSET_ID || '10458941'); // USDCa on testnet


// Test faucet account (you would need to set this up with test USDCa)
// For now, this is a placeholder - in real implementation you'd have a funded faucet account
const FAUCET_MNEMONIC = process.env.TESTNET_FAUCET_MNEMONIC || '';

/**
 * Send test USDCa tokens to user's wallet
 * This is a development helper for testnet testing
 */
router.post('/', async (req, res) => {
  try {
    const { userID, amount = 100 } = req.body; // Default 100 USDCa
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
    
    console.log('💰 Test USDCa request for user:', decoded.userId);
    
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

    const recipientAddress = wallet.algorand_address;
    console.log('💰 Sending test USDCa to:', recipientAddress);

    // Check if we have a faucet account configured
    if (!FAUCET_MNEMONIC) {
      // For now, provide instructions for manual faucet
      return res.json({
        success: true,
        message: 'Test USDCa faucet not configured. Use manual methods.',
        instructions: {
          method1: {
            title: "Algorand Discord Faucet",
            steps: [
              "1. Join Algorand Discord: https://discord.gg/algorand",
              "2. Go to #faucet channel",
              "3. Request: `/faucet send <your-wallet-address> asset:10458941 amount:100`",
              "4. Wait for community member to fulfill request"
            ]
          },
          method2: {
            title: "Manual Asset Transfer",
            steps: [
              "1. Find someone with testnet USDCa",
              "2. Ask them to send to your address",
              "3. Use AlgoSigner, MyAlgo, or Pera Wallet",
              "4. Send Asset ID 10458941 (USDCa)"
            ]
          },
          walletAddress: recipientAddress,
          assetId: usdcAssetId,
          amountRequested: amount
        },
        helpfulLinks: {
          algoExplorer: `https://testnet.algoexplorer.io/address/${recipientAddress}`,
          assetInfo: `https://testnet.algoexplorer.io/asset/${usdcAssetId}`,
          discord: "https://discord.gg/algorand"
        }
      });
    }

    // If we had a faucet account, we would implement the actual transfer here:
    /*
    const faucetAccount = algosdk.mnemonicToSecretKey(FAUCET_MNEMONIC);
    
    // Get suggested parameters
    const suggestedParams = await algodClient.getTransactionParams().do();
    
    // Create asset transfer transaction
    const transferTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      from: faucetAccount.addr,
      to: recipientAddress,
      amount: amount * 1000000, // USDCa has 6 decimal places
      assetIndex: usdcAssetId,
      suggestedParams: suggestedParams
    });
    
    // Sign and submit
    const signedTxn = transferTxn.signTxn(faucetAccount.sk);
    const txnResult = await algodClient.sendRawTransaction(signedTxn).do();
    
    return res.json({
      success: true,
      transactionId: txnResult.txId,
      amount: amount,
      assetId: usdcAssetId,
      recipientAddress: recipientAddress
    });
    */

    return res.status(501).json({
      success: false,
      error: 'Faucet transfer not implemented. Uncomment and implement the transfer logic.'
    });

  } catch (error) {
    console.error('Test USDCa sending error:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Internal server error',
      message: 'Failed to send test USDCa. Try manual faucet methods.'
    });
  }
});

export default router;