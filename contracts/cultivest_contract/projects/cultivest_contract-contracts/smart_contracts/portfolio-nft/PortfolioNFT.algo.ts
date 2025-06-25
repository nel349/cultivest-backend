import { Contract, GlobalState, uint64, log, op, assert, Txn, Account, Bytes, contract, BoxMap } from '@algorandfoundation/algorand-typescript';
import { abimethod } from '@algorandfoundation/algorand-typescript';

/**
 * Cultivest Portfolio NFT Smart Contract
 * Mints individual portfolio tokens that reference Position NFT token IDs
 * Each portfolio token represents a collection of position tokens owned by a user
 * 
 * Uses box storage to maintain on-chain mappings of positions to portfolios
 */
@contract({
  name: 'CultivestPortfolioNFT',
  stateTotals: { 
    globalUints: 5,   // nextTokenId, totalSupply, contractVersion, maxSupply, positionNFTAppId
    globalBytes: 2,   // authorizedMinter, contractName
    localUints: 0,
    localBytes: 0
  }
})
export class CultivestPortfolioNFT extends Contract {
  // Contract state
  nextTokenId = GlobalState<uint64>();
  totalSupply = GlobalState<uint64>();
  contractVersion = GlobalState<uint64>();
  maxSupply = GlobalState<uint64>();
  positionNFTAppId = GlobalState<uint64>();
  
  // Access control
  authorizedMinter = GlobalState<Account>();
  contractName = GlobalState<string>();

  // Box storage for position-to-portfolio mappings
  // Key: positionTokenId (uint64) -> Value: portfolioTokenId (uint64)
  positionToPortfolio = BoxMap<uint64, uint64>({ keyPrefix: 'pos2port' });
  
  // Box storage for portfolio position counts
  // Key: portfolioTokenId (uint64) -> Value: positionCount (uint64)
  portfolioPositionCount = BoxMap<uint64, uint64>({ keyPrefix: 'portcount' });

  /**
   * Initialize the Portfolio NFT contract
   */
  @abimethod({ onCreate: 'require' })
  createApplication(): void {
    this.nextTokenId.value = 1; // Start token IDs at 1
    this.totalSupply.value = 0;
    this.contractVersion.value = 1;
    this.maxSupply.value = 100000; // Maximum portfolio tokens
    this.positionNFTAppId.value = 0; // Will be set later via setPositionNFTApp
    this.authorizedMinter.value = Txn.sender;
    this.contractName.value = 'CultivestPortfolioNFT';
    
    log('portfolio_contract_created');
  }

  /**
   * Mint new portfolio token for a user
   * 
   * @param owner - The Algorand address that will own this portfolio token
   * @param level - Initial money tree level (1-5)
   * @param totalInvestedUSD - Total amount invested in USD cents
   */
  @abimethod()
  mintPortfolio(
    owner: Account,
    level: uint64,
    totalInvestedUSD: uint64
  ): uint64 {
    // Security checks
    assert(Txn.sender === this.authorizedMinter.value);
    assert(this.totalSupply.value < this.maxSupply.value);
    assert(level >= 1 && level <= 5);
    assert(totalInvestedUSD >= 0);

    const tokenId = this.nextTokenId.value;
    
    // Update contract state
    this.nextTokenId.value = tokenId + 1;
    this.totalSupply.value = this.totalSupply.value + 1;
    
    // Initialize portfolio position count to 0
    this.portfolioPositionCount(tokenId).value = 0;
    
    // Log detailed minting event for off-chain indexing
    log(op.concat(Bytes('portfolio_minted:'), op.itob(tokenId)));
    log(op.concat(Bytes('portfolio_owner:'), owner.bytes));
    log(op.concat(Bytes('portfolio_level:'), op.itob(level)));
    log(op.concat(Bytes('portfolio_invested:'), op.itob(totalInvestedUSD)));
    log(op.concat(Bytes('portfolio_position_app:'), op.itob(this.positionNFTAppId.value)));
    
    return tokenId;
  }

