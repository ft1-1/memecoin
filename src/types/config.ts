/**
 * Type definitions for application configuration
 */

export interface ApiConfig {
  solanaTracker: {
    baseUrl: string;
    apiKey: string;
    timeout: number;
    rateLimitRps: number;
    requestDelayMs: number;
    maxRetries: number;
    retryDelayMs: number;
  };
  claude: {
    apiKey: string;
    baseUrl?: string;
    model: string;
    timeout: number;
    maxRetries: number;
    retryDelayMs: number;
    maxTokens: number;
    temperature: number;
  };
}

export interface AnalysisConfig {
  marketCapRange: {
    min: number;
    max: number;
  };
  ratingThreshold: number;
  intervals: string[];
  technicalIndicators: {
    rsi: {
      period: number;
      overbought: number;
      oversold: number;
    };
    macd: {
      fastPeriod: number;
      slowPeriod: number;
      signalPeriod: number;
    };
    bollinger: {
      period: number;
      stdDev: number;
    };
    ema: {
      periods: number[];
    };
  };
  volume: {
    minVolumeUsd: number;
    volumeSpikeFactor: number;
  };
  aiAnalysis?: {
    enabled: boolean;
    minTechnicalRating: number;
    weight: number;
    timeout: number;
    maxRetries: number;
  };
}

export interface NotificationConfig {
  discord: {
    enabled: boolean;
    webhookUrl: string;
    rateLimitRpm: number;
    maxRetries: number;
    embedColor: string;
    mentionRoles?: string[];
  };
}

export interface SchedulerConfig {
  analysisInterval: string; // Cron expression or numeric minutes (e.g., "5" or "*/5 * * * *")
  healthCheckInterval: string; // Cron expression
  cleanupInterval: string; // Cron expression
  timezone: string;
}

export interface DatabaseConfig {
  type: 'sqlite';
  path: string;
  connectionPoolSize: number;
  queryTimeout: number;
  backupEnabled: boolean;
  backupInterval: string;
  retentionDays: number;
}

export interface MonitoringConfig {
  healthCheck: {
    enabled: boolean;
    port: number;
    path: string;
  };
  metrics: {
    enabled: boolean;
    port: number;
    path: string;
  };
  logging: {
    level: 'error' | 'warn' | 'info' | 'debug';
    format: 'json' | 'text';
    file: {
      enabled: boolean;
      path: string;
      maxSize: string;
      maxFiles: number;
    };
  };
  alerts: {
    errorRateThreshold: number;
    responseTimeThreshold: number;
    diskSpaceThreshold: number;
  };
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  successThreshold: number;
  timeout: number;
  monitor: boolean;
}

export interface AppConfig {
  api: ApiConfig;
  analysis: AnalysisConfig;
  notifications: NotificationConfig;
  scheduler: SchedulerConfig;
  database: DatabaseConfig;
  monitoring: MonitoringConfig;
  circuitBreaker: CircuitBreakerConfig;
}

export interface EnvironmentVariables {
  NODE_ENV: 'development' | 'production' | 'test';
  SOLANA_TRACKER_API_KEY: string;
  CLAUDE_API_KEY: string;
  DISCORD_WEBHOOK_URL: string;
  DATABASE_PATH?: string;
  HEALTH_CHECK_PORT?: string;
  LOG_LEVEL?: string;
  ANALYSIS_INTERVAL?: string; // Numeric minutes (e.g., "5") or cron expression (e.g., "*/5 * * * *")
  MARKET_CAP_MIN?: string;
  MARKET_CAP_MAX?: string;
  MIN_RATING_THRESHOLD?: string;
  API_REQUEST_DELAY_MS?: string;
  CLAUDE_MODEL?: string;
  CLAUDE_TIMEOUT?: string;
  CLAUDE_MAX_TOKENS?: string;
  AI_ANALYSIS_THRESHOLD?: string;
}