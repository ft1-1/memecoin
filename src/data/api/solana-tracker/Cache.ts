/**
 * Production-ready caching system with TTL and LRU eviction
 * Optimized for API response caching with different TTL strategies
 */

import { EventEmitter } from 'events';
import { Logger } from 'winston';
import { CacheEntry, CacheStats } from './types';

export interface CacheConfig {
  maxSize: number;                    // Maximum number of entries
  defaultTtl: number;                 // Default TTL in milliseconds
  cleanupInterval: number;            // How often to run cleanup (ms)
  enableStats: boolean;               // Whether to collect statistics
  
  // TTL strategies for different data types
  ttlStrategies: {
    tokenMetadata: number;            // 1 hour for token metadata
    priceData: number;                // 30 seconds for price data
    chartData: number;                // 5 minutes for chart data
    riskScores: number;               // 30 minutes for risk scores
    trendingTokens: number;           // 2 minutes for trending data
  };
}

/**
 * LRU Cache with TTL support and different caching strategies
 */
export class ApiCache extends EventEmitter {
  private readonly config: CacheConfig;
  private readonly logger: Logger;
  private readonly cache = new Map<string, CacheEntry<any>>();
  private readonly accessOrder = new Map<string, number>(); // Track access order for LRU
  private cleanupTimer?: NodeJS.Timeout;

