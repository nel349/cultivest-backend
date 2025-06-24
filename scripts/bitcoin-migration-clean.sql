-- Cultivest Bitcoin Migration - Clean Version
-- This handles cases where migration was partially run

-- Add Bitcoin columns to wallets table (only if they don't exist)
DO $$ 
BEGIN
    -- Add blockchain column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wallets' AND column_name = 'blockchain') THEN
        ALTER TABLE wallets ADD COLUMN blockchain VARCHAR(20) DEFAULT 'algorand';
    END IF;
    
    -- Add bitcoin_address column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wallets' AND column_name = 'bitcoin_address') THEN
        ALTER TABLE wallets ADD COLUMN bitcoin_address VARCHAR(64);
    END IF;
    
    -- Add encrypted_bitcoin_private_key column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wallets' AND column_name = 'encrypted_bitcoin_private_key') THEN
        ALTER TABLE wallets ADD COLUMN encrypted_bitcoin_private_key TEXT;
    END IF;
    
    -- Add encrypted_algorand_private_key column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wallets' AND column_name = 'encrypted_algorand_private_key') THEN
        ALTER TABLE wallets ADD COLUMN encrypted_algorand_private_key TEXT;
    END IF;
    
    -- Add balance_btc column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wallets' AND column_name = 'balance_btc') THEN
        ALTER TABLE wallets ADD COLUMN balance_btc DECIMAL(18,8) DEFAULT 0;
    END IF;
END $$;

-- Add constraint for blockchain types (only if it doesn't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.constraint_column_usage WHERE constraint_name = 'check_blockchain_type') THEN
        ALTER TABLE wallets ADD CONSTRAINT check_blockchain_type 
        CHECK (blockchain IN ('algorand', 'bitcoin', 'multi-chain'));
    END IF;
END $$;

-- Migrate existing data
UPDATE wallets 
SET encrypted_algorand_private_key = encrypted_private_key,
    blockchain = 'multi-chain'
WHERE encrypted_algorand_private_key IS NULL 
  AND encrypted_private_key IS NOT NULL;

-- Add Bitcoin columns to deposits table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deposits' AND column_name = 'target_currency') THEN
        ALTER TABLE deposits ADD COLUMN target_currency VARCHAR(10) DEFAULT 'algo';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deposits' AND column_name = 'target_address') THEN
        ALTER TABLE deposits ADD COLUMN target_address VARCHAR(128);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deposits' AND column_name = 'amount_btc') THEN
        ALTER TABLE deposits ADD COLUMN amount_btc DECIMAL(18,8);
    END IF;
END $$;

-- Update deposits constraints
ALTER TABLE deposits DROP CONSTRAINT IF EXISTS deposits_status_check;
ALTER TABLE deposits DROP CONSTRAINT IF EXISTS check_target_currency;

ALTER TABLE deposits 
ADD CONSTRAINT deposits_status_check 
CHECK (status IN (
  'pending_payment', 'btc_received', 'algo_received', 'converting', 
  'completed', 'failed', 'cancelled'
));

ALTER TABLE deposits 
ADD CONSTRAINT check_target_currency 
CHECK (target_currency IN ('btc', 'algo', 'usdca'));

-- Create portfolio_nfts table
CREATE TABLE IF NOT EXISTS portfolio_nfts (
  portfolio_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  algorand_nft_asset_id BIGINT UNIQUE,
  total_value_usd DECIMAL(18,2) DEFAULT 0,
  total_invested_usd DECIMAL(18,2) DEFAULT 0,
  btc_holdings DECIMAL(18,8) DEFAULT 0,
  algo_holdings DECIMAL(18,6) DEFAULT 0,
  usdca_holdings DECIMAL(18,6) DEFAULT 0,
  unrealized_pnl_usd DECIMAL(18,2) DEFAULT 0,
  nft_metadata JSONB,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create position_nfts table
CREATE TABLE IF NOT EXISTS position_nfts (
  position_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES portfolio_nfts(portfolio_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  algorand_nft_asset_id BIGINT UNIQUE,
  blockchain VARCHAR(20) NOT NULL,
  cryptocurrency VARCHAR(10) NOT NULL,
  quantity DECIMAL(18,8) NOT NULL,
  entry_price_usd DECIMAL(18,2) NOT NULL,
  current_value_usd DECIMAL(18,2) DEFAULT 0,
  unrealized_pnl_usd DECIMAL(18,2) DEFAULT 0,
  position_metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create investments table
CREATE TABLE IF NOT EXISTS investments (
  investment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  wallet_id UUID REFERENCES wallets(wallet_id) ON DELETE SET NULL,
  investment_type VARCHAR(50) NOT NULL,
  target_asset VARCHAR(10) NOT NULL,
  amount_usd DECIMAL(18,2) NOT NULL,
  estimated_btc DECIMAL(18,8),
  estimated_algo DECIMAL(18,6),
  bitcoin_price_usd DECIMAL(18,2),
  algo_price_usd DECIMAL(18,6),
  fees_paid DECIMAL(18,6),
  moonpay_url TEXT,
  moonpay_transaction_id VARCHAR(128),
  status VARCHAR(20) DEFAULT 'pending_payment',
  risk_acknowledged BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add investment constraints
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.constraint_column_usage WHERE constraint_name = 'check_investment_status') THEN
        ALTER TABLE investments ADD CONSTRAINT check_investment_status 
        CHECK (status IN ('pending_payment', 'processing', 'completed', 'failed', 'cancelled'));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.constraint_column_usage WHERE constraint_name = 'check_target_asset') THEN
        ALTER TABLE investments ADD CONSTRAINT check_target_asset 
        CHECK (target_asset IN ('BTC', 'ALGO', 'USDC'));
    END IF;
END $$;

-- Add users table Bitcoin columns
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'current_balance_btc') THEN
        ALTER TABLE users ADD COLUMN current_balance_btc DECIMAL(18,8) DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'total_portfolio_value_usd') THEN
        ALTER TABLE users ADD COLUMN total_portfolio_value_usd DECIMAL(18,2) DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'custody_status') THEN
        ALTER TABLE users ADD COLUMN custody_status VARCHAR(20) DEFAULT 'custodial';
    END IF;
END $$;

-- Add custody status constraint
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.constraint_column_usage WHERE constraint_name = 'check_custody_status') THEN
        ALTER TABLE users ADD CONSTRAINT check_custody_status 
        CHECK (custody_status IN ('custodial', 'self_custody', 'chain_key'));
    END IF;
