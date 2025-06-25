# Cultivest Algorand Architecture Guide

## 🚀 Efficient Nested NFT System

### Architecture Decision: Single Contract, Multiple Tokens

We've implemented an **efficient nested NFT approach** using two smart contracts that mint multiple tokens:

```
┌─────────────────────────────────────────────────────────────────┐
│                 CULTIVEST EFFICIENT NFT SYSTEM                 │
├─────────────────────────────────────────────────────────────────┤
│  PORTFOLIO NFT CONTRACT (App ID: 1000)                        │
│  ├── Portfolio Token #1 (owns Position tokens 1,2,3)          │
│  ├── Portfolio Token #2 (owns Position tokens 4,5)            │
│  ├── Portfolio Token #3 (owns Position tokens 6,7,8,9)        │
│  └── Aggregates metrics, manages ownership                     │
├─────────────────────────────────────────────────────────────────┤
│  POSITION NFT CONTRACT (App ID: 2000)                         │
│  ├── Bitcoin Position Token #1 (10,000 sats + key ref)        │
│  ├── Algorand Position Token #2 (5 ALGO)                      │
│  ├── USDC Position Token #3 ($25 USDC)                        │
│  ├── Bitcoin Position Token #4 (50,000 sats + key ref)        │
│  └── Individual holdings + custodial key references            │
├─────────────────────────────────────────────────────────────────┤
│  COST EFFICIENCY                                               │
│  ├── 2 contract deployments total (not per-position)           │
│  ├── 0.001 ALGO per Position token mint                        │
│  ├── 0.001 ALGO per Portfolio token mint                       │
│  └── Unlimited tokens per contract                             │
├─────────────────────────────────────────────────────────────────┤
│  CUSTODIAL INTEGRATION                                         │
│  ├── Position token metadata includes encrypted key refs       │
│  ├── Key re-encryption on Position token transfer              │
│  ├── Off-chain event processing via Algorand Indexer           │
│  └── Opt-out mechanism for self-custody                        │
├─────────────────────────────────────────────────────────────────┤
│  OFF-CHAIN INTEGRATION                                         │
│  ├── Backend APIs (investment tracking)                        │
│  ├── React Native display                                      │
│  ├── Algorand Indexer (event processing)                       │
│  └── Supabase DB (historical analytics + encrypted keys)       │
└─────────────────────────────────────────────────────────────────┘
```

### Implementation Details:

#### **Contract Architecture:**
- **Language**: Algorand TypeScript (`@algorandfoundation/algorand-typescript`) 
- **2 Smart Contracts**: Portfolio NFT + Position NFT (not per-token)
- **Portfolio Tokens**: Containers that reference Position token IDs
- **Position Tokens**: Individual asset holdings with custodial key references
- **Box Storage**: Efficient metadata storage for unlimited tokens
- **Money Tree Levels**: 1-5 based on aggregated portfolio value
- **Security**: Multi-signature authorization + reentrancy protection

## 🔧 Nested NFT Implementation

### Portfolio NFT Contract (Mints Multiple Portfolio Tokens)

```typescript
@contract({
  name: 'CultivestPortfolioNFT',
  stateTotals: { 
    globalUints: 3,   // nextTokenId, totalSupply, contractVersion
    globalBytes: 2,   // authorizedMinter, contractName
    localUints: 0,
    localBytes: 0,
    boxes: { count: 10000, bytes: 300 } // Portfolio token metadata
  }
})
export class CultivestPortfolioNFT extends Contract {
  // Token management
  nextTokenId = GlobalState<uint64>();
  totalSupply = GlobalState<uint64>();
  authorizedMinter = GlobalState<Account>();
  
  // Mint new portfolio token
  @abimethod()
  mintPortfolio(owner: Account, positionTokenIds: Bytes): uint64 {
    const tokenId = this.nextTokenId.value;
    
    // Store portfolio metadata in box
    this.boxes(op.itob(tokenId)).value = op.concat(
      owner.bytes,                    // Portfolio owner
      op.itob(op.Global.latestTimestamp), // Created timestamp
      op.itob(1),                     // Initial level
      op.itob(0),                     // Initial total value
      positionTokenIds                // Comma-separated position token IDs
    );
    
    this.nextTokenId.value = tokenId + 1;
    this.totalSupply.value = this.totalSupply.value + 1;
    
    log(op.concat(Bytes('portfolio_minted:'), op.itob(tokenId)));
    return tokenId;
  }
}
```

### Position NFT Contract (Mints Multiple Position Tokens)

