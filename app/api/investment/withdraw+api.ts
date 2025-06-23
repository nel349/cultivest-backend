import express from 'express';
import algosdk from 'algosdk';
import { getUserWallet, decryptPrivateKey } from '../../../utils/wallet';
import { supabase } from '../../../utils/supabase';

const router = express.Router();

// Initialize Algorand client
const algodClient = new algosdk.Algodv2('', process.env.ALGORAND_ALGOD_URL || 'https://testnet-algorand.api.purestake.io/ps2', {
  'X-API-Key': process.env.ALGORAND_ALGOD_TOKEN || ''
});

interface WithdrawRequest {
  userID: string;
  positionId: string;
  withdrawType: 'partial' | 'full';
  amount?: number; // Required for partial withdrawals
}

// POST /api/v1/investment/withdraw - Withdraw from investment position
router.post('/', async (req, res) => {
  try {
    const { userID, positionId, withdrawType, amount }: WithdrawRequest = req.body;

    // Input validation
    if (!userID || !positionId || !withdrawType) {
      return res.status(400).json({ 
        success: false,
        error: 'Missing required fields: userID, positionId, withdrawType' 
      });
    }

    if (withdrawType === 'partial' && (!amount || amount <= 0)) {
      return res.status(400).json({ 
        success: false,
        error: 'Amount is required for partial withdrawals and must be greater than 0' 
      });
    }

    console.log(`🔄 Processing investment withdrawal: ${withdrawType} for position ${positionId}`);

    // Fetch investment position
    const { data: position, error: positionError } = await supabase
      .from('investment_positions')
      .select('*')
      .eq('position_id', positionId)
      .eq('user_id', userID)
      .eq('status', 'active')
      .single();

    if (positionError || !position) {
      return res.status(404).json({ 
        success: false,
        error: 'Investment position not found or not active' 
      });
    }

    // Calculate withdrawal amounts
    let withdrawalAmount: number;
    let remainingInvestment: number;
    let withdrawnYield = position.total_yield_earned;

    if (withdrawType === 'full') {
      withdrawalAmount = position.invested_amount_usdca + position.total_yield_earned;
      remainingInvestment = 0;
    } else {
      // Partial withdrawal
      if (amount! > (position.invested_amount_usdca + position.total_yield_earned)) {
        return res.status(400).json({ 
          success: false,
          error: `Insufficient balance. Available: ${(position.invested_amount_usdca + position.total_yield_earned).toFixed(6)} USDCa`,
          availableBalance: position.invested_amount_usdca + position.total_yield_earned
        });
      }

      withdrawalAmount = amount!;
      
      // Withdraw yield first, then principal
      if (amount! <= position.total_yield_earned) {
        // Withdrawing only yield
        withdrawnYield = amount!;
        remainingInvestment = position.invested_amount_usdca;
      } else {
        // Withdrawing yield + some principal
        withdrawnYield = position.total_yield_earned;
        remainingInvestment = position.invested_amount_usdca - (amount! - position.total_yield_earned);
      }
    }

    // Get user wallet for transaction
    const wallet = await getUserWallet(userID, true);
    if (!wallet) {
      return res.status(404).json({ 
        success: false,
        error: 'Wallet not found for user' 
      });
    }

    // Execute withdrawal transaction (simulate for testnet)
    const withdrawalResult = await executeWithdrawal(wallet, withdrawalAmount, position);

    if (!withdrawalResult.success) {
      return res.status(500).json({ 
        success: false,
        error: withdrawalResult.error 
      });
    }

    // Update investment position
    const newStatus = withdrawType === 'full' ? 'closed' : 'active';
    const endDate = withdrawType === 'full' ? new Date().toISOString() : null;

    const { error: updateError } = await supabase
      .from('investment_positions')
      .update({
        invested_amount_usdca: remainingInvestment,
        total_yield_earned: withdrawType === 'full' ? 0 : (position.total_yield_earned - withdrawnYield),
        status: newStatus,
        end_date: endDate,
        updated_at: new Date().toISOString()
      })
      .eq('position_id', positionId);

    if (updateError) {
      console.error('Database error updating position:', updateError);
      return res.status(500).json({ 
        success: false,
        error: 'Failed to update investment position' 
      });
    }

    // Update user balance
    const currentBalance = wallet.onChainBalance?.usdca || 0;
    const { error: balanceError } = await supabase
      .from('wallets')
      .update({ 
        balance_usdca: currentBalance + withdrawalAmount,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userID);

    if (balanceError) {
      console.error('Database error updating balance:', balanceError);
      // Continue - withdrawal was successful, balance sync can be fixed later
    }

    // Create withdrawal transaction record
    const { error: txError } = await supabase
      .from('transactions')
      .insert({
        user_id: userID,
        type: 'withdrawal',
        amount_usdca: withdrawalAmount,
        status: 'completed',
        algorand_tx_id: withdrawalResult.txId,
        external_tx_id: `withdraw_${positionId}_${Date.now()}`,
        provider: 'tinyman'
      });

    if (txError) {
      console.error('Database error creating transaction:', txError);
      // Continue - withdrawal was successful, transaction logging can be fixed
    }

    console.log(`✅ Investment withdrawal successful: ${positionId}`);

    return res.json({
      success: true,
      message: `${withdrawType} withdrawal completed successfully`,
      withdrawal: {
        positionId: positionId,
        withdrawType: withdrawType,
        withdrawalAmount: withdrawalAmount,
        withdrawnYield: withdrawnYield,
        withdrawnPrincipal: withdrawalAmount - withdrawnYield,
        remainingInvestment: remainingInvestment,
        algorandTxID: withdrawalResult.txId,
        newPositionStatus: newStatus,
        processedAt: new Date().toISOString()
      },
      updatedPosition: {
        positionID: positionId,
        investedAmountUSDCa: remainingInvestment,
        totalYieldEarned: withdrawType === 'full' ? 0 : (position.total_yield_earned - withdrawnYield),
        status: newStatus,
        endDate: endDate
      },
      balance: {
        newUSDCaBalance: currentBalance + withdrawalAmount,
        changeAmount: withdrawalAmount
      }
    });

  } catch (error) {
    console.error('Investment withdrawal error:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Internal server error' 
    });
  }
});

