-- Add Deposits table for MoonPay integration
-- Run this in your Supabase SQL Editor

-- 1. Create Deposits table
CREATE TABLE IF NOT EXISTS deposits (
  deposit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  wallet_id UUID REFERENCES wallets(wallet_id) ON DELETE SET NULL,
  amount_usd DECIMAL(18,2) NOT NULL,
  amount_algo DECIMAL(18,6),
  amount_usdca DECIMAL(18,6),
  moonpay_transaction_id VARCHAR(128),
  moonpay_url TEXT,
  status VARCHAR(20) DEFAULT 'pending_payment' CHECK (status IN (
    'pending_payment', 'algo_received', 'converting', 'completed', 'failed', 'cancelled'
  )),
  conversion_rate DECIMAL(18,6), -- ALGO to USDCa rate used
  fees_paid DECIMAL(18,6), -- Total fees in USD
  algorand_tx_id VARCHAR(128), -- DEX conversion transaction
  error_message TEXT,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours'),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create indexes for Deposits table
CREATE INDEX IF NOT EXISTS idx_deposits_user_id ON deposits(user_id);
CREATE INDEX IF NOT EXISTS idx_deposits_status ON deposits(status);
CREATE INDEX IF NOT EXISTS idx_deposits_moonpay_tx_id ON deposits(moonpay_transaction_id);
CREATE INDEX IF NOT EXISTS idx_deposits_created_at ON deposits(created_at);

-- 3. Enable Row Level Security
ALTER TABLE deposits ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS policies for deposits
DROP POLICY IF EXISTS "Users can view own deposits" ON deposits;
DROP POLICY IF EXISTS "Service role can manage deposits" ON deposits;

CREATE POLICY "Users can view own deposits" ON deposits
  FOR SELECT USING (user_id IN (SELECT user_id FROM users WHERE supabase_auth_id = auth.uid()));

CREATE POLICY "Service role can manage deposits" ON deposits
  FOR ALL WITH CHECK (true);

-- 5. Add updated_at trigger (only if the function exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'trigger_set_timestamp') THEN
    DROP TRIGGER IF EXISTS set_timestamp_deposits ON deposits;
    CREATE TRIGGER set_timestamp_deposits 
      BEFORE UPDATE ON deposits 
      FOR EACH ROW 
      EXECUTE PROCEDURE trigger_set_timestamp();
  END IF;
END $$;

-- Deposits table setup complete!