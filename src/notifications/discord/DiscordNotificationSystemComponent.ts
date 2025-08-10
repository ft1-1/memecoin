/**
 * System Component wrapper for Discord Notification Service
 * 
 * This wrapper implements the SystemComponent interface required by the orchestrator,
 * providing proper lifecycle management, health monitoring, and error handling
 * for the Discord notification service.
 */

import { Logger } from 'winston';
import { EventEmitter } from 'events';
import { DiscordNotificationService, DiscordServiceConfig } from './DiscordNotificationService';
import { SystemComponent, ComponentHealth } from '../../orchestrator/SystemOrchestrator';
import { TokenAlertData, NotificationResult } from '../../types/notifications';

export interface DiscordNotificationComponentConfig {
  serviceConfig: DiscordServiceConfig;
  healthCheckInterval?: number;
  name?: string;
}

export interface MemecoinNotificationOptions {
  testMode?: boolean;
  enableHealthChecks?: boolean;
  minRating?: number;
}

/**
 * System component wrapper for the Discord notification service
 */
export class DiscordNotificationSystemComponent extends EventEmitter implements SystemComponent {
  public readonly name: string;
  private readonly logger: Logger;
  private readonly config: DiscordNotificationComponentConfig;
  private service: DiscordNotificationService | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private isInitialized = false;
  private isStarted = false;
  private isDestroyed = false;
  private lastHealthStatus: ComponentHealth | null = null;

  constructor(config: DiscordNotificationComponentConfig, logger: Logger) {
    super();
    
    this.name = config.name || 'DiscordNotificationService';
    this.logger = logger.child({ component: this.name });
    this.config = config;

    this.logger.debug('Discord notification system component created', {
      name: this.name,
      webhookConfigured: !!config.serviceConfig.webhook.webhookUrl,
      testMode: config.serviceConfig.testMode,
    });
  }

  /**
   * Initialize the component and create the service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      this.logger.warn('Component already initialized');
      return;
    }

    if (this.isDestroyed) {
      throw new Error('Cannot initialize destroyed component');
    }

    this.logger.info('Initializing Discord notification service');

    try {
      // Validate configuration
      this.validateConfiguration();

      // Create the service instance
      this.service = new DiscordNotificationService(this.config.serviceConfig);

      // Set up event forwarding
      this.setupEventForwarding();

      // Initialize the service
      await this.service.initialize();

      this.isInitialized = true;
      this.logger.info('Discord notification service initialized successfully');

    } catch (error) {
      this.logger.error('Failed to initialize Discord notification service', { error });
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

    this.logger.info('Starting Discord notification service');

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
      this.logger.info('Discord notification service started successfully');
      this.emit('started');

    } catch (error) {
      this.logger.error('Failed to start Discord notification service', { error });
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

    this.logger.info('Stopping Discord notification service');

    try {
      // Stop health monitoring
      this.stopHealthMonitoring();

      // Flush any pending batches
      if (this.service) {
        await this.service.flushBatches();
      }

      this.isStarted = false;
      this.logger.info('Discord notification service stopped successfully');
      this.emit('stopped');

    } catch (error) {
      this.logger.error('Error stopping Discord notification service', { error });
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

    if (!this.isInitialized || !this.service) {
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

    this.logger.info('Destroying Discord notification service');

    try {
      // Stop if running
      if (this.isStarted) {
        await this.stop();
      }

      // Stop health monitoring
      this.stopHealthMonitoring();

      // Cleanup the service
      if (this.service) {
        await this.service.cleanup();
        this.service = null;
      }

      // Remove all listeners
      this.removeAllListeners();

      this.isDestroyed = true;
      this.isInitialized = false;
      this.isStarted = false;

      this.logger.info('Discord notification service destroyed successfully');

    } catch (error) {
      this.logger.error('Error destroying Discord notification service', { error });
      throw error;
    }
  }

  /**
   * Get the underlying service instance
   */
  getService(): DiscordNotificationService {
    if (!this.service) {
      throw new Error('Service not initialized');
    }
    return this.service;
  }

  /**
   * Convenience method to send token alert (delegates to service)
   */
  async sendTokenAlert(tokenData: TokenAlertData): Promise<NotificationResult> {
    if (!this.service) {
      throw new Error('Service not initialized');
    }
    
    return this.service.sendTokenAlert(tokenData);
  }

  /**
   * Convenience method to send error alert (delegates to service)
   */
  async sendErrorAlert(
    error: Error, 
    component: string, 
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  ): Promise<NotificationResult> {
    if (!this.service) {
      throw new Error('Service not initialized');
    }
    
    return this.service.sendErrorAlert(error, component, severity);
  }

