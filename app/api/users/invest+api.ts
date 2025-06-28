import express from 'express';
import { userPortfolioService } from '../../../services/user-portfolio.service';
import { nftContractService } from '../../../services/nft-contract.service';
import { supabase } from '../../../utils/supabase';
import { moonPayService } from '../../../utils/moonpay';
import { getSolanaPrice, calculateEstimatedSolana } from '../../../utils/solana';
import { fetchCryptoPrices } from '../../../utils/crypto-prices';
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
      // MoonPay purchase fields
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
      
      if (!riskAccepted) {
        const assetNames = { 1: 'Bitcoin', 2: 'Algorand', 3: 'USDC', 4: 'Solana' };
        const assetName = assetNames[assetType as keyof typeof assetNames] || 'Crypto';
        
        return res.status(400).json({
          success: false,
          error: `${assetName} investment risk acknowledgment required`,
          requiresRiskDisclosure: true,
          riskFactors: [
            `${assetName} prices are highly volatile and can fluctuate significantly`,
            'Past performance does not guarantee future results',
            'You may lose some or all of your investment',
            'Custodial wallets mean Cultivest manages your crypto keys',
            'Consider your risk tolerance before investing'
          ]
        });
      }
    }

    // Support all 4 asset types
    if (![1, 2, 3, 4].includes(assetType)) {
      return res.status(400).json({
        success: false,
        error: 'Asset type must be 1 (Bitcoin), 2 (Algorand), 3 (USDC), or 4 (Solana)'
      });
    }

    // Get user's wallet for MoonPay purchases
    let wallet = null;
    if (isMoonPayPurchase) {
      const { data: walletData, error: walletError } = await supabase
        .from('wallets')
        .select('wallet_id, bitcoin_address, algorand_address, solana_address')
        .eq('user_id', userId)
        .single();

      if (walletError || !walletData) {
        return res.status(400).json({ 
          success: false,
          error: 'User wallet not found. Please create a wallet first.' 
        });
      }

      // Check for required wallet address based on asset type
      const requiredAddressCheck = {
        1: { field: 'bitcoin_address', name: 'Bitcoin' },
        2: { field: 'algorand_address', name: 'Algorand' },
        3: { field: 'algorand_address', name: 'USDC (Algorand)' }, // USDC on Algorand
        4: { field: 'solana_address', name: 'Solana' }
      };

      const addressCheck = requiredAddressCheck[assetType as keyof typeof requiredAddressCheck];
      if (!walletData[addressCheck.field as keyof typeof walletData]) {
        return res.status(400).json({ 
          success: false,
          error: `${addressCheck.name} wallet not found. Please create a new wallet to enable ${addressCheck.name} support.` 
        });
      }
      
      wallet = walletData;
    }

    // For MoonPay purchases, calculate crypto details based on asset type
    let calculatedHoldings = holdings;
    let calculatedPurchaseValue = purchaseValueUsd;
    let cryptoCalculation = null;
    let cryptoPrice = null;
    
    if (isMoonPayPurchase) {
      if (!wallet) {
        throw new Error('Wallet is required for MoonPay purchases');
      }
      
      if (assetType === 1) {
        // Bitcoin
        cryptoCalculation = await moonPayService.calculateEstimatedBitcoin(amountUSD);
        cryptoPrice = await moonPayService.getBitcoinPrice();
        
        if (!cryptoCalculation) {
          throw new Error('Failed to calculate Bitcoin estimation');
        }
        
        calculatedHoldings = Math.floor(cryptoCalculation.estimatedBTC * 100000000); // Convert to satoshis
        
      } else if (assetType === 4) {
        // Solana
        cryptoPrice = await getSolanaPrice();
        cryptoCalculation = await calculateEstimatedSolana(amountUSD);
        
        if (!cryptoCalculation) {
          throw new Error('Failed to calculate Solana estimation');
        }
        
        calculatedHoldings = Math.floor(cryptoCalculation.estimatedSOL * 1000000000); // Convert to lamports
        
      } else if (assetType === 2) {
        // Algorand
        const prices = await fetchCryptoPrices();
        cryptoPrice = prices.algorand;
        const feePercentage = 0.038; // 3.8% total fees
        const netAmount = amountUSD * (1 - feePercentage);
        const estimatedALGO = netAmount / cryptoPrice;
        
        cryptoCalculation = {
          estimatedALGO: estimatedALGO,
          moonpayFee: amountUSD * 0.035, // 3.5%
          networkFee: amountUSD * 0.003, // 0.3%
          totalFees: amountUSD * feePercentage
        };
        
        calculatedHoldings = Math.floor(estimatedALGO * 1000000); // Convert to microalgos
        
      } else if (assetType === 3) {
        // USDC
        const prices = await fetchCryptoPrices();
        cryptoPrice = prices['usd-coin'];
        const feePercentage = 0.038;
        const netAmount = amountUSD * (1 - feePercentage);
        const estimatedUSDC = netAmount / cryptoPrice;
        
        cryptoCalculation = {
          estimatedUSDC: estimatedUSDC,
          moonpayFee: amountUSD * 0.035,
          networkFee: amountUSD * 0.003,
          totalFees: amountUSD * feePercentage
        };
        
        calculatedHoldings = Math.floor(estimatedUSDC * 1000000); // Convert to microUSDC
      }
      
      calculatedPurchaseValue = amountUSD * 100; // Convert to cents
    }

    // Step 1: Get or create user's primary portfolio
    let userPortfolio = await userPortfolioService.getUserPrimaryPortfolio(userId);
    
    if (!userPortfolio) {
      console.log(`Creating primary portfolio for user ${userId}`);
      
      // Auto-create portfolio for user
      const portfolioOwnerAddress = isMoonPayPurchase && wallet ? wallet.algorand_address : algorandAddress;
      
      const portfolioResult = await nftContractService.mintPortfolioToken({
        owner: portfolioOwnerAddress,
        level: 1,
        metadataCid: 'QmDefaultPortfolioMetadata'
      });

      if (!portfolioResult.tokenId) {
        throw new Error('Failed to create portfolio for user');
      }

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

    // Step 2: Create investment table record
    const investmentId = uuidv4();
    
    // Map asset types to target assets for database
    const targetAssetMapping = { 1: 'BTC', 2: 'ALGO', 3: 'USDC', 4: 'SOL' };
    const targetAsset = targetAssetMapping[assetType as keyof typeof targetAssetMapping];
    
    const investmentData = {
      investment_id: investmentId,
      user_id: userId,
      investment_type: isMoonPayPurchase ? `${targetAsset.toLowerCase()}_purchase` : 'direct_investment',
      target_asset: targetAsset,
      amount_usd: isMoonPayPurchase ? amountUSD : (calculatedPurchaseValue / 100),
      status: 'completed',
      risk_acknowledged: riskAccepted,
      created_at: new Date().toISOString(),
      ...(wallet && { wallet_id: wallet.wallet_id }),
      ...(isMoonPayPurchase && cryptoCalculation && assetType === 1 && 'estimatedBTC' in cryptoCalculation && {
        estimated_btc: cryptoCalculation.estimatedBTC,
        bitcoin_price_usd: cryptoPrice,
        fees_paid: cryptoCalculation.totalFees
      }),
      ...(isMoonPayPurchase && cryptoCalculation && assetType === 4 && 'estimatedSOL' in cryptoCalculation && {
        estimated_sol: cryptoCalculation.estimatedSOL,
        solana_price_usd: cryptoPrice,
        fees_paid: cryptoCalculation.totalFees
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

    // Generate MoonPay widget URL only for MoonPay purchases
    let moonpayUrl = null;
    if (isMoonPayPurchase) {
      const moonPayConfig = {
        1: { code: 'btc', addressField: 'bitcoin_address' },
        2: { code: 'algo', addressField: 'algorand_address' },
        3: { code: 'usdc', addressField: 'algorand_address' }, // USDC on Algorand
        4: { code: 'sol', addressField: 'solana_address' }
      };
      
      const config = moonPayConfig[assetType as keyof typeof moonPayConfig];
      const walletAddress = wallet![config.addressField as keyof typeof wallet];
      
      moonpayUrl = moonPayService.generateWidgetUrl({
        walletAddress: walletAddress as string,
        currencyCode: config.code,
        baseCurrencyAmount: amountUSD,
        redirectURL: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/investment/success`,
        externalTransactionId: `cultivest_${config.code}_${investmentId}`
      });

      // Update investment with MoonPay URL
      await supabase
        .from('investments')
        .update({ moonpay_url: moonpayUrl })
        .eq('investment_id', investmentId);
    }

    // Step 3: Mint position NFT
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

    // Step 4: Add position to user's portfolio
    console.log(`🔍 Portfolio Debug - About to add position to portfolio:`);
    console.log(`- Portfolio Token ID: ${userPortfolio.portfolioTokenId}`);
    console.log(`- Position Token ID: ${positionResult.tokenId}`);
    console.log(`- Owner Address: ${ownerAddress}`);
    console.log(`- Portfolio App ID: ${userPortfolio.portfolioAppId}`);
    
    const portfolioAddResult = await nftContractService.addPositionToPortfolio({
      portfolioTokenId: BigInt(userPortfolio.portfolioTokenId),
      positionTokenId: BigInt(positionResult.tokenId),
      owner: ownerAddress
    });

    console.log(`Added position ${positionResult.tokenId} to portfolio ${userPortfolio.portfolioTokenId}`);

    // Step 5: Return complete investment result
    const assetTypeNames = {
      1: 'Bitcoin',
      2: 'Algorand',
      3: 'USDC',
      4: 'Solana'
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
          investmentId: investment.investment_id,
          status: investment.status
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
            targetAsset: targetAsset,
            estimatedAmount: cryptoCalculation ? (
              assetType === 1 && 'estimatedBTC' in cryptoCalculation ? cryptoCalculation.estimatedBTC : 
              assetType === 4 && 'estimatedSOL' in cryptoCalculation ? cryptoCalculation.estimatedSOL :
              assetType === 2 && 'estimatedALGO' in cryptoCalculation ? cryptoCalculation.estimatedALGO :
              assetType === 3 && 'estimatedUSDC' in cryptoCalculation ? cryptoCalculation.estimatedUSDC : 0) : 0,
            cryptoPrice,
            fees: cryptoCalculation ? {
              moonpayFee: cryptoCalculation.moonpayFee,
              networkFee: cryptoCalculation.networkFee,
              total: cryptoCalculation.totalFees
            } : { moonpayFee: 0, networkFee: 0, total: 0 }
          },
          nextSteps: [
            `Complete ${assetTypeNames[assetType as keyof typeof assetTypeNames]} purchase via MoonPay`,
            `${assetTypeNames[assetType as keyof typeof assetTypeNames]} will be deposited to your custodial wallet`,
            `Position NFT #${positionResult.tokenId} tracks your completed investment`,
            `You can view your ${assetTypeNames[assetType as keyof typeof assetTypeNames]} holdings and NFT in the dashboard`
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