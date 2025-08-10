/**
 * Performance Monitoring and Metrics Collection
 * Tracks system performance, API calls, processing times, and resource usage
 */

import { Logger } from 'winston';

export interface PerformanceMetrics {
  timestamp: string;
  operation: string;
  duration: number;
  success: boolean;
  metadata?: Record<string, any>;
}

export interface SystemMetrics {
  timestamp: string;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage?: NodeJS.CpuUsage;
  activeConnections?: number;
  queuedTasks?: number;
}

export interface AggregatedMetrics {
  operation: string;
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  averageDuration: number;
  minDuration: number;
  maxDuration: number;
  p95Duration: number;
  p99Duration: number;
  successRate: number;
  callsPerSecond: number;
}

export interface CacheMetrics {
  hits: number;
  misses: number;
  hitRate: number;
  totalRequests: number;
  averageSize: number;
  evictions: number;
}

/**
 * In-memory LRU cache with performance monitoring
 */
export class PerformanceCache<T> {
  private cache = new Map<string, { value: T; timestamp: number; accessCount: number }>();
  private metrics: CacheMetrics = {
    hits: 0,
    misses: 0,
    hitRate: 0,
    totalRequests: 0,
    averageSize: 0,
    evictions: 0
  };

  constructor(
    private maxSize: number = 1000,
    private ttlMs: number = 300000, // 5 minutes default
    private logger: Logger
  ) {}

  /**
   * Get value from cache
   */
  get(key: string): T | undefined {
    this.metrics.totalRequests++;
    
    const item = this.cache.get(key);
    if (!item) {
      this.metrics.misses++;
      this.updateHitRate();
      return undefined;
    }

    // Check TTL
    if (Date.now() - item.timestamp > this.ttlMs) {
      this.cache.delete(key);
      this.metrics.misses++;
      this.updateHitRate();
      return undefined;
    }

    // Update access stats
    item.accessCount++;
    this.metrics.hits++;
    this.updateHitRate();
    
    // Move to end (LRU behavior)
    this.cache.delete(key);
    this.cache.set(key, item);
    
    return item.value;
  }

  /**
   * Set value in cache
   */
  set(key: string, value: T): void {
    // Remove oldest items if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
      this.metrics.evictions++;
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      accessCount: 0
    });

    this.updateAverageSize();
  }

  /**
   * Check if key exists in cache
   */
  has(key: string): boolean {
    const item = this.cache.get(key);
    if (!item) return false;
    
    // Check TTL
    if (Date.now() - item.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * Clear cache
   */
  clear(): void {
    this.cache.clear();
    this.metrics.evictions += this.cache.size;
  }

  /**
   * Get cache metrics
   */
  getMetrics(): CacheMetrics {
    return { ...this.metrics };
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
    metrics: CacheMetrics;
    topKeys: Array<{ key: string; accessCount: number; age: number }>;
  } {
    const topKeys = Array.from(this.cache.entries())
      .map(([key, item]) => ({
        key: key.length > 50 ? key.substring(0, 50) + '...' : key,
        accessCount: item.accessCount,
        age: Date.now() - item.timestamp
      }))
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, 10);

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      metrics: this.getMetrics(),
      topKeys
    };
  }

  private updateHitRate(): void {
    this.metrics.hitRate = this.metrics.totalRequests > 0 ? 
      (this.metrics.hits / this.metrics.totalRequests) * 100 : 0;
  }

  private updateAverageSize(): void {
    this.metrics.averageSize = this.cache.size;
  }
}

/**
 * Performance monitor for tracking system metrics
 */
