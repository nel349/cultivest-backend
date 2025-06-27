import express from 'express';
import { nftContractService } from '../../services/nft-contract.service';

const router = express.Router();

// =======================
// POSITION NFT ENDPOINTS
// =======================


/**
 * Mint position token (for new investments)
 * POST /api/nft/position/mint
 * 
 * ROLES:
 * - Transaction Signer: Backend service (authorized minter)
 * - NFT Owner/Recipient: User specified in 'owner' field
 * 
 * @body userId - User ID for tracking/logging
 * @body owner - Algorand address of the user who will own the NFT (recipient)
 * @body assetType - 1=Bitcoin, 2=Algorand, 3=USDC
 * @body holdings - Amount held in smallest units
 * @body purchaseValueUsd - Purchase value in USD cents
 */
router.post('/position/mint', async (req, res) => {
  try {
    const { userId, owner, assetType, holdings, purchaseValueUsd } = req.body;

    // Validation
    if (!userId || !owner || !assetType || !holdings || !purchaseValueUsd) {
      return res.status(400).json({
        success: false,
        error: 'All fields are required: userId, owner (recipient address), assetType, holdings, purchaseValueUsd'
      });
    }

    if (![1, 2, 3].includes(assetType)) {
      return res.status(400).json({
        success: false,
        error: 'Asset type must be 1 (Bitcoin), 2 (Algorand), or 3 (USDC)'
      });
    }

    const result = await nftContractService.mintPositionToken(userId, {
      owner,
      assetType,
      holdings: BigInt(holdings),
      purchaseValueUsd: BigInt(purchaseValueUsd)
    });

    return res.json({
      success: true,
      data: {
        message: 'Position token minted successfully',
        ...result
      }
    });
  } catch (error) {
    console.error('Position token minting error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Minting failed'
    });
  }
});

/**
 * Update position token (when value changes)
 * PUT /api/nft/position/update
 */
router.put('/position/update', async (req, res) => {
  try {
    const { userId, positionTokenId, newHoldings } = req.body;

    if (!userId || !positionTokenId || !newHoldings) {
      return res.status(400).json({
        success: false,
        error: 'All fields are required: userId, positionTokenId, newHoldings'
      });
    }

    const result = await nftContractService.updatePositionToken(userId, {
      positionTokenId: BigInt(positionTokenId),
      newHoldings: BigInt(newHoldings)
    });

    return res.json({
      success: true,
      data: {
        message: 'Position token updated successfully',
        ...result
      }
    });
  } catch (error) {
    console.error('Position token update error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Update failed'
    });
  }
});

/**
 * Get Position NFT contract statistics
 * GET /api/nft/position/stats
 */
router.get('/position/stats', async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID query parameter is required'
      });
    }

    const result = await nftContractService.getPositionNFTStats(userId as string);

    return res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Position NFT stats error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get stats'
    });
  }
});

/**
 * Check if a position token exists
 * GET /api/nft/position/:tokenId/exists
 */
router.get('/position/:tokenId/exists', async (req, res) => {
  try {
    const { tokenId } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID query parameter is required'
      });
    }

    const result = await nftContractService.positionExists(userId as string, BigInt(tokenId));

    return res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Position exists check error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to check if position exists'
    });
  }
});

/**
 * Get position token owner
 * GET /api/nft/position/:tokenId/owner
 */
router.get('/position/:tokenId/owner', async (req, res) => {
  try {
    const { tokenId } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID query parameter is required'
      });
    }

    const result = await nftContractService.getPositionOwner(userId as string, BigInt(tokenId));

    return res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Get position owner error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get position owner'
    });
  }
});

/**
 * Get position token asset type
 * GET /api/nft/position/:tokenId/asset-type
 */
router.get('/position/:tokenId/asset-type', async (req, res) => {
  try {
    const { tokenId } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID query parameter is required'
      });
    }

    const result = await nftContractService.getPositionAssetType(userId as string, BigInt(tokenId));

    return res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Get position asset type error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get position asset type'
    });
  }
});

/**
 * Get position token holdings
 * GET /api/nft/position/:tokenId/holdings
 */
