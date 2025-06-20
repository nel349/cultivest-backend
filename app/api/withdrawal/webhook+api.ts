import express from 'express';
const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { withdrawalID, status, fiatTxID } = req.body;

    // Mock withdrawal webhook processing
    const mockResult = {
      withdrawalID,
      status,
      fiatTxID,
      processedAt: new Date().toISOString(),
      emailSent: status === 'completed',
    };

    return res.json({
      success: true,
      message: 'Withdrawal webhook processed',
      result: mockResult,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;