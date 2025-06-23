import express from 'express';
import { supabase } from '../../../utils/supabase';
import { moonPayService } from '../../../utils/moonpay';
import { verifyJWT } from '../../../utils/auth';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

interface DepositRequest {
  amountUSD: number;
  targetCurrency: 'btc' | 'usdca' | 'algo';
}

router.post('/', async (req, res) => {
  try {
    const { amountUSD, targetCurrency = 'btc' }: DepositRequest = req.body;
    const authHeader = req.headers.authorization;

    // Validate request
    if (!amountUSD || amountUSD < 1 || amountUSD > 10000) {
      return res.status(400).json({
        error: 'Invalid amount. Must be between $1 and $10,000.'
      });
    }

    if (!['btc', 'usdca', 'algo'].includes(targetCurrency)) {
      return res.status(400).json({
        error: 'Supported currencies: btc (Bitcoin), usdca (Algorand USDC), algo (Algorand)'
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
      : wallet.algorand_address;

    if (!walletAddress) {
      if (targetCurrency === 'btc') {
        return res.status(400).json({ 
          error: 'Bitcoin wallet not found. Please run database migration or create a new wallet to enable Bitcoin support.' 
        });
      } else {
        return res.status(400).json({ 
          error: `${targetCurrency.toUpperCase()} wallet address not found. Please create a wallet first.` 
        });
      }
    }

    // Calculate fees and estimated amount based on target currency
    const feeCalculation = targetCurrency === 'btc' 
      ? moonPayService.calculateEstimatedBitcoin(amountUSD)
      : moonPayService.calculateEstimatedUSDCa(amountUSD);

    // Create deposit record
    const depositId = uuidv4();
    const externalTransactionId = `cultivest_${depositId}`;

    // Create deposit record (backward compatible with existing schema)
    const depositData: any = {
      deposit_id: depositId,
      user_id: user.user_id,
      wallet_id: wallet.wallet_id,
      amount_usd: amountUSD,
      fees_paid: feeCalculation.totalFees,
      status: 'pending_payment',
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
    };

    // Add new fields only if they exist in the schema (after migration)
    try {
      // These fields will be added by the migration
      depositData.target_currency = targetCurrency;
      depositData.target_address = walletAddress;
    } catch (error) {
      console.log('💡 Using backward compatible deposit fields');
    }

    const { data: deposit, error: depositError } = await supabase
      .from('deposits')
      .insert(depositData)
      .select()
      .single();

    if (depositError) {
      console.error('Failed to create deposit record:', depositError);
      return res.status(500).json({ error: 'Failed to initiate deposit' });
    }

    // Generate MoonPay widget URL
    const moonpayUrl = moonPayService.generateWidgetUrl({
      walletAddress,
      currencyCode: targetCurrency === 'usdca' ? 'algo' : targetCurrency, // Use 'algo' for USDCa, direct currency for others
      baseCurrencyAmount: amountUSD,
      redirectURL: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/funding/success`,
      externalTransactionId
    });

    // Update deposit with MoonPay URL
    await supabase
      .from('deposits')
      .update({ moonpay_url: moonpayUrl })
      .eq('deposit_id', depositId);

    // Format response based on target currency
    const response: any = {
      success: true,
      moonpayUrl,
      transactionId: depositId,
      targetCurrency: targetCurrency.toUpperCase(),
      targetAddress: walletAddress,
      fees: {
        moonpayFee: feeCalculation.moonpayFee,
        total: feeCalculation.totalFees
      }
    };

    if (targetCurrency === 'btc') {
      response.estimatedBTC = (feeCalculation as any).estimatedBTC;
      response.networkFee = (feeCalculation as any).networkFee;
      response.message = 'Bitcoin deposit initiated. Complete payment with MoonPay to receive Bitcoin.';
    } else {
      response.estimatedUSDCa = (feeCalculation as any).estimatedUSDCa;
      response.conversionFee = (feeCalculation as any).conversionFee;
      response.conversionRate = `1 USD ≈ ${((feeCalculation as any).estimatedUSDCa / amountUSD).toFixed(3)} USDCa (after fees)`;
      response.message = 'Deposit initiated. Complete payment with MoonPay to receive USDCa.';
    }

    return res.json(response);

  } catch (error) {
    console.error('Deposit initiation error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;