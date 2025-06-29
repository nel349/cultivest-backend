import express from 'express';
import { supabase, handleDatabaseError, testDatabaseConnection } from '../../../utils/supabase';
import { sendOTPSMS } from '../../../utils/sms';

const router = express.Router();

// Generate a random 6-digit OTP (reused from signup)
const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Validate phone number format (reused from signup)
const isValidPhoneNumber = (phone: string): boolean => {
  // Remove all non-digit characters except +
  const cleanPhone = phone.replace(/[^\d+]/g, '');
  
  // Must start with + and have a country code
  if (!cleanPhone.startsWith('+')) {
    return false;
  }
  
  // Check for common patterns
  if (cleanPhone.includes('XXXX') || cleanPhone.includes('****')) {
    return false; // Masked/hidden numbers
  }
  
  // US/Canada numbers: +1 followed by 10 digits
  if (cleanPhone.startsWith('+1')) {
    return /^\+1\d{10}$/.test(cleanPhone);
  }
  
  // Nigeria numbers: +234 followed by 7-10 digits  
  if (cleanPhone.startsWith('+234')) {
    return /^\+234\d{7,10}$/.test(cleanPhone);
  }
  
  // Other international: +[country code][7-15 digits]
  return /^\+[1-9]\d{6,18}$/.test(cleanPhone);
};

router.post('/', async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        error: 'Phone number is required'
      });
    }

    // Validate phone number format
    if (!isValidPhoneNumber(phoneNumber)) {
      console.error(`❌ Invalid phone number format: ${phoneNumber}`);
      return res.status(400).json({
        success: false,
        error: `Invalid phone number format: ${phoneNumber}. Expected format: +1XXXXXXXXXX for US/Canada or +234XXXXXXXX for Nigeria`
      });
    }

    // Test database connection
    const dbConnected = await testDatabaseConnection();
    if (!dbConnected) {
      return res.status(503).json({
        success: false,
        error: 'Database connection failed'
      });
    }

    // Check if user exists
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('user_id, phone_number, name')
      .eq('phone_number', phoneNumber)
      .single();

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('Error checking existing user:', checkError);
      const dbError = handleDatabaseError(checkError);
      return res.status(500).json({
        success: false,
        error: 'Failed to check user existence',
        details: dbError.error
      });
    }

    if (!existingUser) {
      return res.status(404).json({
        success: false,
        error: 'No account found with this phone number. Please sign up first.',
        shouldSignup: true
      });
    }

    const userId = existingUser.user_id;
    console.log('User found for login:', phoneNumber, 'with ID:', userId);

    // Generate OTP
    const otpCode = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

    // Clean up any existing OTP sessions for this phone number
    await supabase
      .from('otp_sessions')
      .delete()
      .eq('phone_number', phoneNumber);

    // Create new OTP session
    const { error: otpError } = await supabase
      .from('otp_sessions')
      .insert({
        phone_number: phoneNumber,
        otp_code: otpCode,
        expires_at: expiresAt.toISOString(),
        user_id: userId,
        attempts: 0,
        verified: false
      });

    if (otpError) {
      console.error('Error creating OTP session:', otpError);
      const dbError = handleDatabaseError(otpError);
      return res.status(500).json({
        success: false,
        error: 'Failed to create OTP session',
        details: dbError.error
      });
    }

    // Send OTP via SMS (Twilio or console fallback)
    console.log(`📱 Sending login OTP for ${phoneNumber}: ${otpCode} (expires at ${expiresAt})`);
    const smsResult = await sendOTPSMS(phoneNumber, otpCode);
    
    if (!smsResult.success) {
      console.warn(`⚠️ SMS sending failed: ${smsResult.error}`);
      
      // Check if this is a real SMS provider failure or just mock mode
      const isMockMode = smsResult.provider === 'console' || smsResult.provider === 'mock';
      
      if (isMockMode) {
        // In development/mock mode, continue with console logging
        return res.json({
          success: true,
          message: 'Login OTP generated successfully (Development Mode)',
          userID: userId,
          userName: existingUser.name,
          otpSent: false,
          smsProvider: smsResult.provider,
          warning: 'SMS service in development mode - check console for OTP code',
          developmentMode: true,
          consoleOTP: otpCode, // Include OTP in response for development
          otpCode: otpCode // Also include as otpCode for auto-fill
        });
      } else {
        // Real SMS failure - return error to user
        return res.status(400).json({
          success: false,
          error: 'Failed to send OTP SMS. Please try again.',
          details: smsResult.error
        });
      }
    }

    // SMS sent successfully
    const isDev = process.env.NODE_ENV === 'development';
    return res.json({
      success: true,
      message: 'Login OTP sent successfully',
      userID: userId,
      userName: existingUser.name,
      otpSent: true,
      smsProvider: smsResult.provider,
      // Include OTP in development mode for auto-fill testing
      ...(isDev && { 
        consoleOTP: otpCode,
        otpCode: otpCode,
        developmentMode: true 
      })
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Internal server error' 
    });
  }
});

export default router;