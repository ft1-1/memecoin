/**
 * Production-ready Solana Tracker API client
 * Implements all required endpoints with comprehensive error handling, 
 * rate limiting, caching, and circuit breaker patterns
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { EventEmitter } from 'events';
import { Logger } from 'winston';
import { performance } from 'perf_hooks';

import { RateLimiter, RateLimiterConfig } from './RateLimiter';
import { ApiCache, CacheConfig } from './Cache';
import {
  SolanaTrackerConfig,
  SolanaTrackerResponse,
  SolanaTrackerError,
  TrendingTokensRequest,
  TrendingTokensResponse,
  ProcessedTrendingTokensResponse,
  TokenDetails,
  ChartDataRequest,
  ChartDataResponse,
  MultiTimeframeChartRequest,
  MultiTimeframeChartResponse,
  TimeframeCacheConfig,
  ChartFetchStrategy,
  PriceMultiRequest,
  PriceMultiResponse,
  SearchRequest,
  SearchResponse,
  WalletRequest,
  WalletResponse,
  ClientOptions,
  ApiMetrics,
  MarketCapFilter,
  FilteredTokensResponse,
  SolanaToken,
  SolanaTrackerTokenResponse,
  SolanaTrackerChartResponse,
  OHLCV,
  SolanaTrackerOCLHV,
} from './types';
import { ChartDataAggregator, TIMEFRAME_CONFIGS } from './utils/ChartDataAggregator';

export interface RequestMetrics {
  startTime: number;
  endTime?: number;
  duration?: number;
  endpoint: string;
  method: string;
  success: boolean;
  status?: number;
  cached: boolean;
  retryCount: number;
}

/**
 * Main Solana Tracker API client
 */
export class SolanaTrackerClient extends EventEmitter {
  private readonly config: SolanaTrackerConfig;
  private readonly logger: Logger;
  private readonly httpClient: AxiosInstance;
  private readonly rateLimiter: RateLimiter;
  private readonly cache: ApiCache;
  private readonly chartAggregator: ChartDataAggregator;

  // Request delay tracking for rate limiting
  private lastRequestTime = 0;

  // Multi-timeframe configuration
  private readonly timeframeCacheConfig: TimeframeCacheConfig = {
    '5m': 2 * 60 * 1000,      // 2 minutes
    '15m': 5 * 60 * 1000,     // 5 minutes
    '1h': 10 * 60 * 1000,     // 10 minutes
    '4h': 30 * 60 * 1000,     // 30 minutes
  };

  private readonly chartFetchStrategy: ChartFetchStrategy = {
    primarySource: 'aggregation',  // Use aggregation as primary for consistency
    fallbackEnabled: true,
    staggerDelayMs: 3000,         // 3000ms delay between requests (ultra-conservative)
    maxConcurrentRequests: 1,     // Only 1 concurrent request to prevent rate limiting
    cacheFirst: true,
  };

  // Metrics and monitoring
  private metrics: ApiMetrics = {
    requests: {
      total: 0,
      successful: 0,
      failed: 0,
      rateLimited: 0,
    },
    performance: {
      averageResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
    },
    cache: {
      hits: 0,
      misses: 0,
      size: 0,
      hitRate: 0,
    },
    circuitBreaker: {
      state: 'closed',
      failureRate: 0,
      requestsInWindow: 0,
    },
    lastUpdated: new Date().toISOString(),
  };

  private responseTimes: number[] = [];
  private isDestroyed = false;

  constructor(options: ClientOptions, logger: Logger) {
    super();
    
    this.logger = logger;
    this.config = this.buildConfig(options);

    // Initialize HTTP client
    this.httpClient = this.createHttpClient();

    // Initialize rate limiter
    this.rateLimiter = new RateLimiter(this.buildRateLimiterConfig(), logger);

    // Initialize cache
    this.cache = new ApiCache(this.buildCacheConfig(), logger);

    // Initialize chart data aggregator
    this.chartAggregator = new ChartDataAggregator(logger);

    // Set up event listeners
    this.setupEventListeners();

    // Start metrics collection
    this.startMetricsCollection();

    this.logger.info('Solana Tracker client initialized', {
      baseUrl: this.config.baseUrl,
      rateLimitRps: this.config.rateLimitRps,
      cacheEnabled: true,
    });
  }

  // ============================================================================
  // Public API Methods
  // ============================================================================

  /**
   * Get trending tokens by timeframe
   */
  public async getTrendingTokens(
    request: TrendingTokensRequest
  ): Promise<ProcessedTrendingTokensResponse> {
    const cacheKey = `trending:${request.timeframe}:${JSON.stringify({
      limit: request.limit,
      offset: request.offset,
      minMarketCap: request.minMarketCap,
      maxMarketCap: request.maxMarketCap,
    })}`;

    const rawResponse = await this.makeRequest<TrendingTokensResponse>(
      'GET',
      `/tokens/trending/${request.timeframe}`,
      {
        params: {
          limit: request.limit,
          offset: request.offset,
          min_market_cap: request.minMarketCap,
          max_market_cap: request.maxMarketCap,
          min_volume: request.minVolume,
          tags: request.tags?.join(','),
        },
      },
      cacheKey
    );

    // Transform raw API response to normalized format
    return this.transformTrendingTokensResponse(rawResponse, request.timeframe);
  }

  /**
   * Get detailed token information
   */
  public async getTokenDetails(address: string): Promise<TokenDetails> {
    const cacheKey = `token:${address}:metadata`;
    
    const rawResponse = await this.makeRequest<SolanaTrackerTokenResponse>(
      'GET',
      `/tokens/${address}`,
      {},
      cacheKey
    );

    // Transform raw API response to normalized format
    return this.transformTokenDetailsResponse(rawResponse);
  }

