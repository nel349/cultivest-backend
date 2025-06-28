-- Cultivest Solana Support Migration
-- This script adds Solana as Asset Type 4 to the existing multi-chain infrastructure

-- 1. Add Solana wallet support
DO $$ 
BEGIN
    -- Add solana_address column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wallets' AND column_name = 'solana_address') THEN
        ALTER TABLE wallets ADD COLUMN solana_address VARCHAR(44); -- Solana addresses are 32-44 chars
    END IF;
    
    -- Add encrypted_solana_private_key column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wallets' AND column_name = 'encrypted_solana_private_key') THEN
        ALTER TABLE wallets ADD COLUMN encrypted_solana_private_key TEXT;
    END IF;
    
    -- Add balance_sol column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wallets' AND column_name = 'balance_sol') THEN
        ALTER TABLE wallets ADD COLUMN balance_sol DECIMAL(18,9) DEFAULT 0; -- SOL has 9 decimals
    END IF;
END $$;

-- 2. Update blockchain constraint to include Solana
ALTER TABLE wallets DROP CONSTRAINT IF EXISTS check_blockchain_type;
ALTER TABLE wallets 
ADD CONSTRAINT check_blockchain_type 
CHECK (blockchain IN ('algorand', 'bitcoin', 'solana', 'multi-chain'));

-- 3. Update deposits table for Solana support
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deposits' AND column_name = 'amount_sol') THEN
        ALTER TABLE deposits ADD COLUMN amount_sol DECIMAL(18,9);
    END IF;
END $$;

-- Update target currency constraint to include SOL
ALTER TABLE deposits DROP CONSTRAINT IF EXISTS check_target_currency;
ALTER TABLE deposits 
ADD CONSTRAINT check_target_currency 
CHECK (target_currency IN ('btc', 'algo', 'usdca', 'sol'));

-- Update deposit status to include Solana statuses
ALTER TABLE deposits DROP CONSTRAINT IF EXISTS deposits_status_check;
ALTER TABLE deposits 
ADD CONSTRAINT deposits_status_check 
CHECK (status IN (
  'pending_payment', 'btc_received', 'algo_received', 'sol_received', 'converting', 
  'completed', 'failed', 'cancelled'
));

-- 4. Update investments table to support Solana
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'investments' AND column_name = 'estimated_sol') THEN
        ALTER TABLE investments ADD COLUMN estimated_sol DECIMAL(18,9);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'investments' AND column_name = 'solana_price_usd') THEN
        ALTER TABLE investments ADD COLUMN solana_price_usd DECIMAL(18,6);
    END IF;
END $$;

-- Update target asset constraint to include SOL
ALTER TABLE investments DROP CONSTRAINT IF EXISTS check_target_asset;
ALTER TABLE investments 
ADD CONSTRAINT check_target_asset 
CHECK (target_asset IN ('BTC', 'ALGO', 'USDC', 'SOL'));

-- 5. Update position_nfts table for Solana
ALTER TABLE position_nfts DROP CONSTRAINT IF EXISTS check_position_cryptocurrency;
ALTER TABLE position_nfts 
ADD CONSTRAINT check_position_cryptocurrency 
CHECK (cryptocurrency IN ('BTC', 'ALGO', 'USDC', 'SOL'));

-- Add SOL holdings to portfolio_nfts
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'portfolio_nfts' AND column_name = 'sol_holdings') THEN
        ALTER TABLE portfolio_nfts ADD COLUMN sol_holdings DECIMAL(18,9) DEFAULT 0;
    END IF;
END $$;

-- 6. Create indexes for Solana fields
CREATE INDEX IF NOT EXISTS idx_wallets_solana_address ON wallets(solana_address);
CREATE INDEX IF NOT EXISTS idx_deposits_amount_sol ON deposits(amount_sol);
CREATE INDEX IF NOT EXISTS idx_investments_estimated_sol ON investments(estimated_sol);

-- 7. Insert Solana-focused badges
INSERT INTO badges (name, description, criteria, category) VALUES
  ('Solana Pioneer', 'Purchased your first Solana', '{"type": "first_solana_investment", "min_amount": 1}', 'solana_investment'),
  ('Multi-Chain Explorer', 'Invested in Bitcoin, Algorand, and Solana', '{"type": "triple_chain_investment"}', 'multi_chain'),
  ('SOL Staker', 'Participated in Solana staking', '{"type": "solana_staking"}', 'solana_investment')
ON CONFLICT (name) DO NOTHING;

-- 8. Update users table with Solana balance tracking
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'current_balance_sol') THEN
        ALTER TABLE users ADD COLUMN current_balance_sol DECIMAL(18,9) DEFAULT 0;
    END IF;
END $$;

COMMENT ON COLUMN wallets.solana_address IS 'Solana wallet address (base58 encoded, 32-44 characters)';
COMMENT ON COLUMN wallets.encrypted_solana_private_key IS 'Encrypted Solana private key for custodial wallet';
COMMENT ON COLUMN wallets.balance_sol IS 'SOL balance (9 decimal places)';
COMMENT ON COLUMN investments.estimated_sol IS 'Estimated SOL amount for investment';
COMMENT ON COLUMN investments.solana_price_usd IS 'SOL price in USD at time of investment'; 