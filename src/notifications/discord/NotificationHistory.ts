/**
 * Notification history tracking and recovery system
 */
import { Logger } from '../../utils/Logger';
import {
  NotificationHistory as INotificationHistory,
  NotificationMessage,
  NotificationResult,
  TokenAlertData,
} from '../../types/notifications';

export interface HistoryConfig {
  maxEntries: number;
  retentionDays: number;
  persistencePath?: string;
  compressionThreshold: number;
  enableAnalytics: boolean;
}

export interface HistoryEntry extends INotificationHistory {
  processingTimeMs?: number;
  metadata?: {
    batchId?: string;
    retryAttempts?: number;
    webhookUrl?: string;
    embedCount?: number;
    contentLength?: number;
  };
}

export interface HistoryStats {
  totalNotifications: number;
  successRate: number;
  averageProcessingTime: number;
  notificationsByType: Record<string, number>;
  notificationsByHour: Record<string, number>;
  failureReasons: Record<string, number>;
  topTokens: Array<{ address: string; symbol: string; count: number }>;
  performanceMetrics: {
    p50ProcessingTime: number;
    p95ProcessingTime: number;
    p99ProcessingTime: number;
  };
}

export interface RecoveryOptions {
  startTime?: number;
  endTime?: number;
  provider?: string;
  status?: HistoryEntry['status'];
  tokenAddress?: string;
  maxRetries?: number;
}

export class NotificationHistory {
  private readonly logger = Logger.getInstance();
  private readonly config: HistoryConfig;
  private readonly entries = new Map<string, HistoryEntry>();
  private persistenceTimer?: NodeJS.Timeout;
  private analyticsCache?: HistoryStats;
  private analyticsCacheExpiry?: number;

  constructor(config: HistoryConfig) {
    this.config = config;
    this.loadPersistedHistory();
    this.setupAutoPersistence();
  }

  /**
   * Record notification attempt
   */
  async recordNotification(
    message: NotificationMessage,
    result: NotificationResult,
    provider: string,
    processingTimeMs?: number
  ): Promise<void> {
    const entry: HistoryEntry = {
      messageId: message.id,
      tokenAddress: this.extractTokenAddress(message),
      notificationType: message.type,
      provider,
      status: result.success ? 'sent' : 'failed',
      sentAt: Date.now(),
      attempts: message.retryCount + 1,
      processingTimeMs,
      error: result.error?.message,
      metadata: {
        retryAttempts: message.retryCount,
        embedCount: this.extractEmbedCount(result),
        contentLength: message.content.length,
      },
    };

    this.entries.set(message.id, entry);

    // Cleanup old entries if needed
    await this.cleanupOldEntries();

    // Invalidate analytics cache
    this.invalidateAnalyticsCache();

    this.logger.debug('Notification recorded in history', {
      messageId: message.id,
      status: entry.status,
      provider,
      processingTime: processingTimeMs,
    });
  }

  /**
   * Get notification history with optional filtering
   */
  getHistory(options: {
    limit?: number;
    offset?: number;
    startTime?: number;
    endTime?: number;
    status?: HistoryEntry['status'];
    provider?: string;
    tokenAddress?: string;
  } = {}): HistoryEntry[] {
    let filtered = Array.from(this.entries.values());

    // Apply filters
    if (options.startTime) {
      filtered = filtered.filter(entry => entry.sentAt >= options.startTime!);
    }
    if (options.endTime) {
      filtered = filtered.filter(entry => entry.sentAt <= options.endTime!);
    }
    if (options.status) {
      filtered = filtered.filter(entry => entry.status === options.status);
    }
    if (options.provider) {
      filtered = filtered.filter(entry => entry.provider === options.provider);
    }
    if (options.tokenAddress) {
      filtered = filtered.filter(entry => entry.tokenAddress === options.tokenAddress);
    }

    // Sort by timestamp (newest first)
    filtered.sort((a, b) => b.sentAt - a.sentAt);

    // Apply pagination
    const start = options.offset || 0;
    const end = start + (options.limit || filtered.length);
    
    return filtered.slice(start, end);
  }

