import { Contract, GlobalState, BoxMap, uint64, log, op, assert, Txn, Account, Bytes, contract, bytes } from '@algorandfoundation/algorand-typescript';
import { abimethod } from '@algorandfoundation/algorand-typescript';

/**
 * Cultivest Position NFT Smart Contract
 * Mints individual position tokens for Bitcoin, Algorand, and USDC holdings
 * Each token represents a claim to custodial assets with encrypted private key references
 * 
 * Note: For MVP, we'll store minimal state in global storage and use off-chain indexing
 * for detailed token metadata. In production, we can upgrade to use box storage.
 */
@contract({
  name: 'CultivestPositionNFT',
  stateTotals: { 
    globalUints: 4,   // nextTokenId, totalSupply, contractVersion, maxSupply
    globalBytes: 2,   // authorizedMinter, contractName
    localUints: 0,
    localBytes: 0
  }
})
export class CultivestPositionNFT extends Contract {
  // Contract state
  nextTokenId = GlobalState<uint64>();
  totalSupply = GlobalState<uint64>();
  contractVersion = GlobalState<uint64>();
  maxSupply = GlobalState<uint64>();
  
  // Access control
  authorizedMinter = GlobalState<Account>();
  contractName = GlobalState<string>();

  // Box storage for essential position data
  // Key: tokenId (uint64) -> Value: owner (Account)
  positionOwner = BoxMap<uint64, Account>({ keyPrefix: 'owner' });
  
  // Key: tokenId (uint64) -> Value: assetType (uint64) 1=BTC, 2=ALGO, 3=USDC
  positionAssetType = BoxMap<uint64, uint64>({ keyPrefix: 'asset' });
  
  // Key: tokenId (uint64) -> Value: holdings amount in smallest units
  positionHoldings = BoxMap<uint64, uint64>({ keyPrefix: 'holdings' });
  
  // Key: tokenId (uint64) -> Value: purchase value in USD cents
  positionPurchaseValue = BoxMap<uint64, uint64>({ keyPrefix: 'purchase' });

  /**
   * Initialize the Position NFT contract
   */
  @abimethod({ onCreate: 'require' })
  createApplication(): void {
    this.nextTokenId.value = 1; // Start token IDs at 1
    this.totalSupply.value = 0;
    this.contractVersion.value = 1;
    this.maxSupply.value = 100000; // Maximum position tokens
    this.authorizedMinter.value = Txn.sender;
    this.contractName.value = 'CultivestPositionNFT';
    
    log('position_contract_created');
  }

  /**
   * Mint new position token for an asset holding
   * Asset types: 1=Bitcoin, 2=Algorand, 3=USDC
   * 
   * Stores essential position data on-chain using BoxMap storage
   * 
   * @param owner - The Algorand address that will own this position token
   * @param assetType - Asset type: 1=Bitcoin, 2=Algorand, 3=USDC
   * @param holdings - Amount held in smallest units (sats, microALGO, microUSDC)
   * @param purchaseValueUSD - Purchase value in USD cents (e.g., 100 = $1.00)
   */
  @abimethod()
  mintPosition(
    owner: Account,
    assetType: uint64,
    holdings: uint64,
    purchaseValueUSD: uint64
  ): uint64 {
    // Security checks
    assert(Txn.sender === this.authorizedMinter.value);
    assert(this.totalSupply.value < this.maxSupply.value);
    assert(assetType >= 1 && assetType <= 4); // 1=BTC, 2=ALGO, 3=USDC, 4=SOL
    assert(holdings > 0);
    assert(purchaseValueUSD > 0);

    const tokenId = this.nextTokenId.value;
    
    // Update contract state
    this.nextTokenId.value = tokenId + 1;
    this.totalSupply.value = this.totalSupply.value + 1;
    
    // Store essential position data on-chain
    this.positionOwner(tokenId).value = owner;
    this.positionAssetType(tokenId).value = assetType;
    this.positionHoldings(tokenId).value = holdings;
    this.positionPurchaseValue(tokenId).value = purchaseValueUSD;
    
    // Log detailed minting event for off-chain indexing
    log(op.concat(Bytes('position_minted:'), op.itob(tokenId)));
    log(op.concat(Bytes('position_asset_type:'), op.itob(assetType)));
    log(op.concat(Bytes('position_holdings:'), op.itob(holdings)));
    log(op.concat(Bytes('position_purchase_value:'), op.itob(purchaseValueUSD)));
    log(op.concat(Bytes('position_owner:'), owner.bytes));
    
    return tokenId;
  }

  /**
   * Update position token holdings (when user buys/sells more of the asset)
   * Note: Current value is calculated off-chain using market prices
   */
  @abimethod()
  updatePosition(
    positionTokenId: uint64,
    newHoldings: uint64
  ): void {
    assert(Txn.sender === this.authorizedMinter.value);
    assert(positionTokenId > 0 && positionTokenId < this.nextTokenId.value);
    assert(newHoldings > 0);
    
    // Verify position exists
    const owner = this.positionOwner(positionTokenId);
    assert(owner.exists, 'Position does not exist');
    
    // Update holdings on-chain
    this.positionHoldings(positionTokenId).value = newHoldings;
    
    // Log update event for off-chain indexing
    log(op.concat(Bytes('position_updated:'), op.itob(positionTokenId)));
    log(op.concat(Bytes('position_new_holdings:'), op.itob(newHoldings)));
  }

