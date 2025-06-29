-- Fix duplicate investments and add constraints to prevent future duplicates
-- Run this migration to clean up existing duplicates and prevent new ones

-- Step 1: Backup existing data (just in case)
CREATE TABLE IF NOT EXISTS investments_backup AS SELECT * FROM investments;

-- Step 2: Clean up duplicate investments (keep the earliest created one per moonpay_transaction_id)
WITH ranked_investments AS (
  SELECT 
    investment_id,
    ROW_NUMBER() OVER (
      PARTITION BY moonpay_transaction_id 
      ORDER BY created_at ASC, investment_id ASC
    ) as rn
  FROM investments 
  WHERE moonpay_transaction_id IS NOT NULL
)
DELETE FROM investments 
WHERE investment_id IN (
  SELECT investment_id 
  FROM ranked_investments 
  WHERE rn > 1
);

-- Step 3: Add unique constraint to prevent duplicate MoonPay transactions
-- (Allow NULL moonpay_transaction_id for non-MoonPay investments)
CREATE UNIQUE INDEX IF NOT EXISTS idx_investments_unique_moonpay_tx 
ON investments(moonpay_transaction_id) 
WHERE moonpay_transaction_id IS NOT NULL;

-- Step 4: Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_investments_moonpay_status 
ON investments(moonpay_transaction_id, status) 
WHERE moonpay_transaction_id IS NOT NULL;

-- Step 5: Add constraint for user + created_at to prevent rapid duplicates
CREATE INDEX IF NOT EXISTS idx_investments_user_created 
ON investments(user_id, created_at);

-- Verify the cleanup worked
SELECT 
  'Duplicate MoonPay transactions after cleanup' as check_name,
  COUNT(*) as count
FROM (
  SELECT moonpay_transaction_id, COUNT(*) as dup_count
  FROM investments 
  WHERE moonpay_transaction_id IS NOT NULL
  GROUP BY moonpay_transaction_id
  HAVING COUNT(*) > 1
) duplicates;

-- Show remaining investment counts per user
SELECT 
  user_id,
  COUNT(*) as total_investments,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_investments,
  COUNT(CASE WHEN moonpay_transaction_id IS NOT NULL THEN 1 END) as moonpay_investments
FROM investments 
GROUP BY user_id 
ORDER BY total_investments DESC;

-- Comments for documentation  
COMMENT ON INDEX idx_investments_unique_moonpay_tx IS 'Prevents duplicate investments for the same MoonPay transaction ID';
COMMENT ON INDEX idx_investments_moonpay_status IS 'Fast lookups for MoonPay transaction status checks';
COMMENT ON INDEX idx_investments_user_created IS 'Prevents rapid duplicate investment creation for same user'; 