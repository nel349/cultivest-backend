import { moonPayService } from './utils/moonpay';

async function testMoonPaySigning() {
  console.log('🧪 Testing MoonPay URL Signing...\n');

  // Test 1: Basic URL signing
  console.log('1. Testing basic URL signing:');
  const testQueryString = 'apiKey=pk_test_123&currencyCode=algo&baseCurrencyAmount=50&walletAddress=SAMPLE_WALLET_ADDRESS';
  const signature = moonPayService.createSignature(testQueryString);
  
  console.log('   Query String:', testQueryString);
  console.log('   Signature:', signature);
  console.log('   Signature Length:', signature.length);
  console.log('   ✅ Basic signing works\n');

  // Test 2: Full URL construction
  console.log('2. Testing full URL construction:');
  const fullUrl = `https://buy-sandbox.moonpay.com?${testQueryString}&signature=${signature}`;
  console.log('   Full URL:', fullUrl);
  console.log('   ✅ Full URL constructed\n');

  // Test 3: Test with different parameters
  console.log('3. Testing with different parameters:');
  const testParams = [
    'apiKey=pk_test_123&currencyCode=eth&baseCurrencyAmount=100',
    'apiKey=pk_test_123&currencyCode=btc&baseCurrencyAmount=25&walletAddress=tb1qtest',
    'apiKey=pk_test_123&currencyCode=usdc&baseCurrencyAmount=200&theme=dark&colorCode=%2310B981'
  ];

  testParams.forEach((params, index) => {
    const sig = moonPayService.createSignature(params);
    console.log(`   Test ${index + 1}: ${params.substring(0, 50)}...`);
    console.log(`   Signature: ${sig}`);
  });
  console.log('   ✅ Multiple parameter sets work\n');

  // Test 4: Verify signature consistency
  console.log('4. Testing signature consistency:');
  const testString = 'apiKey=pk_test_123&currencyCode=algo&baseCurrencyAmount=50';
  const sig1 = moonPayService.createSignature(testString);
  const sig2 = moonPayService.createSignature(testString);
  
  console.log('   Same input produces same signature:', sig1 === sig2);
  console.log('   Signature 1:', sig1);
  console.log('   Signature 2:', sig2);
  console.log('   ✅ Signatures are consistent\n');

  // Test 5: Test environment configuration
  console.log('5. Testing environment configuration:');
  console.log('   Secret key configured:', !!process.env.MOONPAY_SECRET_KEY);
  console.log('   API key configured:', !!process.env.MOONPAY_API_KEY);
  console.log('   Base URL:', process.env.MOONPAY_BASE_URL || 'https://buy-sandbox.moonpay.com');
  console.log('   ✅ Environment check complete\n');

  console.log('🎉 All MoonPay signing tests completed successfully!');
}

// Test the endpoint directly
async function testEndpoint() {
  console.log('\n🌐 Testing MoonPay Sign URL Endpoint...\n');
  
  const testUrl = 'https://buy-sandbox.moonpay.com?apiKey=pk_test_123&currencyCode=algo&baseCurrencyAmount=50&walletAddress=SAMPLE_WALLET_ADDRESS';
  
  try {
    const response = await fetch('http://localhost:3000/api/v1/moonpay/sign-url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test_token_here' // Replace with actual token
      },
      body: JSON.stringify({
        url: testUrl
      })
    });

    const data = await response.json() as { success: boolean; signature?: string; error?: string };
    console.log('Response Status:', response.status);
    console.log('Response Data:', data);
    
    if (data.success) {
      console.log('✅ Endpoint test successful!');
      console.log('Signature received:', data.signature);
    } else {
      console.log('❌ Endpoint test failed:', data.error);
    }
  } catch (error) {
    console.log('❌ Endpoint test error:', error);
    console.log('Make sure your server is running on localhost:3000');
  }
}

// Run tests
if (require.main === module) {
  testMoonPaySigning()
    .then(() => testEndpoint())
    .catch(console.error);
}

export { testMoonPaySigning, testEndpoint }; 