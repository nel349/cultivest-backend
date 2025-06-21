# User Onboarding Implementation Checklist

**Progress Tracker for implementing real User Onboarding backend functionality**

Based on FEATURES.md requirements vs current mock implementations.

## 🎯 **User Onboarding Requirements**
- [ ] Phone-based signup with OTP verification
- [ ] MoonPay KYC-light integration (name, country, <2 min)
- [ ] Custodial wallet creation
- [ ] Web support for signup (Expo Router)

---

## ✅ **Database Setup** 
- [x] ✅ **Supabase Integration** - Connection and credentials configured
- [x] ✅ **Database Schema** - All tables created (users, wallets, otp_sessions, badges)
- [x] ✅ **Sample Data** - Default badges and educational content inserted
- [x] ✅ **Row Level Security** - Proper access policies configured

---

## ✅ **1. Database Integration (COMPLETED)**

### ~~Current: Mock responses only~~
### ✅ **DONE: Real Supabase operations implemented**

- [x] ✅ **Supabase Client Setup**
  - [x] Initialize Supabase client in auth endpoints (`utils/supabase.ts`)
  - [x] Add proper error handling for database operations (`handleDatabaseError`)
  - [x] Test database connectivity from backend (`testDatabaseConnection`)

- [x] ✅ **User Table Operations**
  - [x] Create user records in `users` table during signup (`signup+api.ts:92`)
  - [x] Handle existing users gracefully (re-signup flow) (`signup+api.ts:86`)
  - [ ] Link users to Supabase Auth IDs (deferred - not needed for hackathon)
  - [ ] Update user profiles and KYC status (will implement with KYC)

- [ ] **Database Schema Validation**
  - [x] ✅ Database schema working (users, otp_sessions tables functional)
  - [ ] Test user data isolation with RLS policies (low priority for hackathon)
  - [ ] Validate indexes are working for performance (low priority for hackathon)

---

## 📱 **2. Real OTP System Implementation**

### Current: Hardcoded OTP "123456"
### Required: SMS provider integration with database storage

- [x] ✅ **SMS Provider Setup**
  - [x] Choose SMS provider (Twilio implemented with mock fallback)
  - [x] Add SMS provider credentials to .env
  - [x] Create SMS sending utility function (`utils/sms.ts`)

- [x] ✅ **OTP Generation & Storage**
  - [x] Generate random 6-digit OTP codes (`signup+api.ts:118`)
  - [x] Store OTP in `otp_sessions` table with expiration (10 minutes) (`signup+api.ts:128`)
  - [x] Implement OTP cleanup for expired sessions (`verify-otp+api.ts:133`)

- [x] ✅ **OTP Verification**
  - [x] Verify OTP against database records (`verify-otp+api.ts:42`)
  - [x] Track attempt counts and prevent brute force (`verify-otp+api.ts:68`)
  - [x] Mark OTP sessions as verified after success (`verify-otp+api.ts:88`)

- [ ] **Rate Limiting**
  - [ ] Limit OTP requests per phone number (1 per 60 seconds)
  - [ ] Limit verification attempts (5 max per OTP)
  - [ ] Block suspicious phone numbers temporarily

---

## 🏛️ **3. MoonPay KYC Integration**

### Current: Mock KYC approval
### Required: Real MoonPay SDK integration

- [ ] **MoonPay SDK Setup**
  - [ ] Install MoonPay Node.js SDK
  - [ ] Add MoonPay API credentials to .env
  - [ ] Create MoonPay client wrapper

- [ ] **KYC Data Submission**
  - [ ] Send user data (name, country, phone) to MoonPay
  - [ ] Handle KYC-light workflow (no ID required for <$1,000/year)
  - [ ] Process MoonPay response and status codes

- [ ] **KYC Status Tracking**
  - [ ] Update user `kyc_status` in database
  - [ ] Handle KYC approval/rejection workflows
  - [ ] Store MoonPay user ID for future transactions

