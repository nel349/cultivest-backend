import express from 'express';
import { supabase } from '../../../utils/supabase';
import { getUserWallet } from '../../../utils/wallet';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { userID } = req.body as { userID: string };
    
    // Temporary: Skip JWT validation for testing
    // const authHeader = req.headers.authorization;

    // if (!authHeader || !authHeader.startsWith('Bearer ')) {
    //   return res.status(401).json({ error: 'Authorization token required' });
    // }

    // // Extract and verify JWT token
    // const token = authHeader.split(' ')[1];
    // const decoded = verifyJWT(token);
    
    // if (!decoded) {
    //   return res.status(401).json({ error: 'Invalid user token' });
    // }
    
    if (!userID) {
      return res.status(400).json({ error: 'userID query parameter required' });
    }
    
    console.log('📊 Fetching portfolio for user:', userID);
    
    // Get user's wallet with live balances
    const wallet = await getUserWallet(userID, true);
    if (!wallet) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    const btcBalance = wallet.onChainBalance?.btc || wallet.balance.btc || 0;
    const algoBalance = wallet.onChainBalance?.algo || wallet.balance.algo || 0;
    const usdcBalance = wallet.onChainBalance?.usdca || wallet.balance.usdca || 0;
    const solBalance = wallet.onChainBalance?.sol || wallet.balance.sol || 0;

    // Get live cryptocurrency prices
    let btcPriceUSD = 97000;  // Fallback
    let algoPriceUSD = 0.40;  // Fallback  
    let solPriceUSD = 95;     // Fallback

    try {
      const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
      const pricesResult = await fetch(`${API_BASE_URL}/api/prices`);
      
      if (pricesResult.ok) {
        const pricesData = await pricesResult.json() as any;
        if (pricesData.success && pricesData.prices) {
          btcPriceUSD = pricesData.prices.bitcoin?.usd || btcPriceUSD;
          algoPriceUSD = pricesData.prices.algorand?.usd || algoPriceUSD;
          solPriceUSD = pricesData.prices.solana?.usd || solPriceUSD;
        }
      }
    } catch (error) {
      console.log('Using fallback prices due to fetch error:', error);
    }

    // Calculate USD values
    const btcValueUSD = btcBalance * btcPriceUSD;
    const algoValueUSD = algoBalance * algoPriceUSD;
    const usdcValueUSD = usdcBalance * 1.0; // USDC is pegged to $1
    const solValueUSD = solBalance * solPriceUSD;
    const totalPortfolioValueUSD = btcValueUSD + algoValueUSD + usdcValueUSD + solValueUSD;

    // Calculate allocation percentages
    const allocation = {
      bitcoin: totalPortfolioValueUSD > 0 ? (btcValueUSD / totalPortfolioValueUSD) * 100 : 0,
      algorand: totalPortfolioValueUSD > 0 ? (algoValueUSD / totalPortfolioValueUSD) * 100 : 0,
      usdc: totalPortfolioValueUSD > 0 ? (usdcValueUSD / totalPortfolioValueUSD) * 100 : 0,
      solana: totalPortfolioValueUSD > 0 ? (solValueUSD / totalPortfolioValueUSD) * 100 : 0
    };

    // Get investment history
    let investments = [];
    let totalInvestedUSD = 0;
    
    try {
      const { data: investmentData, error: investmentError } = await supabase
        .from('investments')
        .select('*')
        .eq('user_id', userID)
        .order('created_at', { ascending: false });

      if (!investmentError && investmentData) {
        investments = investmentData;
        totalInvestedUSD = investments.reduce((sum, inv) => sum + inv.amount_usd, 0);
      }
    } catch (error) {
      console.log('💡 Investments table not available, using basic portfolio data');
    }

    // Calculate unrealized P&L
    const unrealizedPnL = totalPortfolioValueUSD - totalInvestedUSD;
    const portfolioPerformance = totalInvestedUSD > 0 ? (unrealizedPnL / totalInvestedUSD) * 100 : 0;

    // Try to fetch Portfolio NFT data
    let portfolioNFT = null;
    try {
      const { data: nftData } = await supabase
        .from('portfolio_nfts')
        .select('*')
        .eq('user_id', userID)
        .single();
      
      if (nftData) {
        portfolioNFT = {
          assetId: nftData.algorand_nft_asset_id,
          totalValue: nftData.total_value_usd,
          lastUpdated: nftData.last_updated
        };
      }
    } catch (error) {
      console.log('💡 Portfolio NFT not found or table not available');
    }

    return res.json({
      success: true,
      message: 'Portfolio retrieved successfully',
      summary: {
        totalValueUSD: totalPortfolioValueUSD,
        totalInvestedUSD,
        unrealizedPnL,
        portfolioPerformance,
        lastUpdated: new Date().toISOString()
      },
      allocation,
      holdings: {
        bitcoin: {
          address: wallet.bitcoinAddress,
          balance: btcBalance,
          valueUSD: btcValueUSD,
          priceUSD: btcPriceUSD
        },
        algorand: {
          address: wallet.algorandAddress,
          balance: algoBalance,
          valueUSD: algoValueUSD,
          priceUSD: algoPriceUSD,
          usdcBalance,
          usdcValueUSD,
          isOptedIntoUSDC: wallet.onChainBalance?.isOptedIntoUSDCa || false
        },
        solana: {
          address: wallet.solanaAddress,
          balance: solBalance,
          valueUSD: solValueUSD,
          priceUSD: solPriceUSD
        }
      },
      portfolioNFT,
      recentInvestments: investments.slice(0, 5).map(inv => ({
        id: inv.investment_id,
        type: inv.investment_type,
        asset: inv.target_asset,
        amountUSD: inv.amount_usd,
        date: inv.created_at,
        status: inv.status
      })),
      analytics: {
        bitcoinFirst: btcValueUSD >= Math.max(algoValueUSD, solValueUSD),
        solanaFirst: solValueUSD >= Math.max(btcValueUSD, algoValueUSD),
        diversificationScore: 
          (btcBalance > 0 ? 1 : 0) + 
          (algoBalance > 0 ? 1 : 0) + 
          (solBalance > 0 ? 1 : 0) + 
          (usdcBalance > 0 ? 1 : 0),
        isMultiChain: [btcBalance, algoBalance, solBalance].filter(b => b > 0).length >= 2,
        riskLevel: btcValueUSD > (totalPortfolioValueUSD * 0.7) ? 'High' : 
                  solValueUSD > (totalPortfolioValueUSD * 0.7) ? 'High' : 'Moderate',
        supportedAssets: ['BTC', 'ALGO', 'USDC', 'SOL'],
        activeAssets: [
          ...(btcBalance > 0 ? ['BTC'] : []),
          ...(algoBalance > 0 ? ['ALGO'] : []),
          ...(usdcBalance > 0 ? ['USDC'] : []),
          ...(solBalance > 0 ? ['SOL'] : [])
        ]
      }
    });

  } catch (error) {
    console.error('Portfolio fetch error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;