  /**
   * Get notification statistics
   */
  async getStats(timeRange?: { start: number; end: number }): Promise<HistoryStats> {
    // Use cached analytics if available and fresh
    if (this.analyticsCache && this.analyticsCacheExpiry && Date.now() < this.analyticsCacheExpiry) {
      return this.analyticsCache;
    }

    const entries = timeRange
      ? this.getHistory({ startTime: timeRange.start, endTime: timeRange.end })
      : Array.from(this.entries.values());

    const stats = await this.calculateStats(entries);
    
    // Cache results for 5 minutes
    this.analyticsCache = stats;
    this.analyticsCacheExpiry = Date.now() + 5 * 60 * 1000;
    
    return stats;
  }

  /**
   * Get failed notifications for recovery
   */
  getFailedNotifications(options: RecoveryOptions = {}): HistoryEntry[] {
    return this.getHistory({
      ...options,
      status: 'failed',
    }).filter(entry => {
      if (options.maxRetries && entry.attempts >= options.maxRetries) {
        return false;
      }
      return true;
    });
  }

  /**
   * Mark notification as recovered
   */
  async markAsRecovered(messageId: string, recoveryResult: NotificationResult): Promise<void> {
    const entry = this.entries.get(messageId);
    if (!entry) {
      this.logger.warn('Attempted to mark unknown notification as recovered', { messageId });
      return;
    }

    entry.status = recoveryResult.success ? 'sent' : 'failed';
    entry.attempts += 1;
    entry.error = recoveryResult.error?.message;
    
    if (entry.metadata) {
      entry.metadata.retryAttempts = (entry.metadata.retryAttempts || 0) + 1;
    }

    this.invalidateAnalyticsCache();

    this.logger.info('Notification recovery recorded', {
      messageId,
      newStatus: entry.status,
      totalAttempts: entry.attempts,
    });
  }

  /**
   * Get notification patterns and insights
   */
  async getInsights(lookbackHours: number = 24): Promise<{
    successTrends: Array<{ hour: number; successRate: number }>;
    popularTokens: Array<{ address: string; symbol: string; notifications: number; avgRating: number }>;
    performanceIssues: Array<{ issue: string; severity: 'low' | 'medium' | 'high'; count: number }>;
    recommendations: string[];
  }> {
    const startTime = Date.now() - (lookbackHours * 60 * 60 * 1000);
    const entries = this.getHistory({ startTime });

    // Calculate success trends by hour
    const hourlyStats = new Map<number, { total: number; successful: number }>();
    
    for (const entry of entries) {
      const hour = new Date(entry.sentAt).getHours();
      const stats = hourlyStats.get(hour) || { total: 0, successful: 0 };
      stats.total++;
      if (entry.status === 'sent') {
        stats.successful++;
      }
      hourlyStats.set(hour, stats);
    }

    const successTrends = Array.from(hourlyStats.entries()).map(([hour, stats]) => ({
      hour,
      successRate: stats.successful / stats.total,
    }));

    // Analyze popular tokens
    const tokenStats = new Map<string, { count: number; symbol: string; ratings: number[] }>();
    
    for (const entry of entries) {
      if (entry.tokenAddress && entry.notificationType === 'token_alert') {
        // Try to extract token info from the entry or message metadata
        const stats = tokenStats.get(entry.tokenAddress) || { 
          count: 0, 
          symbol: entry.tokenAddress.slice(0, 8), 
          ratings: [] 
        };
        stats.count++;
        tokenStats.set(entry.tokenAddress, stats);
      }
    }

    const popularTokens = Array.from(tokenStats.entries())
      .map(([address, stats]) => ({
        address,
        symbol: stats.symbol,
        notifications: stats.count,
        avgRating: stats.ratings.length > 0 
          ? stats.ratings.reduce((sum, r) => sum + r, 0) / stats.ratings.length 
          : 0,
      }))
      .sort((a, b) => b.notifications - a.notifications)
      .slice(0, 10);

    // Identify performance issues
    const performanceIssues: Array<{ issue: string; severity: 'low' | 'medium' | 'high'; count: number }> = [];
    
    const failedCount = entries.filter(e => e.status === 'failed').length;
    const slowCount = entries.filter(e => (e.processingTimeMs || 0) > 5000).length;
    const retryCount = entries.filter(e => e.attempts > 1).length;

    if (failedCount > entries.length * 0.1) {
      performanceIssues.push({
        issue: 'High failure rate detected',
        severity: failedCount > entries.length * 0.2 ? 'high' : 'medium',
        count: failedCount,
      });
    }

    if (slowCount > entries.length * 0.05) {
      performanceIssues.push({
        issue: 'Slow processing times detected',
        severity: slowCount > entries.length * 0.1 ? 'medium' : 'low',
        count: slowCount,
      });
    }

    if (retryCount > entries.length * 0.15) {
      performanceIssues.push({
        issue: 'High retry rate detected',
        severity: 'medium',
        count: retryCount,
      });
    }

    // Generate recommendations
    const recommendations: string[] = [];
    
    if (performanceIssues.some(i => i.issue.includes('failure'))) {
      recommendations.push('Review webhook URL and Discord server permissions');
      recommendations.push('Check network connectivity and implement circuit breakers');
    }
    
    if (performanceIssues.some(i => i.issue.includes('slow'))) {
      recommendations.push('Optimize embed generation and reduce message complexity');
      recommendations.push('Consider implementing message batching for peak periods');
    }
    
    if (popularTokens.length > 0) {
      recommendations.push(`Focus analysis on top-performing tokens: ${popularTokens.slice(0, 3).map(t => t.symbol).join(', ')}`);
    }

    return {
      successTrends,
      popularTokens,
      performanceIssues,
      recommendations,
    };
  }

