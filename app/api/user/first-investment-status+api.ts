import express from 'express';
import { supabase } from '../../../utils/supabase';

const router = express.Router();

// GET /api/user/first-investment-status
router.get('/', async (req, res) => {
  try {
    const { userId } = req.query;
    
    // Validation
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId query parameter is required'
      });
    }

    console.log(`🔍 Checking first investment status for user: ${userId}`);
    
    // Check user's first investment completion status and celebration viewed status
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('first_investment_completed_at, first_investment_celebration_viewed_at')
      .eq('user_id', userId)
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
      .eq('user_id', userId)
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
    const celebrationViewed = !!userData.first_investment_celebration_viewed_at;
    const completedInvestmentsCount = investments?.length || 0;
    const firstInvestment = investments?.find(inv => inv.is_first_investment);

    // Only show celebration if:
    // 1. User has completed first investment
    // 2. User has exactly 1 completed investment  
    // 3. User hasn't viewed the celebration yet
    const shouldCelebrate = hasCompletedFirstInvestment && 
                           completedInvestmentsCount === 1 && 
                           !celebrationViewed;

    const result = {
      success: true,
      data: {
        userId,
        // New simplified field names to match client expectations
        hasCompleted: hasCompletedFirstInvestment,
        shouldCelebrate: shouldCelebrate,
        totalInvestments: completedInvestmentsCount,
        // Legacy fields for backward compatibility
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
          shouldShowCelebration: shouldCelebrate,
          message: hasCompletedFirstInvestment ? 
            `🎉 First investment completed on ${new Date(userData.first_investment_completed_at).toLocaleDateString()}!` :
            'No investments completed yet'
        }
      }
    };

    console.log(`✅ First investment status for user ${userId}:`, {
      hasCompleted: hasCompletedFirstInvestment,
      totalInvestments: completedInvestmentsCount,
      celebrationViewed: celebrationViewed,
      shouldCelebrate: shouldCelebrate
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