import express from 'express';
const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { phoneNumber, name, country } = req.body;

    // Validate required fields
    if (!phoneNumber || !name || !country) {
      return res.status(400).json({
        error: 'Missing required fields: phoneNumber, name, country'
      });
    }

    // Mock user creation and OTP sending
    const mockUser = {
      userID: `user_${Date.now()}`,
      phoneNumber,
      name,
      country,
      kycStatus: 'pending',
      otpSent: true,
      otpCode: '123456', // In production, this would be generated and sent via SMS
    };

    return res.json({
      success: true,
      message: 'OTP sent successfully',
      userID: mockUser.userID,
      otpSent: true,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;