import express from 'express';
const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { userID, transactionID, email, transactionType } = req.body;

    if (!userID || !transactionID || !email || !transactionType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Mock email receipt sending
    const mockReceipt = {
      receiptID: `receipt_${Date.now()}`,
      userID,
      transactionID,
      email,
      transactionType, // 'deposit', 'investment', 'withdrawal'
      subject: `Cultivest Transaction Receipt - ${transactionType.toUpperCase()}`,
      sentAt: new Date().toISOString(),
      delivered: true,
    };

    return res.json({
      success: true,
      message: 'Transaction receipt sent successfully',
      receipt: mockReceipt,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;