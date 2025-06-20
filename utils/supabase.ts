import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing required Supabase environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
}

// Create Supabase client with service role for backend operations
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  db: {
    schema: 'public'
  }
});

// Database response types
export interface DatabaseError {
  code: string;
  message: string;
  details?: string;
  hint?: string;
}

export interface DatabaseUser {
  user_id: string;
  phone_number: string;
  name: string;
  country: string;
  email?: string;
  current_balance_usdca: number;
  daily_yield_accumulated: number;
  money_tree_leaves: number;
  kyc_status: 'pending' | 'approved' | 'rejected';
  supabase_auth_id?: string;
  created_at: string;
  updated_at: string;
}

export interface DatabaseOTPSession {
  session_id: string;
  phone_number: string;
  otp_code: string;
  expires_at: string;
  attempts: number;
  verified: boolean;
  user_id?: string;
  created_at: string;
}

export interface DatabaseWallet {
  wallet_id: string;
  user_id: string;
  algorand_address: string;
  encrypted_private_key: string;
  asset_id: number;
  balance_usdca: number;
  balance_algo: number;
  created_at: string;
  updated_at: string;
}

// Test database connectivity
export const testDatabaseConnection = async (): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('users')
      .select('user_id')
      .limit(1);
    
    return !error;
  } catch (error) {
    console.error('Database connection test failed:', error);
    return false;
  }
};

// Utility function for handling database errors
export const handleDatabaseError = (error: any): { error: string; code?: string } => {
  if (error?.code && error?.message) {
    // Supabase/PostgreSQL error
    return {
      error: error.message,
      code: error.code
    };
  }
  
  // Generic error
  return {
    error: error?.message || 'Database operation failed'
  };
};