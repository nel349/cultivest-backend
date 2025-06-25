#!/usr/bin/env node
/**
 * Test Script for Cryptocurrency Prices API
 * Run with: node test-prices-api.js
 */

const API_BASE = 'http://localhost:3000/api/v1';

async function testPricesAPI() {
  console.log('🧪 Testing Cryptocurrency Prices API...\n');

  try {
    // Test 1: Get all prices
    console.log('📡 Test 1: GET /api/v1/prices');
    const allPricesResponse = await fetch(`${API_BASE}/prices`);
    const allPricesData = await allPricesResponse.json();
    
    if (allPricesResponse.ok) {
      console.log('✅ All prices fetch successful!');
      console.log('💰 Bitcoin Price:', `$${allPricesData.prices.bitcoin.usd.toLocaleString()}`);
      console.log('💰 Algorand Price:', `$${allPricesData.prices.algorand.usd.toFixed(4)}`);
      console.log('💰 USDC Price:', `$${allPricesData.prices['usd-coin'].usd.toFixed(4)}`);
      console.log('🕒 Cache Status:', allPricesData.cache.cached ? 'Cached' : 'Fresh');
      console.log('⏰ Cache Age:', `${allPricesData.cache.ageSeconds}s\n`);
    } else {
      console.log('❌ All prices fetch failed:', allPricesData.error);
    }

    // Test 2: Get specific coin (Bitcoin)
    console.log('📡 Test 2: GET /api/v1/prices/bitcoin');
    const btcResponse = await fetch(`${API_BASE}/prices/bitcoin`);
    const btcData = await btcResponse.json();
    
    if (btcResponse.ok) {
      console.log('✅ Bitcoin price fetch successful!');
      console.log('₿ Bitcoin Price:', `$${btcData.price.usd.toLocaleString()}\n`);
    } else {
      console.log('❌ Bitcoin price fetch failed:', btcData.error);
    }

    // Test 3: Get specific coin (Algorand)
    console.log('📡 Test 3: GET /api/v1/prices/algorand');
    const algoResponse = await fetch(`${API_BASE}/prices/algorand`);
    const algoData = await algoResponse.json();
    
    if (algoResponse.ok) {
      console.log('✅ Algorand price fetch successful!');
      console.log('⚡ Algorand Price:', `$${algoData.price.usd.toFixed(4)}\n`);
    } else {
      console.log('❌ Algorand price fetch failed:', algoData.error);
    }

    // Test 4: Test invalid coin
    console.log('📡 Test 4: GET /api/v1/prices/invalid-coin');
    const invalidResponse = await fetch(`${API_BASE}/prices/invalid-coin`);
    const invalidData = await invalidResponse.json();
    
    if (!invalidResponse.ok) {
      console.log('✅ Invalid coin properly rejected!');
      console.log('⚠️ Error:', invalidData.error, '\n');
    } else {
      console.log('❌ Invalid coin should have been rejected\n');
    }

    // Test 5: Force refresh cache
    console.log('📡 Test 5: POST /api/v1/prices/refresh');
    const refreshResponse = await fetch(`${API_BASE}/prices/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const refreshData = await refreshResponse.json();
    
    if (refreshResponse.ok) {
      console.log('✅ Cache refresh successful!');
      console.log('🔄 Message:', refreshData.message);
      console.log('💰 Fresh Bitcoin Price:', `$${refreshData.prices.bitcoin.toLocaleString()}\n`);
    } else {
      console.log('❌ Cache refresh failed:', refreshData.error);
    }

    // Test 6: Get cache status
    console.log('📡 Test 6: GET /api/v1/prices/cache/status');
    const statusResponse = await fetch(`${API_BASE}/prices/cache/status`);
    const statusData = await statusResponse.json();
    
    if (statusResponse.ok) {
      console.log('✅ Cache status fetch successful!');
      console.log('💾 Has Cached Prices:', statusData.cache.hasCachedPrices);
      console.log('✔️ Cache Valid:', statusData.cache.cacheValid);
      console.log('⏱️ Cache Age:', `${statusData.cache.cacheAgeSeconds}s`);
      console.log('🕒 Last Updated:', statusData.cache.lastUpdated);
    } else {
      console.log('❌ Cache status fetch failed:', statusData.error);
    }

    console.log('\n🎉 API Testing Complete!');

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    console.log('\n💡 Make sure the backend server is running on port 3000');
    console.log('   Run: npm run dev');
  }
}

// Run the test
testPricesAPI();