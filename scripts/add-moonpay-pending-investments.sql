-- Add pending_investments table for MoonPay webhook processing
-- This table tracks investment requests before MoonPay payment completion

CREATE TABLE IF NOT EXISTS pending_investments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  asset_type INTEGER NOT NULL CHECK (asset_type IN (1, 2, 3, 4)),
  amount_usd DECIMAL(10,2) NOT NULL CHECK (amount_usd > 0),
  wallet_address TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'moonpay_initiated', 'moonpay_completed', 'completed', 'failed', 'cancelled')),
  moonpay_transaction_id TEXT UNIQUE,
  crypto_amount DECIMAL(20,10),
  investment_id UUID,
  position_nft_id TEXT,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_pending_investments_user_id ON pending_investments(user_id);
CREATE INDEX IF NOT EXISTS idx_pending_investments_moonpay_tx ON pending_investments(moonpay_transaction_id);
CREATE INDEX IF NOT EXISTS idx_pending_investments_status ON pending_investments(status);
CREATE INDEX IF NOT EXISTS idx_pending_investments_created_at ON pending_investments(created_at);

-- Add RLS policies
ALTER TABLE pending_investments ENABLE ROW LEVEL SECURITY;

-- Users can only see their own pending investments
CREATE POLICY "Users can view own pending investments" ON pending_investments
  FOR SELECT USING (auth.uid() = user_id);

-- Users can create their own pending investments
CREATE POLICY "Users can create own pending investments" ON pending_investments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Only system can update pending investments (webhooks)
CREATE POLICY "System can update pending investments" ON pending_investments
  FOR UPDATE USING (true);

-- Add comments for documentation
COMMENT ON TABLE pending_investments IS 'Tracks investment requests before MoonPay payment completion';
COMMENT ON COLUMN pending_investments.asset_type IS '1=Bitcoin, 2=Algorand, 3=USDC, 4=Solana';
COMMENT ON COLUMN pending_investments.status IS 'pending -> moonpay_initiated -> moonpay_completed -> completed (or failed/cancelled)';
COMMENT ON COLUMN pending_investments.crypto_amount IS 'Actual crypto amount received from MoonPay';
COMMENT ON COLUMN pending_investments.investment_id IS 'Links to investments table after completion';
COMMENT ON COLUMN pending_investments.position_nft_id IS 'Position NFT token ID after minting'; 