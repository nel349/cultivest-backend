-- Add user_preferences table for storing user preferences
-- Run this migration to support auto-funding preferences

CREATE TABLE IF NOT EXISTS user_preferences (
    preference_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    auto_fund_on_failure BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create unique index on user_id to ensure one preference record per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_preferences_auto_fund ON user_preferences(auto_fund_on_failure) WHERE auto_fund_on_failure = TRUE;

-- Add comments for documentation
COMMENT ON TABLE user_preferences IS 'Stores user preferences for various app features';
COMMENT ON COLUMN user_preferences.auto_fund_on_failure IS 'Whether to automatically fund wallet and create investment when MoonPay fails in dev mode';
COMMENT ON COLUMN user_preferences.user_id IS 'Reference to the user who owns these preferences';

-- Verify table creation
\d user_preferences 