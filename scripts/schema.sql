-- Cultivest Database Schema
-- Run this in your Supabase SQL Editor

-- 1. Create Users table
CREATE TABLE IF NOT EXISTS users (
  user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  country VARCHAR(3) NOT NULL,
  email VARCHAR(255),
  current_balance_usdca DECIMAL(18,6) DEFAULT 0,
  daily_yield_accumulated DECIMAL(18,6) DEFAULT 0,
  money_tree_leaves INTEGER DEFAULT 0,
  kyc_status VARCHAR(20) DEFAULT 'pending' CHECK (kyc_status IN ('pending', 'approved', 'rejected')),
  supabase_auth_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for Users table
CREATE INDEX IF NOT EXISTS idx_users_phone_number ON users(phone_number);
CREATE INDEX IF NOT EXISTS idx_users_supabase_auth_id ON users(supabase_auth_id);

-- 2. Create Wallets table
CREATE TABLE IF NOT EXISTS wallets (
  wallet_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  algorand_address VARCHAR(58) UNIQUE NOT NULL,
  encrypted_private_key TEXT NOT NULL,
  asset_id INTEGER DEFAULT 31566704, -- USDCa asset ID on Algorand
  balance_usdca DECIMAL(18,6) DEFAULT 0,
  balance_algo DECIMAL(18,6) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for Wallets table
CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_wallets_algorand_address ON wallets(algorand_address);

-- 3. Create Transactions table
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

-- Create indexes for Transactions table
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);

-- 4. Create Investment Positions table
CREATE TABLE IF NOT EXISTS investment_positions (
  position_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  pool_id VARCHAR(100) NOT NULL, -- Tinyman pool identifier
  invested_amount_usdca DECIMAL(18,6) NOT NULL,
  current_apy DECIMAL(8,4) DEFAULT 2.5, -- Store as percentage (2.5 = 2.5%)
  total_yield_earned DECIMAL(18,6) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'closed', 'pending')),
  start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  end_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for Investment Positions table
CREATE INDEX IF NOT EXISTS idx_positions_user_id ON investment_positions(user_id);
CREATE INDEX IF NOT EXISTS idx_positions_status ON investment_positions(status);
CREATE INDEX IF NOT EXISTS idx_positions_pool_id ON investment_positions(pool_id);

