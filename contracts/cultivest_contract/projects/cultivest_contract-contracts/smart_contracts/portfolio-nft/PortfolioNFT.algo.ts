import { Contract, GlobalState, uint64, log, op, assert, Txn, Account, Bytes, contract } from '@algorandfoundation/algorand-typescript';
import { abimethod } from '@algorandfoundation/algorand-typescript';

/**
 * Cultivest Portfolio NFT Smart Contract
 * Tracks multi-chain investment portfolio with Bitcoin-first approach
 */
@contract({
  name: 'CultivestPortfolioNFT',
  stateTotals: { 
    globalUints: 10,   // level, totalValueUSD, btcHoldings, algoHoldings, usdcHoldings, totalInvested, unrealizedPnL, createdAt, lastUpdate, isLocked
    globalBytes: 2,    // owner, authorizedUpdater  
    localUints: 0,
    localBytes: 0
  }
})
export class CultivestPortfolioNFT extends Contract {
  // Core portfolio state
  owner = GlobalState<Account>();
  totalValueUSD = GlobalState<uint64>();
  level = GlobalState<uint64>();
  
  // Multi-chain holdings (in smallest units)
  btcHoldings = GlobalState<uint64>(); // satoshis
  algoHoldings = GlobalState<uint64>(); // microAlgos
  usdcHoldings = GlobalState<uint64>(); // microUSDC
  
  // Performance tracking
  totalInvested = GlobalState<uint64>();
  unrealizedPnL = GlobalState<uint64>();
  
  // Metadata
  createdAt = GlobalState<uint64>();
  lastUpdate = GlobalState<uint64>();
  
  // Security
  authorizedUpdater = GlobalState<Account>();
  isLocked = GlobalState<boolean>();

  /**
   * Initialize a new Portfolio NFT
   */
  @abimethod({ onCreate: 'require' })
  createApplication(): void {
    this.owner.value = Txn.sender;
    this.createdAt.value = op.Global.latestTimestamp;
    this.level.value = 1;
    this.totalValueUSD.value = 0;
    this.totalInvested.value = 0;
    this.unrealizedPnL.value = 0;
    this.btcHoldings.value = 0;
    this.algoHoldings.value = 0;
    this.usdcHoldings.value = 0;
    this.isLocked.value = false;
    this.lastUpdate.value = op.Global.latestTimestamp;
    
    // Set authorized updater (Cultivest backend)
    this.authorizedUpdater.value = Txn.sender;
    
    // Log creation event
    log('portfolio_created');
  }

  /**
   * Update portfolio holdings and values
   */
  @abimethod()
  updatePortfolio(
    newBtcHoldings: uint64,
    newAlgoHoldings: uint64,
    newUsdcHoldings: uint64,
    newTotalValueUSD: uint64
  ): void {
    // Security checks
    assert(Txn.sender === this.authorizedUpdater.value);
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
    this.lastUpdate.value = op.Global.latestTimestamp;
    
    // Unlock
    this.isLocked.value = false;
    
    // Log update event for off-chain indexing
    log(op.concat(Bytes('portfolio_update:'), op.itob(this.totalValueUSD.value)));
  }

  /**
   * Record new investment
   */
  @abimethod()
  recordInvestment(amountUSD: uint64): void {
    assert(Txn.sender === this.authorizedUpdater.value);
    
    this.totalInvested.value = this.totalInvested.value + amountUSD;
    this.unrealizedPnL.value = this.totalValueUSD.value - this.totalInvested.value;
    
    log(op.concat(Bytes('investment:'), op.itob(amountUSD)));
  }

  /**
   * Transfer portfolio ownership
   */
  @abimethod()
  transferOwnership(newOwner: Account): void {
    assert(Txn.sender === this.owner.value);
    this.owner.value = newOwner;
    log('ownership_transfer');
  }

  /**
   * Get portfolio information (read-only)
   */
  @abimethod({ readonly: true })
  getPortfolioInfo(): [uint64, uint64, uint64, uint64, uint64] {
    return [
      this.level.value,
      this.totalValueUSD.value,
      this.btcHoldings.value,
      this.algoHoldings.value,
      this.usdcHoldings.value
    ];
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
