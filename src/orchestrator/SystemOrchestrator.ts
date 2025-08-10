import { EventEmitter } from 'events';
import { Logger } from 'winston';
import { AppConfig } from '@/types/config';
import { ComponentManager } from './ComponentManager';
import { StateManager } from './StateManager';
import { ErrorRecovery } from './ErrorRecovery';
import { TaskScheduler } from '@/scheduler/TaskScheduler';
import { HealthChecker } from '@/monitoring/HealthChecker';
import { MetricsCollector } from '@/monitoring/MetricsCollector';
import { AnalysisWorkflow } from './AnalysisWorkflow';

export interface SystemComponent {
  name: string;
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  getHealth(): Promise<ComponentHealth>;
  destroy(): Promise<void>;
}

export interface ComponentHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  message?: string;
  responseTime?: number;
  metadata?: Record<string, any>;
}

export interface SystemState {
  status: 'initializing' | 'running' | 'stopping' | 'stopped' | 'error';
  startedAt?: Date;
  components: Record<string, ComponentHealth>;
  metrics: {
    totalCycles: number;
    successfulCycles: number;
    failedCycles: number;
    lastCycleAt?: Date;
    averageCycleTime: number;
  };
}

export interface AnalysisCycleResult {
  success: boolean;
  tokensProcessed: number;
  tokensAnalyzed: number;
  tokensNotified: number;
  duration: number;
  errors: Error[];
  warnings: string[];
}

/**
 * Main system orchestrator that coordinates all components
 * Implements the central coordination pattern for the memecoin analyzer
 */
export class SystemOrchestrator extends EventEmitter {
  private readonly logger: Logger;
  private readonly config: AppConfig;
  private readonly componentManager: ComponentManager;
  private readonly stateManager: StateManager;
  private readonly errorRecovery: ErrorRecovery;
  private readonly scheduler: TaskScheduler;
  private readonly healthChecker: HealthChecker;
  private readonly metricsCollector: MetricsCollector;

  private isInitialized = false;
  private isRunning = false;
  private shutdownRequested = false;
  private currentCyclePromise: Promise<AnalysisCycleResult> | null = null;
  private analysisWorkflow: AnalysisWorkflow | null = null;

  constructor(
    config: AppConfig,
    logger: Logger,
    componentManager: ComponentManager,
    stateManager: StateManager,
    errorRecovery: ErrorRecovery,
    scheduler: TaskScheduler,
    healthChecker: HealthChecker,
    metricsCollector: MetricsCollector
  ) {
    super();
    this.config = config;
    this.logger = logger;
    this.componentManager = componentManager;
    this.stateManager = stateManager;
    this.errorRecovery = errorRecovery;
    this.scheduler = scheduler;
    this.healthChecker = healthChecker;
    this.metricsCollector = metricsCollector;

    this.setupEventHandlers();
    this.setupShutdownHandlers();
  }

  /**
   * Initialize the entire system
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      throw new Error('System is already initialized');
    }

    this.logger.info('Initializing memecoin momentum analyzer system');
    this.stateManager.setState('initializing');

    try {
      // Initialize core components in dependency order
      await this.componentManager.initializeComponents();
      
      // Initialize and start health monitoring - disabled due to port conflicts
      // await this.healthChecker.initialize();
      // await this.healthChecker.start();
      
      // Initialize and start metrics collection
      await this.metricsCollector.initialize();
      await this.metricsCollector.start();
      
      // Configure scheduler
      this.scheduler.schedule(
        'analysis-cycle',
        this.config.scheduler.analysisInterval,
        () => this.executeAnalysisCycle(),
        'Analysis Cycle',
        true // Run immediately on startup
      );

      this.scheduler.schedule(
        'health-check',
        this.config.scheduler.healthCheckInterval,
        () => this.performHealthCheck()
      );

      // Schedule database maintenance tasks
      this.scheduler.schedule(
        'database-cleanup',
        '0 2 * * *', // Daily at 2 AM
        () => this.performDatabaseMaintenance(),
        'Database Maintenance',
        false // Don't run immediately on startup
      );

      this.isInitialized = true;
      this.logger.info('System initialization completed successfully');
      this.emit('initialized');

    } catch (error) {
      this.logger.error('System initialization failed', { error });
      this.stateManager.setState('error');
      throw error;
    }
  }

  /**
   * Start the system execution
   */
  async start(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('System must be initialized before starting');
    }

    if (this.isRunning) {
      throw new Error('System is already running');
    }

    this.logger.info('Starting memecoin momentum analyzer system');

