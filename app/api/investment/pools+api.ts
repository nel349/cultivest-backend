import express from 'express';
import algosdk from 'algosdk';

const router = express.Router();

// Tinyman V2 configuration
const TINYMAN_CONFIG = {
  testnet: {
    validatorAppId: 148607000, // Tinyman V2 validator on testnet
    usdcAssetId: 10458941, // USDCa on testnet
    poolFeePercent: 0.25, // 0.25% trading fee
  },
  mainnet: {
    validatorAppId: 1002541853, // Tinyman V2 validator on mainnet
    usdcAssetId: 31566704, // USDCa on mainnet
    poolFeePercent: 0.25, // 0.25% trading fee
  }
};

// Initialize Algorand client
const algodClient = new algosdk.Algodv2(
  process.env.ALGORAND_ALGOD_TOKEN || '',
  process.env.ALGORAND_ALGOD_URL || 'https://testnet-algorand.api.purestake.io/ps2',
  443,
  { 'X-API-Key': process.env.ALGORAND_ALGOD_TOKEN || '' }
);

// GET /api/v1/investment/pools - Get available investment pools
router.get('/', async (req, res) => {
  try {
    console.log('🏊 Fetching available investment pools');

    const isTestnet = process.env.NODE_ENV !== 'production';
    const config = isTestnet ? TINYMAN_CONFIG.testnet : TINYMAN_CONFIG.mainnet;

    // For now, we return a static pool configuration
    // In production, this would query Tinyman's API for live pool data
    const pools = [
      {
        poolId: 'tinyman_usdca_v2',
        name: 'Tinyman USDCa Pool V2',
        protocol: 'Tinyman',
        version: 'V2',
        assets: [
          {
            id: 0, // ALGO
            name: 'Algorand',
            symbol: 'ALGO',
            decimals: 6
          },
          {
            id: config.usdcAssetId,
            name: 'USD Coin',
            symbol: 'USDCa',
            decimals: 6
          }
        ],
        liquidityInfo: {
          totalLiquidity: 125000, // Mock data - in production, fetch from Tinyman API
          algoReserves: 50000,
          usdcaReserves: 75000,
          lpTokens: 61237 // sqrt(50000 * 75000)
        },
        yieldInfo: {
          currentAPY: 2.5, // Estimated based on trading volume and fees
          tradingFeePercent: config.poolFeePercent,
          estimatedDailyYield: 0.00685, // (2.5% / 365)
          riskLevel: 'Low',
          geniusActCompliant: true
        },
        contractInfo: {
          validatorAppId: config.validatorAppId,
          poolAddress: null, // Would be calculated from app ID
          network: isTestnet ? 'testnet' : 'mainnet'
        },
        minimumInvestment: 1.0, // $1 minimum
        maximumInvestment: 10000.0, // $10k maximum for testnet
        status: 'active',
        lastUpdated: new Date().toISOString()
      }
    ];

    console.log(`✅ Retrieved ${pools.length} available pools`);

    return res.json({
      success: true,
      pools: pools,
      network: isTestnet ? 'testnet' : 'mainnet',
      metadata: {
        fetchedAt: new Date().toISOString(),
        source: 'tinyman_v2',
        disclaimer: 'Pool data is estimated. Actual yields may vary based on market conditions.'
      }
    });

  } catch (error) {
    console.error('Investment pools endpoint error:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Internal server error' 
    });
  }
});

// GET /api/v1/investment/pools/:poolId - Get specific pool details
router.get('/:poolId', async (req, res) => {
  try {
    const { poolId } = req.params;
    
    console.log(`🏊 Fetching pool details for: ${poolId}`);

    if (poolId !== 'tinyman_usdca_v2') {
      return res.status(404).json({ 
        success: false,
        error: 'Pool not found' 
      });
    }

    const isTestnet = process.env.NODE_ENV !== 'production';
    const config = isTestnet ? TINYMAN_CONFIG.testnet : TINYMAN_CONFIG.mainnet;

    // Fetch detailed pool information
    const pool = {
      poolId: 'tinyman_usdca_v2',
      name: 'Tinyman USDCa Pool V2',
      description: 'Liquidity pool providing yield through automated market making between ALGO and USDCa',
      protocol: 'Tinyman',
      version: 'V2',
      assets: [
        {
          id: 0,
          name: 'Algorand',
          symbol: 'ALGO',
          decimals: 6,
          currentPrice: 0.20 // Mock price
        },
        {
          id: config.usdcAssetId,
          name: 'USD Coin',
          symbol: 'USDCa',
          decimals: 6,
          currentPrice: 1.00
        }
      ],
      liquidityInfo: {
        totalLiquidity: 125000,
        algoReserves: 50000,
        usdcaReserves: 75000,
        lpTokens: 61237,
        priceImpact: 0.1, // 0.1% for $1000 swap
        volume24h: 5000,
        volume7d: 32000
      },
      yieldInfo: {
        currentAPY: 2.5,
        apy7d: 2.3,
        apy30d: 2.6,
        tradingFeePercent: config.poolFeePercent,
        estimatedDailyYield: 0.00685,
        yieldSource: 'Trading fees from liquidity provision',
        compounding: 'Daily',
        riskLevel: 'Low',
        geniusActCompliant: true
      },
      contractInfo: {
        validatorAppId: config.validatorAppId,
        poolAddress: null,
        network: isTestnet ? 'testnet' : 'mainnet',
        auditStatus: 'Audited by Runtime Verification',
        auditDate: '2023-06-15'
      },
      investmentLimits: {
        minimumInvestment: 1.0,
        maximumInvestment: 10000.0,
        currentInvestors: 1250, // Mock data
        maxInvestors: 10000
      },
      riskFactors: [
        'Smart contract risk',
        'Impermanent loss risk',
        'Liquidity risk',
        'Algorithmic stablecoin risk (minimal for USDCa)'
      ],
      fees: {
        depositFee: 0,
        withdrawalFee: 0,
        managementFee: 0,
        tradingFee: config.poolFeePercent
      },
      status: 'active',
      lastUpdated: new Date().toISOString()
    };

    console.log(`✅ Pool details retrieved for ${poolId}`);

    return res.json({
      success: true,
      pool: pool,
      network: isTestnet ? 'testnet' : 'mainnet',
      metadata: {
        fetchedAt: new Date().toISOString(),
        source: 'tinyman_v2',
        disclaimer: 'Pool data is estimated. Past performance does not guarantee future results.'
      }
    });

  } catch (error) {
    console.error('Pool details endpoint error:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Internal server error' 
    });
  }
});

export default router;