  /**
   * Add position token to a portfolio token
   * Properly stores the mapping on-chain using box storage
   */
  @abimethod()
  addPositionToPortfolio(
    portfolioTokenId: uint64,
    positionTokenId: uint64,
    owner: Account
  ): void {
    assert(portfolioTokenId > 0 && portfolioTokenId < this.nextTokenId.value);
    assert(positionTokenId > 0);
    
    // Only owner or authorized minter can assign
    const isOwner = Txn.sender === owner;
    const isAuthorized = Txn.sender === this.authorizedMinter.value;
    assert(isOwner || isAuthorized);
    
    // Check if position is already assigned to a portfolio
    const existingPortfolio = this.positionToPortfolio(positionTokenId);
    if (existingPortfolio.exists) {
      assert(false, 'Position already assigned to a portfolio');
    }
    
    // Store the position-to-portfolio mapping
    this.positionToPortfolio(positionTokenId).value = portfolioTokenId;
    
    // Increment position count for this portfolio
    const currentCount = this.portfolioPositionCount(portfolioTokenId).value;
    this.portfolioPositionCount(portfolioTokenId).value = currentCount + 1;
    
    // Log assignment event for off-chain tracking
    log(op.concat(Bytes('position_added_to_portfolio:'), op.itob(portfolioTokenId)));
    log(op.concat(Bytes('position_token_id:'), op.itob(positionTokenId)));
    log(op.concat(Bytes('portfolio_owner:'), owner.bytes));
    log(op.concat(Bytes('portfolio_position_count:'), op.itob(currentCount + 1)));
  }

  /**
   * Remove position token from a portfolio token
   * Properly removes the on-chain mapping
   */
  @abimethod()
  removePositionFromPortfolio(
    portfolioTokenId: uint64,
    positionTokenId: uint64,
    owner: Account
  ): void {
    assert(portfolioTokenId > 0 && portfolioTokenId < this.nextTokenId.value);
    assert(positionTokenId > 0);
    
    // Only owner or authorized minter can remove
    const isOwner = Txn.sender === owner;
    const isAuthorized = Txn.sender === this.authorizedMinter.value;
    assert(isOwner || isAuthorized);
    
    // Verify position is actually in this portfolio
    const currentPortfolio = this.positionToPortfolio(positionTokenId);
    assert(currentPortfolio.exists && currentPortfolio.value === portfolioTokenId, 
           'Position not in specified portfolio');
    
    // Remove the position-to-portfolio mapping
    this.positionToPortfolio(positionTokenId).delete();
    
    // Decrement position count for this portfolio
    const currentCount = this.portfolioPositionCount(portfolioTokenId).value;
    assert(currentCount > 0, 'Portfolio has no positions to remove');
    this.portfolioPositionCount(portfolioTokenId).value = currentCount - 1;
    
    // Log removal event for off-chain tracking
    log(op.concat(Bytes('position_removed_from_portfolio:'), op.itob(portfolioTokenId)));
    log(op.concat(Bytes('position_token_id:'), op.itob(positionTokenId)));
    log(op.concat(Bytes('portfolio_owner:'), owner.bytes));
    log(op.concat(Bytes('portfolio_position_count:'), op.itob(currentCount - 1)));
  }

  /**
   * Get which portfolio a position belongs to
   */
  @abimethod({ readonly: true })
  getPositionPortfolio(positionTokenId: uint64): uint64 {
    assert(positionTokenId > 0);
    
    const portfolio = this.positionToPortfolio(positionTokenId);
    if (portfolio.exists) {
      return portfolio.value;
    }
    return 0; // Position not assigned to any portfolio
  }

  /**
   * Get number of positions in a portfolio
   */
  @abimethod({ readonly: true })
  getPortfolioPositionCount(portfolioTokenId: uint64): uint64 {
    assert(portfolioTokenId > 0 && portfolioTokenId < this.nextTokenId.value);
    
    const count = this.portfolioPositionCount(portfolioTokenId);
    if (count.exists) {
      return count.value;
    }
    return 0; // Portfolio has no positions
  }

