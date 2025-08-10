/**
 * Production-ready rate limiter with circuit breaker pattern
 * Implements token bucket algorithm for precise rate limiting
 */

import { EventEmitter } from 'events';
import { Logger } from 'winston';
import { CircuitBreakerState, SolanaTrackerError } from './types';

export interface RateLimiterConfig {
  requestsPerSecond: number;
  burstCapacity?: number;          // Allow bursts up to this many requests
  windowSizeMs?: number;           // Time window for rate calculations
  enableCircuitBreaker: boolean;
  circuitBreaker: {
    failureThreshold: number;      // Number of failures to trip circuit
    successThreshold: number;      // Successful requests to close circuit
    timeout: number;               // How long to wait before retry (ms)
    monitoringWindow: number;      // Window to count failures (ms)
  };
}

export interface RateLimitStats {
  requestsInWindow: number;
  allowedRequests: number;
  tokensRemaining: number;
  nextRefillTime: number;
  circuitState: string;
  failureRate: number;
}

/**
 * Token bucket rate limiter with circuit breaker
 */
export class RateLimiter extends EventEmitter {
  private readonly config: Required<RateLimiterConfig>;
  private readonly logger: Logger;

  // Token bucket state
  private tokens: number;
  private lastRefill: number;
  private requestQueue: Array<{
    resolve: () => void;
    reject: (error: Error) => void;
    timestamp: number;
  }> = [];

  // Circuit breaker state
  private circuitState: CircuitBreakerState = {
    state: 'closed',
    failureCount: 0,
    successCount: 0,
    nextAttempt: 0,
    requestCount: 0,
    lastRequestTime: Date.now(),
  };

  // Exponential backoff state
  private backoffState = {
    consecutiveFailures: 0,
    baseDelayMs: 1000,
    maxDelayMs: 120000, // 2 minutes max
    lastFailureTime: 0,
  };

