import express from 'express';
import { getUserWallet, getOnChainBalance } from '../../../utils/wallet';
import { getBitcoinBalance } from '../../../utils/bitcoin';

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
      addresses: {
        bitcoin: wallet.bitcoinAddress || null,
        algorand: wallet.algorandAddress || null
      },
      balance: {
        databaseBalance: {
          btc: wallet.balance.btc || 0,
          algo: wallet.balance.algo || 0,
          usdca: wallet.balance.usdca || 0
        },
        onChainBalance: wallet.onChainBalance ? {
          btc: wallet.onChainBalance.btc || 0,
          algo: wallet.onChainBalance.algo || 0,
          usdca: wallet.onChainBalance.usdca || 0,
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

// GET /api/v1/wallet/balance/live/:address - Get live balance for any address (Algorand only)
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
      blockchain: 'algorand',
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

// GET /api/v1/wallet/balance/bitcoin/:address - Get live Bitcoin balance for any address
router.get('/bitcoin/:address', async (req, res) => {
  try {
    const { address } = req.params;

    // Bitcoin address validation for different formats
    const isValidBitcoinAddress = address && (
      /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(address) ||          // Legacy P2PKH/P2SH (mainnet)
      /^bc1[a-z0-9]{39,}$/.test(address) ||                          // Mainnet Bech32 (P2WPKH/P2WSH)
      /^tb1[a-z0-9]{39,}$/.test(address) ||                          // Testnet Bech32 (P2WPKH/P2WSH)
      /^[2mn][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(address)             // Testnet Legacy
    );

    if (!isValidBitcoinAddress) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Bitcoin address format. Supported: Legacy (1,3), Bech32 (bc1), Testnet (tb1,2,m,n)'
      });
    }

    const btcBalance = await getBitcoinBalance(address);

    return res.json({
      success: true,
      address: address,
      blockchain: 'bitcoin',
      balance: {
        btc: btcBalance,
        lastUpdated: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Bitcoin balance endpoint error:', error);
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
      message: 'Multi-chain balance synced successfully',
      wallet: {
        addresses: {
          bitcoin: wallet.bitcoinAddress || null,
          algorand: wallet.algorandAddress || null
        },
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