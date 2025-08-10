/**
 * Factory for creating and managing Solana Tracker API client instances
 * Provides dependency injection and configuration management
 */

import { Logger } from 'winston';
import { SolanaTrackerClient } from './SolanaTrackerClient';
import { ClientOptions } from './types';
import { ApiConfig } from '@/types/config';

export interface ClientFactoryConfig {
  defaultTimeout?: number;
  defaultRetries?: number;
  enableMetrics?: boolean;
  enableCircuitBreaker?: boolean;
  enableCache?: boolean;
}

/**
 * Factory for creating configured Solana Tracker clients
 */
export class SolanaTrackerClientFactory {
  private readonly logger: Logger;
  private readonly factoryConfig: ClientFactoryConfig;
  private clientInstances = new Map<string, SolanaTrackerClient>();

  constructor(logger: Logger, config: ClientFactoryConfig = {}) {
    this.logger = logger;
    this.factoryConfig = {
      defaultTimeout: 30000,
      defaultRetries: 3,
      enableMetrics: true,
      enableCircuitBreaker: true,
      enableCache: true,
      ...config,
    };

    this.logger.debug('Solana Tracker client factory initialized', {
      config: this.factoryConfig,
    });
  }

  /**
   * Create a new client instance with the provided configuration
   */
  public createClient(
    apiConfig: ApiConfig['solanaTracker'],
    instanceName = 'default'
  ): SolanaTrackerClient {
    // Check if instance already exists
    if (this.clientInstances.has(instanceName)) {
      this.logger.warn(`Client instance '${instanceName}' already exists, returning existing instance`);
      return this.clientInstances.get(instanceName)!;
    }

    const clientOptions: ClientOptions = {
      apiKey: apiConfig.apiKey,
      baseUrl: apiConfig.baseUrl,
      timeout: apiConfig.timeout || this.factoryConfig.defaultTimeout,
      rateLimitRps: apiConfig.rateLimitRps,
      maxRetries: apiConfig.maxRetries || this.factoryConfig.defaultRetries,
      retryDelayMs: apiConfig.retryDelayMs,
      enableCircuitBreaker: this.factoryConfig.enableCircuitBreaker,
      enableCache: this.factoryConfig.enableCache,
      enableMetrics: this.factoryConfig.enableMetrics,
      logger: this.logger,
    };

    this.logger.info('Creating new Solana Tracker client', {
      instanceName,
      baseUrl: clientOptions.baseUrl,
      rateLimitRps: clientOptions.rateLimitRps,
      circuitBreaker: clientOptions.enableCircuitBreaker,
      cache: clientOptions.enableCache,
    });

    const client = new SolanaTrackerClient(clientOptions, this.logger);
    
    // Store instance for management
    this.clientInstances.set(instanceName, client);

    // Set up client event forwarding
    this.setupClientEventForwarding(client, instanceName);

    return client;
  }

  /**
   * Get an existing client instance
   */
  public getClient(instanceName = 'default'): SolanaTrackerClient | null {
    return this.clientInstances.get(instanceName) || null;
  }

  /**
   * Get or create a client instance
   */
  public getOrCreateClient(
    apiConfig: ApiConfig['solanaTracker'],
    instanceName = 'default'
  ): SolanaTrackerClient {
    const existing = this.getClient(instanceName);
    if (existing) {
      return existing;
    }

    return this.createClient(apiConfig, instanceName);
  }

  /**
   * Remove and destroy a client instance
   */
  public destroyClient(instanceName = 'default'): boolean {
    const client = this.clientInstances.get(instanceName);
    if (!client) {
      return false;
    }

    this.logger.info('Destroying client instance', { instanceName });
    
    client.destroy();
    this.clientInstances.delete(instanceName);
    
    return true;
  }

  /**
   * Get health status of all client instances
   */
  public async getHealthStatus(): Promise<{
    healthy: boolean;
    instances: Record<string, {
      healthy: boolean;
      details: any;
    }>;
  }> {
    const instances: Record<string, { healthy: boolean; details: any }> = {};
    let overallHealthy = true;

    for (const [name, client] of this.clientInstances.entries()) {
      try {
        const health = await client.healthCheck();
        instances[name] = health;
        if (!health.healthy) {
          overallHealthy = false;
        }
      } catch (error) {
        instances[name] = {
          healthy: false,
          details: { error: error instanceof Error ? error.message : 'Unknown error' },
        };
        overallHealthy = false;
      }
    }

    return {
      healthy: overallHealthy,
      instances,
    };
  }