  /**
   * Get chart data for a token with data validation and fallback logic
   */
  public async getChartData(
    request: ChartDataRequest, 
    minDataPoints: number = 30
  ): Promise<ChartDataResponse> {
    const cacheKey = `chart:${request.token}:${request.interval}:${request.from}:${request.to}`;
    
    let currentRequest = { ...request };
    let attemptCount = 0;
    const maxAttempts = 3;
    
    while (attemptCount < maxAttempts) {
      try {
        const rawResponse = await this.makeRequest<SolanaTrackerChartResponse>(
          'GET',
          `/chart/${request.token}`,
          {
            params: {
              type: currentRequest.interval,        // API uses 'type' not 'interval'
              time_from: currentRequest.from,       // API uses 'time_from' not 'from'
              time_to: currentRequest.to,           // API uses 'time_to' not 'to'
              limit: currentRequest.limit || 1000,  // Default to higher limit
              marketCap: currentRequest.marketCap,
              removeOutliers: currentRequest.removeOutliers,
            },
          },
          cacheKey
        );

        // Transform raw API response to normalized format
        const chartResponse = this.transformChartDataResponse(rawResponse, currentRequest);
        
        // Validate minimum data points
        if (chartResponse.count < minDataPoints) {
          this.logger.warn('Insufficient chart data received, attempting to fetch longer timeframe', {
            token: request.token,
            interval: currentRequest.interval,
            received: chartResponse.count,
            required: minDataPoints,
            attempt: attemptCount + 1,
          });

          // Try to fetch longer time range or different interval
          if (attemptCount === 0) {
            // First retry: Extend time range
            const extendedHours = this.calculateExtendedTimeRange(currentRequest.interval, minDataPoints);
            const now = Math.floor(Date.now() / 1000);
            currentRequest = {
              ...currentRequest,
              from: now - (extendedHours * 3600),
              to: now,
              limit: Math.max(currentRequest.limit || 1000, minDataPoints * 2),
            };
          } else if (attemptCount === 1) {
            // Second retry: Try different interval if possible
            const fallbackInterval = this.getFallbackInterval(currentRequest.interval);
            if (fallbackInterval) {
              const fallbackTimeRange = this.calculateTimeRangeForInterval(fallbackInterval, minDataPoints);
              currentRequest = {
                ...currentRequest,
                interval: fallbackInterval,
                from: fallbackTimeRange.from,
                to: fallbackTimeRange.to,
                limit: Math.max(currentRequest.limit || 1000, minDataPoints * 2),
              };
            } else {
              // No fallback available, return what we have
              this.logger.warn('No fallback interval available, returning insufficient data', {
                token: request.token,
                dataPoints: chartResponse.count,
              });
              return chartResponse;
            }
          } else {
            // Final attempt failed, return what we have
            this.logger.error('All attempts to fetch sufficient data failed', {
              token: request.token,
              finalDataPoints: chartResponse.count,
              requiredDataPoints: minDataPoints,
            });
            return chartResponse;
          }

          attemptCount++;
          continue;
        }

        // Data validation passed
        this.logger.debug('Chart data validation passed', {
          token: request.token,
          interval: currentRequest.interval,
          dataPoints: chartResponse.count,
          requiredMinimum: minDataPoints,
        });

        return chartResponse;

      } catch (error) {
        if (attemptCount === maxAttempts - 1) {
          throw error; // Re-throw on final attempt
        }
        
        this.logger.warn('Chart data fetch attempt failed, retrying', {
          token: request.token,
          attempt: attemptCount + 1,
          error: error instanceof Error ? error.message : error,
        });
        
        attemptCount++;
      }
    }

    // Should not reach here, but return empty response as fallback
    throw new SolanaTrackerError(
      `Failed to fetch sufficient chart data after ${maxAttempts} attempts`,
      'INSUFFICIENT_DATA',
      404,
      false
    );
  }

  /**
   * Get multi-timeframe chart data for comprehensive technical analysis
   * Fetches 1-minute data and aggregates into multiple timeframes for consistency
   */
  public async getMultiTimeframeChart(request: MultiTimeframeChartRequest): Promise<MultiTimeframeChartResponse> {
    const startTime = performance.now();
    const requestId = this.generateRequestId();
    
    this.logger.info('Starting multi-timeframe chart data fetch', {
      token: request.token,
      timeframes: request.timeframes,
      requestId,
    });

    const result: MultiTimeframeChartResponse = {
      token: request.token,
      timeframes: {},
      sourceDataUsed: {
        dataPoints: 0,
        timeRange: { from: 0, to: 0 },
        fetchTime: 0,
      },
      generatedAt: new Date().toISOString(),
      errors: [],
      warnings: [],
    };

    try {
      // Check cache first if enabled
      if (this.chartFetchStrategy.cacheFirst && request.enableCaching !== false) {
        const cachedResults = await this.getCachedMultiTimeframeData(request);
        if (cachedResults && Object.keys(cachedResults).length > 0) {
          this.logger.debug('Using cached multi-timeframe data', {
            token: request.token,
            cachedTimeframes: Object.keys(cachedResults),
            requestId,
          });
          result.timeframes = { ...result.timeframes, ...cachedResults };
        }
      }

      // Determine which timeframes need fresh data
      const uncachedTimeframes = request.timeframes.filter(tf => !result.timeframes[tf]);
      
      if (uncachedTimeframes.length === 0) {
        result.sourceDataUsed.fetchTime = performance.now() - startTime;
        this.logger.info('All timeframes served from cache', { token: request.token, requestId });
        return result;
      }

      // Determine the maximum time range needed for uncached timeframes
      const maxTimeRange = this.calculateMaxTimeRange(uncachedTimeframes);
      
      // Fetch 1-minute source data with optimized range
      const sourceData = await this.fetchSourceDataForTimeframes(
        request.token,
        maxTimeRange,
        requestId
      );

      result.sourceDataUsed = {
        dataPoints: sourceData.data.length,
        timeRange: {
          from: sourceData.from,
          to: sourceData.to,
        },
        fetchTime: performance.now() - startTime,
      };

      if (sourceData.data.length === 0) {
        result.errors?.push('No source data available for aggregation');
        this.logger.warn('No source data for multi-timeframe aggregation', {
          token: request.token,
          timeRange: maxTimeRange,
          requestId,
        });
        return result;
      }

      // Aggregate data for each uncached timeframe
      const aggregationResults = this.chartAggregator.aggregateAllTimeframes(sourceData.data);
      result.aggregationResults = aggregationResults;

      // Process each requested timeframe
      for (const timeframe of uncachedTimeframes) {
        try {
          const aggregationResult = aggregationResults[timeframe];
          
          if (!aggregationResult || aggregationResult.data.length === 0) {
            result.errors?.push(`No data available for ${timeframe} timeframe`);
            continue;
          }

          // Create chart data response for this timeframe
          const chartResponse: ChartDataResponse = {
            token: request.token,
            interval: timeframe,
            data: aggregationResult.data,
            from: aggregationResult.data[0]?.timestamp || 0,
            to: aggregationResult.data[aggregationResult.data.length - 1]?.timestamp || 0,
            count: aggregationResult.data.length,
          };

          result.timeframes[timeframe] = chartResponse;

          // Cache the result with timeframe-specific TTL
          if (request.enableCaching !== false) {
            await this.cacheTimeframeData(request.token, timeframe, chartResponse);
          }

          // Collect warnings from aggregation
          if (aggregationResult.warnings.length > 0) {
            result.warnings?.push(...aggregationResult.warnings.map(w => `${timeframe}: ${w}`));
          }

          this.logger.debug('Timeframe aggregation completed', {
            token: request.token,
            timeframe,
            sourcePoints: aggregationResult.originalDataPoints,
            aggregatedPoints: aggregationResult.aggregatedDataPoints,
            completionRate: `${(aggregationResult.completionRate * 100).toFixed(1)}%`,
            requestId,
          });

        } catch (error) {
          const errorMsg = `Failed to process ${timeframe} timeframe: ${error instanceof Error ? error.message : error}`;
          result.errors?.push(errorMsg);
          this.logger.error('Timeframe processing error', {
            token: request.token,
            timeframe,
            error: errorMsg,
            requestId,
          });
        }
      }

      const totalDuration = performance.now() - startTime;
      this.logger.info('Multi-timeframe chart data fetch completed', {
        token: request.token,
        requestedTimeframes: request.timeframes.length,
        processedTimeframes: Object.keys(result.timeframes).length,
        sourceDataPoints: result.sourceDataUsed.dataPoints,
        duration: `${totalDuration.toFixed(2)}ms`,
        errors: result.errors?.length || 0,
        warnings: result.warnings?.length || 0,
        requestId,
      });

      return result;

    } catch (error) {
      const errorMsg = `Multi-timeframe fetch failed: ${error instanceof Error ? error.message : error}`;
      result.errors?.push(errorMsg);
      
      this.logger.error('Multi-timeframe chart data fetch failed', {
        token: request.token,
        error: errorMsg,
        duration: `${(performance.now() - startTime).toFixed(2)}ms`,
        requestId,
      });

      return result;
    }
  }

