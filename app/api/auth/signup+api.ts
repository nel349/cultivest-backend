import express from 'express';
import { supabase, handleDatabaseError, testDatabaseConnection } from '../../../utils/supabase';

const router = express.Router();

// Generate a random 6-digit OTP
const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Validate phone number format (basic validation)
const isValidPhoneNumber = (phone: string): boolean => {
  // Basic international phone number validation
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  return phoneRegex.test(phone.replace(/\s+/g, ''));
};

// Validate country code (ISO 3166-1 alpha-3)
const isValidCountryCode = (country: string): boolean => {
  const validCountries = ['USA', 'NGA', 'ARG', 'GBR', 'CAN', 'AUS', 'DEU', 'FRA', 'IND', 'BRA'];
  return validCountries.includes(country.toUpperCase());
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
      return res.status(400).json({
        success: false,
        error: 'Invalid phone number format'
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

    // TODO: Send actual SMS with OTP code
    // For now, log it to console (REMOVE IN PRODUCTION)
    console.log(`OTP for ${phoneNumber}: ${otpCode} (expires at ${expiresAt})`);

    return res.json({
      success: true,
      message: 'OTP sent successfully',
      userID: userId,
      otpSent: true,
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