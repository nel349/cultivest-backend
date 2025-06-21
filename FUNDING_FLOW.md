# Cultivest Funding Flow - ALGO to USDCa Conversion

## 🎯 **Strategic Decision: ALGO → USDCa Approach**

Due to MoonPay's support for ALGO (but not direct USDCa), we implement a two-step funding process that maintains our stablecoin focus while providing real fiat onramp functionality.

## 🔄 **Complete Funding Flow**

### **User Experience:**
1. User clicks "Fund Wallet" with desired USD amount (e.g., $10)
2. System opens MoonPay widget for ALGO purchase
3. User completes KYC/payment with MoonPay (credit card, bank transfer)
4. ALGO arrives in user's Algorand wallet
5. **Backend automatically converts** ALGO → USDCa via Algorand DEX
6. User sees USDCa balance ready for micro-investing

### **Why This Works:**
- ✅ **Real fiat onramp** - MoonPay supports ALGO
- ✅ **Low conversion fees** - Algorand DEX fees ~0.001 ALGO
- ✅ **Stablecoin end result** - User gets USDCa for investing
- ✅ **GENIUS Act compliant** - Focus remains on stablecoins
- ✅ **Seamless UX** - User never sees ALGO, just USD → USDCa

---

## 🛠️ **Backend API Implementation**

### **1. Initiate Funding**
```http
POST /api/v1/deposit/initiate
Authorization: Bearer {jwt_token}
Content-Type: application/json

{
  "amountUSD": 10,
  "targetCurrency": "usdca"
}
```

**Response:**
```json
{
  "success": true,
  "moonpayUrl": "https://buy.moonpay.com/?walletAddress=ABC123...&currencyCode=algo&baseCurrencyAmount=10",
  "transactionId": "txn_123",
  "estimatedUSDCa": 9.95,
  "conversionRate": "1 USD ≈ 0.995 USDCa (after fees)"
}
```

### **2. Check Funding Status**
```http
GET /api/v1/deposit/status/{transactionId}
Authorization: Bearer {jwt_token}
```

**Response States:**
- `pending_payment` - Waiting for MoonPay completion
- `algo_received` - ALGO arrived, conversion in progress  
- `converting` - ALGO → USDCa swap executing
- `completed` - USDCa in wallet, ready for investing
- `failed` - Error occurred, refund initiated

### **3. Webhook Handler (Internal)**
```http
POST /api/v1/deposit/webhook/moonpay
Content-Type: application/json

{
  "type": "transaction_status_change",
  "data": {
    "id": "moonpay_tx_123",
    "status": "completed",
    "cryptoAmount": 25.5,
    "cryptoCurrency": "algo",
    "walletAddress": "ABC123..."
  }
}
```

---

## 🔄 **Auto-Conversion Logic**

### **Algorand DEX Integration:**
- **Primary**: Tinyman DEX (most liquid ALGO/USDCa pair)
- **Fallback**: Pera Swap or other Algorand DEXs
- **Slippage tolerance**: 2% maximum
- **Minimum output**: 95% of expected USDCa

### **Conversion Process:**
1. **Detect ALGO arrival** via webhook or balance polling
2. **Calculate optimal swap** - Check ALGO/USDCa rate
3. **Reserve conversion fee** - Keep 0.01 ALGO for transaction
4. **Execute swap transaction** - Submit to Algorand DEX
5. **Update user balance** - Credit USDCa to user account
6. **Send notification** - "Funding complete: $X.XX USDCa ready"

### **Error Handling:**
- **Swap fails**: Retry with higher slippage (up to 5%)
- **Low liquidity**: Hold ALGO, notify user to try again later
- **Network issues**: Queue for retry every 5 minutes
- **Partial conversion**: Convert available amount, keep remainder as ALGO

---

## 💰 **Fee Structure**

### **Total Cost Breakdown (Example $10 funding):**
1. **MoonPay fee**: ~3.5% = $0.35
2. **Algorand DEX fee**: ~0.3% = $0.03  
3. **Network fee**: ~$0.0001 (negligible)
4. **Final USDCa**: ~$9.62

### **Fee Transparency:**
- Show estimated final USDCa amount before payment
- Display breakdown: "You pay $10 → Receive ~$9.62 USDCa"
- Update estimates based on real-time DEX rates

---

## 🎨 **Frontend Integration Points**

### **Required UI Components:**
1. **Funding Modal** - Amount selection, fee display
2. **MoonPay Widget** - Embedded iframe or redirect
3. **Progress Tracker** - "Payment → ALGO → Converting → Complete"
4. **Balance Display** - Show both ALGO and USDCa balances
5. **Transaction History** - List all funding transactions

### **State Management:**
```typescript
interface FundingState {
  isLoading: boolean;
  currentStep: 'payment' | 'converting' | 'complete';
  transactionId: string;
  amountUSD: number;
  estimatedUSDCa: number;
  actualUSDCa?: number;
  error?: string;
}
```

### **Real-time Updates:**
- **WebSocket connection** for live transaction status
- **Polling fallback** - Check status every 10 seconds
- **Push notifications** - "Funding complete!" when USDCa arrives

---

## 🏗️ **Backend Architecture & Flow**

### **How the Backend Enables MoonPay Integration:**

While MoonPay's widget runs on the frontend, our backend orchestrates the complete ALGO → USDCa conversion flow:

#### **1. Deposit Initiate Endpoint (`POST /api/v1/deposit/initiate`)**
**Purpose:** Sets up the funding transaction and generates MoonPay URL
```javascript
// What it does:
1. Creates tracking record in deposits table
2. Calculates fees and estimated USDCa output  
3. Generates MoonPay URL with user's wallet pre-filled
4. Returns URL + transaction details to frontend

// Frontend gets:
{
  "moonpayUrl": "https://buy.moonpay.com/?walletAddress=ABC123&currencyCode=algo&amount=10",
  "transactionId": "deposit_123", 
  "estimatedUSDCa": 9.62,
  "conversionRate": "1 USD ≈ 0.962 USDCa (after fees)"
}
```

