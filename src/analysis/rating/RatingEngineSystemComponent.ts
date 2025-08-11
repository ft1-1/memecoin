/**
 * System Component wrapper for Rating Engine
 * 
 * This wrapper implements the SystemComponent interface required by the orchestrator,
 * providing proper lifecycle management, health monitoring, and error handling
 * for the Rating Engine.
 */

import { Logger } from 'winston';
import { EventEmitter } from 'events';
import { RatingEngine, RatingEngineConfig } from './RatingEngine';
import { SystemComponent, ComponentHealth } from '../../orchestrator/SystemOrchestrator';
import { DatabaseManager } from '../../database/DatabaseManager';

export interface RatingEngineComponentConfig {
  ratingConfig: Partial<RatingEngineConfig>;
  healthCheckInterval?: number;
  name?: string;
  databaseManager?: DatabaseManager | undefined;
}

/**
 * System component wrapper for the Rating Engine
 */
export class RatingEngineSystemComponent extends EventEmitter implements SystemComponent {
  public readonly name: string;
  private readonly logger: Logger;
  private readonly config: RatingEngineComponentConfig;
  private engine: RatingEngine | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private isInitialized = false;
  private isStarted = false;
  private isDestroyed = false;
  private ratingCount = 0;
  private lastRatingTime: Date | null = null;
  private totalRatingTime = 0;

  constructor(config: RatingEngineComponentConfig, logger: Logger) {
    super();
    
    this.name = config.name || 'RatingEngine';
    this.logger = logger.child({ component: this.name });
    this.config = config;

    this.logger.debug('Rating Engine system component created', {
      name: this.name,
      weights: config.ratingConfig.weights,
      adaptiveWeighting: config.ratingConfig.adaptiveWeighting,
    });
  }

  /**
   * Initialize the component and create the rating engine
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      this.logger.warn('Component already initialized');
      return;
    }

    if (this.isDestroyed) {
      throw new Error('Cannot initialize destroyed component');
    }

    this.logger.info('Initializing Rating Engine');

    try {
      // Validate configuration
      this.validateConfiguration();

      // Create the rating engine instance with database manager
      this.engine = new RatingEngine(this.config.ratingConfig, this.config.databaseManager);

      // Set up event forwarding
      this.setupEventForwarding();

      this.isInitialized = true;
      this.logger.info('Rating Engine initialized successfully');

    } catch (error) {
      this.logger.error('Failed to initialize Rating Engine', { error });
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

    this.logger.info('Starting Rating Engine');

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

      this.isStarted = true;
      this.logger.info('Rating Engine started successfully');
      this.emit('started');

    } catch (error) {
      this.logger.error('Failed to start Rating Engine', { error });
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

    this.logger.info('Stopping Rating Engine');

    try {
      // Stop health monitoring
      this.stopHealthMonitoring();

      this.isStarted = false;
      this.logger.info('Rating Engine stopped successfully');
      this.emit('stopped');

    } catch (error) {
      this.logger.error('Error stopping Rating Engine', { error });
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

    this.logger.info('Destroying Rating Engine');

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

      this.logger.info('Rating Engine destroyed successfully');

    } catch (error) {
      this.logger.error('Error destroying Rating Engine', { error });
      throw error;
    }
  }

  /**
   * Get the underlying engine instance
   */
  getEngine(): RatingEngine {
    if (!this.engine) {
      throw new Error('Engine not initialized');
    }
    return this.engine;
  }

