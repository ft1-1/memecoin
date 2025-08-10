/**
 * System Component wrapper for Technical Analysis Engine
 * 
 * This wrapper implements the SystemComponent interface required by the orchestrator,
 * providing proper lifecycle management, health monitoring, and error handling
 * for the Technical Analysis Engine.
 */

import { Logger } from 'winston';
import { EventEmitter } from 'events';
import { TechnicalAnalysisEngine, TechnicalAnalysisResult } from './TechnicalAnalysisEngine';
import { SystemComponent, ComponentHealth } from '../../orchestrator/SystemOrchestrator';
import { AnalysisOptions } from './types';
import { AnalysisContext } from '../../types/analysis';

export interface TechnicalAnalysisComponentConfig {
  analysisOptions?: Partial<AnalysisOptions>;
  healthCheckInterval?: number;
  name?: string;
  enablePerformanceMonitoring?: boolean;
  maxConcurrentAnalyses?: number;
}

/**
 * System component wrapper for the Technical Analysis Engine
 */
export class TechnicalAnalysisSystemComponent extends EventEmitter implements SystemComponent {
  public readonly name: string;
  private readonly logger: Logger;
  private readonly config: TechnicalAnalysisComponentConfig;
  private engine: TechnicalAnalysisEngine | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private isInitialized = false;
  private isStarted = false;
  private isDestroyed = false;
  private performanceMetrics = {
    totalAnalyses: 0,
    successfulAnalyses: 0,
    failedAnalyses: 0,
    averageAnalysisTime: 0,
    totalAnalysisTime: 0,
    lastAnalysisAt: null as Date | null,
    errorsLast24h: 0,
    lastErrorResetAt: new Date()
  };
  private activeAnalyses = new Set<string>();

  constructor(config: TechnicalAnalysisComponentConfig, logger: Logger) {
    super();
    
    this.name = config.name || 'TechnicalAnalysisEngine';
    this.logger = logger.child({ component: this.name });
    this.config = config;

    this.logger.debug('Technical Analysis system component created', {
      name: this.name,
      memecoinsOptimized: config.analysisOptions?.memecoinsOptimized,
      minDataPoints: config.analysisOptions?.minDataPoints,
    });
  }

  /**
   * Initialize the component and create the engine
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      this.logger.warn('Component already initialized');
      return;
    }

    if (this.isDestroyed) {
      throw new Error('Cannot initialize destroyed component');
    }

    this.logger.info('Initializing Technical Analysis Engine');

    try {
      // Validate configuration
      this.validateConfiguration();

      // Create the engine instance with optimized settings
      this.engine = new TechnicalAnalysisEngine(this.config.analysisOptions);

      // Set up event forwarding and monitoring
      this.setupEventForwarding();
      this.setupPerformanceMonitoring();

      this.isInitialized = true;
      this.logger.info('Technical Analysis Engine initialized successfully', {
        options: this.engine.getOptions()
      });

    } catch (error) {
      this.logger.error('Failed to initialize Technical Analysis Engine', { error });
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

    this.logger.info('Starting Technical Analysis Engine');

    try {
      // Perform initial health check
      const health = await this.performHealthCheck();
      if (health.status === 'unhealthy') {
        this.logger.warn('Initial health check failed but continuing startup', {
          status: health.status,
          message: health.message,
        });
      }

      // Start periodic health monitoring
      this.startHealthMonitoring();

      // Start performance metrics reset timer
      this.startMetricsReset();

      this.isStarted = true;
      this.logger.info('Technical Analysis Engine started successfully');
      this.emit('started');

    } catch (error) {
      this.logger.error('Failed to start Technical Analysis Engine', { error });
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

    this.logger.info('Stopping Technical Analysis Engine');

    try {
      // Wait for active analyses to complete (with timeout)
      await this.waitForActiveAnalyses(30000); // 30 second timeout

      // Stop health monitoring
      this.stopHealthMonitoring();

      this.isStarted = false;
      this.logger.info('Technical Analysis Engine stopped successfully', {
        finalMetrics: this.getMetrics()
      });
      this.emit('stopped');

    } catch (error) {
      this.logger.error('Error stopping Technical Analysis Engine', { error });
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

    if (!this.isInitialized || !this.engine) {
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

    this.logger.info('Destroying Technical Analysis Engine');

    try {
      // Stop if running
      if (this.isStarted) {
        await this.stop();
      }

      // Stop health monitoring
      this.stopHealthMonitoring();

      // Clear the engine reference
      this.engine = null;

      // Remove all listeners
      this.removeAllListeners();

      this.isDestroyed = true;
      this.isInitialized = false;
      this.isStarted = false;

      this.logger.info('Technical Analysis Engine destroyed successfully');

    } catch (error) {
      this.logger.error('Error destroying Technical Analysis Engine', { error });
      throw error;
    }
  }

  /**
   * Get the underlying engine instance
   */
  getEngine(): TechnicalAnalysisEngine {
    if (!this.engine) {
      throw new Error('Engine not initialized');
    }
    return this.engine;
  }

