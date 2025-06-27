import express from 'express';
import { supabase } from '../../../utils/supabase';
import { nftContractService } from '../../../services/nft-contract.service';

const router = express.Router();

// =======================
// USER PORTFOLIO DISCOVERY
// =======================

/**
 * Get user's portfolio NFT tokens
 * GET /api/users/:userId/portfolio
 */
router.get('/:userId/portfolio', async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    // Get user's portfolios from Supabase
    const { data: portfolios, error } = await supabase
      .from('user_nft_portfolios')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch user portfolios'
      });
    }

    if (!portfolios || portfolios.length === 0) {
      return res.json({
        success: true,
        data: {
          hasPortfolio: false,
          portfolios: [],
          message: 'User has no portfolio NFTs. Create one first.'
        }
      });
    }

    return res.json({
      success: true,
      data: {
        hasPortfolio: true,
        portfolios: portfolios.map(p => ({
          id: p.id,
          tokenId: p.portfolio_token_id.toString(),
          appId: p.portfolio_app_id.toString(),
          algorandAddress: p.algorand_address,
          isPrimary: p.is_primary,
          customName: p.custom_name,
          createdAt: p.created_at,
          updatedAt: p.updated_at
        }))
      }
    });
  } catch (error) {
    console.error('Get user portfolio error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get user portfolio'
    });
  }
});

/**
 * Get user's primary portfolio with full details
 * GET /api/users/:userId/portfolio/primary
 */
router.get('/:userId/portfolio/primary', async (req, res) => {
  try {
    const { userId } = req.params;

    // Get user's primary portfolio from Supabase
    const { data: portfolio, error } = await supabase
      .from('user_nft_portfolios')
      .select('*')
      .eq('user_id', userId)
      .eq('is_primary', true)
      .single();

    if (error || !portfolio) {
      return res.status(404).json({
        success: false,
        error: 'User has no primary portfolio'
      });
    }

    // Get portfolio details from blockchain
    const [stats, positions] = await Promise.all([
      nftContractService.getPortfolioNFTStats(userId),
      nftContractService.getPortfolioPositions(userId, BigInt(portfolio.portfolio_token_id))
    ]);

    return res.json({
      success: true,
      data: {
        portfolio: {
          id: portfolio.id,
          tokenId: portfolio.portfolio_token_id.toString(),
          appId: portfolio.portfolio_app_id.toString(),
          algorandAddress: portfolio.algorand_address,
          isPrimary: portfolio.is_primary,
          customName: portfolio.custom_name,
          createdAt: portfolio.created_at,
          updatedAt: portfolio.updated_at
        },
        stats,
        positions
      }
    });
  } catch (error) {
    console.error('Get user primary portfolio error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get primary portfolio'
    });
  }
});

/**
 * Get positions for user's primary portfolio
 * GET /api/users/:userId/portfolio/positions
 */
router.get('/:userId/portfolio/positions', async (req, res) => {
  try {
    const { userId } = req.params;

    // Get user's primary portfolio from Supabase
    const { data: portfolio, error } = await supabase
      .from('user_nft_portfolios')
      .select('portfolio_token_id')
      .eq('user_id', userId)
      .eq('is_primary', true)
      .single();

    if (error || !portfolio) {
      return res.status(404).json({
        success: false,
        error: 'User has no primary portfolio'
      });
    }

    // Get positions from blockchain
    const result = await nftContractService.getPortfolioPositions(
      userId, 
      BigInt(portfolio.portfolio_token_id)
    );

    return res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Get user portfolio positions error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get portfolio positions'
    });
  }
});

// =======================
// PORTFOLIO MANAGEMENT
// =======================

/**
 * Create a new portfolio for user (mints NFT + stores mapping)
 * POST /api/users/:userId/portfolio
 */
router.post('/:userId/portfolio', async (req, res) => {
  try {
    const { userId } = req.params;
    const { algorandAddress, customName, level = 1, metadataCid } = req.body;

    if (!algorandAddress || !metadataCid) {
      return res.status(400).json({
        success: false,
        error: 'algorandAddress and metadataCid are required'
      });
    }

    // Check if user already has a primary portfolio
    const { data: existingPortfolio } = await supabase
      .from('user_nft_portfolios')
      .select('id')
      .eq('user_id', userId)
      .eq('is_primary', true)
      .single();

    const isPrimary = !existingPortfolio; // First portfolio is primary

    // Mint portfolio NFT on blockchain
    const mintResult = await nftContractService.mintPortfolioToken(userId, {
      owner: algorandAddress,
      level,
      metadataCid
    });

    if (!mintResult.tokenId) {
      throw new Error('Failed to mint portfolio NFT');
    }

    // Store mapping in Supabase
    const { data: portfolioRecord, error } = await supabase
      .from('user_nft_portfolios')
      .insert({
        user_id: userId,
        portfolio_token_id: parseInt(mintResult.tokenId),
        portfolio_app_id: parseInt(mintResult.appId),
        algorand_address: algorandAddress,
        is_primary: isPrimary,
        custom_name: customName || (isPrimary ? 'My Portfolio' : 'Portfolio')
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase error storing portfolio:', error);
      return res.status(500).json({
        success: false,
        error: 'Portfolio NFT minted but failed to store mapping'
      });
    }

    return res.json({
      success: true,
      data: {
        message: 'Portfolio created successfully',
        portfolio: {
          id: portfolioRecord.id,
          tokenId: portfolioRecord.portfolio_token_id.toString(),
          appId: portfolioRecord.portfolio_app_id.toString(),
          algorandAddress: portfolioRecord.algorand_address,
          isPrimary: portfolioRecord.is_primary,
          customName: portfolioRecord.custom_name
        },
        blockchain: {
          transactionId: mintResult.transactionId,
          tokenId: mintResult.tokenId,
          appId: mintResult.appId
        }
      }
    });
  } catch (error) {
    console.error('Create user portfolio error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create portfolio'
    });
  }
});

/**
 * Update portfolio custom name
 * PUT /api/users/:userId/portfolio/:portfolioId
 */
router.put('/:userId/portfolio/:portfolioId', async (req, res) => {
  try {
    const { userId, portfolioId } = req.params;
    const { customName } = req.body;

    if (!customName) {
      return res.status(400).json({
        success: false,
        error: 'customName is required'
      });
    }

    const { data: portfolio, error } = await supabase
      .from('user_nft_portfolios')
      .update({ 
        custom_name: customName,
        updated_at: new Date().toISOString()
      })
      .eq('id', portfolioId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error || !portfolio) {
      return res.status(404).json({
        success: false,
        error: 'Portfolio not found or not owned by user'
      });
    }

    return res.json({
      success: true,
      data: {
        message: 'Portfolio updated successfully',
        portfolio: {
          id: portfolio.id,
          tokenId: portfolio.portfolio_token_id.toString(),
          customName: portfolio.custom_name,
          updatedAt: portfolio.updated_at
        }
      }
    });
  } catch (error) {
    console.error('Update portfolio error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update portfolio'
    });
  }
});

export default router;