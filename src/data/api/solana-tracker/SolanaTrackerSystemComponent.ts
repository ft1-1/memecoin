/**
 * System Component wrapper for Solana Tracker API client
 * 
 * This wrapper implements the SystemComponent interface required by the orchestrator,
 * providing proper lifecycle management, health monitoring, and error handling
 * for the Solana Tracker API client.
 */

import { Logger } from 'winston';
import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import { SolanaTrackerClient } from './SolanaTrackerClient';
import { SystemComponent, ComponentHealth } from '@/orchestrator/SystemOrchestrator';
import { ApiConfig } from '@/types/config';
import { ClientOptions } from './types';

export interface SolanaTrackerComponentConfig {
  apiConfig: ApiConfig['solanaTracker'];
  clientOptions?: Partial<ClientOptions>;
  healthCheckInterval?: number;
  name?: string;
}

/**
 * System component wrapper for the Solana Tracker API client
 */
export class SolanaTrackerSystemComponent extends EventEmitter implements SystemComponent {
  public readonly name: string;
  private readonly logger: Logger;
  private readonly config: SolanaTrackerComponentConfig;
  private client: SolanaTrackerClient | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private isInitialized = false;
  private isStarted = false;
  private isDestroyed = false;

  constructor(config: SolanaTrackerComponentConfig, logger: Logger) {
    super();
    
    this.name = config.name || 'SolanaTrackerClient';
    this.logger = logger.child({ component: this.name });
    this.config = config;

    this.logger.debug('Solana Tracker system component created', {
      name: this.name,
      baseUrl: config.apiConfig.baseUrl,
      rateLimitRps: config.apiConfig.rateLimitRps,
    });
  }

  /**
   * Initialize the component and create the client
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      this.logger.warn('Component already initialized');
      return;
    }

    if (this.isDestroyed) {
      throw new Error('Cannot initialize destroyed component');
    }

    this.logger.info('Initializing Solana Tracker API client');

    try {
      // Validate configuration
      this.validateConfiguration();

      // Create client options
      const clientOptions: ClientOptions = {
        apiKey: this.config.apiConfig.apiKey,
        baseUrl: this.config.apiConfig.baseUrl,
        timeout: this.config.apiConfig.timeout || 30000,
        rateLimitRps: this.config.apiConfig.rateLimitRps || 1,
        requestDelayMs: this.config.apiConfig.requestDelayMs ?? 1000, // Default 1000ms for free tier
        maxRetries: this.config.apiConfig.maxRetries || 3,
        retryDelayMs: this.config.apiConfig.retryDelayMs || 1000,
        enableCircuitBreaker: true,
        enableCache: true,
        enableMetrics: true,
        logger: this.logger,
        ...this.config.clientOptions,
      };

      // Create the client instance
      this.client = new SolanaTrackerClient(clientOptions, this.logger);

      // Set up event forwarding
      this.setupEventForwarding();

      this.isInitialized = true;
      this.logger.info('Solana Tracker API client initialized successfully');

    } catch (error) {
      this.logger.error('Failed to initialize Solana Tracker API client', { error });
      throw error;
    }
  }

  /**
   * Start the component (begin health monitoring)
   */
  async start(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Component must be initialized before starting');
    }

    if (this.isStarted) {
      this.logger.warn('Component already started');
      return;
    }

    if (this.isDestroyed) {
      throw new Error('Cannot start destroyed component');
    }

    this.logger.info('Starting Solana Tracker API client');

