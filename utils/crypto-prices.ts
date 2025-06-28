/**
 * Cryptocurrency Price Fetching Utility
 * Uses CoinGecko's free API (no API key required)
 * Rate limit: 10-50 calls per minute
 */

interface CryptoPrices {
  bitcoin: number;
  algorand: number;
  'usd-coin': number;
  ethereum: number;
  solana: number;
}

interface PriceCache {
  prices: CryptoPrices | null;
  lastUpdated: number;
  cacheValidFor: number; // milliseconds
}

// Cache prices for 2 minutes to avoid hitting rate limits
const priceCache: PriceCache = {
  prices: null,
  lastUpdated: 0,
  cacheValidFor: 2 * 60 * 1000 // 2 minutes
};

/**
 * Fetch live cryptocurrency prices from CoinGecko
 */
export const fetchCryptoPrices = async (): Promise<CryptoPrices> => {
  try {
    // Check cache first
    const now = Date.now();
    if (priceCache.prices && (now - priceCache.lastUpdated) < priceCache.cacheValidFor) {
      console.log('💰 Using cached crypto prices');
      return priceCache.prices;
    }

    console.log('📡 Fetching live crypto prices from CoinGecko...');

    // CoinGecko free API endpoint - now includes Solana
    const url = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,algorand,usd-coin,ethereum,solana&vs_currencies=usd';
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Cultivest-App/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as any;

    const prices: CryptoPrices = {
      bitcoin: data.bitcoin?.usd || 97000,      // Fallback to current estimate
      algorand: data.algorand?.usd || 0.40,    // Fallback to current estimate  
      'usd-coin': data['usd-coin']?.usd || 1.0, // USDC should always be ~$1
      ethereum: data.ethereum?.usd || 3500,    // Fallback to current estimate
      solana: data.solana?.usd || 95           // Fallback to current estimate
    };

    // Update cache
    priceCache.prices = prices;
    priceCache.lastUpdated = now;

    console.log('💰 Live crypto prices fetched:', {
      BTC: `$${prices.bitcoin.toLocaleString()}`,
      ALGO: `$${prices.algorand.toFixed(4)}`,
      USDC: `$${prices['usd-coin'].toFixed(4)}`,
      ETH: `$${prices.ethereum.toLocaleString()}`,
      SOL: `$${prices.solana.toFixed(2)}`
    });

    return prices;

  } catch (error) {
    console.error('❌ Error fetching crypto prices:', error);
    
    // Return cached prices if available, otherwise fallback prices
    if (priceCache.prices) {
      console.log('⚠️ Using cached prices due to API error');
      return priceCache.prices;
    }

    console.log('⚠️ Using fallback prices due to API error');
    return {
      bitcoin: 97000,    // Conservative estimate
      algorand: 0.40,    // Conservative estimate
      'usd-coin': 1.0,   // USDC stable
      ethereum: 3500,    // Conservative estimate
      solana: 95         // Conservative estimate
    };
  }
};

/**
 * Get a specific cryptocurrency price
 */
export const getCryptoPrice = async (coinId: keyof CryptoPrices): Promise<number> => {
  const prices = await fetchCryptoPrices();
  return prices[coinId];
};

/**
 * Get Bitcoin price specifically (most commonly used)
 */
export const getBitcoinPrice = async (): Promise<number> => {
  return getCryptoPrice('bitcoin');
};

/**
 * Get Algorand price specifically
 */
export const getAlgorandPrice = async (): Promise<number> => {
  return getCryptoPrice('algorand');
};

/**
 * Get Solana price specifically
 */
export const getSolanaPrice = async (): Promise<number> => {
  return getCryptoPrice('solana');
};

/**
 * Clear the price cache (useful for testing or forcing refresh)
 */
export const clearPriceCache = (): void => {
  priceCache.prices = null;
  priceCache.lastUpdated = 0;
  console.log('🗑️ Price cache cleared');
};

/**
 * Get cache status
 */
export const getPriceCacheStatus = () => {
  const now = Date.now();
  const isValid = priceCache.prices && (now - priceCache.lastUpdated) < priceCache.cacheValidFor;
  const cacheAge = priceCache.lastUpdated ? now - priceCache.lastUpdated : 0;
  
  return {
    hasCachedPrices: !!priceCache.prices,
    cacheValid: isValid,
    cacheAgeSeconds: Math.floor(cacheAge / 1000),
    lastUpdated: priceCache.lastUpdated ? new Date(priceCache.lastUpdated).toISOString() : null
  };
};