  /**
   * Get optimized chart data with intelligent caching and fallback strategies
   * Combines direct API calls with aggregation for best performance and consistency
   */
  public async getChartDataOptimized(
    token: string,
    timeframe: '5m' | '15m' | '1h' | '4h',
    options?: {
      maxRetries?: number;
      enableCaching?: boolean;
      fallbackToAggregation?: boolean;
    }
  ): Promise<ChartDataResponse> {
    const requestId = this.generateRequestId();
    const startTime = performance.now();
    
    this.logger.debug('Starting optimized chart data fetch', {
      token,
      timeframe,
      options,
      requestId,
    });

    // Check cache first
    if (options?.enableCaching !== false) {
      const cached = await this.getCachedTimeframeData(token, timeframe);
      if (cached) {
        this.logger.debug('Serving chart data from cache', { token, timeframe, requestId });
        return cached;
      }
    }

    // Calculate time range for this timeframe
    const timeRange = ChartDataAggregator.getTimeRangeForTimeframe(timeframe);
    
    try {
      // Try direct API call first (if supported by API for this timeframe)
      if (this.chartFetchStrategy.primarySource === 'api' && this.isDirectApiSupportedForTimeframe(timeframe)) {
        try {
          const directResult = await this.getChartData({
            token,
            interval: timeframe,
            from: timeRange.fromTimestamp,
            to: timeRange.toTimestamp,
            limit: TIMEFRAME_CONFIGS[timeframe].maxDataPoints,
            removeOutliers: true,
          });

          // Cache the result
          if (options?.enableCaching !== false) {
            await this.cacheTimeframeData(token, timeframe, directResult);
          }

          this.logger.debug('Chart data fetched via direct API', {
            token,
            timeframe,
            dataPoints: directResult.count,
            duration: `${(performance.now() - startTime).toFixed(2)}ms`,
            requestId,
          });

          return directResult;
        } catch (error) {
          this.logger.warn('Direct API fetch failed, falling back to aggregation', {
            token,
            timeframe,
            error: error instanceof Error ? error.message : error,
            requestId,
          });
        }
      }

      // Use aggregation approach (primary or fallback)
      if (options?.fallbackToAggregation !== false) {
        const multiTimeframeResult = await this.getMultiTimeframeChart({
          token,
          timeframes: [timeframe],
          enableCaching: options?.enableCaching,
          maxRetries: options?.maxRetries,
        });

        const result = multiTimeframeResult.timeframes[timeframe];
        if (!result) {
          throw new SolanaTrackerError(
            `No data available for ${timeframe} timeframe after aggregation`,
            'NO_DATA_AVAILABLE',
            404,
            false
          );
        }

        this.logger.debug('Chart data fetched via aggregation', {
          token,
          timeframe,
          dataPoints: result.count,
          sourceDataPoints: multiTimeframeResult.sourceDataUsed.dataPoints,
          duration: `${(performance.now() - startTime).toFixed(2)}ms`,
          warnings: multiTimeframeResult.warnings?.length || 0,
          requestId,
        });

        return result;
      }

      throw new SolanaTrackerError(
        'All chart data fetch strategies failed',
        'FETCH_STRATEGIES_EXHAUSTED',
        500,
        false
      );

    } catch (error) {
      this.logger.error('Optimized chart data fetch failed', {
        token,
        timeframe,
        error: error instanceof Error ? error.message : error,
        duration: `${(performance.now() - startTime).toFixed(2)}ms`,
        requestId,
      });
      
      throw error;
    }
  }

  /**
   * Get prices for multiple tokens
   */
  public async getPricesMulti(request: PriceMultiRequest): Promise<PriceMultiResponse> {
    if (request.addresses.length > 100) {
      throw new SolanaTrackerError(
        'Maximum 100 addresses allowed per request',
        'TOO_MANY_ADDRESSES',
        400,
        false
      );
    }

    const cacheKey = `price:multi:${request.addresses.sort().join(',')}`;
    
    return this.makeRequest<PriceMultiResponse>(
      'POST',
      '/price/multi',
      {
        data: {
          addresses: request.addresses,
          currencies: request.currencies || ['usd'],
          include_market_cap: request.includeMarketCap,
          include_volume: request.includeVolume,
          include_24h_change: request.include24hChange,
        },
      },
      cacheKey
    );
  }

