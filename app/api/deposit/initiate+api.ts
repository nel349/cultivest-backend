import express from 'express';
const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { userID, amount, currency, provider } = req.body;

    if (!userID || !amount || !currency || !provider) {
      return res.status(400).json({
        error: 'Missing required fields: userID, amount, currency, provider'
      });
    }

    // Mock deposit initiation
    const mockDeposit = {
      depositID: `deposit_${Date.now()}`,
      userID,
      amount: parseFloat(amount),
      currency,
      provider, // 'moonpay' or 'flutterwave'
      status: 'initiated',
      paymentUrl: `https://mock-${provider}.com/pay/${Date.now()}`,
      fee: parseFloat(amount) * 0.005, // 0.5% fee
      estimatedUSDCa: parseFloat(amount) * 0.995,
      createdAt: new Date().toISOString(),
    };

    return res.json({
      success: true,
      message: 'Deposit initiated successfully',
      deposit: mockDeposit,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;