#### **2. MoonPay Webhook Handler (`POST /api/v1/deposit/webhook/moonpay`)**
**Purpose:** Receives notifications when MoonPay payment completes
```javascript
// What it does:
1. Verifies webhook signature from MoonPay
2. Updates deposit status: pending_payment → algo_received
3. Syncs wallet balance to detect new ALGO
4. Triggers auto-conversion ALGO → USDCa (Phase 2)
5. Marks deposit as completed when USDCa is ready
```

#### **3. Status Tracking (`GET /api/v1/deposit/status/{transactionId}`)**
**Purpose:** Provides real-time progress updates to frontend
```javascript
// Status progression:
"pending_payment" → "algo_received" → "converting" → "completed"

// Frontend can poll this to show:
- "Waiting for payment..."
- "ALGO received, converting..."  
- "USDCa ready for investing!"
```

### **Complete User Journey:**

```
👤 User Action          🖥️  Frontend          🔧 Backend              🏦 MoonPay
─────────────────────────────────────────────────────────────────────────────────

1. Clicks "Fund $10"  →  Calls /deposit/     →  Creates tracking      
                          initiate              record, returns URL    

2.                     ←  Opens MoonPay       ←  
                          widget/iframe           

3. Pays with card     →                      →                       →  Processes
                                                                         payment

4.                                           ←  Webhook: "completed"  ←  Sends ALGO
                                               Updates status             to wallet

5.                     ←  Shows "Converting"  ←  Auto-converts         
                          progress               ALGO → USDCa           

6.                     ←  "Funding complete!" ←  Updates balance       
                                               USDCa ready!            
```

### **Why Backend is Essential:**

- **🔐 Security**: Webhook signature verification, secure credential handling
- **📊 Tracking**: Complete transaction lifecycle management  
- **💱 Conversion**: Orchestrates ALGO → USDCa swap via Algorand DEX
- **📱 UX**: Provides real-time status updates to frontend
- **💰 Transparency**: Accurate fee calculation and balance management
- **🛡️ Reliability**: Error handling, retry logic, failed transaction recovery

### **Key Backend Services:**

```typescript
// MoonPay Service (utils/moonpay.ts)
- generateWidgetUrl()     // Creates signed MoonPay URLs
- verifyWebhookSignature() // Validates webhook authenticity  
- calculateEstimatedUSDCa() // Fee calculation and estimates

// Database Integration
- deposits table          // Tracks all funding transactions
- Real-time status updates // Frontend polling endpoint
- Wallet balance sync     // Keeps balances current
```

**This architecture transforms a simple "buy crypto" widget into a complete stablecoin funding solution!** 🚀

---

## 🔗 **External Dependencies**

### **MoonPay Configuration:**
- **API Key**: Publishable key for widget
- **Webhook URL**: `https://api.cultivest.com/v1/deposit/webhook/moonpay`
- **Supported countries**: US, Canada, EU (expand as needed)
- **Payment methods**: Credit card, bank transfer, Apple Pay

### **Algorand DEX Integration:**
- **Tinyman SDK**: Primary DEX for swaps
- **AlgoSDK**: Transaction signing and submission
- **Rate APIs**: Real-time ALGO/USDCa pricing

### **Environment Variables:**
```env
MOONPAY_API_KEY=pk_live_...
MOONPAY_SECRET_KEY=sk_live_...
MOONPAY_WEBHOOK_SECRET=whsec_...
TINYMAN_APP_ID=552635992
USDC_ASSET_ID=31566704
```

---

## 🧪 **Testing Strategy**

### **Testnet Testing:**
1. **MoonPay Sandbox** - Test payment flows without real money
2. **Algorand Testnet** - Test ALGO → USDCa conversion
3. **Mock webhooks** - Simulate MoonPay completion events

### **Integration Tests:**
- End-to-end funding flow
- Webhook reliability
- DEX swap execution
- Error recovery scenarios

### **Production Monitoring:**
- **Conversion success rate** - Target >95%
- **Average completion time** - Target <5 minutes
- **Fee accuracy** - Estimated vs actual USDCa amounts
- **Failed transaction handling** - Auto-retry success rate

---

## 📋 **Implementation Priority**

### **Phase 1: Basic Funding (MVP)**
1. ✅ MoonPay integration - Generate buy URLs
2. ✅ Webhook handler - Detect ALGO arrival  
3. ✅ Manual conversion - Admin can trigger ALGO → USDCa
4. ✅ Balance updates - Credit USDCa to user accounts

### **Phase 2: Auto-Conversion**
1. ⏳ DEX integration - Automated ALGO → USDCa swaps
2. ⏳ Real-time rates - Dynamic conversion estimates
3. ⏳ Error handling - Retry logic and failure recovery

### **Phase 3: Production Polish**
1. ⏳ Fee optimization - Multiple DEX routing
2. ⏳ Advanced monitoring - Transaction analytics
3. ⏳ User notifications - Email/SMS updates

---

## 🎯 **Frontend Development Notes**

**When building the frontend:**
1. **Focus on USDCa UX** - User should think "USD → USDCa" not "USD → ALGO → USDCa"
2. **Emphasize stablecoin benefits** - "Stable value for consistent investing"
3. **GENIUS Act compliance** - Highlight regulatory compliance features
4. **Micro-investment focus** - "$1-$10 investments made easy"
5. **Transparent fees** - Always show final USDCa amount upfront

**This maintains the stablecoin vision while providing practical fiat onramp functionality.** 🚀