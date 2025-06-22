import express from 'express';
import { supabase } from '../../../utils/supabase';
import { moonPayService } from '../../../utils/moonpay';
import { verifyJWT } from '../../../utils/auth';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

interface DepositRequest {
  amountUSD: number;
  targetCurrency: 'usdca';
}

router.post('/', async (req, res) => {
  try {
    const { amountUSD, targetCurrency = 'usdca' }: DepositRequest = req.body;
    const authHeader = req.headers.authorization;

    // Validate request
    if (!amountUSD || amountUSD < 1 || amountUSD > 10000) {
      return res.status(400).json({
        error: 'Invalid amount. Must be between $1 and $10,000.'
      });
    }

    if (targetCurrency !== 'usdca') {
      return res.status(400).json({
        error: 'Only USDCa is supported as target currency.'
      });
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authorization token required' });
    }

    // Extract and verify JWT token
    const token = authHeader.split(' ')[1];
    const decoded = verifyJWT(token);
    
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid user token' });
    }
    
    console.log('🔐 Authenticated user:', decoded.userId);
    
    // Get user from database
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('user_id, phone_number')
      .eq('user_id', decoded.userId)
      .single();

    if (userError || !user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Get user's wallet address
    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('wallet_id, algorand_address')
      .eq('user_id', user.user_id)
      .single();

    if (walletError || !wallet) {
      return res.status(400).json({ 
        error: 'User wallet not found. Please create a wallet first.' 
      });
    }

    // Calculate fees and estimated USDCa
    const feeCalculation = moonPayService.calculateEstimatedUSDCa(amountUSD);

    // Create deposit record
    const depositId = uuidv4();
    const externalTransactionId = `cultivest_${depositId}`;

    const { data: deposit, error: depositError } = await supabase
      .from('deposits')
      .insert({
        deposit_id: depositId,
        user_id: user.user_id,
        wallet_id: wallet.wallet_id,
        amount_usd: amountUSD,
        fees_paid: feeCalculation.totalFees,
        status: 'pending_payment',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
      })
      .select()
      .single();

    if (depositError) {
      console.error('Failed to create deposit record:', depositError);
      return res.status(500).json({ error: 'Failed to initiate deposit' });
    }

    // Generate MoonPay widget URL
    const moonpayUrl = moonPayService.generateWidgetUrl({
      walletAddress: wallet.algorand_address,
      currencyCode: 'algo',
      baseCurrencyAmount: amountUSD,
      redirectURL: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/funding/success`,
      externalTransactionId
    });

    // Update deposit with MoonPay URL
    await supabase
      .from('deposits')
      .update({ moonpay_url: moonpayUrl })
      .eq('deposit_id', depositId);

    return res.json({
      success: true,
      moonpayUrl,
      transactionId: depositId,
      estimatedUSDCa: feeCalculation.estimatedUSDCa,
      conversionRate: `1 USD ≈ ${(feeCalculation.estimatedUSDCa / amountUSD).toFixed(3)} USDCa (after fees)`,
      fees: {
        moonpayFee: feeCalculation.moonpayFee,
        conversionFee: feeCalculation.conversionFee,
        total: feeCalculation.totalFees
      },
      message: 'Deposit initiated. Complete payment with MoonPay to receive USDCa.'
    });

  } catch (error) {
    console.error('Deposit initiation error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;