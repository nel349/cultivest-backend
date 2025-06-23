import express from 'express';
import { supabase } from '../../../utils/supabase';

const router = express.Router();

// GET /api/v1/investment/status/:positionId - Get investment status and yield updates
router.get('/:positionId', async (req, res) => {
  try {
    const { positionId } = req.params;
    const { userID } = req.query;

    if (!positionId) {
      return res.status(400).json({ 
        success: false,
        error: 'Position ID is required' 
      });
    }

    console.log(`📊 Fetching investment status for position: ${positionId}`);

    // Fetch investment position
    let query = supabase
      .from('investment_positions')
      .select('*')
      .eq('position_id', positionId);

    // If userID provided, ensure user owns this position
    if (userID) {
      query = query.eq('user_id', userID);
    }

    const { data: position, error: positionError } = await query.single();

    if (positionError || !position) {
      return res.status(404).json({ 
        success: false,
        error: 'Investment position not found' 
      });
    }

    // Calculate current yield based on time elapsed
    const daysSinceStart = Math.floor(
      (new Date().getTime() - new Date(position.start_date).getTime()) / (1000 * 60 * 60 * 24)
    );
    
    const dailyYieldRate = (position.invested_amount_usdca * (position.current_apy / 100)) / 365;
    const estimatedCurrentYield = dailyYieldRate * daysSinceStart;
    const totalEstimatedValue = position.invested_amount_usdca + Math.max(estimatedCurrentYield, position.total_yield_earned);

    console.log(`✅ Investment status retrieved for position ${positionId}`);

    return res.json({
      success: true,
      positionId: positionId,
      investment: {
        positionID: position.position_id,
        userID: position.user_id,
        poolID: position.pool_id,
        investedAmountUSDCa: position.invested_amount_usdca,
        currentAPY: position.current_apy,
        totalYieldEarned: position.total_yield_earned,
        estimatedCurrentYield: estimatedCurrentYield,
        totalEstimatedValue: totalEstimatedValue,
        startDate: position.start_date,
        endDate: position.end_date,
        algorandTxID: position.algorand_tx_id,
        status: position.status,
        daysSinceStart: daysSinceStart,
        dailyYieldRate: dailyYieldRate,
        poolInfo: {
          name: 'Tinyman USDCa Pool V2',
          protocol: 'Tinyman',
          riskLevel: 'Low',
          geniusActCompliant: true,
          validatorAppId: process.env.NODE_ENV !== 'production' ? 148607000 : 1002541853
        }
      },
      yieldHistory: {
        projectedDaily: dailyYieldRate,
        projectedWeekly: dailyYieldRate * 7,
        projectedMonthly: dailyYieldRate * 30,
        projectedYearly: position.invested_amount_usdca * (position.current_apy / 100)
      },
      metadata: {
        fetchedAt: new Date().toISOString(),
        network: process.env.NODE_ENV !== 'production' ? 'testnet' : 'mainnet',
        lastUpdated: position.updated_at
      }
    });

  } catch (error) {
    console.error('Investment status endpoint error:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Internal server error' 
    });
  }
});

export default router;