  /**
   * Search for tokens
   */
  public async searchTokens(request: SearchRequest): Promise<SearchResponse> {
    const cacheKey = `search:${request.query}:${JSON.stringify({
      limit: request.limit,
      offset: request.offset,
      minMarketCap: request.minMarketCap,
      maxMarketCap: request.maxMarketCap,
    })}`;

    return this.makeRequest<SearchResponse>(
      'GET',
      '/search',
      {
        params: {
          q: request.query,
          limit: request.limit,
          offset: request.offset,
          min_market_cap: request.minMarketCap,
          max_market_cap: request.maxMarketCap,
          verified: request.verified,
          categories: request.categories?.join(','),
        },
      },
      cacheKey
    );
  }

  /**
   * Get wallet token holdings
   */
  public async getWalletHoldings(request: WalletRequest): Promise<WalletResponse> {
    const cacheKey = `wallet:${request.owner}:${JSON.stringify({
      includeNfts: request.includeNfts,
      includeStaking: request.includeStaking,
      minBalance: request.minBalance,
    })}`;

    return this.makeRequest<WalletResponse>(
      'GET',
      `/wallet/${request.owner}`,
      {
        params: {
          include_nfts: request.includeNfts,
          include_staking: request.includeStaking,
          min_balance: request.minBalance,
        },
      },
      cacheKey
    );
  }

  // ============================================================================
  // Market Cap Filtering Methods
  // ============================================================================

  /**
   * Get trending tokens filtered by market cap range
   */
  public async getTrendingTokensFiltered(
    timeframe: TrendingTokensRequest['timeframe'],
    marketCapFilter: MarketCapFilter,
    options?: {
      minVolume?: number;
      maxRiskLevel?: 'low' | 'medium' | 'high';
      limit?: number;
    }
  ): Promise<FilteredTokensResponse> {
    const trending = await this.getTrendingTokens({
      timeframe,
      limit: options?.limit || 100,
      minMarketCap: marketCapFilter.min,
      maxMarketCap: marketCapFilter.max,
      minVolume: options?.minVolume,
    });

    return this.applyAdditionalFilters(trending.tokens, marketCapFilter, options);
  }

  /**
   * Batch get token details for multiple addresses with market cap filtering
   */
  public async getTokenDetailsBatch(
    addresses: string[],
    marketCapFilter?: MarketCapFilter
  ): Promise<TokenDetails[]> {
    const batchSize = 10; // Process in batches to respect rate limits
    const results: TokenDetails[] = [];

    for (let i = 0; i < addresses.length; i += batchSize) {
      const batch = addresses.slice(i, i + batchSize);
      
      const batchPromises = batch.map(address => 
        this.getTokenDetails(address).catch(error => {
          this.logger.warn(`Failed to get token details for ${address}`, { error });
          return null;
        })
      );

      const batchResults = await Promise.all(batchPromises);
      const validResults = batchResults.filter((token): token is TokenDetails => {
        if (!token) return false;
        
        if (marketCapFilter) {
          return token.marketCap >= marketCapFilter.min && 
                 token.marketCap <= marketCapFilter.max;
        }
        
        return true;
      });

      results.push(...validResults);

      // Add delay between batches to respect rate limits
      if (i + batchSize < addresses.length) {
        await this.delay(1000 / this.config.rateLimitRps * batchSize);
      }
    }

    return results;
  }

  // ============================================================================
  // Health and Monitoring Methods
  // ============================================================================

