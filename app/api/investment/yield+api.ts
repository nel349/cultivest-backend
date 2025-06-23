import express from 'express';
import { supabase } from '../../../utils/supabase';

const router = express.Router();

// POST /api/v1/investment/yield/calculate - Calculate and distribute daily yield
router.post('/calculate', async (req, res) => {
  try {
    console.log('💰 Starting daily yield calculation and distribution');

    // Fetch all active investment positions
    const { data: positions, error: positionsError } = await supabase
      .from('investment_positions')
      .select('*')
      .eq('status', 'active');

    if (positionsError) {
      console.error('Error fetching active positions:', positionsError);
      return res.status(500).json({ 
        success: false,
        error: 'Failed to fetch active positions' 
      });
    }

    if (!positions || positions.length === 0) {
      return res.json({
        success: true,
        message: 'No active positions to process',
        processedPositions: 0,
        totalYieldDistributed: 0
      });
    }

    console.log(`📊 Processing ${positions.length} active positions`);

    let totalYieldDistributed = 0;
    let processedPositions = 0;
    const errors = [];

    // Process each position
    for (const position of positions) {
      try {
        // Calculate daily yield for this position
        const dailyYieldRate = (position.invested_amount_usdca * (position.current_apy / 100)) / 365;
        const newYieldAmount = dailyYieldRate;
        const newTotalYield = position.total_yield_earned + newYieldAmount;

        // Update position with new yield
        const { error: updateError } = await supabase
          .from('investment_positions')
          .update({
            total_yield_earned: newTotalYield,
            updated_at: new Date().toISOString()
          })
          .eq('position_id', position.position_id);

        if (updateError) {
          console.error(`Error updating position ${position.position_id}:`, updateError);
          errors.push({ positionId: position.position_id, error: updateError.message });
          continue;
        }

        // Update user's balance with the yield
        const { error: balanceError } = await supabase
          .from('wallets')
          .update({
            balance_usdca: supabase.rpc('increment_balance', { 
              amount: newYieldAmount 
            }),
            updated_at: new Date().toISOString()
          })
          .eq('user_id', position.user_id);

        if (balanceError) {
          console.error(`Error updating balance for user ${position.user_id}:`, balanceError);
          errors.push({ positionId: position.position_id, error: `Balance update failed: ${balanceError.message}` });
          continue;
        }

        // Create transaction record for the yield
        const { error: txError } = await supabase
          .from('transactions')
          .insert({
            user_id: position.user_id,
            type: 'yield_credit',
            amount_usdca: newYieldAmount,
            status: 'completed',
            algorand_tx_id: null, // Yield is credited directly, no on-chain transaction
            external_tx_id: `yield_${position.position_id}_${Date.now()}`,
            provider: 'tinyman'
          });

        if (txError) {
          console.error(`Error creating yield transaction for position ${position.position_id}:`, txError);
          // Don't fail the entire process for transaction logging errors
        }

        totalYieldDistributed += newYieldAmount;
        processedPositions++;

        console.log(`✅ Processed position ${position.position_id}: +${newYieldAmount.toFixed(6)} USDCa yield`);

      } catch (positionError) {
        console.error(`Error processing position ${position.position_id}:`, positionError);
        errors.push({ 
          positionId: position.position_id, 
          error: positionError instanceof Error ? positionError.message : 'Unknown error' 
        });
      }
    }

    console.log(`💰 Yield calculation complete: ${processedPositions}/${positions.length} positions processed`);
    console.log(`💸 Total yield distributed: ${totalYieldDistributed.toFixed(6)} USDCa`);

    return res.json({
      success: true,
      message: 'Daily yield calculation completed',
      summary: {
        totalPositions: positions.length,
        processedPositions: processedPositions,
        failedPositions: errors.length,
        totalYieldDistributed: Number(totalYieldDistributed.toFixed(6)),
        averageYieldPerPosition: positions.length > 0 ? Number((totalYieldDistributed / processedPositions).toFixed(6)) : 0
      },
      errors: errors.length > 0 ? errors : undefined,
      processedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Yield calculation endpoint error:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Internal server error during yield calculation' 
    });
  }
});

