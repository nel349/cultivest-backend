import express from 'express';
import { supabase } from '../../../utils/supabase';

const router = express.Router();

// POST /api/debug/set-auto-fund-preference
router.post('/', async (req, res) => {
  try {
    const { userID, autoFundOnFailure } = req.body;
    
    // Validation
    if (!userID) {
      return res.status(400).json({
        success: false,
        error: 'userID is required'
      });
    }
    
    if (typeof autoFundOnFailure !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'autoFundOnFailure must be a boolean'
      });
    }
    
    // Only allow in development mode
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        success: false,
        error: 'Auto-fund preference only available in development mode'
      });
    }
    
    console.log(`🏁 Setting auto-fund preference for user ${userID}: ${autoFundOnFailure}`);
    
    // Store preference in user_preferences table (or create if doesn't exist)
    const { error } = await supabase
      .from('user_preferences')
      .upsert({
        user_id: userID,
        auto_fund_on_failure: autoFundOnFailure,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      })
      .select()
      .single();
    
    if (error) {
      console.error('Database error storing auto-fund preference:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to store preference',
        details: error.message
      });
    }
    
    return res.json({
      success: true,
      message: `Auto-fund preference set to ${autoFundOnFailure} for development mode`,
      data: {
        userID,
        autoFundOnFailure,
        stored: true
      }
    });
    
  } catch (error) {
    console.error('❌ Set auto-fund preference error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to set auto-fund preference',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/debug/set-auto-fund-preference (get current preference)
router.get('/', async (req, res) => {
  try {
    const { userID } = req.query;
    
    if (!userID) {
      return res.status(400).json({
        success: false,
        error: 'userID query parameter is required'
      });
    }
    
    const { data, error } = await supabase
      .from('user_preferences')
      .select('auto_fund_on_failure')
      .eq('user_id', userID)
      .single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Database error getting auto-fund preference:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get preference'
      });
    }
    
    const autoFundOnFailure = data?.auto_fund_on_failure || false;
    
    return res.json({
      success: true,
      data: {
        userID,
        autoFundOnFailure,
        devModeOnly: process.env.NODE_ENV !== 'production'
      }
    });
    
  } catch (error) {
    console.error('❌ Get auto-fund preference error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get auto-fund preference'
    });
  }
});

export default router; 