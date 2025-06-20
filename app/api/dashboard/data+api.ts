import express from 'express';
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const userID = req.query.userID;

    if (!userID) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Mock dashboard data
    const mockDashboard = {
      userID,
      balance: 5.00,
      dailyYield: 0.003,
      moneyTree: {
        leaves: 5,
        growthStage: 'growing',
        nextMilestone: 10.00,
      },
      badges: [
        {
          badgeID: 'first_investor',
          name: 'First Investor!',
          description: 'Made your first investment',
          awardedAt: '2024-01-15T00:00:00Z',
        },
      ],
      stats: {
        totalInvested: 5.00,
        totalYieldEarned: 0.015,
        daysActive: 5,
        investmentStreak: 1,
      },
      weeklyProgress: [
        { day: 'Mon', value: 80 },
        { day: 'Tue', value: 65 },
        { day: 'Wed', value: 90 },
        { day: 'Thu', value: 75 },
        { day: 'Fri', value: 85 },
        { day: 'Sat', value: 95 },
        { day: 'Sun', value: 70 },
      ],
    };

    return res.json({
      success: true,
      dashboard: mockDashboard,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;