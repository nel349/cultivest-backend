import express from 'express';
const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { depositID, status, transactionHash } = req.body;

    // Mock webhook processing
    if (status === 'completed') {
      const mockResult = {
        depositID,
        status: 'completed',
        usdcaTransferred: true,
        algorandTxID: `ALGO_TX_${Date.now()}`,
        processedAt: new Date().toISOString(),
      };

      return res.json({
        success: true,
        message: 'Deposit processed successfully',
        result: mockResult,
      });
    }

    return res.json({
      success: true,
      message: 'Webhook received',
      status,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router; 