  /**
   * Get comprehensive client metrics
   */
  public getMetrics(): ApiMetrics {
    const rateLimiterStats = this.rateLimiter.getStats();
    const cacheStats = this.cache.getStats();

    return {
      ...this.metrics,
      cache: cacheStats,
      circuitBreaker: {
        state: rateLimiterStats.circuitState,
        failureRate: rateLimiterStats.failureRate,
        requestsInWindow: rateLimiterStats.requestsInWindow,
      },
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Check client health
   */
  public async healthCheck(): Promise<{
    healthy: boolean;
    details: {
      rateLimiter: any;
      cache: any;
      connectivity: boolean;
      lastRequest?: string;
    };
  }> {
    const rateLimiterMetrics = this.rateLimiter.getMetrics();
    const cacheHealth = this.cache.getHealthMetrics();
    
    // Test connectivity with a lightweight request
    let connectivity = false;
    try {
      // Skip connectivity test - Solana Tracker API doesn't have a health endpoint
      // We'll rely on the rate limiter and cache health metrics instead
      connectivity = true; // Assume connectivity is OK if client is initialized
    } catch (error) {
      this.logger.warn('Health check connectivity test failed', { error });
    }

    const healthy = connectivity && 
                    rateLimiterMetrics.rateLimiter.circuitBreakerState !== 'open' &&
                    cacheHealth.isHealthy;

    return {
      healthy,
      details: {
        rateLimiter: rateLimiterMetrics,
        cache: cacheHealth,
        connectivity,
        lastRequest: this.metrics.lastUpdated,
      },
    };
  }

  /**
   * Reset metrics and internal state
   */
  public resetMetrics(): void {
    this.metrics = {
      requests: { total: 0, successful: 0, failed: 0, rateLimited: 0 },
      performance: { averageResponseTime: 0, p95ResponseTime: 0, p99ResponseTime: 0 },
      cache: { hits: 0, misses: 0, size: 0, hitRate: 0 },
      circuitBreaker: { state: 'closed', failureRate: 0, requestsInWindow: 0 },
      lastUpdated: new Date().toISOString(),
    };
    
    this.responseTimes = [];
    this.rateLimiter.resetCircuitBreaker();
    
    this.logger.info('Client metrics reset');
  }

  /**
   * Validate client configuration and connectivity
   */
  public async validateConfiguration(): Promise<{
    valid: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check API key
    if (!this.config.apiKey || this.config.apiKey.length < 10) {
      issues.push('Invalid or missing API key');
    }

    // Check rate limiting configuration
    if (this.config.rateLimitRps > 1) {
      recommendations.push('Rate limit > 1 RPS may cause 429 errors on free tier');
    }

    // Check timeout configuration
    if (this.config.timeout < 30000) {
      recommendations.push('Timeout < 30s may cause frequent timeouts');
    }

    // Test basic connectivity (if not already done)
    try {
      const health = await this.healthCheck();
      if (!health.healthy) {
        issues.push('Health check failed - client not ready');
      }
    } catch (error) {
      issues.push(`Health check error: ${error instanceof Error ? error.message : error}`);
    }

    this.logger.info('Configuration validation completed', {
      valid: issues.length === 0,
      issues: issues.length,
      recommendations: recommendations.length,
    });

    return {
      valid: issues.length === 0,
      issues,
      recommendations,
    };
  }

  /**
   * Cleanup and destroy client
   */
  public destroy(): void {
    if (this.isDestroyed) return;
    
    this.isDestroyed = true;
    this.rateLimiter.destroy();
    this.cache.destroy();
    this.removeAllListeners();
    
    this.logger.info('Solana Tracker client destroyed');
  }

  // ============================================================================
  // Multi-Timeframe Helper Methods
  // ============================================================================

  /**
   * Calculate the maximum time range needed for multiple timeframes
   */
  private calculateMaxTimeRange(timeframes: ('5m' | '15m' | '1h' | '4h')[]): {
    fromTimestamp: number;
    toTimestamp: number;
    hoursNeeded: number;
  } {
    const maxHours = Math.max(...timeframes.map(tf => TIMEFRAME_CONFIGS[tf].hoursToFetch));
    const now = Date.now();
    const fromTimestamp = Math.floor((now - (maxHours * 60 * 60 * 1000)) / 1000);
    const toTimestamp = Math.floor(now / 1000);

    return {
      fromTimestamp,
      toTimestamp,
      hoursNeeded: maxHours,
    };
  }

  /**
   * Fetch 1-minute source data optimized for multi-timeframe aggregation
   */
  private async fetchSourceDataForTimeframes(
    token: string,
    timeRange: { fromTimestamp: number; toTimestamp: number; hoursNeeded: number },
    requestId: string
  ): Promise<ChartDataResponse> {
    const cacheKey = `source:1m:${token}:${timeRange.fromTimestamp}:${timeRange.toTimestamp}`;
    
    this.logger.debug('Fetching 1-minute source data for aggregation', {
      token,
      timeRange: `${timeRange.hoursNeeded}h`,
      from: new Date(timeRange.fromTimestamp * 1000).toISOString(),
      to: new Date(timeRange.toTimestamp * 1000).toISOString(),
      requestId,
    });

    try {
      // Use longer cache TTL for source data since it's expensive to fetch
      const sourceDataCacheKey = `${cacheKey}:source`;
      const cached = this.cache.get<ChartDataResponse>(sourceDataCacheKey);
      if (cached) {
        this.logger.debug('Using cached 1-minute source data', {
          token,
          dataPoints: cached.count,
          requestId,
        });
        return cached;
      }

      // Fetch fresh 1-minute data
      const sourceData = await this.getChartData({
        token,
        interval: '1m',
        from: timeRange.fromTimestamp,
        to: timeRange.toTimestamp,
        limit: 5000, // Maximum allowed by API
        removeOutliers: true,
      });

      // Cache source data with shorter TTL (2 minutes for 1-minute data)
      this.cache.set(sourceDataCacheKey, sourceData, 2 * 60 * 1000);

      this.logger.debug('Fetched fresh 1-minute source data', {
        token,
        dataPoints: sourceData.count,
        timeSpan: `${((sourceData.to - sourceData.from) / 3600).toFixed(1)}h`,
        requestId,
      });

      return sourceData;

    } catch (error) {
      this.logger.error('Failed to fetch source data for timeframes', {
        token,
        timeRange,
        error: error instanceof Error ? error.message : error,
        requestId,
      });
      throw error;
    }
  }

  /**
   * Get cached multi-timeframe data
   */
  private async getCachedMultiTimeframeData(
    request: MultiTimeframeChartRequest
  ): Promise<Partial<MultiTimeframeChartResponse['timeframes']>> {
    const cachedResults: Partial<MultiTimeframeChartResponse['timeframes']> = {};

    for (const timeframe of request.timeframes) {
      const cached = await this.getCachedTimeframeData(request.token, timeframe);
      if (cached) {
        cachedResults[timeframe] = cached;
      }
    }

    return cachedResults;
  }

  /**
   * Get cached data for a specific timeframe
   */
  private async getCachedTimeframeData(
    token: string,
    timeframe: '5m' | '15m' | '1h' | '4h'
  ): Promise<ChartDataResponse | null> {
    const cacheKey = `chart:multi:${token}:${timeframe}`;
    return this.cache.get<ChartDataResponse>(cacheKey) || null;
  }

  /**
   * Cache timeframe data with appropriate TTL
   */
  private async cacheTimeframeData(
    token: string,
    timeframe: '5m' | '15m' | '1h' | '4h',
    data: ChartDataResponse
  ): Promise<void> {
    const cacheKey = `chart:multi:${token}:${timeframe}`;
    const ttl = this.timeframeCacheConfig[timeframe];
    
    this.cache.set(cacheKey, data, ttl);
    
    this.logger.debug('Cached timeframe data', {
      token,
      timeframe,
      ttl: `${Math.round(ttl / 1000)}s`,
      dataPoints: data.count,
    });
  }

  /**
   * Check if direct API call is supported for this timeframe
   * Some timeframes might not be directly supported by the API
   */
  private isDirectApiSupportedForTimeframe(timeframe: string): boolean {
    // Solana Tracker API supports these intervals directly
    const supportedIntervals = ['1s', '5s', '15s', '30s', '1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w', '1mn'];
    return supportedIntervals.includes(timeframe);
  }

  /**
   * Apply staggered delay for rate limiting between multi-timeframe requests
   */
  private async applyStaggeredDelay(index: number, total: number): Promise<void> {
    if (index === 0 || this.chartFetchStrategy.staggerDelayMs <= 0) {
      return; // No delay for first request or if disabled
    }

    const delay = this.chartFetchStrategy.staggerDelayMs * index;
    this.logger.debug('Applying staggered delay', {
      requestIndex: index,
      totalRequests: total,
      delay: `${delay}ms`,
    });

    await this.delay(delay);
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private buildConfig(options: ClientOptions): SolanaTrackerConfig {
    return {
      baseUrl: options.baseUrl || 'https://data.solanatracker.io',
      apiKey: options.apiKey,
      timeout: options.timeout || 45000, // Increased from 30s to 45s for better handling
      rateLimitRps: options.rateLimitRps || 0.5, // Conservative for free tier (1 request per 2 seconds)  
      requestDelayMs: options.requestDelayMs ?? 2500, // Default 2500ms for free tier (slightly below 0.5 RPS)
      maxRetries: options.maxRetries || 4, // Increased from 3 to 4 retries
      retryDelayMs: options.retryDelayMs || 1000,
      circuitBreaker: {
        failureThreshold: 5,
        successThreshold: 3,
        timeout: 60000,
      },
      cache: {
        tokenTtl: 60 * 60 * 1000,      // 1 hour
        priceTtl: 30 * 1000,           // 30 seconds
        chartTtl: 5 * 60 * 1000,       // 5 minutes
      },
    };
  }

  private buildRateLimiterConfig(): RateLimiterConfig {
    return {
      requestsPerSecond: this.config.rateLimitRps,
      burstCapacity: Math.max(2, this.config.rateLimitRps * 2),
      enableCircuitBreaker: true,
      circuitBreaker: this.config.circuitBreaker,
    };
  }

  private buildCacheConfig(): CacheConfig {
    return {
      maxSize: 10000,
      defaultTtl: 5 * 60 * 1000, // 5 minutes
      cleanupInterval: 60 * 1000, // 1 minute
      enableStats: true,
      ttlStrategies: {
        tokenMetadata: this.config.cache.tokenTtl,
        priceData: this.config.cache.priceTtl,
        chartData: this.config.cache.chartTtl,
        riskScores: 30 * 60 * 1000,     // 30 minutes
        trendingTokens: 2 * 60 * 1000,   // 2 minutes
      },
    };
  }

  private createHttpClient(): AxiosInstance {
    const client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'x-api-key': this.config.apiKey,
        'User-Agent': 'Memecoin-Analyzer/1.0.0',
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor
    client.interceptors.request.use(
      (config) => {
        config.metadata = { startTime: performance.now() };
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor
    client.interceptors.response.use(
      (response) => {
        const duration = performance.now() - response.config.metadata.startTime;
        this.recordResponseTime(duration);
        return response;
      },
      (error) => {
        if (error.config?.metadata) {
          const duration = performance.now() - error.config.metadata.startTime;
          this.recordResponseTime(duration);
        }
        return Promise.reject(error);
      }
    );

    return client;
  }

  private async makeRequest<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    config: AxiosRequestConfig = {},
    cacheKey?: string | null,
    useRateLimit = true
  ): Promise<T> {
    if (this.isDestroyed) {
      throw new SolanaTrackerError('Client has been destroyed', 'CLIENT_DESTROYED', 500, false);
    }

    const requestId = this.generateRequestId();
    const startTime = performance.now();

    // Check cache first
    if (cacheKey && method === 'GET') {
      const cached = this.cache.get<T>(cacheKey);
      if (cached) {
        this.logger.debug('Cache hit', { endpoint, cacheKey, requestId });
        return cached;
      }
    }

    // Acquire rate limit permission
    if (useRateLimit) {
      await this.rateLimiter.acquire();
      
      // Apply smart request delay if configured
      await this.applyRequestDelay();
    }

    let lastError: SolanaTrackerError | null = null;
    let retryCount = 0;

    while (retryCount <= this.config.maxRetries) {
      try {
        this.logger.debug('Making API request', { 
          method, 
          endpoint, 
          retryCount, 
          requestId,
          timeout: this.config.timeout,
          rateLimitRps: this.config.rateLimitRps,
          timestamp: new Date().toISOString(),
        });

        const response = await this.httpClient.request({
          method,
          url: endpoint,
          ...config,
        });

        // Record success
        this.rateLimiter.recordResult(true);
        this.updateMetrics(true, performance.now() - startTime, false, retryCount);
        
        // Update last request time for delay tracking
        this.lastRequestTime = Date.now();

        const data = this.parseResponse<T>(response);

        // Cache successful GET requests
        if (cacheKey && method === 'GET' && data) {
          this.cache.set(cacheKey, data);
        }

        this.emit('requestCompleted', {
          method,
          endpoint,
          success: true,
          duration: performance.now() - startTime,
          retryCount,
          requestId,
        });

        return data;

      } catch (error) {
        const apiError = this.handleError(error, requestId);
        lastError = apiError;
        
        this.logger.warn('API request failed', {
          method,
          endpoint,
          error: apiError.message,
          code: apiError.code,
          status: apiError.status,
          retryCount,
          requestId,
        });

        // Record failure for circuit breaker
        this.rateLimiter.recordResult(false, apiError);

        // Check if we should retry
        if (!apiError.retryable || retryCount >= this.config.maxRetries) {
          break;
        }

        retryCount++;

        // Calculate exponential backoff delay with jitter
        const delay = this.rateLimiter.calculateBackoffDelay(apiError, retryCount - 1);
        
        this.logger.debug('Retrying request after delay', { 
          delay, 
          retryCount, 
          maxRetries: this.config.maxRetries,
          requestId 
        });

        await this.delay(delay);
      }
    }

    // All retries exhausted
    this.updateMetrics(false, performance.now() - startTime, false, retryCount);
    
    const totalDuration = performance.now() - startTime;
    this.logger.error('Request failed after all retries', {
      method,
      endpoint,
      totalRetries: retryCount,
      maxRetries: this.config.maxRetries,
      totalDuration: `${totalDuration.toFixed(2)}ms`,
      lastError: lastError?.message,
      errorCode: lastError?.code,
      requestId,
    });
    
    this.emit('requestFailed', {
      method,
      endpoint,
      error: lastError,
      retryCount,
      requestId,
      totalDuration,
    });

    throw lastError || new SolanaTrackerError(
      `Request failed after ${retryCount} retries in ${totalDuration.toFixed(2)}ms`, 
      'MAX_RETRIES_EXCEEDED', 
      500, 
      false,
      false,
      undefined,
      requestId
    );
  }

  private parseResponse<T>(response: AxiosResponse): T {
    // Handle different response formats from Solana Tracker API
    if (response.data?.success !== undefined) {
      // Wrapped response format
      const wrapped = response.data as SolanaTrackerResponse<T>;
      if (!wrapped.success) {
        throw new SolanaTrackerError(
          wrapped.error?.message || 'API returned error',
          wrapped.error?.code || 'API_ERROR',
          response.status,
          false
        );
      }
      return wrapped.data;
    }

    // Direct data format
    return response.data as T;
  }

  private handleError(error: any, requestId?: string): SolanaTrackerError {
    // Enhanced error logging for debugging
    this.logger.debug('Processing error in handleError', {
      errorType: error.constructor.name,
      errorCode: error.code,
      errorMessage: error.message,
      hasResponse: !!error.response,
      responseStatus: error.response?.status,
      responseData: error.response?.data,
      requestId,
    });

    if (error.response) {
      // HTTP error response
      const solanaError = SolanaTrackerError.fromResponse(error.response, requestId);
      
      this.logger.warn('HTTP error response received', {
        status: error.response.status,
        statusText: error.response.statusText,
        errorCode: solanaError.code,
        retryable: solanaError.retryable,
        rateLimited: solanaError.rateLimited,
        retryAfter: solanaError.retryAfter,
        requestId,
      });
      
      return solanaError;
    }

    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      this.logger.warn('Request timeout occurred', {
        errorCode: error.code,
        timeout: this.config.timeout,
        requestId,
      });
      
      return new SolanaTrackerError(
        `Request timeout after ${this.config.timeout}ms`,
        'TIMEOUT',
        408,
        true,
        false,
        undefined,
        requestId
      );
    }

    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      this.logger.error('Network connectivity error', {
        errorCode: error.code,
        baseUrl: this.config.baseUrl,
        requestId,
      });
      
      return new SolanaTrackerError(
        'Network error - unable to connect to API',
        'NETWORK_ERROR',
        503,
        true,
        false,
        undefined,
        requestId
      );
    }

    if (error.code === 'ENOTFOUND') {
      this.logger.error('DNS resolution failed', {
        errorCode: error.code,
        hostname: error.hostname,
        requestId,
      });
      
      return new SolanaTrackerError(
        `DNS resolution failed for ${error.hostname}`,
        'DNS_ERROR',
        503,
        true,
        false,
        undefined,
        requestId
      );
    }

    // Log unknown errors with full details
    this.logger.error('Unknown error occurred', {
      errorType: error.constructor.name,
      errorCode: error.code,
      errorMessage: error.message,
      errorStack: error.stack,
      requestId,
    });

    // Unknown error
    return new SolanaTrackerError(
      error.message || 'Unknown error occurred',
      'UNKNOWN_ERROR',
      500,
      false,
      false,
      undefined,
      requestId,
      error
    );
  }

  private applyAdditionalFilters(
    tokens: SolanaToken[],
    marketCapFilter: MarketCapFilter,
    options?: {
      minVolume?: number;
      maxRiskLevel?: 'low' | 'medium' | 'high';
    }
  ): FilteredTokensResponse {
    let filtered = tokens;
    let filteredByMarketCap = 0;
    let filteredByVolume = 0;
    let filteredByRisk = 0;

    // Apply market cap filter (should already be applied by API, but double-check)
    const beforeMarketCap = filtered.length;
    filtered = filtered.filter(token => 
      token.marketCap >= marketCapFilter.min && token.marketCap <= marketCapFilter.max
    );
    filteredByMarketCap = beforeMarketCap - filtered.length;

    // Apply volume filter
    if (options?.minVolume) {
      const beforeVolume = filtered.length;
      filtered = filtered.filter(token => (token.volume24h || 0) >= options.minVolume!);
      filteredByVolume = beforeVolume - filtered.length;
    }

    // Apply risk level filter
    if (options?.maxRiskLevel) {
      const beforeRisk = filtered.length;
      const maxRiskLevels = ['low', 'medium', 'high'];
      const maxIndex = maxRiskLevels.indexOf(options.maxRiskLevel);
      
      filtered = filtered.filter(token => {
        if (!token.riskLevel) return true; // Include tokens without risk assessment
        const tokenRiskIndex = maxRiskLevels.indexOf(token.riskLevel);
        return tokenRiskIndex <= maxIndex;
      });
      filteredByRisk = beforeRisk - filtered.length;
    }

    return {
      tokens: filtered,
      filtered: {
        total: tokens.length - filtered.length,
        byMarketCap: filteredByMarketCap,
        byVolume: filteredByVolume,
        byRisk: filteredByRisk,
      },
      criteria: {
        marketCapRange: marketCapFilter,
        minVolume: options?.minVolume,
        maxRiskLevel: options?.maxRiskLevel,
      },
    };
  }

  private updateMetrics(
    success: boolean, 
    responseTime: number, 
    cached: boolean, 
    retryCount: number
  ): void {
    this.metrics.requests.total++;
    
    if (success) {
      this.metrics.requests.successful++;
    } else {
      this.metrics.requests.failed++;
    }

    if (retryCount > 0) {
      this.metrics.requests.rateLimited++;
    }

    if (!cached) {
      this.recordResponseTime(responseTime);
    }

    this.metrics.lastUpdated = new Date().toISOString();
  }

  private recordResponseTime(time: number): void {
    this.responseTimes.push(time);
    
    // Keep only last 1000 response times for performance calculations
    if (this.responseTimes.length > 1000) {
      this.responseTimes = this.responseTimes.slice(-1000);
    }

    // Update performance metrics
    const sorted = [...this.responseTimes].sort((a, b) => a - b);
    const len = sorted.length;
    
    this.metrics.performance.averageResponseTime = 
      this.responseTimes.reduce((a, b) => a + b, 0) / len;
    
    this.metrics.performance.p95ResponseTime = 
      sorted[Math.floor(len * 0.95)] || 0;
    
    this.metrics.performance.p99ResponseTime = 
      sorted[Math.floor(len * 0.99)] || 0;
  }

  private setupEventListeners(): void {
    // Forward rate limiter events
    this.rateLimiter.on('circuitBreakerStateChange', (state) => {
      this.emit('circuitBreakerStateChange', state);
      this.logger.info('Circuit breaker state changed', { state });
    });

    // Forward cache events
    this.cache.on('cacheHit', ({ key }) => {
      this.emit('cacheHit', { key });
    });

    this.cache.on('cacheMiss', ({ key }) => {
      this.emit('cacheMiss', { key });
    });
  }

  private startMetricsCollection(): void {
    setInterval(() => {
      if (!this.isDestroyed) {
        this.metrics.cache = this.cache.getStats();
        const rateLimiterStats = this.rateLimiter.getStats();
        this.metrics.circuitBreaker = {
          state: rateLimiterStats.circuitState,
          failureRate: rateLimiterStats.failureRate,
          requestsInWindow: rateLimiterStats.requestsInWindow,
        };
      }
    }, 10000); // Update every 10 seconds
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Apply smart request delay to respect rate limits
   * Only delays if the configured delay hasn't already passed since last request
   */
  private async applyRequestDelay(): Promise<void> {
    // Skip delay if not configured (0 means no delay for paid plans)
    if (this.config.requestDelayMs === 0) {
      return;
    }

    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const remainingDelay = this.config.requestDelayMs - timeSinceLastRequest;

    // Only delay if we haven't waited long enough since the last request
    if (remainingDelay > 0 && this.lastRequestTime > 0) {
      this.logger.debug('Applying request delay', {
        configuredDelay: this.config.requestDelayMs,
        timeSinceLastRequest,
        remainingDelay,
      });
      
      await this.delay(remainingDelay);
    }
  }

  /**
   * Calculate extended time range when insufficient data is received
   */
  private calculateExtendedTimeRange(interval: string, minDataPoints: number): number {
    const intervalMinutes = this.parseIntervalToMinutes(interval);
    const hoursNeeded = Math.ceil((minDataPoints * intervalMinutes) / 60);
    
    // Multiply by 2 to ensure we get enough data, max 7 days
    return Math.min(hoursNeeded * 2, 168);
  }

  /**
   * Get fallback interval when current interval doesn't provide enough data
   */
  private getFallbackInterval(currentInterval: string): string | null {
    const fallbackMap: Record<string, string> = {
      '15m': '5m',
      '1h': '15m',
      '4h': '1h',
      '1d': '4h',
    };
    
    return fallbackMap[currentInterval] || null;
  }

  /**
   * Calculate time range for a given interval to get minimum data points
   */
  private calculateTimeRangeForInterval(interval: string, minDataPoints: number): { from: number; to: number } {
    const intervalMinutes = this.parseIntervalToMinutes(interval);
    const now = Math.floor(Date.now() / 1000);
    const hoursNeeded = Math.ceil((minDataPoints * intervalMinutes) / 60);
    
    return {
      from: now - (hoursNeeded * 3600),
      to: now,
    };
  }

  /**
   * Parse interval string to minutes
   */
  private parseIntervalToMinutes(interval: string): number {
    const intervalMap: Record<string, number> = {
      '1s': 1/60,
      '5s': 5/60,
      '15s': 15/60,
      '30s': 30/60,
      '1m': 1,
      '5m': 5,
      '15m': 15,
      '30m': 30,
      '1h': 60,
      '4h': 240,
      '1d': 1440,
      '1w': 10080,
    };
    
    return intervalMap[interval] || 60; // Default to 1 hour
  }

  // ============================================================================
  // Response Transformers (Raw API -> Normalized Types)
  // ============================================================================

  /**
   * Transform raw trending tokens response to normalized format
   */
  private transformTrendingTokensResponse(
    rawResponse: TrendingTokensResponse,
    timeframe: string
  ): ProcessedTrendingTokensResponse {
    const tokens = rawResponse.map(tokenResponse => 
      this.transformTokenResponse(tokenResponse)
    );

    return {
      tokens,
      timeframe,
      total: tokens.length,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Transform raw token details response to normalized format
   */
  private transformTokenDetailsResponse(rawResponse: SolanaTrackerTokenResponse): TokenDetails {
    return {
      token: this.transformTokenResponse(rawResponse),
      pools: rawResponse.pools,
      events: rawResponse.events,
      risk: rawResponse.risk,
      totalLiquidity: rawResponse.pools.reduce(
        (total, pool) => total + pool.liquidity.usd, 
        0
      ),
    };
  }

  /**
   * Transform raw chart data response to normalized format
   */
  private transformChartDataResponse(
    rawResponse: SolanaTrackerChartResponse,
    request: ChartDataRequest
  ): ChartDataResponse {
    const data: OHLCV[] = rawResponse.oclhv.map(item => ({
      timestamp: item.time,
      open: item.open,
      high: item.high,
      low: item.low,
      close: item.close,
      volume: item.volume,
    }));

    const timestamps = data.map(d => d.timestamp);
    const from = Math.min(...timestamps);
    const to = Math.max(...timestamps);

    return {
      token: request.token,
      interval: request.interval || '1m',
      data,
      from,
      to,
      count: data.length,
      _raw: rawResponse,
    };
  }

  /**
   * Transform raw token response to normalized SolanaToken
   */
  private transformTokenResponse(rawResponse: SolanaTrackerTokenResponse): SolanaToken {
    const { token, pools, events, risk } = rawResponse;
    const primaryPool = pools[0]; // Use first pool as primary data source

    // Calculate risk level from score
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' | undefined;
    if (risk?.score !== undefined) {
      if (risk.score >= 80) riskLevel = 'low';
      else if (risk.score >= 60) riskLevel = 'medium';
      else if (risk.score >= 30) riskLevel = 'high';
      else riskLevel = 'critical';
    }

    return {
      // Basic Info
      address: token.mint,
      symbol: token.symbol,
      name: token.name,
      decimals: token.decimals,
      image: token.image,
      description: token.description,
      
      // Market Data (from primary pool)
      price: primaryPool?.price?.usd || 0,
      marketCap: primaryPool?.marketCap?.usd || 0,
      volume24h: primaryPool?.txns?.volume24h,
      
      // Price Changes (from events)
      priceChange1h: events?.['1h']?.priceChangePercentage,
      priceChange24h: events?.['24h']?.priceChangePercentage,
      
      // Supply Info
      totalSupply: primaryPool?.tokenSupply,
      
      // Risk Assessment
      riskScore: risk?.score,
      riskLevel,
      rugged: risk?.rugged,
      
      // Trading Activity
      buys: rawResponse.buys,
      sells: rawResponse.sells,
      holders: rawResponse.holders,
      
      // Metadata
      createdAt: token.creation?.created_time 
        ? new Date(token.creation.created_time * 1000).toISOString()
        : undefined,
      verified: risk?.jupiterVerified,
      
      // Raw data access
      _raw: rawResponse,
    };
  }
}