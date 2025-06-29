# API Migration Guide - Unified Investment System

## Overview

Cultivest has consolidated its investment APIs from separate Bitcoin and deposit endpoints into a unified multi-crypto investment system. This guide helps developers migrate from the legacy APIs to the new unified approach.

## Summary of Changes

### ✅ NEW: Unified Investment System
- **Single Endpoint**: `/users/{userId}/invest` handles all crypto types
- **Multi-Crypto Support**: Bitcoin, Ethereum, Solana, Algorand, USDC
- **Automatic NFTs**: Portfolio and Position NFTs created automatically
- **Webhook Integration**: MoonPay webhooks trigger investment creation

### ⚠️ DEPRECATED: Legacy Endpoints
- `POST /deposit/initiate` → Use `/users/{userId}/invest`
- `POST /investment/initiate` → Use `/users/{userId}/invest`
- `POST /investment/bitcoin/initiate` → Use `/users/{userId}/invest`
- `GET /investment/positions` → Use `/users/{userId}/investments`

## Migration Steps

### 1. Replace Deposit Endpoints

**❌ OLD (Deprecated):**
```javascript
// Legacy deposit endpoint
const response = await fetch('/api/v1/deposit/initiate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    amountUSD: 100,
    targetCurrency: 'btc'
  })
});
```

**✅ NEW (Unified):**
```javascript
// Unified investment endpoint
const response = await fetch(`/api/v1/users/${userId}/invest`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    algorandAddress: userWallet.algorand_address,
    assetType: 1, // Bitcoin
    amountUSD: 100,
    useMoonPay: true,
    riskAccepted: true,
    portfolioName: 'My Bitcoin Portfolio'
  })
});
```

### 2. Update Asset Type Mapping

```javascript
const ASSET_TYPES = {
  BITCOIN: 1,
  ALGORAND: 2,
  USDC: 3,
  SOLANA: 4,
  ETHEREUM: 5
};

// Example: Bitcoin investment
const bitcoinInvestment = {
  assetType: ASSET_TYPES.BITCOIN,
  amountUSD: 100,
  useMoonPay: true,
  riskAccepted: true
};
```

### 3. Replace Investment Position Queries

**❌ OLD (Deprecated):**
```javascript
// Legacy investment positions
const positions = await fetch('/api/v1/investment/positions', {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

**✅ NEW (Unified):**
```javascript
// User-specific investments
const investments = await fetch(`/api/v1/users/${userId}/investments`);

// Specific position details
const position = await fetch(`/api/v1/users/${userId}/investments/${positionTokenId}`);
```

### 4. Update React Native/Frontend Code

**❌ OLD (Multiple Methods):**
```javascript
// Legacy API client methods
class OldApiClient {
  async initiateDeposit(amountUSD, targetCurrency) {
    return this.request('/deposit/initiate', {
      method: 'POST',
      body: JSON.stringify({ amountUSD, targetCurrency })
    });
  }
  
  async initiateBitcoinInvestment(userID, amountUSD) {
    return this.request('/investment/bitcoin/initiate', {
      method: 'POST', 
      body: JSON.stringify({ userID, amountUSD })
    });
  }
}
```

**✅ NEW (Unified Method):**
```javascript
// Unified API client
class NewApiClient {
  async createUserInvestment(userID, investmentData) {
    return this.request(`/users/${userID}/invest`, {
      method: 'POST',
      body: JSON.stringify(investmentData)
    });
  }
  
  // Convenience methods for specific crypto types
  async buyBitcoin(userID, amountUSD, riskAccepted = false) {
    return this.createUserInvestment(userID, {
      assetType: 1,
      amountUSD,
      useMoonPay: true,
      riskAccepted,
      algorandAddress: 'AUTO_FETCH'
    });
  }
  
