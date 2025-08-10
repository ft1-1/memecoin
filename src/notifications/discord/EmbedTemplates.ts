/**
 * Rich embed templates for Discord notifications
 */
import { DiscordEmbed, TokenAlertData, NotificationMessage } from '../../types/notifications';

export interface EmbedColors {
  readonly SUCCESS: number;
  readonly WARNING: number;
  readonly ERROR: number;
  readonly INFO: number;
  readonly HIGH_RATING: number;
  readonly MEDIUM_RATING: number;
  readonly LOW_RATING: number;
  readonly BULLISH: number;
  readonly BEARISH: number;
  readonly NEUTRAL: number;
}

export const EMBED_COLORS: EmbedColors = {
  SUCCESS: 0x00ff00,    // Green
  WARNING: 0xffaa00,    // Orange
  ERROR: 0xff0000,      // Red
  INFO: 0x0099ff,       // Blue
  HIGH_RATING: 0x00ff00, // Green for rating >= 8
  MEDIUM_RATING: 0xffaa00, // Orange for rating 6-7
  LOW_RATING: 0xff6600,   // Red-orange for rating < 6
  BULLISH: 0x00cc44,    // Dark green
  BEARISH: 0xdd2c00,    // Dark red
  NEUTRAL: 0x607d8b,    // Blue grey
} as const;

export interface EmbedIcons {
  readonly ROCKET: string;
  readonly FIRE: string;
  readonly CHART_UP: string;
  readonly CHART_DOWN: string;
  readonly WARNING: string;
  readonly STAR: string;
  readonly MONEY: string;
  readonly CLOCK: string;
  readonly VOLUME: string;
  readonly RISK: string;
  readonly BULLISH: string;
  readonly BEARISH: string;
}

export const EMBED_ICONS: EmbedIcons = {
  ROCKET: '🚀',
  FIRE: '🔥',
  CHART_UP: '📈',
  CHART_DOWN: '📉',
  WARNING: '⚠️',
  STAR: '⭐',
  MONEY: '💰',
  CLOCK: '⏰',
  VOLUME: '📊',
  RISK: '🛡️',
  BULLISH: '🟢',
  BEARISH: '🔴',
} as const;

export const ENTRY_SIGNAL_ICONS = {
  strong_buy: '🟢🚀',
  buy: '🟢',
  watch: '🟡',
  no_signal: '⚫',
} as const;

export class EmbedTemplates {
  /**
   * Validate if a URL is a valid image URL
   */
  private static isValidImageUrl(url?: string): boolean {
    if (!url) return false;
    
    try {
      const urlObj = new URL(url);
      // Check for common image extensions and ensure it's HTTP/HTTPS
      const validProtocols = ['http:', 'https:'];
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
      const hasValidExtension = imageExtensions.some(ext => 
        urlObj.pathname.toLowerCase().endsWith(ext)
      );
      
      return validProtocols.includes(urlObj.protocol) && 
             (hasValidExtension || urlObj.hostname.includes('imgur') || 
              urlObj.hostname.includes('cloudflare') || 
              urlObj.hostname.includes('ipfs') ||
              urlObj.hostname.includes('arweave'));
    } catch {
      return false;
    }
  }

  /**
   * Get token thumbnail URL with fallback
   */
  private static getTokenThumbnail(tokenImage?: string): string {
    // If token has a valid image, use it
    if (this.isValidImageUrl(tokenImage)) {
      return tokenImage!;
    }
    
    // Fallback to Solana logo
    return 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png';
  }