async function executeWithdrawal(wallet: any, amount: number, position: any) {
  try {
    // Decrypt private key
    const privateKey = decryptPrivateKey(wallet.encryptedPrivateKey);
    const account = algosdk.mnemonicToSecretKey(privateKey);

    // Get suggested parameters
    const suggestedParams = await algodClient.getTransactionParams().do();

    // For testnet demo, simulate withdrawal with an asset transfer back to user
    // In production, this would interact with Tinyman's withdrawal contracts
    
    const isTestnet = process.env.NODE_ENV !== 'production';
    const usdcAssetId = isTestnet ? 10458941 : 31566704;

    const withdrawalTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      from: account.addr,
      to: account.addr, // For testnet demo, keep in same wallet
      amount: Math.floor(amount * 1000000), // Convert to microUSDCa
      assetIndex: usdcAssetId,
      note: new TextEncoder().encode(`Cultivest withdrawal: ${amount} USDCa from position ${position.position_id}`),
      suggestedParams,
    });

    // Sign transaction
    const signedTxn = withdrawalTxn.signTxn(account.sk);

    // Submit transaction
    const { txId } = await algodClient.sendRawTransaction(signedTxn).do();
    
    // Wait for confirmation
    await algosdk.waitForConfirmation(algodClient, txId, 4);

    console.log(`💸 Withdrawal transaction confirmed: ${txId}`);

    return {
      success: true,
      txId: txId,
      message: 'Withdrawal executed successfully'
    };

  } catch (error) {
    console.error('Withdrawal execution error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Withdrawal execution failed'
    };
  }
}

export default router;