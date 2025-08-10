/**
 * Robust Discord webhook client with rate limiting, retry logic, and error handling
 */
import axios, { AxiosInstance, AxiosError } from 'axios';
import { Logger } from '../../utils/Logger';
import {
  DiscordWebhookMessage,
  NotificationResult,
  ProviderStatus,
} from '../../types/notifications';

export interface RateLimitConfig {
  messagesPerSecond: number;
  burstLimit: number;
  resetIntervalMs: number;
}

export interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableStatusCodes: number[];
}

export interface DiscordWebhookConfig {
  webhookUrl: string;
  userAgent: string;
  timeout: number;
  rateLimit: RateLimitConfig;
  retry: RetryConfig;
}

export class DiscordWebhookClient {
  private readonly logger = Logger.getInstance();
  private readonly axiosInstance: AxiosInstance;
  private readonly rateLimiter: RateLimiter;
  private readonly config: DiscordWebhookConfig;
  private healthStatus: ProviderStatus;

  constructor(config: DiscordWebhookConfig) {
    this.config = config;
    this.rateLimiter = new RateLimiter(config.rateLimit);
    
    this.axiosInstance = axios.create({
      timeout: config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': config.userAgent,
      },
    });

    this.healthStatus = {
      healthy: true,
      responseTime: 0,
      rateLimitRemaining: config.rateLimit.messagesPerSecond,
      rateLimitReset: Date.now() + config.rateLimit.resetIntervalMs,
    };

