import express from 'express';
import { supabase } from '../../../utils/supabase';

const router = express.Router();

router.get('/:transactionId', async (req, res) => {
  try {
    const { transactionId } = req.params;
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authorization token required' });
    }

    // Extract user from JWT (simplified - in production, decode and verify JWT)
    const token = authHeader.split(' ')[1];
    
    // Get deposit record with user verification
    const { data: deposit, error: depositError } = await supabase
      .from('deposits')
      .select(`
        deposit_id,
        user_id,
        amount_usd,
        amount_algo,
        amount_usdca,
        status,
        fees_paid,
        conversion_rate,
        moonpay_transaction_id,
        algorand_tx_id,
        error_message,
        created_at,
        updated_at,
        completed_at,
        expires_at
      `)
      .eq('deposit_id', transactionId)
      .eq('user_id', token) // Verify user owns this deposit
      .single();

    if (depositError || !deposit) {
      return res.status(404).json({ 
        error: 'Deposit not found or access denied' 
      });
    }

    // Calculate progress percentage
    const statusProgress = {
      'pending_payment': 25,
      'algo_received': 50,
      'converting': 75,
      'completed': 100,
      'failed': 0,
      'cancelled': 0
    };

    const progress = statusProgress[deposit.status as keyof typeof statusProgress] || 0;

    // Check if deposit has expired
    const isExpired = new Date() > new Date(deposit.expires_at);
    const effectiveStatus = isExpired && deposit.status === 'pending_payment' 
      ? 'expired' 
      : deposit.status;

    return res.json({
      success: true,
      deposit: {
        transactionId: deposit.deposit_id,
        status: effectiveStatus,
        progress,
        amountUSD: deposit.amount_usd,
        amountALGO: deposit.amount_algo,
        amountUSDCa: deposit.amount_usdca,
        fees: deposit.fees_paid,
        conversionRate: deposit.conversion_rate,
        moonpayTransactionId: deposit.moonpay_transaction_id,
        algorandTxId: deposit.algorand_tx_id,
        errorMessage: deposit.error_message,
        createdAt: deposit.created_at,
        updatedAt: deposit.updated_at,
        completedAt: deposit.completed_at,
        expiresAt: deposit.expires_at,
        isExpired
      },
      statusDescription: getStatusDescription(effectiveStatus),
      nextSteps: getNextSteps(effectiveStatus)
    });

  } catch (error) {
    console.error('Deposit status error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

function getStatusDescription(status: string): string {
  const descriptions = {
    'pending_payment': 'Waiting for payment completion in MoonPay',
    'algo_received': 'ALGO received, preparing for conversion',
    'converting': 'Converting ALGO to USDCa via Algorand DEX',
    'completed': 'USDCa successfully added to your wallet',
    'failed': 'Deposit failed - refund initiated',
    'cancelled': 'Deposit cancelled by user',
    'expired': 'Payment link expired - please initiate a new deposit'
  };
  return descriptions[status as keyof typeof descriptions] || 'Unknown status';
}

function getNextSteps(status: string): string[] {
  const nextSteps = {
    'pending_payment': [
      'Complete payment in the MoonPay window',
      'Wait for ALGO to arrive in your wallet',
      'Conversion to USDCa will happen automatically'
    ],
    'algo_received': [
      'ALGO detected in your wallet',
      'Automatic conversion to USDCa will begin shortly'
    ],
    'converting': [
      'ALGO is being converted to USDCa',
      'This usually takes 1-2 minutes'
    ],
    'completed': [
      'Your USDCa is ready for investing!',
      'Check your wallet balance to see the funds'
    ],
    'failed': [
      'Contact support if you completed payment',
      'Refund will be processed automatically'
    ],
    'cancelled': [
      'You can initiate a new deposit anytime',
      'No charges were made to your payment method'
    ],
    'expired': [
      'Click "Fund Wallet" to create a new payment link',
      'Payment links expire after 24 hours for security'
    ]
  };
  return nextSteps[status as keyof typeof nextSteps] || [];
}

export default router;