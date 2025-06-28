-- Add investment_nfts table to track NFT creation for investments
-- This links investments with their corresponding Position and Portfolio NFTs

CREATE TABLE IF NOT EXISTS investment_nfts (
  id SERIAL PRIMARY KEY,
  investment_id UUID NOT NULL REFERENCES investments(investment_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  position_token_id BIGINT NOT NULL,
  portfolio_token_id BIGINT NOT NULL,
  position_app_id BIGINT NOT NULL,
  portfolio_app_id BIGINT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one NFT mapping per investment
  UNIQUE(investment_id),
  
  -- Index for efficient lookups
  INDEX(user_id),
  INDEX(investment_id),
  INDEX(position_token_id),
  INDEX(portfolio_token_id)
);

-- Add RLS (Row Level Security) for investment_nfts
ALTER TABLE investment_nfts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own investment NFTs
CREATE POLICY "Users can view own investment NFTs" ON investment_nfts
  FOR SELECT USING (auth.uid()::text = user_id::text);

-- Policy: System can insert NFT records (for webhook)
CREATE POLICY "System can insert investment NFTs" ON investment_nfts
  FOR INSERT WITH CHECK (true);

-- Policy: System can update NFT records if needed
CREATE POLICY "System can update investment NFTs" ON investment_nfts
  FOR UPDATE USING (true);

-- Add helpful comments
COMMENT ON TABLE investment_nfts IS 'Links investments with their corresponding Position and Portfolio NFTs';
COMMENT ON COLUMN investment_nfts.investment_id IS 'Foreign key to investments table';
COMMENT ON COLUMN investment_nfts.position_token_id IS 'Token ID of the Position NFT on Algorand';
COMMENT ON COLUMN investment_nfts.portfolio_token_id IS 'Token ID of the Portfolio NFT on Algorand';
COMMENT ON COLUMN investment_nfts.position_app_id IS 'App ID of the Position NFT contract';
COMMENT ON COLUMN investment_nfts.portfolio_app_id IS 'App ID of the Portfolio NFT contract';

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_investment_nfts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_investment_nfts_updated_at
  BEFORE UPDATE ON investment_nfts
  FOR EACH ROW
  EXECUTE FUNCTION update_investment_nfts_updated_at();