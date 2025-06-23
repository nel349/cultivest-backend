import { createClient } from '@supabase/supabase-js';
import { generateBitcoinWallet } from '../utils/bitcoin';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function migrateExistingUsers() {
  console.log('🔄 Migrating existing users to Bitcoin + Algorand wallets...\n');

  try {
    // First, check if migration columns exist
    const { data: wallets, error: fetchError } = await supabase
      .from('wallets')
      .select('wallet_id, user_id, bitcoin_address')
      .limit(1);

    if (fetchError && fetchError.message.includes('bitcoin_address')) {
      console.log('❌ Bitcoin migration not run yet. Please run:');
      console.log('   1. Execute scripts/bitcoin-migration.sql in Supabase');
      console.log('   2. Then run this script again');
      return;
    }

    // Get all users without Bitcoin addresses
    const { data: usersToMigrate, error } = await supabase
      .from('wallets')
      .select('wallet_id, user_id, bitcoin_address')
      .is('bitcoin_address', null);

    if (error) {
      console.error('❌ Error fetching users:', error);
      return;
    }

    console.log(`📊 Found ${usersToMigrate?.length || 0} users to migrate`);

    if (!usersToMigrate || usersToMigrate.length === 0) {
      console.log('✅ All users already have Bitcoin wallets!');
      return;
    }

    // Migrate each user
    for (const wallet of usersToMigrate) {
      console.log(`🔐 Generating Bitcoin wallet for user ${wallet.user_id}...`);
      
      const bitcoinWallet = generateBitcoinWallet();
      
      if (bitcoinWallet.success) {
        const { error: updateError } = await supabase
          .from('wallets')
          .update({
            bitcoin_address: bitcoinWallet.address,
            encrypted_bitcoin_private_key: bitcoinWallet.encryptedPrivateKey,
            balance_btc: 0,
            blockchain: 'multi-chain'
          })
          .eq('wallet_id', wallet.wallet_id);

        if (updateError) {
          console.error(`❌ Failed to update wallet ${wallet.wallet_id}:`, updateError);
        } else {
          console.log(`✅ Updated wallet ${wallet.wallet_id} with Bitcoin address: ${bitcoinWallet.address}`);
        }
      } else {
        console.error(`❌ Failed to generate Bitcoin wallet for user ${wallet.user_id}:`, bitcoinWallet.error);
      }
    }

    console.log('\n🎉 Migration completed!');
    
  } catch (error) {
    console.error('💥 Migration failed:', error);
  }
}

if (require.main === module) {
  migrateExistingUsers();
}

export { migrateExistingUsers };