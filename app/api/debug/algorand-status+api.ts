import express from 'express';
import { getAlgorandStatus } from '../../../utils/wallet';

const router = express.Router();

router.get('/', async (_req, res) => {
  try {
    console.log('🔍 Algorand status endpoint called');
    const status = await getAlgorandStatus();
    
    console.log('📊 Algorand status result:', status);
    
    return res.json({
      success: true,
      algorandStatus: status,
      message: status.connected 
        ? 'Algorand network is accessible'
        : 'Cannot connect to Algorand network',
      recommendations: status.connected 
        ? 'Wallet creation is ready to use'
        : 'Check ALGORAND_ALGOD_URL and ALGORAND_ALGOD_TOKEN in .env file'
    });
  } catch (error) {
    console.error('❌ Algorand status endpoint error:', error);
    console.error('📋 Error stack:', (error as Error).stack);
    
    return res.status(500).json({
      success: false,
      error: 'Failed to check Algorand status',
      details: (error as Error).message,
      errorName: (error as Error).name,
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        ALGORAND_ALGOD_URL: process.env.ALGORAND_ALGOD_URL ? 'set' : 'not set',
        ALGORAND_ALGOD_TOKEN: process.env.ALGORAND_ALGOD_TOKEN ? 'set' : 'not set',
        ALGORAND_NETWORK: process.env.ALGORAND_NETWORK ? 'set' : 'not set',
        USDC_ASSET_ID: process.env.USDC_ASSET_ID ? 'set' : 'not set'
      }
    });
  }
});

export default router;