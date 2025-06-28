import express from 'express';
import { supabase } from '../../../utils/supabase';

const router = express.Router();

// GET /api/user/first-investment-status
router.get('/', async (req, res) => {
  try {
    const { userID } = req.query;
    
    // Validation
    if (!userID) {
      return res.status(400).json({
        success: false,
        error: 'userID query parameter is required'
      });
    }

    console.log(`🔍 Checking first investment status for user: ${userID}`);
    
    // Check user's first investment completion status
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('first_investment_completed_at')
      .eq('user_id', userID)
      .single();

    if (userError) {
      console.error('Error fetching user data:', userError);
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Get count of completed investments
    const { data: investments, error: investmentError } = await supabase
      .from('investments')
      .select('investment_id, is_first_investment, created_at, target_asset, amount_usd')
      .eq('user_id', userID)
      .eq('status', 'completed')
      .order('created_at', { ascending: true });

    if (investmentError) {
      console.error('Error fetching investments:', investmentError);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch investment data'
      });
    }

    const hasCompletedFirstInvestment = !!userData.first_investment_completed_at;
    const completedInvestmentsCount = investments?.length || 0;
    const firstInvestment = investments?.find(inv => inv.is_first_investment);

    const result = {
      success: true,
      data: {
        userID,
        hasCompletedFirstInvestment,
        firstInvestmentCompletedAt: userData.first_investment_completed_at,
        totalCompletedInvestments: completedInvestmentsCount,
        firstInvestment: firstInvestment ? {
          investmentId: firstInvestment.investment_id,
          targetAsset: firstInvestment.target_asset,
          amountUsd: firstInvestment.amount_usd,
          createdAt: firstInvestment.created_at
        } : null,
        celebration: {
          shouldShowCelebration: hasCompletedFirstInvestment && completedInvestmentsCount === 1,
          message: hasCompletedFirstInvestment ? 
            `🎉 First investment completed on ${new Date(userData.first_investment_completed_at).toLocaleDateString()}!` :
            'No investments completed yet'
        }
      }
    };

    console.log(`✅ First investment status for user ${userID}:`, {
      hasCompleted: hasCompletedFirstInvestment,
      totalInvestments: completedInvestmentsCount,
      shouldCelebrate: result.data.celebration.shouldShowCelebration
    });

    return res.json(result);

  } catch (error) {
    console.error('❌ First investment status error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get first investment status',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router; 