```typescript
@contract({
  name: 'CultivestPositionNFT',
  stateTotals: { 
    globalUints: 3,   // nextTokenId, totalSupply, contractVersion
    globalBytes: 2,   // authorizedMinter, contractName
    localUints: 0,
    localBytes: 0,
    boxes: { count: 100000, bytes: 200 } // Position token metadata
  }
})
export class CultivestPositionNFT extends Contract {
  // Token management
  nextTokenId = GlobalState<uint64>();
  totalSupply = GlobalState<uint64>();
  authorizedMinter = GlobalState<Account>();
  
  // Mint new position token
  @abimethod()
  mintPosition(
    owner: Account,
    assetType: uint64,     // 1=BTC, 2=ALGO, 3=USDC
    holdings: uint64,      // satoshis/microALGO/microUSDC
    purchaseValueUSD: uint64,
    privateKeyRef: Bytes   // Reference to encrypted key
  ): uint64 {
    const tokenId = this.nextTokenId.value;
    
    // Store position metadata in box
    this.boxes(op.itob(tokenId)).value = op.concat(
      owner.bytes,                    // Position owner
      op.itob(assetType),            // Asset type
      op.itob(holdings),             // Holdings amount
      op.itob(purchaseValueUSD),     // Purchase value
      op.itob(op.Global.latestTimestamp), // Created timestamp
      privateKeyRef                   // Encrypted key reference
    );
    
    this.nextTokenId.value = tokenId + 1;
    this.totalSupply.value = this.totalSupply.value + 1;
    
    log(op.concat(Bytes('position_minted:'), op.itob(tokenId), Bytes(':'), op.itob(assetType)));
    return tokenId;
  }
}
```

### Core Methods

#### Portfolio NFT Contract Methods:
```typescript
// Contract initialization (only on deployment)
@abimethod({ onCreate: 'require' })
createApplication(): void

// Mint new portfolio token for user
@abimethod()
mintPortfolio(owner: Account, positionTokenIds: Bytes): uint64

// Add position token to portfolio
@abimethod()
addPositionToPortfolio(portfolioTokenId: uint64, positionTokenId: uint64): void

// Remove position token from portfolio  
@abimethod()
removePositionFromPortfolio(portfolioTokenId: uint64, positionTokenId: uint64): void

// Update portfolio aggregated value
@abimethod()
updatePortfolioValue(portfolioTokenId: uint64, newTotalValueUSD: uint64): void

// Transfer portfolio token ownership
@abimethod()
transferPortfolio(portfolioTokenId: uint64, newOwner: Account): void

// Query portfolio token data (read-only)
@abimethod({ readonly: true })
getPortfolioInfo(portfolioTokenId: uint64): [Account, uint64, uint64, Bytes] // owner, level, totalValue, positionTokenIds
```

#### Position NFT Contract Methods:
```typescript
// Contract initialization (only on deployment)
@abimethod({ onCreate: 'require' })
createApplication(): void

// Mint new position token
@abimethod()
mintPosition(owner: Account, assetType: uint64, holdings: uint64, 
             purchaseValueUSD: uint64, privateKeyRef: Bytes): uint64

// Update position token holdings and value
@abimethod()
updatePosition(positionTokenId: uint64, newHoldings: uint64, newCurrentValueUSD: uint64): void

// Transfer position token ownership (triggers key re-encryption)
@abimethod()
transferPosition(positionTokenId: uint64, newOwner: Account): void

// Burn position token (sell/withdraw all holdings)
@abimethod()
burnPosition(positionTokenId: uint64): void

// Query position token data (read-only)
@abimethod({ readonly: true })
getPositionInfo(positionTokenId: uint64): [Account, uint64, uint64, uint64, Bytes] // owner, assetType, holdings, currentValue, privateKeyRef
```

### Event Logging for Off-Chain Processing

#### Portfolio NFT Events:
```typescript
// Log portfolio creation
log('portfolio_created');

// Log position addition/removal
log(op.concat(Bytes('position_added:'), op.itob(positionNFTAppId)));
log(op.concat(Bytes('position_removed:'), op.itob(positionNFTAppId)));

// Log portfolio value updates
log(op.concat(Bytes('portfolio_value_update:'), op.itob(this.totalValueUSD.value)));

// Log portfolio ownership transfers
log('portfolio_ownership_transfer');
```

#### Position NFT Events:
```typescript
// Log position creation
log(op.concat(Bytes('position_created:'), op.itob(this.assetType.value)));

// Log position updates
log(op.concat(Bytes('position_update:'), op.itob(this.currentValueUSD.value)));

// Log position ownership transfers (triggers key re-encryption)
log(op.concat(Bytes('position_ownership_transfer:'), this.privateKeyRef.value));

// Log position burns
log('position_burned');
```

