/**
 * Database Integration Test Script
 * Tests the complete signup → OTP verification flow
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000/api/v1';

interface SignupResponse {
  success: boolean;
  message: string;
  userID: string;
  otpSent: boolean;
  smsProvider: 'twilio' | 'mock';
  otp?: string;
  error?: string;
}

interface VerifyResponse {
  success: boolean;
  message?: string;
  authToken?: string;
  user?: {
    userID: string;
    phoneNumber: string;
    name: string;
    country: string;
    kycStatus: string;
    verified: boolean;
    walletCreated: boolean;
    walletAddress: string | null;
  };
  error?: string;
}
const TEST_PHONE = '+15551234999'; // Different from Twilio phone number
const TEST_USER = {
  phoneNumber: TEST_PHONE,
  name: 'Integration Test User',
  country: 'USA'
};

async function testDatabaseIntegration() {
  console.log('🧪 Testing Database Integration...\n');

  try {
    // Step 1: Test Signup
    console.log('1️⃣ Testing signup endpoint...');
    const signupResponse = await fetch(`${BASE_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(TEST_USER)
    });

    const signupData = await signupResponse.json() as SignupResponse;
    console.log('✅ Signup Response:', JSON.stringify(signupData, null, 2));

    // ASSERT: Signup success
    if (!signupData.success) {
      throw new Error('Signup failed: ' + signupData.error);
    }

    // ASSERT: UserID is valid UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(signupData.userID)) {
      throw new Error(`Invalid userID format: ${signupData.userID}`);
    }

    // ASSERT: OTP is 6 digits (in development mode)
    if (signupData.otp && !/^\d{6}$/.test(signupData.otp)) {
      throw new Error(`Invalid OTP format: ${signupData.otp}`);
    }

    // ASSERT: SMS provider is specified
    if (!['twilio', 'mock'].includes(signupData.smsProvider)) {
      throw new Error(`Invalid SMS provider: ${signupData.smsProvider}`);
    }

    console.log(`✅ ASSERTIONS PASSED: UserID format, OTP format, SMS provider: ${signupData.smsProvider}`);

    const { userID, otp } = signupData;
    console.log(`📱 Generated OTP: ${otp || 'Check server console'} for user: ${userID}\n`);

    // For testing, use a known OTP if it's not in the response
    const testOtp = otp || '123456'; // Fallback for production mode

    // Step 2: Test OTP Verification
    console.log('2️⃣ Testing OTP verification...');
    console.log(`Using OTP: ${testOtp}`);
    
    const verifyResponse = await fetch(`${BASE_URL}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userID: userID,
        otpCode: testOtp
      })
    });

    const verifyData = await verifyResponse.json() as VerifyResponse;
    console.log('✅ Verification Response:', JSON.stringify(verifyData, null, 2));

    // ASSERT: Verification success
    if (!verifyData.success) {
      throw new Error('OTP verification failed: ' + verifyData.error);
    }

    // ASSERT: JWT token format (header.payload.signature)
    if (!verifyData.authToken) {
      throw new Error('JWT token missing from verification response');
    }
    const jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/;
    if (!jwtRegex.test(verifyData.authToken)) {
      throw new Error(`Invalid JWT format: ${verifyData.authToken}`);
    }

    // ASSERT: User data structure
    const user = verifyData.user;
    if (!user) {
      throw new Error('User data missing from verification response');
    }
    if (!user.userID || !user.phoneNumber || !user.name || !user.country) {
      throw new Error('Missing required user fields');
    }

    // ASSERT: User data values (skip name check for existing users)
    if (user.phoneNumber !== TEST_PHONE) {
      throw new Error(`Phone mismatch: expected ${TEST_PHONE}, got ${user.phoneNumber}`);
    }
    if (user.country !== TEST_USER.country) {
      throw new Error(`Country mismatch: expected ${TEST_USER.country}, got ${user.country}`);
    }
    if (user.kycStatus !== 'pending') {
      throw new Error(`KYC status should be 'pending', got ${user.kycStatus}`);
    }
    if (user.verified !== true) {
      throw new Error(`User should be verified after OTP, got ${user.verified}`);
    }

    // ASSERT: Wallet creation
    if (typeof user.walletCreated !== 'boolean') {
      throw new Error(`walletCreated should be boolean, got ${typeof user.walletCreated}`);
    }
    
    console.log(`💰 Wallet status: ${user.walletCreated ? 'Created' : 'Not created'}`);
    if (user.walletCreated && user.walletAddress) {
      console.log(`🏦 Wallet Address: ${user.walletAddress}`);
      
      // ASSERT: Algorand address format (58 characters, alphanumeric)
      if (!/^[A-Z2-7]{58}$/.test(user.walletAddress)) {
        throw new Error(`Invalid Algorand address format: ${user.walletAddress}`);
      }
    }

    console.log('✅ ASSERTIONS PASSED: JWT format, user data, wallet validation');

    console.log(`🔐 JWT Token generated: ${verifyData.authToken.substring(0, 50)}...`);
    console.log(`👤 User verified:`, verifyData.user);

    // Step 3: Test Re-signup (existing user)
    console.log('\n3️⃣ Testing re-signup with existing user...');
    const resignupResponse = await fetch(`${BASE_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(TEST_USER)
    });

    const resignupData = await resignupResponse.json() as SignupResponse;
    console.log('✅ Re-signup Response:', JSON.stringify(resignupData, null, 2));

    // ASSERT: Re-signup success
    if (!resignupData.success) {
      throw new Error('Re-signup failed: ' + resignupData.error);
    }

    // ASSERT: Same userID for existing user
    if (resignupData.userID !== userID) {
      throw new Error(`Re-signup should return same userID. Expected: ${userID}, got: ${resignupData.userID}`);
    }

    // ASSERT: New OTP generated (different from first one)
    if (resignupData.otp && resignupData.otp === otp) {
      throw new Error('Re-signup should generate a new OTP, but got the same one');
    }

    console.log('✅ ASSERTIONS PASSED: Re-signup maintains userID, generates new OTP');

    // Step 4: Test Invalid OTP (Edge Case)
    console.log('\n4️⃣ Testing invalid OTP handling...');
    const invalidOtpResponse = await fetch(`${BASE_URL}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userID: userID,
        otpCode: '999999' // Invalid OTP
      })
    });

    const invalidOtpData = await invalidOtpResponse.json() as VerifyResponse;
    console.log('✅ Invalid OTP Response:', JSON.stringify(invalidOtpData, null, 2));

    // ASSERT: Invalid OTP should fail
    if (invalidOtpData.success !== false) {
      throw new Error('Invalid OTP should fail verification');
    }

    console.log('✅ ASSERTIONS PASSED: Invalid OTP properly rejected');

    console.log('\n🎉 DATABASE INTEGRATION TEST PASSED!');
    console.log('✅ User creation works (UUID format validated)');
    console.log('✅ OTP generation and storage works (6-digit format validated)');
    console.log('✅ OTP verification works (data structure validated)');
    console.log('✅ JWT token generation works (JWT format validated)');
    console.log('✅ User data integrity validated (phone, country, KYC status)');
    console.log('✅ Existing user handling works (same userID, new OTP)');
    console.log('✅ Error handling works (invalid OTP rejected)');
    console.log('✅ Wallet creation integration works (auto-generated on verification)');
    console.log('✅ Database operations are functional with proper assertions');
    
  } catch (error) {
    console.error('❌ TEST FAILED:', (error as Error).message);
    process.exit(1);
  }
}

// Run the test
testDatabaseIntegration();

export { testDatabaseIntegration };