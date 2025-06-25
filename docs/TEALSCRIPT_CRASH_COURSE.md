# 🚀 TEALscript Crash Course for Cultivest Portfolio NFTs

## 📋 Table of Contents
1. [TEALscript Fundamentals](#1-tealscript-fundamentals)
2. [Cultivest Architecture Overview](#2-cultivest-architecture-overview)
3. [Portfolio NFT Smart Contract](#3-portfolio-nft-smart-contract)
4. [Position NFT Smart Contract](#4-position-nft-smart-contract)
5. [Advanced Features](#5-advanced-features)
6. [Deployment & Integration](#6-deployment--integration)
7. [Production Checklist](#7-production-checklist)

---

## 1. TEALscript Fundamentals

### What is TEALscript?
TEALscript is a TypeScript-like language that compiles to TEAL (Transaction Execution Approval Language) for Algorand smart contracts. It provides:
- Type safety
- Modern syntax
- Built-in optimization
- Better developer experience

### Basic Setup
```bash
npm install -g @algorandfoundation/tealscript-cli
tealscript init cultivest-contracts
cd cultivest-contracts
```

### Core Concepts for Cultivest

#### 1. **State Management**
```typescript
// Global State Keys (optimized for gas)
const TOTAL_VALUE_KEY = 'tv';     // Total portfolio value
const BTC_HOLDINGS_KEY = 'btc';   // Bitcoin holdings
const ALGO_HOLDINGS_KEY = 'algo'; // Algorand holdings
const LAST_UPDATE_KEY = 'lu';     // Last update timestamp
const OWNER_KEY = 'owner';        // Portfolio owner

// Local State (per user)
const USER_LEVEL_KEY = 'level';   // Money tree level
const STREAK_KEY = 'streak';      // Investment streak
```

#### 2. **Data Types & Optimization**
```typescript
// ✅ Efficient: Use bytes for complex data
type PortfolioData = {
  totalValueUSD: number;    // 8 bytes
  btcHoldings: number;      // 8 bytes  
  algoHoldings: number;     // 8 bytes
  usdcHoldings: number;     // 8 bytes
  lastUpdateTime: number;   // 8 bytes
};

// Pack into single 40-byte value
function packPortfolioData(data: PortfolioData): bytes {
  return concat(
    itob(data.totalValueUSD),
    itob(data.btcHoldings),
    itob(data.algoHoldings),
    itob(data.usdcHoldings),
    itob(data.lastUpdateTime)
  );
}
```

---

## 2. Cultivest Architecture Overview

### Smart Contract Hierarchy ✅ **COST-OPTIMIZED**
```
┌─────────────────────────────────────────────────────────────┐
│                    CULTIVEST ECOSYSTEM                      │
├─────────────────────────────────────────────────────────────┤
│  Portfolio NFT Contract (Master)                            │
│  ├── Tracks current portfolio value                         │
│  ├── Manages money tree levels                              │
│  ├── Handles cross-chain aggregation                        │
│  ├── Emits events for off-chain indexing                    │
│  └── Controls access permissions                            │
├─────────────────────────────────────────────────────────────┤
│  Position NFT Contract (Individual Assets)                  │
│  ├── Bitcoin position tracking                              │
│  ├── Algorand position tracking                             │
│  ├── USDC position tracking                                 │
│  ├── Performance calculations                               │
│  └── Emits position update events                           │
├─────────────────────────────────────────────────────────────┤
│  OFF-CHAIN INDEXING (Much Cheaper!)                         │
│  ├── Algorand Indexer API (free transaction history)       │
│  ├── Supabase database (historical analytics)              │
│  ├── Backend event processing (real-time updates)          │
│  └── Achievement tracking (in your existing DB)            │
└─────────────────────────────────────────────────────────────┘
```

### Contract Interaction Flow ✅ **OPTIMIZED**
```typescript
// User investment flow - MUCH CHEAPER!
1. Frontend → Backend API
2. Backend → Portfolio NFT Contract (update current value + emit event)
3. Backend → Position NFT Contract (update position + emit event)
4. Backend → Supabase Database (store historical data)
5. Backend → Algorand Indexer (automatically indexes events)
6. Frontend ← Updated portfolio data (from DB + live contract state)

// Cost: ~0.002 ALGO per update vs ~0.003+ with History contract
```

---

## 3. Portfolio NFT Smart Contract

### Core Contract Structure
```typescript
import { Contract } from '@algorandfoundation/tealscript';

class CultivestPortfolioNFT extends Contract {
  // Global state variables
  owner = GlobalStateKey<Address>();
  totalValueUSD = GlobalStateKey<number>();
  createdAt = GlobalStateKey<number>();
  level = GlobalStateKey<number>();
  
  // Asset tracking
  btcHoldings = GlobalStateKey<number>();
  algoHoldings = GlobalStateKey<number>();
  usdcHoldings = GlobalStateKey<number>();
  
  // Performance metrics
  totalInvested = GlobalStateKey<number>();
  unrealizedPnL = GlobalStateKey<number>();
  lastUpdate = GlobalStateKey<number>();
  
  // Configuration
  authorized_updater = GlobalStateKey<Address>();
  is_locked = GlobalStateKey<boolean>();

  createApplication(): void {
    // Initialize portfolio NFT
    this.owner.value = this.txn.sender;
    this.createdAt.value = globals.latestTimestamp;
    this.level.value = 1;
    this.totalValueUSD.value = 0;
    this.totalInvested.value = 0;
    this.unrealizedPnL.value = 0;
    this.is_locked.value = false;
    
    // Set authorized updater (Cultivest backend)
    this.authorized_updater.value = this.txn.sender;
  }

  // Update portfolio values (called by backend)
  updatePortfolio(
    newBtcHoldings: number,
    newAlgoHoldings: number, 
    newUsdcHoldings: number,
    newTotalValueUSD: number,
    btcPriceUSD: number,
    algoPriceUSD: number
  ): void {
    // Access control
    assert(this.txn.sender === this.authorized_updater.value);
    assert(!this.is_locked.value);
    
    // Prevent reentrancy
    this.is_locked.value = true;
    
    // Update holdings
    this.btcHoldings.value = newBtcHoldings;
    this.algoHoldings.value = newAlgoHoldings;
    this.usdcHoldings.value = newUsdcHoldings;
    
    // Calculate total value
    const btcValue = newBtcHoldings * btcPriceUSD;
    const algoValue = newAlgoHoldings * algoPriceUSD;
    const usdcValue = newUsdcHoldings; // 1:1 with USD
    
    this.totalValueUSD.value = btcValue + algoValue + usdcValue;
    
    // Update P&L
    this.unrealizedPnL.value = this.totalValueUSD.value - this.totalInvested.value;
    
    // Update money tree level
    this.updateMoneyTreeLevel();
    
    // Update timestamp
    this.lastUpdate.value = globals.latestTimestamp;
    
    // Unlock
    this.is_locked.value = false;
    
    // Log event for indexing
    log(concat(
      'portfolio_update:',
      itob(this.totalValueUSD.value),
      ':',
      itob(globals.latestTimestamp)
    ));
  }

  // Investment tracking
  recordInvestment(amountUSD: number): void {
    assert(this.txn.sender === this.authorized_updater.value);
    
    this.totalInvested.value = this.totalInvested.value + amountUSD;
    
    // Recalculate P&L
    this.unrealizedPnL.value = this.totalValueUSD.value - this.totalInvested.value;
    
    log(concat('investment:', itob(amountUSD)));
  }

  // Money tree level calculation
  private updateMoneyTreeLevel(): void {
    const currentValue = this.totalValueUSD.value;
    
    if (currentValue >= 10000) { // $100
      this.level.value = 5;
    } else if (currentValue >= 5000) { // $50
      this.level.value = 4;
    } else if (currentValue >= 2500) { // $25
      this.level.value = 3;
    } else if (currentValue >= 1000) { // $10
      this.level.value = 2;
    } else {
      this.level.value = 1;
    }
  }

  // Read-only methods for frontend
  getPortfolioSummary(): {
    totalValueUSD: number;
    btcHoldings: number;
    algoHoldings: number;
    usdcHoldings: number;
    level: number;
    unrealizedPnL: number;
  } {
    return {
      totalValueUSD: this.totalValueUSD.value,
      btcHoldings: this.btcHoldings.value,
      algoHoldings: this.algoHoldings.value,
      usdcHoldings: this.usdcHoldings.value,
      level: this.level.value,
      unrealizedPnL: this.unrealizedPnL.value
    };
  }

  // Transfer ownership (for NFT trading)
  transferOwnership(newOwner: Address): void {
    assert(this.txn.sender === this.owner.value);
    this.owner.value = newOwner;
    
    log(concat('ownership_transfer:', newOwner));
  }
}
```

---

## 4. Position NFT Smart Contract

### Individual Asset Position Tracking
```typescript
class CultivestPositionNFT extends Contract {
  // Position details
  owner = GlobalStateKey<Address>();
  portfolioContract = GlobalStateKey<Address>(); // Link to main portfolio
  
  // Asset information
  assetType = GlobalStateKey<string>(); // 'BTC', 'ALGO', 'USDC'
  blockchain = GlobalStateKey<string>(); // 'bitcoin', 'algorand'
  
  // Position data
  quantity = GlobalStateKey<number>();
  entryPrice = GlobalStateKey<number>();
  currentPrice = GlobalStateKey<number>();
  currentValueUSD = GlobalStateKey<number>();
  unrealizedPnL = GlobalStateKey<number>();
  
  // Metadata
  createdAt = GlobalStateKey<number>();
  lastPriceUpdate = GlobalStateKey<number>();
  
  createApplication(
    portfolioAddr: Address,
    asset: string,
    chain: string,
    initialQuantity: number,
    initialPrice: number
  ): void {
    this.owner.value = this.txn.sender;
    this.portfolioContract.value = portfolioAddr;
    this.assetType.value = asset;
    this.blockchain.value = chain;
    this.quantity.value = initialQuantity;
    this.entryPrice.value = initialPrice;
    this.currentPrice.value = initialPrice;
    this.currentValueUSD.value = initialQuantity * initialPrice;
    this.unrealizedPnL.value = 0;
    this.createdAt.value = globals.latestTimestamp;
    this.lastPriceUpdate.value = globals.latestTimestamp;
  }

  // Update position (called by backend price feeds)
  updatePosition(
    newQuantity: number,
    newCurrentPrice: number
  ): void {
    // Verify caller is authorized
    assert(this.isAuthorizedUpdater());
    
    const oldQuantity = this.quantity.value;
    const oldValue = this.currentValueUSD.value;
    
    // Update quantity and price
    this.quantity.value = newQuantity;
    this.currentPrice.value = newCurrentPrice;
    this.currentValueUSD.value = newQuantity * newCurrentPrice;
    
    // Calculate P&L
    const entryValue = newQuantity * this.entryPrice.value;
    this.unrealizedPnL.value = this.currentValueUSD.value - entryValue;
    
    this.lastPriceUpdate.value = globals.latestTimestamp;
    
    // Log position update
    log(concat(
      'position_update:',
      this.assetType.value,
      ':',
      itob(this.currentValueUSD.value)
    ));
  }

  // Add to position (new investment)
  addToPosition(additionalQuantity: number, purchasePrice: number): void {
    assert(this.isAuthorizedUpdater());
    
    const currentQuantity = this.quantity.value;
    const currentEntryValue = currentQuantity * this.entryPrice.value;
    const additionalValue = additionalQuantity * purchasePrice;
    
    // Calculate new weighted average entry price
    const newQuantity = currentQuantity + additionalQuantity;
    const newEntryPrice = (currentEntryValue + additionalValue) / newQuantity;
    
    this.quantity.value = newQuantity;
    this.entryPrice.value = newEntryPrice;
    
    // Recalculate current value and P&L
    this.currentValueUSD.value = newQuantity * this.currentPrice.value;
    const newEntryValue = newQuantity * newEntryPrice;
    this.unrealizedPnL.value = this.currentValueUSD.value - newEntryValue;
    
    log(concat('position_add:', itob(additionalQuantity)));
  }

  // Reduce position (partial sale)
  reducePosition(soldQuantity: number, salePrice: number): number {
    assert(this.isAuthorizedUpdater());
    assert(soldQuantity <= this.quantity.value);
    
    const realizedPnL = soldQuantity * (salePrice - this.entryPrice.value);
    
    // Update position
    this.quantity.value = this.quantity.value - soldQuantity;
    
    if (this.quantity.value > 0) {
      // Recalculate current value
      this.currentValueUSD.value = this.quantity.value * this.currentPrice.value;
      const entryValue = this.quantity.value * this.entryPrice.value;
      this.unrealizedPnL.value = this.currentValueUSD.value - entryValue;
    } else {
      // Position closed
      this.currentValueUSD.value = 0;
      this.unrealizedPnL.value = 0;
    }
    
    log(concat('position_reduce:', itob(soldQuantity)));
    return realizedPnL;
  }

  private isAuthorizedUpdater(): boolean {
    // Check if sender is the portfolio contract or authorized backend
    return this.txn.sender === this.portfolioContract.value || 
           this.txn.sender === this.owner.value;
  }

  // Read-only position summary
  getPositionSummary(): {
    assetType: string;
    blockchain: string;
    quantity: number;
    entryPrice: number;
    currentPrice: number;
    currentValueUSD: number;
    unrealizedPnL: number;
    pnlPercentage: number;
  } {
    const pnlPercentage = this.entryPrice.value > 0 ? 
      ((this.currentPrice.value - this.entryPrice.value) / this.entryPrice.value) * 100 : 0;
      
    return {
      assetType: this.assetType.value,
      blockchain: this.blockchain.value,
      quantity: this.quantity.value,
      entryPrice: this.entryPrice.value,
      currentPrice: this.currentPrice.value,
      currentValueUSD: this.currentValueUSD.value,
      unrealizedPnL: this.unrealizedPnL.value,
      pnlPercentage: pnlPercentage
    };
  }
}
```

---

## 5. Off-Chain Indexing & Analytics ✅ **MUCH CHEAPER APPROACH**

## 🎯 **Why Off-Chain Beats On-Chain for Historical Data**

You're absolutely right to question the History NFT contract! Here's the breakdown:

### 💰 **Cost Comparison**
| Feature | On-Chain History Contract | Off-Chain Indexing |
|---------|--------------------------|-------------------|
| **Setup Cost** | ~0.001 ALGO | FREE |
| **Per Data Point** | ~0.001 ALGO + gas | FREE |
| **Storage Limit** | 2KB box = ~170 points | UNLIMITED |
| **Query Speed** | Slow (on-chain reads) | FAST (database) |
| **Complex Analytics** | Very limited | Full SQL power |
| **Monthly Cost (1000 users)** | ~$30-50 | ~$0 |

### ✅ **What You Get with Off-Chain Approach**

**1. FREE Unlimited Storage**
```typescript
// Instead of expensive box storage:
box.create('history', 2048); // Costs ALGO + limited to 2KB

// You get unlimited Supabase storage:
await supabase.from('portfolio_history').insert(data); // FREE
```

**2. Rich Analytics Queries**
```sql
-- Complex queries impossible on-chain:
SELECT 
  DATE_TRUNC('day', timestamp) as day,
  AVG(total_value_usd) as avg_value,
  MAX(total_value_usd) - MIN(total_value_usd) as daily_range
FROM portfolio_history 
WHERE app_id = $1 AND timestamp >= NOW() - INTERVAL '30 days'
GROUP BY day
ORDER BY day;
```

**3. Real-Time Event Processing**
```typescript
// Algorand Indexer automatically tracks ALL contract events
const events = await indexer.searchForTransactions()
  .applicationID(portfolioAppId)
  .minRound(lastProcessedRound)
  .do();

// Process events in real-time, store in your existing DB
```

**4. Integration with Existing Infrastructure**
- Uses your existing Supabase database
- Leverages your existing API endpoints  
- No additional blockchain costs
- Works with your current React Native app

### 🏗️ **Recommended Architecture**

```
┌─────────────────────────────────────────────────────────────┐
│                 COST-OPTIMIZED APPROACH                    │
├─────────────────────────────────────────────────────────────┤
│  ON-CHAIN (Essential NFT State)                             │
│  ├── Portfolio NFT: Current value, level, holdings         │
│  ├── Position NFTs: Current positions, P&L                 │
│  └── Event logs: For off-chain indexing                    │
│                                                             │
│  Cost: ~0.002 ALGO per update                              │
├─────────────────────────────────────────────────────────────┤
│  OFF-CHAIN (Historical Data & Analytics)                   │
│  ├── Algorand Indexer: FREE event tracking                 │
│  ├── Supabase DB: Unlimited historical storage             │
│  ├── Backend APIs: Rich analytics & queries                │
│  └── React Native: Fast dashboard updates                  │
│                                                             │
│  Cost: $0 for indexing + existing DB costs                 │
└─────────────────────────────────────────────────────────────┘
```

### 📊 **Real Cost Example**

**Your Current Scale (1000+ users):**
- **On-Chain History**: $50-100/month in ALGO fees
- **Off-Chain Indexing**: $0/month (uses free Algorand Indexer)
- **Supabase Storage**: Already paying, minimal increase

**The Smart Contracts Still Provide:**
- ✅ NFT ownership and transferability
- ✅ Real-time portfolio values
- ✅ Money tree levels and achievements
- ✅ Cross-chain aggregation
- ✅ Immutable audit trail (via events)

**But Historical Data Gets:**
- ✅ Unlimited storage capacity
- ✅ Lightning-fast queries
- ✅ Complex analytics
- ✅ Integration with existing systems
- ✅ Zero blockchain costs

---

### Enhanced Contract Events for Indexing
```typescript
// Add to your Portfolio NFT Contract
updatePortfolio(/* ... parameters ... */): void {
  // ... existing update logic ...
  
  // ✅ Emit detailed events for free off-chain indexing
  log(concat(
    'portfolio_update:',
    itob(this.totalValueUSD.value),
    ':',
    itob(this.btcHoldings.value),
    ':',
    itob(this.algoHoldings.value),
    ':',
    itob(this.usdcHoldings.value),
    ':',
    itob(globals.latestTimestamp)
  ));
  
  // Achievement checks
  this.checkAndEmitAchievements();
}

// Achievement system using events (not expensive storage)
private checkAndEmitAchievements(): void {
  const currentValue = this.totalValueUSD.value;
  const totalInvested = this.totalInvested.value;
  
  // First Investment ($1+)
  if (totalInvested >= 100 && totalInvested - 100 < 100) { // Just crossed $1
    log(concat('achievement_unlock:first_investment:', itob(globals.latestTimestamp)));
  }
  
  // Diversification (BTC + ALGO)
  if (this.btcHoldings.value > 0 && this.algoHoldings.value > 0) {
    log(concat('achievement_unlock:diversification:', itob(globals.latestTimestamp)));
  }
  
  // Level milestones
  const newLevel = this.level.value;
  log(concat('money_tree_level:', itob(newLevel), ':', itob(currentValue)));
}
```

### Backend Event Processing (FREE!)
```typescript
// backend/services/algorand-indexer.ts
export class AlgorandEventProcessor {
  private indexer: algosdk.Indexer;
  private supabase: SupabaseClient;
  
  constructor() {
    this.indexer = new algosdk.Indexer('', 'https://testnet-idx.algonode.cloud', '');
    this.supabase = createClient(/* your existing config */);
  }

  // Process portfolio update events (runs every minute)
  async processPortfolioEvents(appId: number): Promise<void> {
    try {
      // Get recent transactions for the contract
      const transactions = await this.indexer
        .searchForTransactions()
        .applicationID(appId)
        .minRound(await this.getLastProcessedRound(appId))
        .do();
      
      for (const txn of transactions.transactions) {
        if (txn.logs) {
          for (const log of txn.logs) {
            await this.processLogEntry(log, txn, appId);
          }
        }
      }
      
      // Update last processed round
      await this.updateLastProcessedRound(appId, transactions.transactions[0]?.['confirmed-round'] || 0);
      
    } catch (error) {
      console.error('Failed to process portfolio events:', error);
    }
  }

  private async processLogEntry(log: string, txn: any, appId: number): Promise<void> {
    const decoded = Buffer.from(log, 'base64').toString();
    
    if (decoded.startsWith('portfolio_update:')) {
      // Parse: portfolio_update:totalValue:btcHoldings:algoHoldings:usdcHoldings:timestamp
      const parts = decoded.split(':');
      
      const portfolioSnapshot = {
        app_id: appId,
        total_value_usd: parseInt(parts[1]) / 100, // Convert from cents
        btc_holdings: parseInt(parts[2]) / 100000000, // Convert from satoshis
        algo_holdings: parseInt(parts[3]) / 1000000, // Convert from microAlgos
        usdc_holdings: parseInt(parts[4]) / 1000000, // Convert from microUSDC
        timestamp: new Date(parseInt(parts[5]) * 1000),
        tx_id: txn.id,
        round: txn['confirmed-round']
      };
      
      // Store in your existing Supabase database
      await this.supabase
        .from('portfolio_history')
        .insert(portfolioSnapshot);
        
      console.log(`✅ Processed portfolio update for app ${appId}`);
    }
    
    if (decoded.startsWith('achievement_unlock:')) {
      await this.processAchievementUnlock(decoded, txn, appId);
    }
    
    if (decoded.startsWith('money_tree_level:')) {
      await this.processLevelUpdate(decoded, txn, appId);
    }
  }

  private async processAchievementUnlock(log: string, txn: any, appId: number): Promise<void> {
    // Parse: achievement_unlock:achievement_type:timestamp
    const parts = log.split(':');
    const achievementType = parts[1];
    const timestamp = new Date(parseInt(parts[2]) * 1000);
    
    // Store in existing database
    await this.supabase
      .from('user_achievements')
      .insert({
        app_id: appId,
        achievement_type: achievementType,
        unlocked_at: timestamp,
        tx_id: txn.id
      });
      
    console.log(`🏆 Achievement unlocked: ${achievementType} for app ${appId}`);
  }

  // Get portfolio history for frontend (much faster than on-chain queries)
  async getPortfolioHistory(appId: number, days: number = 30): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('portfolio_history')
      .select('*')
      .eq('app_id', appId)
      .gte('timestamp', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
      .order('timestamp', { ascending: true });
      
    if (error) throw error;
    return data || [];
  }

  // Calculate performance metrics (much more flexible than on-chain)
  async getPerformanceMetrics(appId: number): Promise<{
    dailyReturn: number;
    weeklyReturn: number;
    monthlyReturn: number;
    totalReturn: number;
  }> {
    const history = await this.getPortfolioHistory(appId, 30);
    
    if (history.length < 2) {
      return { dailyReturn: 0, weeklyReturn: 0, monthlyReturn: 0, totalReturn: 0 };
    }
    
    const current = history[history.length - 1];
    const oneDayAgo = this.findClosestHistoryPoint(history, 1);
    const oneWeekAgo = this.findClosestHistoryPoint(history, 7);
    const oneMonthAgo = this.findClosestHistoryPoint(history, 30);
    const firstInvestment = history[0];
    
    return {
      dailyReturn: this.calculateReturn(oneDayAgo?.total_value_usd || current.total_value_usd, current.total_value_usd),
      weeklyReturn: this.calculateReturn(oneWeekAgo?.total_value_usd || current.total_value_usd, current.total_value_usd),
      monthlyReturn: this.calculateReturn(oneMonthAgo?.total_value_usd || current.total_value_usd, current.total_value_usd),
      totalReturn: this.calculateReturn(firstInvestment.total_value_usd, current.total_value_usd)
    };
  }

  private findClosestHistoryPoint(history: any[], daysAgo: number): any | null {
    const targetTime = Date.now() - (daysAgo * 24 * 60 * 60 * 1000);
    return history.find(point => 
      Math.abs(new Date(point.timestamp).getTime() - targetTime) < (12 * 60 * 60 * 1000) // Within 12 hours
    );
  }

  private calculateReturn(oldValue: number, newValue: number): number {
    if (oldValue === 0) return 0;
    return ((newValue - oldValue) / oldValue) * 100;
  }
}
```

### Database Schema for Historical Data
```sql
-- Add to your existing Supabase schema
CREATE TABLE portfolio_history (
  id SERIAL PRIMARY KEY,
  app_id BIGINT NOT NULL,
  user_id TEXT REFERENCES users(user_id),
  total_value_usd DECIMAL(12,2),
  btc_holdings DECIMAL(16,8),
  algo_holdings DECIMAL(16,6),
  usdc_holdings DECIMAL(12,6),
  timestamp TIMESTAMPTZ NOT NULL,
  tx_id TEXT NOT NULL,
  round BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_achievements (
  id SERIAL PRIMARY KEY,
  app_id BIGINT NOT NULL,
  user_id TEXT REFERENCES users(user_id),
  achievement_type TEXT NOT NULL,
  unlocked_at TIMESTAMPTZ NOT NULL,
  tx_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_portfolio_history_app_timestamp ON portfolio_history(app_id, timestamp);
CREATE INDEX idx_user_achievements_app_user ON user_achievements(app_id, user_id);
```

### Integration with Your Existing API
```typescript
// backend/api/dashboard/data+api.ts - Enhanced with NFT data
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userID = searchParams.get('userID');
    
    if (!userID) {
      return NextResponse.json({ success: false, error: 'User ID required' }, { status: 400 });
    }

    // Get user's portfolio NFT app ID from database
    const portfolioAppId = await getPortfolioNFTAppId(userID);
    
    if (portfolioAppId) {
      // Get current on-chain state
      const onChainData = await getPortfolioOnChainState(portfolioAppId);
      
      // Get historical performance from your database (much faster!)
      const eventProcessor = new AlgorandEventProcessor();
      const performanceMetrics = await eventProcessor.getPerformanceMetrics(portfolioAppId);
      const achievements = await getUserAchievements(userID);
      
      return NextResponse.json({
        success: true,
        data: {
          // Current state from smart contract
          totalValueUSD: onChainData.totalValueUSD,
          btcHoldings: onChainData.btcHoldings,
          algoHoldings: onChainData.algoHoldings,
          usdcHoldings: onChainData.usdcHoldings,
          level: onChainData.level,
          unrealizedPnL: onChainData.unrealizedPnL,
          
          // Performance metrics from database (much richer!)
          performance: performanceMetrics,
          achievements: achievements,
          
          // NFT metadata
          portfolioNFTAppId: portfolioAppId,
          nftMetadata: await getPortfolioNFTMetadata(portfolioAppId)
        }
      });
    }
    
    // Fallback to existing API logic if no NFT
    return getExistingDashboardData(userID);
    
  } catch (error) {
    console.error('Dashboard data error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch dashboard data' }, { status: 500 });
  }
}
```

---

## 6. Deployment & Integration

### Compilation & Deployment Script
```typescript
// scripts/deploy-contracts.ts
import { AlgorandTestnetClient } from '@algorandfoundation/algokit-utils';
import { CultivestPortfolioNFT, CultivestPositionNFT } from '../contracts';

async function deployContracts() {
  const client = new AlgorandTestnetClient();
  
  // 1. Deploy Portfolio NFT Contract
  console.log('Deploying Portfolio NFT Contract...');
  const portfolioContract = new CultivestPortfolioNFT();
  const portfolioAppId = await portfolioContract.deploy(client);
  console.log(`Portfolio Contract deployed: ${portfolioAppId}`);
  
  // 2. Deploy Position NFT Contract Template
  console.log('Deploying Position NFT Contract...');
  const positionContract = new CultivestPositionNFT();
  const positionTemplateId = await positionContract.deploy(client);
  console.log(`Position Contract Template deployed: ${positionTemplateId}`);
  
  // Save contract IDs for backend integration
  const contractConfig = {
    network: 'testnet',
    portfolioContract: portfolioAppId,
    positionContractTemplate: positionTemplateId,
    deployedAt: new Date().toISOString()
  };
  
  // Write to backend config
  require('fs').writeFileSync(
    '../backend/config/algorand-contracts.json',
    JSON.stringify(contractConfig, null, 2)
  );
  
  console.log('✅ All contracts deployed successfully!');
  console.log('💡 Remember to start the event processor for historical data');
  return contractConfig;
}

// Run deployment
deployContracts().catch(console.error);
```

### Event Processing Setup
```typescript
// scripts/start-event-processor.ts
import { AlgorandEventProcessor } from '../services/algorand-indexer';

async function startEventProcessor() {
  const processor = new AlgorandEventProcessor();
  
  console.log('🔄 Starting Algorand event processor...');
  
  // Process events every minute
  setInterval(async () => {
    try {
      // Get all portfolio contracts from database
      const activeContracts = await getActivePortfolioContracts();
      
      for (const contract of activeContracts) {
        await processor.processPortfolioEvents(contract.app_id);
      }
      
      console.log(`✅ Processed events for ${activeContracts.length} contracts`);
      
    } catch (error) {
      console.error('Event processing error:', error);
    }
  }, 60000); // Every minute
}

// Start the processor
startEventProcessor();
```

---

## 7. Production Checklist

### Security Checklist ✅
- [ ] **Access Control**: All update methods check authorized callers
- [ ] **Input Validation**: All user inputs validated and sanitized
- [ ] **Reentrancy Protection**: Locking mechanisms implemented
- [ ] **Integer Overflow**: Safe math operations used
- [ ] **Private Key Security**: Backend keys stored in HSM/secure vault
- [ ] **Rate Limiting**: API endpoints have rate limits
- [ ] **Audit**: Smart contracts audited by third party

### Performance Optimization ✅
- [ ] **State Efficiency**: Minimal global/local state usage
- [ ] **Box Storage**: Historical data stored efficiently
- [ ] **Batch Operations**: Multiple updates batched when possible
- [ ] **Gas Optimization**: Bytecode optimized for minimal fees
- [ ] **Caching**: Frontend caches read-only data appropriately

### Integration Testing ✅
- [ ] **Unit Tests**: All contract methods tested
- [ ] **Integration Tests**: Full user flow tested end-to-end
- [ ] **Load Testing**: System tested under expected load
- [ ] **Error Handling**: All failure cases handled gracefully
- [ ] **Monitoring**: Logging and alerting implemented

### Deployment Pipeline ✅
```bash
# Test deployment script
npm run test:contracts
npm run deploy:testnet
npm run verify:deployment
npm run test:integration

# Production deployment
npm run deploy:mainnet
npm run monitor:contracts
```

---

## 🎯 Next Steps for Cultivest

1. **Implement Contracts**: Start with Portfolio NFT contract
2. **Backend Integration**: Connect contract calls to existing APIs
3. **Frontend Updates**: Display NFT data in React Native app
4. **Testing**: Comprehensive testing on Algorand testnet
5. **Optimization**: Gas optimization and performance tuning
6. **Security Audit**: Third-party security review
7. **Mainnet Deployment**: Production launch

Your Portfolio NFT system will be revolutionary in the micro-investment space! 🚀 