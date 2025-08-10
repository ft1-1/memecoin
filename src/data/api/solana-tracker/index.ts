/**
 * Solana Tracker API Integration
 * 
 * Production-ready API client for Solana Tracker with comprehensive features:
 * - Rate limiting (1 req/sec for free tier)
 * - Circuit breaker pattern for fault tolerance
 * - Request/response caching with TTL strategies
 * - Exponential backoff retry logic
 * - Market cap filtering ($5M-$50M range)
 * - Comprehensive error handling and logging
 * - Performance metrics and health monitoring
 * 
 * @example Basic Usage
 * ```typescript
 * import { createSolanaTrackerClient } from '@/data/api/solana-tracker';
 * import { createAppLogger } from '@/utils/Logger';
 * 
 * const logger = createAppLogger(config.monitoring);
 * const client = createSolanaTrackerClient({
 *   apiKey: 'your-api-key',
 *   baseUrl: 'https://data.solanatracker.io',
 *   rateLimitRps: 1,
 * }, logger);
 * 
 * // Get trending tokens filtered by market cap
 * const trending = await client.getTrendingTokensFiltered(
 *   '24h',
 *   { min: 5_000_000, max: 50_000_000 }
 * );
 * ```
 * 
 * @example Advanced Usage with Factory
 * ```typescript
 * import { getClientFactory } from '@/data/api/solana-tracker';
 * 
 * const factory = getClientFactory(logger);
 * const client = factory.createMemecoinAnalyzerClient(apiConfig);
 * 
 * // Monitor health
 * const health = await factory.getHealthStatus();
 * const metrics = factory.getMetrics();
 * ```
 */

// ============================================================================
// Core Components
// ============================================================================

export { SolanaTrackerClient } from './SolanaTrackerClient';
export { RateLimiter } from './RateLimiter';
export { ApiCache } from './Cache';
export { ApiDataMapper } from './ApiDataMapper';
export { 
  SolanaTrackerClientFactory, 
  getClientFactory, 
  destroyGlobalFactory 
} from './ClientFactory';
export { 
  SolanaTrackerSystemComponent,
  createSolanaTrackerSystemComponent,
  createMemecoinAnalyzerSystemComponent,
} from './SolanaTrackerSystemComponent';

// ============================================================================
// Type Definitions
// ============================================================================

export type {
  // Configuration Types
  SolanaTrackerConfig,
  ClientOptions,
  
  // Request/Response Types
  TrendingTokensRequest,
  TrendingTokensResponse,
  TokenDetails,
  ChartDataRequest,
  ChartDataResponse,
  PriceMultiRequest,
  PriceMultiResponse,
  SearchRequest,
  SearchResponse,
  WalletRequest,
  WalletResponse,
  
  // Data Types
  SolanaToken,
  OHLCV,
  TokenPrice,
  TokenHolding,
  LiquidityPool,
  TokenRiskAnalysis,
  RiskFactor,
  
  // Filtering Types
  MarketCapFilter,
  FilteredTokensResponse,
  
  // System Types
  ApiMetrics,
  CacheStats,
  CircuitBreakerState,
  
  // Utility Types
  SolanaTrackerResponse,
  PaginatedResponse,
} from './types';

// Export mapper types
export type { MappedTokenData } from './ApiDataMapper';

// Export the main error class
export { SolanaTrackerError } from './types';

// ============================================================================
// Convenience Functions
// ============================================================================

import { Logger } from 'winston';
import { ApiConfig } from '@/types/config';
import { SolanaTrackerClient } from './SolanaTrackerClient';
import { SolanaTrackerSystemComponent, createMemecoinAnalyzerSystemComponent } from './SolanaTrackerSystemComponent';
import { ClientOptions } from './types';

/**
 * Create a Solana Tracker client with default production settings
 */
export function createSolanaTrackerClient(
  apiConfig: ApiConfig['solanaTracker'],
  logger: Logger,
  options?: Partial<ClientOptions>
): SolanaTrackerClient {
  const clientOptions: ClientOptions = {
    apiKey: apiConfig.apiKey,
    baseUrl: apiConfig.baseUrl,
    timeout: apiConfig.timeout || 30000,
    rateLimitRps: apiConfig.rateLimitRps || 1,
    maxRetries: apiConfig.maxRetries || 3,
    retryDelayMs: apiConfig.retryDelayMs || 1000,
    enableCircuitBreaker: true,
    enableCache: true,
    enableMetrics: true,
    logger,
    ...options,
  };

  return new SolanaTrackerClient(clientOptions, logger);
}

/**
 * Create a client optimized for memecoin analysis
 * - Conservative rate limiting
 * - Optimized caching for memecoin data
 * - Market cap filtering built-in
 * - Returns SystemComponent for orchestrator integration
 */