  /**
   * Create high-priority token alert embed
   */
  static createTokenAlert(data: TokenAlertData): DiscordEmbed {
    const { token, rating, technicalAnalysis, risk, entrySignal, momentumAcceleration } = data;
    const color = this.getRatingColor(rating.score);
    const ratingStars = this.getRatingStars(rating.score);
    const trendIcon = this.getTrendIcon(technicalAnalysis.trend, token.priceChange24h);
    const riskIcon = this.getRiskIcon(risk.level);
    const entrySignalIcon = entrySignal ? ENTRY_SIGNAL_ICONS[entrySignal.type] : '';

    const fields = [
      {
        name: `${EMBED_ICONS.STAR} Rating`,
        value: `**${rating.score}/10** ${ratingStars}\nConfidence: ${rating.confidence}%`,
        inline: true,
      },
      {
        name: `${EMBED_ICONS.MONEY} Price`,
        value: `$${this.formatPrice(token.price)}\n${this.formatChange(token.priceChange24h)}`,
        inline: true,
      },
      {
        name: `${EMBED_ICONS.VOLUME} Market Data`,
        value: `Cap: $${this.formatLargeNumber(token.marketCap)}\nVol: $${this.formatLargeNumber(token.volume24h)}`,
        inline: true,
      },
    ];

    // Add entry signal field if available
    if (entrySignal && entrySignal.type !== 'no_signal') {
      fields.push({
        name: `${entrySignalIcon} Entry Signal`,
        value: this.formatEntrySignal(entrySignal),
        inline: false,
      });
    }

    // Add momentum acceleration field if available
    if (momentumAcceleration) {
      fields.push({
        name: `⚡ Momentum Analysis`,
        value: this.formatMomentumAcceleration(momentumAcceleration),
        inline: false,
      });
    }

    fields.push(
      {
        name: `${EMBED_ICONS.CHART_UP} Technical Analysis`,
        value: this.formatTechnicalSummary(technicalAnalysis),
        inline: false,
      },
      {
        name: `${riskIcon} Risk Assessment`,
        value: `**${risk.level.toUpperCase()}** (${risk.score}/100)\n${risk.warnings.slice(0, 2).join('\n') || 'No major warnings'}`,
        inline: false,
      },
      {
        name: `${EMBED_ICONS.FIRE} Key Highlights`,
        value: rating.alerts.slice(0, 3).join('\n') || 'Strong momentum detected',
        inline: false,
      }
    );

    return {
      color,
      title: `${EMBED_ICONS.ROCKET} ${token.name} (${token.symbol})`,
      url: `https://dexscreener.com/solana/${token.address}`,
      description: `**High-Potential Memecoin Alert** ${trendIcon}\n${rating.recommendation}`,
      thumbnail: {
        url: this.getTokenThumbnail(token.image),
      },
      fields,
      footer: {
        text: `Memecoin Analyzer • Data freshness: Live`,
        icon_url: 'https://cdn.discordapp.com/avatars/1234567890/avatar.png',
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Create batch summary embed for multiple opportunities
   */
  static createBatchSummary(tokens: TokenAlertData[], timeframe: string): DiscordEmbed {
    const highRatedCount = tokens.filter(t => t.rating.score >= 8).length;
    const totalVolume = tokens.reduce((sum, t) => sum + t.token.volume24h, 0);
    const avgRating = tokens.reduce((sum, t) => sum + t.rating.score, 0) / tokens.length;

    const topTokens = tokens
      .sort((a, b) => b.rating.score - a.rating.score)
      .slice(0, 5)
      .map(t => `**${t.token.symbol}** (${t.rating.score}/10) - $${this.formatPrice(t.token.price)}`)
      .join('\n');

    return {
      color: EMBED_COLORS.INFO,
      title: `${EMBED_ICONS.FIRE} Memecoin Opportunities Summary`,
      description: `**${tokens.length} high-potential tokens** identified in the last ${timeframe}`,
      fields: [
        {
          name: `${EMBED_ICONS.STAR} Summary Stats`,
          value: `High-rated (8+): **${highRatedCount}**\nAvg Rating: **${avgRating.toFixed(1)}/10**\nTotal Volume: **$${this.formatLargeNumber(totalVolume)}**`,
          inline: false,
        },
        {
          name: `${EMBED_ICONS.ROCKET} Top Opportunities`,
          value: topTokens,
          inline: false,
        },
        {
          name: `${EMBED_ICONS.CLOCK} Next Analysis`,
          value: 'Scanning for new opportunities every 5 minutes',
          inline: false,
        },
      ],
      footer: {
        text: `Memecoin Analyzer • Batch processed at`,
        icon_url: 'https://cdn.discordapp.com/avatars/1234567890/avatar.png',
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Create system error alert embed
   */
  static createErrorAlert(error: Error, component: string, severity: 'low' | 'medium' | 'high' | 'critical'): DiscordEmbed {
    const colorMap = {
      low: EMBED_COLORS.WARNING,
      medium: EMBED_COLORS.WARNING,
      high: EMBED_COLORS.ERROR,
      critical: EMBED_COLORS.ERROR,
    };

    const iconMap = {
      low: EMBED_ICONS.WARNING,
      medium: EMBED_ICONS.WARNING,
      high: '🚨',
      critical: '💀',
    };

    return {
      color: colorMap[severity],
      title: `${iconMap[severity]} System Alert - ${severity.toUpperCase()}`,
      description: `**Component:** ${component}\n**Error:** ${error.message}`,
      fields: [
        {
          name: `${EMBED_ICONS.CLOCK} Timestamp`,
          value: new Date().toLocaleString(),
          inline: true,
        },
        {
          name: '🔧 Impact',
          value: severity === 'critical' 
            ? 'System functionality severely impaired'
            : severity === 'high'
            ? 'Some features may be unavailable'
            : 'Minor functionality affected',
          inline: true,
        },
        {
          name: '📋 Stack Trace',
          value: `\`\`\`\n${error.stack?.slice(0, 1000) || 'No stack trace available'}\n\`\`\``,
          inline: false,
        },
      ],
      footer: {
        text: 'Automated System Monitoring',
        icon_url: 'https://cdn.discordapp.com/avatars/1234567890/avatar.png',
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Create daily summary report embed
   */
  static createDailySummary(stats: {
    tokensAnalyzed: number;
    highRatedTokens: number;
    alertsSent: number;
    avgRating: number;
    topPerformer: TokenAlertData | null;
    systemUptime: number;
  }): DiscordEmbed {
    const uptimeHours = Math.floor(stats.systemUptime / 3600);
    const uptimeMinutes = Math.floor((stats.systemUptime % 3600) / 60);

    return {
      color: EMBED_COLORS.INFO,
      title: `${EMBED_ICONS.CHART_UP} Daily Analysis Report`,
      description: 'Comprehensive analysis summary for the past 24 hours',
      fields: [
        {
          name: `${EMBED_ICONS.VOLUME} Analysis Stats`,
          value: `Tokens Analyzed: **${stats.tokensAnalyzed.toLocaleString()}**\nHigh-Rated (≥7): **${stats.highRatedTokens}**\nAlerts Sent: **${stats.alertsSent}**`,
          inline: true,
        },
        {
          name: `${EMBED_ICONS.STAR} Performance`,
          value: `Avg Rating: **${stats.avgRating.toFixed(1)}/10**\nSystem Uptime: **${uptimeHours}h ${uptimeMinutes}m**`,
          inline: true,
        },
        ...(stats.topPerformer ? [{
          name: `${EMBED_ICONS.ROCKET} Top Performer`,
          value: `**${stats.topPerformer.token.symbol}** - ${stats.topPerformer.rating.score}/10\nPrice: $${this.formatPrice(stats.topPerformer.token.price)}\nChange: ${this.formatChange(stats.topPerformer.token.priceChange24h)}`,
          inline: false,
        }] : []),
        {
          name: `${EMBED_ICONS.CLOCK} Next Report`,
          value: 'Daily summary will be generated in 24 hours',
          inline: false,
        },
      ],
      footer: {
        text: 'Memecoin Analyzer • Daily Report',
        icon_url: 'https://cdn.discordapp.com/avatars/1234567890/avatar.png',
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Create system status embed
   */
  static createSystemStatus(status: {
    healthy: boolean;
    components: Array<{
      name: string;
      status: 'healthy' | 'degraded' | 'down';
      responseTime?: number;
      lastError?: string;
    }>;
    uptime: number;
    version: string;
  }): DiscordEmbed {
    const statusIcon = status.healthy ? '✅' : '❌';
    const uptimeHours = Math.floor(status.uptime / 3600);

    const componentStatus = status.components
      .map(comp => {
        const icon = comp.status === 'healthy' ? '🟢' : comp.status === 'degraded' ? '🟡' : '🔴';
        const responseTime = comp.responseTime ? ` (${comp.responseTime}ms)` : '';
        return `${icon} **${comp.name}**: ${comp.status}${responseTime}`;
      })
      .join('\n');

    return {
      color: status.healthy ? EMBED_COLORS.SUCCESS : EMBED_COLORS.ERROR,
      title: `${statusIcon} System Status`,
      description: `Overall system health: **${status.healthy ? 'HEALTHY' : 'DEGRADED'}**`,
      fields: [
        {
          name: '🔧 Components',
          value: componentStatus,
          inline: false,
        },
        {
          name: `${EMBED_ICONS.CLOCK} System Info`,
          value: `Uptime: **${uptimeHours} hours**\nVersion: **${status.version}**`,
          inline: true,
        },
      ],
      footer: {
        text: 'System Health Check',
        icon_url: 'https://cdn.discordapp.com/avatars/1234567890/avatar.png',
      },
      timestamp: new Date().toISOString(),
    };
  }

  // Helper methods
  
  private static getRatingColor(rating: number): number {
    if (rating >= 8) return EMBED_COLORS.HIGH_RATING;
    if (rating >= 6) return EMBED_COLORS.MEDIUM_RATING;
    return EMBED_COLORS.LOW_RATING;
  }

  private static getRatingStars(rating: number): string {
    const fullStars = Math.floor(rating / 2);
    const halfStar = rating % 2 >= 1 ? '⭐' : '';
    return '⭐'.repeat(fullStars) + halfStar;
  }

  private static getTrendIcon(trend: string, priceChange: number): string {
    if (trend.toLowerCase().includes('bullish') || priceChange > 5) {
      return EMBED_ICONS.BULLISH + EMBED_ICONS.CHART_UP;
    }
    if (trend.toLowerCase().includes('bearish') || priceChange < -5) {
      return EMBED_ICONS.BEARISH + EMBED_ICONS.CHART_DOWN;
    }
    return EMBED_ICONS.CHART_UP;
  }

  private static getRiskIcon(riskLevel: string): string {
    switch (riskLevel.toLowerCase()) {
      case 'low': return '🟢';
      case 'medium': return '🟡';
      case 'high': return '🟠';
      case 'critical': return '🔴';
      default: return EMBED_ICONS.RISK;
    }
  }

  private static formatPrice(price: number): string {
    if (price < 0.000001) {
      return price.toExponential(2);
    }
    if (price < 0.01) {
      return price.toFixed(6);
    }
    if (price < 1) {
      return price.toFixed(4);
    }
    return price.toFixed(2);
  }

  private static formatChange(change: number): string {
    const sign = change >= 0 ? '+' : '';
    const icon = change >= 0 ? EMBED_ICONS.CHART_UP : EMBED_ICONS.CHART_DOWN;
    return `${sign}${change.toFixed(2)}% ${icon}`;
  }

  private static formatLargeNumber(num: number): string {
    if (num >= 1e9) {
      return `${(num / 1e9).toFixed(1)}B`;
    }
    if (num >= 1e6) {
      return `${(num / 1e6).toFixed(1)}M`;
    }
    if (num >= 1e3) {
      return `${(num / 1e3).toFixed(1)}K`;
    }
    return num.toFixed(0);
  }

  private static formatTechnicalSummary(ta: TokenAlertData['technicalAnalysis']): string {
    const rsiStatus = ta.rsi > 70 ? 'Overbought' : ta.rsi < 30 ? 'Oversold' : 'Neutral';
    const volumeStatus = ta.volumeSpike ? 'Volume Spike' : 'Normal Volume';
    const patterns = ta.patterns.length > 0 ? ta.patterns.slice(0, 2).join(', ') : 'No patterns';
    
    return `**Trend:** ${ta.trend}\n**RSI:** ${ta.rsi.toFixed(1)} (${rsiStatus})\n**${volumeStatus}**\n**Patterns:** ${patterns}`;
  }

  private static formatEntrySignal(signal: NonNullable<TokenAlertData['entrySignal']>): string {
    let result = `**${signal.type.toUpperCase().replace('_', ' ')}** (${signal.score.toFixed(1)}/100)\n`;
    result += `**Confidence:** ${signal.confidence.toFixed(1)}%\n`;
    
    if (signal.entry) {
      result += `**Position Size:** ${(signal.entry.positionSize * 100).toFixed(1)}%\n`;
      result += `**Max Slippage:** ${(signal.entry.maxSlippage * 100).toFixed(1)}%\n`;
      result += `**Time Horizon:** ${signal.entry.timeHorizon}`;
    }
    
    if (signal.reasons.length > 0) {
      result += `\n**Top Reasons:**\n${signal.reasons.slice(0, 2).map(r => `• ${r}`).join('\n')}`;
    }
    
    return result;
  }

  private static formatMomentumAcceleration(momentum: NonNullable<TokenAlertData['momentumAcceleration']>): string {
    const fatigueEmoji = {
      none: '🟢',
      mild: '🟡',
      moderate: '🟠',
      severe: '🔴'
    };
    
    const directionEmoji = {
      bullish: '🟢',
      bearish: '🔴',
      neutral: '⚪'
    };
    
    let result = `**Sustainability:** ${momentum.sustainabilityScore.toFixed(1)}/100\n`;
    result += `**Entry Strength:** ${momentum.entrySignalStrength.toFixed(1)}/100\n`;
    result += `**Fatigue:** ${fatigueEmoji[momentum.fatigueLevel]} ${momentum.fatigueLevel}\n`;
    result += `**Consecutive:** ${momentum.consecutiveCandles.count} ${directionEmoji[momentum.consecutiveCandles.direction]} candles`;
    
    return result;
  }
}