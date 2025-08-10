/**
 * Discord notification system - Main exports
 */

// Main service
export { DiscordNotificationService } from './DiscordNotificationService';
export type { DiscordServiceConfig } from './DiscordNotificationService';

// System component wrapper
export { 
  DiscordNotificationSystemComponent,
  createDiscordNotificationSystemComponent,
  createMemecoinNotificationSystemComponent 
} from './DiscordNotificationSystemComponent';
export type { DiscordNotificationComponentConfig } from './DiscordNotificationSystemComponent';

// Core components
export { DiscordWebhookClient } from './DiscordWebhookClient';
export type { 
  DiscordWebhookConfig, 
  RateLimitConfig, 
  RetryConfig 
} from './DiscordWebhookClient';

export { NotificationQueue } from './NotificationQueue';
export type { QueueConfig } from './NotificationQueue';

export { NotificationBatcher } from './NotificationBatcher';
export type { BatchConfig, BatchGroup } from './NotificationBatcher';

export { NotificationHistory } from './NotificationHistory';
export type { 
  HistoryConfig, 
  HistoryEntry, 
  HistoryStats, 
  RecoveryOptions 
} from './NotificationHistory';

// Templates and styling
export { EmbedTemplates, EMBED_COLORS, EMBED_ICONS } from './EmbedTemplates';
export type { EmbedColors, EmbedIcons } from './EmbedTemplates';

// Configuration factory
export class DiscordConfigFactory {
  /**
   * Create production-ready Discord service configuration
   */
  static createProductionConfig(options: {
    webhookUrl: string;
    userAgent?: string;
    persistencePath?: string;
    enableBatching?: boolean;
    enableAnalytics?: boolean;
  }): DiscordServiceConfig {
    return {
      webhook: {
        webhookUrl: options.webhookUrl,
        userAgent: options.userAgent || 'Memecoin Analyzer Bot/1.0',
        timeout: 10000,
        rateLimit: {
          messagesPerSecond: 2.5, // Discord allows 5 per 2 seconds
          burstLimit: 5,
          resetIntervalMs: 2000,
        },
        retry: {
          maxAttempts: 3,
          initialDelayMs: 1000,
          maxDelayMs: 30000,
          backoffMultiplier: 2,
          retryableStatusCodes: [408, 429, 500, 502, 503, 504],
        },
      },
      queue: {
        maxSize: 1000,
        concurrency: 3,
        retryDelayMs: 5000,
        maxRetries: 3,
        persistencePath: options.persistencePath ? `${options.persistencePath}/queue.json` : undefined,
        processingTimeoutMs: 30000,
        batchSize: 10,
        batchTimeoutMs: 30000,
      },
      batch: {
        enabled: options.enableBatching ?? true,
        maxBatchSize: 5,
        batchTimeoutMs: 60000, // 1 minute
        deduplicationWindowMs: 300000, // 5 minutes
        similarityThreshold: 0.8,
        groupingStrategy: 'rating',
        minRatingForBatching: 6,
      },
      history: {
        maxEntries: 10000,
        retentionDays: 30,
        persistencePath: options.persistencePath ? `${options.persistencePath}/history.json` : undefined,
        compressionThreshold: 1000,
        enableAnalytics: options.enableAnalytics ?? true,
      },
      notifications: {
        enabled: true,
        rateLimits: {
          messagesPerMinute: 20,
          messagesPerHour: 200,
          messagesPerDay: 2000,
        },
        retry: {
          maxAttempts: 3,
          backoffMultiplier: 2,
          initialDelay: 1000,
          maxDelay: 60000,
        },
        filters: {
          minRating: 7,
          maxNotificationsPerToken: 3,
          cooldownMinutes: 30,
          priorityThresholds: {
            low: 0.5,
            medium: 0.8,
            high: 0.95,
            critical: 1.0,
          },
        },
      },
      testMode: false,
      enableHealthChecks: true,
      healthCheckInterval: 60000, // 1 minute
    };
  }