router.get('/position/:tokenId/holdings', async (req, res) => {
  try {
    const { tokenId } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID query parameter is required'
      });
    }

    const result = await nftContractService.getPositionHoldings(userId as string, BigInt(tokenId));

    return res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Get position holdings error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get position holdings'
    });
  }
});

/**
 * Get position token purchase value
 * GET /api/nft/position/:tokenId/purchase-value
 */
router.get('/position/:tokenId/purchase-value', async (req, res) => {
  try {
    const { tokenId } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID query parameter is required'
      });
    }

    const result = await nftContractService.getPositionPurchaseValue(userId as string, BigInt(tokenId));

    return res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Get position purchase value error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get position purchase value'
    });
  }
});

/**
 * Get all position token data (convenience endpoint)
 * GET /api/nft/position/:tokenId
 */
router.get('/position/:tokenId', async (req, res) => {
  try {
    const { tokenId } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID query parameter is required'
      });
    }

    // Get all position data in parallel
    const [exists, owner, assetType, holdings, purchaseValue] = await Promise.all([
      nftContractService.positionExists(userId as string, BigInt(tokenId)),
      nftContractService.getPositionOwner(userId as string, BigInt(tokenId)),
      nftContractService.getPositionAssetType(userId as string, BigInt(tokenId)),
      nftContractService.getPositionHoldings(userId as string, BigInt(tokenId)),
      nftContractService.getPositionPurchaseValue(userId as string, BigInt(tokenId))
    ]);

    return res.json({
      success: true,
      data: {
        tokenId: tokenId,
        exists: exists.exists,
        owner: owner.owner,
        ownerBase64: owner.ownerBase64,
        assetType: assetType.assetType,
        assetTypeName: assetType.assetTypeName,
        holdings: holdings.holdings,
        purchaseValue: purchaseValue.purchaseValue,
        appId: exists.appId
      }
    });
  } catch (error) {
    console.error('Get position data error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get position data'
    });
  }
});

// =======================
// PORTFOLIO NFT ENDPOINTS
// =======================



/**
 * Mint portfolio token (for new users)
 * POST /api/nft/portfolio/mint
 * 
 * ROLES:
 * - Transaction Signer: Backend service (authorized minter)
 * - NFT Owner/Recipient: User specified in 'owner' field
 * 
 * @body userId - User ID for tracking/logging
 * @body owner - Algorand address of the user who will own the portfolio NFT (recipient)
 * @body level - Portfolio level (1-5)
 * @body metadataCid - IPFS CID for portfolio metadata
 */
router.post('/portfolio/mint', async (req, res) => {
  try {
    const { userId, owner, level, metadataCid } = req.body;

    if (!userId || !owner || !level || !metadataCid) {
      return res.status(400).json({
        success: false,
        error: 'All fields are required: userId, owner (recipient address), level, metadataCid'
      });
    }

    if (level < 1 || level > 5) {
      return res.status(400).json({
        success: false,
        error: 'Level must be between 1 and 5'
      });
    }

    const result = await nftContractService.mintPortfolioToken(userId, {
      owner,
      level,
      metadataCid
    });

    return res.json({
      success: true,
      data: {
        message: 'Portfolio token minted successfully',
        ...result
      }
    });
  } catch (error) {
    console.error('Portfolio token minting error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Minting failed'
    });
  }
});

/**
 * Add position to portfolio
 * POST /api/nft/portfolio/add-position
 */
router.post('/portfolio/add-position', async (req, res) => {
  try {
    const { userId, portfolioTokenId, positionTokenId, owner } = req.body;

    if (!userId || !portfolioTokenId || !positionTokenId || !owner) {
      return res.status(400).json({
        success: false,
        error: 'All fields are required: userId, portfolioTokenId, positionTokenId, owner'
      });
    }

    const result = await nftContractService.addPositionToPortfolio(userId, {
      portfolioTokenId: BigInt(portfolioTokenId),
      positionTokenId: BigInt(positionTokenId),
      owner
    });

    return res.json({
      success: true,
      data: {
        message: 'Position added to portfolio successfully',
        ...result
      }
    });
  } catch (error) {
    console.error('Add position to portfolio error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add position to portfolio'
    });
  }
});

/**
 * Get Portfolio NFT contract statistics
 * GET /api/nft/portfolio/:appId/stats
 */
