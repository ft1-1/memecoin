# Discord Notification System

A comprehensive, production-ready Discord notification system for the memecoin analyzer with advanced features including rate limiting, batching, deduplication, and failure recovery.

## Features

### Core Capabilities
- **Rich Embed Messages**: Beautiful, informative Discord embeds with token data, charts, and analysis
- **Rate Limiting**: Intelligent rate limiting to comply with Discord API limits (5 messages per 2 seconds)
- **Retry Logic**: Exponential backoff retry mechanism with configurable attempts and delays
- **Queue System**: Reliable message queuing with persistence and recovery
- **Batching**: Smart message batching to reduce spam and improve user experience
- **Deduplication**: Prevents duplicate notifications with configurable similarity thresholds
- **History Tracking**: Comprehensive notification history with analytics and insights
- **Health Monitoring**: Real-time health checks and performance monitoring

### Message Types
1. **Token Alerts**: High-potential memecoin opportunities with detailed analysis
2. **Batch Summaries**: Multiple opportunities grouped intelligently
3. **Error Alerts**: System errors and issues with severity levels
4. **Daily Reports**: Comprehensive daily analysis summaries
5. **System Status**: Health checks and system status updates

## Architecture

```
DiscordNotificationService (Main Orchestrator)
├── DiscordWebhookClient (HTTP Client)
│   ├── Rate Limiting
│   ├── Retry Logic
│   └── Error Handling
├── NotificationQueue (Message Queue)
│   ├── Persistence
│   ├── Concurrency Control
│   └── Recovery
├── NotificationBatcher (Smart Batching)
│   ├── Deduplication
│   ├── Grouping Strategies
│   └── Similarity Detection
├── NotificationHistory (Analytics)
│   ├── Performance Metrics
│   ├── Failure Analysis
│   └── Recovery Tools
└── EmbedTemplates (Rich Formatting)
    ├── Token Alerts
    ├── Batch Summaries
    └── System Messages
```

## Quick Start

### Basic Setup

```typescript
import { DiscordNotificationService, DiscordConfigFactory } from './discord';

// Create production configuration
const config = DiscordConfigFactory.createProductionConfig({
  webhookUrl: process.env.DISCORD_WEBHOOK_URL!,
  userAgent: 'Memecoin Analyzer/1.0',
  persistencePath: './data/discord',
  enableBatching: true,
  enableAnalytics: true,
});

// Initialize service
const discordService = new DiscordNotificationService(config);
await discordService.initialize();

// Send token alert
const tokenData = {
  token: {
    address: 'So11111111111111111111111111111111111111112',
    symbol: 'SOL',
    name: 'Solana',
    price: 100.50,
    marketCap: 45000000,
    volume24h: 2500000,
    priceChange24h: 15.75,
  },
  rating: {
    score: 8.5,
    confidence: 92,
    recommendation: 'Strong Buy - Excellent momentum with low risk',
    reasoning: ['High volume spike', 'Breaking resistance', 'Strong fundamentals'],
    alerts: ['Volume 300% above average', 'RSI showing bullish divergence'],
  },
  technicalAnalysis: {
    trend: 'Bullish',
    momentum: 85,
    rsi: 65,
    volumeSpike: true,
    patterns: ['Bull Flag', 'Volume Breakout'],
  },
  risk: {
    level: 'Low',
    score: 25,
    warnings: [],
  },
};

const result = await discordService.sendTokenAlert(tokenData);
console.log('Alert sent:', result.success);
```

### Configuration Options

#### Production Configuration
```typescript
const config = DiscordConfigFactory.createProductionConfig({
  webhookUrl: 'https://discord.com/api/webhooks/...',
  userAgent: 'Your Bot Name/1.0',
  persistencePath: './data/discord',
  enableBatching: true,
  enableAnalytics: true,
});
```

#### Development Configuration
```typescript
const config = DiscordConfigFactory.createDevelopmentConfig({
  webhookUrl: 'https://discord.com/api/webhooks/...',
  userAgent: 'Your Bot Name/1.0-dev',
});
```

#### High-Volume Configuration
```typescript
const config = DiscordConfigFactory.createHighVolumeConfig({
  webhookUrl: 'https://discord.com/api/webhooks/...',
  userAgent: 'Your Bot Name/1.0',
  persistencePath: './data/discord',
});
```

## Advanced Usage

### Custom Message Creation

```typescript
import { NotificationMessage } from '../../types/notifications';

const customMessage: NotificationMessage = {
  id: 'custom-alert-123',
  type: 'token_alert',
  priority: 'high',
  title: 'Custom Alert',
  content: 'Custom notification content',
  metadata: { /* your data */ },
  timestamp: Date.now(),
  retryCount: 0,
  maxRetries: 3,
};

await discordService.send(customMessage);
```

### Batch Processing

```typescript
// Force process all pending batches
await discordService.flushBatches();

// Get batch statistics
const stats = await discordService.getServiceStats();
console.log('Pending batches:', stats.batch.totalGroups);
```

### Error Handling and Recovery

