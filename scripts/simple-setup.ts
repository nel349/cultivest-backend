import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const checkTablesExist = async () => {
  const tables = ['users', 'badges', 'wallets', 'otp_sessions'];
  const tableStatus: { [key: string]: boolean } = {};
  
  for (const tableName of tables) {
    try {
      const { error } = await supabase.from(tableName).select('*').limit(1);
      tableStatus[tableName] = !error || !error.message.includes('does not exist');
    } catch (error) {
      tableStatus[tableName] = false;
    }
  }
  
  return tableStatus;
};

const insertSampleData = async () => {
  console.log('\n📝 Inserting sample data...');

  try {
    // Insert badges
    const badges = [
      {
        name: 'First Investor',
        description: 'Made your first investment in stablecoin yields',
        criteria: { type: 'first_investment', min_amount: 1 },
        category: 'first_steps'
      },
      {
        name: 'First $10',
        description: 'Invested your first $10',
        criteria: { type: 'investment_amount', min_amount: 10 },
        category: 'first_steps'
      },
      {
        name: 'Safe Saver',
        description: 'Completed the stablecoin safety quiz',
        criteria: { type: 'quiz_completion', quiz_type: 'stablecoin_safety' },
        category: 'education'
      }
    ];

    const { error: badgeError } = await supabase
      .from('badges')
      .upsert(badges, { onConflict: 'name' });

    if (badgeError) {
      console.error('❌ Error inserting badges:', badgeError);
      return false;
    }

    console.log('✅ Sample badges inserted successfully');
    return true;
  } catch (error) {
    console.error('❌ Error inserting sample data:', error);
    return false;
  }
};

const openSupabaseDashboard = () => {
  const dashboardUrl = supabaseUrl.replace('/rest/v1', '/project/default/sql');
  console.log(`\n🌐 Opening Supabase SQL Editor: ${dashboardUrl}`);
  
  // Try to open browser (works on macOS)
  try {
    require('child_process').exec(`open "${dashboardUrl}"`);
    console.log('✅ Browser opened automatically');
  } catch (error) {
    console.log('💡 Please manually navigate to the URL above');
  }
};

const main = async () => {
  console.log('🚀 Cultivest Database Setup\n');

  // Check table status
  console.log('🔍 Checking database tables...');
  const tableStatus = await checkTablesExist();
  
  const missingTables = Object.entries(tableStatus)
    .filter(([_, exists]) => !exists)
    .map(([name]) => name);

  // Display status
  Object.entries(tableStatus).forEach(([table, exists]) => {
    console.log(`${exists ? '✅' : '❌'} ${table} table ${exists ? 'exists' : 'missing'}`);
  });

  if (missingTables.length > 0) {
    console.log(`\n❌ Missing ${missingTables.length} tables: ${missingTables.join(', ')}\n`);
    
    console.log('🔧 QUICK SETUP INSTRUCTIONS:\n');
    console.log('1. I will open your Supabase SQL Editor in a browser');
    console.log('2. Copy and paste the SQL below');
    console.log('3. Click "RUN" in Supabase');
    console.log('4. Come back and run: npm run db:init\n');

    // Open browser automatically
    openSupabaseDashboard();

    console.log('📋 COPY THIS SQL:\n');
    console.log('```sql');
    console.log(`-- Cultivest Essential Tables
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

CREATE TABLE IF NOT EXISTS wallets (
  wallet_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  algorand_address VARCHAR(58) UNIQUE NOT NULL,
  encrypted_private_key TEXT NOT NULL,
  asset_id INTEGER DEFAULT 31566704,
  balance_usdca DECIMAL(18,6) DEFAULT 0,
  balance_algo DECIMAL(18,6) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS badges (
  badge_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT NOT NULL,
  criteria JSONB NOT NULL,
  icon_url VARCHAR(255),
  category VARCHAR(50) DEFAULT 'general',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_phone_number ON users(phone_number);
CREATE INDEX IF NOT EXISTS idx_users_supabase_auth_id ON users(supabase_auth_id);
CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_wallets_algorand_address ON wallets(algorand_address);
CREATE INDEX IF NOT EXISTS idx_otp_phone_number ON otp_sessions(phone_number);
CREATE INDEX IF NOT EXISTS idx_otp_expires_at ON otp_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_badges_category ON badges(category);`);
    console.log('```\n');
    
    console.log('⏳ After running the SQL, come back and run: npm run db:init');
    process.exit(1);
  }

  // All tables exist, insert sample data
  console.log('\n✅ All tables exist! Proceeding with data setup...');
  
  const dataSuccess = await insertSampleData();
  
  if (dataSuccess) {
    console.log('\n🎉 Database setup completed successfully!\n');
    console.log('📊 Your Cultivest database is ready with:');
    console.log('  ✅ users - User profiles and authentication');
    console.log('  ✅ wallets - Custodial Algorand wallet management');
    console.log('  ✅ otp_sessions - Phone number verification system');
    console.log('  ✅ badges - Gamification achievement system');
    console.log('  ✅ Sample badge data for testing\n');
    
    console.log('🔄 Next Steps:');
    console.log('  1. Start implementing real auth endpoints');
    console.log('  2. Test the signup → OTP → wallet creation flow');
    console.log('  3. Integrate with MoonPay for KYC');
  } else {
    console.log('\n⚠️ Tables exist but sample data insertion failed');
    console.log('You can proceed with implementation anyway');
  }

  process.exit(0);
};

main().catch((error) => {
  console.error('💥 Setup failed:', error);
  process.exit(1);
});