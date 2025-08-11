/**
 * Momentum Acceleration System Component
 * 
 * System wrapper for MomentumAccelerationTracker that integrates with
 * the orchestrator's component management system.
 */

import { Logger } from '../../utils/Logger';
import { MomentumAccelerationTracker, MomentumAcceleration, MomentumConfig } from './MomentumAccelerationTracker';
import { OHLCV } from '../../data/api/solana-tracker/types';
import { SystemComponent, ComponentHealth } from '../../orchestrator/SystemOrchestrator';

export interface MomentumAccelerationSystemComponentConfig {
  momentumConfig?: Partial<MomentumConfig>;
  enabled?: boolean;
  cacheDurationMs?: number;
  defaultIntervalMinutes?: number; // Default interval in minutes for analysis
}

export class MomentumAccelerationSystemComponent implements SystemComponent {
  public readonly name: string = 'MomentumAcceleration';
  private logger: Logger;
  private trackers: Map<number, MomentumAccelerationTracker> = new Map(); // Interval -> Tracker
  private config: MomentumAccelerationSystemComponentConfig;
  private isInitialized = false;
  private isStarted = false;
  private cache = new Map<string, { result: MomentumAcceleration; timestamp: number }>();

  constructor(config: MomentumAccelerationSystemComponentConfig = {}, logger?: Logger) {
    this.config = {
      enabled: true,
      cacheDurationMs: 5 * 60 * 1000, // 5 minutes cache
      defaultIntervalMinutes: 5, // Default to 5-minute intervals
      ...config
    };
    
    this.logger = logger || Logger.getInstance();
    // Create default tracker with default interval
    this.trackers.set(this.config.defaultIntervalMinutes!, 
      new MomentumAccelerationTracker(config.momentumConfig, this.config.defaultIntervalMinutes)
    );
  }

