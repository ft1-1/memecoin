/**
 * Main Discord notification service that orchestrates all notification components
 */
import { EventEmitter } from 'events';
import { Logger } from '../../utils/Logger';
import {
  NotificationMessage,
  NotificationResult,
  NotificationProvider,
  ProviderStatus,
  TokenAlertData,
  NotificationConfig,
  DiscordWebhookMessage,
} from '../../types/notifications';
import { DiscordWebhookClient, DiscordWebhookConfig } from './DiscordWebhookClient';
import { NotificationQueue, QueueConfig } from './NotificationQueue';
import { NotificationBatcher, BatchConfig } from './NotificationBatcher';
import { NotificationHistory, HistoryConfig } from './NotificationHistory';
import { EmbedTemplates, EMBED_COLORS } from './EmbedTemplates';

export interface DiscordServiceConfig {
  webhook: DiscordWebhookConfig;
  queue: QueueConfig;
  batch: BatchConfig;
  history: HistoryConfig;
  notifications: NotificationConfig;
  testMode?: boolean;
  enableHealthChecks?: boolean;
  healthCheckInterval?: number;
}

export class DiscordNotificationService extends EventEmitter implements NotificationProvider {
  public readonly name = 'discord';
  
  private readonly logger = Logger.getInstance();
  private readonly config: DiscordServiceConfig;
  private readonly webhookClient: DiscordWebhookClient;
  private readonly queue: NotificationQueue;
  private readonly batcher: NotificationBatcher;
  private readonly history: NotificationHistory;
  
  private isInitialized = false;
  private healthCheckTimer?: NodeJS.Timeout;
  private lastHealthCheck?: ProviderStatus;

  constructor(config: DiscordServiceConfig) {
    super();
    this.config = config;
    
    // Initialize components
    this.webhookClient = new DiscordWebhookClient(config.webhook);
    this.queue = new NotificationQueue(config.queue);
    this.batcher = new NotificationBatcher(config.batch);
    this.history = new NotificationHistory(config.history);
    
    this.setupEventHandlers();
  }

  /**
   * Initialize the notification service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Validate webhook configuration
      const isValid = await this.validateConfig();
      if (!isValid) {
        throw new Error('Discord webhook validation failed');
      }

      // Setup health checks
      if (this.config.enableHealthChecks) {
        this.startHealthChecks();
      }

      // Setup queue message processing
      this.queue.on('processMessage', this.handleQueueMessage.bind(this));

      this.isInitialized = true;
      this.logger.info('Discord notification service initialized successfully');
      
      this.emit('initialized');
    } catch (error) {
      this.logger.error('Failed to initialize Discord notification service', { error });
      this.emit('initializationError', error);
      throw error;
    }
  }

  /**
   * Send notification message
   */
  async send(message: NotificationMessage): Promise<NotificationResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();

