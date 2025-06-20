import express from 'express';
const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { userID, kycData } = req.body;

    if (!userID) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Mock MoonPay KYC-light processing
    const mockKycResult = {
      status: 'approved',
      kycLevel: 'light',
      monthlyLimit: 1000,
      verificationTime: new Date().toISOString(),
    };

    return res.json({
      success: true,
      message: 'KYC verification completed',
      kyc: mockKycResult,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;