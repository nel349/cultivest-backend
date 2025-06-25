import { Contract } from '@algorandfoundation/tealscript';

/**
 * Cultivest Portfolio NFT Smart Contract
 * Tracks multi-chain investment portfolio with Bitcoin-first approach
 */
export class CultivestPortfolioNFT extends Contract {
  // Core portfolio state
  owner = GlobalStateKey<Address>();
  totalValueUSD = GlobalStateKey<uint64>();
  level = GlobalStateKey<uint64>();
  
  // Multi-chain holdings (in smallest units)
  btcHoldings = GlobalStateKey<uint64>(); // satoshis
  algoHoldings = GlobalStateKey<uint64>(); // microAlgos
  usdcHoldings = GlobalStateKey<uint64>(); // microUSDC
  
  // Performance tracking
  totalInvested = GlobalStateKey<uint64>();
  unrealizedPnL = GlobalStateKey<uint64>();
  
  // Metadata
  createdAt = GlobalStateKey<uint64>();
  lastUpdate = GlobalStateKey<uint64>();
  
  // Security
  authorizedUpdater = GlobalStateKey<Address>();
  isLocked = GlobalStateKey<boolean>();

  /**
   * Initialize a new Portfolio NFT
   */
  createApplication(): void {
    this.owner.value = this.txn.sender;
    this.createdAt.value = globals.latestTimestamp;
    this.level.value = 1;
    this.totalValueUSD.value = 0;
    this.totalInvested.value = 0;
    this.unrealizedPnL.value = 0;
    this.btcHoldings.value = 0;
    this.algoHoldings.value = 0;
    this.usdcHoldings.value = 0;
    this.isLocked.value = false;
    this.lastUpdate.value = globals.latestTimestamp;
    
    // Set authorized updater (Cultivest backend)
    this.authorizedUpdater.value = this.txn.sender;
    
    // Log creation event
    log('portfolio_created');
  }

  /**
   * Update portfolio holdings and values
   */
  updatePortfolio(
    newBtcHoldings: uint64,
    newAlgoHoldings: uint64,
    newUsdcHoldings: uint64,
    newTotalValueUSD: uint64
  ): void {
    // Security checks
    assert(this.txn.sender === this.authorizedUpdater.value);
    assert(!this.isLocked.value);
    
    // Lock to prevent reentrancy
    this.isLocked.value = true;
    
    // Update holdings
    this.btcHoldings.value = newBtcHoldings;
    this.algoHoldings.value = newAlgoHoldings;
    this.usdcHoldings.value = newUsdcHoldings;
    this.totalValueUSD.value = newTotalValueUSD;
    
    // Update P&L
    this.unrealizedPnL.value = this.totalValueUSD.value - this.totalInvested.value;
    
    // Update money tree level
    this.updateLevel();
    
    // Update timestamp
    this.lastUpdate.value = globals.latestTimestamp;
    
    // Unlock
    this.isLocked.value = false;
    
    // Log update event for off-chain indexing
    log(concat('portfolio_update:', itob(this.totalValueUSD.value)));
  }

  /**
   * Record new investment
   */
  recordInvestment(amountUSD: uint64): void {
    assert(this.txn.sender === this.authorizedUpdater.value);
    
    this.totalInvested.value = this.totalInvested.value + amountUSD;
    this.unrealizedPnL.value = this.totalValueUSD.value - this.totalInvested.value;
    
    log(concat('investment:', itob(amountUSD)));
  }

  /**
   * Transfer portfolio ownership
   */
  transferOwnership(newOwner: Address): void {
    assert(this.txn.sender === this.owner.value);
    this.owner.value = newOwner;
    
    log('ownership_transfer');
  }

  /**
   * Update money tree level based on portfolio value
   */
  private updateLevel(): void {
    const value = this.totalValueUSD.value;
    
    if (value >= 10000) { // $100.00
      this.level.value = 5;
    } else if (value >= 5000) { // $50.00
      this.level.value = 4;
    } else if (value >= 2500) { // $25.00
      this.level.value = 3;
    } else if (value >= 1000) { // $10.00
      this.level.value = 2;
    } else {
      this.level.value = 1;
    }
  }
}
