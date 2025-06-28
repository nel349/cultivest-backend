import { generateBitcoinWallet, decryptBitcoinPrivateKey } from '../utils/bitcoin';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function generateKeys() {
  console.log('🔐 Generating new Bitcoin keys...\n');
  
  try {
    // Generate a new wallet
    const result = await generateBitcoinWallet();
    
    if (!result.success) {
      console.error('❌ Failed to generate wallet:', result.error);
      return;
    }
    
    console.log('✅ Bitcoin wallet generated successfully!\n');
    console.log('📧 Public Address (for receiving Bitcoin):');
    console.log(`   ${result.address}\n`);
    
    // Decrypt the private key for display
    if (result.encryptedPrivateKey) {
      try {
        const privateKey = decryptBitcoinPrivateKey(result.encryptedPrivateKey);
        console.log('🔑 Private Key (WIF format - keep this SECRET):');
        console.log(`   ${privateKey}\n`);
        
        console.log('⚠️  IMPORTANT SECURITY NOTES:');
        console.log('   • Keep your private key safe and never share it');
        console.log('   • Anyone with this private key can control your Bitcoin');
        console.log('   • Store it securely (password manager, hardware wallet, etc.)');
        console.log('   • This is generated on TESTNET by default - check your .env file');
        
      } catch (error) {
        console.error('❌ Failed to decrypt private key:', error);
      }
    }
    
  } catch (error) {
    console.error('❌ Error generating Bitcoin keys:', error);
  }
}

// Run the script
generateKeys().catch(console.error); 