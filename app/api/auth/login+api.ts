import express from 'express';
const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    // Mock login - send OTP
    const mockUserID = `user_${phoneNumber.replace(/\D/g, '')}`;
    
    return res.json({
      success: true,
      message: 'OTP sent for login',
      userID: mockUserID,
      otpSent: true,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;