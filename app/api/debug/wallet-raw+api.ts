import express from 'express';
import { supabase } from '../../../utils/supabase';

const router = express.Router();

// GET /api/v1/debug/wallet-raw?userId=xxx - Check raw database values
router.get('/', async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'Missing userId parameter'
      });
    }

    // Get raw wallet data from database
    const { data: wallet, error } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      return res.status(404).json({
        success: false,
        error: 'Wallet not found',
        details: error
      });
    }

    return res.json({
      success: true,
      rawWalletData: wallet
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: (error as Error).message
    });
  }
});

export default router;