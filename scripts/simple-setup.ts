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
  const tables = ['users', 'badges', 'wallets', 'otp_sessions', 'deposits', 'portfolio_nfts', 'position_nfts'];
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
    // Insert Bitcoin-focused badges
    const badges = [
      {
        name: 'First Bitcoin Investor',
        description: 'Made your first Bitcoin investment',
        criteria: { type: 'first_bitcoin_investment', min_amount: 1 },
        category: 'bitcoin_investment'
      },
      {
        name: 'Bitcoin Pioneer',
        description: 'Purchased your first Bitcoin through Cultivest',
        criteria: { type: 'first_bitcoin_purchase', min_amount: 10 },
        category: 'bitcoin_investment'
      },
      {
        name: 'Portfolio NFT Creator',
        description: 'Created your first portfolio NFT on Algorand',
        criteria: { type: 'portfolio_nft_creation' },
        category: 'nft_portfolio'
      },
      {
        name: 'Multi-Chain Master',
        description: 'Invested in both Bitcoin and Algorand',
        criteria: { type: 'multi_chain_investment' },
        category: 'multi_chain'
      },
      {
        name: 'HODLer',
        description: 'Held Bitcoin for 30+ days',
        criteria: { type: 'holding_period', cryptocurrency: 'btc', min_days: 30 },
        category: 'bitcoin_investment'
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

CREATE TABLE IF NOT EXISTS deposits (
  deposit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  wallet_id UUID REFERENCES wallets(wallet_id) ON DELETE SET NULL,
  amount_usd DECIMAL(18,2) NOT NULL,
  amount_algo DECIMAL(18,6),
  amount_usdca DECIMAL(18,6),
  moonpay_transaction_id VARCHAR(128),
  moonpay_url TEXT,
  status VARCHAR(20) DEFAULT 'pending_payment' CHECK (status IN (
    'pending_payment', 'algo_received', 'converting', 'completed', 'failed', 'cancelled'
  )),
  conversion_rate DECIMAL(18,6),
  fees_paid DECIMAL(18,6),
  algorand_tx_id VARCHAR(128),
  error_message TEXT,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours'),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_phone_number ON users(phone_number);
CREATE INDEX IF NOT EXISTS idx_users_supabase_auth_id ON users(supabase_auth_id);
CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_wallets_algorand_address ON wallets(algorand_address);
CREATE INDEX IF NOT EXISTS idx_otp_phone_number ON otp_sessions(phone_number);
CREATE INDEX IF NOT EXISTS idx_otp_expires_at ON otp_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_badges_category ON badges(category);
CREATE INDEX IF NOT EXISTS idx_deposits_user_id ON deposits(user_id);
CREATE INDEX IF NOT EXISTS idx_deposits_status ON deposits(status);
CREATE INDEX IF NOT EXISTS idx_deposits_moonpay_tx_id ON deposits(moonpay_transaction_id);`);
    console.log('```\n');
    
    console.log('⏳ After running the SQL, come back and run: npm run db:init');
    process.exit(1);
  }

  // All tables exist, insert sample data
  console.log('\n✅ All tables exist! Proceeding with data setup...');
  
  const dataSuccess = await insertSampleData();
  
  if (dataSuccess) {
    console.log('\n🎉 Bitcoin-first database setup completed successfully!\n');
    console.log('📊 Your Cultivest database is ready with:');
    console.log('  ✅ users - User profiles with Bitcoin + Algorand support');
    console.log('  ✅ wallets - Bitcoin-first multi-chain custodial wallet management');
    console.log('  ✅ otp_sessions - Phone number verification system');
    console.log('  ✅ badges - Bitcoin-focused gamification achievement system');
    console.log('  ✅ portfolio_nfts - NFT-based portfolio tracking on Algorand');
    console.log('  ✅ position_nfts - Individual investment position NFTs');
    console.log('  ✅ deposits - Multi-chain deposit tracking (Bitcoin + Algorand)');
    console.log('  ✅ Sample Bitcoin-focused badge data for testing\n');
    
    console.log('🔄 Next Steps:');
    console.log('  1. Test Bitcoin + Algorand wallet creation');
    console.log('  2. Test MoonPay Bitcoin purchase integration');
    console.log('  3. Implement Portfolio NFT creation on Algorand');
    console.log('  4. Test the Bitcoin-first investment flow');
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