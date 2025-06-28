import express from 'express';
import { generateSolanaWallet, getSolanaPrice, getSolanaNetworkInfo } from '../../../utils/solana';

const router = express.Router();

/**
 * Debug endpoint to test Solana integration
 * GET /api/debug/solana-status
 */
router.get('/', async (_req, res) => {
  try {
    console.log('🟣 Testing Solana integration...');

    // Test wallet generation
    let walletTest = null;
    try {
      console.log('🔐 Testing Solana wallet generation...');
      const testWallet = generateSolanaWallet();
      walletTest = {
        success: true,
        address: testWallet.address,
        addressLength: testWallet.address.length,
        hasEncryptedKey: !!testWallet.encryptedPrivateKey,
        encryptedKeyLength: testWallet.encryptedPrivateKey.length
      };
      console.log('✅ Solana wallet generation successful');
    } catch (error) {
      console.error('❌ Solana wallet generation failed:', error);
      walletTest = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    // Test price fetching
    let priceTest = null;
    try {
      console.log('💰 Testing Solana price fetching...');
      const price = await getSolanaPrice();
      priceTest = {
        success: true,
        currentPrice: price,
        priceValid: price > 0
      };
      console.log(`✅ SOL price: $${price}`);
    } catch (error) {
      console.error('❌ Solana price fetching failed:', error);
      priceTest = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    // Test network connection
    let networkTest = null;
    try {
      console.log('🌐 Testing Solana network connection...');
      const networkInfo = await getSolanaNetworkInfo();
      networkTest = {
        success: networkInfo.isHealthy,
        network: networkInfo.network,
        rpcUrl: networkInfo.rpcUrl,
        currentSlot: networkInfo.currentSlot,
        version: networkInfo.version,
        error: networkInfo.error
      };
      console.log(`✅ Solana network: ${networkInfo.network} (${networkInfo.isHealthy ? 'healthy' : 'unhealthy'})`);
    } catch (error) {
      console.error('❌ Solana network test failed:', error);
      networkTest = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    // Overall status
    const allTestsPassed = walletTest?.success && priceTest?.success && networkTest?.success;

    const response = {
      success: allTestsPassed,
      timestamp: new Date().toISOString(),
      solana: {
        wallet: walletTest,
        price: priceTest,
        network: networkTest
      },
      summary: {
        walletGeneration: walletTest?.success ? '✅ Working' : '❌ Failed',
        priceAPI: priceTest?.success ? '✅ Working' : '❌ Failed',
        networkConnection: networkTest?.success ? '✅ Working' : '❌ Failed',
        overallStatus: allTestsPassed ? '🟢 All systems operational' : '🔴 Issues detected'
      },
      nextSteps: allTestsPassed ? [
        'Solana testnet integration is ready to use (MoonPay compatible)',
        'Run database migration: add-solana-support.sql',
        'Test wallet creation with Solana support',
        'MoonPay Solana testnet support is enabled'
      ] : [
        'Fix failed tests before proceeding',
        'Check network connectivity',
        'Verify Solana dependencies are installed'
      ]
    };

    if (allTestsPassed) {
      console.log('🎉 All Solana tests passed!');
    } else {
      console.log('⚠️ Some Solana tests failed');
    }

    return res.json(response);

  } catch (error) {
    console.error('Solana status check error:', error);
    return res.status(500).json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

export default router; 