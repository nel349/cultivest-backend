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

// TODO: Import and use API routes from app/api directory
// Example: import authRoutes from './app/api/auth';
// app.use('/auth', authRoutes);

app.use('/hello', helloRoutes);
app.use('/auth/login', loginRoutes);
app.use('/auth/signup', signupRoutes);
app.use('/auth/verify-otp', verifyOtpRoutes);
app.use('/withdrawal/initiate', withdrawalInitiateRoutes);
app.use('/withdrawal/webhook', withdrawalWebhookRoutes);
app.use('/investment/initiate', investmentInitiateRoutes);
app.use('/investment/positions', investmentPositionsRoutes);
app.use('/notifications/send-daily-yield', notificationsSendDailyYieldRoutes);
app.use('/transaction/receipt/send', transactionReceiptSendRoutes);
app.use('/user/kyc', userKycRoutes);
app.use('/user/profile', userProfileRoutes);
app.use('/wallet/balance', walletBalanceRoutes);
app.use('/dashboard/data', dashboardDataRoutes);
app.use('/deposit/initiate', depositInitiateRoutes);
app.use('/deposit/webhook', depositWebhookRoutes);
app.use('/education/content', educationContentRoutes);
app.use('/education/quiz/submit', educationQuizSubmitRoutes);
app.use('/ai/roundup-suggestion', aiRoundupSuggestionRoutes);

// Start the server
app.listen(PORT, () => {
  console.log(`Cultivest Backend listening on port ${PORT}`);
  console.log(`Access it at http://localhost:${PORT}`);
});

// Export app for testing or Vercel serverless function wrapper
export default app; 