END $$;

-- Create indexes (only if they don't exist)
CREATE INDEX IF NOT EXISTS idx_wallets_bitcoin_address ON wallets(bitcoin_address);
CREATE INDEX IF NOT EXISTS idx_wallets_blockchain ON wallets(blockchain);
CREATE INDEX IF NOT EXISTS idx_deposits_target_currency ON deposits(target_currency);
CREATE INDEX IF NOT EXISTS idx_deposits_target_address ON deposits(target_address);
CREATE INDEX IF NOT EXISTS idx_portfolio_nfts_user_id ON portfolio_nfts(user_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_nfts_asset_id ON portfolio_nfts(algorand_nft_asset_id);
CREATE INDEX IF NOT EXISTS idx_position_nfts_portfolio_id ON position_nfts(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_position_nfts_blockchain ON position_nfts(blockchain);
CREATE INDEX IF NOT EXISTS idx_position_nfts_cryptocurrency ON position_nfts(cryptocurrency);
CREATE INDEX IF NOT EXISTS idx_investments_user_id ON investments(user_id);
CREATE INDEX IF NOT EXISTS idx_investments_target_asset ON investments(target_asset);
CREATE INDEX IF NOT EXISTS idx_investments_status ON investments(status);
CREATE INDEX IF NOT EXISTS idx_investments_created_at ON investments(created_at);

-- Update badges
UPDATE badges SET category = 'bitcoin_investment' WHERE category = 'first_steps';
UPDATE badges SET 
  name = 'First Bitcoin Investor',
  description = 'Made your first Bitcoin investment'
WHERE name = 'First Investor';

-- Insert Bitcoin-focused badges
INSERT INTO badges (name, description, criteria, category) VALUES
  ('Bitcoin Pioneer', 'Purchased your first Bitcoin', '{"type": "first_bitcoin_investment", "min_amount": 1}', 'bitcoin_investment'),
  ('HODLer', 'Held Bitcoin for 30+ days', '{"type": "holding_period", "cryptocurrency": "btc", "min_days": 30}', 'bitcoin_investment'),
  ('Portfolio NFT Creator', 'Created your first portfolio NFT', '{"type": "portfolio_nft_creation"}', 'nft_portfolio'),
  ('Multi-Chain Master', 'Invested in both Bitcoin and Algorand', '{"type": "multi_chain_investment"}', 'multi_chain')
ON CONFLICT (name) DO NOTHING;