    this.setupAxiosInterceptors();
  }

  /**
   * Send a message to Discord webhook with rate limiting and retry logic
   */
  async sendMessage(message: DiscordWebhookMessage): Promise<NotificationResult> {
    const startTime = Date.now();
    
    try {
      // Wait for rate limit availability
      await this.rateLimiter.acquire();

      // Validate message
      this.validateMessage(message);

      // Send with retry logic
      const result = await this.sendWithRetry(message);
      
      // Update health status
      this.updateHealthStatus(Date.now() - startTime, null);
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.updateHealthStatus(Date.now() - startTime, errorMessage);
      
      return {
        success: false,
        error: {
          code: this.getErrorCode(error),
          message: errorMessage,
          retryable: this.isRetryableError(error),
          retryAfter: this.getRetryAfter(error),
        },
      };
    }
  }

  /**
   * Test webhook connectivity and permissions
   */
  async validateConfig(): Promise<boolean> {
    try {
      // First validate the webhook URL format
      if (!this.isValidDiscordWebhookUrl(this.config.webhookUrl)) {
        this.logger.error('Invalid Discord webhook URL format', { 
          webhookUrl: this.maskWebhookUrl(this.config.webhookUrl) 
        });
        return false;
      }

      const testMessage: DiscordWebhookMessage = {
        content: '🤖 Memecoin Analyzer - Connection Test',
        embeds: [{
          color: 0x00ff00,
          title: 'System Status',
          description: 'Discord webhook connection verified successfully',
          timestamp: new Date().toISOString(),
          fields: [],
        }],
      };

      const result = await this.sendMessage(testMessage);
      
      if (!result.success && result.error) {
        this.logger.error('Discord webhook validation failed', { 
          error: result.error.message,
          code: result.error.code,
          retryable: result.error.retryable,
          webhookUrl: this.maskWebhookUrl(this.config.webhookUrl)
        });
      } else {
        this.logger.info('Discord webhook validation successful', {
          responseTime: result.metadata?.responseStatus || 'unknown'
        });
      }
      
      return result.success;
    } catch (error) {
      this.logger.error('Discord webhook validation failed with exception', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        webhookUrl: this.maskWebhookUrl(this.config.webhookUrl)
      });
      return false;
    }
  }

  /**
   * Validate if URL is a proper Discord webhook URL
   */
  private isValidDiscordWebhookUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      
      // Check if it's a Discord webhook URL
      const validHosts = ['discord.com', 'discordapp.com'];
      const isValidHost = validHosts.includes(urlObj.hostname);
      const isWebhookPath = urlObj.pathname.startsWith('/api/webhooks/');
      
      return isValidHost && isWebhookPath && urlObj.protocol === 'https:';
    } catch {
      return false;
    }
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

  /**
   * Get current provider status
   */
  async getStatus(): Promise<ProviderStatus> {
    return {
      ...this.healthStatus,
      rateLimitRemaining: this.rateLimiter.getRemaining(),
      rateLimitReset: this.rateLimiter.getResetTime(),
    };
  }

  /**
   * Send message with exponential backoff retry logic
   */
  private async sendWithRetry(message: DiscordWebhookMessage): Promise<NotificationResult> {
    let lastError: Error | null = null;
    let delay = this.config.retry.initialDelayMs;

    for (let attempt = 1; attempt <= this.config.retry.maxAttempts; attempt++) {
      try {
        const response = await this.axiosInstance.post(this.config.webhookUrl, message);
        
        this.logger.debug('Discord message sent successfully', {
          attempt,
          responseStatus: response.status,
          rateLimitRemaining: response.headers['x-ratelimit-remaining'],
          rateLimitReset: response.headers['x-ratelimit-reset'],
        });

        // Update rate limiter with Discord's response
        if (response.headers['x-ratelimit-remaining']) {
          const remaining = parseInt(response.headers['x-ratelimit-remaining']);
          const resetTime = response.headers['x-ratelimit-reset-after'] 
            ? parseInt(response.headers['x-ratelimit-reset-after']) * 1000 
            : 1000;
          this.rateLimiter.updateFromResponse(remaining, resetTime);
        }

        return {
          success: true,
          messageId: response.headers['x-message-id'] || `discord-${Date.now()}`,
          metadata: {
            attempt,
            responseStatus: response.status,
            rateLimitRemaining: response.headers['x-ratelimit-remaining'],
            rateLimitReset: response.headers['x-ratelimit-reset'],
            messageSize: JSON.stringify(message).length,
          },
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        // Enhanced error logging
        this.logger.warn('Discord message send attempt failed', {
          attempt,
          error: lastError.message,
          errorCode: this.getErrorCode(error),
          willRetry: attempt < this.config.retry.maxAttempts && this.isRetryableError(error),
          messageSize: JSON.stringify(message).length,
          webhookUrl: this.maskWebhookUrl(this.config.webhookUrl),
        });

        // Handle specific Discord errors
        if (axios.isAxiosError(error) && error.response) {
          const status = error.response.status;
          const data = error.response.data;

          // Handle rate limiting
          if (status === 429) {
            const retryAfter = parseInt(error.response.headers['retry-after'] || '1') * 1000;
            this.logger.warn('Discord API rate limit hit', {
              retryAfter: retryAfter / 1000,
              rateLimitBucket: error.response.headers['x-ratelimit-bucket'],
            });
            this.rateLimiter.handleRateLimit(retryAfter);
            delay = Math.max(delay, retryAfter);
          }

          // Handle webhook errors
          if (status === 404) {
            this.logger.error('Discord webhook not found - check webhook URL', {
              webhookUrl: this.maskWebhookUrl(this.config.webhookUrl)
            });
            break; // Don't retry 404s
          }

          if (status === 400 && data) {
            this.logger.error('Discord webhook bad request', {
              errorDetails: data,
              messageFields: Object.keys(message)
            });
            break; // Don't retry bad requests
          }
        }

        // Don't retry if error is not retryable
        if (!this.isRetryableError(error)) {
          this.logger.error('Non-retryable error encountered', {
            error: lastError.message,
            errorCode: this.getErrorCode(error)
          });
          break;
        }

        // Don't retry on last attempt
        if (attempt === this.config.retry.maxAttempts) {
          this.logger.error('Maximum retry attempts reached', {
            attempts: attempt,
            finalError: lastError.message
          });
          break;
        }

        // Wait before retry with jitter
        const jitteredDelay = delay + Math.random() * 1000; // Add up to 1s jitter
        this.logger.debug('Waiting before retry', { 
          delayMs: jitteredDelay,
          nextAttempt: attempt + 1
        });
        await this.sleep(jitteredDelay);
        delay = Math.min(delay * this.config.retry.backoffMultiplier, this.config.retry.maxDelayMs);
      }
    }

    // All retries failed
    throw lastError || new Error('All retry attempts failed');
  }

  /**
   * Setup axios interceptors for enhanced error handling
   */
  private setupAxiosInterceptors(): void {
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response) {
          // Discord API returned an error response
          const status = error.response.status;
          const data = error.response.data;
          
          this.logger.error('Discord API error response', {
            status,
            data,
            headers: error.response.headers,
          });

          // Handle rate limiting
          if (status === 429) {
            const retryAfter = parseInt(error.response.headers['retry-after'] || '1000');
            this.rateLimiter.handleRateLimit(retryAfter * 1000);
          }
        } else if (error.request) {
          // Network error
          this.logger.error('Discord webhook network error', {
            code: error.code,
            message: error.message,
          });
        }

        return Promise.reject(error);
      }
    );
  }

  /**
   * Validate Discord message format
   */
  private validateMessage(message: DiscordWebhookMessage): void {
    if (!message.content && (!message.embeds || message.embeds.length === 0)) {
      throw new Error('Message must have either content or embeds');
    }

    if (message.embeds && message.embeds.length > 10) {
      throw new Error('Message cannot have more than 10 embeds');
    }

    if (message.content && message.content.length > 2000) {
      throw new Error('Message content cannot exceed 2000 characters');
    }

    // Validate embeds
    if (message.embeds) {
      for (const embed of message.embeds) {
        if (embed.title && embed.title.length > 256) {
          throw new Error('Embed title cannot exceed 256 characters');
        }
        if (embed.description && embed.description.length > 4096) {
          throw new Error('Embed description cannot exceed 4096 characters');
        }
        if (embed.fields && embed.fields.length > 25) {
          throw new Error('Embed cannot have more than 25 fields');
        }
      }
    }
  }

  /**
   * Determine if error is retryable
   */
  private isRetryableError(error: unknown): boolean {
    if (axios.isAxiosError(error)) {
      if (!error.response) {
        // Network errors are retryable
        return true;
      }

      const status = error.response.status;
      return this.config.retry.retryableStatusCodes.includes(status);
    }

    return false;
  }

  /**
   * Get error code from error object
   */
  private getErrorCode(error: unknown): string {
    if (axios.isAxiosError(error)) {
      if (error.response) {
        return `HTTP_${error.response.status}`;
      }
      return error.code || 'NETWORK_ERROR';
    }

    return 'UNKNOWN_ERROR';
  }

  /**
   * Get retry-after value from error
   */
  private getRetryAfter(error: unknown): number | undefined {
    if (axios.isAxiosError(error) && error.response?.status === 429) {
      return parseInt(error.response.headers['retry-after'] || '0') * 1000;
    }
    return undefined;
  }

  /**
   * Update health status
   */
  private updateHealthStatus(responseTime: number, error: string | null): void {
    this.healthStatus = {
      healthy: !error,
      responseTime,
      rateLimitRemaining: this.rateLimiter.getRemaining(),
      rateLimitReset: this.rateLimiter.getResetTime(),
      lastError: error
        ? {
            timestamp: Date.now(),
            message: error,
          }
        : undefined,
    };
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Rate limiter for Discord API compliance
 */
class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
    this.tokens = config.messagesPerSecond;
    this.lastRefill = Date.now();
  }

  /**
   * Acquire a token to send a message
   */
  async acquire(): Promise<void> {
    this.refillTokens();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }

    // Wait until tokens are available
    const waitTime = this.getWaitTime();
    if (waitTime > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      return this.acquire();
    }
  }

  /**
   * Handle rate limit response from Discord
   */
  handleRateLimit(retryAfterMs: number): void {
    this.tokens = 0;
    this.lastRefill = Date.now() + retryAfterMs;
  }

  /**
   * Update rate limiter state from Discord response headers
   */
  updateFromResponse(remaining: number, resetAfterMs: number): void {
    this.tokens = remaining;
    this.lastRefill = Date.now() + resetAfterMs;
  }

  /**
   * Get remaining tokens
   */
  getRemaining(): number {
    this.refillTokens();
    return Math.floor(this.tokens);
  }

  /**
   * Get time when rate limit resets
   */
  getResetTime(): number {
    return this.lastRefill + this.config.resetIntervalMs;
  }

  /**
   * Refill tokens based on elapsed time
   */
  private refillTokens(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const tokensToAdd = (elapsed / 1000) * this.config.messagesPerSecond;

    this.tokens = Math.min(this.config.burstLimit, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  /**
   * Calculate wait time until next token is available
   */
  private getWaitTime(): number {
    if (this.tokens >= 1) return 0;
    return (1000 / this.config.messagesPerSecond) * (1 - this.tokens);
  }
}