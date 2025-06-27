import express from 'express';
import { supabase, handleDatabaseError, testDatabaseConnection } from '../../../utils/supabase';
import { sendOTPSMS } from '../../../utils/sms';

const router = express.Router();

// Generate a random 6-digit OTP
const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Validate phone number format (enhanced validation)
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

// Validate country code (ISO 3166-1 alpha-2 and alpha-3)
const isValidCountryCode = (country: string): boolean => {
  // Support both 2-letter (US, NG) and 3-letter (USA, NGA) codes
  const validCountries2 = ['US', 'NG', 'AR', 'GB', 'CA', 'AU', 'DE', 'FR', 'IN', 'BR'];
  const validCountries3 = ['USA', 'NGA', 'ARG', 'GBR', 'CAN', 'AUS', 'DEU', 'FRA', 'IND', 'BRA'];
  const upperCountry = country.toUpperCase();
  return validCountries2.includes(upperCountry) || validCountries3.includes(upperCountry);
};

router.post('/', async (req, res) => {
  try {
    const { phoneNumber, name, country } = req.body;

    // Validate required fields
    if (!phoneNumber || !name || !country) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: phoneNumber, name, country'
      });
    }

    // Validate input formats
    if (!isValidPhoneNumber(phoneNumber)) {
      console.error(`❌ Invalid phone number format: ${phoneNumber}`);
      return res.status(400).json({
        success: false,
        error: `Invalid phone number format: ${phoneNumber}. Expected format: +1XXXXXXXXXX for US/Canada or +234XXXXXXXX for Nigeria`
      });
    }

    if (!isValidCountryCode(country)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid country code'
      });
    }

    if (name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Name must be at least 2 characters long'
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

    // Check if user already exists
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('user_id, phone_number')
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

    let userId: string;

    if (existingUser) {
      // User exists, use existing user ID
      userId = existingUser.user_id;
      console.log('User already exists, proceeding with OTP for existing user:', phoneNumber);
    } else {
      // Create new user
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          phone_number: phoneNumber,
          name: name.trim(),
          country: country.toUpperCase(),
          kyc_status: 'pending'
        })
        .select('user_id')
        .single();

      if (createError) {
        console.error('Error creating user:', createError);
        const dbError = handleDatabaseError(createError);
        return res.status(500).json({
          success: false,
          error: 'Failed to create user',
          details: dbError.error
        });
      }

      userId = newUser.user_id;
      console.log('New user created:', phoneNumber, 'with ID:', userId);
    }

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
    console.log(`📱 Sending OTP for ${phoneNumber}: ${otpCode} (expires at ${expiresAt})`);
    const smsResult = await sendOTPSMS(phoneNumber, otpCode);
    
    if (!smsResult.success) {
      console.warn(`⚠️ SMS sending failed: ${smsResult.error}`);
      
      // Check if this is a real SMS provider failure or just mock mode
      const isMockMode = smsResult.provider === 'console' || smsResult.provider === 'mock';
      
      if (isMockMode) {
        // In development/mock mode, continue with console logging
        return res.json({
          success: true,
          message: 'OTP generated successfully (Development Mode)',
          userID: userId,
          otpSent: false,
          smsProvider: smsResult.provider,
          warning: 'SMS service in development mode - check console for OTP code',
          developmentMode: true,
          consoleOTP: otpCode // Only in development
        });
      } else {
        // Real SMS failure - return error to user
        return res.status(400).json({
          success: false,
          error: `Failed to send SMS: ${smsResult.error}`,
          userCreated: true, // User was created but SMS failed
          canRetry: true
        });
      }
    } else {
      console.log(`✅ SMS sent via ${smsResult.provider} - MessageID: ${smsResult.messageId}`);
    }

    return res.json({
      success: true,
      message: 'OTP sent successfully',
      userID: userId,
      otpSent: true,
      smsProvider: smsResult.provider,
      // In development, include OTP for testing (REMOVE IN PRODUCTION)
      ...(process.env.NODE_ENV === 'development' && { otp: otpCode })
    });

  } catch (error) {
    console.error('Signup endpoint error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router;