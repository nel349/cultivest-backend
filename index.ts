import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import algosdk from 'algosdk';

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

// Start the server
app.listen(PORT, () => {
  console.log(`Cultivest Backend listening on port ${PORT}`);
  console.log(`Access it at http://localhost:${PORT}`);
});

// Export app for testing or Vercel serverless function wrapper
export default app; 