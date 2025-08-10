/**
 * Comprehensive TypeScript interfaces for Solana Tracker API
 * Based on official API documentation and production requirements
 */

// ============================================================================
// Core API Types
// ============================================================================

export interface SolanaTrackerConfig {
  baseUrl: string;
  apiKey: string;
  timeout: number;
  rateLimitRps: number;
  requestDelayMs: number;  // Delay between requests to respect rate limits
  maxRetries: number;
  retryDelayMs: number;
  circuitBreaker: {
    failureThreshold: number;
    successThreshold: number;
    timeout: number;
  };
  cache: {
    tokenTtl: number;      // Token metadata cache TTL (1 hour)
    priceTtl: number;      // Price data cache TTL (30 seconds)
    chartTtl: number;      // Chart data cache TTL (5 minutes)
  };
}

// ============================================================================
// Request/Response Wrappers
// ============================================================================

export interface SolanaTrackerResponse<T> {
  success: boolean;
  data: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    requestId: string;
    timestamp: number;
    rateLimit: {
      remaining: number;
      reset: number;
      limit: number;
    };
  };
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// ============================================================================
// Raw API Response Types (matching actual Solana Tracker API structure)
// ============================================================================

/**
 * Raw token metadata from API (nested under "token" key)
 */
export interface SolanaTrackerTokenMetadata {
  name: string;
  symbol: string;
  mint: string;
  uri?: string;
  decimals: number;
  description?: string;
  image?: string;
  hasFileMetaData?: boolean;
  strictSocials?: Record<string, any>;
  creation?: {
    creator: string;
    created_tx: string;
    created_time: number;
  };
}

/**
 * Pool information from API
 */
export interface SolanaTrackerPool {
  poolId: string;
  liquidity: {
    quote: number;
    usd: number;
  };
  price: {
    quote: number;
    usd: number;
  };
  tokenSupply: number;
  lpBurn: number;
  tokenAddress: string;
  marketCap: {
    quote: number;
    usd: number;
  };
  market: string;
  quoteToken: string;
  decimals: number;
  security?: {
    freezeAuthority?: string | null;
    mintAuthority?: string | null;
  };
  lastUpdated: number;
  deployer?: string;
  txns: {
    buys: number;
    total: number;
    volume: number;
    volume24h: number;
    sells: number;
  };
}

/**
 * Events/price changes from API
 */
export interface SolanaTrackerEvents {
  '1m'?: { priceChangePercentage: number };
  '5m'?: { priceChangePercentage: number };
  '15m'?: { priceChangePercentage: number };
  '30m'?: { priceChangePercentage: number };
  '1h'?: { priceChangePercentage: number };
  '2h'?: { priceChangePercentage: number };
  '3h'?: { priceChangePercentage: number };
  '4h'?: { priceChangePercentage: number };
  '5h'?: { priceChangePercentage: number };
  '6h'?: { priceChangePercentage: number };
  '12h'?: { priceChangePercentage: number };
  '24h'?: { priceChangePercentage: number };
}

/**
 * Risk analysis from API
 */
export interface SolanaTrackerRisk {
  snipers?: {
    count: number;
    totalBalance: number;
    totalPercentage: number;
    wallets: any[];
  };
  insiders?: {
    count: number;
    totalBalance: number;
    totalPercentage: number;
    wallets: any[];
  };
  top10?: number;
  rugged: boolean;
  risks: string[];
  score: number;
  jupiterVerified?: boolean;
}

/**
 * Complete token response from /tokens/{address} endpoint
 */
export interface SolanaTrackerTokenResponse {
  token: SolanaTrackerTokenMetadata;
  pools: SolanaTrackerPool[];
  events?: SolanaTrackerEvents;
  risk?: SolanaTrackerRisk;
  buys?: number;
  sells?: number;
  txns?: number;
  holders?: number;
}

/**
 * Processed/normalized token interface for application use
 */
export interface SolanaToken {
  // Basic Info
  address: string;        // From mint field
  symbol: string;
  name: string;
  decimals: number;
  image?: string;
  description?: string;
  