  /**
   * Get metrics from all client instances
   */
  public getMetrics(): Record<string, any> {
    const metrics: Record<string, any> = {};

    for (const [name, client] of this.clientInstances.entries()) {
      metrics[name] = client.getMetrics();
    }

    return metrics;
  }

  /**
   * Reset metrics for all client instances
   */
  public resetMetrics(): void {
    for (const client of this.clientInstances.values()) {
      client.resetMetrics();
    }
    
    this.logger.info('Reset metrics for all client instances');
  }

  /**
   * Get list of active client instances
   */
  public getActiveInstances(): string[] {
    return Array.from(this.clientInstances.keys());
  }

  /**
   * Destroy all client instances
   */
  public destroyAll(): void {
    const instanceNames = Array.from(this.clientInstances.keys());
    
    this.logger.info('Destroying all client instances', { 
      count: instanceNames.length,
      instances: instanceNames,
    });

    for (const name of instanceNames) {
      this.destroyClient(name);
    }
  }

  /**
   * Create a client with predefined configuration for memecoin analysis
   */
  public createMemecoinAnalyzerClient(
    apiConfig: ApiConfig['solanaTracker']
  ): SolanaTrackerClient {
    // Override some settings for memecoin analysis use case
    const optimizedConfig: ApiConfig['solanaTracker'] = {
      ...apiConfig,
      // Optimize for memecoin analysis workload
      rateLimitRps: Math.min(apiConfig.rateLimitRps, 1), // Conservative rate limiting
      maxRetries: 2, // Fewer retries for faster response
      retryDelayMs: 500, // Shorter retry delay
    };

    return this.createClient(optimizedConfig, 'memecoin-analyzer');
  }

  /**
   * Create a client optimized for batch operations
   */
  public createBatchClient(
    apiConfig: ApiConfig['solanaTracker']
  ): SolanaTrackerClient {
    const batchConfig: ApiConfig['solanaTracker'] = {
      ...apiConfig,
      timeout: 60000, // Longer timeout for batch operations
      maxRetries: 3,
      retryDelayMs: 2000, // Longer delay between retries
    };

    return this.createClient(batchConfig, 'batch-processor');
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private setupClientEventForwarding(client: SolanaTrackerClient, instanceName: string): void {
    // Forward important events with instance context
    client.on('circuitBreakerStateChange', (state) => {
      this.logger.info('Client circuit breaker state changed', { 
        instanceName, 
        state 
      });
    });

    client.on('requestFailed', ({ method, endpoint, error, retryCount }) => {
      this.logger.warn('Client request failed', {
        instanceName,
        method,
        endpoint,
        error: error?.message,
        code: error?.code,
        retryCount,
      });
    });

    client.on('requestCompleted', ({ method, endpoint, success, duration, retryCount }) => {
      this.logger.debug('Client request completed', {
        instanceName,
        method,
        endpoint,
        success,
        duration: Math.round(duration),
        retryCount,
      });
    });

    // Log cache performance periodically
    let cacheStatsInterval: NodeJS.Timeout;
    
    const logCacheStats = () => {
      const metrics = client.getMetrics();
      if (metrics.cache.hitRate > 0) {
        this.logger.debug('Client cache performance', {
          instanceName,
          hitRate: Math.round(metrics.cache.hitRate * 100),
          hits: metrics.cache.hits,
          misses: metrics.cache.misses,
          size: metrics.cache.size,
        });
      }
    };

    // Log cache stats every 5 minutes
    cacheStatsInterval = setInterval(logCacheStats, 5 * 60 * 1000);

    // Clean up interval when client is destroyed
    client.once('destroy', () => {
      if (cacheStatsInterval) {
        clearInterval(cacheStatsInterval);
      }
    });
  }
}

/**
 * Global factory instance (singleton pattern)
 */
let globalFactory: SolanaTrackerClientFactory | null = null;

/**
 * Get or create the global client factory
 */
export function getClientFactory(
  logger?: Logger,
  config?: ClientFactoryConfig
): SolanaTrackerClientFactory {
  if (!globalFactory) {
    if (!logger) {
      throw new Error('Logger is required when creating the global client factory');
    }
    globalFactory = new SolanaTrackerClientFactory(logger, config);
  }
  
  return globalFactory;
}

/**
 * Destroy the global client factory and all its instances
 */
export function destroyGlobalFactory(): void {
  if (globalFactory) {
    globalFactory.destroyAll();
    globalFactory = null;
  }
}