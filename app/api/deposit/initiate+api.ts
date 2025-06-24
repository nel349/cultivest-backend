import express from 'express';
import { supabase } from '../../../utils/supabase';
import { moonPayService } from '../../../utils/moonpay';
import { verifyJWT } from '../../../utils/auth';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

interface DepositRequest {
  amountUSD: number;
  targetCurrency: 'btc' | 'usdca' | 'algo' | 'crypto';
}

router.post('/', async (req, res) => {
  try {
    const { amountUSD, targetCurrency = 'btc' }: DepositRequest = req.body;
    const authHeader = req.headers.authorization;

    // Validate JWT authentication
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Authorization token required'
      });
    }

    // Extract and verify JWT token
    const token = authHeader.split(' ')[1];
    const decoded = verifyJWT(token);
    
    if (!decoded) {
      return res.status(401).json({
        error: 'Invalid or expired token'
      });
    }

    const userID = decoded.userId;
    console.log('🔐 Authenticated user for deposit:', userID);

    // Validate request
    if (!amountUSD || amountUSD < 1 || amountUSD > 10000) {
      return res.status(400).json({
        error: 'Invalid amount. Must be between $1 and $10,000.'
      });
    }

    if (!['btc', 'usdca', 'algo', 'crypto'].includes(targetCurrency)) {
      return res.status(400).json({
        error: 'Supported currencies: btc (Bitcoin), usdca (Algorand USDC), algo (Algorand), crypto (general crypto)'
      });
    }
    
    console.log('💰 Processing deposit for user:', userID);
    
    // Get user from database
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('user_id, phone_number')
      .eq('user_id', userID)
      .single();

    if (userError || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get user's wallet addresses (backward compatible)
    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('wallet_id, bitcoin_address, algorand_address')
      .eq('user_id', user.user_id)
      .single();

    if (walletError || !wallet) {
      return res.status(400).json({ 
        error: 'User wallet not found. Please create a wallet first.' 
      });
    }

    // Validate wallet address exists for target currency
    const walletAddress = targetCurrency === 'btc' 
      ? wallet.bitcoin_address 
      : wallet.algorand_address; // For 'crypto', 'usdca', and 'algo', use Algorand address

    if (!walletAddress) {
      return res.status(400).json({ 
        error: `${targetCurrency.toUpperCase()} wallet address not found for user` 
      });
    }

    console.log('💰 Initiating deposit:', {
      userId: user.user_id,
      amount: amountUSD,
      currency: targetCurrency,
      walletAddress: walletAddress
    });

    // Generate deposit ID
    const depositId = uuidv4();

    // Create deposit record
    const { data: deposit, error: depositError } = await supabase
      .from('deposits')
      .insert({
        deposit_id: depositId,
        user_id: user.user_id,
        wallet_id: wallet.wallet_id,
        amount_usd: amountUSD,
        target_currency: targetCurrency,
        target_address: walletAddress,
        status: 'pending_payment',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
      })
      .select()
      .single();

    if (depositError) {
      console.error('Failed to create deposit record:', depositError);
      return res.status(500).json({ 
        error: 'Failed to create deposit record' 
      });
    }

    // Map target currency to MoonPay currency code
    const moonPayCurrency = targetCurrency === 'crypto' ? 'usdca' : targetCurrency; // Default 'crypto' to USDCa for now
    
    // Generate MoonPay widget URL
    const moonPayUrl = moonPayService.generateWidgetUrl({
      currencyCode: moonPayCurrency,
      baseCurrencyAmount: amountUSD,
      walletAddress: walletAddress,
      externalTransactionId: depositId,
      redirectURL: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/deposit/success`
    });

    if (!moonPayUrl) {
      return res.status(500).json({ 
        error: 'Failed to generate MoonPay payment URL' 
      });
    }

    return res.json({
      success: true,
      depositId: depositId,
      paymentUrl: moonPayUrl,
      amount: amountUSD,
      currency: targetCurrency,
      targetAddress: walletAddress,
      expiresAt: deposit.expires_at,
      status: 'pending_payment'
    });

  } catch (error) {
    console.error('Deposit initiation error:', error);
    return res.status(500).json({ 
      error: 'Internal server error while initiating deposit' 
    });
  }
});

export default router;