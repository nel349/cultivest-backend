-- Cultivest Database Schema V2 - Multi-Chain Investment Platform
-- This consolidates all migrations and changes up to Bitcoin support (excludes Solana)
-- Run this in your Supabase SQL Editor

-- ================================
-- 1. CORE TABLES
-- ================================

-- 1.1 Users table (consolidating custom + auth fields)
CREATE TABLE IF NOT EXISTS users (
  -- Primary Cultivest fields
  user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  country VARCHAR(3) NOT NULL,
  email VARCHAR(255),
  
  -- Balance fields
  current_balance_usdca DECIMAL(18,6) DEFAULT 0,
  current_balance_btc DECIMAL(18,8) DEFAULT 0,
  daily_yield_accumulated DECIMAL(18,6) DEFAULT 0,
  total_portfolio_value_usd DECIMAL(18,2) DEFAULT 0,
  money_tree_leaves INTEGER DEFAULT 0,
  
  -- Status fields
  kyc_status VARCHAR(20) DEFAULT 'pending' CHECK (kyc_status IN ('pending', 'approved', 'rejected')),
  custody_status VARCHAR(20) DEFAULT 'custodial' CHECK (custody_status IN ('custodial', 'self_custody', 'chain_key')),
  
  -- Integration fields
  supabase_auth_id UUID,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 1.2 Wallets table (multi-chain support)
CREATE TABLE IF NOT EXISTS wallets (
  wallet_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  
  -- Blockchain type
  blockchain VARCHAR(20) DEFAULT 'multi-chain' CHECK (blockchain IN ('algorand', 'bitcoin', 'multi-chain')),
  
  -- Algorand wallet
  algorand_address VARCHAR(64) UNIQUE NOT NULL,
  encrypted_algorand_private_key TEXT,
  encrypted_private_key TEXT NOT NULL, -- Legacy field for backward compatibility
  balance_algo DECIMAL(18,6) DEFAULT 0,
  balance_usdca DECIMAL(18,6) DEFAULT 0,
  asset_id INTEGER DEFAULT 31566704, -- USDCa asset ID on Algorand
  
  -- Bitcoin wallet
  bitcoin_address VARCHAR(64),
  encrypted_bitcoin_private_key TEXT,
  balance_btc DECIMAL(18,8) DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================
-- 2. INVESTMENT & TRADING TABLES
-- ================================

-- 2.1 Investments table (Bitcoin + Algorand investments)
CREATE TABLE IF NOT EXISTS investments (
  investment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  wallet_id UUID REFERENCES wallets(wallet_id) ON DELETE SET NULL,
  
  -- Investment details
  investment_type VARCHAR(50) NOT NULL,
  target_asset VARCHAR(10) NOT NULL CHECK (target_asset IN ('BTC', 'ALGO', 'USDC')),
  amount_usd DECIMAL(18,2) NOT NULL,
  
  -- Asset estimates
  estimated_btc DECIMAL(18,8),
  estimated_algo DECIMAL(18,6),
  bitcoin_price_usd DECIMAL(18,2),
  algo_price_usd DECIMAL(18,6),
  fees_paid DECIMAL(18,6),
  
  -- External integration
  moonpay_url TEXT,
  moonpay_transaction_id VARCHAR(128),
  
  -- Status tracking
  status VARCHAR(20) DEFAULT 'pending_payment' CHECK (status IN ('pending_payment', 'processing', 'completed', 'failed', 'cancelled')),
  risk_acknowledged BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2.2 Investment Positions table (for stablecoin yield farming)
CREATE TABLE IF NOT EXISTS investment_positions (
  position_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  pool_id VARCHAR(100) NOT NULL, -- Tinyman pool identifier
  invested_amount_usdca DECIMAL(18,6) NOT NULL,
  current_apy DECIMAL(8,4) DEFAULT 2.5, -- Store as percentage (2.5 = 2.5%)
  total_yield_earned DECIMAL(18,6) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'closed', 'pending')),
  
  -- Pool details
  pool_address VARCHAR(58),
  lp_tokens_received DECIMAL(18,6) DEFAULT 0,
  conversion_rate DECIMAL(18,6),
  algorand_tx_id VARCHAR(128),
  
  -- Timestamps
  start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  end_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2.3 Deposits table (MoonPay + multi-currency)
CREATE TABLE IF NOT EXISTS deposits (
  deposit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  wallet_id UUID REFERENCES wallets(wallet_id) ON DELETE SET NULL,
  
  -- Amount details
  amount_usd DECIMAL(18,2) NOT NULL,
  amount_algo DECIMAL(18,6),
  amount_usdca DECIMAL(18,6),
  amount_btc DECIMAL(18,8),
  
  -- Target details
  target_currency VARCHAR(10) DEFAULT 'algo' CHECK (target_currency IN ('btc', 'algo', 'usdca')),
  target_address VARCHAR(128),
  
  -- MoonPay integration
  moonpay_transaction_id VARCHAR(128),
  moonpay_url TEXT,
  
  -- Processing details
  status VARCHAR(20) DEFAULT 'pending_payment' CHECK (status IN (
    'pending_payment', 'btc_received', 'algo_received', 'converting', 
    'completed', 'failed', 'cancelled'
  )),
  conversion_rate DECIMAL(18,6), -- Conversion rate used
  fees_paid DECIMAL(18,6), -- Total fees in USD
  algorand_tx_id VARCHAR(128), -- DEX conversion transaction
  error_message TEXT,
  
  -- Timestamps
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours'),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2.4 Transactions table (general transaction history)
CREATE TABLE IF NOT EXISTS transactions (
  transaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  wallet_id UUID REFERENCES wallets(wallet_id) ON DELETE SET NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('deposit', 'investment', 'withdrawal', 'yield_credit')),
  amount_usdca DECIMAL(18,6) NOT NULL,
  fiat_amount DECIMAL(18,2),
  fiat_currency VARCHAR(3),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  algorand_tx_id VARCHAR(128),
  external_tx_id VARCHAR(128),
  provider VARCHAR(50), -- moonpay, flutterwave, etc.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================
-- 3. NFT PORTFOLIO SYSTEM
-- ================================

-- 3.1 Portfolio NFTs table
CREATE TABLE IF NOT EXISTS portfolio_nfts (
  portfolio_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  algorand_nft_asset_id BIGINT UNIQUE,
  
  -- Portfolio values
  total_value_usd DECIMAL(18,2) DEFAULT 0,
  total_invested_usd DECIMAL(18,2) DEFAULT 0,
  unrealized_pnl_usd DECIMAL(18,2) DEFAULT 0,
  
  -- Holdings breakdown
  btc_holdings DECIMAL(18,8) DEFAULT 0,
  algo_holdings DECIMAL(18,6) DEFAULT 0,
  usdca_holdings DECIMAL(18,6) DEFAULT 0,
  
  -- Metadata
  nft_metadata JSONB,
  
  -- Timestamps
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3.2 Position NFTs table
CREATE TABLE IF NOT EXISTS position_nfts (
  position_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES portfolio_nfts(portfolio_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  algorand_nft_asset_id BIGINT UNIQUE,
  
  -- Position details
  blockchain VARCHAR(20) NOT NULL,
  cryptocurrency VARCHAR(10) NOT NULL,
  quantity DECIMAL(18,8) NOT NULL,
  entry_price_usd DECIMAL(18,2) NOT NULL,
  current_value_usd DECIMAL(18,2) DEFAULT 0,
  unrealized_pnl_usd DECIMAL(18,2) DEFAULT 0,
  
  -- Metadata
  position_metadata JSONB,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3.3 User NFT Portfolios mapping table
CREATE TABLE IF NOT EXISTS user_nft_portfolios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  portfolio_token_id BIGINT NOT NULL,
  portfolio_app_id BIGINT NOT NULL,
  algorand_address TEXT NOT NULL, -- The address that owns the NFT
  is_primary BOOLEAN DEFAULT true, -- Main portfolio for the user
  custom_name VARCHAR(100), -- User-defined portfolio name
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(user_id, portfolio_token_id),
  UNIQUE(user_id, is_primary) -- Only one primary portfolio per user
);

-- ================================
-- 4. GAMIFICATION & EDUCATION
-- ================================

-- 4.1 Badges table
CREATE TABLE IF NOT EXISTS badges (
  badge_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT NOT NULL,
  criteria JSONB NOT NULL, -- Store badge criteria as JSON
  icon_url VARCHAR(255),
  category VARCHAR(50) DEFAULT 'general',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4.2 User Badges junction table
CREATE TABLE IF NOT EXISTS user_badges (
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  badge_id UUID NOT NULL REFERENCES badges(badge_id) ON DELETE CASCADE,
  awarded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (user_id, badge_id)
);

-- 4.3 Educational Content table
CREATE TABLE IF NOT EXISTS educational_content (
  content_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(20) NOT NULL CHECK (type IN ('video', 'quiz', 'article')),
  title VARCHAR(200) UNIQUE NOT NULL,
  description TEXT,
  url VARCHAR(500),
  duration_seconds INTEGER,
  quiz_questions JSONB, -- Store quiz questions as JSON array
  unlocks_badge_id UUID REFERENCES badges(badge_id) ON DELETE SET NULL,
  difficulty_level VARCHAR(20) DEFAULT 'beginner',
  is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4.4 User Quiz Results table
CREATE TABLE IF NOT EXISTS user_quiz_results (
  result_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  content_id UUID NOT NULL REFERENCES educational_content(content_id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  max_score INTEGER NOT NULL,
  answers JSONB, -- Store user answers as JSON
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  time_taken_seconds INTEGER,
  UNIQUE(user_id, content_id)
);

-- ================================
-- 5. AUTHENTICATION & SECURITY
-- ================================

-- 5.1 OTP Sessions table for authentication
CREATE TABLE IF NOT EXISTS otp_sessions (
  session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number VARCHAR(20) NOT NULL,
  otp_code VARCHAR(10) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  attempts INTEGER DEFAULT 0,
  verified BOOLEAN DEFAULT false,
  user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================
-- 6. INDEXES FOR PERFORMANCE
-- ================================

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_phone_number ON users(phone_number);
CREATE INDEX IF NOT EXISTS idx_users_supabase_auth_id ON users(supabase_auth_id);

-- Wallets indexes
CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_wallets_algorand_address ON wallets(algorand_address);
CREATE INDEX IF NOT EXISTS idx_wallets_bitcoin_address ON wallets(bitcoin_address);
CREATE INDEX IF NOT EXISTS idx_wallets_blockchain ON wallets(blockchain);

-- Investments indexes
CREATE INDEX IF NOT EXISTS idx_investments_user_id ON investments(user_id);
CREATE INDEX IF NOT EXISTS idx_investments_target_asset ON investments(target_asset);
CREATE INDEX IF NOT EXISTS idx_investments_status ON investments(status);
CREATE INDEX IF NOT EXISTS idx_investments_created_at ON investments(created_at);

-- Investment positions indexes
CREATE INDEX IF NOT EXISTS idx_positions_user_id ON investment_positions(user_id);
CREATE INDEX IF NOT EXISTS idx_positions_status ON investment_positions(status);
CREATE INDEX IF NOT EXISTS idx_positions_pool_id ON investment_positions(pool_id);
CREATE INDEX IF NOT EXISTS idx_investment_positions_algorand_tx_id ON investment_positions(algorand_tx_id);

-- Deposits indexes
CREATE INDEX IF NOT EXISTS idx_deposits_user_id ON deposits(user_id);
CREATE INDEX IF NOT EXISTS idx_deposits_status ON deposits(status);
CREATE INDEX IF NOT EXISTS idx_deposits_moonpay_tx_id ON deposits(moonpay_transaction_id);
CREATE INDEX IF NOT EXISTS idx_deposits_created_at ON deposits(created_at);
CREATE INDEX IF NOT EXISTS idx_deposits_target_currency ON deposits(target_currency);
CREATE INDEX IF NOT EXISTS idx_deposits_target_address ON deposits(target_address);

-- Transactions indexes
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);

-- NFT indexes
CREATE INDEX IF NOT EXISTS idx_portfolio_nfts_user_id ON portfolio_nfts(user_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_nfts_asset_id ON portfolio_nfts(algorand_nft_asset_id);
CREATE INDEX IF NOT EXISTS idx_position_nfts_portfolio_id ON position_nfts(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_position_nfts_blockchain ON position_nfts(blockchain);
CREATE INDEX IF NOT EXISTS idx_position_nfts_cryptocurrency ON position_nfts(cryptocurrency);
CREATE INDEX IF NOT EXISTS idx_user_nft_portfolios_user_id ON user_nft_portfolios(user_id);
CREATE INDEX IF NOT EXISTS idx_user_nft_portfolios_token_id ON user_nft_portfolios(portfolio_token_id);
CREATE INDEX IF NOT EXISTS idx_user_nft_portfolios_primary ON user_nft_portfolios(user_id, is_primary) WHERE is_primary = true;

-- Education & badges indexes
CREATE INDEX IF NOT EXISTS idx_badges_category ON badges(category);
CREATE INDEX IF NOT EXISTS idx_user_badges_user_id ON user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_awarded_at ON user_badges(awarded_at);
CREATE INDEX IF NOT EXISTS idx_education_type ON educational_content(type);
CREATE INDEX IF NOT EXISTS idx_education_published ON educational_content(is_published);
CREATE INDEX IF NOT EXISTS idx_quiz_results_user_id ON user_quiz_results(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_results_content_id ON user_quiz_results(content_id);

-- OTP indexes
CREATE INDEX IF NOT EXISTS idx_otp_phone_number ON otp_sessions(phone_number);
CREATE INDEX IF NOT EXISTS idx_otp_expires_at ON otp_sessions(expires_at);

-- ================================
-- 7. ROW LEVEL SECURITY (RLS)
-- ================================

-- Enable RLS on user tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE investment_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_nfts ENABLE ROW LEVEL SECURITY;
ALTER TABLE position_nfts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_nft_portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_quiz_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE otp_sessions ENABLE ROW LEVEL SECURITY;

-- Clean up existing policies if they exist
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Service role can insert users" ON users;
DROP POLICY IF EXISTS "Users can view own wallets" ON wallets;
DROP POLICY IF EXISTS "Service role can manage wallets" ON wallets;
DROP POLICY IF EXISTS "Users can view own transactions" ON transactions;
DROP POLICY IF EXISTS "Service role can manage transactions" ON transactions;
DROP POLICY IF EXISTS "Users can view own positions" ON investment_positions;
DROP POLICY IF EXISTS "Service role can manage positions" ON investment_positions;
DROP POLICY IF EXISTS "Users can view own investments" ON investments;
DROP POLICY IF EXISTS "Service role can manage investments" ON investments;
DROP POLICY IF EXISTS "Users can view own deposits" ON deposits;
DROP POLICY IF EXISTS "Service role can manage deposits" ON deposits;
DROP POLICY IF EXISTS "Users can view own portfolio nfts" ON portfolio_nfts;
DROP POLICY IF EXISTS "Service role can manage portfolio nfts" ON portfolio_nfts;
DROP POLICY IF EXISTS "Users can view own position nfts" ON position_nfts;
DROP POLICY IF EXISTS "Service role can manage position nfts" ON position_nfts;
DROP POLICY IF EXISTS "Users can view their own portfolios" ON user_nft_portfolios;
DROP POLICY IF EXISTS "Users can insert their own portfolios" ON user_nft_portfolios;
DROP POLICY IF EXISTS "Users can update their own portfolios" ON user_nft_portfolios;
DROP POLICY IF EXISTS "Users can view own badges" ON user_badges;
DROP POLICY IF EXISTS "Service role can manage user badges" ON user_badges;
DROP POLICY IF EXISTS "Users can view own quiz results" ON user_quiz_results;
DROP POLICY IF EXISTS "Users can insert own quiz results" ON user_quiz_results;
DROP POLICY IF EXISTS "Service role can manage OTP sessions" ON otp_sessions;
DROP POLICY IF EXISTS "Badges are publicly readable" ON badges;
DROP POLICY IF EXISTS "Educational content is publicly readable" ON educational_content;

-- Users policies
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (supabase_auth_id = auth.uid());

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (supabase_auth_id = auth.uid());

CREATE POLICY "Service role can insert users" ON users
  FOR INSERT WITH CHECK (true);

-- Wallets policies
CREATE POLICY "Users can view own wallets" ON wallets
  FOR SELECT USING (user_id IN (SELECT user_id FROM users WHERE supabase_auth_id = auth.uid()));

CREATE POLICY "Service role can manage wallets" ON wallets
  FOR ALL WITH CHECK (true);

-- Transactions policies
CREATE POLICY "Users can view own transactions" ON transactions
  FOR SELECT USING (user_id IN (SELECT user_id FROM users WHERE supabase_auth_id = auth.uid()));

CREATE POLICY "Service role can manage transactions" ON transactions
  FOR ALL WITH CHECK (true);

-- Investment positions policies
CREATE POLICY "Users can view own positions" ON investment_positions
  FOR SELECT USING (user_id IN (SELECT user_id FROM users WHERE supabase_auth_id = auth.uid()));

CREATE POLICY "Service role can manage positions" ON investment_positions
  FOR ALL WITH CHECK (true);

-- Investments policies
CREATE POLICY "Users can view own investments" ON investments
  FOR SELECT USING (user_id IN (SELECT user_id FROM users WHERE supabase_auth_id = auth.uid()));

CREATE POLICY "Service role can manage investments" ON investments
  FOR ALL WITH CHECK (true);

-- Deposits policies
CREATE POLICY "Users can view own deposits" ON deposits
  FOR SELECT USING (user_id IN (SELECT user_id FROM users WHERE supabase_auth_id = auth.uid()));

CREATE POLICY "Service role can manage deposits" ON deposits
  FOR ALL WITH CHECK (true);

-- Portfolio NFTs policies
CREATE POLICY "Users can view own portfolio nfts" ON portfolio_nfts
  FOR SELECT USING (user_id IN (SELECT user_id FROM users WHERE supabase_auth_id = auth.uid()));

CREATE POLICY "Service role can manage portfolio nfts" ON portfolio_nfts
  FOR ALL WITH CHECK (true);

-- Position NFTs policies
CREATE POLICY "Users can view own position nfts" ON position_nfts
  FOR SELECT USING (user_id IN (SELECT user_id FROM users WHERE supabase_auth_id = auth.uid()));

CREATE POLICY "Service role can manage position nfts" ON position_nfts
  FOR ALL WITH CHECK (true);

-- User NFT portfolios policies
CREATE POLICY "Users can view their own portfolios" ON user_nft_portfolios
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own portfolios" ON user_nft_portfolios
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own portfolios" ON user_nft_portfolios
  FOR UPDATE USING (user_id = auth.uid());

-- User badges policies
CREATE POLICY "Users can view own badges" ON user_badges
  FOR SELECT USING (user_id IN (SELECT user_id FROM users WHERE supabase_auth_id = auth.uid()));

CREATE POLICY "Service role can manage user badges" ON user_badges
  FOR ALL WITH CHECK (true);

-- Quiz results policies
CREATE POLICY "Users can view own quiz results" ON user_quiz_results
  FOR SELECT USING (user_id IN (SELECT user_id FROM users WHERE supabase_auth_id = auth.uid()));

CREATE POLICY "Users can insert own quiz results" ON user_quiz_results
  FOR INSERT WITH CHECK (user_id IN (SELECT user_id FROM users WHERE supabase_auth_id = auth.uid()));

-- OTP sessions - service role only
CREATE POLICY "Service role can manage OTP sessions" ON otp_sessions
  FOR ALL WITH CHECK (true);

-- Public read access for badges and published educational content
CREATE POLICY "Badges are publicly readable" ON badges 
  FOR SELECT USING (true);

CREATE POLICY "Educational content is publicly readable" ON educational_content 
  FOR SELECT USING (is_published = true);

-- ================================
-- 8. FUNCTIONS & TRIGGERS
-- ================================

-- Auto-cleanup function for expired OTP sessions
CREATE OR REPLACE FUNCTION cleanup_expired_otp_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM otp_sessions WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers to relevant tables
DROP TRIGGER IF EXISTS set_timestamp_users ON users;
DROP TRIGGER IF EXISTS set_timestamp_wallets ON wallets;
DROP TRIGGER IF EXISTS set_timestamp_transactions ON transactions;
DROP TRIGGER IF EXISTS set_timestamp_investment_positions ON investment_positions;
DROP TRIGGER IF EXISTS set_timestamp_investments ON investments;
DROP TRIGGER IF EXISTS set_timestamp_deposits ON deposits;
DROP TRIGGER IF EXISTS set_timestamp_position_nfts ON position_nfts;
DROP TRIGGER IF EXISTS set_timestamp_educational_content ON educational_content;

CREATE TRIGGER set_timestamp_users BEFORE UPDATE ON users FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
CREATE TRIGGER set_timestamp_wallets BEFORE UPDATE ON wallets FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
CREATE TRIGGER set_timestamp_transactions BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
CREATE TRIGGER set_timestamp_investment_positions BEFORE UPDATE ON investment_positions FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
CREATE TRIGGER set_timestamp_investments BEFORE UPDATE ON investments FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
CREATE TRIGGER set_timestamp_deposits BEFORE UPDATE ON deposits FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
CREATE TRIGGER set_timestamp_position_nfts BEFORE UPDATE ON position_nfts FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
CREATE TRIGGER set_timestamp_educational_content BEFORE UPDATE ON educational_content FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

-- ================================
-- 9. DEFAULT DATA
-- ================================

-- Insert default badges (Bitcoin-focused)
INSERT INTO badges (name, description, criteria, category) VALUES
  ('First Bitcoin Investor', 'Made your first Bitcoin investment', '{"type": "first_bitcoin_investment", "min_amount": 1}', 'bitcoin_investment'),
  ('First $10', 'Invested your first $10', '{"type": "investment_amount", "min_amount": 10}', 'first_steps'),
  ('First Yield', 'Earned your first yield payment', '{"type": "first_yield", "min_amount": 0.01}', 'first_steps'),
  ('Bitcoin Pioneer', 'Purchased your first Bitcoin', '{"type": "first_bitcoin_investment", "min_amount": 1}', 'bitcoin_investment'),
  ('HODLer', 'Held Bitcoin for 30+ days', '{"type": "holding_period", "cryptocurrency": "btc", "min_days": 30}', 'bitcoin_investment'),
  ('Portfolio NFT Creator', 'Created your first portfolio NFT', '{"type": "portfolio_nft_creation"}', 'nft_portfolio'),
  ('Multi-Chain Master', 'Invested in both Bitcoin and Algorand', '{"type": "multi_chain_investment"}', 'multi_chain'),
  ('Safe Saver', 'Completed the stablecoin safety quiz', '{"type": "quiz_completion", "quiz_type": "stablecoin_safety"}', 'education'),
  ('Quiz Master', 'Completed 5 educational quizzes', '{"type": "quiz_count", "min_count": 5}', 'education'),
  ('Weekly Investor', 'Made investments for 7 consecutive days', '{"type": "investment_streak", "min_days": 7}', 'consistency'),
  ('Century Club', 'Invested over $100 total', '{"type": "total_invested", "min_amount": 100}', 'milestones')
ON CONFLICT (name) DO NOTHING;

-- Insert sample educational content
INSERT INTO educational_content (type, title, description, url, duration_seconds, difficulty_level, is_published, quiz_questions) VALUES
  ('video', 'What are Stablecoins?', 'Learn about stablecoins and how they maintain their value', 'https://example.com/stablecoins-101', 180, 'beginner', true, NULL),
  ('video', 'Bitcoin Basics', 'Understanding Bitcoin and its role in digital finance', 'https://example.com/bitcoin-basics', 240, 'beginner', true, NULL),
  ('quiz', 'Stablecoin Safety Quiz', 'Test your knowledge about stablecoin safety and GENIUS Act protections', NULL, NULL, 'beginner', true, 
   '[
     {
       "question": "What backs USDC stablecoins?",
       "options": ["Gold reserves", "US Dollars", "Bitcoin", "Government bonds"],
       "correct_answer": 1
     },
     {
       "question": "What is the GENIUS Act?",
       "options": ["A crypto trading strategy", "A stablecoin regulation", "An investment app", "A blockchain protocol"],
       "correct_answer": 1
     },
     {
       "question": "What is a typical APY for stablecoin yields?",
       "options": ["20-30%", "2-5%", "50-100%", "0.1-0.5%"],
       "correct_answer": 1
     }
   ]'::jsonb),
  ('quiz', 'Bitcoin Investment Quiz', 'Test your understanding of Bitcoin investment principles', NULL, NULL, 'beginner', true,
   '[
     {
       "question": "What is Bitcoin''s maximum supply?",
       "options": ["21 million", "100 million", "No limit", "1 billion"],
       "correct_answer": 0
     },
     {
       "question": "What does HODL mean?",
       "options": ["Hold On for Dear Life", "High Order Demand Level", "Hold Original Digital Ledger", "None of the above"],
       "correct_answer": 0
     }
   ]'::jsonb)
ON CONFLICT (title) DO NOTHING;

-- ================================
-- 10. COMMENTS FOR DOCUMENTATION
-- ================================

COMMENT ON TABLE users IS 'Core user accounts with multi-chain wallet support';
COMMENT ON TABLE wallets IS 'Multi-chain wallet storage with encrypted private keys';
COMMENT ON TABLE investments IS 'Bitcoin and Algorand investment tracking';
COMMENT ON TABLE investment_positions IS 'Stablecoin yield farming positions';
COMMENT ON TABLE deposits IS 'MoonPay fiat-to-crypto deposits with multi-currency support';
COMMENT ON TABLE portfolio_nfts IS 'NFT-based portfolio representation on Algorand';
COMMENT ON TABLE position_nfts IS 'Individual investment position NFTs';
COMMENT ON TABLE user_nft_portfolios IS 'Maps users to their portfolio NFT tokens for custodial asset management';

COMMENT ON COLUMN user_nft_portfolios.portfolio_token_id IS 'The on-chain NFT token ID from the Portfolio NFT contract';
COMMENT ON COLUMN user_nft_portfolios.portfolio_app_id IS 'The Algorand app ID of the Portfolio NFT contract';
COMMENT ON COLUMN user_nft_portfolios.algorand_address IS 'The Algorand address that owns the NFT (user wallet address)';
COMMENT ON COLUMN user_nft_portfolios.is_primary IS 'Whether this is the users main portfolio (only one per user)';

COMMENT ON COLUMN investment_positions.algorand_tx_id IS 'Transaction ID of the investment on Algorand blockchain';
COMMENT ON COLUMN investment_positions.pool_address IS 'Algorand address of the Tinyman pool contract';
COMMENT ON COLUMN investment_positions.lp_tokens_received IS 'Liquidity provider tokens received from the pool';
COMMENT ON COLUMN investment_positions.conversion_rate IS 'USDCa to LP token conversion rate at time of investment';

-- Database schema V2 creation complete!
-- This consolidates all changes through Bitcoin support
-- Ready for Solana V3 when you're ready to proceed 