  // Statistics
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    size: 0,
    hitRate: 0,
  };

  constructor(config: CacheConfig, logger: Logger) {
    super();
    this.config = config;
    this.logger = logger;

    // Start cleanup timer
    this.startCleanup();

    this.logger.debug('API cache initialized', {
      maxSize: config.maxSize,
      defaultTtl: config.defaultTtl,
      cleanupInterval: config.cleanupInterval,
    });
  }

  /**
   * Get value from cache
   */
  public get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.recordMiss(key);
      return null;
    }

    // Check if entry has expired
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      this.accessOrder.delete(key);
      this.recordMiss(key);
      this.emit('entryExpired', { key, entry });
      return null;
    }

    // Update access order for LRU
    this.accessOrder.set(key, Date.now());
    this.recordHit(key);
    
    this.logger.debug('Cache hit', { key, ttlRemaining: entry.ttl - (Date.now() - entry.timestamp) });
    return entry.data;
  }

  /**
   * Set value in cache with optional TTL
   */
  public set<T>(key: string, value: T, ttl?: number): void {
    const now = Date.now();
    const effectiveTtl = ttl || this.getTtlForKey(key);
    
    const entry: CacheEntry<T> = {
      key,
      data: value,
      timestamp: now,
      ttl: effectiveTtl,
    };

    // If cache is full, remove LRU entry
    if (this.cache.size >= this.config.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    this.cache.set(key, entry);
    this.accessOrder.set(key, now);
    
    this.updateStats();
    this.emit('entrySet', { key, ttl: effectiveTtl });
    
    this.logger.debug('Cache set', { key, ttl: effectiveTtl, size: this.cache.size });
  }

  /**
   * Check if key exists and is not expired
   */
  public has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      this.accessOrder.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * Delete specific key
   */
  public delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.accessOrder.delete(key);
      this.updateStats();
      this.emit('entryDeleted', { key });
    }
    return deleted;
  }

  /**
   * Clear all entries
   */
  public clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    this.accessOrder.clear();
    this.updateStats();
    this.emit('cacheCleared', { entriesRemoved: size });
    this.logger.info('Cache cleared', { entriesRemoved: size });
  }

  /**
   * Get cache statistics
   */
  public getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Get detailed cache information
   */
  public getInfo() {
    const now = Date.now();
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      size: this.estimateSize(entry.data),
      ttlRemaining: Math.max(0, entry.ttl - (now - entry.timestamp)),
      isExpired: this.isExpired(entry),
      lastAccessed: this.accessOrder.get(key) || entry.timestamp,
    }));

    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      stats: this.getStats(),
      entries: entries.sort((a, b) => b.lastAccessed - a.lastAccessed),
    };
  }

  /**
   * Get cache health metrics
   */
  public getHealthMetrics() {
    const expiredEntries = Array.from(this.cache.values()).filter(entry => this.isExpired(entry));
    const totalMemoryEstimate = Array.from(this.cache.values())
      .reduce((acc, entry) => acc + this.estimateSize(entry.data), 0);

    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      utilization: this.cache.size / this.config.maxSize,
      hitRate: this.stats.hitRate,
      expiredEntries: expiredEntries.length,
      memoryEstimateMB: Math.round(totalMemoryEstimate / (1024 * 1024) * 100) / 100,
      isHealthy: this.stats.hitRate > 0.5 && expiredEntries.length < this.cache.size * 0.1,
    };
  }

  /**
   * Invalidate entries matching a pattern
   */
  public invalidatePattern(pattern: RegExp): number {
    let invalidated = 0;
    
    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        this.cache.delete(key);
        this.accessOrder.delete(key);
        invalidated++;
      }
    }

    if (invalidated > 0) {
      this.updateStats();
      this.emit('patternInvalidated', { pattern: pattern.source, invalidated });
      this.logger.info('Cache entries invalidated by pattern', { 
        pattern: pattern.source, 
        invalidated 
      });
    }

    return invalidated;
  }

  /**
   * Cleanup and destroy cache
   */
  public destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    
    const size = this.cache.size;
    this.clear();
    this.removeAllListeners();
    
    this.logger.debug('Cache destroyed', { entriesRemoved: size });
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private getTtlForKey(key: string): number {
    // Determine TTL based on key patterns
    if (key.startsWith('token:') && key.includes(':metadata')) {
      return this.config.ttlStrategies.tokenMetadata;
    }
    if (key.startsWith('price:') || key.includes(':price')) {
      return this.config.ttlStrategies.priceData;
    }
    if (key.startsWith('chart:') || key.includes(':chart')) {
      return this.config.ttlStrategies.chartData;
    }
    if (key.includes(':risk') || key.includes('risk:')) {
      return this.config.ttlStrategies.riskScores;
    }
    if (key.startsWith('trending:') || key.includes('trending')) {
      return this.config.ttlStrategies.trendingTokens;
    }
    
    return this.config.defaultTtl;
  }

  private isExpired(entry: CacheEntry<any>): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    // Find the least recently used entry
    for (const [key, accessTime] of this.accessOrder.entries()) {
      if (accessTime < oldestTime) {
        oldestTime = accessTime;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      const entry = this.cache.get(oldestKey);
      this.cache.delete(oldestKey);
      this.accessOrder.delete(oldestKey);
      
      this.emit('entryEvicted', { key: oldestKey, entry, reason: 'lru' });
      this.logger.debug('Cache entry evicted (LRU)', { key: oldestKey });
    }
  }

  private recordHit(key: string): void {
    if (this.config.enableStats) {
      this.stats.hits++;
      this.updateHitRate();
      this.emit('cacheHit', { key });
    }
  }

  private recordMiss(key: string): void {
    if (this.config.enableStats) {
      this.stats.misses++;
      this.updateHitRate();
      this.emit('cacheMiss', { key });
    }
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }

  private updateStats(): void {
    this.stats.size = this.cache.size;
  }

  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  private cleanup(): void {
    const before = this.cache.size;
    let expiredCount = 0;

    // Remove expired entries
    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        this.cache.delete(key);
        this.accessOrder.delete(key);
        expiredCount++;
        this.emit('entryExpired', { key, entry });
      }
    }

    if (expiredCount > 0) {
      this.updateStats();
      this.logger.debug('Cache cleanup completed', {
        expired: expiredCount,
        sizeBefore: before,
        sizeAfter: this.cache.size,
      });
    }
  }

  private estimateSize(obj: any): number {
    // Rough estimation of object size in bytes
    if (obj === null || obj === undefined) return 0;
    if (typeof obj === 'string') return obj.length * 2; // Rough UTF-16 estimation
    if (typeof obj === 'number') return 8;
    if (typeof obj === 'boolean') return 4;
    if (Array.isArray(obj)) {
      return obj.reduce((acc, item) => acc + this.estimateSize(item), 0);
    }
    if (typeof obj === 'object') {
      return Object.keys(obj).reduce((acc, key) => {
        return acc + key.length * 2 + this.estimateSize(obj[key]);
      }, 0);
    }
    return 0;
  }
}