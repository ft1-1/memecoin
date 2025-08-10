/**
 * Reliable notification queue system with persistence and recovery
 */
import { EventEmitter } from 'events';
import { Logger } from '../../utils/Logger';
import {
  NotificationMessage,
  NotificationQueue as INotificationQueue,
  QueueStats,
  NotificationResult,
} from '../../types/notifications';

export interface QueueConfig {
  maxSize: number;
  concurrency: number;
  retryDelayMs: number;
  maxRetries: number;
  persistencePath?: string;
  processingTimeoutMs: number;
  batchSize: number;
  batchTimeoutMs: number;
}

export interface QueueMessage extends NotificationMessage {
  enqueuedAt: number;
  processingStartedAt?: number;
  lastAttemptAt?: number;
  attempts: number;
}

export class NotificationQueue extends EventEmitter implements INotificationQueue {
  private readonly logger = Logger.getInstance();
  private readonly config: QueueConfig;
  private readonly pendingQueue: QueueMessage[] = [];
  private readonly processingSet = new Set<string>();
  private readonly completedMessages = new Map<string, QueueMessage>();
  private readonly failedMessages = new Map<string, QueueMessage>();
  
  private isProcessing = false;
  private isPaused = false;
  private stats: QueueStats;
  private processingTimer?: NodeJS.Timeout;
  private batchTimer?: NodeJS.Timeout;
  private persistenceTimer?: NodeJS.Timeout;

  constructor(config: QueueConfig) {
    super();
    this.config = config;
    this.stats = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      totalProcessed: 0,
      averageProcessingTime: 0,
    };