-- 5. Create Badges table
CREATE TABLE IF NOT EXISTS badges (
  badge_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT NOT NULL,
  criteria JSONB NOT NULL, -- Store badge criteria as JSON
  icon_url VARCHAR(255),
  category VARCHAR(50) DEFAULT 'general',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for Badges table
CREATE INDEX IF NOT EXISTS idx_badges_category ON badges(category);

-- 6. Create User Badges junction table
CREATE TABLE IF NOT EXISTS user_badges (
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  badge_id UUID NOT NULL REFERENCES badges(badge_id) ON DELETE CASCADE,
  awarded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (user_id, badge_id)
);

-- Create indexes for User Badges table
CREATE INDEX IF NOT EXISTS idx_user_badges_user_id ON user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_awarded_at ON user_badges(awarded_at);

-- 7. Create Educational Content table
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

-- Create indexes for Educational Content table
CREATE INDEX IF NOT EXISTS idx_education_type ON educational_content(type);
CREATE INDEX IF NOT EXISTS idx_education_published ON educational_content(is_published);

-- 8. Create User Quiz Results table
CREATE TABLE IF NOT EXISTS user_quiz_results (
  result_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  content_id UUID NOT NULL REFERENCES educational_content(content_id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  max_score INTEGER NOT NULL,
  answers JSONB, -- Store user answers as JSON
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  time_taken_seconds INTEGER
);

-- Create indexes for User Quiz Results table
CREATE INDEX IF NOT EXISTS idx_quiz_results_user_id ON user_quiz_results(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_results_content_id ON user_quiz_results(content_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_quiz_unique ON user_quiz_results(user_id, content_id);

-- 9. Create OTP Sessions table for authentication
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

-- Create indexes for OTP Sessions table
CREATE INDEX IF NOT EXISTS idx_otp_phone_number ON otp_sessions(phone_number);
CREATE INDEX IF NOT EXISTS idx_otp_expires_at ON otp_sessions(expires_at);

-- 10. Create Deposits table for MoonPay integration
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

-- Create indexes for Deposits table
CREATE INDEX IF NOT EXISTS idx_deposits_user_id ON deposits(user_id);
CREATE INDEX IF NOT EXISTS idx_deposits_status ON deposits(status);
CREATE INDEX IF NOT EXISTS idx_deposits_moonpay_tx_id ON deposits(moonpay_transaction_id);
CREATE INDEX IF NOT EXISTS idx_deposits_created_at ON deposits(created_at);

-- Auto-cleanup function for expired OTP sessions
CREATE OR REPLACE FUNCTION cleanup_expired_otp_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM otp_sessions WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- 11. Enable Row Level Security (RLS) on user tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE investment_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_quiz_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE otp_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE deposits ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Note: DROP POLICY IF EXISTS first, then CREATE POLICY to handle re-runs

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
DROP POLICY IF EXISTS "Users can view own badges" ON user_badges;
DROP POLICY IF EXISTS "Service role can manage user badges" ON user_badges;
DROP POLICY IF EXISTS "Users can view own quiz results" ON user_quiz_results;
DROP POLICY IF EXISTS "Users can insert own quiz results" ON user_quiz_results;
DROP POLICY IF EXISTS "Service role can manage OTP sessions" ON otp_sessions;
DROP POLICY IF EXISTS "Users can view own deposits" ON deposits;
DROP POLICY IF EXISTS "Service role can manage deposits" ON deposits;
DROP POLICY IF EXISTS "Badges are publicly readable" ON badges;
DROP POLICY IF EXISTS "Educational content is publicly readable" ON educational_content;

-- Users can only access their own data
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (supabase_auth_id = auth.uid());

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (supabase_auth_id = auth.uid());

-- Service role can insert users (for signup process)
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

-- Deposits policies
CREATE POLICY "Users can view own deposits" ON deposits
  FOR SELECT USING (user_id IN (SELECT user_id FROM users WHERE supabase_auth_id = auth.uid()));

CREATE POLICY "Service role can manage deposits" ON deposits
  FOR ALL WITH CHECK (true);

-- Public read access for badges and published educational content
CREATE POLICY "Badges are publicly readable" ON badges 
  FOR SELECT USING (true);

CREATE POLICY "Educational content is publicly readable" ON educational_content 
  FOR SELECT USING (is_published = true);

-- 11. Create updated_at trigger function
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers to relevant tables
CREATE TRIGGER set_timestamp_users BEFORE UPDATE ON users FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
CREATE TRIGGER set_timestamp_wallets BEFORE UPDATE ON wallets FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
CREATE TRIGGER set_timestamp_transactions BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
CREATE TRIGGER set_timestamp_investment_positions BEFORE UPDATE ON investment_positions FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
CREATE TRIGGER set_timestamp_educational_content BEFORE UPDATE ON educational_content FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
CREATE TRIGGER set_timestamp_deposits BEFORE UPDATE ON deposits FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

-- 12. Insert default badges
INSERT INTO badges (name, description, criteria, category) VALUES
  ('First Investor', 'Made your first investment in stablecoin yields', '{"type": "first_investment", "min_amount": 1}', 'first_steps'),
  ('First $10', 'Invested your first $10', '{"type": "investment_amount", "min_amount": 10}', 'first_steps'),
  ('First Yield', 'Earned your first yield payment', '{"type": "first_yield", "min_amount": 0.01}', 'first_steps'),
  ('Safe Saver', 'Completed the stablecoin safety quiz', '{"type": "quiz_completion", "quiz_type": "stablecoin_safety"}', 'education'),
  ('Quiz Master', 'Completed 5 educational quizzes', '{"type": "quiz_count", "min_count": 5}', 'education'),
  ('Weekly Investor', 'Made investments for 7 consecutive days', '{"type": "investment_streak", "min_days": 7}', 'consistency'),
  ('Century Club', 'Invested over $100 total', '{"type": "total_invested", "min_amount": 100}', 'milestones')
ON CONFLICT (name) DO NOTHING;

-- 13. Insert sample educational content
INSERT INTO educational_content (type, title, description, url, duration_seconds, difficulty_level, is_published, quiz_questions) VALUES
  ('video', 'What are Stablecoins?', 'Learn about stablecoins and how they maintain their value', 'https://example.com/stablecoins-101', 180, 'beginner', true, NULL),
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
   ]'::jsonb)
ON CONFLICT (title) DO NOTHING;

-- Database schema creation complete!
-- You can now run: npm run db:init