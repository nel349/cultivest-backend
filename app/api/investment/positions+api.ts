import express from 'express';
import { supabase } from '../../../utils/supabase';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const userID = req.query.userID;

    if (!userID) {
      return res.status(400).json({ 
        success: false,
        error: 'User ID is required' 
      });
    }

    console.log(`📊 Fetching investment positions for user: ${userID}`);

    // Fetch user's investment positions from database
    const { data: positions, error: positionsError } = await supabase
      .from('investment_positions')
      .select('*')
      .eq('user_id', userID)
      .eq('status', 'active')
      .order('start_date', { ascending: false });

    if (positionsError) {
      console.error('Database error fetching positions:', positionsError);
      return res.status(500).json({ 
        success: false,
        error: 'Failed to fetch investment positions' 
      });
    }

    // Calculate totals
    const totalInvested = positions?.reduce((sum, pos) => sum + (pos.invested_amount_usdca || 0), 0) || 0;
    const totalYieldEarned = positions?.reduce((sum, pos) => sum + (pos.total_yield_earned || 0), 0) || 0;

    // Format positions for response
    const formattedPositions = positions?.map(pos => {
      const daysSinceStart = Math.floor((new Date().getTime() - new Date(pos.start_date).getTime()) / (1000 * 60 * 60 * 24));
      const estimatedCurrentYield = (pos.invested_amount_usdca * (pos.current_apy / 100) * daysSinceStart) / 365;
      
      return {
        positionID: pos.position_id,
        userID: pos.user_id,
        poolID: pos.pool_id,
        investedAmountUSDCa: pos.invested_amount_usdca,
        currentAPY: pos.current_apy,
        totalYieldEarned: pos.total_yield_earned,
        estimatedCurrentYield: Math.max(estimatedCurrentYield, pos.total_yield_earned),
        startDate: pos.start_date,
        algorandTxID: pos.algorand_tx_id,
        status: pos.status,
        daysSinceStart: daysSinceStart,
        dailyYieldRate: (pos.invested_amount_usdca * (pos.current_apy / 100)) / 365,
        poolInfo: {
          name: 'Tinyman USDCa Pool V2',
          protocol: 'Tinyman',
          riskLevel: 'Low',
          geniusActCompliant: true
        }
      };
    }) || [];

    console.log(`✅ Found ${formattedPositions.length} active positions for user ${userID}`);

    return res.json({
      success: true,
      userID: userID,
      positions: formattedPositions,
      summary: {
        totalInvested: Number(totalInvested.toFixed(2)),
        totalYieldEarned: Number(totalYieldEarned.toFixed(6)),
        estimatedTotalValue: Number((totalInvested + totalYieldEarned).toFixed(2)),
        activePositions: formattedPositions.length,
        averageAPY: formattedPositions.length > 0 
          ? formattedPositions.reduce((sum, pos) => sum + pos.currentAPY, 0) / formattedPositions.length 
          : 0
      },
      metadata: {
        fetchedAt: new Date().toISOString(),
        network: process.env.NODE_ENV !== 'production' ? 'testnet' : 'mainnet'
      }
    });

  } catch (error) {
    console.error('Investment positions endpoint error:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Internal server error' 
    });
  }
});

export default router;