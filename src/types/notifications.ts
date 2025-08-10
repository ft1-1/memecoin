/**
 * Type definitions for notification system
 */

export interface NotificationMessage {
  id: string;
  type: 'token_alert' | 'system_alert' | 'error_alert';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  content: string;
  metadata?: Record<string, any>;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
}

export interface TokenAlertData {
  token: {
    address: string;
    symbol: string;
    name: string;
    price: number;
    marketCap: number;
    volume24h: number;
    priceChange24h: number;
    image?: string;
    website?: string;
    twitter?: string;
    telegram?: string;
  };
  rating: {
    score: number;
    confidence: number;
    recommendation: string;
    reasoning: string[];
    alerts: string[];
  };
  technicalAnalysis: {
    trend: string;
    momentum: number;
    rsi: number;
    volumeSpike: boolean;
    patterns: string[];
  };
  risk: {
    level: string;
    score: number;
    warnings: string[];
  };
  entrySignal?: {
    type: 'strong_buy' | 'buy' | 'watch' | 'no_signal';
    score: number;
    confidence: number;
    reasons: string[];
    risks: string[];
    entry?: {
      positionSize: number;
      maxSlippage: number;
      timeHorizon: 'short' | 'medium' | 'long';
    };
  };
  momentumAcceleration?: {
    sustainabilityScore: number;
    fatigueLevel: 'none' | 'mild' | 'moderate' | 'severe';
    entrySignalStrength: number;
    consecutiveCandles: {
      count: number;
      direction: 'bullish' | 'bearish' | 'neutral';
    };
  };
  charts?: {
    priceChart?: string; // URL or base64
    volumeChart?: string;
  };
}

export interface DiscordEmbed {
  color?: number;
  title?: string;
  url?: string;
  author?: {
    name: string;
    url?: string;
    icon_url?: string;
  };
  description?: string;
  thumbnail?: {
    url: string;
  };
  image?: {
    url: string;
  };
  fields: Array<{
    name: string;
    value: string;
    inline?: boolean;
  }>;
  footer?: {
    text: string;
    icon_url?: string;
  };
  timestamp?: string;
}

export interface DiscordWebhookMessage {
  content?: string;
  username?: string;
  avatar_url?: string;
  tts?: boolean;
  embeds?: DiscordEmbed[];
  allowed_mentions?: {
    parse?: ('roles' | 'users' | 'everyone')[];
    roles?: string[];
    users?: string[];
  };
}

export interface NotificationTemplate {
  name: string;
  type: NotificationMessage['type'];
  template: {
    title: string;
    content: string;
    embed?: Partial<DiscordEmbed>;
  };
  variables: string[];
  formatting: {
    colors: Record<string, number>;
    icons: Record<string, string>;
    emojis: Record<string, string>;
  };
}

export interface NotificationQueue {
  add(message: NotificationMessage): Promise<void>;
  process(): Promise<void>;
  getStats(): Promise<QueueStats>;
  clear(): Promise<void>;
  pause(): void;
  resume(): void;
}

export interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  totalProcessed: number;
  averageProcessingTime: number;
  lastProcessedAt?: number;
}

export interface NotificationConfig {
  enabled: boolean;
  rateLimits: {
    messagesPerMinute: number;
    messagesPerHour: number;
    messagesPerDay: number;
  };
  retry: {
    maxAttempts: number;
    backoffMultiplier: number;
    initialDelay: number;
    maxDelay: number;
  };
  filters: {
    minRating: number;
    maxNotificationsPerToken: number;
    cooldownMinutes: number;
    priorityThresholds: Record<NotificationMessage['priority'], number>;
  };
}

export interface NotificationProvider {
  name: string;
  send(message: NotificationMessage): Promise<NotificationResult>;
  validateConfig(): Promise<boolean>;
  getStatus(): Promise<ProviderStatus>;
}

export interface NotificationResult {
  success: boolean;
  messageId?: string;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
    retryAfter?: number;
  };
  metadata?: Record<string, any>;
}

export interface ProviderStatus {
  healthy: boolean;
  responseTime: number;
  rateLimitRemaining?: number;
  rateLimitReset?: number;
  lastError?: {
    timestamp: number;
    message: string;
  };
}

export interface NotificationHistory {
  messageId: string;
  tokenAddress: string;
  notificationType: NotificationMessage['type'];
  provider: string;
  status: 'sent' | 'failed' | 'cancelled';
  sentAt: number;
  attempts: number;
  error?: string;
}

export interface AlertRule {
  id: string;
  name: string;
  enabled: boolean;
  conditions: {
    rating: { min?: number; max?: number };
    confidence: { min?: number };
    marketCap: { min?: number; max?: number };
    volume: { min?: number };
    priceChange: { min?: number; max?: number };
    patterns?: string[];
    riskLevel?: string[];
  };
  actions: {
    notify: boolean;
    priority: NotificationMessage['priority'];
    channels: string[];
    template: string;
    cooldownMinutes: number;
  };
  schedule?: {
    enabled: boolean;
    timeZone: string;
    allowedHours: number[];
    allowedDays: number[];
  };
}