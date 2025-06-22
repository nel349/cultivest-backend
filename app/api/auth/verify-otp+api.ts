import express from 'express';
import { supabase, handleDatabaseError } from '../../../utils/supabase';
import { generateWallet, getUserWallet } from '../../../utils/wallet';
import jwt from 'jsonwebtoken';

const router = express.Router();

// Generate JWT token
const generateJWT = (userId: string, phoneNumber: string): string => {
  const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
  return jwt.sign(
    { 
      userId, 
      phoneNumber,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
    },
    jwtSecret
  );
};

router.post('/', async (req, res) => {
  try {
    console.log('🔐 OTP Verification Request:', {
      body: req.body,
      headers: req.headers['content-type']
    });
    
    const { userID, otpCode } = req.body;

    // Validate required fields
    if (!userID || !otpCode) {
      console.error('❌ Missing required fields:', { userID: !!userID, otpCode: !!otpCode });
      return res.status(400).json({
        success: false,
        error: 'Missing userID or otpCode'
      });
    }

    // Validate OTP format (6 digits)
    if (!/^\d{6}$/.test(otpCode)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid OTP format. Must be 6 digits.'
      });
    }

    // Find valid OTP session for this user
    console.log(`🔍 Looking for OTP session for user: ${userID}, code: ${otpCode}`);
    
    const { data: otpSession, error: otpError } = await supabase
      .from('otp_sessions')
      .select('*')
      .eq('user_id', userID)
      .eq('verified', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    console.log('🔍 OTP Session Query Result:', {
      found: !!otpSession,
      error: otpError?.message,
      sessionData: otpSession ? {
        otp_code: otpSession.otp_code,
        expires_at: otpSession.expires_at,
        attempts: otpSession.attempts,
        verified: otpSession.verified
      } : null
    });

    if (otpError || !otpSession) {
      console.error('No valid OTP session found:', otpError);
      return res.status(401).json({
        success: false,
        error: 'No valid OTP session found or OTP has expired'
      });
    }

    // Check if too many attempts
    if (otpSession.attempts >= 5) {
      return res.status(429).json({
        success: false,
        error: 'Too many OTP attempts. Please request a new OTP.'
      });
    }

    // Increment attempt count
    const { error: incrementError } = await supabase
      .from('otp_sessions')
      .update({ attempts: otpSession.attempts + 1 })
      .eq('session_id', otpSession.session_id);

    if (incrementError) {
      console.error('Error incrementing attempts:', incrementError);
    }

    // Verify OTP code
    if (otpSession.otp_code !== otpCode) {
      return res.status(401).json({
        success: false,
        error: 'Invalid OTP code',
        attemptsRemaining: Math.max(0, 5 - (otpSession.attempts + 1))
      });
    }

    // Mark OTP as verified
    const { error: verifyError } = await supabase
      .from('otp_sessions')
      .update({ verified: true })
      .eq('session_id', otpSession.session_id);

    if (verifyError) {
      console.error('Error marking OTP as verified:', verifyError);
      const dbError = handleDatabaseError(verifyError);
      return res.status(500).json({
        success: false,
        error: 'Failed to verify OTP',
        details: dbError.error
      });
    }

    // Get user details
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('user_id', userID)
      .single();

    if (userError || !user) {
      console.error('Error fetching user:', userError);
      const dbError = handleDatabaseError(userError);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch user details',
        details: dbError.error
      });
    }

    // Check if user has a wallet and create one if they don't
    let wallet = await getUserWallet(userID);
    let hasWallet = !!wallet;

    // Auto-create wallet for verified users
    if (!hasWallet) {
      console.log(`🔐 Creating wallet for newly verified user: ${userID}`);
      const walletResult = await generateWallet(userID);
      
      if (walletResult.success) {
        wallet = await getUserWallet(userID);
        hasWallet = !!wallet;
        console.log(`✅ Wallet created successfully: ${wallet?.algorandAddress}`);
      } else {
        console.warn(`⚠️ Wallet creation failed: ${walletResult.error}`);
        // Continue anyway - wallet creation failure shouldn't block login
      }
    }

    // Generate JWT token
    const authToken = generateJWT(user.user_id, user.phone_number);

    // Clean up expired OTP sessions for this user
    await supabase
      .from('otp_sessions')
      .delete()
      .eq('user_id', userID)
      .lt('expires_at', new Date().toISOString());

    return res.json({
      success: true,
      message: 'OTP verified successfully',
      authToken,
      user: {
        userID: user.user_id,
        phoneNumber: user.phone_number,
        name: user.name,
        country: user.country,
        kycStatus: user.kyc_status,
        verified: true,
        walletCreated: hasWallet,
        walletAddress: wallet?.algorandAddress || null
      }
    });

  } catch (error) {
    console.error('Error in verify-otp endpoint:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router;