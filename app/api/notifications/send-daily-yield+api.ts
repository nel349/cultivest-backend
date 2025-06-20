import express from 'express';
const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { userID, yieldAmount } = req.body;

    if (!userID || yieldAmount === undefined) {
      return res.status(400).json({ error: 'Missing userID or yieldAmount' });
    }

    // Mock push notification sending
    const mockNotification = {
      notificationID: `notif_${Date.now()}`,
      userID,
      type: 'daily_yield',
      title: 'Daily Yield Earned! 🌱',
      body: `You earned $${parseFloat(yieldAmount).toFixed(3)} today from your USDCa investment!`,
      data: {
        yieldAmount: parseFloat(yieldAmount),
        totalBalance: 5.00 + parseFloat(yieldAmount),
      },
      sentAt: new Date().toISOString(),
      delivered: true,
    };

    return res.json({
      success: true,
      message: 'Daily yield notification sent',
      notification: mockNotification,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;