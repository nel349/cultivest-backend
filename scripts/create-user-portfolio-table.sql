-- User NFT Portfolio Tracking Table
-- This table maps users to their portfolio NFT tokens

CREATE TABLE user_nft_portfolios (
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

-- Indexes for performance
CREATE INDEX idx_user_nft_portfolios_user_id ON user_nft_portfolios(user_id);
CREATE INDEX idx_user_nft_portfolios_token_id ON user_nft_portfolios(portfolio_token_id);
CREATE INDEX idx_user_nft_portfolios_primary ON user_nft_portfolios(user_id, is_primary) WHERE is_primary = true;

-- RLS (Row Level Security) - Users can only see their own portfolios
ALTER TABLE user_nft_portfolios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own portfolios" ON user_nft_portfolios
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own portfolios" ON user_nft_portfolios
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own portfolios" ON user_nft_portfolios
  FOR UPDATE USING (user_id = auth.uid());

-- Comments for documentation
COMMENT ON TABLE user_nft_portfolios IS 'Maps users to their portfolio NFT tokens for custodial asset management';
COMMENT ON COLUMN user_nft_portfolios.portfolio_token_id IS 'The on-chain NFT token ID from the Portfolio NFT contract';
COMMENT ON COLUMN user_nft_portfolios.portfolio_app_id IS 'The Algorand app ID of the Portfolio NFT contract';
COMMENT ON COLUMN user_nft_portfolios.algorand_address IS 'The Algorand address that owns the NFT (user wallet address)';
COMMENT ON COLUMN user_nft_portfolios.is_primary IS 'Whether this is the users main portfolio (only one per user)';