// GET /api/v1/investment/yield/history/:userID - Get yield history for a user
router.get('/history/:userID', async (req, res) => {
  try {
    const { userID } = req.params;
    const { days = 30 } = req.query;

    console.log(`📈 Fetching yield history for user ${userID} (last ${days} days)`);

    // Fetch yield transactions for the user
    const { data: yieldTransactions, error: txError } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userID)
      .eq('type', 'yield_credit')
      .gte('created_at', new Date(Date.now() - parseInt(days as string) * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false });

    if (txError) {
      console.error('Error fetching yield history:', txError);
      return res.status(500).json({ 
        success: false,
        error: 'Failed to fetch yield history' 
      });
    }

    // Fetch user's investment positions for context
    const { data: positions, error: positionsError } = await supabase
      .from('investment_positions')
      .select('*')
      .eq('user_id', userID);

    if (positionsError) {
      console.error('Error fetching user positions:', positionsError);
      return res.status(500).json({ 
        success: false,
        error: 'Failed to fetch investment positions' 
      });
    }

    // Calculate summary statistics
    const totalYieldEarned = yieldTransactions?.reduce((sum, tx) => sum + (tx.amount_usdca || 0), 0) || 0;
    const totalInvested = positions?.reduce((sum, pos) => sum + (pos.invested_amount_usdca || 0), 0) || 0;
    const yieldPercentage = totalInvested > 0 ? (totalYieldEarned / totalInvested) * 100 : 0;

    // Group yield by day for charting
    const yieldByDay = {};
    yieldTransactions?.forEach(tx => {
      const day = tx.created_at.split('T')[0]; // Get YYYY-MM-DD
      if (!yieldByDay[day]) {
        yieldByDay[day] = 0;
      }
      yieldByDay[day] += tx.amount_usdca || 0;
    });

    const chartData = Object.entries(yieldByDay).map(([date, amount]) => ({
      date,
      yieldAmount: Number((amount as number).toFixed(6)),
      cumulativeYield: 0 // Will be calculated below
    })).sort((a, b) => a.date.localeCompare(b.date));

    // Calculate cumulative yield
    let cumulative = 0;
    chartData.forEach(point => {
      cumulative += point.yieldAmount;
      point.cumulativeYield = Number(cumulative.toFixed(6));
    });

    console.log(`✅ Yield history retrieved for user ${userID}: ${yieldTransactions?.length || 0} transactions`);

    return res.json({
      success: true,
      userID: userID,
      period: {
        days: parseInt(days as string),
        startDate: new Date(Date.now() - parseInt(days as string) * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date().toISOString()
      },
      summary: {
        totalYieldEarned: Number(totalYieldEarned.toFixed(6)),
        totalInvested: Number(totalInvested.toFixed(2)),
        yieldPercentage: Number(yieldPercentage.toFixed(4)),
        transactionCount: yieldTransactions?.length || 0,
        averageDailyYield: chartData.length > 0 ? Number((totalYieldEarned / chartData.length).toFixed(6)) : 0
      },
      transactions: yieldTransactions?.map(tx => ({
        transactionId: tx.transaction_id,
        amount: tx.amount_usdca,
        date: tx.created_at,
        externalTxId: tx.external_tx_id
      })) || [],
      chartData: chartData,
      positions: positions?.map(pos => ({
        positionId: pos.position_id,
        poolId: pos.pool_id,
        investedAmount: pos.invested_amount_usdca,
        totalYieldEarned: pos.total_yield_earned,
        currentAPY: pos.current_apy,
        startDate: pos.start_date
      })) || []
    });

  } catch (error) {
    console.error('Yield history endpoint error:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Internal server error' 
    });
  }
});

export default router;