import express from 'express';
import { userPortfolioService } from '../../../services/user-portfolio.service';
import { nftContractService } from '../../../services/nft-contract.service';

const router = express.Router();

/**
 * User-centric investment endpoint
 * Automatically handles portfolio lookup and position creation
 * POST /api/users/:userId/invest
 */
router.post('/:userId/invest', async (req, res) => {
  try {
    const { userId } = req.params;
    const { algorandAddress, assetType, holdings, purchaseValueUsd, portfolioName } = req.body;

    // Validation
    if (!algorandAddress || !assetType || !holdings || !purchaseValueUsd) {
      return res.status(400).json({
        success: false,
        error: 'All fields are required: algorandAddress, assetType, holdings, purchaseValueUsd'
      });
    }

    if (![1, 2, 3].includes(assetType)) {
      return res.status(400).json({
        success: false,
        error: 'Asset type must be 1 (Bitcoin), 2 (Algorand), or 3 (USDC)'
      });
    }

    // Step 1: Get or create user's primary portfolio
    let userPortfolio = await userPortfolioService.getUserPrimaryPortfolio(userId);
    
    if (!userPortfolio) {
      console.log(`Creating primary portfolio for user ${userId}`);
      
      // Auto-create portfolio for user
      const portfolioResult = await nftContractService.mintPortfolioToken(userId, {
        owner: algorandAddress,
        level: 1, // Start at level 1
        metadataCid: 'QmDefaultPortfolioMetadata' // TODO: Generate proper metadata
      });

      if (!portfolioResult.tokenId) {
        throw new Error('Failed to create portfolio for user');
      }

      // Store in database
      userPortfolio = await userPortfolioService.storeUserPortfolio({
        userId,
        portfolioTokenId: parseInt(portfolioResult.tokenId),
        portfolioAppId: parseInt(portfolioResult.appId),
        algorandAddress,
        isPrimary: true,
        customName: portfolioName || 'My Portfolio'
      });

      console.log(`Created portfolio token ${portfolioResult.tokenId} for user ${userId}`);
    }

    // Step 2: Mint position NFT
    const positionResult = await nftContractService.mintPositionToken(userId, {
      owner: algorandAddress,
      assetType,
      holdings: BigInt(holdings),
      purchaseValueUsd: BigInt(purchaseValueUsd)
    });

    if (!positionResult.tokenId) {
      throw new Error('Failed to mint position token');
    }

    console.log(`Minted position token ${positionResult.tokenId} for user ${userId}`);

    // Step 3: Add position to user's portfolio
    const portfolioAddResult = await nftContractService.addPositionToPortfolio(userId, {
      portfolioTokenId: BigInt(userPortfolio.portfolioTokenId),
      positionTokenId: BigInt(positionResult.tokenId),
      owner: algorandAddress
    });

    console.log(`Added position ${positionResult.tokenId} to portfolio ${userPortfolio.portfolioTokenId}`);

    // Step 4: Return complete investment result
    const assetTypeNames = {
      1: 'Bitcoin',
      2: 'Algorand',
      3: 'USDC'
    };

    return res.json({
      success: true,
      data: {
        message: 'Investment created successfully',
        investment: {
          positionTokenId: positionResult.tokenId,
          portfolioTokenId: userPortfolio.portfolioTokenId.toString(),
          assetType: assetType.toString(),
          assetTypeName: assetTypeNames[assetType as keyof typeof assetTypeNames],
          holdings: holdings.toString(),
          purchaseValueUsd: purchaseValueUsd.toString(),
          owner: algorandAddress
        },
        portfolio: {
          id: userPortfolio.id,
          tokenId: userPortfolio.portfolioTokenId.toString(),
          customName: userPortfolio.customName,
          isPrimary: userPortfolio.isPrimary
        },
        blockchain: {
          positionTransactionId: positionResult.transactionId,
          portfolioTransactionId: portfolioAddResult.transactionId,
          positionAppId: positionResult.appId,
          portfolioAppId: userPortfolio.portfolioAppId.toString()
        }
      }
    });

  } catch (error) {
    console.error('User investment error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create investment'
    });
  }
});

/**
 * Get user's investment summary
 * GET /api/users/:userId/investments
 */
router.get('/:userId/investments', async (req, res) => {
  try {
    const { userId } = req.params;

    // Get user's primary portfolio
    const userPortfolio = await userPortfolioService.getUserPrimaryPortfolio(userId);
    
    if (!userPortfolio) {
      return res.json({
        success: true,
        data: {
          hasInvestments: false,
          message: 'User has no investments yet',
          portfolio: null,
          positions: []
        }
      });
    }

    // Get portfolio positions from blockchain
    const portfolioPositions = await nftContractService.getPortfolioPositions(
      userId, 
      BigInt(userPortfolio.portfolioTokenId)
    );

    // Get portfolio stats
    const portfolioStats = await nftContractService.getPortfolioNFTStats(userId);

    return res.json({
      success: true,
      data: {
        hasInvestments: portfolioPositions.positionCount > 0,
        portfolio: {
          id: userPortfolio.id,
          tokenId: userPortfolio.portfolioTokenId.toString(),
          customName: userPortfolio.customName,
          isPrimary: userPortfolio.isPrimary,
          positionCount: portfolioPositions.positionCount
        },
        positions: portfolioPositions.positions,
        stats: portfolioStats
      }
    });

  } catch (error) {
    console.error('Get user investments error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get user investments'
    });
  }
});

/**
 * Get user's investment by position token ID
 * GET /api/users/:userId/investments/:positionTokenId
 */
router.get('/:userId/investments/:positionTokenId', async (req, res) => {
  try {
    const { userId, positionTokenId } = req.params;

    // Get position details from blockchain
    const [exists, owner, assetType, holdings, purchaseValue] = await Promise.all([
      nftContractService.positionExists(userId, BigInt(positionTokenId)),
      nftContractService.getPositionOwner(userId, BigInt(positionTokenId)),
      nftContractService.getPositionAssetType(userId, BigInt(positionTokenId)),
      nftContractService.getPositionHoldings(userId, BigInt(positionTokenId)),
      nftContractService.getPositionPurchaseValue(userId, BigInt(positionTokenId))
    ]);

    if (!exists.exists) {
      return res.status(404).json({
        success: false,
        error: 'Position not found'
      });
    }

    // Get which portfolio this position belongs to
    const portfolioMapping = await nftContractService.getPositionPortfolio(userId, BigInt(positionTokenId));
    
    return res.json({
      success: true,
      data: {
        position: {
          tokenId: positionTokenId,
          exists: exists.exists,
          owner: owner.owner,
          assetType: assetType.assetType,
          assetTypeName: assetType.assetTypeName,
          holdings: holdings.holdings,
          purchaseValue: purchaseValue.purchaseValue,
          portfolioTokenId: portfolioMapping.portfolioTokenId
        }
      }
    });

  } catch (error) {
    console.error('Get user investment error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get investment'
    });
  }
});

export default router;