  // Monitoring
  private requestHistory: Array<{ timestamp: number; success: boolean }> = [];
  private stats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    rateLimitedRequests: 0,
    circuitBreakerTrips: 0,
  };

  constructor(config: RateLimiterConfig, logger: Logger) {
    super();
    
    this.config = {
      requestsPerSecond: config.requestsPerSecond,
      burstCapacity: config.burstCapacity || config.requestsPerSecond * 2,
      windowSizeMs: config.windowSizeMs || 60000, // 1 minute default
      enableCircuitBreaker: config.enableCircuitBreaker,
      circuitBreaker: {
        failureThreshold: config.circuitBreaker?.failureThreshold || 5,
        successThreshold: config.circuitBreaker?.successThreshold || 3,
        timeout: config.circuitBreaker?.timeout || 60000, // 1 minute
        monitoringWindow: config.circuitBreaker?.monitoringWindow || 300000, // 5 minutes
      },
    };

    this.logger = logger;
    this.tokens = this.config.burstCapacity;
    this.lastRefill = Date.now();

    // Start background tasks
    this.startTokenRefill();
    this.startStatsCleanup();

    this.logger.debug('Rate limiter initialized', {
      requestsPerSecond: this.config.requestsPerSecond,
      burstCapacity: this.config.burstCapacity,
      circuitBreakerEnabled: this.config.enableCircuitBreaker,
    });
  }

  /**
   * Acquire permission to make a request
   * Returns a promise that resolves when permission is granted
   */
  public async acquire(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.stats.totalRequests++;

      // Check circuit breaker first
      if (this.config.enableCircuitBreaker && this.isCircuitOpen()) {
        this.stats.rateLimitedRequests++;
        const error = new SolanaTrackerError(
          'Circuit breaker is open - service temporarily unavailable',
          'CIRCUIT_BREAKER_OPEN',
          503,
          true,
          false,
          Math.ceil((this.circuitState.nextAttempt - Date.now()) / 1000)
        );
        reject(error);
        return;
      }

      // Try to acquire token immediately
      if (this.tryAcquireToken()) {
        resolve();
        return;
      }

      // Queue the request
      this.requestQueue.push({
        resolve,
        reject,
        timestamp: Date.now(),
      });

      this.logger.debug('Request queued for rate limiting', {
        queueLength: this.requestQueue.length,
        tokensRemaining: this.tokens,
      });

      // Set timeout for queued requests to prevent indefinite waiting
      setTimeout(() => {
        const index = this.requestQueue.findIndex(req => req.resolve === resolve);
        if (index !== -1) {
          this.requestQueue.splice(index, 1);
          this.stats.rateLimitedRequests++;
          reject(new SolanaTrackerError(
            'Request timeout while waiting for rate limit',
            'RATE_LIMIT_TIMEOUT',
            429,
            true,
            true,
            this.calculateRetryAfter()
          ));
        }
      }, 60000); // Increased to 60 second timeout for better free tier support
    });
  }

  /**
   * Record the result of a request for circuit breaker
   */
  public recordResult(success: boolean, error?: SolanaTrackerError): void {
    const now = Date.now();
    
    // Update stats
    if (success) {
      this.stats.successfulRequests++;
      // Reset backoff on success
      this.backoffState.consecutiveFailures = 0;
    } else {
      this.stats.failedRequests++;
      // Increment backoff on failure
      this.backoffState.consecutiveFailures++;
      this.backoffState.lastFailureTime = now;
    }

    // Update request history for monitoring
    this.requestHistory.push({ timestamp: now, success });
    this.cleanupOldHistory();

    // Update circuit breaker state
    if (this.config.enableCircuitBreaker) {
      this.updateCircuitBreakerState(success, error);
    }

    this.emit('requestCompleted', { success, error, stats: this.getStats() });
  }

  /**
   * Get current rate limiting statistics
   */
  public getStats(): RateLimitStats {
    return {
      requestsInWindow: this.getRequestsInWindow(),
      allowedRequests: this.config.requestsPerSecond,
      tokensRemaining: Math.floor(this.tokens),
      nextRefillTime: this.lastRefill + (1000 / this.config.requestsPerSecond),
      circuitState: this.circuitState.state,
      failureRate: this.calculateFailureRate(),
    };
  }

  /**
   * Get comprehensive metrics
   */
  public getMetrics() {
    return {
      rateLimiter: {
        ...this.stats,
        queueLength: this.requestQueue.length,
        tokensRemaining: this.tokens,
        circuitBreakerState: this.circuitState.state,
        failureRate: this.calculateFailureRate(),
      },
      config: {
        requestsPerSecond: this.config.requestsPerSecond,
        burstCapacity: this.config.burstCapacity,
        circuitBreakerEnabled: this.config.enableCircuitBreaker,
      },
    };
  }

  /**
   * Reset circuit breaker (for testing or manual intervention)
   */
  public resetCircuitBreaker(): void {
    if (this.circuitState.state !== 'closed') {
      this.logger.info('Manually resetting circuit breaker');
    }
    
    this.circuitState = {
      state: 'closed',
      failureCount: 0,
      successCount: 0,
      nextAttempt: 0,
      requestCount: 0,
      lastRequestTime: Date.now(),
    };

    this.emit('circuitBreakerReset');
  }

  /**
   * Cleanup resources when shutting down
   */
  public destroy(): void {
    // Reject any pending requests
    this.requestQueue.forEach(req => {
      req.reject(new Error('Rate limiter shutting down'));
    });
    this.requestQueue = [];
    
    this.removeAllListeners();
    this.logger.debug('Rate limiter destroyed');
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private tryAcquireToken(): boolean {
    this.refillTokens();
    
    if (this.tokens >= 1) {
      this.tokens -= 1;
      this.logger.debug('Token acquired', { 
        tokensRemaining: this.tokens,
        requestsInQueue: this.requestQueue.length 
      });
      return true;
    }
    
    return false;
  }

  private refillTokens(): void {
    const now = Date.now();
    const timePassed = now - this.lastRefill;
    const tokensToAdd = (timePassed / 1000) * this.config.requestsPerSecond;
    
    if (tokensToAdd >= 1) {
      this.tokens = Math.min(
        this.config.burstCapacity,
        this.tokens + Math.floor(tokensToAdd)
      );
      this.lastRefill = now;
    }
  }

  private startTokenRefill(): void {
    // Process queue every 100ms for responsive rate limiting
    setInterval(() => {
      this.processQueue();
    }, 100);
  }

  private processQueue(): void {
    while (this.requestQueue.length > 0 && this.tryAcquireToken()) {
      const request = this.requestQueue.shift();
      if (request) {
        // Check if request hasn't timed out
        if (Date.now() - request.timestamp < 30000) {
          request.resolve();
        } else {
          this.stats.rateLimitedRequests++;
        }
      }
    }
  }

  private isCircuitOpen(): boolean {
    const now = Date.now();
    
    switch (this.circuitState.state) {
      case 'open':
        if (now >= this.circuitState.nextAttempt) {
          this.circuitState.state = 'half-open';
          this.circuitState.successCount = 0;
          this.logger.info('Circuit breaker transitioning to half-open');
          this.emit('circuitBreakerStateChange', 'half-open');
          return false;
        }
        return true;
        
      case 'half-open':
        return false;
        
      case 'closed':
      default:
        return false;
    }
  }

  private updateCircuitBreakerState(success: boolean, error?: SolanaTrackerError): void {
    const now = Date.now();
    this.circuitState.requestCount++;
    this.circuitState.lastRequestTime = now;

    if (success) {
      this.circuitState.successCount++;
      
      // If in half-open state and we have enough successes, close the circuit
      if (this.circuitState.state === 'half-open' && 
          this.circuitState.successCount >= this.config.circuitBreaker.successThreshold) {
        this.circuitState.state = 'closed';
        this.circuitState.failureCount = 0;
        this.logger.info('Circuit breaker closed after successful requests');
        this.emit('circuitBreakerStateChange', 'closed');
      }
    } else {
      // Only count certain types of errors as circuit breaker failures
      // Specifically EXCLUDE 429 (rate limit) errors from circuit breaker logic
      const shouldCountFailure = error && (
        (error.status >= 500 && error.status !== 429) || 
        error.code === 'TIMEOUT' || 
        error.code === 'NETWORK_ERROR'
      ) && !error.rateLimited;

      if (shouldCountFailure) {
        this.circuitState.failureCount++;
        
        // Check if we should open the circuit
        const failureRate = this.calculateFailureRate();
        const shouldOpen = this.circuitState.failureCount >= this.config.circuitBreaker.failureThreshold ||
                          (failureRate > 0.5 && this.circuitState.requestCount >= 10);

        if (shouldOpen && this.circuitState.state !== 'open') {
          this.circuitState.state = 'open';
          this.circuitState.nextAttempt = now + this.config.circuitBreaker.timeout;
          this.stats.circuitBreakerTrips++;
          
          this.logger.warn('Circuit breaker opened due to failures', {
            failureCount: this.circuitState.failureCount,
            failureRate,
            nextAttempt: new Date(this.circuitState.nextAttempt).toISOString(),
          });
          
          this.emit('circuitBreakerStateChange', 'open');
        }
      }
    }
  }

  private calculateFailureRate(): number {
    const recentRequests = this.requestHistory.filter(
      req => Date.now() - req.timestamp < this.config.circuitBreaker.monitoringWindow
    );
    
    if (recentRequests.length === 0) return 0;
    
    const failures = recentRequests.filter(req => !req.success).length;
    return failures / recentRequests.length;
  }

  private getRequestsInWindow(): number {
    const now = Date.now();
    return this.requestHistory.filter(
      req => now - req.timestamp < this.config.windowSizeMs
    ).length;
  }

  private cleanupOldHistory(): void {
    const cutoff = Date.now() - this.config.circuitBreaker.monitoringWindow;
    this.requestHistory = this.requestHistory.filter(req => req.timestamp > cutoff);
  }

  private startStatsCleanup(): void {
    // Clean up old history every minute
    setInterval(() => {
      this.cleanupOldHistory();
    }, 60000);
  }

  /**
   * Calculate retry after time for rate limiting with jitter
   */
  private calculateRetryAfter(): number {
    if (this.backoffState.consecutiveFailures === 0) {
      return 1; // Default 1 second
    }

    // Exponential backoff: base * 2^failures with jitter
    const exponentialDelay = this.backoffState.baseDelayMs * Math.pow(2, Math.min(this.backoffState.consecutiveFailures - 1, 6)); // Cap at 2^6 = 64x
    const cappedDelay = Math.min(exponentialDelay, this.backoffState.maxDelayMs);
    
    // Add jitter (±20% random variation)
    const jitter = cappedDelay * 0.2 * (Math.random() - 0.5);
    const finalDelay = Math.max(1000, cappedDelay + jitter); // Min 1 second
    
    return Math.ceil(finalDelay / 1000); // Return in seconds
  }

  /**
   * Calculate exponential backoff delay with jitter for errors
   */
  public calculateBackoffDelay(error?: SolanaTrackerError, retryCount: number = 0): number {
    // For 429 rate limit errors, use a more aggressive backoff
    if (error && error.status === 429) {
      const baseDelay = error.retryAfter ? error.retryAfter * 1000 : 2000; // 2 seconds default
      const exponentialMultiplier = Math.pow(2, retryCount);
      const delay = Math.min(baseDelay * exponentialMultiplier, 300000); // Max 5 minutes
      
      // Add jitter for rate limit errors (±30% to spread load)
      const jitter = delay * 0.3 * (Math.random() - 0.5);
      return Math.max(2000, delay + jitter); // Min 2 seconds for rate limits
    }

    // For other errors, use standard exponential backoff
    const baseDelay = this.backoffState.baseDelayMs;
    const exponentialDelay = baseDelay * Math.pow(2, Math.min(retryCount, 6)); // Cap at 2^6
    const cappedDelay = Math.min(exponentialDelay, this.backoffState.maxDelayMs);
    
    // Add jitter (±20%)
    const jitter = cappedDelay * 0.2 * (Math.random() - 0.5);
    return Math.max(1000, cappedDelay + jitter); // Min 1 second
  }

  /**
   * Reset backoff state (for manual intervention)
   */
  public resetBackoff(): void {
    this.backoffState.consecutiveFailures = 0;
    this.backoffState.lastFailureTime = 0;
    this.logger.debug('Backoff state reset');
  }
}