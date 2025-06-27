import express from 'express';
import { getAlgorandStatus } from '../../../utils/wallet';

const router = express.Router();

router.get('/', async (_req, res) => {
  try {
    const status = await getAlgorandStatus();
    
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
    return res.status(500).json({
      success: false,
      error: 'Failed to check Algorand status',
      details: (error as Error).message
    });
  }
});

export default router;