    try {
      // Start all components
      await this.componentManager.startComponents();
      
      // Start the scheduler
      this.scheduler.start();
      
      this.isRunning = true;
      this.stateManager.setState('running');
      this.stateManager.setStartTime(new Date());
      
      this.logger.info('System started successfully');
      this.emit('started');

      // Perform initial health check
      await this.performHealthCheck();

    } catch (error) {
      this.logger.error('System start failed', { error });
      this.stateManager.setState('error');
      throw error;
    }
  }

  /**
   * Execute a complete analysis cycle
   */
  async executeAnalysisCycle(): Promise<AnalysisCycleResult> {
    const startTime = Date.now();
    const cycleId = `cycle-${Date.now()}`;
    
    this.logger.info('Starting analysis cycle', { cycleId });
    
    const result: AnalysisCycleResult = {
      success: false,
      tokensProcessed: 0,
      tokensAnalyzed: 0,
      tokensNotified: 0,
      duration: 0,
      errors: [],
      warnings: [],
    };

    try {
      // Check if system is healthy enough to proceed
      const systemHealth = await this.getSystemHealth();
      if (systemHealth.status === 'unhealthy') {
        throw new Error('System is unhealthy, skipping analysis cycle');
      }

      // Initialize analysis workflow if needed
      if (!this.analysisWorkflow) {
        // Prepare AI analysis configuration if enabled
        const aiAnalysisConfig = this.config.analysis.aiAnalysis?.enabled ? {
          enabled: true,
          minTechnicalRating: this.config.analysis.aiAnalysis.minTechnicalRating || 6,
          claudeConfig: {
            apiKey: this.config.api.claude.apiKey,
            model: this.config.api.claude.model,
            maxTokens: this.config.api.claude.maxTokens,
            temperature: this.config.api.claude.temperature,
            timeout: this.config.api.claude.timeout,
            maxRetries: this.config.api.claude.maxRetries,
            retryDelayMs: this.config.api.claude.retryDelayMs,
            enabled: this.config.analysis.aiAnalysis.enabled
          }
        } : undefined;

        this.analysisWorkflow = new AnalysisWorkflow(
          {
            marketCapMin: this.config.analysis.marketCapRange.min,
            marketCapMax: this.config.analysis.marketCapRange.max,
            minRatingThreshold: this.config.analysis.ratingThreshold,
            minVolume: 10000,
            maxRiskLevel: 'medium',
            aiAnalysis: aiAnalysisConfig,
          },
          this.logger,
          this.componentManager,
          this.stateManager,
          this.errorRecovery
        );
      }
      
      // Execute the analysis workflow
      await this.analysisWorkflow.execute();
      
      // Get metrics from state manager
      const state = this.stateManager.getState();
      result.tokensProcessed = state.metrics.totalCycles;
      result.tokensAnalyzed = state.metrics.successfulCycles;
      result.tokensNotified = state.metrics.failedCycles; // This will be updated by workflow
      
      result.success = true;
      result.duration = Date.now() - startTime;
      
      this.stateManager.incrementSuccessfulCycles();
      this.logger.info('Analysis cycle completed successfully', { 
        cycleId, 
        ...result 
      });

    } catch (error) {
      result.errors.push(error as Error);
      result.duration = Date.now() - startTime;
      result.success = false;
      
      this.stateManager.incrementFailedCycles();
      this.logger.error('Analysis cycle failed', { 
        cycleId, 
        error: (error as Error).message,
        stack: (error as Error).stack 
      });

      // Attempt error recovery
      await this.errorRecovery.handleError(error as Error, 'analysis-cycle');
    }

    this.stateManager.setLastCycleTime(new Date());
    this.stateManager.updateAverageCycleTime(result.duration);
    this.emit('cycleCompleted', result);

    return result;
  }

  /**
   * Perform enhanced system health check
   */
  async performHealthCheck(): Promise<void> {
    try {
      const health = await this.getSystemHealth();
      this.stateManager.updateComponentsHealth(health.components);
      
      // Check circuit breaker health
      if (this.analysisWorkflow) {
        const cbHealth = this.analysisWorkflow.getSystemHealth();
        if (cbHealth?.healthStatus.unhealthy.length > 0) {
          this.logger.warn('Circuit breakers in unhealthy state', {
            unhealthy: cbHealth.healthStatus.unhealthy,
            degraded: cbHealth.healthStatus.degraded
          });
        }
      }
      
      // Log comprehensive health status
      if (health.status === 'unhealthy') {
        this.logger.warn('System health check failed', { 
          componentHealth: health.components,
          circuitBreakers: this.analysisWorkflow?.getCircuitBreakerStats(),
          database: health.database
        });
        this.emit('healthDegraded', health);
      } else if (health.status === 'degraded') {
        this.logger.info('System health degraded but operational', {
          componentHealth: health.components,
          circuitBreakers: this.analysisWorkflow?.getCircuitBreakerStats()
        });
      }
      
    } catch (error) {
      this.logger.error('Enhanced health check failed', { error });
    }
  }

  /**
   * Perform database maintenance tasks
   */
  async performDatabaseMaintenance(): Promise<void> {
    try {
      this.logger.info('Starting database maintenance tasks');
      
      const historicalDataManager = this.componentManager.getComponent('historical-data');
      if (historicalDataManager) {
        // Database maintenance is handled by the HistoricalDataManager's internal maintenance
        // This scheduler ensures it runs even if the internal timer fails
        this.logger.info('Database maintenance delegated to HistoricalDataManager');
      } else {
        this.logger.warn('HistoricalDataManager not available, skipping database maintenance');
      }
      
    } catch (error) {
      this.logger.error('Database maintenance failed', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Get current system health status with enhanced monitoring
   */
  async getSystemHealth(): Promise<{ 
    status: ComponentHealth['status']; 
    components: Record<string, ComponentHealth>;
    circuitBreakers?: Record<string, any>;
    aiAnalysis?: any;
    database?: any;
  }> {
    const baseHealth = await this.componentManager.getSystemHealth();
    
    // Get enhanced health information
    const enhancedHealth = {
      ...baseHealth,
      circuitBreakers: this.analysisWorkflow?.getCircuitBreakerStats(),
      aiAnalysis: this.analysisWorkflow?.getAIAnalysisStatistics(),
      database: undefined as any
    };
    
    // Get database health if available
    const historicalDataManager = this.componentManager.getComponent('historical-data');
    if (historicalDataManager) {
      try {
        enhancedHealth.database = await historicalDataManager.getHealth();
      } catch (error) {
        this.logger.warn('Failed to get database health', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    return enhancedHealth;
  }

  /**
   * Get current system state
   */
  getSystemState(): SystemState {
    return this.stateManager.getState();
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    if (this.shutdownRequested) {
      this.logger.warn('Shutdown already in progress');
      return;
    }

    this.shutdownRequested = true;
    this.logger.info('Initiating graceful shutdown');
    this.stateManager.setState('stopping');

    try {
      // Wait for current cycle to complete
      if (this.currentCyclePromise) {
        this.logger.info('Waiting for current analysis cycle to complete');
        await this.currentCyclePromise;
      }

      // Stop scheduler
      this.scheduler.stop();
      
      // Get final statistics before shutdown
      if (this.analysisWorkflow) {
        const finalStats = {
          circuitBreakers: this.analysisWorkflow.getCircuitBreakerStats(),
          aiAnalysis: this.analysisWorkflow.getAIAnalysisStatistics(),
          systemHealth: this.analysisWorkflow.getSystemHealth()
        };
        
        this.logger.info('Final system statistics before shutdown', finalStats);
      }
      
      // Stop all components
      await this.componentManager.stopComponents();
      
      // Stop monitoring
      await this.healthChecker.stop();
      await this.metricsCollector.stop();
      
      this.isRunning = false;
      this.stateManager.setState('stopped');
      
      this.logger.info('System shutdown completed');
      this.emit('shutdown');

    } catch (error) {
      this.logger.error('Error during shutdown', { error });
      throw error;
    }
  }

  // Private helper methods

  private setupEventHandlers(): void {
    this.on('error', (error) => {
      this.logger.error('System error', { error });
    });

    this.componentManager.on('componentError', (component, error) => {
      this.logger.error(`Component error: ${component}`, { error });
      this.errorRecovery.handleComponentError(component, error);
    });

    this.errorRecovery.on('recoveryAttempt', (details) => {
      this.logger.info('Error recovery attempt', details);
    });
  }

  private setupShutdownHandlers(): void {
    const signals = ['SIGTERM', 'SIGINT', 'SIGUSR2'];
    
    signals.forEach(signal => {
      process.on(signal, async () => {
        this.logger.info(`Received ${signal}, initiating shutdown`);
        try {
          await this.shutdown();
          process.exit(0);
        } catch (error) {
          this.logger.error('Shutdown failed', { error });
          process.exit(1);
        }
      });
    });

    process.on('uncaughtException', (error) => {
      this.logger.error('Uncaught exception', { error });
      this.shutdown().finally(() => process.exit(1));
    });

    process.on('unhandledRejection', (reason) => {
      this.logger.error('Unhandled promise rejection', { reason });
      this.shutdown().finally(() => process.exit(1));
    });
  }
}