import express from 'express';
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const userID = req.query.userID as string;

    if (!userID) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Mock wallet balance data
    const mockBalance = {
      userID,
      walletAddress: 'ALGO_MOCK_ADDRESS_' + userID.slice(-8),
      balanceUSDCa: 5.00,
      balanceAlgo: 0.1,
      lastUpdated: new Date().toISOString(),
    };

    return res.json({
      success: true,
      balance: mockBalance,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;