  /**
   * Convenience method to calculate rating (delegates to engine)
   */
  async calculateRating(
    technicalIndicators: any,
    momentum: any,
    volume: any,
    risk: any,
    context: any
  ) {
    if (!this.engine) {
      throw new Error('Engine not initialized');
    }
    
    const startTime = Date.now();
    
    try {
      const result = await this.engine.calculateRating(
        technicalIndicators,
        momentum,
        volume,
        risk,
        context
      );

      // Update metrics
      this.ratingCount++;
      this.lastRatingTime = new Date();
      this.totalRatingTime += Date.now() - startTime;

      this.emit('ratingCalculated', {
        tokenAddress: context.tokenData.address,
        rating: result.rating,
        confidence: result.confidence,
        duration: Date.now() - startTime,
      });

      return result;

    } catch (error) {
      this.emit('ratingFailed', {
        tokenAddress: context.tokenData.address,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get rating statistics
   */
  getRatingStatistics(): any {
    if (!this.engine) {
      return null;
    }
    return this.engine.getRatingStatistics();
  }

  /**
   * Get component metrics
   */
  getMetrics(): any {
    return {
      ratingCount: this.ratingCount,
      lastRatingTime: this.lastRatingTime,
      averageRatingTime: this.ratingCount > 0 ? this.totalRatingTime / this.ratingCount : 0,
      isReady: this.isReady(),
      engineStatistics: this.engine ? this.engine.getRatingStatistics() : null,
    };
  }

  /**
   * Reset component metrics
   */
  resetMetrics(): void {
    this.ratingCount = 0;
    this.lastRatingTime = null;
    this.totalRatingTime = 0;
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
    const { ratingConfig } = this.config;

    if (ratingConfig.weights) {
      const { technical, momentum, volume, risk } = ratingConfig.weights;
      const totalWeight = technical + momentum + volume + risk;
      
      if (Math.abs(totalWeight - 1.0) > 0.01) {
        throw new Error(`Rating weights must sum to 1.0, got ${totalWeight}`);
      }

      if (technical < 0 || momentum < 0 || volume < 0 || risk < 0) {
        throw new Error('All rating weights must be non-negative');
      }
    }

    if (ratingConfig.confidenceThreshold && 
        (ratingConfig.confidenceThreshold < 0 || ratingConfig.confidenceThreshold > 100)) {
      throw new Error('Confidence threshold must be between 0 and 100');
    }

    if (ratingConfig.smoothingFactor && 
        (ratingConfig.smoothingFactor < 0 || ratingConfig.smoothingFactor > 1)) {
      throw new Error('Smoothing factor must be between 0 and 1');
    }

    this.logger.debug('Configuration validated successfully');
  }

  private setupEventForwarding(): void {
    // Rating Engine doesn't emit events currently, but we could add them
    // For now, we'll emit our own events when rating calculations occur
    this.logger.debug('Event forwarding setup completed');
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

      // Simple health check - verify engine can provide statistics
      const statistics = this.engine.getRatingStatistics();
      const responseTime = Date.now() - startTime;

      // Consider healthy if engine is responding and has reasonable response time
      const isHealthy = responseTime < 1000; // 1 second threshold

      return {
        status: isHealthy ? 'healthy' : 'degraded',
        message: isHealthy ? 'All systems operational' : 'Response time elevated',
        responseTime,
        metadata: {
          statistics,
          metrics: this.getMetrics(),
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
 * Factory function to create a Rating Engine system component
 */
export function createRatingEngineSystemComponent(
  config: RatingEngineComponentConfig,
  logger: Logger,
  databaseManager?: DatabaseManager | undefined
): RatingEngineSystemComponent {
  const configWithDb: RatingEngineComponentConfig = {
    ...config,
    databaseManager: databaseManager || config.databaseManager
  };
  return new RatingEngineSystemComponent(configWithDb, logger);
}

/**
 * Factory function optimized for memecoin analysis
 */
export function createMemecoinRatingEngineSystemComponent(
  ratingConfig: Partial<RatingEngineConfig>,
  logger: Logger,
  databaseManager?: DatabaseManager | undefined
): RatingEngineSystemComponent {
  const config: RatingEngineComponentConfig = {
    ratingConfig: {
      weights: {
        technical: 0.4,  // 40% weight - Technical indicators
        momentum: 0.3,   // 30% weight - Momentum analysis  
        volume: 0.2,     // 20% weight - Volume analysis
        risk: 0.1,       // 10% weight - Risk assessment
        multiTimeframe: 0.0, // Will be set by RatingEngine defaults
        consecutiveMomentum: 0.0 // Will be set by RatingEngine defaults
      },
      adaptiveWeighting: true,
      riskAdjustment: true,
      confidenceThreshold: 70,
      smoothingFactor: 0.15,
      ...ratingConfig,
    },
    healthCheckInterval: 30000, // 30 seconds
    name: 'MemecoinRatingEngine',
    databaseManager
  };

  return new RatingEngineSystemComponent(config, logger);
}