router.get('/portfolio/stats', async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID query parameter is required'
      });
    }

    const result = await nftContractService.getPortfolioNFTStats(userId as string);

    return res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Portfolio NFT stats error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get stats'
    });
  }
});

/**
 * Get portfolio position count
 * GET /api/nft/portfolio/:appId/position-count/:portfolioTokenId
 */
router.get('/portfolio/position-count/:portfolioTokenId', async (req, res) => {
  try {
    const { portfolioTokenId } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID query parameter is required'
      });
    }

    const result = await nftContractService.getPortfolioPositionCount(
      userId as string, 
      BigInt(portfolioTokenId)
    );

    return res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Get portfolio position count error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get position count'
    });
  }
});

/**
 * Get which portfolio a position belongs to
 * GET /api/nft/portfolio/position-portfolio/:positionTokenId
 */
router.get('/portfolio/position-portfolio/:positionTokenId', async (req, res) => {
  try {
    const { positionTokenId } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID query parameter is required'
      });
    }

    const result = await nftContractService.getPositionPortfolio(
      userId as string, 
      BigInt(positionTokenId)
    );

    return res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Get position portfolio error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get position portfolio'
    });
  }
});

/**
 * Get all positions that belong to a specific portfolio
 * GET /api/nft/portfolio/:portfolioTokenId/positions
 */
router.get('/portfolio/:portfolioTokenId/positions', async (req, res) => {
  try {
    const { portfolioTokenId } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID query parameter is required'
      });
    }

    const result = await nftContractService.getPortfolioPositions(
      userId as string, 
      BigInt(portfolioTokenId)
    );

    return res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Get portfolio positions error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get portfolio positions'
    });
  }
});

// =======================
// DEBUG/ADMIN ENDPOINTS
// =======================

/**
 * Fund Portfolio NFT contract for box storage
 * Uses deployer account with ALGO, not user account
 * POST /api/nft/debug/fund-portfolio-contract
 */
router.post('/debug/fund-portfolio-contract', async (req, res) => {
  try {
    const { amount } = req.body;

    // Default to 0.1 ALGO (100,000 microAlgos) if no amount specified
    const fundingAmount = amount || 100000;

    const result = await nftContractService.fundPortfolioContract(fundingAmount);

    return res.json({
      success: true,
      data: {
        message: 'Portfolio NFT contract funded successfully using deployer account',
        ...result
      }
    });
  } catch (error) {
    console.error('Fund portfolio contract error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fund contract'
    });
  }
});

// =======================
// COMBINED OPERATIONS
// =======================

/**
 * Create new investment with NFTs
 * This endpoint handles the complete flow:
 * 1. Mint position token for the investment
 * 2. Add position to user's portfolio
 * POST /api/nft/create-investment
 */
router.post('/create-investment', async (req, res) => {
  try {
    const { 
      userId, 
      portfolioTokenId,
      owner, 
      assetType, 
      holdings, 
      purchaseValueUsd 
    } = req.body;

    // Validation
    if (!userId || !portfolioTokenId || !owner || !assetType || !holdings || !purchaseValueUsd) {
      return res.status(400).json({
        success: false,
        error: 'All fields are required'
      });
    }

    // Step 1: Mint position token
    const positionResult = await nftContractService.mintPositionToken(userId, {
      owner,
      assetType,
      holdings: BigInt(holdings),
      purchaseValueUsd: BigInt(purchaseValueUsd)
    });

    if (!positionResult.tokenId) {
      throw new Error('Failed to mint position token');
    }

    // Step 2: Add position to portfolio
    const portfolioResult = await nftContractService.addPositionToPortfolio(userId, {
      portfolioTokenId: BigInt(portfolioTokenId),
      positionTokenId: BigInt(positionResult.tokenId),
      owner
    });

    return res.json({
      success: true,
      data: {
        message: 'Investment created with NFTs successfully',
        positionTokenId: positionResult.tokenId,
        positionTransactionId: positionResult.transactionId,
        portfolioTransactionId: portfolioResult.transactionId,
        portfolioTokenId: portfolioTokenId.toString()
      }
    });
  } catch (error) {
    console.error('Create investment with NFTs error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create investment with NFTs'
    });
  }
});

export default router;