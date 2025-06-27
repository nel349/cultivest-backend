import express from 'express';
import { userPortfolioService } from '../../../services/user-portfolio.service';
import { nftContractService } from '../../../services/nft-contract.service';
import { supabase } from '../../../utils/supabase';
import { moonPayService } from '../../../utils/moonpay';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

/**
 * User-centric investment endpoint
 * Handles both MoonPay purchases and direct investment recording
 * Creates investment table records + NFTs
 * POST /api/users/:userId/invest
 */
router.post('/:userId/invest', async (req, res) => {
  try {
    const { userId } = req.params;
    const { 
      algorandAddress, 
      assetType, 
      holdings, 
      purchaseValueUsd, 
      portfolioName,
      // New Bitcoin purchase fields
      amountUSD,
      useMoonPay = false,
      riskAccepted = false
    } = req.body;

    // Determine if this is a MoonPay purchase or direct investment recording
    const isMoonPayPurchase = useMoonPay && amountUSD;
    
    // Validation for direct investment recording
    if (!isMoonPayPurchase) {
      if (!algorandAddress || !assetType || !holdings || !purchaseValueUsd) {
        return res.status(400).json({
          success: false,
          error: 'For direct investment: algorandAddress, assetType, holdings, purchaseValueUsd are required'
        });
      }
    }
    
    // Validation for MoonPay purchase
    if (isMoonPayPurchase) {
      if (!algorandAddress || !amountUSD || amountUSD < 1 || amountUSD > 10000) {
        return res.status(400).json({
          success: false,
          error: 'For MoonPay purchase: algorandAddress and amountUSD (1-10000) are required'
        });
      }
      
      if (assetType !== 1) {
        return res.status(400).json({
          success: false,
          error: 'MoonPay purchases currently only support Bitcoin (assetType: 1)'
        });
      }
      
      if (!riskAccepted) {
        return res.status(400).json({
          success: false,
          error: 'Bitcoin investment risk acknowledgment required',
          requiresRiskDisclosure: true,
          riskFactors: [
            'Bitcoin prices are highly volatile and can fluctuate significantly',
            'Past performance does not guarantee future results',
            'You may lose some or all of your investment',
            'Custodial wallets mean Cultivest manages your Bitcoin keys',
            'Consider your risk tolerance before investing'
          ]
        });
      }
    }

    if (![1, 2, 3].includes(assetType)) {
      return res.status(400).json({
        success: false,
        error: 'Asset type must be 1 (Bitcoin), 2 (Algorand), or 3 (USDC)'
      });
    }

    // Get user's wallet for Bitcoin purchases
    let wallet = null;
    if (isMoonPayPurchase) {
      const { data: walletData, error: walletError } = await supabase
        .from('wallets')
        .select('wallet_id, bitcoin_address, algorand_address')
        .eq('user_id', userId)
        .single();

      if (walletError || !walletData) {
        return res.status(400).json({ 
          success: false,
          error: 'User wallet not found. Please create a wallet first.' 
        });
      }

      if (!walletData.bitcoin_address) {
        return res.status(400).json({ 
          success: false,
          error: 'Bitcoin wallet not found. Please create a new wallet to enable Bitcoin support.' 
        });
      }
      
      wallet = walletData;
      
      if (!wallet) {
        throw new Error('Wallet data is required for MoonPay purchases');
      }
    }

    // For MoonPay purchases, calculate Bitcoin details
    let calculatedHoldings = holdings;
    let calculatedPurchaseValue = purchaseValueUsd;
    let bitcoinCalculation = null;
    let bitcoinPrice = null;
    
    if (isMoonPayPurchase) {
      if (!wallet) {
        throw new Error('Wallet is required for MoonPay purchases');
      }
      
      bitcoinCalculation = await moonPayService.calculateEstimatedBitcoin(amountUSD);
      bitcoinPrice = await moonPayService.getBitcoinPrice();
      
      if (!bitcoinCalculation) {
        throw new Error('Failed to calculate Bitcoin estimation');
      }
      
      calculatedHoldings = Math.floor(bitcoinCalculation.estimatedBTC * 100000000); // Convert to satoshis
      calculatedPurchaseValue = amountUSD * 100; // Convert to cents
    }

    // Step 1: Get or create user's primary portfolio
    let userPortfolio = await userPortfolioService.getUserPrimaryPortfolio(userId);
    
    if (!userPortfolio) {
      console.log(`Creating primary portfolio for user ${userId}`);
      
      // Auto-create portfolio for user
      // For MoonPay purchases, use the Algorand address from the wallet (database)
      // For direct investments, use the provided algorandAddress from request
      const portfolioOwnerAddress = isMoonPayPurchase && wallet ? wallet.algorand_address : algorandAddress;
      
      const portfolioResult = await nftContractService.mintPortfolioToken({
        owner: portfolioOwnerAddress,
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
        algorandAddress: portfolioOwnerAddress,
        isPrimary: true,
        customName: portfolioName || 'My Portfolio'
      });

      console.log(`Created portfolio token ${portfolioResult.tokenId} for user ${userId}`);
    }

    // Step 2: Create investment table record (for indexing/tracking)
    let investmentRecord = null;
    let moonpayUrl = null;
    
    // Always create investment record for tracking
    const investmentId = uuidv4();
    
    // Create investment record for both modes
    const investmentData = {
      investment_id: investmentId,
      user_id: userId,
      investment_type: isMoonPayPurchase ? 'bitcoin_purchase' : 'direct_investment',
      target_asset: assetType === 1 ? 'BTC' : assetType === 2 ? 'ALGO' : 'USDC',
      amount_usd: isMoonPayPurchase ? amountUSD : (calculatedPurchaseValue / 100),
      status: 'completed', // Always completed for invest endpoint
      risk_acknowledged: riskAccepted,
      created_at: new Date().toISOString(),
      ...(wallet && { wallet_id: wallet.wallet_id }),
      ...(isMoonPayPurchase && {
        estimated_btc: bitcoinCalculation!.estimatedBTC,
        bitcoin_price_usd: bitcoinPrice,
        fees_paid: bitcoinCalculation!.totalFees
      })
    };

    const { data: investment, error: investmentError } = await supabase
      .from('investments')
      .insert(investmentData)
      .select()
      .single();

    if (investmentError) {
      console.error('Failed to create investment record:', investmentError);
      return res.status(500).json({ 
        success: false,
        error: 'Failed to create investment record' 
      });
    }

    investmentRecord = investment;

    // Generate MoonPay widget URL only for MoonPay purchases
    if (isMoonPayPurchase) {
      moonpayUrl = moonPayService.generateWidgetUrl({
        walletAddress: wallet!.bitcoin_address,
        currencyCode: 'btc',
        baseCurrencyAmount: amountUSD,
        redirectURL: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/investment/success`,
        externalTransactionId: `cultivest_btc_${investmentId}`
      });

      // Update investment with MoonPay URL
      await supabase
        .from('investments')
        .update({ moonpay_url: moonpayUrl })
        .eq('investment_id', investmentId);
    }

    // Step 3: Mint position NFT
    // For MoonPay purchases, use the Algorand address from the wallet (database)
    // For direct investments, use the provided algorandAddress from request
    const ownerAddress = isMoonPayPurchase && wallet ? wallet.algorand_address : algorandAddress;
    
    const positionResult = await nftContractService.mintPositionToken({
      owner: ownerAddress,
      assetType,
      holdings: BigInt(calculatedHoldings),
      purchaseValueUsd: BigInt(calculatedPurchaseValue)
    });

    if (!positionResult.tokenId) {
      throw new Error('Failed to mint position token');
    }

    console.log(`Minted position token ${positionResult.tokenId} for user ${userId}`);

    // Step 3: Add position to user's portfolio
    const portfolioAddResult = await nftContractService.addPositionToPortfolio(userId, {
      portfolioTokenId: BigInt(userPortfolio.portfolioTokenId),
      positionTokenId: BigInt(positionResult.tokenId),
      owner: ownerAddress
    });

    console.log(`Added position ${positionResult.tokenId} to portfolio ${userPortfolio.portfolioTokenId}`);

    // Step 4: Return complete investment result
    const assetTypeNames = {
      1: 'Bitcoin',
      2: 'Algorand',
      3: 'USDC'
    };

    const response = {
      success: true,
      data: {
        message: 'Investment recorded successfully',
        investment: {
          positionTokenId: positionResult.tokenId,
          portfolioTokenId: userPortfolio.portfolioTokenId.toString(),
          assetType: assetType.toString(),
          assetTypeName: assetTypeNames[assetType as keyof typeof assetTypeNames],
          holdings: calculatedHoldings.toString(),
          purchaseValueUsd: calculatedPurchaseValue.toString(),
          owner: ownerAddress,
          ...(investmentRecord && {
            investmentId: investmentRecord.investment_id,
            status: investmentRecord.status
          })
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
        },
        ...(isMoonPayPurchase && {
          moonpay: {
            url: moonpayUrl,
            estimatedBTC: bitcoinCalculation!.estimatedBTC,
            bitcoinPrice,
            fees: {
              moonpayFee: bitcoinCalculation!.moonpayFee,
              networkFee: bitcoinCalculation!.networkFee,
              total: bitcoinCalculation!.totalFees
            }
          },
          nextSteps: isMoonPayPurchase ? [
            'Complete Bitcoin purchase via MoonPay',
            'Bitcoin will be deposited to your custodial wallet',
            `Position NFT #${positionResult.tokenId} tracks your completed investment`,
            'You can view your Bitcoin holdings and NFT in the dashboard'
          ] : [
            `Position NFT #${positionResult.tokenId} created successfully`,
            'Your investment is now tracked on the blockchain',
            'View your portfolio and NFTs in the dashboard'
          ]
        })
      }
    };

    return res.json(response);

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