    this.setupAutoPersistence();
    this.loadPersistedMessages();
  }

  /**
   * Add message to queue
   */
  async add(message: NotificationMessage): Promise<void> {
    if (this.pendingQueue.length >= this.config.maxSize) {
      throw new Error('Queue is full');
    }

    const queueMessage: QueueMessage = {
      ...message,
      enqueuedAt: Date.now(),
      attempts: 0,
    };

    // Check for duplicates
    if (this.isDuplicate(queueMessage)) {
      this.logger.debug('Duplicate message ignored', { messageId: message.id });
      return;
    }

    this.pendingQueue.push(queueMessage);
    this.updateStats();

    this.logger.debug('Message added to queue', {
      messageId: message.id,
      queueSize: this.pendingQueue.length,
    });

    this.emit('messageAdded', queueMessage);

    // Start processing if not already running
    if (!this.isProcessing && !this.isPaused) {
      setImmediate(() => this.process());
    }
  }

  /**
   * Process messages in queue
   */
  async process(): Promise<void> {
    if (this.isProcessing || this.isPaused || this.pendingQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    this.logger.debug('Starting queue processing', {
      queueSize: this.pendingQueue.length,
      concurrency: this.config.concurrency,
    });

    try {
      // Process messages with concurrency limit
      const workers: Promise<void>[] = [];
      for (let i = 0; i < Math.min(this.config.concurrency, this.pendingQueue.length); i++) {
        workers.push(this.processWorker());
      }

      await Promise.all(workers);
    } catch (error) {
      this.logger.error('Queue processing error', { error });
    } finally {
      this.isProcessing = false;
      
      // Continue processing if more messages are available
      if (this.pendingQueue.length > 0 && !this.isPaused) {
        this.scheduleNextProcessing();
      }
    }
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<QueueStats> {
    this.updateStats();
    return { ...this.stats };
  }

  /**
   * Clear all messages from queue
   */
  async clear(): Promise<void> {
    this.pendingQueue.length = 0;
    this.processingSet.clear();
    this.completedMessages.clear();
    this.failedMessages.clear();
    this.updateStats();
    
    this.logger.info('Queue cleared');
    this.emit('queueCleared');
  }

  /**
   * Pause queue processing
   */
  pause(): void {
    this.isPaused = true;
    this.logger.info('Queue processing paused');
    this.emit('queuePaused');
  }

  /**
   * Resume queue processing
   */
  resume(): void {
    this.isPaused = false;
    this.logger.info('Queue processing resumed');
    this.emit('queueResumed');
    
    if (!this.isProcessing && this.pendingQueue.length > 0) {
      setImmediate(() => this.process());
    }
  }

  /**
   * Get failed messages for recovery
   */
  getFailedMessages(): QueueMessage[] {
    return Array.from(this.failedMessages.values());
  }

  /**
   * Retry failed messages
   */
  async retryFailedMessages(): Promise<void> {
    const failedMessages = Array.from(this.failedMessages.values());
    this.failedMessages.clear();

    for (const message of failedMessages) {
      // Reset retry count and re-enqueue
      message.retryCount = 0;
      message.attempts = 0;
      delete message.processingStartedAt;
      delete message.lastAttemptAt;
      
      this.pendingQueue.push(message);
    }

    this.updateStats();
    this.logger.info('Failed messages re-queued for retry', { count: failedMessages.length });
    
    if (!this.isProcessing && !this.isPaused) {
      setImmediate(() => this.process());
    }
  }

  /**
   * Worker to process individual messages
   */
  private async processWorker(): Promise<void> {
    while (this.pendingQueue.length > 0 && !this.isPaused) {
      const message = this.pendingQueue.shift();
      if (!message) continue;

      // Mark as processing
      this.processingSet.add(message.id);
      message.processingStartedAt = Date.now();
      message.attempts++;
      
      this.updateStats();

      try {
        const result = await this.processMessage(message);
        await this.handleMessageResult(message, result);
      } catch (error) {
        await this.handleMessageError(message, error as Error);
      } finally {
        this.processingSet.delete(message.id);
        this.updateStats();
      }

      // Small delay to prevent overwhelming
      await this.sleep(10);
    }
  }

  /**
   * Process a single message (to be implemented by subclass or injected)
   */
  private async processMessage(message: QueueMessage): Promise<NotificationResult> {
    // This is a placeholder - actual implementation would be injected
    // or this class would be extended with specific processing logic
    this.emit('processMessage', message);
    
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve({
          success: false,
          error: {
            code: 'TIMEOUT',
            message: 'Message processing timed out',
            retryable: true,
          },
        });
      }, this.config.processingTimeoutMs);

      this.once(`messageProcessed:${message.id}`, (result: NotificationResult) => {
        clearTimeout(timeout);
        resolve(result);
      });
    });
  }

  /**
   * Handle successful or failed message processing
   */
  private async handleMessageResult(message: QueueMessage, result: NotificationResult): Promise<void> {
    const processingTime = Date.now() - (message.processingStartedAt || Date.now());
    
    if (result.success) {
      // Message processed successfully
      this.completedMessages.set(message.id, message);
      this.updateAverageProcessingTime(processingTime);
      
      this.logger.debug('Message processed successfully', {
        messageId: message.id,
        processingTime,
        attempts: message.attempts,
      });
      
      this.emit('messageProcessed', message, result);
    } else {
      // Message failed - check if retryable
      if (result.error?.retryable && message.retryCount < message.maxRetries) {
        await this.scheduleRetry(message, result.error.retryAfter);
      } else {
        // Max retries reached or not retryable
        this.failedMessages.set(message.id, message);
        
        this.logger.error('Message processing failed permanently', {
          messageId: message.id,
          attempts: message.attempts,
          error: result.error,
        });
        
        this.emit('messageFailed', message, result);
      }
    }
  }

  /**
   * Handle message processing error
   */
  private async handleMessageError(message: QueueMessage, error: Error): Promise<void> {
    message.lastAttemptAt = Date.now();
    
    if (message.retryCount < message.maxRetries) {
      await this.scheduleRetry(message);
    } else {
      this.failedMessages.set(message.id, message);
      
      this.logger.error('Message processing failed with exception', {
        messageId: message.id,
        attempts: message.attempts,
        error: error.message,
      });
      
      this.emit('messageFailed', message, {
        success: false,
        error: {
          code: 'PROCESSING_ERROR',
          message: error.message,
          retryable: false,
        },
      });
    }
  }

  /**
   * Schedule message retry
   */
  private async scheduleRetry(message: QueueMessage, retryAfter?: number): Promise<void> {
    message.retryCount++;
    
    const delay = retryAfter || this.config.retryDelayMs * Math.pow(2, message.retryCount - 1);
    
    this.logger.debug('Scheduling message retry', {
      messageId: message.id,
      retryCount: message.retryCount,
      delayMs: delay,
    });

    setTimeout(() => {
      if (!this.isPaused) {
        this.pendingQueue.unshift(message); // Add to front for priority
        this.updateStats();
        
        if (!this.isProcessing) {
          setImmediate(() => this.process());
        }
      }
    }, delay);
  }

  /**
   * Check for duplicate messages
   */
  private isDuplicate(message: QueueMessage): boolean {
    // Check pending queue
    const duplicateInPending = this.pendingQueue.some(m => 
      m.id === message.id || this.messagesAreEquivalent(m, message)
    );
    
    // Check processing set
    const duplicateInProcessing = this.processingSet.has(message.id);
    
    // Check recently completed (within last 5 minutes)
    const recentlyCompleted = this.completedMessages.has(message.id) &&
      (Date.now() - (this.completedMessages.get(message.id)?.enqueuedAt || 0)) < 5 * 60 * 1000;
    
    return duplicateInPending || duplicateInProcessing || recentlyCompleted;
  }

  /**
   * Check if two messages are equivalent (same content, different IDs)
   */
  private messagesAreEquivalent(msg1: QueueMessage, msg2: QueueMessage): boolean {
    return (
      msg1.type === msg2.type &&
      msg1.title === msg2.title &&
      msg1.content === msg2.content &&
      JSON.stringify(msg1.metadata) === JSON.stringify(msg2.metadata)
    );
  }

  /**
   * Update queue statistics
   */
  private updateStats(): void {
    this.stats = {
      pending: this.pendingQueue.length,
      processing: this.processingSet.size,
      completed: this.completedMessages.size,
      failed: this.failedMessages.size,
      totalProcessed: this.completedMessages.size + this.failedMessages.size,
      averageProcessingTime: this.stats.averageProcessingTime,
      lastProcessedAt: this.stats.lastProcessedAt,
    };
  }

  /**
   * Update average processing time
   */
  private updateAverageProcessingTime(processingTime: number): void {
    const currentAvg = this.stats.averageProcessingTime;
    const totalCompleted = this.completedMessages.size;
    
    this.stats.averageProcessingTime = totalCompleted === 1
      ? processingTime
      : ((currentAvg * (totalCompleted - 1)) + processingTime) / totalCompleted;
    
    this.stats.lastProcessedAt = Date.now();
  }

  /**
   * Schedule next processing cycle
   */
  private scheduleNextProcessing(): void {
    if (this.processingTimer) {
      clearTimeout(this.processingTimer);
    }
    
    this.processingTimer = setTimeout(() => {
      if (!this.isPaused) {
        this.process();
      }
    }, 100);
  }

  /**
   * Setup automatic persistence
   */
  private setupAutoPersistence(): void {
    if (!this.config.persistencePath) return;
    
    this.persistenceTimer = setInterval(() => {
      this.persistMessages();
    }, 30000); // Persist every 30 seconds
  }

  /**
   * Persist messages to disk
   */
  private async persistMessages(): Promise<void> {
    if (!this.config.persistencePath) return;

    try {
      const fs = await import('fs/promises');
      const data = {
        pending: this.pendingQueue,
        failed: Array.from(this.failedMessages.values()),
        timestamp: Date.now(),
      };
      
      await fs.writeFile(this.config.persistencePath, JSON.stringify(data, null, 2));
    } catch (error) {
      this.logger.error('Failed to persist queue messages', { error });
    }
  }

  /**
   * Load persisted messages from disk
   */
  private async loadPersistedMessages(): Promise<void> {
    if (!this.config.persistencePath) return;

    try {
      const fs = await import('fs/promises');
      const data = await fs.readFile(this.config.persistencePath, 'utf-8');
      const parsed = JSON.parse(data);
      
      // Restore pending messages
      if (parsed.pending && Array.isArray(parsed.pending)) {
        this.pendingQueue.push(...parsed.pending);
      }
      
      // Restore failed messages
      if (parsed.failed && Array.isArray(parsed.failed)) {
        for (const message of parsed.failed) {
          this.failedMessages.set(message.id, message);
        }
      }
      
      this.updateStats();
      this.logger.info('Restored persisted queue messages', {
        pending: this.pendingQueue.length,
        failed: this.failedMessages.size,
      });
    } catch (error) {
      // File might not exist on first run - not an error
      this.logger.debug('No persisted messages found', { error: (error as Error).message });
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    this.pause();
    
    if (this.processingTimer) {
      clearTimeout(this.processingTimer);
    }
    
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }
    
    if (this.persistenceTimer) {
      clearInterval(this.persistenceTimer);
    }
    
    // Final persistence
    await this.persistMessages();
    
    this.logger.info('Queue cleanup completed');
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}