  // Market Data (extracted from pools[0])
  price: number;          // From pools[0].price.usd
  marketCap: number;      // From pools[0].marketCap.usd
  volume24h?: number;     // From pools[0].txns.volume24h
  
  // Price Changes (from events)
  priceChange1h?: number;   // From events['1h'].priceChangePercentage
  priceChange24h?: number;  // From events['24h'].priceChangePercentage
  
  // Supply Info
  totalSupply?: number;     // From pools[0].tokenSupply
  
  // Risk Assessment
  riskScore?: number;       // From risk.score
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  rugged?: boolean;         // From risk.rugged
  
  // Trading Activity
  buys?: number;
  sells?: number;
  holders?: number;
  
  // Metadata
  createdAt?: string;
  verified?: boolean;       // From risk.jupiterVerified
  
  // Raw data access
  _raw?: SolanaTrackerTokenResponse;
}

export interface TrendingTokensRequest {
  timeframe: '5m' | '15m' | '30m' | '1h' | '2h' | '3h' | '4h' | '5h' | '6h' | '12h' | '24h';
  limit?: number;
  offset?: number;
  minMarketCap?: number;
  maxMarketCap?: number;
  minVolume?: number;
  tags?: string[];
}

/**
 * Response from /tokens/trending/{timeframe} endpoint
 * Note: API returns array directly, not wrapped object
 */
export type TrendingTokensResponse = SolanaTrackerTokenResponse[];

/**
 * Processed trending tokens response
 */
export interface ProcessedTrendingTokensResponse {
  tokens: SolanaToken[];
  timeframe: string;
  total: number;
  generatedAt: string;
}

// ============================================================================
// Token Details Types
// ============================================================================

/**
 * Extended token details (alias for SolanaTrackerTokenResponse with processing)
 */
export interface TokenDetails {
  // Processed token data
  token: SolanaToken;
  
  // Raw API response data
  pools: SolanaTrackerPool[];
  events?: SolanaTrackerEvents;
  risk?: SolanaTrackerRisk;
  
  // Additional computed fields
  totalLiquidity?: number;
  
  // Holder Analysis
  holderDistribution: {
    top10Percentage: number;
    top50Percentage: number;
    top100Percentage: number;
    walletCount: number;
    averageHolding: number;
  };
  
  // Social Metrics
  social: {
    twitterFollowers?: number;
    telegramMembers?: number;
    discordMembers?: number;
    redditSubscribers?: number;
  };
  
  // Risk Analysis
  riskAnalysis: TokenRiskAnalysis;
  
  // Trading Activity
  trades24h: number;
  uniqueTraders24h: number;
  
  // Program Information
  mintAuthority?: string;
  freezeAuthority?: string;
  updateAuthority?: string;
  
  // Token Extensions
  extensions?: TokenExtension[];
}

export interface LiquidityPool {
  dex: string;
  poolAddress: string;
  baseToken: string;
  quoteToken: string;
  liquidity: number;
  liquidityUsd: number;
  volume24h: number;
  volume24hUsd: number;
  apy?: number;
  fee: number;
  createdAt: string;
}

export interface TokenRiskAnalysis {
  overall: {
    score: number;          // 0-100 (0 = highest risk, 100 = lowest risk)
    level: 'low' | 'medium' | 'high' | 'critical';
    summary: string;
  };
  factors: RiskFactor[];
  warnings: string[];
  recommendations: string[];
  lastUpdated: string;
}

export interface RiskFactor {
  category: 'liquidity' | 'holders' | 'contract' | 'social' | 'market' | 'technical';
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  score: number;
  description: string;
  impact: string;
  recommendation?: string;
}

export interface TokenExtension {
  type: string;
  data: any;
}

// ============================================================================
// Chart Data Types (matching actual API structure)
// ============================================================================

export interface ChartDataRequest {
  token: string;
  interval?: '1s' | '5s' | '15s' | '30s' | '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d' | '1w' | '1mn';
  from?: number;          // Unix timestamp (time_from)
  to?: number;            // Unix timestamp (time_to)
  limit?: number;         // Max 5000
  marketCap?: boolean;    // Return market cap chart instead of price
  removeOutliers?: boolean; // Default: true
}

