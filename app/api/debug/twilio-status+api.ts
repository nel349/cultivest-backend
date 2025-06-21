import express from 'express';
import { getTwilioStatus, isTwilioConfigured } from '../../../utils/sms';

const router = express.Router();

router.get('/', (req, res) => {
  const status = getTwilioStatus();
  
  return res.json({
    success: true,
    twilioStatus: status,
    isConfigured: isTwilioConfigured(),
    message: isTwilioConfigured() 
      ? 'Twilio is properly configured and ready to send SMS'
      : 'Twilio is not configured. SMS will fall back to console logging.',
    instructions: isTwilioConfigured() 
      ? 'SMS will be sent via Twilio'
      : 'To enable SMS: Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER in .env file'
  });
});

export default router;