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

    // Get user's Bitcoin investments
    const { data: bitcoinInvestments } = await supabase
      .from('investments')
      .select('*')
      .eq('user_id', userID)
      .eq('target_asset', 'BTC')
      .order('created_at', { ascending: false });

    // Get user's wallet balance
    const { data: wallet } = await supabase
      .from('wallets')
      .select('bitcoin_balance_satoshis, algorand_balance_microalgos')
      .eq('user_id', userID)
      .single();

    const dashboardData = {
      userID,
      balance: wallet?.bitcoin_balance_satoshis 
        ? wallet.bitcoin_balance_satoshis / 100000000 // Convert satoshis to BTC
        : investmentSummary.totalInvested, // Fallback to total invested
      dailyYield: 0, // TODO: Calculate from actual yield data
      portfolio: portfolioData,
      investments: {
        bitcoin: {
          count: bitcoinInvestments?.length || 0,
          totalInvested: bitcoinInvestments?.reduce((sum, inv) => sum + inv.amount_usd, 0) || 0,
          estimatedBTC: bitcoinInvestments?.reduce((sum, inv) => sum + parseFloat(inv.estimated_btc || '0'), 0) || 0
        },
        summary: investmentSummary
      },
      moneyTree: {
        leaves: Math.min(investmentSummary.positionCount, 10), // Max 10 leaves
        growthStage: investmentSummary.totalInvested > 100 ? 'mature' : 
                    investmentSummary.totalInvested > 10 ? 'growing' : 'seedling',
        nextMilestone: investmentSummary.totalInvested < 10 ? 10.00 : 
                      investmentSummary.totalInvested < 100 ? 100.00 : 1000.00,
        level: Math.floor(investmentSummary.totalInvested / 100) + 1
      },
      badges: [
        ...(investmentSummary.positionCount > 0 ? [{
          badgeID: 'first_investor',
          name: 'First Investor!',
          description: 'Made your first investment',
          awardedAt: new Date().toISOString(),
        }] : []),
        ...(investmentSummary.hasPortfolio ? [{
          badgeID: 'nft_collector',
          name: 'NFT Portfolio Owner',
          description: 'Created your investment portfolio NFT',
          awardedAt: userPortfolio?.createdAt,
        }] : [])
      ],
      stats: {
        totalInvested: Number(investmentSummary.totalInvested.toFixed(2)),
        totalYieldEarned: 0, // TODO: Calculate from actual yield data
        daysActive: userPortfolio ? Math.floor(
          (new Date().getTime() - new Date(userPortfolio.createdAt).getTime()) / (1000 * 60 * 60 * 24)
        ) : 0,
        investmentStreak: investmentSummary.positionCount,
        nftTokenId: portfolioData?.tokenId
      },
      weeklyProgress: [
        { day: 'Mon', value: 80 },
        { day: 'Tue', value: 65 },
        { day: 'Wed', value: 90 },
        { day: 'Thu', value: 75 },
        { day: 'Fri', value: 85 },
        { day: 'Sat', value: 95 },
        { day: 'Sun', value: 70 },
      ],
    };

    return res.json({
      success: true,
      dashboard: dashboardData,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;