    try {
      // Perform initial health check
      const health = await this.performHealthCheck();
      if (!health.healthy) {
        this.logger.warn('Initial health check failed but continuing startup', {
          status: health.status,
          message: health.message,
        });
      }

      // Start periodic health monitoring
      this.startHealthMonitoring();

      this.isStarted = true;
      this.logger.info('Solana Tracker API client started successfully');
      this.emit('started');

    } catch (error) {
      this.logger.error('Failed to start Solana Tracker API client', { error });
      throw error;
    }
  }

  /**
   * Stop the component
   */
  async stop(): Promise<void> {
    if (!this.isStarted) {
      this.logger.debug('Component not started, nothing to stop');
      return;
    }

    if (this.isDestroyed) {
      this.logger.debug('Component already destroyed');
      return;
    }

    this.logger.info('Stopping Solana Tracker API client');

    try {
      // Stop health monitoring
      this.stopHealthMonitoring();

      this.isStarted = false;
      this.logger.info('Solana Tracker API client stopped successfully');
      this.emit('stopped');

    } catch (error) {
      this.logger.error('Error stopping Solana Tracker API client', { error });
      throw error;
    }
  }

  /**
   * Get component health status
   */
  async getHealth(): Promise<ComponentHealth> {
    if (this.isDestroyed) {
      return {
        status: 'unhealthy',
        message: 'Component has been destroyed',
        metadata: { destroyed: true },
      };
    }

    if (!this.isInitialized || !this.client) {
      return {
        status: 'unhealthy',
        message: 'Component not initialized',
        metadata: { initialized: this.isInitialized },
      };
    }

    return this.performHealthCheck();
  }

  /**
   * Destroy the component and cleanup resources
   */
  async destroy(): Promise<void> {
    if (this.isDestroyed) {
      this.logger.debug('Component already destroyed');
      return;
    }

    this.logger.info('Destroying Solana Tracker API client');

    try {
      // Stop if running
      if (this.isStarted) {
        await this.stop();
      }

      // Stop health monitoring
      this.stopHealthMonitoring();

      // Destroy the client
      if (this.client) {
        this.client.destroy();
        this.client = null;
      }

      // Remove all listeners
      this.removeAllListeners();

      this.isDestroyed = true;
      this.isInitialized = false;
      this.isStarted = false;

      this.logger.info('Solana Tracker API client destroyed successfully');

    } catch (error) {
      this.logger.error('Error destroying Solana Tracker API client', { error });
      throw error;
    }
  }


  /**
   * Get client metrics
   */
  getMetrics(): any {
    if (!this.client) {
      return null;
    }
    return this.client.getMetrics();
  }

  /**
   * Reset client metrics
   */
  resetMetrics(): void {
    if (this.client) {
      this.client.resetMetrics();
    }
  }

  // ============================================================================
  // Public API Methods (Wrapper for client methods)
  // ============================================================================

  /**
   * Check if the component is ready for use
   */
  public isReady(): boolean {
    return this.isInitialized && this.isStarted && !!this.client && !this.isDestroyed;
  }

  /**
   * Get the underlying client instance
   */
  public getClient(): SolanaTrackerClient {
    if (!this.client) {
      throw new Error('Client not initialized - call initialize() first');
    }
    return this.client;
  }

  /**
   * Get trending tokens filtered by market cap range
   */
  public async getTrendingTokensFiltered(
    timeframe: string,
    marketCapFilter: { min: number; max: number },
    options?: {
      minVolume?: number;
      maxRiskLevel?: 'low' | 'medium' | 'high';
      limit?: number;
    }
  ) {
    if (!this.isReady()) {
      throw new Error('Component not ready - ensure it is initialized and started');
    }

    return this.client!.getTrendingTokensFiltered(
      timeframe as any,
      marketCapFilter,
      options
    );
  }

  /**
   * Get chart data for a token (wrapper for convenience)
   */
  public async getChart(
    tokenAddress: string,
    options: {
      type: string;
      time_from: number;
      time_to: number;
      limit?: number;
    }
  ) {
    if (!this.isReady()) {
      throw new Error('Component not ready - ensure it is initialized and started');
    }

    // Convert to the format expected by getChartData
    const request = {
      token: tokenAddress,
      interval: options.type,
      from: options.time_from,
      to: options.time_to,
      limit: options.limit
    };

    return this.client!.getChartData(request);
  }

  /**
   * Get token details
   */
  public async getTokenDetails(address: string) {
    if (!this.isReady()) {
      throw new Error('Component not ready - ensure it is initialized and started');
    }

    return this.client!.getTokenDetails(address);
  }

  /**
   * Get prices for multiple tokens
   */
  public async getPricesMulti(request: { addresses: string[] }) {
    if (!this.isReady()) {
      throw new Error('Component not ready - ensure it is initialized and started');
    }

    return this.client!.getPricesMulti(request);
  }

  /**
   * Get multi-timeframe chart data for comprehensive technical analysis
   */
  public async getMultiTimeframeChart(request: {
    token: string;
    timeframes: ('5m' | '15m' | '1h' | '4h')[];
    enableCaching?: boolean;
    maxRetries?: number;
  }) {
    if (!this.isReady()) {
      throw new Error('Component not ready - ensure it is initialized and started');
    }

    const startTime = performance.now();
    
    this.logger.info('Multi-timeframe chart request initiated', {
      token: request.token,
      timeframes: request.timeframes,
      enableCaching: request.enableCaching !== false,
      component: this.name,
    });

    try {
      const result = await this.client!.getMultiTimeframeChart(request);
      
      const duration = performance.now() - startTime;
      this.logger.info('Multi-timeframe chart request completed', {
        token: request.token,
        requestedTimeframes: request.timeframes.length,
        processedTimeframes: Object.keys(result.timeframes).length,
        sourceDataPoints: result.sourceDataUsed.dataPoints,
        duration: `${duration.toFixed(2)}ms`,
        errors: result.errors?.length || 0,
        warnings: result.warnings?.length || 0,
        component: this.name,
      });

      // Emit metrics for monitoring
      this.emit('multiTimeframeCompleted', {
        token: request.token,
        timeframes: request.timeframes,
        success: (result.errors?.length || 0) === 0,
        duration,
        dataPoints: result.sourceDataUsed.dataPoints,
      });

      return result;

    } catch (error) {
      const duration = performance.now() - startTime;
      this.logger.error('Multi-timeframe chart request failed', {
        token: request.token,
        timeframes: request.timeframes,
        error: error instanceof Error ? error.message : error,
        duration: `${duration.toFixed(2)}ms`,
        component: this.name,
      });

      // Emit error metrics
      this.emit('multiTimeframeFailed', {
        token: request.token,
        timeframes: request.timeframes,
        error: error instanceof Error ? error.message : error,
        duration,
      });

      throw error;
    }
  }

  /**
   * Get optimized chart data with intelligent caching and fallback strategies
   */
  public async getChartDataOptimized(
    token: string,
    timeframe: '5m' | '15m' | '1h' | '4h',
    options?: {
      maxRetries?: number;
      enableCaching?: boolean;
      fallbackToAggregation?: boolean;
    }
  ) {
    if (!this.isReady()) {
      throw new Error('Component not ready - ensure it is initialized and started');
    }

    const startTime = performance.now();
    
    this.logger.debug('Optimized chart data request initiated', {
      token,
      timeframe,
      options,
      component: this.name,
    });

    try {
      const result = await this.client!.getChartDataOptimized(token, timeframe, options);
      
      const duration = performance.now() - startTime;
      this.logger.debug('Optimized chart data request completed', {
        token,
        timeframe,
        dataPoints: result.count,
        duration: `${duration.toFixed(2)}ms`,
        component: this.name,
      });

      // Emit metrics for monitoring
      this.emit('optimizedChartCompleted', {
        token,
        timeframe,
        success: true,
        duration,
        dataPoints: result.count,
      });

      return result;

    } catch (error) {
      const duration = performance.now() - startTime;
      this.logger.error('Optimized chart data request failed', {
        token,
        timeframe,
        error: error instanceof Error ? error.message : error,
        duration: `${duration.toFixed(2)}ms`,
        component: this.name,
      });

      // Emit error metrics
      this.emit('optimizedChartFailed', {
        token,
        timeframe,
        error: error instanceof Error ? error.message : error,
        duration,
      });

      throw error;
    }
  }

  /**
   * Batch fetch multi-timeframe data for multiple tokens (optimized for analysis workflows)
   */
  public async batchGetMultiTimeframeChart(
    tokens: string[],
    timeframes: ('5m' | '15m' | '1h' | '4h')[],
    options?: {
      enableCaching?: boolean;
      maxConcurrent?: number;
      enableStaggering?: boolean;
      staggerDelayMs?: number;
    }
  ) {
    if (!this.isReady()) {
      throw new Error('Component not ready - ensure it is initialized and started');
    }

    const startTime = performance.now();
    const maxConcurrent = options?.maxConcurrent || 3;
    const enableStaggering = options?.enableStaggering !== false;
    const staggerDelayMs = options?.staggerDelayMs || 200;
    
    this.logger.info('Batch multi-timeframe chart request initiated', {
      tokens: tokens.length,
      timeframes,
      maxConcurrent,
      enableStaggering,
      component: this.name,
    });

    const results: Record<string, any> = {};
    const errors: Record<string, Error> = {};
    let completed = 0;

    // Process tokens in batches to respect rate limits
    for (let i = 0; i < tokens.length; i += maxConcurrent) {
      const batch = tokens.slice(i, i + maxConcurrent);
      
      // Apply staggering between batches
      if (enableStaggering && i > 0) {
        await this.delay(staggerDelayMs);
      }

      const batchPromises = batch.map(async (token, index) => {
        try {
          // Apply staggering within batch
          if (enableStaggering && index > 0) {
            await this.delay(staggerDelayMs * index);
          }

          const result = await this.getMultiTimeframeChart({
            token,
            timeframes,
            enableCaching: options?.enableCaching,
          });

          results[token] = result;
          completed++;

          this.logger.debug('Token multi-timeframe data fetched', {
            token,
            timeframes: Object.keys(result.timeframes).length,
            sourceDataPoints: result.sourceDataUsed.dataPoints,
            component: this.name,
          });

        } catch (error) {
          errors[token] = error instanceof Error ? error : new Error(String(error));
          this.logger.warn('Token multi-timeframe data fetch failed', {
            token,
            error: error instanceof Error ? error.message : error,
            component: this.name,
          });
        }
      });

      await Promise.all(batchPromises);
    }

    const duration = performance.now() - startTime;
    const successRate = (completed / tokens.length) * 100;

    this.logger.info('Batch multi-timeframe chart request completed', {
      totalTokens: tokens.length,
      successful: completed,
      failed: Object.keys(errors).length,
      successRate: `${successRate.toFixed(1)}%`,
      duration: `${duration.toFixed(2)}ms`,
      avgTimePerToken: `${(duration / tokens.length).toFixed(2)}ms`,
      component: this.name,
    });

    // Emit batch completion metrics
    this.emit('batchMultiTimeframeCompleted', {
      totalTokens: tokens.length,
      successful: completed,
      failed: Object.keys(errors).length,
      successRate,
      duration,
      timeframes,
    });

    return {
      results,
      errors,
      summary: {
        totalTokens: tokens.length,
        successful: completed,
        failed: Object.keys(errors).length,
        successRate,
        duration,
        avgTimePerToken: duration / tokens.length,
      },
    };
  }

  /**
   * Utility method to delay execution (for rate limiting)
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private validateConfiguration(): void {
    const { apiConfig } = this.config;

    if (!apiConfig.apiKey || typeof apiConfig.apiKey !== 'string') {
      throw new Error('API key is required and must be a string');
    }

    if (!apiConfig.baseUrl || typeof apiConfig.baseUrl !== 'string') {
      throw new Error('Base URL is required and must be a string');
    }

    if (!apiConfig.baseUrl.startsWith('http')) {
      throw new Error('Base URL must be a valid HTTP/HTTPS URL');
    }

    if (apiConfig.rateLimitRps && (apiConfig.rateLimitRps < 0 || apiConfig.rateLimitRps > 1000)) {
      throw new Error('Rate limit RPS must be between 0 and 1000');
    }

    this.logger.debug('Configuration validated successfully');
  }

  private setupEventForwarding(): void {
    if (!this.client) return;

    // Forward important client events
    this.client.on('circuitBreakerStateChange', (state) => {
      this.logger.info('Circuit breaker state changed', { state });
      this.emit('circuitBreakerStateChange', state);
    });

    this.client.on('requestFailed', (details) => {
      this.logger.warn('API request failed', {
        method: details.method,
        endpoint: details.endpoint,
        error: details.error?.message,
        retryCount: details.retryCount,
      });
      this.emit('requestFailed', details);
    });

    this.client.on('requestCompleted', (details) => {
      this.logger.debug('API request completed', {
        method: details.method,
        endpoint: details.endpoint,
        success: details.success,
        duration: Math.round(details.duration),
        retryCount: details.retryCount,
      });
      this.emit('requestCompleted', details);
    });

    // Forward cache events
    this.client.on('cacheHit', ({ key }) => {
      this.emit('cacheHit', { key });
    });

    this.client.on('cacheMiss', ({ key }) => {
      this.emit('cacheMiss', { key });
    });
  }

  private async performHealthCheck(): Promise<ComponentHealth> {
    const startTime = Date.now();

    try {
      if (!this.client) {
        return {
          status: 'unhealthy',
          message: 'Client not available',
          responseTime: 0,
          metadata: { clientAvailable: false },
        };
      }

      const health = await this.client.healthCheck();
      const responseTime = Date.now() - startTime;

      return {
        status: health.healthy ? 'healthy' : 'degraded',
        message: health.healthy ? 'All systems operational' : 'Some issues detected',
        responseTime,
        metadata: {
          clientHealth: health,
          metrics: this.client.getMetrics(),
          initialized: this.isInitialized,
          started: this.isStarted,
        },
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.logger.error('Health check failed', { error });

      return {
        status: 'unhealthy',
        message: `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        responseTime,
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error',
          initialized: this.isInitialized,
          started: this.isStarted,
        },
      };
    }
  }

  private startHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      return; // Already monitoring
    }

    const interval = this.config.healthCheckInterval || 30000; // 30 seconds default
    
    this.healthCheckInterval = setInterval(async () => {
      try {
        const health = await this.performHealthCheck();
        
        if (health.status === 'unhealthy') {
          this.logger.warn('Health check detected issues', {
            status: health.status,
            message: health.message,
            responseTime: health.responseTime,
          });
          this.emit('healthDegraded', health);
        }
      } catch (error) {
        this.logger.error('Health monitoring error', { error });
      }
    }, interval);

    this.logger.debug('Health monitoring started', { interval });
  }

  private stopHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      this.logger.debug('Health monitoring stopped');
    }
  }
}

/**
 * Factory function to create a Solana Tracker system component
 */
export function createSolanaTrackerSystemComponent(
  config: SolanaTrackerComponentConfig,
  logger: Logger
): SolanaTrackerSystemComponent {
  return new SolanaTrackerSystemComponent(config, logger);
}

/**
 * Factory function optimized for memecoin analysis
 */
export function createMemecoinAnalyzerSystemComponent(
  apiConfig: ApiConfig['solanaTracker'],
  logger: Logger
): SolanaTrackerSystemComponent {
  const config: SolanaTrackerComponentConfig = {
    apiConfig,
    clientOptions: {
      rateLimitRps: Math.min(apiConfig.rateLimitRps, 1), // Conservative
      requestDelayMs: apiConfig.requestDelayMs, // Pass through the configured delay
      maxRetries: 2, // Faster response
      retryDelayMs: 500,
    },
    healthCheckInterval: 30000, // 30 seconds
    name: 'MemecoinAnalyzerClient',
  };

  return new SolanaTrackerSystemComponent(config, logger);
}