- [ ] **GENIUS Act Compliance**
  - [ ] Implement required identity verification checks
  - [ ] Add compliance logging and reporting
  - [ ] Ensure data privacy and retention policies

---

## 🔐 **4. Custodial Wallet Creation**

### Current: Mock wallet creation flag
### Required: Real Algorand wallet generation and secure storage

- [ ] **Algorand SDK Integration**
  - [ ] Install and configure Algorand SDK
  - [ ] Set up Algorand testnet/mainnet connection
  - [ ] Create wallet generation utilities

- [ ] **Secure Wallet Generation**
  - [ ] Generate new Algorand wallet keypairs
  - [ ] Create USDCa asset opt-in transactions
  - [ ] Verify wallet addresses on Algorand network

- [ ] **Private Key Encryption**
  - [ ] Implement AES-256 encryption for private keys
  - [ ] Store encrypted keys in `wallets` table
  - [ ] Set up secure key derivation functions (KDF)

- [ ] **Wallet Management**
  - [ ] Create wallet records linked to users
  - [ ] Implement wallet address validation
  - [ ] Add wallet balance querying functionality

---

## 🔑 **5. Authentication System Enhancement**

### Current: Mock auth tokens
### Required: JWT tokens and session management

- [x] ✅ **JWT Token System**
  - [x] Generate proper JWT tokens after verification (`verify-otp+api.ts:8`)
  - [x] Include user ID and permissions in token payload
  - [x] Set appropriate token expiration (24 hours) (`verify-otp+api.ts:15`)
  - [x] JWT_SECRET configured in environment variables

- [ ] **Supabase Auth Integration**
  - [ ] Link custom auth flow with Supabase Auth
  - [ ] Create Supabase auth users after OTP verification
  - [ ] Sync custom user records with Supabase Auth IDs

- [ ] **Session Management**
  - [ ] Implement refresh token mechanism
  - [ ] Add token validation middleware
  - [ ] Handle token expiration and renewal

- [ ] **Auth Middleware**
  - [ ] Create JWT validation middleware for protected routes
  - [ ] Add user context injection for authenticated requests
  - [ ] Implement role-based access control

---

## 📝 **6. API Endpoint Updates**

### Files to Update with Real Implementations

- [x] ✅ **`/app/api/auth/signup+api.ts`**
  - [x] Replace mock user creation with real Supabase operations
  - [x] Add real OTP generation (SMS sending pending Twilio setup)
  - [x] Implement proper input validation and sanitization
  - [ ] Add rate limiting and security measures (deferred)

- [x] ✅ **`/app/api/auth/verify-otp+api.ts`**
  - [x] Replace hardcoded OTP with database verification
  - [x] Generate real JWT tokens
  - [x] Update user verification status (OTP marked as verified)
  - [ ] Trigger custodial wallet creation process (next phase)

- [ ] **`/app/api/user/kyc+api.ts`**
  - [ ] Replace mock KYC with real MoonPay integration
  - [ ] Add proper KYC data validation
  - [ ] Implement compliance status tracking
  - [ ] Update user profile with KYC results

### New API Endpoints to Create

- [ ] **`/app/api/wallet/create+api.ts`**
  - [ ] Algorand wallet generation endpoint
  - [ ] Private key encryption and storage
  - [ ] Wallet address verification
  - [ ] USDCa asset opt-in handling

- [ ] **`/middleware/auth.ts`**
  - [ ] JWT token validation middleware
  - [ ] User authentication context
  - [ ] Protected route handling
  - [ ] Error handling for invalid tokens

---

## 🔧 **7. Environment Variables Setup**

### Required Environment Variables

- [x] ✅ **Supabase Configuration**
  ```env
  SUPABASE_URL=✅ configured
  SUPABASE_ANON_KEY=✅ configured  
  SUPABASE_SERVICE_ROLE_KEY=✅ configured
  ```

