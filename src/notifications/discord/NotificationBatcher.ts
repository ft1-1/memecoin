/**
 * Notification batching and deduplication system
 */
import { EventEmitter } from 'events';
import { Logger } from '../../utils/Logger';
import {
  NotificationMessage,
  TokenAlertData,
  DiscordWebhookMessage,
} from '../../types/notifications';
import { EmbedTemplates } from './EmbedTemplates';

export interface BatchConfig {
  enabled: boolean;
  maxBatchSize: number;
  batchTimeoutMs: number;
  deduplicationWindowMs: number;
  similarityThreshold: number;
  groupingStrategy: 'time' | 'type' | 'token' | 'rating';
  minRatingForBatching: number;
}

export interface BatchGroup {
  id: string;
  type: NotificationMessage['type'];
  messages: NotificationMessage[];
  createdAt: number;
  lastUpdatedAt: number;
  scheduledAt?: number;
}

export interface DeduplicationRule {
  windowMs: number;
  keyGenerator: (message: NotificationMessage) => string;
  similarityCheck?: (msg1: NotificationMessage, msg2: NotificationMessage) => number;
}

export class NotificationBatcher extends EventEmitter {
  private readonly logger = Logger.getInstance();
  private readonly config: BatchConfig;
  private readonly batchGroups = new Map<string, BatchGroup>();
  private readonly messageHistory = new Map<string, { message: NotificationMessage; timestamp: number }>();
  private readonly batchTimers = new Map<string, NodeJS.Timeout>();
  private cleanupTimer?: NodeJS.Timeout;

  constructor(config: BatchConfig) {
    super();
    this.config = config;
    this.startCleanupTimer();
  }

  /**
   * Process message for batching and deduplication
   */
  async processMessage(message: NotificationMessage): Promise<'batched' | 'immediate' | 'deduplicated'> {
    // Check for deduplication first
    if (this.isDuplicate(message)) {
      this.logger.debug('Message deduplicated', { messageId: message.id });
      return 'deduplicated';
    }

    // Add to history
    this.addToHistory(message);

    // Check if batching is enabled and applicable
    if (!this.shouldBatch(message)) {
      this.emit('immediateMessage', message);
      return 'immediate';
    }

    // Add to appropriate batch group
    const groupId = this.getGroupId(message);
    await this.addToBatch(groupId, message);
    
    return 'batched';
  }

  /**
   * Manually trigger batch processing
   */
  async processBatch(groupId: string): Promise<void> {
    const group = this.batchGroups.get(groupId);
    if (!group || group.messages.length === 0) {
      return;
    }

    try {
      const batchMessage = await this.createBatchMessage(group);
      this.emit('batchMessage', batchMessage, group.messages);
      
      // Clear the batch
      this.clearBatch(groupId);
      
      this.logger.info('Batch processed successfully', {
        groupId,
        messageCount: group.messages.length,
      });
    } catch (error) {
      this.logger.error('Failed to process batch', { groupId, error });
      this.emit('batchError', groupId, error);
    }
  }

  /**
   * Force process all pending batches
   */
  async processAllBatches(): Promise<void> {
    const groupIds = Array.from(this.batchGroups.keys());
    
    for (const groupId of groupIds) {
      await this.processBatch(groupId);
    }
  }

  /**
   * Get current batch statistics
   */
  getBatchStats(): {
    totalGroups: number;
    totalPendingMessages: number;
    groupsByType: Record<string, number>;
    oldestBatch?: { groupId: string; age: number };
  } {
    const groupsByType: Record<string, number> = {};
    let totalMessages = 0;
    let oldestBatch: { groupId: string; age: number } | undefined;

    const now = Date.now();
    
    for (const [groupId, group] of this.batchGroups) {
      totalMessages += group.messages.length;
      groupsByType[group.type] = (groupsByType[group.type] || 0) + 1;
      
      const age = now - group.createdAt;
      if (!oldestBatch || age > oldestBatch.age) {
        oldestBatch = { groupId, age };
      }
    }

    return {
      totalGroups: this.batchGroups.size,
      totalPendingMessages: totalMessages,
      groupsByType,
      oldestBatch,
    };
  }

