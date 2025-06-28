import crypto from 'crypto';

interface MoonPayConfig {
  apiKey: string;
  secretKey: string;
  baseUrl: string;
  apiUrl: string;
}

interface MoonPayWidgetParams {
  walletAddress: string;
  currencyCode: string;
  baseCurrencyAmount: number;
  redirectURL?: string;
  externalTransactionId?: string;
}

export class MoonPayService {
  private config: MoonPayConfig;

  constructor() {
    this.config = {
      apiKey: process.env.MOONPAY_API_KEY || '',
      secretKey: process.env.MOONPAY_SECRET_KEY || '',
      baseUrl: process.env.MOONPAY_BASE_URL || 'https://buy-sandbox.moonpay.com',
      apiUrl: process.env.MOONPAY_API_URL || 'https://api.moonpay.com'
    };

    // Debug: Log configuration (safely)
    console.log('🌙 MoonPay Service Configuration:');
    console.log('- API Key present:', !!this.config.apiKey);
    console.log('- API Key starts with:', this.config.apiKey.substring(0, 8) + '...');
    console.log('- Secret Key present:', !!this.config.secretKey);
    console.log('- Secret Key starts with:', this.config.secretKey.substring(0, 8) + '...');
    console.log('- Base URL:', this.config.baseUrl);
    console.log('- API URL:', this.config.apiUrl);
  }

  /**
   * Generate a signed MoonPay widget URL for purchasing ALGO
   */
  generateWidgetUrl(params: MoonPayWidgetParams): string {
    const baseParams = {
      apiKey: this.config.apiKey,
      walletAddress: params.walletAddress,
      currencyCode: params.currencyCode,
      baseCurrencyAmount: params.baseCurrencyAmount.toString(),
      redirectURL: params.redirectURL,
      externalTransactionId: params.externalTransactionId,
      theme: 'dark',
      colorCode: '#10B981' // Cultivest brand green
    };

    // Remove undefined values and ensure proper typing
    const filteredParams: Record<string, string> = {};
    Object.entries(baseParams).forEach(([key, value]) => {
      if (value !== undefined) {
        filteredParams[key] = value;
      }
    });

    // Create query string
    const queryString = new URLSearchParams(filteredParams).toString();
    
    // Create signature if secret key is available
    if (this.config.secretKey) {
      const signature = this.createSignature(queryString);
      return `${this.config.baseUrl}?${queryString}&signature=${signature}`;
    }

    return `${this.config.baseUrl}?${queryString}`;
  }

  /**
   * Create HMAC signature for MoonPay widget URL
   */
  createSignature(queryString: string): string {
    return crypto
      .createHmac('sha256', this.config.secretKey)
      .update(queryString)
      .digest('base64');
  }

    /**
   * Verify webhook signature from MoonPay (V2 format)
   * Based on: https://dev.moonpay.com/reference/reference-webhooks-signature
   */
  verifyWebhookSignature(payload: string, signatureHeader: string): boolean {
    if (!process.env.MOONPAY_WEBHOOK_SECRET) {
      console.warn('MOONPAY_WEBHOOK_SECRET not configured, skipping signature verification');
      return true; // Allow in development/sandbox
    }

    if (!signatureHeader) {
      console.warn('No signature header provided');
      return false;
    }

    try {
      // Parse the signature header: t=timestamp,s=signature
      const elements = signatureHeader.split(',');
      let timestamp = '';
      let signature = '';

      for (const element of elements) {
        const [prefix, value] = element.split('=');
        if (prefix === 't') {
          timestamp = value;
        } else if (prefix === 's') {
          signature = value;
        }
      }

      if (!timestamp || !signature) {
        console.warn('Invalid signature header format');
        return false;
      }

      // Create the signed payload: timestamp + "." + JSON_payload
      const signedPayload = `${timestamp}.${payload}`;

      // Compute expected signature using HMAC-SHA256
      const expectedSignature = crypto
        .createHmac('sha256', process.env.MOONPAY_WEBHOOK_SECRET)
        .update(signedPayload)
        .digest('hex');

      // Compare signatures
      return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );
    } catch (error) {
      console.error('Signature verification error:', error);
      return false;
    }
  }

  /**
   * Calculate estimated Bitcoin amount after fees
   */
  async calculateEstimatedBitcoin(amountUSD: number): Promise<{
    estimatedBTC: number;
    moonpayFee: number;
    networkFee: number;
    totalFees: number;
  }> {
    // MoonPay fee: ~3.5% for card payments
    const moonpayFee = amountUSD * 0.035;
    
    // Bitcoin network fee: ~$2-5 (flat fee)
    const networkFee = Math.min(5, amountUSD * 0.01); // Dynamic based on amount
    
    const totalFees = moonpayFee + networkFee;
    const netAmount = amountUSD - totalFees;
    
    // Get current Bitcoin price
    const currentBTCPrice = await this.getBitcoinPrice();
    const estimatedBTC = netAmount / currentBTCPrice;

    return {
      estimatedBTC: Math.max(0, estimatedBTC),
      moonpayFee,
      networkFee,
      totalFees
    };
  }

  /**
   * Calculate estimated USDCa amount after fees (legacy support)
   */
  calculateEstimatedUSDCa(amountUSD: number): {
    estimatedUSDCa: number;
    moonpayFee: number;
    conversionFee: number;
    totalFees: number;
  } {
    // MoonPay fee: ~3.5% for card payments
    const moonpayFee = amountUSD * 0.035;
    
    // DEX conversion fee: ~0.3%
    const conversionFee = (amountUSD - moonpayFee) * 0.003;
    
    const totalFees = moonpayFee + conversionFee;
    const estimatedUSDCa = amountUSD - totalFees;

    return {
      estimatedUSDCa: Math.max(0, estimatedUSDCa),
      moonpayFee,
      conversionFee,
      totalFees
    };
  }

  /**
   * Get current Bitcoin price from MoonPay API
   */
  async getBitcoinPrice(): Promise<number> {
    try {
      const response = await fetch(`${this.config.apiUrl}/v3/currencies/btc/price?apiKey=${this.config.apiKey}`);
      const data = await response.json() as { price: number };
      return data.price || 45000; // Fallback price
    } catch (error) {
      console.error('Failed to fetch Bitcoin price:', error);
      return 45000; // Fallback price
    }
  }

  /**
   * Get current ALGO price from MoonPay API (legacy support)
   */
  async getAlgoPrice(): Promise<number> {
    try {
      const response = await fetch(`${this.config.apiUrl}/v3/currencies/algo/price?apiKey=${this.config.apiKey}`);
      const data = await response.json() as { price: number };
      return data.price || 0.25; // Fallback price
    } catch (error) {
      console.error('Failed to fetch ALGO price:', error);
      return 0.25; // Fallback price
    }
  }
}

export const moonPayService = new MoonPayService();