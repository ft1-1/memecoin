import { EventEmitter } from 'events';
import { Logger } from 'winston';
import { AppConfig } from '@/types/config';

export interface ErrorContext {
  component?: string;
  operation?: string;
  metadata?: Record<string, any>;
  timestamp: Date;
  retryCount: number;
}

export interface RecoveryStrategy {
  name: string;
  canHandle(error: Error, context: ErrorContext): boolean;
  recover(error: Error, context: ErrorContext): Promise<boolean>;
  priority: number; // Lower numbers have higher priority
}

export interface RecoveryAttempt {
  error: Error;
  context: ErrorContext;
  strategy: string;
  success: boolean;
  duration: number;
  timestamp: Date;
}

/**
 * Handles error recovery and resilience strategies
 * Implements circuit breaker, retry logic, and graceful degradation
 */
export class ErrorRecovery extends EventEmitter {
  private readonly logger: Logger;
  private readonly config: AppConfig;
  private readonly strategies = new Map<string, RecoveryStrategy>();
  private readonly errorHistory = new Map<string, ErrorContext[]>();
  private readonly circuitBreakers = new Map<string, CircuitBreakerState>();
  
  private readonly maxErrorHistory = 100;
  private readonly circuitBreakerThreshold = 5;
  private readonly circuitBreakerTimeout = 60000; // 1 minute

  constructor(config: AppConfig, logger: Logger) {
    super();
    this.config = config;
    this.logger = logger;
    this.initializeDefaultStrategies();
  }

  /**
   * Register a recovery strategy
   */
  registerStrategy(strategy: RecoveryStrategy): void {
    this.strategies.set(strategy.name, strategy);
    this.logger.debug(`Registered recovery strategy: ${strategy.name}`);
  }

  /**
   * Handle an error with appropriate recovery strategy
   */
  async handleError(error: Error, operation: string, component?: string): Promise<boolean> {
    const context: ErrorContext = {
      component,
      operation,
      timestamp: new Date(),
      retryCount: this.getRetryCount(operation),
      metadata: {
        errorName: error.name,
        errorMessage: error.message,
      },
    };

    this.recordError(operation, context);
    
    // Check circuit breaker
    if (this.isCircuitOpen(operation)) {
      this.logger.warn(`Circuit breaker is open for operation: ${operation}`);
      return false;
    }

    // Find appropriate recovery strategy
    const strategy = this.findRecoveryStrategy(error, context);
    if (!strategy) {
      this.logger.error('No recovery strategy found for error', { error, context });
      this.recordCircuitBreakerFailure(operation);
      return false;
    }

    const startTime = Date.now();
    let success = false;

    try {
      this.logger.info(`Attempting recovery with strategy: ${strategy.name}`, { context });
      
      success = await strategy.recover(error, context);
      
      const duration = Date.now() - startTime;
      const attempt: RecoveryAttempt = {
        error,
        context,
        strategy: strategy.name,
        success,
        duration,
        timestamp: new Date(),
      };

      this.emit('recoveryAttempt', attempt);

      if (success) {
        this.logger.info('Error recovery successful', { strategy: strategy.name, duration });
        this.recordCircuitBreakerSuccess(operation);
      } else {
        this.logger.warn('Error recovery failed', { strategy: strategy.name, duration });
        this.recordCircuitBreakerFailure(operation);
      }

    } catch (recoveryError) {
      const duration = Date.now() - startTime;
      this.logger.error('Recovery strategy failed with error', {
        strategy: strategy.name,
        recoveryError,
        originalError: error,
        duration,
      });
      
      this.recordCircuitBreakerFailure(operation);
    }

    return success;
  }

  /**
   * Handle component-specific errors
   */
  async handleComponentError(component: string, error: Error): Promise<boolean> {
    return this.handleError(error, `component-${component}`, component);
  }

  /**
   * Get error statistics for an operation
   */
  getErrorStats(operation: string): {
    totalErrors: number;
    recentErrors: number;
    errorRate: number;
    lastError?: Date;
    circuitBreakerOpen: boolean;
  } {
    const history = this.errorHistory.get(operation) || [];
    const recentThreshold = Date.now() - (5 * 60 * 1000); // Last 5 minutes
    const recentErrors = history.filter(ctx => ctx.timestamp.getTime() > recentThreshold).length;
    
    return {
      totalErrors: history.length,
      recentErrors,
      errorRate: recentErrors / 5, // Errors per minute
      lastError: history.length > 0 ? history[history.length - 1].timestamp : undefined,
      circuitBreakerOpen: this.isCircuitOpen(operation),
    };
  }

  /**
   * Reset circuit breaker for an operation
   */
  resetCircuitBreaker(operation: string): void {
    this.circuitBreakers.delete(operation);
    this.logger.info(`Circuit breaker reset for operation: ${operation}`);
    this.emit('circuitBreakerReset', { operation, timestamp: new Date() });
  }

  /**
   * Get all circuit breaker states
   */
  getCircuitBreakerStates(): Record<string, CircuitBreakerState> {
    const states: Record<string, CircuitBreakerState> = {};
    for (const [operation, state] of this.circuitBreakers) {
      states[operation] = { ...state };
    }
    return states;
  }

