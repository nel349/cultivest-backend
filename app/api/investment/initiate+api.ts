import express from 'express';
const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { userID, amount } = req.body;

    if (!userID || !amount) {
      return res.status(400).json({ error: 'Missing userID or amount' });
    }

    // Mock investment initiation
    const mockInvestment = {
      positionID: `position_${Date.now()}`,
      userID,
      poolID: 'tinyman_usdca_pool',
      investedAmountUSDCa: parseFloat(amount),
      currentAPY: 2.5,
      startDate: new Date().toISOString(),
      algorandTxID: `ALGO_INVEST_${Date.now()}`,
      status: 'active',
    };

    return res.json({
      success: true,
      message: 'Investment initiated successfully',
      investment: mockInvestment,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;