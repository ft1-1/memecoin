/**
 * ActivityLogger - Provides simple, human-readable logging for major activities
 */
export class ActivityLogger {
  constructor(private logger: any) {}

  // Main cycle events
  cycleStart(cycleNumber: number) {
    this.logger.info('Starting analysis cycle', { 
      activity: 'CYCLE_START',
      cycleNumber
    });
  }

  cycleComplete(stats: {
    tokensAnalyzed: number;
    highRatedTokens: number;
    notificationsSent: number;
    duration: string;
    ratingDistribution?: Record<number, number>;
  }) {
    this.logger.info('Analysis cycle complete', {
      activity: 'CYCLE_COMPLETE',
      ...stats
    });
  }

  // Token fetching
  fetchingTokens() {
    this.logger.info('Fetching trending tokens', { 
      activity: 'FETCHING_TOKENS' 
    });
  }

  tokensFetched(count: number) {
    this.logger.info('Tokens fetched', { 
      activity: 'TOKENS_FETCHED',
      count
    });
  }

  // Analysis
  analyzingTokens(count: number) {
    this.logger.info('Analyzing tokens', {
      activity: 'ANALYZING_TOKENS',
      count
    });
  }

  tokenAnalyzed(symbol: string, rating: number, breakdown?: {
    technical: number;
    momentum: number;
    volume: number;
    risk: number;
    ai?: number;
  }) {
    this.logger.info('Token analyzed', {
      activity: 'TOKEN_ANALYZED',
      symbol,
      rating: rating.toFixed(1),
      breakdown: breakdown ? {
        technical: breakdown.technical.toFixed(1),
        momentum: breakdown.momentum.toFixed(1),
        volume: breakdown.volume.toFixed(1),
        risk: breakdown.risk.toFixed(1),
        ai: breakdown.ai ? breakdown.ai.toFixed(1) : undefined
      } : undefined
    });

    // Special highlight for high-rated tokens
    if (rating >= 7) {
      this.logger.info('High-rated token found!', {
        activity: 'HIGH_RATED_TOKEN',
        symbol,
        rating: rating.toFixed(1)
      });
    }
  }

  // AI Analysis
  aiAnalysisStarted(symbol: string) {
    this.logger.info('AI analysis started', {
      activity: 'AI_ANALYSIS',
      symbol
    });
  }

  // Notifications
  sendingNotification(symbol: string, rating: number) {
    this.logger.info('Sending notification', {
      activity: 'SENDING_NOTIFICATION',
      symbol,
      rating: rating.toFixed(1)
    });
  }

  notificationSent(symbol: string) {
    this.logger.info('Notification sent', {
      activity: 'NOTIFICATION_SENT',
      symbol
    });
  }

  notificationFailed(symbol: string, error: string) {
    this.logger.error(`Failed to send notification for ${symbol}: ${error}`, {
      userFriendly: true
    });
  }

  // System events
  systemStarted() {
    this.logger.info('System started successfully', {
      activity: 'SYSTEM_STARTED'
    });
  }

  waitingForNextCycle(nextRun: string) {
    this.logger.info('Waiting for next cycle', {
      activity: 'WAITING',
      nextRun
    });
  }

  healthCheck(status: 'healthy' | 'degraded' | 'unhealthy') {
    this.logger.info('Health check', {
      activity: 'HEALTH_CHECK',
      status
    });
  }

  // Errors (user-friendly)
  error(message: string) {
    this.logger.error(message, {
      userFriendly: true
    });
  }

  warning(message: string) {
    this.logger.warn(message, {
      important: true
    });
  }

  // Technical logging (hidden in simple mode)
  technical(message: string, meta?: any) {
    this.logger.debug(message, { 
      ...meta,
      technical: true 
    });
  }
}