## 💰 Cost Analysis

### Per-Operation Costs:

| Operation | Cost (ALGO) | Description |
|-----------|-------------|-------------|
| Deploy Portfolio Contract | 0.001 | One-time system deployment |
| Deploy Position Contract | 0.001 | One-time system deployment |
| Mint Portfolio Token | 0.001 | Per user portfolio creation |
| Mint Position Token | 0.001 | Per asset position (BTC/ALGO/USDC) |
| Update Position Metadata | 0.001 | Regular holdings/price updates |
| Transfer Position Token | 0.001 | Individual asset transfer |
| Transfer Portfolio Token | 0.001 | Transfer entire portfolio |
| Burn Position Token | 0.001 | Sell/withdraw specific asset |
| Query Token Data | 0.001 | Read operations |

### Total System Cost:
- **System Setup**: 0.002 ALGO (one-time, deploy 2 contracts)
- **New User**: 0.001 ALGO (mint portfolio token)
- **First Investment (3 positions)**: 0.003 ALGO (mint 3 position tokens)
- **Monthly Updates**: 0.003-0.03 ALGO (depending on activity)
- **Position Transfer**: 0.001 ALGO (transfer specific token)
- **Massively efficient**: 2 contracts support unlimited users/positions

## 🚀 Scaling Considerations

### Multi-User Scaling:
```
System deployment: 0.002 ALGO (one-time)
1,000 users × 1 portfolio token = 1 ALGO
1,000 users × 3 position tokens = 3 ALGO  
1,000 users × 3 positions × 12 updates/year = 36 ALGO/year
1,000 users × 10 position transfers/year = 10 ALGO/year
Total: 4 ALGO setup + 46 ALGO/year = ~$5/year for 1,000 users
```

### Performance Optimizations:

#### 1. **Batch Updates**
```python
# Update multiple portfolios in single transaction group
batch_update_txns = [
    update_portfolio_1,
    update_portfolio_2,
    update_portfolio_3,
    # ... up to 16 per group
]
```

#### 2. **Lazy Updates**
```typescript
// Only update positions when values change significantly
const threshold = 100; // $1.00 threshold
if (Math.abs(newValue - currentValue) > threshold) {
  await positionNFT.updatePosition(newHoldings, newValueUSD);
}
```

#### 3. **Aggregated Portfolio Updates**
```typescript
// Update portfolio value by aggregating all Position NFTs
// Done off-chain, then stored on Portfolio NFT
const totalValue = positions.reduce((sum, pos) => sum + pos.currentValueUSD, 0);
await portfolioNFT.updatePortfolioValue(totalValue);
```

#### 4. **Position NFT Caching**
```typescript
// Cache Position NFT references to avoid repeated lookups
const positionNFTIds = await portfolioNFT.getPositionNFTs();
const cachedPositions = new Map<number, PositionNFTClient>();
```

## 🔒 Security Best Practices

### 1. **Access Control**
```typescript
// Portfolio NFT: Only owner can transfer portfolio
assert(Txn.sender === this.owner.value);

// Position NFT: Owner or authorized updater can modify
const isOwner = Txn.sender === this.owner.value;
const isAuthorized = Txn.sender === this.authorizedUpdater.value;
assert(isOwner || isAuthorized);

// Portfolio operations: Only backend can add/remove positions
assert(Txn.sender === this.authorizedUpdater.value);
```

### 2. **Input Validation**
```typescript
// Validate asset types
assert(assetType >= 1 && assetType <= 3); // 1=BTC, 2=ALGO, 3=USDC

// Validate holdings amounts
assert(holdings > 0 && holdings <= MAX_HOLDINGS);

// Validate portfolio references
assert(portfolioNFTId > 0);

// Validate private key references
assert(privateKeyRef.length > 0);
```

### 3. **Ownership Transfer Security**
```typescript
// Position NFT transfers trigger off-chain key re-encryption
@abimethod()
transferPosition(newOwner: Account): void {
  assert(Txn.sender === this.owner.value);
  
  const oldOwner = this.owner.value;
  this.owner.value = newOwner;
  
  // Log for off-chain key re-encryption
  log(op.concat(
    Bytes('key_reencryption_needed:'),
    this.privateKeyRef.value,
    Bytes(':'),
    oldOwner.bytes,
    Bytes(':'),
    newOwner.bytes
  ));
}
```

## 📊 Monitoring & Analytics

