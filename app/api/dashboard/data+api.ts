import express from 'express';
import { supabase } from '../../../utils/supabase';
import { userPortfolioService } from '../../../services/user-portfolio.service';
import { nftContractService } from '../../../services/nft-contract.service';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const userID = req.query.userID;

    if (!userID) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    console.log(`📊 Fetching dashboard data for user: ${userID}`);

    // Get user's primary portfolio
    const userPortfolio = await userPortfolioService.getUserPrimaryPortfolio(userID as string);
    
    let portfolioData = null;
    let investmentSummary = {
      totalInvested: 0,
      positionCount: 0,
      hasPortfolio: false
    };

    if (userPortfolio) {
      try {
        // Get portfolio positions from blockchain
        const portfolioPositions = await nftContractService.getPortfolioPositions(
          userID as string, 
          BigInt(userPortfolio.portfolioTokenId)
        );

        portfolioData = {
          tokenId: userPortfolio.portfolioTokenId.toString(),
          customName: userPortfolio.customName,
          positionCount: portfolioPositions.positionCount,
          positions: portfolioPositions.positions
        };

        // Calculate total invested from positions
        investmentSummary = {
          totalInvested: portfolioPositions.positions.reduce((sum, pos) => 
            sum + parseFloat(pos.purchaseValue || '0'), 0) / 100, // Convert from cents
          positionCount: portfolioPositions.positionCount,
          hasPortfolio: true
        };
      } catch (portfolioError) {
        console.error('Error fetching portfolio data:', portfolioError);
        portfolioData = {
          tokenId: userPortfolio.portfolioTokenId.toString(),
          customName: userPortfolio.customName,
          positionCount: 0,
          positions: []
        };
      }
    }

    // Get user's multi-chain investments
    const { data: bitcoinInvestments } = await supabase
      .from('investments')
      .select('*')
      .eq('user_id', userID)
      .eq('target_asset', 'BTC')
      .order('created_at', { ascending: false });

    const { data: solanaInvestments } = await supabase
      .from('investments')
      .select('*')
      .eq('user_id', userID)
      .eq('target_asset', 'SOL')
      .order('created_at', { ascending: false });

    const { data: algorandInvestments } = await supabase
      .from('investments')
      .select('*')
      .eq('user_id', userID)
      .eq('target_asset', 'USDC')
      .order('created_at', { ascending: false });

    // Get user's multi-chain wallet balance
    const { data: wallet } = await supabase
      .from('wallets')
      .select('bitcoin_balance_satoshis, algorand_balance_microalgos, balance_btc, balance_algo, balance_usdca, balance_sol')
      .eq('user_id', userID)
      .single();

    // Calculate total portfolio value
    const bitcoinTotal = bitcoinInvestments?.reduce((sum, inv) => sum + inv.amount_usd, 0) || 0;
    const solanaTotal = solanaInvestments?.reduce((sum, inv) => sum + inv.amount_usd, 0) || 0;
    const algorandTotal = algorandInvestments?.reduce((sum, inv) => sum + inv.amount_usd, 0) || 0;
    const totalInvestedUSD = bitcoinTotal + solanaTotal + algorandTotal;

    // Get current balances (with fallbacks for older schemas)
    const currentBalances = {
      btc: wallet?.balance_btc || (wallet?.bitcoin_balance_satoshis ? wallet.bitcoin_balance_satoshis / 100000000 : 0),
      algo: wallet?.balance_algo || (wallet?.algorand_balance_microalgos ? wallet.algorand_balance_microalgos / 1000000 : 0),
      usdca: wallet?.balance_usdca || 0,
      sol: wallet?.balance_sol || 0
    };

    const dashboardData = {
      userID,
      balance: totalInvestedUSD || investmentSummary.totalInvested, // Total portfolio value
      dailyYield: 0, // TODO: Calculate from actual yield data
      portfolio: portfolioData,
      investments: {
        bitcoin: {
          count: bitcoinInvestments?.length || 0,
          totalInvested: bitcoinTotal,
          estimatedBTC: bitcoinInvestments?.reduce((sum, inv) => sum + parseFloat(inv.estimated_btc || '0'), 0) || 0,
          currentBalance: currentBalances.btc
        },
        solana: {
          count: solanaInvestments?.length || 0,
          totalInvested: solanaTotal,
          estimatedSOL: solanaInvestments?.reduce((sum, inv) => sum + parseFloat(inv.estimated_sol || '0'), 0) || 0,
          currentBalance: currentBalances.sol
        },
        algorand: {
          count: algorandInvestments?.length || 0,
          totalInvested: algorandTotal,
          currentBalance: {
            algo: currentBalances.algo,
            usdca: currentBalances.usdca
          }
        },
        summary: {
          ...investmentSummary,
          totalInvestedUSD,
          assetCount: (bitcoinInvestments?.length || 0) + (solanaInvestments?.length || 0) + (algorandInvestments?.length || 0)
        }
      },
      balances: currentBalances,
      moneyTree: {
        leaves: Math.min(investmentSummary.positionCount, 10), // Max 10 leaves
        growthStage: totalInvestedUSD > 100 ? 'mature' : 
                    totalInvestedUSD > 10 ? 'growing' : 'seedling',
        nextMilestone: totalInvestedUSD < 10 ? 10.00 : 
                      totalInvestedUSD < 100 ? 100.00 : 1000.00,
        level: Math.floor(totalInvestedUSD / 100) + 1
      },
      analytics: {
        diversificationScore: (currentBalances.btc > 0 ? 1 : 0) + 
                             (currentBalances.sol > 0 ? 1 : 0) + 
                             (currentBalances.algo > 0 || currentBalances.usdca > 0 ? 1 : 0),
        isMultiChain: (currentBalances.btc > 0 && currentBalances.sol > 0) || 
                     (currentBalances.btc > 0 && currentBalances.algo > 0) ||
                     (currentBalances.sol > 0 && currentBalances.algo > 0),
        supportedChains: ['Bitcoin', 'Solana', 'Algorand'],
        activeChains: [
          ...(currentBalances.btc > 0 ? ['Bitcoin'] : []),
          ...(currentBalances.sol > 0 ? ['Solana'] : []),
          ...((currentBalances.algo > 0 || currentBalances.usdca > 0) ? ['Algorand'] : [])
        ]
      }
    };

    console.log(`✅ Dashboard data compiled for user ${userID}:`, {
      totalInvested: totalInvestedUSD,
      balances: currentBalances,
      investments: {
        bitcoin: dashboardData.investments.bitcoin.count,
        solana: dashboardData.investments.solana.count,
        algorand: dashboardData.investments.algorand.count
      }
    });

    return res.json({
      success: true,
      data: dashboardData
    });

  } catch (error) {
    console.error('Dashboard data endpoint error:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Internal server error' 
    });
  }
});

export default router;