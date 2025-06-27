import { supabase } from '../utils/supabase';

export interface UserPortfolio {
  id: string;
  userId: string;
  portfolioTokenId: number;
  portfolioAppId: number;
  algorandAddress: string;
  isPrimary: boolean;
  customName?: string;
  createdAt: string;
  updatedAt: string;
}

export class UserPortfolioService {
  
  /**
   * Get user's primary portfolio
   */
  async getUserPrimaryPortfolio(userId: string): Promise<UserPortfolio | null> {
    const { data, error } = await supabase
      .from('user_nft_portfolios')
      .select('*')
      .eq('user_id', userId)
      .eq('is_primary', true)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      userId: data.user_id,
      portfolioTokenId: data.portfolio_token_id,
      portfolioAppId: data.portfolio_app_id,
      algorandAddress: data.algorand_address,
      isPrimary: data.is_primary,
      customName: data.custom_name,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }

  /**
   * Get all user portfolios
   */
  async getUserPortfolios(userId: string): Promise<UserPortfolio[]> {
    const { data, error } = await supabase
      .from('user_nft_portfolios')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error || !data) {
      return [];
    }

    return data.map(d => ({
      id: d.id,
      userId: d.user_id,
      portfolioTokenId: d.portfolio_token_id,
      portfolioAppId: d.portfolio_app_id,
      algorandAddress: d.algorand_address,
      isPrimary: d.is_primary,
      customName: d.custom_name,
      createdAt: d.created_at,
      updatedAt: d.updated_at
    }));
  }

  /**
   * Store new user portfolio mapping
   */
  async storeUserPortfolio(params: {
    userId: string;
    portfolioTokenId: number;
    portfolioAppId: number;
    algorandAddress: string;
    isPrimary?: boolean;
    customName?: string;
  }): Promise<UserPortfolio> {
    const { data, error } = await supabase
      .from('user_nft_portfolios')
      .insert({
        user_id: params.userId,
        portfolio_token_id: params.portfolioTokenId,
        portfolio_app_id: params.portfolioAppId,
        algorand_address: params.algorandAddress,
        is_primary: params.isPrimary || false,
        custom_name: params.customName
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to store user portfolio: ${error?.message}`);
    }

    return {
      id: data.id,
      userId: data.user_id,
      portfolioTokenId: data.portfolio_token_id,
      portfolioAppId: data.portfolio_app_id,
      algorandAddress: data.algorand_address,
      isPrimary: data.is_primary,
      customName: data.custom_name,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }

  /**
   * Check if user has any portfolios
   */
  async userHasPortfolio(userId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('user_nft_portfolios')
      .select('id')
      .eq('user_id', userId)
      .limit(1)
      .single();

    return !error && !!data;
  }

  /**
   * Update portfolio custom name
   */
  async updatePortfolioName(portfolioId: string, userId: string, customName: string): Promise<boolean> {
    const { error } = await supabase
      .from('user_nft_portfolios')
      .update({ 
        custom_name: customName,
        updated_at: new Date().toISOString()
      })
      .eq('id', portfolioId)
      .eq('user_id', userId);

    return !error;
  }

  /**
   * Get portfolio by token ID (for lookups)
   */
  async getPortfolioByTokenId(portfolioTokenId: number): Promise<UserPortfolio | null> {
    const { data, error } = await supabase
      .from('user_nft_portfolios')
      .select('*')
      .eq('portfolio_token_id', portfolioTokenId)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      userId: data.user_id,
      portfolioTokenId: data.portfolio_token_id,
      portfolioAppId: data.portfolio_app_id,
      algorandAddress: data.algorand_address,
      isPrimary: data.is_primary,
      customName: data.custom_name,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }
}

// Export singleton instance
export const userPortfolioService = new UserPortfolioService();