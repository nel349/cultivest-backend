import express from 'express';
import { fetchCryptoPrices, getCryptoPrice, getPriceCacheStatus, clearPriceCache } from '../../utils/crypto-prices';

const router = express.Router();

// GET /api/v1/prices - Get all cryptocurrency prices
router.get('/', async (_req, res) => {
  try {
    const prices = await fetchCryptoPrices();
    const cacheStatus = getPriceCacheStatus();

    return res.json({
      success: true,
      prices: {
        bitcoin: {
          usd: prices.bitcoin,
          symbol: 'BTC',
          name: 'Bitcoin'
        },
        algorand: {
          usd: prices.algorand,
          symbol: 'ALGO',
          name: 'Algorand'
        },
        'usd-coin': {
          usd: prices['usd-coin'],
          symbol: 'USDC',
          name: 'USD Coin'
        },
        ethereum: {
          usd: prices.ethereum,
          symbol: 'ETH',
          name: 'Ethereum'
        },
        solana: {
          usd: prices.solana,
          symbol: 'SOL',
          name: 'Solana'
        }
      },
      cache: {
        cached: cacheStatus.hasCachedPrices,
        valid: cacheStatus.cacheValid,
        ageSeconds: cacheStatus.cacheAgeSeconds,
        lastUpdated: cacheStatus.lastUpdated
      },
      source: 'CoinGecko API',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Prices endpoint error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch cryptocurrency prices'
    });
  }
});

// GET /api/v1/prices/:coinId - Get specific coin price
router.get('/:coinId', async (req, res) => {
  try {
    const { coinId } = req.params;
    
    // Validate coinId - now includes Solana
    const validCoins = ['bitcoin', 'algorand', 'usd-coin', 'ethereum', 'solana'];
    if (!validCoins.includes(coinId)) {
      return res.status(400).json({
        success: false,
        error: `Invalid coin ID. Supported: ${validCoins.join(', ')}`
      });
    }

    const price = await getCryptoPrice(coinId as any);
    
    return res.json({
      success: true,
      coinId,
      price: {
        usd: price
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Single price endpoint error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch price for specified coin'
    });
  }
});

// POST /api/v1/prices/refresh - Force refresh price cache
router.post('/refresh', async (_req, res) => {
  try {
    clearPriceCache();
    const prices = await fetchCryptoPrices();
    
    return res.json({
      success: true,
      message: 'Price cache refreshed successfully',
      prices,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Price refresh endpoint error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to refresh price cache'
    });
  }
});

// GET /api/v1/prices/cache/status - Get cache status
router.get('/cache/status', (_req, res) => {
  try {
    const cacheStatus = getPriceCacheStatus();
    
    return res.json({
      success: true,
      cache: cacheStatus,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Cache status endpoint error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get cache status'
    });
  }
});

export default router;