  /**
   * Convenience method to send daily summary (delegates to service)
   */
  async sendDailySummary(stats: {
    tokensAnalyzed: number;
    highRatedTokens: number;
    alertsSent: number;
    avgRating: number;
    topPerformer: TokenAlertData | null;
    systemUptime: number;
  }): Promise<NotificationResult> {
    if (!this.service) {
      throw new Error('Service not initialized');
    }
    
    return this.service.sendDailySummary(stats);
  }

  /**
   * Get service statistics
   */
  async getServiceStats(): Promise<any> {
    if (!this.service) {
      return null;
    }
    return this.service.getServiceStats();
  }

  /**
   * Force flush pending batches
   */
  async flushBatches(): Promise<void> {
    if (this.service) {
      await this.service.flushBatches();
    }
  }

  /**
   * Retry failed notifications
   */
  async retryFailedNotifications(maxAge?: number): Promise<{ attempted: number; successful: number }> {
    if (!this.service) {
      return { attempted: 0, successful: 0 };
    }
    return this.service.retryFailedNotifications(maxAge);
  }

  /**
   * Check if the component is ready for use
   */
  isReady(): boolean {
    return this.isInitialized && this.isStarted && !this.isDestroyed && this.service !== null;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private validateConfiguration(): void {
    const { serviceConfig } = this.config;

    if (!serviceConfig.webhook?.webhookUrl) {
      this.logger.error('Discord webhook URL is missing from configuration');
      throw new Error('Discord webhook URL is required - set DISCORD_WEBHOOK_URL environment variable');
    }

    // Validate webhook URL format
    try {
      const url = new URL(serviceConfig.webhook.webhookUrl);
      
      if (url.protocol !== 'https:') {
        throw new Error('Discord webhook URL must use HTTPS');
      }

      if (!['discord.com', 'discordapp.com'].includes(url.hostname)) {
        throw new Error('Invalid Discord webhook hostname');
      }

      if (!url.pathname.startsWith('/api/webhooks/')) {
        throw new Error('Invalid Discord webhook path');
      }

      // Basic check for webhook ID and token
      const pathParts = url.pathname.split('/');
      if (pathParts.length < 5 || !pathParts[3] || !pathParts[4]) {
        throw new Error('Discord webhook URL missing ID or token');
      }

    } catch (error) {
      this.logger.error('Discord webhook URL validation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        webhookUrlFormat: this.maskWebhookUrl(serviceConfig.webhook.webhookUrl)
      });
      throw new Error(`Invalid Discord webhook URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Validate other configuration
    if (!serviceConfig.notifications) {
      throw new Error('Notification configuration is required');
    }

    if (serviceConfig.notifications.filters?.minRating < 1 || serviceConfig.notifications.filters?.minRating > 10) {
      throw new Error('Minimum rating threshold must be between 1 and 10');
    }

    this.logger.debug('Configuration validated successfully', {
      webhookConfigured: true,
      minRating: serviceConfig.notifications.filters?.minRating || 'default',
      testMode: serviceConfig.testMode || false
    });
  }

  /**
   * Mask webhook URL for logging (security)
   */
  private maskWebhookUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/');
      if (pathParts.length >= 4) {
        // Mask the webhook ID and token
        pathParts[3] = '***masked***';
        if (pathParts[4]) {
          pathParts[4] = '***masked***';
        }
        urlObj.pathname = pathParts.join('/');
      }
      return urlObj.toString();
    } catch {
      return 'invalid-url';
    }
  }

  private setupEventForwarding(): void {
    if (!this.service) return;

    // Forward important service events
    this.service.on('initialized', () => {
      this.emit('serviceInitialized');
    });

    this.service.on('initializationError', (error) => {
      this.logger.error('Service initialization error', { error });
      this.emit('serviceInitializationError', error);
    });

    this.service.on('messageProcessed', (message, result) => {
      this.logger.debug('Message processed', {
        messageId: message.id,
        success: result.success,
        type: message.type,
      });
      this.emit('messageProcessed', message, result);
    });

    this.service.on('messageFailed', (message, result) => {
      this.logger.warn('Message failed', {
        messageId: message.id,
        error: result.error?.message,
        type: message.type,
      });
      this.emit('messageFailed', message, result);
    });

    this.service.on('batchProcessed', (messages, result) => {
      this.logger.debug('Batch processed', {
        messageCount: messages.length,
        success: result.success,
      });
      this.emit('batchProcessed', messages, result);
    });

    this.service.on('batchError', (messages, error) => {
      this.logger.error('Batch processing error', {
        messageCount: messages.length,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      this.emit('batchError', messages, error);
    });

    this.service.on('healthStatusChanged', (status) => {
      this.logger.info('Service health status changed', {
        healthy: status.healthy,
        responseTime: status.responseTime,
      });
      this.emit('healthStatusChanged', status);
    });
  }

  private async performHealthCheck(): Promise<ComponentHealth> {
    const startTime = Date.now();

    try {
      if (!this.service) {
        return {
          status: 'unhealthy',
          message: 'Service not available',
          responseTime: 0,
          metadata: { serviceAvailable: false },
        };
      }

      const serviceStatus = await this.service.getStatus();
      const serviceStats = await this.service.getServiceStats();
      const responseTime = Date.now() - startTime;

      const status: ComponentHealth = {
        status: serviceStatus.healthy ? 'healthy' : 'degraded',
        message: serviceStatus.healthy ? 'Discord notifications operational' : 'Discord notifications experiencing issues',
        responseTime,
        metadata: {
          serviceStatus,
          serviceStats,
          initialized: this.isInitialized,
          started: this.isStarted,
          rateLimitRemaining: serviceStatus.rateLimitRemaining,
          rateLimitReset: serviceStatus.rateLimitReset,
          lastError: serviceStatus.lastError,
        },
      };

      this.lastHealthStatus = status;
      return status;

    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.logger.error('Health check failed', { error });

      const status: ComponentHealth = {
        status: 'unhealthy',
        message: `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        responseTime,
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error',
          initialized: this.isInitialized,
          started: this.isStarted,
        },
      };

      this.lastHealthStatus = status;
      return status;
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
        
        // Check for status changes
        if (this.lastHealthStatus) {
          const statusChanged = this.lastHealthStatus.status !== health.status;
          
          if (statusChanged) {
            this.logger.info('Health status changed', {
              previousStatus: this.lastHealthStatus.status,
              currentStatus: health.status,
              message: health.message,
            });
            this.emit('healthStatusChanged', health);
          }
        }
        
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
 * Factory function to create a Discord notification system component
 */
export function createDiscordNotificationSystemComponent(
  config: DiscordNotificationComponentConfig,
  logger: Logger
): DiscordNotificationSystemComponent {
  return new DiscordNotificationSystemComponent(config, logger);
}

/**
 * Factory function optimized for memecoin analysis notifications
 */
export function createMemecoinNotificationSystemComponent(
  webhookUrl: string,
  logger: Logger,
  options?: MemecoinNotificationOptions
): DiscordNotificationSystemComponent {
  const config: DiscordNotificationComponentConfig = {
    serviceConfig: {
      webhook: {
        webhookUrl: webhookUrl,
        userAgent: 'Memecoin Analyzer Bot/1.0',
        timeout: 10000,
        rateLimit: {
          messagesPerSecond: 2,
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
        maxSize: 100,
        concurrency: 2,
        retryDelayMs: 2000,
        maxRetries: 3,
        processingTimeoutMs: 30000,
        batchSize: 5,
        batchTimeoutMs: 30000,
      },
      batch: {
        enabled: true,
        maxBatchSize: 5,
        batchTimeoutMs: 10000,
        deduplicationWindowMs: 300000,
        similarityThreshold: 0.8,
        groupingStrategy: 'rating',
        minRatingForBatching: 6,
      },
      history: {
        maxEntries: 1000,
        retentionDays: 1, // 24 hours
        compressionThreshold: 500,
        enableAnalytics: true,
      },
      notifications: {
        enabled: true,
        rateLimits: {
          messagesPerMinute: 20,
          messagesPerHour: 200,
          messagesPerDay: 2000,
        },
        filters: {
          minRating: options?.minRating || 7,
          maxNotificationsPerToken: 3,
          cooldownMinutes: 30,
          priorityThresholds: {
            critical: 1.0,
            high: 0.95,
            medium: 0.8,
            low: 0.5,
          },
        },
        retry: {
          maxAttempts: 3,
          backoffMultiplier: 2,
          initialDelay: 5000,
          maxDelay: 60000,
        },
      },
      testMode: options?.testMode || false,
      enableHealthChecks: options?.enableHealthChecks !== false,
      healthCheckInterval: 60000, // 1 minute
    },
    healthCheckInterval: 30000, // 30 seconds
    name: 'MemecoinNotificationService',
  };

  return new DiscordNotificationSystemComponent(config, logger);
}