  async buyEthereum(userID, amountUSD, riskAccepted = false) {
    return this.createUserInvestment(userID, {
      assetType: 5,
      amountUSD,
      useMoonPay: true,
      riskAccepted,
      algorandAddress: 'AUTO_FETCH'
    });
  }
}
```

## Request/Response Format Changes

### Investment Creation Request

**NEW Format:**
```json
{
  "algorandAddress": "ALGORAND_WALLET_ADDRESS",
  "assetType": 1,
  "amountUSD": 100,
  "useMoonPay": true,
  "riskAccepted": true,
  "portfolioName": "My Bitcoin Portfolio"
}
```

**Fields:**
- `algorandAddress`: User's Algorand wallet (used for NFT ownership)
- `assetType`: 1=BTC, 2=ALGO, 3=USDC, 4=SOL, 5=ETH
- `amountUSD`: Investment amount in USD
- `useMoonPay`: true for MoonPay purchases, false for direct investment recording
- `riskAccepted`: Risk acknowledgment (required for MoonPay)
- `portfolioName`: Optional custom portfolio name

### Investment Response

**NEW Format:**
```json
{
  "success": true,
  "data": {
    "message": "Investment recorded successfully",
    "investment": {
      "positionTokenId": "123",
      "portfolioTokenId": "456",
      "assetType": "1",
      "assetTypeName": "Bitcoin",
      "holdings": "50000000",
      "purchaseValueUsd": "10000",
      "owner": "ALGORAND_ADDRESS",
      "investmentId": "uuid",
      "status": "completed"
    },
    "portfolio": {
      "id": 1,
      "tokenId": "456",
      "customName": "My Bitcoin Portfolio",
      "isPrimary": true
    },
    "blockchain": {
      "positionTransactionId": "TXN_ID",
      "portfolioTransactionId": "TXN_ID",
      "positionAppId": "APP_ID",
      "portfolioAppId": "APP_ID"
    },
    "moonpay": {
      "url": "https://moonpay.com/widget...",
      "targetAsset": "BTC",
      "estimatedAmount": 0.0015,
      "cryptoPrice": 65000,
      "fees": {
        "moonpayFee": 3.5,
        "networkFee": 0.25,
        "total": 3.75
      }
    }
  }
}
```

## Error Handling Updates

### Risk Acknowledgment Required

```json
{
  "success": false,
  "error": "Bitcoin investment risk acknowledgment required",
  "requiresRiskDisclosure": true,
  "riskFactors": [
    "Bitcoin prices are highly volatile",
    "Past performance doesn't guarantee future results",
    "You may lose some or all investment",
    "Custodial wallets mean Cultivest manages keys",
    "Consider risk tolerance before investing"
  ]
}
```

### Wallet Validation Errors

```json
{
  "success": false,
  "error": "Bitcoin wallet not found. Please create a new wallet to enable Bitcoin support."
}
```

## Webhook Processing Changes

### MoonPay Webhook Integration

The new system processes MoonPay webhooks automatically:

1. **Webhook Received**: `/deposit/webhook` endpoint processes MoonPay transaction updates
2. **Investment Creation**: Webhook automatically creates investment records and NFTs
3. **No Manual Processing**: Eliminates need for manual investment creation after MoonPay completion

**Webhook Flow:**
```
MoonPay Transaction → Webhook → Investment Record → Position NFT → Portfolio NFT
```

## Testing Migration

### 1. Update Test Scripts

**api-tests.http updates:**
```http
### NEW: Unified Bitcoin Investment
POST {{baseUrl}}/users/test-user-id/invest
Content-Type: application/json

{
  "algorandAddress": "ALGORAND_WALLET_ADDRESS",
  "assetType": 1,
  "amountUSD": 100,
  "useMoonPay": true,
  "riskAccepted": true,
  "portfolioName": "Test Bitcoin Portfolio"
}

### NEW: Get User Investments
GET {{baseUrl}}/users/test-user-id/investments
```

### 2. Integration Test Updates

```javascript
// Test unified investment creation
describe('Unified Investment System', () => {
  test('should create Bitcoin investment with NFTs', async () => {
    const response = await apiClient.createUserInvestment(testUserId, {
      algorandAddress: testWallet.algorand_address,
      assetType: 1, // Bitcoin
      amountUSD: 100,
      useMoonPay: true,
      riskAccepted: true
    });
    
    expect(response.success).toBe(true);
    expect(response.data.investment.positionTokenId).toBeDefined();
    expect(response.data.investment.portfolioTokenId).toBeDefined();
    expect(response.data.moonpay.url).toContain('moonpay.com');
  });
});
```

## Deprecation Timeline

### Phase 1: Soft Deprecation (Current)
- ⚠️ Legacy endpoints return deprecation warnings
- 📚 Documentation updated with migration guides
- 🔄 Both old and new endpoints functional

### Phase 2: Hard Deprecation (Future)
- 🚫 Legacy endpoints return 410 Gone status
- 📱 Client applications must use unified endpoints
- 🗑️ Legacy code removal

### Phase 3: Complete Removal (Future)
- 🔥 Legacy endpoint code deleted
- 📖 Documentation cleanup
- 🎯 Unified system only

## Benefits of Migration

### For Developers
- **Simplified API**: Single endpoint for all crypto investments
- **Better Type Safety**: Consistent request/response formats
- **Reduced Complexity**: No need to manage multiple investment flows

### For Users
- **Seamless Experience**: Unified interface across all crypto types
- **Automatic NFTs**: Portfolio tracking via blockchain-based NFTs
- **Better Reliability**: Webhook-driven processing reduces manual errors

### For Platform
- **Maintainability**: Single codebase for all investment types
- **Scalability**: Easy to add new cryptocurrencies
- **Consistency**: Unified data models and business logic

## Support and Questions

- **Documentation**: See `/docs/INVESTMENT_API.md` for complete API reference
- **Examples**: Check `/api-tests.http` for updated test cases
- **Issues**: Report migration issues via GitHub Issues
- **Migration Help**: Contact the development team for assistance

---

**Migration Deadline**: Please migrate to the unified system as legacy endpoints will be deprecated in future releases.