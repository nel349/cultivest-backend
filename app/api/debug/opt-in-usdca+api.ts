import express from 'express';
import algosdk from 'algosdk';
import CryptoJS from 'crypto-js';
import { verifyJWT } from '../../../utils/auth';
import { supabase } from '../../../utils/supabase';

const router = express.Router();

// Algorand configuration
const algodUrl = process.env.ALGORAND_ALGOD_URL || 'https://testnet-api.algonode.cloud';
const algodToken = process.env.ALGORAND_ALGOD_TOKEN || '';
const usdcAssetId = parseInt(process.env.USDC_ASSET_ID || '10458941'); // USDCa on testnet
const encryptionKey = process.env.ENCRYPTION_KEY || 'fallback-key-change-in-production';

const algodClient = new algosdk.Algodv2(algodToken, algodUrl, algodToken ? '' : undefined);

/**
 * Helper endpoint to opt user's wallet into USDCa asset
 * This is required before receiving USDCa tokens
 */
router.post('/', async (req, res) => {
  try {
    const { userID } = req.body;
    const authHeader = req.headers.authorization;

    // Validate request
    if (!userID) {
      return res.status(400).json({
        success: false,
        error: 'Missing userID parameter'
      });
    }

    // TEMPORARY: Skip auth for testing
    // TODO: Re-enable auth for production
    /*
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
    */
    
    console.log('🎯 USDCa opt-in request for user:', userID);
    
    // Get user's wallet and decrypt private key
    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('wallet_id, algorand_address, encrypted_private_key')
      .eq('user_id', userID)
      .single();

    if (walletError || !wallet) {
      return res.status(400).json({ 
        success: false,
        error: 'User wallet not found. Please create a wallet first.' 
      });
    }

    // Decrypt private key
    const decryptedBytes = CryptoJS.AES.decrypt(wallet.encrypted_private_key, encryptionKey);
    const privateKeyMnemonic = decryptedBytes.toString(CryptoJS.enc.Utf8);
    const account = algosdk.mnemonicToSecretKey(privateKeyMnemonic);

    console.log('💰 Opting wallet into USDCa:', wallet.algorand_address);

    // Check if already opted in
    const accountInfo = await algodClient.accountInformation(wallet.algorand_address).do();
    const alreadyOptedIn = accountInfo.assets?.some((asset: any) => asset['asset-id'] === usdcAssetId);

    if (alreadyOptedIn) {
      return res.json({
        success: true,
        message: 'Wallet is already opted into USDCa',
        walletAddress: wallet.algorand_address,
        assetId: usdcAssetId,
        alreadyOptedIn: true
      });
    }

    // Get suggested parameters
    const suggestedParams = await algodClient.getTransactionParams().do();

    // Create asset transfer transaction (opt-in)
    const optInTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      from: account.addr,
      to: account.addr, // Opt-in transaction sends to self
      amount: 0, // 0 amount for opt-in
      assetIndex: usdcAssetId,
      suggestedParams: suggestedParams
    });

    // Sign and submit transaction
    const signedTxn = optInTxn.signTxn(account.sk);
    const txnResult = await algodClient.sendRawTransaction(signedTxn).do();
    
    console.log('✅ USDCa opt-in transaction submitted:', txnResult.txId);

    // Wait for confirmation
    const confirmedTxn = await algosdk.waitForConfirmation(algodClient, txnResult.txId, 4);
    
    console.log('🎯 USDCa opt-in confirmed in round:', confirmedTxn['confirmed-round']);

    return res.json({
      success: true,
      message: 'Successfully opted into USDCa asset',
      walletAddress: wallet.algorand_address,
      assetId: usdcAssetId,
      transactionId: txnResult.txId,
      confirmedRound: confirmedTxn['confirmed-round'],
      nextSteps: [
        'Your wallet can now receive USDCa tokens',
        'Get test USDCa from community faucets',
        'Check your balance in the dashboard',
        'You can now test investment features'
      ],
      testnetNote: 'This is testnet only. In production, opt-in happens automatically during first funding.'
    });

  } catch (error) {
    console.error('USDCa opt-in error:', error);
    
    // Provide helpful error messages
    let errorMessage = 'Failed to opt into USDCa asset';
    if (error instanceof Error) {
      if (error.message.includes('balance')) {
        errorMessage = 'Insufficient ALGO balance. Get ALGO from testnet dispenser first.';
      } else if (error.message.includes('fee')) {
        errorMessage = 'Not enough ALGO to pay transaction fee. Minimum 0.001 ALGO required.';
      } else {
        errorMessage = error.message;
      }
    }
    
    return res.status(500).json({ 
      success: false,
      error: errorMessage,
      helpfulTips: [
        'Make sure you have at least 0.1 ALGO in your wallet',
        'Get ALGO from: https://dispenser.testnet.aws.algodev.network/',
        'Wait 30-60 seconds after getting ALGO before trying again'
      ]
    });
  }
});

export default router;