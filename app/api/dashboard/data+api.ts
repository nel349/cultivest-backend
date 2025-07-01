import express from 'express';
import { userPortfolioService } from '../../../services/user-portfolio.service';
import { supabase } from '../../../utils/supabase';
import { getBitcoinBalance } from '../../../utils/bitcoin';
import { getSolanaBalance } from '../../../utils/solana';
import { fetchCryptoPrices } from '../../../utils/crypto-prices';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    // Accept both userId and userID for backward compatibility
    const userId = req.query.userId || req.query.userID;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId or userID query parameter is required'
      });
    }

    console.log(`📊 Fetching dashboard data for user: ${userId}`);

    // Fetch user profile to get basic user data
    const { data: userProfile, error: userProfileError } = await supabase
      .from('users')
      .select('user_id, email, name, phone_number, first_investment_completed_at, first_investment_celebration_viewed_at')
      .eq('user_id', userId)
      .single();

    if (userProfileError) {
      console.error('Error fetching user profile:', userProfileError);
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Fetch user's wallet addresses separately
    const { data: userWallet, error: walletError } = await supabase
      .from('wallets')
      .select('algorand_address, bitcoin_address, solana_address')
      .eq('user_id', userId)
      .single();

    if (walletError) {
      console.warn('No wallet found for user:', walletError);
    }

    // Combine user profile with wallet addresses
    const userWithWallet = {
      ...userProfile,
      algorand_address: userWallet?.algorand_address || null,
      bitcoin_address: userWallet?.bitcoin_address || null,
      solana_address: userWallet?.solana_address || null
    };

    // Fetch user's primary portfolio
    const userPortfolio = await userPortfolioService.getUserPrimaryPortfolio(userId as string);

    // Fetch user's investments
    const { data: investments, error: investmentsError } = await supabase
      .from('investments')
      .select('investment_id, target_asset, amount_usd, status')
      .eq('user_id', userId);

    if (investmentsError) {
      console.error('Error fetching investments:', investmentsError);
    }

    // Fetch user's wallets
    const { error: walletsError } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', userId);

    if (walletsError) {
      console.error('Error fetching wallets:', walletsError);
    }

    // Aggregate investment data
    const completedInvestments = investments?.filter(inv => inv.status === 'completed') || [];
    const totalInvestedUSD = completedInvestments.reduce((sum, inv) => sum + inv.amount_usd, 0);

    // Calculate Bitcoin, Algorand, Solana specific investment counts and totals
    const bitcoinInvestments = completedInvestments.filter(inv => inv.target_asset === 'BTC');
    const algorandInvestments = completedInvestments.filter(inv => inv.target_asset === 'ALGO' || inv.target_asset === 'USDC');
    const solanaInvestments = completedInvestments.filter(inv => inv.target_asset === 'SOL');

    const investmentSummary = {
      bitcoin: {
        count: bitcoinInvestments.length,
        totalInvested: bitcoinInvestments.reduce((sum, inv) => sum + inv.amount_usd, 0),
        estimatedBTC: 0, // Will be updated with live balance
        currentBalance: 0, // Will be updated with live balance
      },
      solana: {
        count: solanaInvestments.length,
        totalInvested: solanaInvestments.reduce((sum, inv) => sum + inv.amount_usd, 0),
        estimatedSOL: 0, // Will be updated with live balance
        currentBalance: 0, // Will be updated with live balance
      },
      algorand: {
        count: algorandInvestments.length,
        totalInvested: algorandInvestments.reduce((sum, inv) => sum + inv.amount_usd, 0),
        currentBalance: {
          algo: 0, // Will be updated with live balance
          usdca: 0, // Will be updated with live balance
        },
      },
      summary: {
        totalInvested: totalInvestedUSD,
        positionCount: completedInvestments.length,
        hasPortfolio: !!userPortfolio,
        totalInvestedUSD,
        assetCount: new Set(completedInvestments.map(inv => inv.target_asset)).size,
      },
    };

    // Fetch live wallet balances from chains/services
    let btcBalance = 0;
    if (userWithWallet.bitcoin_address) {
      try {
        btcBalance = await getBitcoinBalance(userWithWallet.bitcoin_address);
      } catch (e) {
        console.error(`Error fetching BTC balance for ${userWithWallet.bitcoin_address}:`, e);
      }
    }

    let algoBalance = 0; // Set to 0 as algorand.ts is not found
    let usdcaBalance = 0; // Set to 0 as algorand.ts is not found
    // if (userWithWallet.algorand_address) {
    //   try {
    //     const algoBalances = await getAlgorandAccountBalance(userWithWallet.algorand_address);
    //     algoBalance = algoBalances.algo;
    //     usdcaBalance = algoBalances.usdca;
    //   } catch (e) {
    //     console.error(`Error fetching ALGO/USDCa balance for ${userWithWallet.algorand_address}:`, e);
    //   }
    // }

    let solBalance = 0;
    if (userWithWallet.solana_address) {
      try {
        solBalance = await getSolanaBalance(userWithWallet.solana_address);
      } catch (e) {
        console.error(`Error fetching SOL balance for ${userWithWallet.solana_address}:`, e);
      }
    }

    // Fetch current crypto prices
    const cryptoPrices = await fetchCryptoPrices(); // Corrected function call
    const btcPrice = cryptoPrices.bitcoin || 0;
    const algoPrice = cryptoPrices.algorand || 0;
    const solPrice = cryptoPrices.solana || 0;

    // Update estimated values with live balances and prices
    investmentSummary.bitcoin.estimatedBTC = btcBalance;
    investmentSummary.bitcoin.currentBalance = btcBalance * btcPrice;
    investmentSummary.solana.estimatedSOL = solBalance;
    investmentSummary.solana.currentBalance = solBalance * solPrice;
    investmentSummary.algorand.currentBalance.algo = algoBalance;
    investmentSummary.algorand.currentBalance.usdca = usdcaBalance;

    const totalPortfolioValue = (investmentSummary.bitcoin.currentBalance || 0) +
                                (investmentSummary.solana.currentBalance || 0) +
                                (investmentSummary.algorand.currentBalance.algo * algoPrice) +
                                (investmentSummary.algorand.currentBalance.usdca || 0);

    const responseData = {
      userId,
      balance: totalPortfolioValue,
      dailyYield: 0, // Placeholder, calculate from actual yield data
      portfolio: userPortfolio || null,
      investments: investmentSummary,
      balances: {
        btc: btcBalance,
        algo: algoBalance,
        usdca: usdcaBalance,
        sol: solBalance,
      },
      moneyTree: { // Placeholder for money tree growth
        leaves: 0,
        growthStage: 'seedling',
        nextMilestone: 10,
        level: 1,
      },
      analytics: {
        diversificationScore: 0, // Placeholder
        isMultiChain: new Set([
          ...(btcBalance > 0 ? ['BTC'] : []),
          ...(algoBalance > 0 || usdcaBalance > 0 ? ['ALGO'] : []),
          ...(solBalance > 0 ? ['SOL'] : []),
        ]).size > 1,
        supportedChains: ['Bitcoin', 'Solana', 'Algorand'],
        activeChains: [
          ...(btcBalance > 0 ? ['Bitcoin'] : []),
          ...(algoBalance > 0 || usdcaBalance > 0 ? ['Algorand'] : []),
          ...(solBalance > 0 ? ['Solana'] : []),
        ],
      },
      userProfile: { // Include basic user profile info
        userId: userWithWallet.user_id,
        name: userWithWallet.name,
        email: userWithWallet.email,
        phoneNumber: userWithWallet.phone_number,
        algorandAddress: userWithWallet.algorand_address,
        solanaAddress: userWithWallet.solana_address,
        bitcoinAddress: userWithWallet.bitcoin_address,
        firstInvestmentCompletedAt: userWithWallet.first_investment_completed_at,
        firstInvestmentCelebrationViewedAt: userWithWallet.first_investment_celebration_viewed_at,
      }
    };

    console.log(`✅ Dashboard data compiled for user ${userId}:`, {
      totalPortfolioValue: responseData.balance,
      investmentSummary: responseData.investments.summary,
      liveBalances: responseData.balances,
    });

    return res.json({
      success: true,
      data: responseData
    });

  } catch (error) {
    console.error('❌ Dashboard data error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get dashboard data',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;