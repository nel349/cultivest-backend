-- Add celebration viewed tracking for first investment celebration
-- Run this migration to prevent showing celebration multiple times

-- Add column to track when user viewed their first investment celebration
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS first_investment_celebration_viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add index for fast celebration status queries
CREATE INDEX IF NOT EXISTS idx_users_celebration_viewed ON users(first_investment_celebration_viewed_at) WHERE first_investment_celebration_viewed_at IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN users.first_investment_celebration_viewed_at IS 'Timestamp when user viewed their first investment celebration screen (prevents showing celebration again)';

-- Verify the column was added
\d users; 