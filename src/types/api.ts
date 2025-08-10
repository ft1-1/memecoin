/**
 * Type definitions for Solana Tracker API and external data
 */

export interface TokenData {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  supply: number;
  marketCap: number;
  price: number;
  priceChange24h: number;
  volume24h: number;
  holders: number;
  createdAt: string;
  image?: string;
  tags?: string[];
  website?: string;
  twitter?: string;
  telegram?: string;
  riskLevel?: 'low' | 'medium' | 'high';
  riskScore?: number;
}

export interface TrendingTokensResponse {
  tokens: TokenData[];
  total: number;
  page: number;
  limit: number;
  timeframe: string;
}

export interface ChartDataPoint {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ChartDataResponse {
  address: string;
  interval: string;
  data: ChartDataPoint[];
}

export interface TokenDetailsResponse extends TokenData {
  liquidityPools: Array<{
    dex: string;
    liquidity: number;
    volume24h: number;
  }>;
  holderDistribution: {
    top10Percentage: number;
    top50Percentage: number;
    walletCount: number;
  };
  social: {
    twitterFollowers?: number;
    telegramMembers?: number;
    discordMembers?: number;
  };
  riskAnalysis: {
    score: number;
    factors: Array<{
      type: string;
      severity: 'low' | 'medium' | 'high';
      description: string;
    }>;
  };
}

export interface PriceMultiRequest {
  addresses: string[];
}

export interface PriceMultiResponse {
  prices: Record<string, {
    price: number;
    priceChange24h: number;
    volume24h: number;
    marketCap: number;
  }>;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: {
    code: string;
    message: string;
  };
  rateLimit?: {
    remaining: number;
    reset: number;
  };
}

export interface ApiError {
  code: string;
  message: string;
  status: number;
  retryable: boolean;
  rateLimited?: boolean;
  retryAfter?: number;
}

export interface RequestOptions {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  useCache?: boolean;
  cacheTimeout?: number;
}

export interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half-open';
  failureCount: number;
  successCount: number;
  nextAttempt: number;
  lastError?: ApiError;
}