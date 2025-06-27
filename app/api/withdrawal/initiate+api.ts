import express from 'express';
const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { userID, amount, provider } = req.body;

    if (!userID || !amount || !provider) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Mock withdrawal initiation
    const mockWithdrawal = {
      withdrawalID: `withdrawal_${Date.now()}`,
      userID,
      amount: parseFloat(amount),
      provider, // 'moonpay' or 'flutterwave'
      fee: parseFloat(amount) * 0.01, // 1% fee
      netAmount: parseFloat(amount) * 0.99,
      status: 'processing',
      algorandTxID: `ALGO_WITHDRAW_${Date.now()}`,
      estimatedArrival: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      createdAt: new Date().toISOString(),
    };

    return res.json({
      success: true,
      message: 'Withdrawal initiated successfully',
      withdrawal: mockWithdrawal,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;