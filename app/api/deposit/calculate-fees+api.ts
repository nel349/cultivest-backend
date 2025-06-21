import express from 'express';
import { moonPayService } from '../../../utils/moonpay';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { amountUSD } = req.query;

    if (!amountUSD || isNaN(Number(amountUSD))) {
      return res.status(400).json({
        error: 'Invalid amountUSD parameter. Must be a valid number.'
      });
    }

    const amount = Number(amountUSD);

    if (amount < 1 || amount > 10000) {
      return res.status(400).json({
        error: 'Amount must be between $1 and $10,000.'
      });
    }

    // Calculate fees and estimated USDCa
    const feeCalculation = moonPayService.calculateEstimatedUSDCa(amount);

    // Get current ALGO price for additional info
    const algoPrice = await moonPayService.getAlgoPrice();
    const estimatedAlgo = amount / algoPrice;

    return res.json({
      success: true,
      amountUSD: amount,
      fees: {
        moonpayFee: feeCalculation.moonpayFee,
        conversionFee: feeCalculation.conversionFee,
        total: feeCalculation.totalFees,
        percentage: ((feeCalculation.totalFees / amount) * 100).toFixed(2) + '%'
      },
      estimatedOutput: {
        usdcaAmount: feeCalculation.estimatedUSDCa,
        algoAmount: estimatedAlgo,
        conversionRate: `1 USD ≈ ${(feeCalculation.estimatedUSDCa / amount).toFixed(3)} USDCa`
      },
      breakdown: {
        inputUSD: amount,
        afterMoonPayFee: amount - feeCalculation.moonpayFee,
        afterConversionFee: amount - feeCalculation.totalFees,
        finalUSDCa: feeCalculation.estimatedUSDCa
      },
      currentPrices: {
        algoUSD: algoPrice
      }
    });

  } catch (error) {
    console.error('Fee calculation error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;