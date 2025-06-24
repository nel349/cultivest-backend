import express from 'express';
import { supabase } from '../../../utils/supabase';
import { verifyJWT } from '../../../utils/auth';
import { moonPayService } from '../../../utils/moonpay';
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
    
    // Get user's multi-chain wallet with live balances
    const wallet = await getUserWallet(userID, true);

    if (!wallet) {
      return res.status(404).json({ 
        error: 'User wallet not found' 
      });
    }

    // Get current prices
    const btcPrice = await moonPayService.getBitcoinPrice();
    const algoPrice = await moonPayService.getAlgoPrice();

    // Calculate portfolio values
    const btcBalance = wallet.onChainBalance?.btc || wallet.balance.btc || 0;
    const algoBalance = wallet.onChainBalance?.algo || wallet.balance.algo || 0;
    const usdcBalance = wallet.onChainBalance?.usdca || wallet.balance.usdca || 0;

    const btcValueUSD = btcBalance * btcPrice;
    const algoValueUSD = algoBalance * algoPrice;
    const usdcValueUSD = usdcBalance * 1; // USDC ≈ $1
    const totalPortfolioValueUSD = btcValueUSD + algoValueUSD + usdcValueUSD;

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
        totalInvestedUSD = investments.reduce((sum, inv) => sum + (inv.amount_usd || 0), 0);
      }
    } catch (error) {
      console.log('💡 Investments table not available, using basic portfolio data');
    }

    // Calculate performance
    const unrealizedPnL = totalPortfolioValueUSD - totalInvestedUSD;
    const portfolioPerformance = totalInvestedUSD > 0 
      ? ((unrealizedPnL / totalInvestedUSD) * 100).toFixed(2) + '%'
      : '0.00%';

    // Portfolio allocation
    const allocation = {
      bitcoin: {
        balance: btcBalance,
        valueUSD: btcValueUSD,
        percentage: totalPortfolioValueUSD > 0 ? ((btcValueUSD / totalPortfolioValueUSD) * 100).toFixed(1) + '%' : '0.0%',
        price: btcPrice
      },
      algorand: {
        balance: algoBalance,
        valueUSD: algoValueUSD,
        percentage: totalPortfolioValueUSD > 0 ? ((algoValueUSD / totalPortfolioValueUSD) * 100).toFixed(1) + '%' : '0.0%',
        price: algoPrice
      },
      usdc: {
        balance: usdcBalance,
        valueUSD: usdcValueUSD,
        percentage: totalPortfolioValueUSD > 0 ? ((usdcValueUSD / totalPortfolioValueUSD) * 100).toFixed(1) + '%' : '0.0%',
        price: 1.0
      }
    };

    // Portfolio NFT info (if available)
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
          valueUSD: btcValueUSD
        },
        algorand: {
          address: wallet.algorandAddress,
          balance: algoBalance,
          valueUSD: algoValueUSD,
          usdcBalance,
          usdcValueUSD,
          isOptedIntoUSDC: wallet.onChainBalance?.isOptedIntoUSDCa || false
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
        bitcoinFirst: btcValueUSD >= algoValueUSD,
        diversificationScore: btcBalance > 0 && algoBalance > 0 ? 'Diversified' : 'Single Asset',
        riskLevel: btcValueUSD > (totalPortfolioValueUSD * 0.7) ? 'High' : 'Moderate'
      }
    });

  } catch (error) {
    console.error('Portfolio fetch error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;