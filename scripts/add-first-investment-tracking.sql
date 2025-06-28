-- Add first investment tracking for celebration features
-- Run this migration to support first investment detection

-- Add column to track first investment completion
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS first_investment_completed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add column to investments table to mark first investments
ALTER TABLE investments 
ADD COLUMN IF NOT EXISTS is_first_investment BOOLEAN DEFAULT FALSE;

-- Add index for fast first investment queries
CREATE INDEX IF NOT EXISTS idx_users_first_investment ON users(first_investment_completed_at) WHERE first_investment_completed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_investments_first_investment ON investments(is_first_investment) WHERE is_first_investment = TRUE;

-- Add comments for documentation
COMMENT ON COLUMN users.first_investment_completed_at IS 'Timestamp when user completed their very first investment (for celebration features)';
COMMENT ON COLUMN investments.is_first_investment IS 'Whether this investment was the users first completed investment';

-- Show current schema
\d users
\d investments 