export class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private systemMetrics: SystemMetrics[] = [];
  private metricsCache: PerformanceCache<any>;
  private startTime = Date.now();
  private intervalId?: NodeJS.Timeout;
  private maxMetricsHistory = 10000;

  constructor(private logger: Logger) {
    this.metricsCache = new PerformanceCache(500, 600000, logger); // 10 minute TTL
    this.startSystemMonitoring();
  }

  /**
   * Track operation performance
   */
  async trackOperation<T>(
    operation: string,
    fn: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    const startTime = Date.now();
    let success = false;
    let error: Error | undefined;

    try {
      const result = await fn();
      success = true;
      return result;
    } catch (err) {
      error = err as Error;
      throw err;
    } finally {
      const duration = Date.now() - startTime;
      
      this.recordMetric({
        timestamp: new Date().toISOString(),
        operation,
        duration,
        success,
        metadata: {
          ...metadata,
          ...(error && { error: error.message })
        }
      });

      this.logger.debug('Operation tracked', {
        operation,
        duration,
        success,
        metadata
      });
    }
  }

  /**
   * Record a performance metric
   */
  recordMetric(metric: PerformanceMetrics): void {
    this.metrics.push(metric);
    
    // Keep only recent metrics to prevent memory issues
    if (this.metrics.length > this.maxMetricsHistory) {
      this.metrics = this.metrics.slice(-this.maxMetricsHistory * 0.8);
    }
  }

  /**
   * Get aggregated metrics for an operation
   */
  getAggregatedMetrics(
    operation: string, 
    timeWindowMs: number = 3600000 // 1 hour default
  ): AggregatedMetrics | null {
    const cutoff = Date.now() - timeWindowMs;
    const operationMetrics = this.metrics.filter(m => 
      m.operation === operation && 
      new Date(m.timestamp).getTime() > cutoff
    );

    if (operationMetrics.length === 0) {
      return null;
    }

    const durations = operationMetrics.map(m => m.duration).sort((a, b) => a - b);
    const successfulCalls = operationMetrics.filter(m => m.success).length;
    const totalCalls = operationMetrics.length;
    const timeSpanSeconds = (Date.now() - new Date(operationMetrics[0].timestamp).getTime()) / 1000;

    return {
      operation,
      totalCalls,
      successfulCalls,
      failedCalls: totalCalls - successfulCalls,
      averageDuration: durations.reduce((sum, d) => sum + d, 0) / durations.length,
      minDuration: durations[0],
      maxDuration: durations[durations.length - 1],
      p95Duration: durations[Math.floor(durations.length * 0.95)] || 0,
      p99Duration: durations[Math.floor(durations.length * 0.99)] || 0,
      successRate: (successfulCalls / totalCalls) * 100,
      callsPerSecond: timeSpanSeconds > 0 ? totalCalls / timeSpanSeconds : 0
    };
  }

  /**
   * Get all operation metrics summary
   */
  getAllMetricsSummary(timeWindowMs: number = 3600000): AggregatedMetrics[] {
    const cutoff = Date.now() - timeWindowMs;
    const recentMetrics = this.metrics.filter(m => 
      new Date(m.timestamp).getTime() > cutoff
    );

    const operationGroups = recentMetrics.reduce((groups, metric) => {
      if (!groups[metric.operation]) {
        groups[metric.operation] = [];
      }
      groups[metric.operation].push(metric);
      return groups;
    }, {} as Record<string, PerformanceMetrics[]>);

    return Object.keys(operationGroups).map(operation => {
      const metrics = operationGroups[operation];
      const durations = metrics.map(m => m.duration).sort((a, b) => a - b);
      const successfulCalls = metrics.filter(m => m.success).length;
      const totalCalls = metrics.length;
      const timeSpanSeconds = (Date.now() - new Date(metrics[0].timestamp).getTime()) / 1000;

      return {
        operation,
        totalCalls,
        successfulCalls,
        failedCalls: totalCalls - successfulCalls,
        averageDuration: durations.reduce((sum, d) => sum + d, 0) / durations.length,
        minDuration: durations[0],
        maxDuration: durations[durations.length - 1],
        p95Duration: durations[Math.floor(durations.length * 0.95)] || 0,
        p99Duration: durations[Math.floor(durations.length * 0.99)] || 0,
        successRate: (successfulCalls / totalCalls) * 100,
        callsPerSecond: timeSpanSeconds > 0 ? totalCalls / timeSpanSeconds : 0
      };
    }).sort((a, b) => b.totalCalls - a.totalCalls);
  }

  /**
   * Get system health metrics
   */
  getSystemHealth(): {
    uptime: number;
    memoryUsage: NodeJS.MemoryUsage;
    recentSystemMetrics: SystemMetrics[];
    cacheStats: any;
    performanceSummary: {
      totalOperations: number;
      recentFailureRate: number;
      averageResponseTime: number;
    };
  } {
    const recentMetrics = this.systemMetrics.slice(-10);
    const recentOperationMetrics = this.metrics.filter(m => 
      new Date(m.timestamp).getTime() > Date.now() - 300000 // 5 minutes
    );

    const failedOperations = recentOperationMetrics.filter(m => !m.success).length;
    const totalRecentOperations = recentOperationMetrics.length;
    const avgResponseTime = totalRecentOperations > 0 ? 
      recentOperationMetrics.reduce((sum, m) => sum + m.duration, 0) / totalRecentOperations : 0;

    return {
      uptime: Date.now() - this.startTime,
      memoryUsage: process.memoryUsage(),
      recentSystemMetrics: recentMetrics,
      cacheStats: this.metricsCache.getStats(),
      performanceSummary: {
        totalOperations: this.metrics.length,
        recentFailureRate: totalRecentOperations > 0 ? (failedOperations / totalRecentOperations) * 100 : 0,
        averageResponseTime: Math.round(avgResponseTime)
      }
    };
  }

  /**
   * Get cache instance for external use
   */
  getCache(): PerformanceCache<any> {
    return this.metricsCache;
  }

  /**
   * Get top slow operations
   */
  getSlowOperations(limit: number = 10, timeWindowMs: number = 3600000): Array<{
    operation: string;
    avgDuration: number;
    maxDuration: number;
    occurrences: number;
  }> {
    const cutoff = Date.now() - timeWindowMs;
    const recentMetrics = this.metrics.filter(m => 
      new Date(m.timestamp).getTime() > cutoff
    );

    const operationStats = recentMetrics.reduce((stats, metric) => {
      if (!stats[metric.operation]) {
        stats[metric.operation] = {
          operation: metric.operation,
          durations: [],
          occurrences: 0
        };
      }
      stats[metric.operation].durations.push(metric.duration);
      stats[metric.operation].occurrences++;
      return stats;
    }, {} as Record<string, any>);

    return Object.values(operationStats)
      .map((stat: any) => ({
        operation: stat.operation,
        avgDuration: stat.durations.reduce((sum: number, d: number) => sum + d, 0) / stat.durations.length,
        maxDuration: Math.max(...stat.durations),
        occurrences: stat.occurrences
      }))
      .sort((a, b) => b.avgDuration - a.avgDuration)
      .slice(0, limit);
  }

  /**
   * Start system monitoring
   */
  private startSystemMonitoring(): void {
    // Collect system metrics every 30 seconds
    this.intervalId = setInterval(() => {
      const systemMetric: SystemMetrics = {
        timestamp: new Date().toISOString(),
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage()
      };

      this.systemMetrics.push(systemMetric);
      
      // Keep only recent system metrics
      if (this.systemMetrics.length > 200) {
        this.systemMetrics = this.systemMetrics.slice(-100);
      }
    }, 30000);
  }

  /**
   * Stop monitoring and cleanup
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    
    this.logger.info('Performance monitor stopped', {
      totalMetricsCollected: this.metrics.length,
      uptime: Date.now() - this.startTime
    });
  }

  /**
   * Export metrics for external analysis
   */
  exportMetrics(timeWindowMs?: number): {
    performance: PerformanceMetrics[];
    system: SystemMetrics[];
    aggregated: AggregatedMetrics[];
    cache: any;
  } {
    const cutoff = timeWindowMs ? Date.now() - timeWindowMs : 0;
    
    return {
      performance: this.metrics.filter(m => new Date(m.timestamp).getTime() > cutoff),
      system: this.systemMetrics.filter(m => new Date(m.timestamp).getTime() > cutoff),
      aggregated: this.getAllMetricsSummary(timeWindowMs),
      cache: this.metricsCache.getStats()
    };
  }
}