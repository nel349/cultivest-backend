import express from 'express';
import { supabase } from '../../../utils/supabase';
import { moonPayService } from '../../../utils/moonpay';

const router = express.Router();

interface MoonPayWebhookData {
  type: string;
  data: {
    id: string;
    status: string;
    cryptoAmount?: number;
    cryptoCurrency?: string;
    walletAddress?: string;
    externalTransactionId?: string;
    failureReason?: string;
  };
}

router.post('/moonpay', async (req, res) => {
  try {
    const signature = req.headers['moonpay-signature'] as string;
    const payload = JSON.stringify(req.body);

    // Verify webhook signature
    if (!moonPayService.verifyWebhookSignature(payload, signature)) {
      console.error('Invalid MoonPay webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const webhookData: MoonPayWebhookData = req.body;
    console.log('MoonPay webhook received:', webhookData);

    if (webhookData.type !== 'transaction_status_change') {
      return res.json({ success: true, message: 'Webhook type not handled' });
    }

    const { data } = webhookData;
    const { id, status, cryptoAmount, walletAddress, externalTransactionId } = data;

    // Find deposit by external transaction ID or MoonPay transaction ID
    let depositQuery = supabase
      .from('deposits')
      .select('*');

    if (externalTransactionId?.startsWith('cultivest_')) {
      const depositId = externalTransactionId.replace('cultivest_', '');
      depositQuery = depositQuery.eq('deposit_id', depositId);
    } else {
      depositQuery = depositQuery.eq('moonpay_transaction_id', id);
    }

    const { data: deposit, error: depositError } = await depositQuery.single();

    if (depositError || !deposit) {
      console.error('Deposit not found for webhook:', externalTransactionId || id);
      return res.status(404).json({ error: 'Deposit not found' });
    }

    // Update deposit with MoonPay transaction ID if not set
    if (!deposit.moonpay_transaction_id) {
      await supabase
        .from('deposits')
        .update({ moonpay_transaction_id: id })
        .eq('deposit_id', deposit.deposit_id);
    }

    // Process based on MoonPay status
    switch (status) {
      case 'completed':
        await handleMoonPayCompleted(deposit, cryptoAmount || 0, walletAddress);
        break;

      case 'failed':
        await handleMoonPayFailed(deposit, data.failureReason);
        break;

      case 'cancelled':
        await handleMoonPayCancelled(deposit);
        break;

      default:
        console.log(`MoonPay status ${status} - no action needed`);
    }

    return res.json({ success: true, message: 'Webhook processed' });

  } catch (error) {
    console.error('MoonPay webhook error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

async function handleMoonPayCompleted(deposit: any, algoAmount: number, _walletAddress?: string) {
  try {
    console.log(`MoonPay completed for deposit ${deposit.deposit_id}: ${algoAmount} ALGO`);

    // Update deposit status and ALGO amount
    await supabase
      .from('deposits')
      .update({
        status: 'algo_received',
        amount_algo: algoAmount,
        updated_at: new Date().toISOString()
      })
      .eq('deposit_id', deposit.deposit_id);

    // Sync wallet balance to detect the new ALGO
    // await syncWalletBalance(deposit.user_id);

    // TODO: Initiate auto-conversion ALGO → USDCa
    // For MVP, we'll mark as completed and manually convert
    console.log(`ALGO received for user ${deposit.user_id}. Auto-conversion coming in Phase 2.`);

    // For now, mark as completed (manual conversion needed)
    await supabase
      .from('deposits')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('deposit_id', deposit.deposit_id);

  } catch (error) {
    console.error('Error handling MoonPay completion:', error);
    
    // Mark deposit as failed
    await supabase
      .from('deposits')
      .update({
        status: 'failed',
        error_message: 'Failed to process ALGO receipt'
      })
      .eq('deposit_id', deposit.deposit_id);
  }
}

async function handleMoonPayFailed(deposit: any, failureReason?: string) {
  try {
    console.log(`MoonPay failed for deposit ${deposit.deposit_id}: ${failureReason}`);

    await supabase
      .from('deposits')
      .update({
        status: 'failed',
        error_message: failureReason || 'Payment failed in MoonPay',
        updated_at: new Date().toISOString()
      })
      .eq('deposit_id', deposit.deposit_id);

  } catch (error) {
    console.error('Error handling MoonPay failure:', error);
  }
}

async function handleMoonPayCancelled(deposit: any) {
  try {
    console.log(`MoonPay cancelled for deposit ${deposit.deposit_id}`);

    await supabase
      .from('deposits')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('deposit_id', deposit.deposit_id);

  } catch (error) {
    console.error('Error handling MoonPay cancellation:', error);
  }
}

export default router; 