  /**
   * Transfer position token ownership (triggers key re-encryption)
   * For MVP: Off-chain system tracks ownership, this logs the transfer event
   * 
   * @param positionTokenId - The token ID to transfer
   * @param currentOwner - Current owner's Algorand address
   * @param newOwner - New owner's Algorand address  
   */
  @abimethod()
  transferPosition(
    positionTokenId: uint64,
    currentOwner: Account,
    newOwner: Account
  ): void {
    // Basic validation
    assert(positionTokenId > 0 && positionTokenId < this.nextTokenId.value);
    
    // For MVP, we allow authorized minter (backend) to facilitate transfers
    // In production, we'd validate current ownership on-chain
    const isOwner = Txn.sender === currentOwner;
    const isAuthorized = Txn.sender === this.authorizedMinter.value;
    assert(isOwner || isAuthorized);
    
    // Log transfer event for off-chain ownership tracking
    log(op.concat(Bytes('position_transferred:'), op.itob(positionTokenId)));
    log(op.concat(Bytes('position_old_owner:'), currentOwner.bytes));
    log(op.concat(Bytes('position_new_owner:'), newOwner.bytes));
  }

  /**
   * Assign position token to a portfolio token
   * For MVP: This is tracked off-chain, contract just logs the assignment
   */
  @abimethod()
  assignToPortfolio(
    positionTokenId: uint64,
    portfolioTokenId: uint64,
    owner: Account
  ): void {
    assert(positionTokenId > 0 && positionTokenId < this.nextTokenId.value);
    assert(portfolioTokenId > 0);
    
    // Only owner or authorized minter can assign
    const isOwner = Txn.sender === owner;
    const isAuthorized = Txn.sender === this.authorizedMinter.value;
    assert(isOwner || isAuthorized);
    
    // Log assignment event for off-chain tracking
    log(op.concat(Bytes('position_assigned:'), op.itob(positionTokenId)));
    log(op.concat(Bytes('position_portfolio:'), op.itob(portfolioTokenId)));
    log(op.concat(Bytes('position_assigned_owner:'), owner.bytes));
  }

  /**
   * Burn position token (sell/withdraw all holdings)
   * For MVP: Decrements supply and logs burn event for off-chain cleanup
   * 
   * @param positionTokenId - The token ID to burn
   * @param owner - Owner's Algorand address
   */
  @abimethod()
  burnPosition(
    positionTokenId: uint64,
    owner: Account
  ): void {
    assert(positionTokenId > 0 && positionTokenId < this.nextTokenId.value);
    
    // Only owner or authorized minter can burn
    const isOwner = Txn.sender === owner;
    const isAuthorized = Txn.sender === this.authorizedMinter.value;
    assert(isOwner || isAuthorized);
    
    // Update total supply
    this.totalSupply.value = this.totalSupply.value - 1;
    
    // Log burn event for off-chain cleanup
    log(op.concat(Bytes('position_burned:'), op.itob(positionTokenId)));
    log(op.concat(Bytes('position_burned_owner:'), owner.bytes));
  }

  /**
   * Get contract statistics (read-only)
   */
  @abimethod({ readonly: true })
  getContractStats(): [uint64, uint64, uint64, uint64] {
    return [
      this.nextTokenId.value - 1,  // Total tokens minted
      this.totalSupply.value,      // Current supply (minted - burned)
      this.maxSupply.value,        // Maximum supply
      this.contractVersion.value   // Contract version
    ];
  }

  /**
   * Check if token ID is valid (read-only)
   * For MVP: Only checks if token ID is in valid range
   * Off-chain system tracks full token metadata
   */
  @abimethod({ readonly: true })
  tokenExists(positionTokenId: uint64): uint64 {
    if (positionTokenId > 0 && positionTokenId < this.nextTokenId.value) {
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

  // =======================
  // GETTER METHODS
  // =======================

  /**
   * Get position owner
   */
  @abimethod({ readonly: true })
  getPositionOwner(tokenId: uint64): bytes {
    const owner = this.positionOwner(tokenId);
    assert(owner.exists, 'Position does not exist');
    return owner.value.bytes;
  }

  /**
   * Get position asset type
   */
  @abimethod({ readonly: true })
  getPositionAssetType(tokenId: uint64): uint64 {
    const assetType = this.positionAssetType(tokenId);
    if (assetType.exists) {
      return assetType.value;
    }
    return 0;
  }

  /**
   * Get position holdings amount
   */
  @abimethod({ readonly: true })
  getPositionHoldings(tokenId: uint64): uint64 {
    const holdings = this.positionHoldings(tokenId);
    if (holdings.exists) {
      return holdings.value;
    }
    return 0;
  }

  /**
   * Get position purchase value
   */
  @abimethod({ readonly: true })
  getPositionPurchaseValue(tokenId: uint64): uint64 {
    const purchaseValue = this.positionPurchaseValue(tokenId);
    if (purchaseValue.exists) {
      return purchaseValue.value;
    }
    return 0;
  }

  /**
   * Check if position exists
   */
  @abimethod({ readonly: true })
  positionExists(tokenId: uint64): boolean {
    const owner = this.positionOwner(tokenId);
    return owner.exists;
  }
}