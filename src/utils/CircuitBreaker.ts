/**
 * Circuit Breaker Implementation for Enhanced Error Handling
 * Provides graceful degradation when external services fail
 */

import { Logger } from 'winston';

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
  monitoringWindow: number;
  halfOpenMaxCalls: number;
}

export enum CircuitBreakerState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export interface CircuitBreakerStats {
  state: CircuitBreakerState;
  failureCount: number;
  successCount: number;
  lastFailureTime?: Date;
  lastSuccessTime?: Date;
  totalCalls: number;
  failureRate: number;
}

/**
 * Circuit breaker for protecting against cascading failures
 */
export class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime?: Date;
  private lastSuccessTime?: Date;
  private totalCalls = 0;
  private halfOpenCalls = 0;
  private nextAttempt?: Date;

  constructor(
    private name: string,
    private config: CircuitBreakerConfig,
    private logger: Logger
  ) {}

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>, fallback?: () => Promise<T>): Promise<T> {
    this.totalCalls++;

    if (this.state === CircuitBreakerState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitBreakerState.HALF_OPEN;
        this.halfOpenCalls = 0;
        this.logger.info(`Circuit breaker ${this.name} transitioning to HALF_OPEN`);
      } else {
        this.logger.warn(`Circuit breaker ${this.name} is OPEN, using fallback`);
        if (fallback) {
          return await fallback();
        }
        throw new Error(`Circuit breaker ${this.name} is OPEN`);
      }
    }

    if (this.state === CircuitBreakerState.HALF_OPEN && 
        this.halfOpenCalls >= this.config.halfOpenMaxCalls) {
      this.logger.warn(`Circuit breaker ${this.name} HALF_OPEN max calls exceeded, using fallback`);
      if (fallback) {
        return await fallback();
      }
      throw new Error(`Circuit breaker ${this.name} HALF_OPEN max calls exceeded`);
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      
      if (fallback) {
        this.logger.warn(`Circuit breaker ${this.name} function failed, using fallback`, {
          error: error instanceof Error ? error.message : String(error)
        });
        return await fallback();
      }
      
      throw error;
    }
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    this.successCount++;
    this.lastSuccessTime = new Date();

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.halfOpenCalls++;
      
      // If we've had enough successful calls in half-open, close the circuit
      if (this.halfOpenCalls >= this.config.halfOpenMaxCalls) {
        this.state = CircuitBreakerState.CLOSED;
        this.failureCount = 0;
        this.logger.info(`Circuit breaker ${this.name} transitioned to CLOSED after successful recovery`);
      }
    } else if (this.state === CircuitBreakerState.CLOSED) {
      // Reset failure count on success in closed state
      this.failureCount = Math.max(0, this.failureCount - 1);
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = new Date();

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      // Any failure in half-open immediately opens the circuit
      this.state = CircuitBreakerState.OPEN;
      this.nextAttempt = new Date(Date.now() + this.config.resetTimeout);
      this.logger.warn(`Circuit breaker ${this.name} failed in HALF_OPEN, transitioning to OPEN`);
    } else if (this.state === CircuitBreakerState.CLOSED && 
               this.failureCount >= this.config.failureThreshold) {
      // Too many failures in closed state, open the circuit
      this.state = CircuitBreakerState.OPEN;
      this.nextAttempt = new Date(Date.now() + this.config.resetTimeout);
      this.logger.error(`Circuit breaker ${this.name} failure threshold exceeded, transitioning to OPEN`, {
        failureCount: this.failureCount,
        threshold: this.config.failureThreshold
      });
    }
  }

  /**
   * Check if we should attempt to reset from OPEN to HALF_OPEN
   */
  private shouldAttemptReset(): boolean {
    return this.nextAttempt ? new Date() >= this.nextAttempt : false;
  }

  /**
   * Get current circuit breaker statistics
   */
  getStats(): CircuitBreakerStats {
    const failureRate = this.totalCalls > 0 ? 
      (this.failureCount / this.totalCalls) * 100 : 0;

    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      totalCalls: this.totalCalls,
      failureRate: parseFloat(failureRate.toFixed(2))
    };
  }

  /**
   * Manually reset the circuit breaker
   */
  reset(): void {
    this.state = CircuitBreakerState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.halfOpenCalls = 0;
    this.nextAttempt = undefined;
    this.lastFailureTime = undefined;
    this.lastSuccessTime = undefined;
    
    this.logger.info(`Circuit breaker ${this.name} manually reset`);
  }

  /**
   * Force circuit breaker to OPEN state
   */
  forceOpen(): void {
    this.state = CircuitBreakerState.OPEN;
    this.nextAttempt = new Date(Date.now() + this.config.resetTimeout);
    
    this.logger.warn(`Circuit breaker ${this.name} manually forced to OPEN`);
  }

  /**
   * Get current state
   */
  getState(): CircuitBreakerState {
    return this.state;
  }

  /**
   * Check if circuit breaker is available for calls
   */
  isAvailable(): boolean {
    return this.state === CircuitBreakerState.CLOSED || 
           (this.state === CircuitBreakerState.HALF_OPEN && 
            this.halfOpenCalls < this.config.halfOpenMaxCalls);
  }
}

/**
 * Circuit breaker manager for multiple services
 */
export class CircuitBreakerManager {
  private circuitBreakers = new Map<string, CircuitBreaker>();

  constructor(private logger: Logger) {}

  /**
   * Create or get a circuit breaker for a service
   */
  getCircuitBreaker(
    serviceName: string, 
    config: CircuitBreakerConfig
  ): CircuitBreaker {
    if (!this.circuitBreakers.has(serviceName)) {
      const circuitBreaker = new CircuitBreaker(serviceName, config, this.logger);
      this.circuitBreakers.set(serviceName, circuitBreaker);
      
      this.logger.info(`Created circuit breaker for service: ${serviceName}`, {
        config
      });
    }

    return this.circuitBreakers.get(serviceName)!;
  }

  /**
   * Get all circuit breaker statistics
   */
  getAllStats(): Record<string, CircuitBreakerStats> {
    const stats: Record<string, CircuitBreakerStats> = {};
    
    for (const [name, circuitBreaker] of this.circuitBreakers) {
      stats[name] = circuitBreaker.getStats();
    }
    
    return stats;
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    for (const [, circuitBreaker] of this.circuitBreakers) {
      circuitBreaker.reset();
    }
    
    this.logger.info('All circuit breakers reset');
  }

  /**
   * Get health status of all circuit breakers
   */
  getHealthStatus(): {
    healthy: string[];
    degraded: string[];
    unhealthy: string[];
  } {
    const healthy: string[] = [];
    const degraded: string[] = [];
    const unhealthy: string[] = [];

    for (const [name, circuitBreaker] of this.circuitBreakers) {
      const stats = circuitBreaker.getStats();
      
      if (stats.state === CircuitBreakerState.CLOSED && stats.failureRate < 10) {
        healthy.push(name);
      } else if (stats.state === CircuitBreakerState.HALF_OPEN || 
                 (stats.state === CircuitBreakerState.CLOSED && stats.failureRate < 50)) {
        degraded.push(name);
      } else {
        unhealthy.push(name);
      }
    }

    return { healthy, degraded, unhealthy };
  }
}