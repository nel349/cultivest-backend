import express from 'express';
import { supabase } from '../../../utils/supabase';
import { generateWallet, getUserWallet } from '../../../utils/wallet';

const router = express.Router();

/**
 * Create or get a test user for smart contract testing
 * This is a development helper endpoint
 */
router.post('/', async (req, res) => {
  try {
    const testUser = {
      phoneNumber: '+15551234567',
      name: 'Smart Contract Test User',
      country: 'USA'
    };

    console.log('🧪 Creating/finding test user for smart contracts...');

    // Check if test user already exists
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('user_id, phone_number, name')
      .eq('phone_number', testUser.phoneNumber)
      .single();

    let userId: string;

    if (existingUser && !checkError) {
      // Use existing user
      userId = existingUser.user_id;
      console.log('✅ Found existing test user:', userId);
    } else {
      // Create new test user
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          phone_number: testUser.phoneNumber,
          name: testUser.name,
          country: testUser.country,
          kyc_status: 'approved' // Auto-approve for testing
        })
        .select('user_id')
        .single();

      if (createError) {
        console.error('❌ Error creating test user:', createError);
        return res.status(500).json({
          success: false,
          error: 'Failed to create test user'
        });
      }

      userId = newUser.user_id;
      console.log('✅ Created new test user:', userId);
    }

    // Check if user has a wallet
    const existingWallet = await getUserWallet(userId);
    
    if (!existingWallet) {
      // Create wallet for the test user
      console.log('💰 Creating wallet for test user...');
      const walletResult = await generateWallet(userId);
      
      if (!walletResult.success) {
        return res.status(500).json({
          success: false,
          error: `Failed to create wallet: ${walletResult.error}`
        });
      }

      console.log('✅ Test wallet created successfully');
    } else {
      console.log('✅ Test user already has wallet');
    }

    // Get the final wallet info
    const wallet = await getUserWallet(userId, true); // Include live balance

    return res.json({
      success: true,
      data: {
        userId: userId,
        name: testUser.name,
        phone: testUser.phoneNumber,
        wallet: wallet ? {
          address: wallet.algorandAddress,
          balance: wallet.onChainBalance || wallet.balance
        } : null,
        message: 'Test user ready for smart contract testing'
      }
    });

  } catch (error) {
    console.error('❌ Error creating test user:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

// Get existing test user info
router.get('/', async (req, res) => {
  try {
    const { data: testUser, error } = await supabase
      .from('users')
      .select('user_id, phone_number, name, country')
      .eq('phone_number', '+15551234567')
      .single();

    if (error || !testUser) {
      return res.json({
        success: false,
        message: 'No test user found. Use POST to create one.'
      });
    }

    const wallet = await getUserWallet(testUser.user_id, true);

    return res.json({
      success: true,
      data: {
        userId: testUser.user_id,
        name: testUser.name,
        phone: testUser.phone_number,
        wallet: wallet ? {
          address: wallet.algorandAddress,
          balance: wallet.onChainBalance || wallet.balance
        } : null
      }
    });

  } catch (error) {
    console.error('❌ Error getting test user:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

export default router; 