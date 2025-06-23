-- Add algorand_tx_id field to investment_positions table
-- This stores the transaction ID for the investment transaction on Algorand

ALTER TABLE investment_positions 
ADD COLUMN IF NOT EXISTS algorand_tx_id VARCHAR(128);

-- Create index for algorand_tx_id for performance
CREATE INDEX IF NOT EXISTS idx_investment_positions_algorand_tx_id 
ON investment_positions(algorand_tx_id);

-- Add additional helpful fields for investment tracking
ALTER TABLE investment_positions 
ADD COLUMN IF NOT EXISTS pool_address VARCHAR(58),
ADD COLUMN IF NOT EXISTS lp_tokens_received DECIMAL(18,6) DEFAULT 0,
ADD COLUMN IF NOT EXISTS conversion_rate DECIMAL(18,6);

-- Add comments for documentation
COMMENT ON COLUMN investment_positions.algorand_tx_id IS 'Transaction ID of the investment on Algorand blockchain';
COMMENT ON COLUMN investment_positions.pool_address IS 'Algorand address of the Tinyman pool contract';
COMMENT ON COLUMN investment_positions.lp_tokens_received IS 'Liquidity provider tokens received from the pool';
COMMENT ON COLUMN investment_positions.conversion_rate IS 'USDCa to LP token conversion rate at time of investment';