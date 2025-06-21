import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import algosdk from 'algosdk';
import helloRoutes from './app/api/hello+api';
import loginRoutes from './app/api/auth/login+api';
import signupRoutes from './app/api/auth/signup+api';
import verifyOtpRoutes from './app/api/auth/verify-otp+api';
import withdrawalInitiateRoutes from './app/api/withdrawal/initiate+api';
import withdrawalWebhookRoutes from './app/api/withdrawal/webhook+api';
import investmentInitiateRoutes from './app/api/investment/initiate+api';
import investmentPositionsRoutes from './app/api/investment/positions+api';
import notificationsSendDailyYieldRoutes from './app/api/notifications/send-daily-yield+api';
import transactionReceiptSendRoutes from './app/api/transaction/receipt/send+api';
import userKycRoutes from './app/api/user/kyc+api';
import userProfileRoutes from './app/api/user/profile+api';
import walletBalanceRoutes from './app/api/wallet/balance+api';
import dashboardDataRoutes from './app/api/dashboard/data+api';
import depositInitiateRoutes from './app/api/deposit/initiate+api';
import depositWebhookRoutes from './app/api/deposit/webhook+api';
import educationContentRoutes from './app/api/education/content+api';
import educationQuizSubmitRoutes from './app/api/education/quiz/submit+api';
import aiRoundupSuggestionRoutes from './app/api/ai/roundup-suggestion+api';
import debugTwilioStatusRoutes from './app/api/debug/twilio-status+api';
import debugAlgorandStatusRoutes from './app/api/debug/algorand-status+api';
import debugWalletRawRoutes from './app/api/debug/wallet-raw+api';
import walletCreateRoutes from './app/api/wallet/create+api';

dotenv.config(); // Load environment variables from .env file

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Enable CORS for all origins (adjust in production)
app.use(express.json()); // Enable JSON body parsing

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
app.get('/', (req, res) => {
  res.status(200).json({ message: 'Cultivest Backend API is running (TypeScript)!' });
});

// Add a test route for the API
app.get('/api/v1/test', (req, res) => {
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
apiRouter.use('/investment/initiate', investmentInitiateRoutes);
apiRouter.use('/investment/positions', investmentPositionsRoutes);
apiRouter.use('/notifications/send-daily-yield', notificationsSendDailyYieldRoutes);
apiRouter.use('/transaction/receipt/send', transactionReceiptSendRoutes);
apiRouter.use('/user/kyc', userKycRoutes);
apiRouter.use('/user/profile', userProfileRoutes);
apiRouter.use('/wallet/balance', walletBalanceRoutes);
apiRouter.use('/dashboard/data', dashboardDataRoutes);
apiRouter.use('/deposit/initiate', depositInitiateRoutes);
apiRouter.use('/deposit/webhook', depositWebhookRoutes);
apiRouter.use('/education/content', educationContentRoutes);
apiRouter.use('/education/quiz/submit', educationQuizSubmitRoutes);
apiRouter.use('/ai/roundup-suggestion', aiRoundupSuggestionRoutes);
apiRouter.use('/debug/twilio-status', debugTwilioStatusRoutes);
apiRouter.use('/debug/algorand-status', debugAlgorandStatusRoutes);
apiRouter.use('/debug/wallet-raw', debugWalletRawRoutes);
apiRouter.use('/wallet/create', walletCreateRoutes);

app.use('/api/v1', apiRouter);

// Start the server
app.listen(PORT, () => {
  console.log(`Cultivest Backend listening on port ${PORT}`);
  console.log(`Access it at http://localhost:${PORT}`);
});

// Export app for testing or Vercel serverless function wrapper
export default app; 