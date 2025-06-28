import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helloRoutes from './app/api/hello+api';
import loginRoutes from './app/api/auth/login+api';
import signupRoutes from './app/api/auth/signup+api';
import verifyOtpRoutes from './app/api/auth/verify-otp+api';
import withdrawalInitiateRoutes from './app/api/withdrawal/initiate+api';
import withdrawalWebhookRoutes from './app/api/withdrawal/webhook+api';
import notificationsSendDailyYieldRoutes from './app/api/notifications/send-daily-yield+api';
import transactionReceiptSendRoutes from './app/api/transaction/receipt/send+api';
import userProfileRoutes from './app/api/user/profile+api';
import walletBalanceRoutes from './app/api/wallet/balance+api';
import dashboardDataRoutes from './app/api/dashboard/data+api';
import depositInitiateRoutes from './app/api/deposit/initiate+api';
import depositStatusRoutes from './app/api/deposit/status+api';
import depositCalculateFeesRoutes from './app/api/deposit/calculate-fees+api';
import depositWebhookRoutes from './app/api/deposit/webhook+api';
import educationContentRoutes from './app/api/education/content+api';
import educationQuizSubmitRoutes from './app/api/education/quiz/submit+api';
import aiRoundupSuggestionRoutes from './app/api/ai/roundup-suggestion+api';
import debugTwilioStatusRoutes from './app/api/debug/twilio-status+api';
import debugAlgorandStatusRoutes from './app/api/debug/algorand-status+api';
import debugBitcoinStatusRoutes from './app/api/debug/bitcoin-status+api';
import debugSolanaStatusRoutes from './app/api/debug/solana-status+api';
import walletCreateRoutes from './app/api/wallet/create+api';
import walletMnemonicRoutes from './app/api/wallet/mnemonic+api';
import moonpaySignUrlRoutes from './app/api/moonpay/sign-url+api';
import moonpayWebhookRoutes from './app/api/moonpay/webhook+api';
import pricesRoutes from './app/api/prices+api';
import smartContractRoutes from './app/api/smart-contract+api';
import testSmartContractRoutes from './app/api/test-smart-contract+api';
import debugCreateTestUserRoutes from './app/api/debug/create-test-user+api';
import optInUsdcaRoutes from './app/api/debug/opt-in-usdca+api';
import fundTestnetRoutes from './app/api/debug/fund-testnet+api';
import nftRoutes from './app/api/nft+api';
import userPortfolioRoutes from './app/api/users/portfolio+api';
import userInvestmentRoutes from './app/api/users/invest+api';

dotenv.config(); // Load environment variables from .env file

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Enable CORS for all origins (adjust in production)
app.use(express.json()); // Enable JSON body parsing

// Custom request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const method = req.method;
  const url = req.url;
  const userAgent = req.get('User-Agent') || 'Unknown';
  
  console.log(`🌐 [${timestamp}] ${method} ${url} - ${userAgent}`);
  
  // Log response time
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const statusCode = res.statusCode;
    const statusEmoji = statusCode >= 400 ? '❌' : statusCode >= 300 ? '⚠️' : '✅';
    console.log(`${statusEmoji} [${timestamp}] ${method} ${url} - ${statusCode} (${duration}ms)`);
  });
  
  next();
});

// Initialize Supabase client
// const supabaseUrl = process.env.SUPABASE_URL;
// const supabaseKey = process.env.SUPABASE_ANON_KEY;

// Ensure Supabase URL and Key are provided
// if (!supabaseUrl || !supabaseKey) {
//   console.error('SUPABASE_URL and SUPABASE_ANON_KEY must be provided in the .env file.');
//   process.exit(1);
// }

// const supabase = createClient(supabaseUrl, supabaseKey);

// Basic route for health check
app.get('/', (_req, res) => {
  res.status(200).json({ message: 'Cultivest Backend API is running (TypeScript)!' });
});

// Add a test route for the API
app.get('/api/v1/test', (_req, res) => {
  res.status(200).json({ message: 'Cultivest Backend API Test is running (TypeScript)!' });
});

// Create a central API router
const apiRouter = express.Router();

// Add all API routes to the router
apiRouter.use('/hello', helloRoutes);
apiRouter.use('/auth/login', loginRoutes);
apiRouter.use('/auth/signup', signupRoutes);
apiRouter.use('/auth/verify-otp', verifyOtpRoutes);
apiRouter.use('/withdrawal/initiate', withdrawalInitiateRoutes);
apiRouter.use('/withdrawal/webhook', withdrawalWebhookRoutes);
apiRouter.use('/notifications/send-daily-yield', notificationsSendDailyYieldRoutes);
apiRouter.use('/transaction/receipt/send', transactionReceiptSendRoutes);
apiRouter.use('/user/profile', userProfileRoutes);
apiRouter.use('/wallet/balance', walletBalanceRoutes);
apiRouter.use('/wallet/mnemonic', walletMnemonicRoutes);
apiRouter.use('/dashboard/data', dashboardDataRoutes);
apiRouter.use('/deposit/initiate', depositInitiateRoutes);
apiRouter.use('/deposit/status', depositStatusRoutes);
apiRouter.use('/deposit/calculate-fees', depositCalculateFeesRoutes);
apiRouter.use('/deposit/webhook', depositWebhookRoutes);
apiRouter.use('/education/content', educationContentRoutes);
apiRouter.use('/education/quiz/submit', educationQuizSubmitRoutes);
apiRouter.use('/ai/roundup-suggestion', aiRoundupSuggestionRoutes);
apiRouter.use('/debug/twilio-status', debugTwilioStatusRoutes);
apiRouter.use('/debug/algorand-status', debugAlgorandStatusRoutes);
apiRouter.use('/debug/bitcoin-status', debugBitcoinStatusRoutes);
apiRouter.use('/debug/solana-status', debugSolanaStatusRoutes);
apiRouter.use('/debug/create-test-user', debugCreateTestUserRoutes);
apiRouter.use('/debug/opt-in-usdca', optInUsdcaRoutes);
apiRouter.use('/debug/fund-testnet', fundTestnetRoutes);
apiRouter.use('/wallet/create', walletCreateRoutes);
apiRouter.use('/moonpay/sign-url', moonpaySignUrlRoutes);
apiRouter.use('/moonpay/webhook', moonpayWebhookRoutes);

// Cryptocurrency Prices API
apiRouter.use('/prices', pricesRoutes);

// Smart Contract APIs
apiRouter.use('/smart-contract', smartContractRoutes);
apiRouter.use('/test-smart-contract', testSmartContractRoutes);

// NFT APIs (Position and Portfolio NFTs)
apiRouter.use('/nft', nftRoutes);

// User Portfolio APIs (User-centric portfolio management)
apiRouter.use('/users', userPortfolioRoutes);

// User Investment APIs (User-centric investment management)
apiRouter.use('/users', userInvestmentRoutes);

app.use('/api/v1', apiRouter);

// Only start the server if not running on Vercel (for local development)
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Cultivest Backend listening on port ${PORT}`);
    console.log(`Access it at http://localhost:${PORT}`);
  });
}

// Export app for testing or Vercel serverless function wrapper
export default app; 