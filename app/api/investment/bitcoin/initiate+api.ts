import express from 'express';
import { supabase } from '../../../../utils/supabase';
import { moonPayService } from '../../../../utils/moonpay';
import { v4 as uuidv4 } from 'uuid';
import { userPortfolioService } from '../../../../services/user-portfolio.service';
import { nftContractService } from '../../../../services/nft-contract.service';

const router = express.Router();

interface BitcoinInvestmentRequest {
  userID: string;
  amountUSD: number;
  riskAccepted?: boolean;
  investmentType?: 'market_buy' | 'dollar_cost_average';
}

router.post('/', async (req, res) => {
  try {
    // DEPRECATION NOTICE
    console.warn('⚠️  DEPRECATED: /investment/bitcoin/initiate is deprecated. Use /users/:userId/invest with useMoonPay: true instead.');
    
    // Add deprecation header
    res.set('X-API-Deprecated', 'true');
    res.set('X-API-Deprecated-Message', 'Use /users/:userId/invest with useMoonPay: true instead');
    res.set('X-API-Deprecated-Date', '2025-06-27');
    
    // TODO: Remove this endpoint in future version
    const { userID, amountUSD, riskAccepted = false }: BitcoinInvestmentRequest = req.body;
    // const authHeader = req.headers.authorization;

    // Validate request
    if (!amountUSD || amountUSD < 1 || amountUSD > 10000) {
      return res.status(400).json({
        error: 'Invalid amount. Must be between $1 and $10,000.'
      });
    }

    // Bitcoin investment risk disclosure required
    if (!riskAccepted) {
      return res.status(400).json({
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

    // if (!authHeader || !authHeader.startsWith('Bearer ')) {
    //   return res.status(401).json({ error: 'Authorization token required' });
    // }

    // TODO: Uncomment this when we have a way to get the user ID
    // Extract and verify JWT token
    // const token = authHeader.split(' ')[1];
    // const decoded = verifyJWT(token);
    
    // if (!decoded) {
    //   return res.status(401).json({ error: 'Invalid user token' });
    // }
    
    // console.log('🪙 Processing Bitcoin investment:', { userId: decoded.userId, amountUSD });
    
    // // Get user from database
    // const { data: user, error: userError } = await supabase
    //   .from('users')
    //   .select('user_id, phone_number')
    //   .eq('user_id', decoded.userId)
    //   .single();

    // if (userError || !user) {
    //   return res.status(401).json({ error: 'User not found' });
    // }

    // Get user's Bitcoin wallet
    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('wallet_id, bitcoin_address, algorand_address')
      .eq('user_id', userID)
      .single();

    if (walletError || !wallet) {
      return res.status(400).json({ 
        error: 'User wallet not found. Please create a wallet first.' 
      });
    }

    if (!wallet.bitcoin_address) {
      return res.status(400).json({ 
        error: 'Bitcoin wallet not found. Please create a new wallet to enable Bitcoin support.' 
      });
    }

    // Calculate Bitcoin investment details
    const bitcoinCalculation = moonPayService.calculateEstimatedBitcoin(amountUSD);
    const bitcoinPrice = await moonPayService.getBitcoinPrice();

    // Create investment record
    const investmentId = uuidv4();
    
    const { error: investmentError } = await supabase
      .from('investments')
      .insert({
        investment_id: investmentId,
        user_id: userID,
        wallet_id: wallet.wallet_id,
        investment_type: 'bitcoin_purchase',
        target_asset: 'BTC',
        amount_usd: amountUSD,
        estimated_btc: bitcoinCalculation.estimatedBTC,
        bitcoin_price_usd: bitcoinPrice,
        fees_paid: bitcoinCalculation.totalFees,
        status: 'pending_payment',
        risk_acknowledged: riskAccepted,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (investmentError) {
      console.error('Failed to create investment record:', investmentError);
      
      // Check if investments table doesn't exist
      if (investmentError.message.includes('relation "investments" does not exist')) {
        return res.status(500).json({ 
          error: 'Investment system not fully configured. Please run database migration.' 
        });
      }
      
      return res.status(500).json({ error: 'Failed to initiate Bitcoin investment' });
    }

    // Generate MoonPay widget URL for Bitcoin purchase
    const moonpayUrl = moonPayService.generateWidgetUrl({
      walletAddress: wallet.bitcoin_address,
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

    // Create NFT records for this investment
    let nftDetails = null;
    try {
      console.log(`🎨 Creating NFT records for investment ${investmentId}`);
      
      // Get or create user's primary portfolio
      let userPortfolio = await userPortfolioService.getUserPrimaryPortfolio(userID);
      
      if (!userPortfolio) {
        console.log(`Creating primary portfolio for user ${userID}`);
        
        // Auto-create portfolio for user
        const portfolioResult = await nftContractService.mintPortfolioToken({
          owner: wallet.algorand_address,
          level: 1,
          metadataCid: 'QmDefaultBitcoinPortfolioMetadata'
        });

        if (portfolioResult.tokenId) {
          // Store in database
          userPortfolio = await userPortfolioService.storeUserPortfolio({
            userId: userID,
            portfolioTokenId: parseInt(portfolioResult.tokenId),
            portfolioAppId: parseInt(portfolioResult.appId),
            algorandAddress: wallet.algorand_address,
            isPrimary: true,
            customName: 'My Bitcoin Portfolio'
          });
          
          console.log(`Created portfolio token ${portfolioResult.tokenId} for user ${userID}`);
        }
      }

      // Mint position NFT for this Bitcoin investment
      const positionResult = await nftContractService.mintPositionToken({
        owner: wallet.algorand_address,
        assetType: 1, // Bitcoin
        holdings: BigInt(Math.floor(bitcoinCalculation.estimatedBTC * 100000000)), // Convert to satoshis
        purchaseValueUsd: BigInt(amountUSD * 100) // Convert to cents
      });

      if (positionResult.tokenId && userPortfolio) {
        // Add position to user's portfolio
        await nftContractService.addPositionToPortfolio(userID, {
          portfolioTokenId: BigInt(userPortfolio.portfolioTokenId),
          positionTokenId: BigInt(positionResult.tokenId),
          owner: wallet.algorand_address
        });

        console.log(`Added position ${positionResult.tokenId} to portfolio ${userPortfolio.portfolioTokenId}`);
        
        nftDetails = {
          positionTokenId: positionResult.tokenId,
          portfolioTokenId: userPortfolio.portfolioTokenId.toString(),
          transactionId: positionResult.transactionId
        };
      }
    } catch (nftError) {
      console.error('NFT creation failed (investment still proceeding):', nftError);
      // Don't fail the entire investment if NFT creation fails
    }

    console.log(`✅ Bitcoin investment initiated: ${investmentId}`);

    return res.json({
      success: true,
      message: 'Bitcoin investment initiated successfully',
      investment: {
        investmentId,
        type: 'bitcoin_purchase',
        amountUSD,
        estimatedBTC: bitcoinCalculation.estimatedBTC,
        bitcoinPrice,
        fees: {
          moonpayFee: bitcoinCalculation.moonpayFee,
          networkFee: bitcoinCalculation.networkFee,
          total: bitcoinCalculation.totalFees
        },
        walletAddress: wallet.bitcoin_address,
        status: 'pending_payment',
        riskLevel: 'High - Volatile Asset',
        custodyType: 'custodial'
      },
      moonpayUrl,
      nft: nftDetails,
      nextSteps: nftDetails ? [
        'Complete Bitcoin purchase via MoonPay',
        'Bitcoin will be deposited to your custodial wallet',
        `Position NFT #${nftDetails.positionTokenId} created to track your investment`,
        'You can view your Bitcoin holdings and NFT in the dashboard'
      ] : [
        'Complete Bitcoin purchase via MoonPay',
        'Bitcoin will be deposited to your custodial wallet',
        'NFT creation pending - check back later',
        'You can view your Bitcoin holdings in the dashboard'
      ]
    });

  } catch (error) {
    console.error('Bitcoin investment initiation error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;