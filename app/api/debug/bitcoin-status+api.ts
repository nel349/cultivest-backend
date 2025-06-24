import express from 'express';
import { getBitcoinNetworkStatus, generateBitcoinWallet } from '../../../utils/bitcoin';

const router = express.Router();

// GET /api/v1/debug/bitcoin-status
router.get('/', async (req, res) => {
  try {
    console.log('🔍 Testing Bitcoin network status and balance API...');
    
    // Get network status and test balance API
    const networkStatus = await getBitcoinNetworkStatus();
    
    // Test wallet generation
    let walletGeneration = null;
    try {
      const testWallet = generateBitcoinWallet();
      walletGeneration = {
        success: testWallet.success,
        address: testWallet.address,
        error: testWallet.error,
        hasEncryptedKey: !!testWallet.encryptedPrivateKey
      };
    } catch (error) {
      walletGeneration = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown wallet generation error'
      };
    }
    
    return res.json({
      success: true,
      message: 'Bitcoin integration status',
      timestamp: new Date().toISOString(),
      bitcoin: {
        network: networkStatus,
        walletGeneration,
        integrationStatus: {
          walletCreation: walletGeneration?.success ? 'working' : 'error',
          balanceChecking: networkStatus.balanceAPI.status,
          privateKeyEncryption: 'enabled'
        }
      }
    });

  } catch (error) {
    console.error('Bitcoin status check error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to check Bitcoin status',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;