  /**
   * Perform technical analysis with proper error handling and monitoring
   */
  async analyzeTechnicals(context: AnalysisContext): Promise<TechnicalAnalysisResult> {
    if (!this.engine) {
      throw new Error('Engine not initialized');
    }

    if (!this.isReady()) {
      throw new Error('Component not ready for analysis');
    }

    // Check concurrent analysis limit
    const maxConcurrent = this.config.maxConcurrentAnalyses || 5;
    if (this.activeAnalyses.size >= maxConcurrent) {
      throw new Error(`Maximum concurrent analyses limit reached (${maxConcurrent})`);
    }

    const analysisId = `analysis-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    this.logger.debug('Starting technical analysis', {
      analysisId,
      tokenAddress: context.tokenData?.address,
      chartDataPoints: context.chartData?.length
    });

    this.activeAnalyses.add(analysisId);
    this.performanceMetrics.totalAnalyses++;

    try {
      const result = await this.engine.analyzeTechnicals(context);
      
      const duration = Date.now() - startTime;
      this.performanceMetrics.successfulAnalyses++;
      this.performanceMetrics.totalAnalysisTime += duration;
      this.performanceMetrics.averageAnalysisTime = 
        this.performanceMetrics.totalAnalysisTime / this.performanceMetrics.successfulAnalyses;
      this.performanceMetrics.lastAnalysisAt = new Date();

      this.logger.debug('Technical analysis completed successfully', {
        analysisId,
        duration,
        rating: result.rating.rating,
        confidence: result.rating.confidence,
        recommendation: result.recommendation.action
      });

      this.emit('analysisCompleted', {
        analysisId,
        success: true,
        duration,
        result
      });

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      this.performanceMetrics.failedAnalyses++;
      this.performanceMetrics.errorsLast24h++;

      this.logger.error('Technical analysis failed', {
        analysisId,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error',
        tokenAddress: context.tokenData?.address
      });

      this.emit('analysisCompleted', {
        analysisId,
        success: false,
        duration,
        error
      });

      throw error;

    } finally {
      this.activeAnalyses.delete(analysisId);
    }
  }

  /**
   * Update analysis options
   */
  updateOptions(newOptions: Partial<AnalysisOptions>): void {
    if (!this.engine) {
      throw new Error('Engine not initialized');
    }
    
    this.engine.updateOptions(newOptions);
    this.logger.info('Analysis options updated', { newOptions });
    this.emit('optionsUpdated', newOptions);
  }

  /**
   * Get current analysis options
   */
  getOptions(): AnalysisOptions {
    if (!this.engine) {
      throw new Error('Engine not initialized');
    }
    return this.engine.getOptions();
  }

  /**
   * Get performance metrics
   */
  getMetrics(): any {
    return {
      ...this.performanceMetrics,
      activeAnalysesCount: this.activeAnalyses.size,
      successRate: this.performanceMetrics.totalAnalyses > 0 
        ? (this.performanceMetrics.successfulAnalyses / this.performanceMetrics.totalAnalyses) * 100 
        : 0,
      initialized: this.isInitialized,
      started: this.isStarted,
      destroyed: this.isDestroyed
    };
  }

  /**
   * Reset performance metrics
   */
  resetMetrics(): void {
    this.performanceMetrics = {
      totalAnalyses: 0,
      successfulAnalyses: 0,
      failedAnalyses: 0,
      averageAnalysisTime: 0,
      totalAnalysisTime: 0,
      lastAnalysisAt: null,
      errorsLast24h: 0,
      lastErrorResetAt: new Date()
    };
    this.logger.info('Performance metrics reset');
    this.emit('metricsReset');
  }

  /**
   * Check if the component is ready for use
   */
  isReady(): boolean {
    return this.isInitialized && this.isStarted && !this.isDestroyed && this.engine !== null;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private validateConfiguration(): void {
    const { analysisOptions } = this.config;

    if (analysisOptions?.minDataPoints && analysisOptions.minDataPoints < 1) {
      throw new Error('minDataPoints must be at least 1');
    }

    if (analysisOptions?.confidenceThreshold && 
        (analysisOptions.confidenceThreshold < 0 || analysisOptions.confidenceThreshold > 100)) {
      throw new Error('confidenceThreshold must be between 0 and 100');
    }

    if (this.config.maxConcurrentAnalyses && this.config.maxConcurrentAnalyses < 1) {
      throw new Error('maxConcurrentAnalyses must be at least 1');
    }

    this.logger.debug('Configuration validated successfully');
  }

  private setupEventForwarding(): void {
    // The TechnicalAnalysisEngine doesn't have events by default,
    // but we can add monitoring for our wrapper events
    this.on('analysisCompleted', (details) => {
      if (!details.success) {
        this.logger.warn('Analysis failed', {
          analysisId: details.analysisId,
          duration: details.duration,
          error: details.error?.message
        });
      }
    });
  }

  private setupPerformanceMonitoring(): void {
    if (!this.config.enablePerformanceMonitoring) {
      return;
    }

    // Set up periodic performance logging
    setInterval(() => {
      const metrics = this.getMetrics();
      if (metrics.totalAnalyses > 0) {
        this.logger.debug('Performance metrics', {
          totalAnalyses: metrics.totalAnalyses,
          successRate: metrics.successRate,
          averageAnalysisTime: metrics.averageAnalysisTime,
          activeAnalyses: metrics.activeAnalysesCount,
          errorsLast24h: metrics.errorsLast24h
        });
      }
    }, 60000); // Every minute
  }

  private async performHealthCheck(): Promise<ComponentHealth> {
    const startTime = Date.now();

    try {
      if (!this.engine) {
        return {
          status: 'unhealthy',
          message: 'Engine not available',
          responseTime: 0,
          metadata: { engineAvailable: false },
        };
      }

      const metrics = this.getMetrics();
      const responseTime = Date.now() - startTime;

      // Determine health based on various factors
      let status: ComponentHealth['status'] = 'healthy';
      let message = 'All systems operational';

      // Check error rate
      const errorRate = metrics.totalAnalyses > 0 
        ? (metrics.failedAnalyses / metrics.totalAnalyses) * 100 
        : 0;

      if (errorRate > 20) {
        status = 'unhealthy';
        message = `High error rate: ${errorRate.toFixed(1)}%`;
      } else if (errorRate > 10) {
        status = 'degraded';
        message = `Elevated error rate: ${errorRate.toFixed(1)}%`;
      }

      // Check if analysis is taking too long on average
      if (metrics.averageAnalysisTime > 10000) { // 10 seconds
        status = status === 'healthy' ? 'degraded' : status;
        message += status === 'degraded' ? ', slow analysis times' : ' and slow analysis times';
      }

      // Check recent errors
      if (metrics.errorsLast24h > 50) {
        status = 'unhealthy';
        message = `Too many recent errors: ${metrics.errorsLast24h}`;
      }

      return {
        status,
        message,
        responseTime,
        metadata: {
          metrics,
          errorRate,
          options: this.engine.getOptions(),
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

    const interval = this.config.healthCheckInterval || 60000; // 1 minute default
    
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

  private startMetricsReset(): void {
    // Reset error count every 24 hours
    setInterval(() => {
      this.performanceMetrics.errorsLast24h = 0;
      this.performanceMetrics.lastErrorResetAt = new Date();
      this.logger.debug('24-hour error count reset');
    }, 24 * 60 * 60 * 1000); // 24 hours
  }

  private async waitForActiveAnalyses(timeout: number): Promise<void> {
    const startTime = Date.now();
    
    while (this.activeAnalyses.size > 0 && (Date.now() - startTime) < timeout) {
      this.logger.debug('Waiting for active analyses to complete', {
        activeCount: this.activeAnalyses.size,
        remainingTime: timeout - (Date.now() - startTime)
      });
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (this.activeAnalyses.size > 0) {
      this.logger.warn('Timeout waiting for active analyses to complete', {
        activeCount: this.activeAnalyses.size
      });
    }
  }
}

/**
 * Factory function to create a Technical Analysis system component
 */
export function createTechnicalAnalysisSystemComponent(
  config: TechnicalAnalysisComponentConfig,
  logger: Logger
): TechnicalAnalysisSystemComponent {
  return new TechnicalAnalysisSystemComponent(config, logger);
}

/**
 * Factory function optimized for memecoin analysis
 */
export function createMemecoinTechnicalAnalysisSystemComponent(
  logger: Logger,
  customOptions?: Partial<AnalysisOptions>
): TechnicalAnalysisSystemComponent {
  const config: TechnicalAnalysisComponentConfig = {
    analysisOptions: {
      timeframes: ['1m', '5m', '15m', '1h'],
      indicators: {
        rsi: {
          period: 14,
          overbought: 75, // Higher for memecoins
          oversold: 25    // Lower for memecoins
        },
        macd: {
          fastPeriod: 12,
          slowPeriod: 26,
          signalPeriod: 9
        },
        bollinger: {
          period: 20,
          stdDev: 2.2 // Wider for high volatility
        },
        ema: {
          periods: [9, 21, 50] // Focus on shorter periods
        },
        volume: {
          smaLookback: 20,
          spikeThreshold: 3.0 // Higher threshold for meme volume spikes
        }
      },
      minDataPoints: 30, // Lower requirement for fast-moving memes
      confidenceThreshold: 65,
      riskAdjustment: true,
      memecoinsOptimized: true,
      ...customOptions
    },
    healthCheckInterval: 60000, // 1 minute
    name: 'MemecoinTechnicalAnalyzer',
    enablePerformanceMonitoring: true,
    maxConcurrentAnalyses: 3
  };

  return new TechnicalAnalysisSystemComponent(config, logger);
}