export function createMemecoinAnalyzerClient(
  apiConfig: ApiConfig['solanaTracker'],
  logger: Logger
): SolanaTrackerSystemComponent {
  return createMemecoinAnalyzerSystemComponent(apiConfig, logger);
}

/**
 * Create a client optimized for batch operations
 * - Higher timeout for batch requests
 * - More aggressive retry logic
 * - Larger cache settings
 */
export function createBatchProcessingClient(
  apiConfig: ApiConfig['solanaTracker'],
  logger: Logger
): SolanaTrackerClient {
  return createSolanaTrackerClient(apiConfig, logger, {
    timeout: 60000, // 1 minute timeout
    maxRetries: 3,
    retryDelayMs: 2000,
  });
}

// ============================================================================
// Constants and Defaults
// ============================================================================

/**
 * Default market cap range for memecoin analysis ($5M - $50M)
 */
export const DEFAULT_MEMECOIN_MARKET_CAP_RANGE = {
  min: 5_000_000,
  max: 50_000_000,
} as const;

/**
 * Supported timeframes for trending tokens
 */
export const TRENDING_TIMEFRAMES = [
  '5m', '15m', '30m', '1h', '6h', '12h', '24h'
] as const;

/**
 * Supported chart intervals
 */
export const CHART_INTERVALS = [
  '1s', '5s', '15s', '30s', '1m', '5m', '15m', '30m', 
  '1h', '4h', '1d', '1w', '1mn'
] as const;

/**
 * Risk levels in order of severity
 */
export const RISK_LEVELS = ['low', 'medium', 'high', 'critical'] as const;

/**
 * Default cache TTL strategies (in milliseconds)
 */
export const DEFAULT_CACHE_TTL = {
  tokenMetadata: 60 * 60 * 1000,      // 1 hour
  priceData: 30 * 1000,               // 30 seconds
  chartData: 5 * 60 * 1000,           // 5 minutes
  riskScores: 30 * 60 * 1000,         // 30 minutes
  trendingTokens: 2 * 60 * 1000,      // 2 minutes
} as const;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Validate market cap filter parameters
 */
export function validateMarketCapFilter(filter: { min: number; max: number }): boolean {
  return filter.min > 0 && 
         filter.max > filter.min && 
         filter.max <= 1_000_000_000_000; // 1 trillion max
}

/**
 * Format market cap for display
 */
export function formatMarketCap(marketCap: number): string {
  if (marketCap >= 1_000_000_000) {
    return `$${(marketCap / 1_000_000_000).toFixed(2)}B`;
  }
  if (marketCap >= 1_000_000) {
    return `$${(marketCap / 1_000_000).toFixed(2)}M`;
  }
  if (marketCap >= 1_000) {
    return `$${(marketCap / 1_000).toFixed(2)}K`;
  }
  return `$${marketCap.toFixed(2)}`;
}

/**
 * Check if a token meets memecoin criteria
 */
export function isMemecoinCandidate(
  token: { marketCap: number; volume24h?: number; riskLevel?: string }
): boolean {
  return token.marketCap >= DEFAULT_MEMECOIN_MARKET_CAP_RANGE.min &&
         token.marketCap <= DEFAULT_MEMECOIN_MARKET_CAP_RANGE.max &&
         (token.volume24h || 0) > 10_000 && // Minimum $10k daily volume
         (!token.riskLevel || ['low', 'medium'].includes(token.riskLevel));
}

/**
 * Create a cache key for API requests
 */
export function createCacheKey(
  endpoint: string, 
  params?: Record<string, any>
): string {
  const baseKey = endpoint.replace(/^\/+/, '').replace(/\/+/g, ':');
  
  if (!params || Object.keys(params).length === 0) {
    return baseKey;
  }
  
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join('&');
    
  return `${baseKey}:${sortedParams}`;
}

// ============================================================================
// Health Check Utilities
// ============================================================================

/**
 * Perform a comprehensive health check of the API integration
 */
export async function performHealthCheck(
  client: SolanaTrackerClient
): Promise<{
  healthy: boolean;
  checks: {
    connectivity: boolean;
    rateLimit: boolean;
    cache: boolean;
    circuitBreaker: boolean;
  };
  metrics: any;
  timestamp: string;
}> {
  const health = await client.healthCheck();
  const metrics = client.getMetrics();
  
  return {
    healthy: health.healthy,
    checks: {
      connectivity: health.details.connectivity,
      rateLimit: metrics.circuitBreaker.state !== 'open',
      cache: health.details.cache.isHealthy,
      circuitBreaker: metrics.circuitBreaker.state === 'closed',
    },
    metrics,
    timestamp: new Date().toISOString(),
  };
}