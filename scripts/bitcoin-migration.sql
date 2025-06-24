-- Cultivest Bitcoin-First Multi-Chain Migration
-- This script updates the existing schema to support Bitcoin + Algorand

-- Add Bitcoin support to wallets table
ALTER TABLE wallets 
ADD COLUMN IF NOT EXISTS blockchain VARCHAR(20) DEFAULT 'algorand',
ADD COLUMN IF NOT EXISTS bitcoin_address VARCHAR(64),
ADD COLUMN IF NOT EXISTS encrypted_bitcoin_private_key TEXT,
ADD COLUMN IF NOT EXISTS encrypted_algorand_private_key TEXT,
ADD COLUMN IF NOT EXISTS balance_btc DECIMAL(18,8) DEFAULT 0;

-- Update constraint for blockchain types
ALTER TABLE wallets 
ADD CONSTRAINT check_blockchain_type 
CHECK (blockchain IN ('algorand', 'bitcoin', 'multi-chain'));

-- Migrate existing data: move encrypted_private_key to encrypted_algorand_private_key
UPDATE wallets 
SET encrypted_algorand_private_key = encrypted_private_key,
    blockchain = 'multi-chain'
WHERE encrypted_algorand_private_key IS NULL 
  AND encrypted_private_key IS NOT NULL;

-- Add Bitcoin support to deposits table
ALTER TABLE deposits 
ADD COLUMN IF NOT EXISTS target_currency VARCHAR(10) DEFAULT 'algo',
ADD COLUMN IF NOT EXISTS target_address VARCHAR(128),
ADD COLUMN IF NOT EXISTS amount_btc DECIMAL(18,8);

-- Update deposits status to include Bitcoin statuses
ALTER TABLE deposits 
DROP CONSTRAINT IF EXISTS deposits_status_check;

ALTER TABLE deposits 
ADD CONSTRAINT deposits_status_check 
CHECK (status IN (
  'pending_payment', 'btc_received', 'algo_received', 'converting', 
  'completed', 'failed', 'cancelled'
));

-- Update target currency constraint
ALTER TABLE deposits 
ADD CONSTRAINT check_target_currency 
CHECK (target_currency IN ('btc', 'algo', 'usdca'));

-- Create portfolio_nfts table for NFT-based portfolio tracking
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

-- Create position_nfts table for individual investment positions
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

-- Add Bitcoin-focused indexes
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

-- Update users table to include Bitcoin-focused fields
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS current_balance_btc DECIMAL(18,8) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_portfolio_value_usd DECIMAL(18,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS custody_status VARCHAR(20) DEFAULT 'custodial';

-- Add constraint for custody status
ALTER TABLE users 
ADD CONSTRAINT check_custody_status 
CHECK (custody_status IN ('custodial', 'self_custody', 'chain_key'));

-- Create investments table for Bitcoin + Algorand investments
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

-- Add constraint for investment status
ALTER TABLE investments 
ADD CONSTRAINT check_investment_status 
CHECK (status IN ('pending_payment', 'processing', 'completed', 'failed', 'cancelled'));

-- Add constraint for target assets
ALTER TABLE investments 
ADD CONSTRAINT check_target_asset 
CHECK (target_asset IN ('BTC', 'ALGO', 'USDC'));

-- Update badge categories for Bitcoin-first platform
UPDATE badges SET category = 'bitcoin_investment' WHERE category = 'first_steps';
UPDATE badges SET 
  name = 'First Bitcoin Investor',
  description = 'Made your first Bitcoin investment'
WHERE name = 'First Investor';

-- Insert Bitcoin-focused sample badges
INSERT INTO badges (name, description, criteria, category) VALUES
  ('Bitcoin Pioneer', 'Purchased your first Bitcoin', '{"type": "first_bitcoin_investment", "min_amount": 1}', 'bitcoin_investment'),
  ('HODLer', 'Held Bitcoin for 30+ days', '{"type": "holding_period", "cryptocurrency": "btc", "min_days": 30}', 'bitcoin_investment'),
  ('Portfolio NFT Creator', 'Created your first portfolio NFT', '{"type": "portfolio_nft_creation"}', 'nft_portfolio'),
  ('Multi-Chain Master', 'Invested in both Bitcoin and Algorand', '{"type": "multi_chain_investment"}', 'multi_chain')
ON CONFLICT (name) DO NOTHING;