/**
 * Raw OHLCV data point from API (note: it's "oclhv" not "ohlcv" in API)
 */
export interface SolanaTrackerOCLHV {
  open: number;
  close: number;
  low: number;
  high: number;
  volume: number;
  time: number;           // Unix timestamp
}

/**
 * Raw chart response from /chart/{token} endpoint
 */
export interface SolanaTrackerChartResponse {
  oclhv: SolanaTrackerOCLHV[];
}

/**
 * Normalized OHLCV interface for application use
 */
export interface OHLCV {
  timestamp: number;      // Unix timestamp (from 'time' field)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  volumeUsd?: number;
  trades?: number;
}

/**
 * Processed chart data response
 */
export interface ChartDataResponse {
  token: string;
  interval: string;
  data: OHLCV[];
  from: number;
  to: number;
  count: number;
  _raw?: SolanaTrackerChartResponse;
}

// ============================================================================
// Multi-Timeframe Chart Data Types
// ============================================================================

/**
 * Multi-timeframe chart data request
 */
export interface MultiTimeframeChartRequest {
  token: string;
  timeframes: ('5m' | '15m' | '1h' | '4h')[];
  enableCaching?: boolean;
  maxRetries?: number;
}

/**
 * Multi-timeframe chart data response
 */
export interface MultiTimeframeChartResponse {
  token: string;
  timeframes: {
    '5m'?: ChartDataResponse;
    '15m'?: ChartDataResponse;
    '1h'?: ChartDataResponse;
    '4h'?: ChartDataResponse;
  };
  aggregationResults?: {
    '5m'?: import('./utils/ChartDataAggregator').AggregationResult;
    '15m'?: import('./utils/ChartDataAggregator').AggregationResult;
    '1h'?: import('./utils/ChartDataAggregator').AggregationResult;
    '4h'?: import('./utils/ChartDataAggregator').AggregationResult;
  };
  sourceDataUsed: {
    dataPoints: number;
    timeRange: {
      from: number;
      to: number;
    };
    fetchTime: number;
  };
  generatedAt: string;
  errors?: string[];
  warnings?: string[];
}

/**
 * Timeframe-specific cache configuration
 */
export interface TimeframeCacheConfig {
  '5m': number;    // 2 minutes TTL (short for frequent updates)
  '15m': number;   // 5 minutes TTL
  '1h': number;    // 10 minutes TTL
  '4h': number;    // 30 minutes TTL (longer for less volatile data)
}

/**
 * Chart data fetch strategy configuration
 */
export interface ChartFetchStrategy {
  primarySource: 'api' | 'aggregation';
  fallbackEnabled: boolean;
  staggerDelayMs: number;    // Delay between timeframe requests
  maxConcurrentRequests: number;
  cacheFirst: boolean;       // Check cache before making API calls
}

// ============================================================================
// Price Data Types
// ============================================================================

export interface PriceMultiRequest {
  addresses: string[];    // Max 100 addresses
  currencies?: string[];  // Default: ['usd']
  includeMarketCap?: boolean;
  includeVolume?: boolean;
  include24hChange?: boolean;
}

export interface TokenPrice {
  address: string;
  price: number;
  priceUsd: number;
  priceChange1h?: number;
  priceChange24h?: number;
  priceChange7d?: number;
  volume24h?: number;
  volume24hUsd?: number;
  marketCap?: number;
  marketCapUsd?: number;
  lastUpdated: string;
}

export interface PriceMultiResponse {
  prices: Record<string, TokenPrice>;
  currencies: string[];
  timestamp: string;
}

// ============================================================================
// Search Types
// ============================================================================

export interface SearchRequest {
  query: string;
  limit?: number;         // Default: 10, Max: 100
  offset?: number;
  minMarketCap?: number;
  maxMarketCap?: number;
  verified?: boolean;
  categories?: string[];
}

export interface SearchResponse {
  tokens: SolanaToken[];
  query: string;
  total: number;
  took: number;           // Search time in milliseconds
}

// ============================================================================
// Wallet Types
// ============================================================================

export interface WalletRequest {
  owner: string;
  includeNfts?: boolean;
  includeStaking?: boolean;
  minBalance?: number;
}

