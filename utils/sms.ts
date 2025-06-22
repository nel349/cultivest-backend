import twilio from 'twilio';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

// Check if Twilio credentials are real (not placeholder values)
const isRealCredentials = accountSid && 
  authToken && 
  twilioPhoneNumber &&
  accountSid.startsWith('AC') && 
  authToken.length > 20 &&
  twilioPhoneNumber.startsWith('+');

// Validate Twilio configuration
if (!isRealCredentials) {
  console.warn('⚠️ Twilio credentials not configured or using placeholder values. SMS will use mock mode.');
  console.warn('Required: Real TWILIO_ACCOUNT_SID (starts with AC), TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER');
}

// Initialize Twilio client (only if real credentials are available)
const twilioClient = isRealCredentials ? twilio(accountSid!, authToken!) : null;

export interface SendSMSResult {
  success: boolean;
  messageId?: string;
  error?: string;
  provider: 'twilio' | 'mock' | 'console';
}

/**
 * Send OTP SMS to a phone number
 * Falls back to console logging if Twilio is not configured
 */
export const sendOTPSMS = async (
  phoneNumber: string, 
  otpCode: string
): Promise<SendSMSResult> => {
  try {
    // Validate phone number format
    if (!phoneNumber || !phoneNumber.startsWith('+')) {
      return {
        success: false,
        error: 'Invalid phone number format. Must include country code with +',
        provider: 'mock'
      };
    }

    // Validate OTP format
    if (!otpCode || !/^\d{6}$/.test(otpCode)) {
      return {
        success: false,
        error: 'Invalid OTP format. Must be 6 digits.',
        provider: 'mock'
      };
    }

    // Prepare SMS message
    const message = `Your Cultivest verification code is: ${otpCode}. This code expires in 10 minutes. Don't share this code with anyone.`;

    // If Twilio is configured, send real SMS
    if (twilioClient && twilioPhoneNumber) {
      console.log(`📱 Sending SMS to ${phoneNumber} via Twilio...`);
      
      const result = await twilioClient.messages.create({
        body: message,
        from: twilioPhoneNumber,
        to: phoneNumber
      });

      console.log(`✅ SMS sent successfully! Message SID: ${result.sid}`);
      
      return {
        success: true,
        messageId: result.sid,
        provider: 'twilio'
      };
    } else {
      // Fallback to console logging for development/testing
      console.log('📱 TWILIO NOT CONFIGURED - Logging OTP to console:');
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`📞 TO: ${phoneNumber}`);
      console.log(`💬 MESSAGE: ${message}`);
      console.log(`🔢 OTP: ${otpCode}`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      
      return {
        success: true,
        messageId: 'mock_' + Date.now(),
        provider: 'mock'
      };
    }

  } catch (error) {
    console.error('❌ SMS sending failed:', error);
    
    // Log the OTP to console as fallback
    console.log('📱 FALLBACK - Logging OTP to console due to SMS failure:');
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📞 TO: ${phoneNumber}`);
    console.log(`🔢 OTP: ${otpCode}`);
    console.log(`❌ ERROR: ${(error as Error).message}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    
    return {
      success: false,
      error: (error as Error).message,
      provider: 'console' // Indicate fallback to console logging
    };
  }
};

/**
 * Check if Twilio is properly configured
 */
export const isTwilioConfigured = (): boolean => {
  return isRealCredentials || false;
};

/**
 * Get Twilio configuration status for debugging
 */
export const getTwilioStatus = () => {
  return {
    configured: isTwilioConfigured(),
    mode: isTwilioConfigured() ? 'real_sms' : 'mock_mode',
    accountSid: accountSid ? (accountSid.startsWith('AC') ? `${accountSid.substring(0, 8)}...` : 'placeholder') : 'missing',
    authToken: authToken ? (authToken.length > 20 ? 'configured' : 'placeholder') : 'missing',
    phoneNumber: twilioPhoneNumber ? (twilioPhoneNumber.startsWith('+') ? twilioPhoneNumber : 'placeholder') : 'missing'
  };
};