  private initializeDefaultStrategies(): void {
    // Retry strategy for transient errors
    this.registerStrategy({
      name: 'retry',
      priority: 1,
      canHandle: (error: Error, context: ErrorContext) => {
        return (
          context.retryCount < 3 &&
          this.isTransientError(error)
        );
      },
      recover: async (error: Error, context: ErrorContext) => {
        const delay = Math.pow(2, context.retryCount) * 1000; // Exponential backoff
        const jitter = Math.random() * 0.1 * delay; // Add jitter
        
        await this.sleep(delay + jitter);
        return true; // Signal that retry should be attempted
      },
    });

    // API rate limit recovery
    this.registerStrategy({
      name: 'rate-limit',
      priority: 2,
      canHandle: (error: Error) => {
        return (
          error.message.includes('rate limit') ||
          error.message.includes('429') ||
          (error as any).status === 429
        );
      },
      recover: async (error: Error) => {
        // Extract retry-after header if available
        const retryAfter = (error as any).retryAfter || 60;
        const delay = Math.min(retryAfter * 1000, 300000); // Max 5 minutes
        
        this.logger.info(`Rate limit hit, waiting ${delay}ms`);
        await this.sleep(delay);
        return true;
      },
    });

    // Database connection recovery
    this.registerStrategy({
      name: 'database-reconnect',
      priority: 3,
      canHandle: (error: Error, context: ErrorContext) => {
        return (
          context.component === 'database' &&
          (error.message.includes('connection') ||
           error.message.includes('SQLITE_BUSY') ||
           error.message.includes('database is locked'))
        );
      },
      recover: async () => {
        // Database reconnection logic would be implemented here
        await this.sleep(2000);
        return true;
      },
    });

    // Network error recovery
    this.registerStrategy({
      name: 'network-retry',
      priority: 4,
      canHandle: (error: Error) => {
        return (
          error.message.includes('ECONNREFUSED') ||
          error.message.includes('ETIMEDOUT') ||
          error.message.includes('ENOTFOUND') ||
          error.message.includes('network')
        );
      },
      recover: async (error: Error, context: ErrorContext) => {
        const delay = Math.min(Math.pow(2, context.retryCount) * 2000, 30000);
        await this.sleep(delay);
        return true;
      },
    });

    // Graceful degradation for non-critical errors
    this.registerStrategy({
      name: 'graceful-degradation',
      priority: 10,
      canHandle: () => true, // Can handle any error as last resort
      recover: async (error: Error, context: ErrorContext) => {
        this.logger.warn('Applying graceful degradation', { error, context });
        
        // Continue operation with reduced functionality
        if (context.operation?.includes('notification')) {
          // Skip notifications but continue analysis
          return true;
        }
        
        if (context.operation?.includes('analysis')) {
          // Use cached data or skip this cycle
          return false;
        }
        
        return false;
      },
    });
  }

  private findRecoveryStrategy(error: Error, context: ErrorContext): RecoveryStrategy | null {
    const strategies = Array.from(this.strategies.values())
      .filter(strategy => strategy.canHandle(error, context))
      .sort((a, b) => a.priority - b.priority);

    return strategies[0] || null;
  }

  private recordError(operation: string, context: ErrorContext): void {
    if (!this.errorHistory.has(operation)) {
      this.errorHistory.set(operation, []);
    }

    const history = this.errorHistory.get(operation)!;
    history.push(context);

    // Keep only recent history
    if (history.length > this.maxErrorHistory) {
      history.splice(0, history.length - this.maxErrorHistory);
    }
  }

  private getRetryCount(operation: string): number {
    const history = this.errorHistory.get(operation) || [];
    const recentThreshold = Date.now() - (5 * 60 * 1000); // Last 5 minutes
    
    return history.filter(ctx => ctx.timestamp.getTime() > recentThreshold).length;
  }

  private isCircuitOpen(operation: string): boolean {
    const state = this.circuitBreakers.get(operation);
    if (!state) return false;

    if (state.state === 'open') {
      // Check if timeout has passed
      if (Date.now() > state.openUntil) {
        state.state = 'half-open';
        state.consecutiveFailures = 0;
        this.logger.info(`Circuit breaker transitioning to half-open: ${operation}`);
      }
    }

    return state.state === 'open';
  }

  private recordCircuitBreakerSuccess(operation: string): void {
    const state = this.circuitBreakers.get(operation);
    if (state) {
      state.consecutiveFailures = 0;
      if (state.state === 'half-open') {
        state.state = 'closed';
        this.logger.info(`Circuit breaker closed: ${operation}`);
        this.emit('circuitBreakerClosed', { operation, timestamp: new Date() });
      }
    }
  }

  private recordCircuitBreakerFailure(operation: string): void {
    let state = this.circuitBreakers.get(operation);
    if (!state) {
      state = {
        state: 'closed',
        consecutiveFailures: 0,
        openUntil: 0,
      };
      this.circuitBreakers.set(operation, state);
    }

    state.consecutiveFailures++;

    if (state.consecutiveFailures >= this.circuitBreakerThreshold) {
      state.state = 'open';
      state.openUntil = Date.now() + this.circuitBreakerTimeout;
      
      this.logger.warn(`Circuit breaker opened: ${operation}`, {
        consecutiveFailures: state.consecutiveFailures,
        openUntil: new Date(state.openUntil),
      });
      
      this.emit('circuitBreakerOpened', {
        operation,
        consecutiveFailures: state.consecutiveFailures,
        timestamp: new Date(),
      });
    }
  }

  private isTransientError(error: Error): boolean {
    const transientPatterns = [
      'timeout',
      'ETIMEDOUT',
      'ECONNREFUSED',
      'ENOTFOUND',
      'network',
      'temporary',
      'rate limit',
      '429',
      '500',
      '502',
      '503',
      '504',
    ];

    const errorString = error.message.toLowerCase();
    return transientPatterns.some(pattern => errorString.includes(pattern));
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half-open';
  consecutiveFailures: number;
  openUntil: number;
}