  /**
   * Clear all batches
   */
  clearAllBatches(): void {
    for (const timer of this.batchTimers.values()) {
      clearTimeout(timer);
    }
    
    this.batchGroups.clear();
    this.batchTimers.clear();
    
    this.logger.info('All batches cleared');
  }

  /**
   * Check if message is a duplicate
   */
  private isDuplicate(message: NotificationMessage): boolean {
    const deduplicationKey = this.generateDeduplicationKey(message);
    const now = Date.now();
    
    // Clean old entries first
    for (const [key, entry] of this.messageHistory) {
      if (now - entry.timestamp > this.config.deduplicationWindowMs) {
        this.messageHistory.delete(key);
      }
    }

    // Check for exact duplicates
    if (this.messageHistory.has(deduplicationKey)) {
      return true;
    }

    // Check for similar messages
    for (const [, entry] of this.messageHistory) {
      if (this.calculateSimilarity(message, entry.message) > this.config.similarityThreshold) {
        return true;
      }
    }

    return false;
  }

  /**
   * Add message to deduplication history
   */
  private addToHistory(message: NotificationMessage): void {
    const key = this.generateDeduplicationKey(message);
    this.messageHistory.set(key, {
      message,
      timestamp: Date.now(),
    });
  }

  /**
   * Generate deduplication key for message
   */
  private generateDeduplicationKey(message: NotificationMessage): string {
    if (message.type === 'token_alert' && message.metadata?.token) {
      const token = message.metadata.token;
      return `${message.type}:${token.address}:${token.symbol}`;
    }
    
    return `${message.type}:${message.title}:${message.content.slice(0, 100)}`;
  }

  /**
   * Calculate similarity between two messages
   */
  private calculateSimilarity(msg1: NotificationMessage, msg2: NotificationMessage): number {
    if (msg1.type !== msg2.type) {
      return 0;
    }

    // For token alerts, check if same token
    if (msg1.type === 'token_alert') {
      const token1 = msg1.metadata?.token;
      const token2 = msg2.metadata?.token;
      
      if (token1 && token2 && token1.address === token2.address) {
        return 1.0; // Same token = 100% similar
      }
    }

    // Title similarity
    const titleSimilarity = this.stringSimilarity(msg1.title, msg2.title);
    
    // Content similarity
    const contentSimilarity = this.stringSimilarity(msg1.content, msg2.content);
    
    return (titleSimilarity + contentSimilarity) / 2;
  }