  /**
   * Initialize the component
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      this.logger.info('Initializing Momentum Acceleration System Component', {
        enabled: this.config.enabled,
        cacheDuration: this.config.cacheDurationMs
      });

      this.isInitialized = true;
      this.logger.info('Momentum Acceleration System Component initialized successfully');
      
    } catch (error) {
      this.logger.error('Failed to initialize Momentum Acceleration System Component', {
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
      this.logger.info('Starting Momentum Acceleration System Component');
      this.isStarted = true;
      this.logger.info('Momentum Acceleration System Component started successfully');
    } catch (error) {
      this.logger.error('Failed to start Momentum Acceleration System Component', {
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
      this.logger.info('Stopping Momentum Acceleration System Component');
      this.isStarted = false;
      this.logger.info('Momentum Acceleration System Component stopped successfully');
    } catch (error) {
      this.logger.error('Failed to stop Momentum Acceleration System Component', {
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

    return {
      status: 'healthy',
      message: 'Component operational',
      metadata: {
        cacheSize: this.cache.size,
        enabled: this.config.enabled
      }
    };
  }

  /**
   * Destroy the component
   */
  async destroy(): Promise<void> {
    try {
      this.logger.info('Destroying Momentum Acceleration System Component');
      
      if (this.isStarted) {
        await this.stop();
      }

      this.cache.clear();
      this.isInitialized = false;
      this.isStarted = false;
      
      this.logger.info('Momentum Acceleration System Component destroyed successfully');
    } catch (error) {
      this.logger.error('Failed to destroy Momentum Acceleration System Component', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Check if component is ready
   */
  isReady(): boolean {
    return this.isInitialized && this.isStarted && (this.config.enabled ?? false);
  }

  /**
   * Get or create a tracker for a specific interval
   */
  private getTrackerForInterval(intervalMinutes: number): MomentumAccelerationTracker {
    if (!this.trackers.has(intervalMinutes)) {
      this.logger.debug(`Creating new momentum tracker for ${intervalMinutes}-minute interval`);
      this.trackers.set(intervalMinutes, 
        new MomentumAccelerationTracker(this.config.momentumConfig, intervalMinutes)
      );
    }
    return this.trackers.get(intervalMinutes)!;
  }

  /**
   * Detect interval from OHLCV data
   */
  private detectInterval(ohlcvData: OHLCV[]): number {
    if (ohlcvData.length < 2) {
      return this.config.defaultIntervalMinutes!;
    }

    // Calculate time difference between consecutive candles
    const timestamps = ohlcvData
      .slice(0, Math.min(10, ohlcvData.length))
      .map(d => d.timestamp)
      .sort((a, b) => a - b);

    if (timestamps.length < 2) {
      return this.config.defaultIntervalMinutes!;
    }

    // Calculate average interval in minutes
    const intervals = [];
    for (let i = 1; i < timestamps.length; i++) {
      intervals.push((timestamps[i] - timestamps[i-1]) / (1000 * 60));
    }

    const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    
    // Round to nearest common interval (1, 5, 15, 60, 240 minutes)
    const commonIntervals = [1, 5, 15, 60, 240];
    const detectedInterval = commonIntervals.reduce((prev, curr) => 
      Math.abs(curr - avgInterval) < Math.abs(prev - avgInterval) ? curr : prev
    );

    this.logger.debug(`Detected interval: ${detectedInterval} minutes from data`, {
      avgInterval: avgInterval.toFixed(2),
      sampleSize: intervals.length
    });

    return detectedInterval;
  }

  /**
   * Analyze momentum acceleration for token data
   */
  async analyzeMomentumAcceleration(
    tokenAddress: string,
    ohlcvData: OHLCV[],
    intervalMinutes?: number
  ): Promise<MomentumAcceleration | null> {
    if (!this.isReady()) {
      this.logger.warn('Momentum Acceleration System Component not ready');
      return null;
    }

    try {
      // Detect or use provided interval
      const detectedInterval = intervalMinutes || this.detectInterval(ohlcvData);
      
      // Check cache first (include interval in cache key)
      const cacheKey = `${tokenAddress}-${ohlcvData.length}-${detectedInterval}min`;
      const cached = this.cache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < this.config.cacheDurationMs!) {
        this.logger.debug('Momentum acceleration cache hit', { 
          tokenAddress, 
          interval: `${detectedInterval}min` 
        });
        return cached.result;
      }

      // Get appropriate tracker for this interval
      const tracker = this.getTrackerForInterval(detectedInterval);

      // Analyze momentum acceleration
      const result = tracker.analyzeMomentum(ohlcvData);
      
      // Cache the result
      this.cache.set(cacheKey, {
        result,
        timestamp: Date.now()
      });

      // Clean old cache entries
      this.cleanCache();

      this.logger.debug('Momentum acceleration analysis completed', {
        tokenAddress,
        interval: `${detectedInterval}min`,
        sustainabilityScore: result.sustainabilityScore,
        fatigueLevel: result.fatigueLevel,
        entrySignalStrength: result.entrySignalStrength
      });

      return result;

    } catch (error) {
      this.logger.error('Momentum acceleration analysis failed', {
        error: error instanceof Error ? error.message : String(error),
        tokenAddress,
        dataPoints: ohlcvData.length
      });
      return null;
    }
  }

  /**
   * Get detailed momentum metrics
   */
  async getDetailedMetrics(
    tokenAddress: string,
    ohlcvData: OHLCV[],
    intervalMinutes?: number
  ): Promise<any> {
    if (!this.isReady()) {
      return null;
    }

    try {
      // Detect or use provided interval
      const detectedInterval = intervalMinutes || this.detectInterval(ohlcvData);
      
      // Get appropriate tracker for this interval
      const tracker = this.getTrackerForInterval(detectedInterval);

      // Sort data by timestamp (newest first)
      const sortedData = [...ohlcvData].sort((a, b) => b.timestamp - a.timestamp);
      return tracker.calculateDetailedMetrics(sortedData);
      
    } catch (error) {
      this.logger.error('Failed to get detailed momentum metrics', {
        error: error instanceof Error ? error.message : String(error),
        tokenAddress
      });
      return null;
    }
  }

  /**
   * Clean old cache entries
   */
  private cleanCache(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.config.cacheDurationMs!) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach(key => this.cache.delete(key));
    
    if (expiredKeys.length > 0) {
      this.logger.debug(`Cleaned ${expiredKeys.length} expired momentum cache entries`);
    }
  }

  /**
   * Get component statistics
   */
  getStatistics(): {
    cacheSize: number;
    cacheHitRate: number;
    isReady: boolean;
    enabled: boolean;
    trackersCount: number;
    intervals: number[];
  } {
    return {
      cacheSize: this.cache.size,
      cacheHitRate: 0, // Would need to track hits/misses for accurate rate
      isReady: this.isReady(),
      enabled: this.config.enabled || false,
      trackersCount: this.trackers.size,
      intervals: Array.from(this.trackers.keys()).sort((a, b) => a - b)
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<MomentumAccelerationSystemComponentConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.info('Momentum Acceleration System Component configuration updated', newConfig);
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
    return {
      healthy: health.status === 'healthy',
      message: health.message || 'Unknown status'
    };
  }
}

/**
 * Factory function to create momentum acceleration system component
 */
export function createMomentumAccelerationSystemComponent(
  config?: MomentumAccelerationSystemComponentConfig,
  logger?: Logger
): MomentumAccelerationSystemComponent {
  return new MomentumAccelerationSystemComponent(config, logger);
}