import express from 'express';
import { supabase } from '../../../utils/supabase';

const router = express.Router();

/**
 * Mark first investment celebration as completed
 * POST /api/user/mark-celebration-completed
 */
router.post('/', async (req, res) => {
  try {
    const { userID } = req.body;
    
    // Validation
    if (!userID) {
      return res.status(400).json({
        success: false,
        error: 'userID is required'
      });
    }

    console.log(`🎯 Marking first investment celebration as completed for user: ${userID}`);
    
    // Update user's celebration viewed timestamp
    const { data, error } = await supabase
      .from('users')
      .update({ 
        first_investment_celebration_viewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userID)
      .select('user_id, first_investment_celebration_viewed_at')
      .single();

    if (error) {
      console.error('Error marking celebration as completed:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to mark celebration as completed'
      });
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    console.log(`✅ Celebration marked as completed for user ${userID} at ${data.first_investment_celebration_viewed_at}`);

    return res.json({
      success: true,
      message: 'First investment celebration marked as completed',
      data: {
        userID: data.user_id,
        celebrationViewedAt: data.first_investment_celebration_viewed_at
      }
    });

  } catch (error) {
    console.error('❌ Mark celebration completed error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router; 