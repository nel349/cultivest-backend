import express from 'express';
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const userID = req.query.userID;

    if (!userID) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Mock user profile data
    const mockProfile = {
      userID,
      name: 'Sarah Johnson',
      phoneNumber: '+1234567890',
      country: 'US',
      email: 'sarah.johnson@email.com',
      kycStatus: 'approved',
      currentBalanceUSDCa: 5.00,
      dailyYieldAccumulated: 0.003,
      moneyTreeLeaves: 5,
      totalWorkouts: 124,
      daysActive: 89,
      achievements: 12,
      joinedAt: '2024-01-15T00:00:00Z',
    };

    return res.json({
      success: true,
      profile: mockProfile,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;