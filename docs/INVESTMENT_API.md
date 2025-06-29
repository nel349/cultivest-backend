# Investment API Documentation

## Overview

The Cultivest Investment API provides a unified system for handling cryptocurrency investments across multiple assets (Bitcoin, Ethereum, Solana, Algorand, USDC) with automatic NFT creation and portfolio management.

## Architecture

### Unified Investment Flow

All cryptocurrency investments now use a single endpoint: `/users/{userId}/invest`

**Supported Assets:**
- Bitcoin (BTC) - Asset Type 1
- Algorand (ALGO) - Asset Type 2  
- USDC - Asset Type 3
- Solana (SOL) - Asset Type 4
- Ethereum (ETH) - Asset Type 5

### Investment Modes

1. **MoonPay Purchase Mode**: User pays with credit card via MoonPay widget
2. **Direct Investment Mode**: Direct recording of completed investments

### Automatic NFT Creation

Every investment automatically creates:
- **Position NFT**: Represents the specific investment position
- **Portfolio NFT**: Container for all user positions (auto-created if needed)

## API Endpoints

### POST /users/{userId}/invest

Creates a new investment position with automatic NFT minting.

#### Request Body

```json
{
  // Required for all investments
  "algorandAddress": "string",
  "assetType": 1-5,
  
  // MoonPay Purchase Mode
  "amountUSD": 100,
  "useMoonPay": true,
  "riskAccepted": true,
  "portfolioName": "My Bitcoin Portfolio",
  
  // Direct Investment Mode  
  "holdings": 50000000,
  "purchaseValueUsd": 10000
}
```

#### Asset Type Mapping

| Asset Type | Cryptocurrency | Units |
|------------|----------------|--------|
| 1 | Bitcoin (BTC) | Satoshis (1 BTC = 100,000,000 sats) |
| 2 | Algorand (ALGO) | Microalgos (1 ALGO = 1,000,000 μALGO) |
| 3 | USDC | MicroUSDC (1 USDC = 1,000,000 μUSDC) |
| 4 | Solana (SOL) | Lamports (1 SOL = 1,000,000,000 lamports) |
| 5 | Ethereum (ETH) | Wei (1 ETH = 10^18 wei) |

#### Response

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

### GET /users/{userId}/investments

Retrieves user's investment summary.

#### Response

```json
{
  "success": true,
  "data": {
    "hasInvestments": true,
    "portfolio": {
      "id": 1,
      "tokenId": "456",
      "customName": "My Portfolio", 
      "isPrimary": true,
      "positionCount": 3
    },
    "positions": [
      {
        "tokenId": "123",
        "assetType": 1,
        "assetTypeName": "Bitcoin",
        "holdings": "50000000",
        "purchaseValue": "10000"
      }
    ],
    "stats": {
      "totalValue": 12500,
      "totalPositions": 3
    }
  }
}
```

### GET /users/{userId}/investments/{positionTokenId}

Retrieves specific investment position details.

## Price Calculation

### Bitcoin
- Uses MoonPay's real-time Bitcoin pricing API
- Includes MoonPay fees (~3.8% total)
- Converts to satoshis for blockchain storage

### Solana  
- Uses Solana price feeds
- Custom fee calculation
- Converts to lamports

### Algorand & USDC
- Uses CoinGecko price feeds
- Standard 3.8% fee structure
- Converts to microunits

### Ethereum
- Mock pricing (TODO: Implement real price feeds)
- Converts to wei

## MoonPay Integration

### Widget URL Generation

```javascript
moonPayService.generateWidgetUrl({
  walletAddress: "USER_WALLET_ADDRESS",
  currencyCode: "btc|eth|sol|algo|usdc", 
  baseCurrencyAmount: 100,
  redirectURL: "https://app.cultivest.com/success",
  externalTransactionId: "cultivest_btc_INVESTMENT_ID"
})
```

### External Transaction ID Format

