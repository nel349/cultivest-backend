import express from 'express';
const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { userID, otpCode } = req.body;

    if (!userID || !otpCode) {
      return res.status(400).json({ error: 'Missing userID or otpCode' });
    }

    // Mock OTP verification (in production, verify against stored OTP)
    if (otpCode === '123456') {
      const mockAuthToken = `auth_token_${Date.now()}`;
      
      return res.json({
        success: true,
        message: 'OTP verified successfully3',
        authToken: mockAuthToken,
        user: {
          userID,
          verified: true,
          walletCreated: true,
        },
      });
    } else {
      return res.status(401).json({ error: 'Invalid OTP code' });
    }
  } catch (error) {
    // Log the actual error to your Expo terminal/debugger console
    console.error('Error in verify-otp+api:', error);

    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;