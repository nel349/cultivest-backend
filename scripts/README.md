# Database Setup Scripts

This directory contains scripts for setting up the Cultivest database schema and initial data for the micro-investment platform.

## 🚀 Quick Setup

**One-command setup** (recommended):

```bash
npm run db:init
```

The script will guide you through the process automatically.

## 📁 Current Files

### `simple-setup.ts`
**Main setup script** that:
- ✅ Checks if required tables exist in your Supabase database
- 🌐 Automatically opens Supabase SQL Editor in your browser
- 📋 Provides copy-paste ready SQL if tables are missing
- 📝 Inserts sample badge data when tables exist
- 🔄 Handles the complete setup workflow

### `schema.sql`
**Complete PostgreSQL schema** with:
- ✅ **Fixed syntax** - All `CREATE POLICY` statements use correct PostgreSQL syntax
- ✅ **UNIQUE constraints** - Proper constraints for `ON CONFLICT` clauses
- ✅ **Re-runnable** - Safe to run multiple times with `DROP POLICY IF EXISTS`
- 🗄️ All tables, indexes, RLS policies, and sample data

### `README.md`
This documentation file.

## 🗄️ Database Tables Created

### Core Tables for User Onboarding
- **`users`** - User profiles with phone, name, country, KYC status, balance tracking
- **`wallets`** - Custodial Algorand wallets with encrypted private keys
- **`otp_sessions`** - Phone verification system with expiration and attempt tracking
- **`badges`** - Gamification achievement system with JSON criteria

### Extended Tables (Future Features)
- **`transactions`** - Financial movements (deposits, investments, withdrawals, yields)
- **`investment_positions`** - Active Tinyman USDCa pool positions
- **`educational_content`** - Videos and quizzes about stablecoins/DeFi
- **`user_quiz_results`** - Learning progress tracking
- **`user_badges`** - Achievement tracking junction table

### Sample Data Included
- **5 Achievement Badges**: First Investor, First $10, Safe Saver, Weekly Investor, Century Club
- **Educational Content**: Stablecoin safety quiz with 3 questions
- **Proper indexing** for performance on phone lookups, user relationships

## 🔧 How It Works

### Automated Workflow
1. **Connection Test**: Verifies Supabase credentials
2. **Table Detection**: Checks which tables exist
3. **Browser Launch**: Opens Supabase SQL Editor automatically (macOS)
4. **SQL Provision**: Shows exactly what to copy/paste
5. **Data Insertion**: Automatically inserts badges when tables exist
6. **Success Confirmation**: Shows what's ready for development

### Manual Fallback
If automation fails, the script provides:
- Direct URL to your Supabase SQL Editor
- Copy-paste ready SQL with essential tables only
- Clear step-by-step instructions

## ⚠️ Common Issues & Solutions

### Schema Syntax Errors
- ✅ **Fixed**: Removed invalid `IF NOT EXISTS` from `CREATE POLICY` statements
- ✅ **Fixed**: Added `UNIQUE` constraint to `educational_content.title` for `ON CONFLICT`
- ✅ **Solution**: Use the current `schema.sql` - it has correct PostgreSQL syntax

### Missing Tables Error
```
❌ Missing 4 tables: users, badges, wallets, otp_sessions
```
**Solution**: Follow the script's instructions to run the SQL in Supabase dashboard.

### Authentication Errors
```
❌ Supabase connection failed
```
**Solution**: Check your `.env` file has correct credentials:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Badge Insertion Fails
```
❌ Error inserting badges
```
**Solution**: This usually means tables don't exist yet. Run the SQL schema first.

## 🎯 After Successful Setup

Your database will be ready with:

### ✅ **User Onboarding Tables**
- Phone-based authentication system
- Custodial wallet management
- KYC status tracking
- Gamification foundation

### ✅ **Security Configured**
- Row Level Security (RLS) enabled
- User data isolation policies
- Service role permissions for backend operations
- Public read access for badges and educational content

### ✅ **Performance Optimized**
- Indexes on frequently queried columns
- Foreign key relationships
- Automated timestamp triggers

## 🔄 Next Development Steps

1. **Implement Auth Endpoints**:
   - Update `app/api/auth/signup+api.ts` to use real Supabase operations
   - Add proper OTP generation and SMS sending
   - Implement custodial wallet creation with Algorand SDK

2. **Test User Flow**:
   - Phone signup → OTP verification → wallet creation
   - KYC integration with MoonPay
   - Badge earning system

3. **Enable Supabase Auth**:
   - Go to Authentication → Settings in Supabase dashboard
   - Enable phone authentication
   - Configure SMS provider (Twilio recommended)

## 💡 Pro Tips

- **Run `npm run db:init` first** - It handles most cases automatically
- **Keep `schema.sql`** - Useful reference for the complete database structure
- **Check Supabase dashboard** after setup to verify tables were created
- **The script is idempotent** - Safe to run multiple times

---

**The database setup is designed to support the complete Cultivest platform with a focus on getting User Onboarding working quickly and reliably.**