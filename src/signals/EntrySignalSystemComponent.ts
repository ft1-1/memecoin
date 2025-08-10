/**
 * Entry Signal System Component
 * 
 * System wrapper for EntrySignalGenerator that integrates with
 * the orchestrator's component management system.
 */

import { Logger } from '../utils/Logger';
import { EntrySignalGenerator, EntrySignal, EntrySignalConfig } from './EntrySignalGenerator';
import { RatingEngine } from '../analysis/rating/RatingEngine';
import { RatingEngineSystemComponent } from '../analysis/rating/RatingEngineSystemComponent';
import { OHLCV } from '../data/api/solana-tracker/types';
import { TokenData, ChartDataPoint } from '../types/api';
import { SystemComponent, ComponentHealth } from '../orchestrator/SystemOrchestrator';

export interface EntrySignalSystemComponentConfig {
  signalConfig?: Partial<EntrySignalConfig>;
  enabled?: boolean;
  cacheDurationMs?: number;
  maxCacheSize?: number;
}

export class EntrySignalSystemComponent implements SystemComponent {
  public readonly name: string = 'EntrySignal';
  private logger: Logger;
  private signalGenerator: EntrySignalGenerator | null = null;
  private config: EntrySignalSystemComponentConfig;
  private isInitialized = false;
  private isStarted = false;
  private cache = new Map<string, { signal: EntrySignal; timestamp: number }>();
  private ratingEngineComponent?: RatingEngineSystemComponent;

  constructor(
    config: EntrySignalSystemComponentConfig = {},
    logger?: Logger,
    ratingEngineComponent?: RatingEngineSystemComponent
  ) {
    this.config = {
      enabled: true,
      cacheDurationMs: 2 * 60 * 1000, // 2 minutes cache for signals
      maxCacheSize: 100,
      ...config
    };
    
    this.logger = logger || Logger.getInstance();
    this.ratingEngineComponent = ratingEngineComponent;
    // Signal generator will be created in initialize() after rating engine is ready
  }

  /**
   * Initialize the component
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      this.logger.info('Initializing Entry Signal System Component', {
        enabled: this.config.enabled,
        cacheDuration: this.config.cacheDurationMs,
        maxCacheSize: this.config.maxCacheSize
      });

      // Get the rating engine if available
      let ratingEngine: RatingEngine | undefined;
      if (this.ratingEngineComponent) {
        try {
          ratingEngine = this.ratingEngineComponent.getEngine();
          this.logger.info('Rating engine obtained from component');
        } catch (error) {
          this.logger.warn('Rating engine not yet initialized, will continue without it', {
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      // Create the signal generator with the rating engine (if available)
      this.signalGenerator = new EntrySignalGenerator(this.config.signalConfig, ratingEngine);

      this.isInitialized = true;
      this.logger.info('Entry Signal System Component initialized successfully');
      
    } catch (error) {
      this.logger.error('Failed to initialize Entry Signal System Component', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Start the component
   */
  async start(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Component must be initialized before starting');
    }

    if (this.isStarted) {
      return;
    }