export interface TokenHolding {
  token: SolanaToken;
  balance: number;
  balanceUsd: number;
  percentage: number;
  lastUpdated: string;
}

export interface WalletResponse {
  owner: string;
  totalValueUsd: number;
  tokenCount: number;
  nftCount?: number;
  holdings: TokenHolding[];
  lastUpdated: string;
}

// ============================================================================
// Error Types
// ============================================================================

export class SolanaTrackerError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly retryable: boolean;
  public readonly rateLimited: boolean;
  public readonly retryAfter?: number;
  public readonly requestId?: string;
  public readonly details?: any;

  constructor(
    message: string,
    code: string,
    status: number,
    retryable = false,
    rateLimited = false,
    retryAfter?: number,
    requestId?: string,
    details?: any
  ) {
    super(message);
    this.name = 'SolanaTrackerError';
    this.code = code;
    this.status = status;
    this.retryable = retryable;
    this.rateLimited = rateLimited;
    this.retryAfter = retryAfter;
    this.requestId = requestId;
    this.details = details;
  }

  public static fromResponse(
    response: { status: number; data?: any; headers?: Record<string, string> },
    requestId?: string
  ): SolanaTrackerError {
    const status = response.status;
    const data = response.data || {};
    const headers = response.headers || {};
    
    let code = 'UNKNOWN_ERROR';
    let message = 'An unknown error occurred';
    let retryable = false;
    let rateLimited = false;
    let retryAfter: number | undefined;

    // Handle different status codes
    switch (status) {
      case 400:
        code = 'BAD_REQUEST';
        message = data.error?.message || 'Bad request';
        break;
      case 401:
        code = 'UNAUTHORIZED';
        message = 'Invalid API key or unauthorized access';
        break;
      case 403:
        code = 'FORBIDDEN';
        message = 'Access forbidden - check your subscription plan';
        break;
      case 404:
        code = 'NOT_FOUND';
        message = data.error?.message || 'Resource not found';
        break;
      case 429:
        code = 'RATE_LIMITED';
        message = 'Rate limit exceeded';
        retryable = true;
        rateLimited = true;
        retryAfter = parseInt(headers['retry-after'] || headers['x-ratelimit-reset']) || 60;
        break;
      case 500:
      case 502:
      case 503:
      case 504:
        code = 'SERVER_ERROR';
        message = 'Server error - please try again later';
        retryable = true;
        break;
      default:
        if (status >= 500) {
          retryable = true;
        }
    }

    return new SolanaTrackerError(
      message,
      code,
      status,
      retryable,
      rateLimited,
      retryAfter,
      requestId,
      data
    );
  }
}

// ============================================================================
// Circuit Breaker Types
// ============================================================================

export interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half-open';
  failureCount: number;
  successCount: number;
  nextAttempt: number;
  lastError?: SolanaTrackerError;
  requestCount: number;
  lastRequestTime: number;
}

// ============================================================================
// Cache Types
// ============================================================================

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  key: string;
}

export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  hitRate: number;
}

// ============================================================================
// Metrics Types
// ============================================================================

export interface ApiMetrics {
  requests: {
    total: number;
    successful: number;
    failed: number;
    rateLimited: number;
  };
  performance: {
    averageResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
  };
  cache: CacheStats;
  circuitBreaker: {
    state: string;
    failureRate: number;
    requestsInWindow: number;
  };
  lastUpdated: string;
}

// ============================================================================
// Client Configuration
// ============================================================================

export interface ClientOptions {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  rateLimitRps?: number;
  requestDelayMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  enableCircuitBreaker?: boolean;
  enableCache?: boolean;
  enableMetrics?: boolean;
  logger?: any;
}

// ============================================================================
// Market Cap Filter Types
// ============================================================================

export interface MarketCapFilter {
  min: number;
  max: number;
}

export interface FilteredTokensResponse {
  tokens: SolanaToken[];
  filtered: {
    total: number;
    byMarketCap: number;
    byVolume: number;
    byRisk: number;
  };
  criteria: {
    marketCapRange: MarketCapFilter;
    minVolume?: number;
    maxRiskLevel?: string;
  };
}