  /**
   * Update portfolio token values and performance
   * For MVP: Only validates token exists via ID range, metadata tracked off-chain
   */
  @abimethod()
  updatePortfolio(
    portfolioTokenId: uint64,
    newLevel: uint64,
    newTotalValueUSD: uint64,
    newTotalInvestedUSD: uint64
  ): void {
    assert(Txn.sender === this.authorizedMinter.value);
    assert(portfolioTokenId > 0 && portfolioTokenId < this.nextTokenId.value);
    assert(newLevel >= 1 && newLevel <= 5);
    assert(newTotalValueUSD >= 0);
    assert(newTotalInvestedUSD >= 0);
    
    // Log update event for off-chain indexing
    log(op.concat(Bytes('portfolio_updated:'), op.itob(portfolioTokenId)));
    log(op.concat(Bytes('portfolio_new_level:'), op.itob(newLevel)));
    log(op.concat(Bytes('portfolio_new_value:'), op.itob(newTotalValueUSD)));
    log(op.concat(Bytes('portfolio_new_invested:'), op.itob(newTotalInvestedUSD)));
  }

  /**
   * Transfer portfolio token ownership
   * For MVP: Off-chain system tracks ownership, this logs the transfer event
   */
  @abimethod()
  transferPortfolio(
    portfolioTokenId: uint64,
    currentOwner: Account,
    newOwner: Account
  ): void {
    // Basic validation
    assert(portfolioTokenId > 0 && portfolioTokenId < this.nextTokenId.value);
    
    // For MVP, we allow authorized minter (backend) to facilitate transfers
    // In production, we'd validate current ownership on-chain
    const isOwner = Txn.sender === currentOwner;
    const isAuthorized = Txn.sender === this.authorizedMinter.value;
    assert(isOwner || isAuthorized);
    
    // Log transfer event for off-chain ownership tracking
    log(op.concat(Bytes('portfolio_transferred:'), op.itob(portfolioTokenId)));
    log(op.concat(Bytes('portfolio_old_owner:'), currentOwner.bytes));
    log(op.concat(Bytes('portfolio_new_owner:'), newOwner.bytes));
  }

  /**
   * Burn portfolio token (close portfolio)
   * For MVP: Decrements supply and logs burn event for off-chain cleanup
   */
  @abimethod()
  burnPortfolio(
    portfolioTokenId: uint64,
    owner: Account
  ): void {
    assert(portfolioTokenId > 0 && portfolioTokenId < this.nextTokenId.value);
    
    // Only owner or authorized minter can burn
    const isOwner = Txn.sender === owner;
    const isAuthorized = Txn.sender === this.authorizedMinter.value;
    assert(isOwner || isAuthorized);
    
    // Update total supply
    this.totalSupply.value = this.totalSupply.value - 1;
    
    // Log burn event for off-chain cleanup
    log(op.concat(Bytes('portfolio_burned:'), op.itob(portfolioTokenId)));
    log(op.concat(Bytes('portfolio_burned_owner:'), owner.bytes));
  }

  /**
   * Set the Position NFT contract app ID (admin only)
   */
  @abimethod()
  setPositionNFTApp(appId: uint64): void {
    assert(Txn.sender === this.authorizedMinter.value);
    assert(appId > 0);
    
    this.positionNFTAppId.value = appId;
    log(op.concat(Bytes('position_nft_app_set:'), op.itob(appId)));
  }

  /**
   * Get contract statistics (read-only)
   */
  @abimethod({ readonly: true })
  getContractStats(): [uint64, uint64, uint64, uint64, uint64] {
    return [
      this.nextTokenId.value - 1,  // Total tokens minted
      this.totalSupply.value,      // Current supply (minted - burned)
      this.maxSupply.value,        // Maximum supply
      this.contractVersion.value,  // Contract version
      this.positionNFTAppId.value  // Position NFT contract app ID
    ];
  }

  /**
   * Check if portfolio token ID is valid (read-only)
   * For MVP: Only checks if token ID is in valid range
   * Off-chain system tracks full portfolio metadata
   */
  @abimethod({ readonly: true })
  portfolioExists(portfolioTokenId: uint64): uint64 {
    if (portfolioTokenId > 0 && portfolioTokenId < this.nextTokenId.value) {
      return 1; // Token ID is in valid range
    }
    return 0;
  }

  /**
   * Update authorized minter (admin only)
   */
  @abimethod()
  setAuthorizedMinter(newMinter: Account): void {
    assert(Txn.sender === this.authorizedMinter.value);
    this.authorizedMinter.value = newMinter;
    
    log(op.concat(Bytes('minter_updated:'), newMinter.bytes));
  }
}
