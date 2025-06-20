import express from 'express';
const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { userID, transactionAmount, merchantName } = req.body;

    if (!userID || !transactionAmount) {
      return res.status(400).json({ error: 'Missing userID or transactionAmount' });
    }

    // Mock Claude 4 round-up suggestion
    const amount = parseFloat(transactionAmount);
    const roundedAmount = Math.ceil(amount);
    const roundUpAmount = roundedAmount - amount;

    const mockSuggestion = {
      userID,
      originalTransaction: {
        amount,
        merchantName: merchantName || 'Coffee Shop',
      },
      roundUpAmount: parseFloat(roundUpAmount.toFixed(2)),
      suggestedInvestment: {
        pool: 'Tinyman USDCa Pool',
        apy: 2.5,
        estimatedDailyYield: (roundUpAmount * 0.025 / 365).toFixed(6),
      },
      message: `Round up your $${amount.toFixed(2)} purchase to $${roundedAmount.toFixed(2)} and invest the $${roundUpAmount.toFixed(2)} difference!`,
      confidence: 0.85,
      generatedAt: new Date().toISOString(),
    };

    return res.json({
      success: true,
      suggestion: mockSuggestion,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;