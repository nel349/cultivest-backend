import express from 'express';
import { sendBitcoin } from '../../../utils/bitcoin';

const router = express.Router();

// POST /api/debug/fund-btc-address
router.post('/', async (req, res) => {
  try {
    const { toAddress, amount } = req.body;
    
    // Validation
    if (!toAddress) {
      return res.status(400).json({
        success: false,
        error: 'toAddress is required'
      });
    }
    
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'amount must be a positive number (in BTC)'
      });
    }
    
    // Get faucet private key from environment
    const faucetPrivateKey = process.env.BTC_TESTNET_FAUCET_PRIVATE_KEY;
    if (!faucetPrivateKey) {
      return res.status(500).json({
        success: false,
        error: 'BTC_TESTNET_FAUCET_PRIVATE_KEY not configured in environment'
      });
    }
    
    console.log(`💰 Funding request: ${amount} BTC to ${toAddress}`);
    
    // Convert BTC to satoshis (1 BTC = 100,000,000 satoshis)
    const amountSatoshis = Math.floor(amount * 100000000);
    
    if (amountSatoshis < 546) {
      return res.status(400).json({
        success: false,
        error: 'Amount too small. Minimum is 546 satoshis (0.00000546 BTC) due to dust limit'
      });
    }
    
    // Send Bitcoin
    console.log(`🚀 Sending ${amountSatoshis} satoshis (${amount} BTC) to ${toAddress}`);
    const result = await sendBitcoin(faucetPrivateKey, toAddress, amountSatoshis);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
        details: 'Bitcoin transaction failed'
      });
    }
    
    // Success response
    return res.json({
      success: true,
      message: 'Bitcoin sent successfully',
      transaction: {
        txHash: result.txHash,
        mempoolUrl: result.mempoolUrl,
        amount: amount,
        amountSatoshis: amountSatoshis,
        toAddress: toAddress,
        fee: result.fee,
        feeBTC: result.fee ? (result.fee / 100000000) : undefined
      },
      links: {
        mempool: result.mempoolUrl,
        explorer: result.mempoolUrl // Same as mempool for now
      }
    });
    
  } catch (error) {
    console.error('❌ Fund BTC address error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to send Bitcoin',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/debug/fund-btc-address (get faucet info)
router.get('/', async (_req, res) => {
  try {
    const faucetPrivateKey = process.env.BTC_TESTNET_FAUCET_PRIVATE_KEY;
    
    if (!faucetPrivateKey) {
      return res.json({
        success: false,
        configured: false,
        error: 'BTC_TESTNET_FAUCET_PRIVATE_KEY not configured'
      });
    }
    
    // Try to get faucet address and balance
    // Note: We'd need to derive the address from the private key to check balance
    // For now, just confirm it's configured
    
    return res.json({
      success: true,
      configured: true,
      message: 'Bitcoin faucet is configured and ready to fund addresses',
      usage: {
        endpoint: 'POST /api/debug/fund-btc-address',
        body: {
          toAddress: 'tb1q... (recipient Bitcoin address)',
          amount: 0.001 // Amount in BTC
        },
        example: {
          toAddress: 'tb1qqft50ju5qlxvucq9cts6sfm6kkh0vv0d229w0a',
          amount: 0.001
        }
      },
      limits: {
        minimumAmount: '0.00000546 BTC (546 satoshis)',
        network: 'testnet'
      }
    });
    
  } catch (error) {
    console.error('❌ Faucet info error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get faucet information'
    });
  }
});

export default router; 