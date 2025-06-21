import express from 'express';
import { generateWallet, getUserWallet, userHasWallet } from '../../../utils/wallet';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { userId } = req.body;

    // Validate required fields
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: userId'
      });
    }

    // Check if user already has a wallet
    const hasWallet = await userHasWallet(userId);
    if (hasWallet) {
      const existingWallet = await getUserWallet(userId);
      return res.json({
        success: true,
        message: 'User already has a wallet',
        wallet: existingWallet,
        created: false
      });
    }

    // Generate new wallet
    console.log(`🔐 Creating new wallet for user: ${userId}`);
    const result = await generateWallet(userId);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to create wallet',
        details: result.error
      });
    }

    // Get complete wallet info
    const walletInfo = await getUserWallet(userId);

    return res.json({
      success: true,
      message: 'Wallet created successfully',
      wallet: walletInfo,
      created: true,
      transactionIds: result.transactionIds || []
    });

  } catch (error) {
    console.error('Wallet creation endpoint error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router;