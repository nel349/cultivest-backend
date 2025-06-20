import express from 'express';
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const userID = req.query.userID;

    if (!userID) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Mock investment positions
    const mockPositions = [
      {
        positionID: 'position_1',
        userID,
        poolID: 'tinyman_usdca_pool',
        investedAmountUSDCa: 5.00,
        currentAPY: 2.5,
        totalYieldEarned: 0.015,
        startDate: '2024-01-15T00:00:00Z',
        status: 'active',
      },
    ];

    return res.json({
      success: true,
      positions: mockPositions,
      totalInvested: 5.00,
      totalYieldEarned: 0.015,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;