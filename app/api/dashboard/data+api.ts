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

        // Calculate total invested from positions (purchaseValue is already in cents, convert to dollars)
        investmentSummary = {
          totalInvested: portfolioPositions.positions.reduce((sum, pos) => 
            sum + (parseFloat(pos.purchaseValue || '0') / 100), 0), // Convert from cents to dollars
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

    // Get user's actual wallet balance using the same function as wallet API
    const { getUserWallet } = await import('../../../utils/wallet');
    const walletInfo = await getUserWallet(userID as string, true); // includeLiveBalance = true
    
    // Get current wallet balances from live balance
    const walletBalances = {
      btc: walletInfo?.onChainBalance?.btc || walletInfo?.balance?.btc || 0,
      algo: walletInfo?.onChainBalance?.algo || walletInfo?.balance?.algo || 0,
      usdca: walletInfo?.onChainBalance?.usdca || walletInfo?.balance?.usdca || 0,
      sol: walletInfo?.onChainBalance?.sol || walletInfo?.balance?.sol || 0
    };

    // Calculate investment totals from NFT positions (primary source of truth)
    let bitcoinFromPositions = 0;
    let solanaFromPositions = 0;
    let algorandFromPositions = 0;
    let totalInvestedUSD = 0;

    if (portfolioData?.positions) {
      portfolioData.positions.forEach(position => {
        const valueInDollars = parseFloat(position.purchaseValue || '0') / 100; // Convert cents to dollars
        const holdings = parseFloat(position.holdings || '0');
        
        if (position.assetTypeName === 'Bitcoin') {
          bitcoinFromPositions += valueInDollars;
        } else if (position.assetTypeName === 'Solana') {
          solanaFromPositions += valueInDollars;
        } else if (position.assetTypeName === 'USDC' || position.assetTypeName === 'Algorand') {
          algorandFromPositions += valueInDollars;
        }
        
        totalInvestedUSD += valueInDollars;
      });
    }

    // Use investment summary total if available, otherwise calculated total
    totalInvestedUSD = investmentSummary.totalInvested || totalInvestedUSD;

    const dashboardData = {
      userID,
      balance: totalInvestedUSD, // Total portfolio value from NFT positions
      dailyYield: 0, // TODO: Calculate from actual yield data
      portfolio: portfolioData,
      investments: {
        bitcoin: {
          count: portfolioData?.positions?.filter(p => p.assetTypeName === 'Bitcoin').length || 0,
          totalInvested: bitcoinFromPositions,
          estimatedBTC: portfolioData?.positions
            ?.filter(p => p.assetTypeName === 'Bitcoin')
            ?.reduce((sum, pos) => sum + (parseFloat(pos.holdings || '0') / 100000000), 0) || 0 // Convert satoshis to BTC
        },
        solana: {
          count: portfolioData?.positions?.filter(p => p.assetTypeName === 'Solana').length || 0,
          totalInvested: solanaFromPositions,
          estimatedSOL: portfolioData?.positions
            ?.filter(p => p.assetTypeName === 'Solana')
            ?.reduce((sum, pos) => sum + (parseFloat(pos.holdings || '0') / 1000000000), 0) || 0 // Convert lamports to SOL
        },
        algorand: {
          count: portfolioData?.positions?.filter(p => p.assetTypeName === 'USDC' || p.assetTypeName === 'Algorand').length || 0,
          totalInvested: algorandFromPositions
        },
        summary: {
          ...investmentSummary,
          totalInvestedUSD,
          assetCount: portfolioData?.positions?.length || 0
        }
      },
      // Removed balances section to avoid confusion with investment positions
      // Users should see their investments, not raw wallet balances
      moneyTree: {
        leaves: Math.min(investmentSummary.positionCount, 10), // Max 10 leaves
        growthStage: totalInvestedUSD > 100 ? 'mature' : 
                    totalInvestedUSD > 10 ? 'growing' : 'seedling',
        nextMilestone: totalInvestedUSD < 10 ? 10.00 : 
                      totalInvestedUSD < 100 ? 100.00 : 1000.00,
        level: Math.floor(totalInvestedUSD / 100) + 1
      },
      analytics: {
        diversificationScore: (bitcoinFromPositions > 0 ? 1 : 0) + 
                             (solanaFromPositions > 0 ? 1 : 0) + 
                             (algorandFromPositions > 0 ? 1 : 0),
        isMultiChain: (bitcoinFromPositions > 0 && solanaFromPositions > 0) || 
                     (bitcoinFromPositions > 0 && algorandFromPositions > 0) ||
                     (solanaFromPositions > 0 && algorandFromPositions > 0),
        supportedChains: ['Bitcoin', 'Solana', 'Algorand'],
        activeChains: [
          ...(bitcoinFromPositions > 0 ? ['Bitcoin'] : []),
          ...(solanaFromPositions > 0 ? ['Solana'] : []),
          ...(algorandFromPositions > 0 ? ['Algorand'] : [])
        ]
      }
    };

    console.log(`✅ Dashboard data compiled for user ${userID}:`, {
      totalInvested: totalInvestedUSD,
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