  /**
   * Calculate string similarity using Jaccard index
   */
  private stringSimilarity(str1: string, str2: string): number {
    const set1 = new Set(str1.toLowerCase().split(/\s+/));
    const set2 = new Set(str2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }

  /**
   * Check if message should be batched
   */
  private shouldBatch(message: NotificationMessage): boolean {
    if (!this.config.enabled) {
      return false;
    }

    // High priority messages go immediately
    if (message.priority === 'critical') {
      return false;
    }

    // Check minimum rating for token alerts
    if (message.type === 'token_alert' && message.metadata?.rating) {
      const rating = message.metadata.rating.score;
      if (rating < this.config.minRatingForBatching) {
        return false;
      }
    }

    return true;
  }

  /**
   * Generate group ID based on grouping strategy
   */
  private getGroupId(message: NotificationMessage): string {
    const timestamp = Date.now();
    const timeWindow = Math.floor(timestamp / this.config.batchTimeoutMs);
    
    switch (this.config.groupingStrategy) {
      case 'time':
        return `time:${timeWindow}`;
        
      case 'type':
        return `type:${message.type}:${timeWindow}`;
        
      case 'token':
        if (message.type === 'token_alert' && message.metadata?.token) {
          return `token:${message.metadata.token.address}:${timeWindow}`;
        }
        return `type:${message.type}:${timeWindow}`;
        
      case 'rating':
        if (message.type === 'token_alert' && message.metadata?.rating) {
          const ratingTier = message.metadata.rating.score >= 8 ? 'high' : 'medium';
          return `rating:${ratingTier}:${timeWindow}`;
        }
        return `type:${message.type}:${timeWindow}`;
        
      default:
        return `default:${timeWindow}`;
    }
  }

  /**
   * Add message to batch group
   */
  private async addToBatch(groupId: string, message: NotificationMessage): Promise<void> {
    let group = this.batchGroups.get(groupId);
    
    if (!group) {
      group = {
        id: groupId,
        type: message.type,
        messages: [],
        createdAt: Date.now(),
        lastUpdatedAt: Date.now(),
      };
      
      this.batchGroups.set(groupId, group);
      
      // Schedule batch processing
      this.scheduleBatchProcessing(groupId);
    }

    group.messages.push(message);
    group.lastUpdatedAt = Date.now();

    this.logger.debug('Message added to batch', {
      groupId,
      messageId: message.id,
      batchSize: group.messages.length,
    });

    // Check if batch is full
    if (group.messages.length >= this.config.maxBatchSize) {
      await this.processBatch(groupId);
    }
  }

  /**
   * Schedule batch processing
   */
  private scheduleBatchProcessing(groupId: string): void {
    const timer = setTimeout(async () => {
      await this.processBatch(groupId);
    }, this.config.batchTimeoutMs);
    
    this.batchTimers.set(groupId, timer);
  }

  /**
   * Create batch message from group
   */
  private async createBatchMessage(group: BatchGroup): Promise<DiscordWebhookMessage> {
    if (group.type === 'token_alert') {
      return this.createTokenAlertBatch(group);
    }
    
    return this.createGenericBatch(group);
  }

  /**
   * Create batch message for token alerts
   */
  private createTokenAlertBatch(group: BatchGroup): DiscordWebhookMessage {
    const tokenAlerts: TokenAlertData[] = group.messages
      .map(msg => msg.metadata as TokenAlertData)
      .filter(Boolean)
      .sort((a, b) => b.rating.score - a.rating.score);

    const timeframe = this.getTimeframeDescription(group);
    const embed = EmbedTemplates.createBatchSummary(tokenAlerts, timeframe);

    return {
      content: `🚀 **${tokenAlerts.length} High-Potential Memecoin Opportunities**`,
      embeds: [embed],
    };
  }

  /**
   * Create generic batch message
   */
  private createGenericBatch(group: BatchGroup): DiscordWebhookMessage {
    const messageCount = group.messages.length;
    const timeframe = this.getTimeframeDescription(group);
    
    const content = group.messages
      .slice(0, 5) // Limit to first 5 messages
      .map(msg => `• ${msg.title}`)
      .join('\n');

    return {
      content: `📊 **${messageCount} ${group.type.replace('_', ' ')} notifications** (${timeframe})`,
      embeds: [{
        color: 0x0099ff,
        description: content + (messageCount > 5 ? `\n... and ${messageCount - 5} more` : ''),
        timestamp: new Date().toISOString(),
        fields: [],
      }],
    };
  }

  /**
   * Get human-readable timeframe description
   */
  private getTimeframeDescription(group: BatchGroup): string {
    const now = Date.now();
    const age = now - group.createdAt;
    
    if (age < 60000) {
      return 'past minute';
    } else if (age < 3600000) {
      return `past ${Math.floor(age / 60000)} minutes`;
    } else {
      return `past ${Math.floor(age / 3600000)} hours`;
    }
  }

  /**
   * Clear batch group
   */
  private clearBatch(groupId: string): void {
    this.batchGroups.delete(groupId);
    
    const timer = this.batchTimers.get(groupId);
    if (timer) {
      clearTimeout(timer);
      this.batchTimers.delete(groupId);
    }
  }

  /**
   * Start cleanup timer for old entries
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupOldEntries();
    }, 60000); // Cleanup every minute
  }

  /**
   * Cleanup old entries from history
   */
  private cleanupOldEntries(): void {
    const now = Date.now();
    const cutoff = now - this.config.deduplicationWindowMs;
    
    let cleaned = 0;
    for (const [key, entry] of this.messageHistory) {
      if (entry.timestamp < cutoff) {
        this.messageHistory.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      this.logger.debug('Cleaned up old deduplication entries', { count: cleaned });
    }
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.clearAllBatches();
    
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    
    this.messageHistory.clear();
    
    this.logger.info('Notification batcher cleanup completed');
  }
}