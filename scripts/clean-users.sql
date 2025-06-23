-- Clean slate: Remove all existing users and wallets
-- This will allow fresh signups with Bitcoin + Algorand wallets

-- Delete in order to respect foreign key constraints
DELETE FROM deposits;
DELETE FROM otp_sessions;
DELETE FROM user_badges;
DELETE FROM user_quiz_results;
DELETE FROM wallets;
DELETE FROM users;

-- Reset any sequences (optional)
-- This ensures new users start with fresh IDs