    try {
      // Check if notifications are enabled
      if (!this.config.notifications.enabled) {
        return {
          success: false,
          error: {
            code: 'NOTIFICATIONS_DISABLED',
            message: 'Notifications are currently disabled',
            retryable: false,
          },
        };
      }

      // Apply filters
      if (!this.shouldSendNotification(message)) {
        return {
          success: true,
          messageId: `filtered-${message.id}`,
          metadata: { filtered: true },
        };
      }

      // Process through batcher if applicable
      const batchResult = await this.batcher.processMessage(message);
      
      if (batchResult === 'deduplicated') {
        return {
          success: true,
          messageId: `deduplicated-${message.id}`,
          metadata: { deduplicated: true },
        };
      }

      if (batchResult === 'batched') {
        // Message will be sent as part of a batch later
        return {
          success: true,
          messageId: `batched-${message.id}`,
          metadata: { batched: true },
        };
      }

      // Send immediately
      return await this.sendImmediate(message, startTime);
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      const result: NotificationResult = {
        success: false,
        error: {
          code: 'SEND_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          retryable: true,
        },
      };

      // Record in history
      await this.history.recordNotification(message, result, this.name, processingTime);
      
      return result;
    }
  }

  /**
   * Send high-priority token alert
   */
  async sendTokenAlert(tokenData: TokenAlertData): Promise<NotificationResult> {
    const message: NotificationMessage = {
      id: `token-alert-${tokenData.token.address}-${Date.now()}`,
      type: 'token_alert',
      priority: this.determineAlertPriority(tokenData.rating.score),
      title: `${tokenData.token.name} (${tokenData.token.symbol}) - Rating ${tokenData.rating.score}/10`,
      content: tokenData.rating.recommendation,
      metadata: tokenData,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: this.config.notifications.retry.maxAttempts,
    };

    return await this.send(message);
  }

  /**
   * Send system error alert
   */
  async sendErrorAlert(
    error: Error, 
    component: string, 
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  ): Promise<NotificationResult> {
    const message: NotificationMessage = {
      id: `error-alert-${Date.now()}`,
      type: 'error_alert',
      priority: severity === 'critical' ? 'critical' : severity === 'high' ? 'high' : 'medium',
      title: `System Error - ${component}`,
      content: error.message,
      metadata: { error: error.stack, component, severity },
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: 3,
    };

    return await this.send(message);
  }

  /**
   * Send daily summary report
   */
  async sendDailySummary(stats: {
    tokensAnalyzed: number;
    highRatedTokens: number;
    alertsSent: number;
    avgRating: number;
    topPerformer: TokenAlertData | null;
    systemUptime: number;
  }): Promise<NotificationResult> {
    const message: NotificationMessage = {
      id: `daily-summary-${Date.now()}`,
      type: 'system_alert',
      priority: 'low',
      title: 'Daily Analysis Report',
      content: 'Comprehensive analysis summary for the past 24 hours',
      metadata: stats,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: 2,
    };

    return await this.send(message);
  }

  /**
   * Validate Discord webhook configuration
   */
  async validateConfig(): Promise<boolean> {
    try {
      this.logger.info('Validating Discord webhook configuration');
      const isValid = await this.webhookClient.validateConfig();
      
      if (isValid) {
        this.logger.info('Discord webhook configuration validated successfully');
      } else {
        this.logger.error('Discord webhook configuration validation failed');
      }
      
      return isValid;
    } catch (error) {
      this.logger.error('Discord webhook validation failed with exception', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      return false;
    }
  }

  /**
   * Get provider status
   */
  async getStatus(): Promise<ProviderStatus> {
    try {
      const webhookStatus = await this.webhookClient.getStatus();
      const queueStats = await this.queue.getStats();
      const batchStats = this.batcher.getBatchStats();

      const status: ProviderStatus = {
        healthy: webhookStatus.healthy && queueStats.failed < queueStats.totalProcessed * 0.1,
        responseTime: webhookStatus.responseTime,
        rateLimitRemaining: webhookStatus.rateLimitRemaining,
        rateLimitReset: webhookStatus.rateLimitReset,
        lastError: webhookStatus.lastError,
      };

      this.lastHealthCheck = status;
      return status;
    } catch (error) {
      const status: ProviderStatus = {
        healthy: false,
        responseTime: 0,
        lastError: {
          timestamp: Date.now(),
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
      
      this.lastHealthCheck = status;
      return status;
    }
  }

  /**
   * Get comprehensive service statistics
   */
  async getServiceStats(): Promise<{
    webhook: ProviderStatus;
    queue: any;
    batch: any;
    history: any;
    performance: {
      totalMessagesSent: number;
      successRate: number;
      averageLatency: number;
      uptime: number;
    };
  }> {
    const [webhookStatus, queueStats, batchStats, historyStats] = await Promise.all([
      this.webhookClient.getStatus(),
      this.queue.getStats(),
      Promise.resolve(this.batcher.getBatchStats()),
      this.history.getStats(),
    ]);

    return {
      webhook: webhookStatus,
      queue: queueStats,
      batch: batchStats,
      history: historyStats,
      performance: {
        totalMessagesSent: historyStats.totalNotifications,
        successRate: historyStats.successRate,
        averageLatency: historyStats.averageProcessingTime,
        uptime: process.uptime(),
      },
    };
  }

  /**
   * Force process all pending batches
   */
  async flushBatches(): Promise<void> {
    await this.batcher.processAllBatches();
  }

  /**
   * Retry failed notifications
   */
  async retryFailedNotifications(maxAge?: number): Promise<{ attempted: number; successful: number }> {
    const options = maxAge ? { startTime: Date.now() - maxAge } : {};
    const failedNotifications = this.history.getFailedNotifications(options);
    
    let attempted = 0;
    let successful = 0;

    for (const entry of failedNotifications) {
      try {
        attempted++;
        const message = this.reconstructMessageFromHistory(entry);
        const result = await this.sendImmediate(message);
        
        await this.history.markAsRecovered(entry.messageId, result);
        
        if (result.success) {
          successful++;
        }
      } catch (error) {
        this.logger.error('Failed to retry notification', {
          messageId: entry.messageId,
          error,
        });
      }
    }

    this.logger.info('Notification retry completed', { attempted, successful });
    
    return { attempted, successful };
  }

  /**
   * Cleanup service resources
   */
  async cleanup(): Promise<void> {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    await Promise.all([
      this.queue.cleanup(),
      this.batcher.cleanup(),
      this.history.cleanup(),
    ]);

    this.isInitialized = false;
    this.logger.info('Discord notification service cleanup completed');
  }

  // Private methods

  private setupEventHandlers(): void {
    // Queue events
    this.queue.on('messageProcessed', (message, result) => {
      this.emit('messageProcessed', message, result);
    });

    this.queue.on('messageFailed', (message, result) => {
      this.emit('messageFailed', message, result);
    });

    // Batcher events
    this.batcher.on('batchMessage', async (batchMessage: DiscordWebhookMessage, originalMessages: NotificationMessage[]) => {
      try {
        const result = await this.webhookClient.sendMessage(batchMessage);
        
        // Record each original message in history
        for (const message of originalMessages) {
          await this.history.recordNotification(message, result, this.name);
        }
        
        this.emit('batchProcessed', originalMessages, result);
      } catch (error) {
        this.logger.error('Failed to send batch message', { error });
        this.emit('batchError', originalMessages, error);
      }
    });

    this.batcher.on('immediateMessage', async (message: NotificationMessage) => {
      await this.queue.add(message);
    });
  }

  private async handleQueueMessage(message: NotificationMessage): Promise<void> {
    const startTime = Date.now();
    
    try {
      const result = await this.sendImmediate(message, startTime);
      this.queue.emit(`messageProcessed:${message.id}`, result);
    } catch (error) {
      const result: NotificationResult = {
        success: false,
        error: {
          code: 'QUEUE_PROCESSING_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          retryable: true,
        },
      };
      
      this.queue.emit(`messageProcessed:${message.id}`, result);
    }
  }

  private async sendImmediate(message: NotificationMessage, startTime?: number): Promise<NotificationResult> {
    const actualStartTime = startTime || Date.now();
    
    try {
      // Convert message to Discord webhook format
      const webhookMessage = this.createWebhookMessage(message);
      
      // Send via webhook client
      const result = await this.webhookClient.sendMessage(webhookMessage);
      
      // Record in history
      const processingTime = Date.now() - actualStartTime;
      await this.history.recordNotification(message, result, this.name, processingTime);
      
      if (result.success) {
        this.logger.debug('Message sent successfully', {
          messageId: message.id,
          processingTime,
        });
      }
      
      return result;
    } catch (error) {
      const processingTime = Date.now() - actualStartTime;
      const result: NotificationResult = {
        success: false,
        error: {
          code: 'WEBHOOK_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          retryable: true,
        },
      };
      
      await this.history.recordNotification(message, result, this.name, processingTime);
      
      throw error;
    }
  }

  private createWebhookMessage(message: NotificationMessage): DiscordWebhookMessage {
    switch (message.type) {
      case 'token_alert':
        if (message.metadata && this.isTokenAlertData(message.metadata)) {
          return {
            content: `🚀 **High-Potential Memecoin Alert**`,
            embeds: [EmbedTemplates.createTokenAlert(message.metadata)],
          };
        }
        break;
        
      case 'error_alert':
        if (message.metadata?.error && message.metadata?.component && message.metadata?.severity) {
          const error = new Error(message.content);
          error.stack = message.metadata.error;
          return {
            embeds: [EmbedTemplates.createErrorAlert(
              error,
              message.metadata.component,
              message.metadata.severity
            )],
          };
        }
        break;
        
      case 'system_alert':
        if (message.title === 'Daily Analysis Report' && message.metadata) {
          return {
            embeds: [EmbedTemplates.createDailySummary(message.metadata)],
          };
        }
        break;
    }

    // Fallback to generic message
    return {
      content: message.content,
      embeds: [{
        color: EMBED_COLORS.INFO,
        title: message.title,
        description: message.content,
        timestamp: new Date(message.timestamp).toISOString(),
        fields: [],
      }],
    };
  }

  private isTokenAlertData(data: any): data is TokenAlertData {
    return data && data.token && data.rating && data.technicalAnalysis && data.risk;
  }

  private shouldSendNotification(message: NotificationMessage): boolean {
    const filters = this.config.notifications.filters;
    
    // Check minimum rating for token alerts
    if (message.type === 'token_alert' && message.metadata?.rating) {
      if (message.metadata.rating.score < filters.minRating) {
        return false;
      }
    }

    // Check priority thresholds
    const priorityThreshold = filters.priorityThresholds[message.priority];
    if (priorityThreshold && Math.random() > priorityThreshold) {
      return false;
    }

    return true;
  }

  private determineAlertPriority(rating: number): NotificationMessage['priority'] {
    if (rating >= 9) return 'critical';
    if (rating >= 8) return 'high';
    if (rating >= 7) return 'medium';
    return 'low';
  }

  private reconstructMessageFromHistory(entry: any): NotificationMessage {
    return {
      id: entry.messageId,
      type: entry.notificationType,
      priority: 'medium', // Default fallback
      title: `Retry: ${entry.notificationType}`,
      content: entry.error || 'Retrying failed notification',
      metadata: entry.metadata || {},
      timestamp: Date.now(),
      retryCount: entry.attempts || 0,
      maxRetries: this.config.notifications.retry.maxAttempts,
    };
  }

  private startHealthChecks(): void {
    const interval = this.config.healthCheckInterval || 60000; // Default 1 minute
    
    this.healthCheckTimer = setInterval(async () => {
      try {
        const status = await this.getStatus();
        
        if (!status.healthy && this.lastHealthCheck?.healthy) {
          // Health status changed from healthy to unhealthy
          this.emit('healthStatusChanged', status);
          
          // Send alert if configured
          await this.sendErrorAlert(
            new Error('Discord notification service health check failed'),
            'DiscordNotificationService',
            'high'
          );
        }
      } catch (error) {
        this.logger.error('Health check failed', { error });
      }
    }, interval);
  }
}