    try {
      this.logger.info('Starting Entry Signal System Component');
      this.isStarted = true;
      this.logger.info('Entry Signal System Component started successfully');
    } catch (error) {
      this.logger.error('Failed to start Entry Signal System Component', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Stop the component
   */
  async stop(): Promise<void> {
    if (!this.isStarted) {
      return;
    }

    try {
      this.logger.info('Stopping Entry Signal System Component');
      this.isStarted = false;
      this.logger.info('Entry Signal System Component stopped successfully');
    } catch (error) {
      this.logger.error('Failed to stop Entry Signal System Component', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get component health status
   */
  async getHealth(): Promise<ComponentHealth> {
    if (!this.isInitialized) {
      return {
        status: 'unhealthy',
        message: 'Component not initialized'
      };
    }

    if (!this.isStarted) {
      return {
        status: 'unhealthy',
        message: 'Component not started'
      };
    }

    if (!this.config.enabled) {
      return {
        status: 'degraded',
        message: 'Component disabled'
      };
    }

    if (!this.signalGenerator) {
      return {
        status: 'degraded',
        message: 'Signal generator not available'
      };
    }

    return {
      status: 'healthy',
      message: 'Component operational',
      metadata: {
        cacheSize: this.cache.size,
        enabled: this.config.enabled,
        hasSignalGenerator: this.signalGenerator !== null
      }
    };
  }

  /**
   * Destroy the component
   */
  async destroy(): Promise<void> {
    try {
      this.logger.info('Destroying Entry Signal System Component');
      
      if (this.isStarted) {
        await this.stop();
      }

      this.clearCache();
      this.signalGenerator = null;
      this.isInitialized = false;
      this.isStarted = false;
      
      this.logger.info('Entry Signal System Component destroyed successfully');
    } catch (error) {
      this.logger.error('Failed to destroy Entry Signal System Component', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Check if component is ready
   */
  isReady(): boolean {
    return this.isInitialized && this.isStarted && this.config.enabled && this.signalGenerator !== null;
  }

  /**
   * Generate entry signal for a token
   */
  async generateEntrySignal(
    tokenData: TokenData,
    ohlcvData: OHLCV[],
    multiTimeframeData?: Record<string, OHLCV[]>,
    chartData?: ChartDataPoint[]
  ): Promise<EntrySignal | null> {
    if (!this.isReady() || !this.signalGenerator) {
      this.logger.warn('Entry Signal System Component not ready', {
        isInitialized: this.isInitialized,
        enabled: this.config.enabled,
        hasSignalGenerator: this.signalGenerator !== null
      });
      return null;
    }

    try {
      // Create cache key based on data
      const cacheKey = this.createCacheKey(tokenData.address, ohlcvData, multiTimeframeData);
      
      // Check cache first
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.config.cacheDurationMs!) {
        this.logger.debug('Entry signal cache hit', { tokenAddress: tokenData.address });
        return cached.signal;
      }

      // Generate new signal
      const signal = await this.signalGenerator.generateEntrySignal(
        tokenData,
        ohlcvData,
        multiTimeframeData,
        chartData
      );
      
      // Cache the result
      this.cache.set(cacheKey, {
        signal,
        timestamp: Date.now()
      });

      // Clean cache if it's getting too large
      this.manageCacheSize();

      this.logger.info('Entry signal generated', {
        tokenAddress: tokenData.address,
        signalType: signal.type,
        score: signal.score,
        confidence: signal.confidence
      });

      return signal;

    } catch (error) {
      this.logger.error('Entry signal generation failed', {
        error: error instanceof Error ? error.message : String(error),
        tokenAddress: tokenData.address,
        dataPoints: ohlcvData.length
      });
      return null;
    }
  }

  /**
   * Generate multiple entry signals in batch
   */
  async generateBatchSignals(
    tokens: Array<{
      tokenData: TokenData;
      ohlcvData: OHLCV[];
      multiTimeframeData?: Record<string, OHLCV[]>;
      chartData?: ChartDataPoint[];
    }>
  ): Promise<Array<{ address: string; signal: EntrySignal | null }>> {
    if (!this.isReady() || !this.signalGenerator) {
      this.logger.warn('Entry Signal System Component not ready for batch processing', {
        isInitialized: this.isInitialized,
        enabled: this.config.enabled,
        hasSignalGenerator: this.signalGenerator !== null
      });
      return tokens.map(t => ({ address: t.tokenData.address, signal: null }));
    }

    const results: Array<{ address: string; signal: EntrySignal | null }> = [];
    
    this.logger.info(`Processing batch of ${tokens.length} entry signals`);

    for (const token of tokens) {
      try {
        const signal = await this.generateEntrySignal(
          token.tokenData,
          token.ohlcvData,
          token.multiTimeframeData,
          token.chartData
        );
        
        results.push({
          address: token.tokenData.address,
          signal
        });

      } catch (error) {
        this.logger.error('Batch signal generation failed for token', {
          error: error instanceof Error ? error.message : String(error),
          tokenAddress: token.tokenData.address
        });
        
        results.push({
          address: token.tokenData.address,
          signal: null
        });
      }
    }

    return results;
  }

  /**
   * Filter signals by criteria
   */
  filterSignals(
    signals: EntrySignal[],
    criteria: {
      minScore?: number;
      minConfidence?: number;
      signalTypes?: EntrySignal['type'][];
      excludeRisks?: string[];
    }
  ): EntrySignal[] {
    return signals.filter(signal => {
      // Score filter
      if (criteria.minScore !== undefined && signal.score < criteria.minScore) {
        return false;
      }

      // Confidence filter
      if (criteria.minConfidence !== undefined && signal.confidence < criteria.minConfidence) {
        return false;
      }

      // Signal type filter
      if (criteria.signalTypes && !criteria.signalTypes.includes(signal.type)) {
        return false;
      }

      // Risk filter
      if (criteria.excludeRisks) {
        const hasExcludedRisk = signal.risks.some(risk => 
          criteria.excludeRisks!.some(excluded => risk.includes(excluded))
        );
        if (hasExcludedRisk) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Create cache key for signal caching
   */
  private createCacheKey(
    tokenAddress: string,
    ohlcvData: OHLCV[],
    multiTimeframeData?: Record<string, OHLCV[]>
  ): string {
    const dataHash = this.hashData(ohlcvData);
    const multiTimeframeHash = multiTimeframeData ? 
      this.hashData(Object.values(multiTimeframeData).flat()) : '';
    
    return `${tokenAddress}-${dataHash}-${multiTimeframeHash}`;
  }

  /**
   * Simple hash function for data
   */
  private hashData(data: OHLCV[]): string {
    if (data.length === 0) return '0';
    
    const latest = data[data.length - 1];
    return `${data.length}-${latest.timestamp}-${latest.close.toFixed(8)}`;
  }

  /**
   * Manage cache size to prevent memory issues
   */
  private manageCacheSize(): void {
    if (this.cache.size > this.config.maxCacheSize!) {
      // Remove oldest entries
      const entries = Array.from(this.cache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const toRemove = entries.slice(0, this.cache.size - this.config.maxCacheSize!);
      toRemove.forEach(([key]) => this.cache.delete(key));
      
      this.logger.debug(`Removed ${toRemove.length} old cache entries`);
    }
  }

  /**
   * Get component statistics
   */
  getStatistics(): {
    cacheSize: number;
    maxCacheSize: number;
    signalConfig: EntrySignalConfig | null;
    isReady: boolean;
    enabled: boolean;
  } {
    return {
      cacheSize: this.cache.size,
      maxCacheSize: this.config.maxCacheSize || 100,
      signalConfig: this.signalGenerator ? this.signalGenerator.getConfig() : null,
      isReady: this.isReady(),
      enabled: this.config.enabled || false
    };
  }

  /**
   * Update signal generator configuration
   */
  updateSignalConfig(newConfig: Partial<EntrySignalConfig>): void {
    if (this.signalGenerator) {
      this.signalGenerator.updateConfig(newConfig);
      this.logger.info('Entry signal configuration updated', newConfig);
    } else {
      this.logger.warn('Cannot update signal config: signal generator not initialized');
    }
  }

  /**
   * Update component configuration
   */
  updateConfig(newConfig: Partial<EntrySignalSystemComponentConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.info('Entry Signal System Component configuration updated', newConfig);
  }

  /**
   * Clear signal cache
   */
  clearCache(): void {
    const cacheSize = this.cache.size;
    this.cache.clear();
    this.logger.info(`Cleared ${cacheSize} cached entry signals`);
  }

  /**
   * Shutdown the component (alias for destroy)
   */
  async shutdown(): Promise<void> {
    await this.destroy();
  }

  /**
   * Health check (legacy method)
   */
  async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    const health = await this.getHealth();
    
    // Additional check for cache size
    if (health.status === 'healthy' && this.cache.size > this.config.maxCacheSize! * 1.5) {
      return { healthy: false, message: 'Cache size exceeds safe limits' };
    }
    
    return {
      healthy: health.status === 'healthy',
      message: health.message || 'Unknown status'
    };
  }
}

/**
 * Factory function to create entry signal system component
 */
export function createEntrySignalSystemComponent(
  config?: EntrySignalSystemComponentConfig,
  logger?: Logger,
  ratingEngineComponent?: RatingEngineSystemComponent
): EntrySignalSystemComponent {
  return new EntrySignalSystemComponent(config, logger, ratingEngineComponent);
}