- Bitcoin: `cultivest_btc_{investmentId}`
- Ethereum: `cultivest_eth_{investmentId}`
- Solana: `cultivest_sol_{investmentId}`
- Algorand: `cultivest_algo_{investmentId}`
- USDC: `cultivest_usdc_{investmentId}`

## Risk Acknowledgment

All MoonPay purchases require risk acceptance:

```json
{
  "riskAccepted": true,
  "riskFactors": [
    "Crypto prices are highly volatile",
    "Past performance doesn't guarantee future results", 
    "You may lose some or all investment",
    "Custodial wallets mean Cultivest manages keys",
    "Consider risk tolerance before investing"
  ]
}
```

## Error Handling

### Validation Errors

```json
{
  "success": false,
  "error": "For MoonPay purchase: algorandAddress and amountUSD (1-10000) are required"
}
```

### Risk Disclosure Required

```json
{
  "success": false,
  "error": "Bitcoin investment risk acknowledgment required",
  "requiresRiskDisclosure": true,
  "riskFactors": ["..."]
}
```

### Wallet Errors

```json
{
  "success": false,
  "error": "Bitcoin wallet not found. Please create a new wallet to enable Bitcoin support."
}
```

## Database Schema

### investments table

```sql
CREATE TABLE investments (
  investment_id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  wallet_id UUID,
  investment_type VARCHAR(50), -- 'btc_purchase', 'direct_investment', etc.
  target_asset VARCHAR(10),    -- 'BTC', 'ETH', 'SOL', 'ALGO', 'USDC'
  amount_usd DECIMAL(10,2),
  status VARCHAR(20),          -- 'completed', 'pending', 'failed'
  risk_acknowledged BOOLEAN,
  
  -- Crypto-specific fields
  estimated_btc DECIMAL(18,8),
  bitcoin_price_usd DECIMAL(10,2),
  estimated_sol DECIMAL(18,8), 
  solana_price_usd DECIMAL(10,2),
  estimated_eth DECIMAL(18,8),
  ethereum_price_usd DECIMAL(10,2),
  
  fees_paid DECIMAL(10,2),
  moonpay_url TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

## Migration from Legacy Endpoints

### Deprecated Endpoints

⚠️ **DEPRECATED** - Use `/users/{userId}/invest` instead:

- `POST /deposit/initiate` 
- `POST /investment/initiate`
- `POST /investment/bitcoin/initiate`

### Client Migration

**Old Pattern:**
```javascript
// ❌ Deprecated
await apiClient.initiateDeposit(100, 'btc');
await apiClient.initiateBitcoinInvestment(userId, 100);
```

**New Pattern:**
```javascript  
// ✅ Unified approach
await apiClient.createUserInvestment(userId, {
  algorandAddress: wallet.algorand_address,
  assetType: 1, // Bitcoin
  amountUSD: 100,
  useMoonPay: true,
  riskAccepted: true
});
```

## Testing

### Development Mode

In development/testnet mode:
- MoonPay sandbox doesn't process real transactions
- Webhook can be configured to auto-create investments
- Testnet faucets available as alternative

### Test Data

```bash
# Create test Bitcoin investment
curl -X POST /api/users/test-user-id/invest \
  -H "Content-Type: application/json" \
  -d '{
    "algorandAddress": "ALGORAND_ADDRESS",
    "assetType": 1,
    "amountUSD": 100,
    "useMoonPay": true,
    "riskAccepted": true,
    "portfolioName": "Test Bitcoin Portfolio"
  }'
```

## Security Considerations

1. **Authentication**: JWT required for all endpoints (pending implementation)
2. **Wallet Validation**: Ensures user owns the specified wallet addresses
3. **Amount Limits**: $1-$10,000 per transaction
4. **Risk Disclosure**: Required for all investments
5. **Signature Verification**: MoonPay webhook signatures verified

## Next Steps

- [ ] Add JWT authentication to `/users/{userId}/invest`
- [ ] Implement real price feeds for Ethereum
- [ ] Complete webhook consolidation
- [ ] Add transaction monitoring
- [ ] Implement withdrawal functionality