```typescript
// Send error alert
await discordService.sendErrorAlert(
  new Error('Database connection failed'),
  'DatabaseManager',
  'high'
);

// Retry failed notifications
const retryResults = await discordService.retryFailedNotifications();
console.log(`Retried ${retryResults.attempted}, successful: ${retryResults.successful}`);
```

### Analytics and Monitoring

```typescript
// Get comprehensive statistics
const stats = await discordService.getServiceStats();
console.log('Success rate:', stats.history.successRate);
console.log('Average latency:', stats.history.averageProcessingTime);

// Get service health status
const status = await discordService.getStatus();
console.log('Service healthy:', status.healthy);
console.log('Rate limit remaining:', status.rateLimitRemaining);
```

## Configuration Reference

### Webhook Configuration
```typescript
interface DiscordWebhookConfig {
  webhookUrl: string;           // Discord webhook URL
  userAgent: string;            // HTTP user agent
  timeout: number;              // Request timeout (ms)
  rateLimit: {
    messagesPerSecond: number;  // Rate limit compliance
    burstLimit: number;         // Burst capacity
    resetIntervalMs: number;    // Reset interval
  };
  retry: {
    maxAttempts: number;        // Max retry attempts
    initialDelayMs: number;     // Initial retry delay
    maxDelayMs: number;         // Maximum retry delay
    backoffMultiplier: number;  // Exponential backoff multiplier
    retryableStatusCodes: number[]; // HTTP codes to retry
  };
}
```

### Queue Configuration
```typescript
interface QueueConfig {
  maxSize: number;              // Maximum queue size
  concurrency: number;          // Concurrent processing limit
  retryDelayMs: number;         // Retry delay
  maxRetries: number;           // Max retries per message
  persistencePath?: string;     // Persistence file path
  processingTimeoutMs: number;  // Processing timeout
  batchSize: number;            // Batch processing size
  batchTimeoutMs: number;       // Batch timeout
}
```

### Batch Configuration
```typescript
interface BatchConfig {
  enabled: boolean;             // Enable batching
  maxBatchSize: number;         // Maximum messages per batch
  batchTimeoutMs: number;       // Batch timeout
  deduplicationWindowMs: number; // Deduplication window
  similarityThreshold: number;  // Similarity threshold (0-1)
  groupingStrategy: 'time' | 'type' | 'token' | 'rating';
  minRatingForBatching: number; // Minimum rating to batch
}
```

## Message Templates

The system includes pre-built templates for various message types:

### Token Alert Template
- Token name and symbol prominently displayed
- Current price with 24h change percentage
- Market cap and volume information
- Technical analysis summary with indicators
- Risk assessment with warnings
- Buy rating with visual stars
- Action buttons and links

### Batch Summary Template
- Summary statistics
- Top opportunities list
- Volume and rating aggregates
- Time-based grouping information

### Error Alert Template
- Error severity indication
- Component identification
- Stack trace (truncated)
- Impact assessment
- Timestamp and context

## Best Practices

### Performance Optimization
1. **Use Batching**: Enable batching for high-volume scenarios
2. **Configure Rate Limits**: Set appropriate rate limits for your use case
3. **Monitor Health**: Use health checks to detect issues early
4. **Persistent Storage**: Use persistence for production deployments

### Error Handling
1. **Graceful Degradation**: Handle Discord API outages gracefully
2. **Retry Logic**: Configure appropriate retry strategies
3. **Circuit Breakers**: Implement circuit breakers for external dependencies
4. **Monitoring**: Monitor success rates and performance metrics

### Security
1. **Webhook URLs**: Keep webhook URLs secure and rotate regularly
2. **Content Sanitization**: Sanitize user content before sending
3. **Rate Limiting**: Respect Discord's rate limits to avoid bans
4. **Error Information**: Be careful not to leak sensitive information in error messages

## Troubleshooting

### Common Issues

#### High Failure Rate
- Check webhook URL validity
- Verify Discord server permissions
- Monitor rate limit compliance
- Review error logs for patterns

#### Slow Performance
- Reduce batch sizes
- Increase concurrency limits
- Optimize embed complexity
- Check network connectivity

#### Memory Usage
- Reduce history retention
- Lower queue size limits
- Enable compression
- Clear old batches regularly

### Debug Mode

```typescript
// Enable debug logging
process.env.LOG_LEVEL = 'debug';

// Use development configuration
const config = DiscordConfigFactory.createDevelopmentConfig({
  webhookUrl: process.env.DISCORD_WEBHOOK_URL!,
});
```

### Monitoring Commands

```typescript
// Get detailed statistics
const stats = await discordService.getServiceStats();

// Export history for analysis
const historyData = await discordService.history.exportHistory('json', {
  startTime: Date.now() - 24 * 60 * 60 * 1000, // Last 24 hours
  includePII: false,
});

// Get insights and recommendations
const insights = await discordService.history.getInsights(24);
console.log('Recommendations:', insights.recommendations);
```

## License

This Discord notification system is part of the Memecoin Analyzer project and follows the same licensing terms.