  /**
   * Export history data
   */
  async exportHistory(format: 'json' | 'csv' = 'json', options: {
    startTime?: number;
    endTime?: number;
    includePII?: boolean;
  } = {}): Promise<string> {
    const entries = this.getHistory(options);
    
    if (format === 'csv') {
      return this.exportAsCSV(entries, options.includePII);
    }
    
    return JSON.stringify(entries, null, 2);
  }

  /**
   * Clear old history entries
   */
  async clearOldEntries(olderThanDays: number): Promise<number> {
    const cutoff = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
    let removed = 0;
    
    for (const [messageId, entry] of this.entries) {
      if (entry.sentAt < cutoff) {
        this.entries.delete(messageId);
        removed++;
      }
    }
    
    this.invalidateAnalyticsCache();
    
    this.logger.info('Cleared old history entries', { removed, olderThanDays });
    
    return removed;
  }

  // Private methods

  private extractTokenAddress(message: NotificationMessage): string {
    if (message.type === 'token_alert' && message.metadata?.token) {
      return message.metadata.token.address;
    }
    return '';
  }

  private extractEmbedCount(result: NotificationResult): number {
    return result.metadata?.embedCount || 0;
  }

  private async calculateStats(entries: HistoryEntry[]): Promise<HistoryStats> {
    const total = entries.length;
    const successful = entries.filter(e => e.status === 'sent').length;
    const successRate = total > 0 ? successful / total : 0;

    // Processing times for performance metrics
    const processingTimes = entries
      .map(e => e.processingTimeMs)
      .filter(Boolean)
      .sort((a, b) => a! - b!);

    const averageProcessingTime = processingTimes.length > 0
      ? processingTimes.reduce((sum, time) => sum + time!, 0) / processingTimes.length
      : 0;

    // Notifications by type
    const notificationsByType: Record<string, number> = {};
    for (const entry of entries) {
      notificationsByType[entry.notificationType] = (notificationsByType[entry.notificationType] || 0) + 1;
    }

    // Notifications by hour
    const notificationsByHour: Record<string, number> = {};
    for (const entry of entries) {
      const hour = new Date(entry.sentAt).getHours().toString();
      notificationsByHour[hour] = (notificationsByHour[hour] || 0) + 1;
    }

    // Failure reasons
    const failureReasons: Record<string, number> = {};
    for (const entry of entries.filter(e => e.status === 'failed')) {
      const reason = entry.error || 'Unknown error';
      failureReasons[reason] = (failureReasons[reason] || 0) + 1;
    }

    // Top tokens
    const tokenCounts = new Map<string, { address: string; symbol: string; count: number }>();
    for (const entry of entries.filter(e => e.tokenAddress)) {
      const existing = tokenCounts.get(entry.tokenAddress);
      if (existing) {
        existing.count++;
      } else {
        tokenCounts.set(entry.tokenAddress, {
          address: entry.tokenAddress,
          symbol: entry.tokenAddress.slice(0, 8), // Fallback if symbol not available
          count: 1,
        });
      }
    }

    const topTokens = Array.from(tokenCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Performance percentiles
    const getPercentile = (arr: number[], percentile: number): number => {
      if (arr.length === 0) return 0;
      const index = Math.ceil((percentile / 100) * arr.length) - 1;
      return arr[Math.max(0, index)];
    };

    return {
      totalNotifications: total,
      successRate,
      averageProcessingTime,
      notificationsByType,
      notificationsByHour,
      failureReasons,
      topTokens,
      performanceMetrics: {
        p50ProcessingTime: getPercentile(processingTimes, 50),
        p95ProcessingTime: getPercentile(processingTimes, 95),
        p99ProcessingTime: getPercentile(processingTimes, 99),
      },
    };
  }

  private async cleanupOldEntries(): Promise<void> {
    if (this.entries.size <= this.config.maxEntries) {
      return;
    }

    // Remove entries beyond max count (keep newest)
    const sortedEntries = Array.from(this.entries.entries())
      .sort(([, a], [, b]) => b.sentAt - a.sentAt);

    const toRemove = sortedEntries.slice(this.config.maxEntries);
    
    for (const [messageId] of toRemove) {
      this.entries.delete(messageId);
    }

    // Also remove entries older than retention period
    const cutoff = Date.now() - (this.config.retentionDays * 24 * 60 * 60 * 1000);
    for (const [messageId, entry] of this.entries) {
      if (entry.sentAt < cutoff) {
        this.entries.delete(messageId);
      }
    }
  }

  private exportAsCSV(entries: HistoryEntry[], includePII: boolean = false): string {
    const headers = [
      'messageId',
      'notificationType',
      'provider',
      'status',
      'sentAt',
      'attempts',
      'processingTimeMs',
      'error',
    ];

    if (includePII) {
      headers.push('tokenAddress');
    }

    const rows = [headers.join(',')];
    
    for (const entry of entries) {
      const row = [
        entry.messageId,
        entry.notificationType,
        entry.provider,
        entry.status,
        new Date(entry.sentAt).toISOString(),
        entry.attempts.toString(),
        (entry.processingTimeMs || 0).toString(),
        `"${(entry.error || '').replace(/"/g, '""')}"`,
      ];

      if (includePII) {
        row.push(entry.tokenAddress || '');
      }

      rows.push(row.join(','));
    }

    return rows.join('\n');
  }

  private invalidateAnalyticsCache(): void {
    this.analyticsCache = undefined;
    this.analyticsCacheExpiry = undefined;
  }

  private setupAutoPersistence(): void {
    if (!this.config.persistencePath) return;

    this.persistenceTimer = setInterval(async () => {
      await this.persistHistory();
    }, 60000); // Persist every minute
  }

  private async persistHistory(): Promise<void> {
    if (!this.config.persistencePath) return;

    try {
      const fs = await import('fs/promises');
      const data = {
        entries: Array.from(this.entries.entries()),
        timestamp: Date.now(),
        version: '1.0',
      };

      await fs.writeFile(this.config.persistencePath, JSON.stringify(data, null, 2));
    } catch (error) {
      this.logger.error('Failed to persist notification history', { error });
    }
  }

  private async loadPersistedHistory(): Promise<void> {
    if (!this.config.persistencePath) return;

    try {
      const fs = await import('fs/promises');
      const data = await fs.readFile(this.config.persistencePath, 'utf-8');
      const parsed = JSON.parse(data);

      if (parsed.entries && Array.isArray(parsed.entries)) {
        for (const [messageId, entry] of parsed.entries) {
          this.entries.set(messageId, entry);
        }
      }

      this.logger.info('Loaded persisted notification history', {
        entryCount: this.entries.size,
      });
    } catch (error) {
      this.logger.debug('No persisted history found or failed to load', { 
        error: (error as Error).message 
      });
    }
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.persistenceTimer) {
      clearInterval(this.persistenceTimer);
    }

    // Final persistence
    this.persistHistory().catch(error => {
      this.logger.error('Failed final history persistence', { error });
    });

    this.logger.info('Notification history cleanup completed');
  }
}