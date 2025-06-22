import express from 'express';
import { getUserWallet, getOnChainBalance } from '../../../utils/wallet';

const router = express.Router();

// GET /api/v1/wallet/balance?userId=xxx&live=true
router.get('/', async (req, res) => {
  try {
    const { userId, userID, live } = req.query;
    
    // Support both userId and userID for backwards compatibility
    const actualUserId = (userId || userID) as string;

    // Validate required parameters
    if (!actualUserId) {
      return res.status(400).json({
        success: false,
        error: 'Missing userId parameter'
      });
    }

    // Determine if we should fetch live balance
    const includeLiveBalance = live === 'true';

    // Get wallet information
    const wallet = await getUserWallet(actualUserId, includeLiveBalance);

    if (!wallet) {
      return res.status(404).json({
        success: false,
        error: 'Wallet not found for this user'
      });
    }

    return res.json({
      success: true,
      userID: actualUserId,
      walletAddress: wallet.algorandAddress,
      balance: {
        databaseBalance: {
          algo: wallet.balance.algo,
          usdca: wallet.balance.usdca
        },
        onChainBalance: wallet.onChainBalance ? {
          algo: wallet.onChainBalance.algo,
          usdca: wallet.onChainBalance.usdca,
          isOptedIntoUSDCa: wallet.onChainBalance.isOptedIntoUSDCa,
          lastUpdated: wallet.onChainBalance.lastUpdated
        } : null
      }
    });

  } catch (error) {
    console.error('Wallet balance endpoint error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// GET /api/v1/wallet/balance/live/:address - Get live balance for any address
router.get('/live/:address', async (req, res) => {
  try {
    const { address } = req.params;

    // Validate Algorand address format (58 characters)
    if (!address || !/^[A-Z2-7]{58}$/.test(address)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Algorand address format'
      });
    }

    const onChainBalance = await getOnChainBalance(address);

    if (!onChainBalance) {
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch on-chain balance'
      });
    }

    return res.json({
      success: true,
      address: address,
      balance: onChainBalance
    });

  } catch (error) {
    console.error('Live balance endpoint error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// POST /api/v1/wallet/balance/sync - Force sync database with on-chain balance
router.post('/sync', async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'Missing userId in request body'
      });
    }

    // Get wallet with live balance (this will auto-sync)
    const wallet = await getUserWallet(userId, true);

    if (!wallet) {
      return res.status(404).json({
        success: false,
        error: 'Wallet not found for this user'
      });
    }

    return res.json({
      success: true,
      message: 'Balance synced successfully',
      wallet: {
        algorandAddress: wallet.algorandAddress,
        syncedBalance: wallet.balance,
        onChainBalance: wallet.onChainBalance
      }
    });

  } catch (error) {
    console.error('Balance sync endpoint error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router;