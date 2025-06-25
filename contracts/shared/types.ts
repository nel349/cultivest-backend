/**
 * Shared types for Cultivest Portfolio NFT system
 */

export interface PortfolioData {
  totalValueUSD: number;
  btcHoldings: number;
  algoHoldings: number;
  usdcHoldings: number;
  level: number;
  unrealizedPnL: number;
  lastUpdate: number;
}

export interface PositionData {
  assetType: string;
  blockchain: string;
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  currentValueUSD: number;
  unrealizedPnL: number;
}

export interface CultivestContractConfig {
  network: 'testnet' | 'mainnet';
  portfolioContractTemplate: number;
  positionContractTemplate: number;
  authorizedUpdater: string;
}