### On-Chain Events:
```typescript
// Portfolio NFT events
log(op.concat(
  Bytes('portfolio_value_update:'),
  op.itob(this.totalValueUSD.value),
  Bytes(','),
  op.itob(op.Global.latestTimestamp)
));

// Position NFT events with custodial integration
log(op.concat(
  Bytes('position_transfer:'),
  this.privateKeyRef.value,
  Bytes(','),
  oldOwner.bytes,
  Bytes(','),
  newOwner.bytes
));
```

### Off-Chain Integration:
- **Algorand Indexer**: Subscribe to Position NFT transfer events
- **Supabase Database**: Store encrypted private keys and ownership mapping
- **Key Re-encryption Service**: Automatically re-encrypt keys when Position NFTs transfer
- **Portfolio Analytics**: Aggregate Position NFT data for dashboard display
- **Opt-out Detection**: Monitor when users withdraw to self-custody (breaks tracking)

## 🚀 Deployment & Integration

### Current Tech Stack:
- **Smart Contracts**: Algorand TypeScript (`@algorandfoundation/algorand-typescript`)
- **Deployment**: AlgoKit with separate deploy configs for Portfolio and Position NFTs
- **Testing**: AlgoKit test framework with nested NFT interaction tests
- **Backend Integration**: Node.js + TypeScript clients for both contract types
- **Frontend**: React Native with nested NFT display and partial transfer UI
- **Custodial Service**: Supabase + key re-encryption service
- **Event Processing**: Algorand Indexer + automated key management

### Local Development:
```bash
# Deploy Portfolio NFT contract (one contract, unlimited portfolio tokens)
algokit project deploy localnet portfolio-nft

# Deploy Position NFT contract (one contract, unlimited position tokens)
algokit project deploy localnet position-nft

# Test deployment
algokit project deploy localnet hello_world  # Reference working contract

# Contract locations
contracts/cultivest_contract/projects/cultivest_contract-contracts/smart_contracts/portfolio-nft/
contracts/cultivest_contract/projects/cultivest_contract-contracts/smart_contracts/position-nft/
```

### Integration Points:
- **Backend APIs**: Generated TypeScript clients for both Portfolio and Position NFTs
- **React Native**: Display nested NFT structure with drill-down capabilities
- **Investment Flow**: Create Position NFTs when investments complete, link to Portfolio NFT
- **Price Updates**: Update individual Position NFT values, aggregate to Portfolio NFT
- **Transfer Flow**: Handle Position NFT transfers with automatic key re-encryption
- **Partial Operations**: Enable users to transfer/sell individual positions, not entire portfolio

## ✅ Current Status:
- ✅ **Current Portfolio NFT**: Flat structure implemented and deployed
- 🔄 **Efficient Architecture**: Redesign both contracts to mint multiple tokens
- 🔄 **Position NFT Contract**: Create single contract that mints position tokens
- 🔄 **Portfolio NFT Refactor**: Convert to token-minting contract
- 🔄 **Custodial Integration**: Key re-encryption service
- 🔄 **API Integration**: Support efficient token-based operations
- 🔄 **Frontend Display**: Token-based NFT structure with partial transfer UI

## 🎨 Use Cases Enabled by Efficient Token Structure:

### 1. **Partial Position Transfers**
```
User A: Portfolio Token #1 containing [Position Token #5 (10K sats), Position Token #6 (5 ALGO), Position Token #7 ($25 USDC)]
User A transfers Position Token #5 (Bitcoin) to User B
Result: User A keeps Portfolio Token #1 with [Position Token #6, #7]
        User B receives Position Token #5 (10K sats)
```

### 2. **Individual Asset Management**
```
User wants to:
- Sell only Bitcoin position → Burn Position Token #5 (Bitcoin)
- Gift ALGO to friend → Transfer Position Token #6 (Algorand)  
- Keep USDC for stability → Retain Position Token #7 (USDC)
```

### 3. **Cross-Chain Custody**
```
Position Token Transfer:
1. Position Token ownership changes on Algorand
2. Algorand Indexer detects ownership change event
3. Backend re-encrypts Bitcoin private key for new owner
4. New owner can access their Bitcoin via Position Token
```

### 4. **Massive Scalability**
```
System Efficiency:
- 2 contracts deployed once (Portfolio + Position)
- Unlimited users can mint Portfolio tokens
- Unlimited positions can be minted as Position tokens
- No per-user contract deployment needed
```

This efficient implementation gives us **granular portfolio management** with **unlimited scalability** while maintaining **custodial Bitcoin integration**!