  /**
   * Create development configuration with more lenient settings
   */
  static createDevelopmentConfig(options: {
    webhookUrl: string;
    userAgent?: string;
  }): DiscordServiceConfig {
    const prodConfig = this.createProductionConfig(options);
    
    return {
      ...prodConfig,
      testMode: true,
      batch: {
        ...prodConfig.batch,
        enabled: false, // Disable batching in development
        batchTimeoutMs: 10000, // Shorter timeout for testing
      },
      notifications: {
        ...prodConfig.notifications,
        filters: {
          ...prodConfig.notifications.filters,
          minRating: 5, // Lower threshold for development
          cooldownMinutes: 1, // Shorter cooldown
        },
      },
      queue: {
        ...prodConfig.queue,
        maxSize: 100,
        concurrency: 1,
      },
      history: {
        ...prodConfig.history,
        maxEntries: 1000,
        retentionDays: 7,
      },
    };
  }

  /**
   * Create high-volume configuration for busy periods
   */
  static createHighVolumeConfig(options: {
    webhookUrl: string;
    userAgent?: string;
    persistencePath?: string;
  }): DiscordServiceConfig {
    const prodConfig = this.createProductionConfig(options);
    
    return {
      ...prodConfig,
      webhook: {
        ...prodConfig.webhook,
        rateLimit: {
          ...prodConfig.webhook.rateLimit,
          messagesPerSecond: 2, // More conservative
          burstLimit: 3,
        },
      },
      batch: {
        ...prodConfig.batch,
        enabled: true,
        maxBatchSize: 10, // Larger batches
        batchTimeoutMs: 30000, // Shorter timeout
        minRatingForBatching: 8, // Only batch high-rated alerts
      },
      notifications: {
        ...prodConfig.notifications,
        filters: {
          ...prodConfig.notifications.filters,
          minRating: 8, // Higher threshold during busy periods
          maxNotificationsPerToken: 2,
          cooldownMinutes: 60, // Longer cooldown
        },
      },
      queue: {
        ...prodConfig.queue,
        maxSize: 2000,
        concurrency: 2, // Lower concurrency to prevent overload
      },
    };
  }
}

// Utility functions
export const DiscordUtils = {
  /**
   * Validate webhook URL format
   */
  validateWebhookUrl(url: string): boolean {
    const webhookPattern = /^https:\/\/discord\.com\/api\/webhooks\/\d+\/[\w-]+$/;
    return webhookPattern.test(url);
  },

  /**
   * Extract webhook ID from URL
   */
  extractWebhookId(url: string): string | null {
    const match = url.match(/webhooks\/(\d+)\//);
    return match ? match[1] : null;
  },

  /**
   * Sanitize content for Discord
   */
  sanitizeContent(content: string): string {
    return content
      .replace(/`/g, '\\`') // Escape backticks
      .replace(/\*/g, '\\*') // Escape asterisks
      .replace(/_/g, '\\_') // Escape underscores
      .replace(/~/g, '\\~') // Escape tildes
      .replace(/\|/g, '\\|') // Escape pipes
      .slice(0, 2000); // Truncate to Discord limit
  },

  /**
   * Format number for Discord display
   */
  formatNumber(num: number): string {
    if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
    return num.toFixed(0);
  },

  /**
   * Format percentage change with emoji
   */
  formatPercentageChange(change: number): string {
    const emoji = change >= 0 ? '📈' : '📉';
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(2)}% ${emoji}`;
  },

  /**
   * Generate color based on value range
   */
  getColorForValue(value: number, min: number, max: number): number {
    const ratio = Math.max(0, Math.min(1, (value - min) / (max - min)));
    
    if (ratio < 0.5) {
      // Red to Yellow
      return Math.floor(0xff0000 + (0x00ff00 * ratio * 2));
    } else {
      // Yellow to Green
      return Math.floor(0xffff00 + (0x0000ff * (ratio - 0.5) * 2));
    }
  },
};