- [ ] **SMS Provider (Twilio)**
  ```env
  TWILIO_ACCOUNT_SID=your_twilio_sid
  TWILIO_AUTH_TOKEN=your_twilio_token
  TWILIO_PHONE_NUMBER=your_twilio_phone
  ```

- [ ] **MoonPay Integration**
  ```env
  MOONPAY_API_KEY=your_moonpay_api_key
  MOONPAY_SECRET_KEY=your_moonpay_secret
  MOONPAY_ENVIRONMENT=sandbox # or production
  ```

- [ ] **Algorand Configuration**
  ```env
  ALGORAND_ALGOD_URL=https://testnet-algorand.api.purestake.io/ps2
  ALGORAND_ALGOD_TOKEN=your_algorand_token
  ALGORAND_NETWORK=testnet # or mainnet
  ```

- [x] ✅ **Security Keys**
  ```env
  JWT_SECRET=✅ configured
  ENCRYPTION_KEY=pending (will add with wallet encryption)
  ```

---

## 🧪 **8. Testing & Validation**

### Unit Testing

- [ ] **Database Operations**
  - [ ] Test user creation and retrieval
  - [ ] Test OTP session management
  - [ ] Test wallet creation and encryption
  - [ ] Test KYC status updates

- [ ] **Authentication Flow**
  - [ ] Test signup → OTP → verification flow
  - [ ] Test JWT token generation and validation
  - [ ] Test rate limiting and security measures
  - [ ] Test error handling and edge cases

### Integration Testing

- [ ] **End-to-End User Onboarding**
  - [ ] Complete signup flow with real phone number
  - [ ] OTP delivery and verification
  - [ ] KYC submission and approval
  - [ ] Wallet creation and verification

- [ ] **External Service Integration**
  - [ ] MoonPay KYC API testing
  - [ ] SMS delivery testing
  - [ ] Algorand network connectivity
  - [ ] Supabase database operations

---

## 🚀 **9. Deployment Preparation**

### Production Readiness

- [ ] **Environment Configuration**
  - [ ] Set up production environment variables
  - [ ] Configure production Supabase project
  - [ ] Set up production MoonPay account

- [ ] **Security Hardening**
  - [ ] Implement proper CORS policies
  - [ ] Add request rate limiting
  - [ ] Set up monitoring and logging
  - [ ] Configure SSL/TLS properly

- [ ] **Performance Optimization**
  - [ ] Database query optimization
  - [ ] Caching strategies for frequent operations
  - [ ] Error handling and retry logic
  - [ ] Load testing for expected user volume

---

## ✅ **Success Criteria**

### Acceptance Criteria from FEATURES.md

- [ ] **Onboarding**: User signs up with phone (+234), verifies via OTP, enters name/country. MoonPay KYC-light completes in <2 min.
- [ ] **Verification**: 90% of 10 test users (5 U.S., 5 Nigeria) successfully complete onboarding on Algorand testnet.
- [ ] **Wallet Creation**: Custodial Algorand wallets are created and encrypted properly.
- [ ] **KYC Integration**: Real MoonPay KYC-light integration working with proper status tracking.

### Technical Validation

- [ ] **Database**: All user data properly stored with RLS working
- [ ] **Security**: Private keys encrypted, JWT tokens secure, rate limiting active
- [ ] **Performance**: Onboarding completes in <2 minutes end-to-end
- [ ] **Reliability**: 95%+ success rate for the complete onboarding flow

---

## 📋 **Next Steps**

1. **Start with Database Integration** - Get Supabase operations working in signup endpoint
2. **Implement OTP System** - Add real SMS sending and verification
3. **Create Wallet Generation** - Implement Algorand wallet creation
4. **Add KYC Integration** - Connect with MoonPay APIs
5. **Test End-to-End** - Validate complete user onboarding flow

---

**Goal: Transform mock implementations into production-ready User Onboarding system that meets all FEATURES.md requirements.**