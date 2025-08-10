/**
 * Rating Thresholds Configuration
 * 
 * Defines precise thresholds and configurations for the rating system:
 * - Rating scale definitions (1-10)
 * - Action thresholds for notifications
 * - Risk-adjusted rating modifications
 * - Confidence level requirements
 * - Alert trigger conditions
 */

export interface RatingThreshold {
  min: number;
  max: number;
  label: string;
  description: string;
  recommendation: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
  notificationPriority: 'critical' | 'high' | 'medium' | 'low' | 'none';
  minConfidence: number; // Minimum confidence required for this rating
  color: string; // For UI/notification display
  icon: string; // Emoji or icon for display
}

export interface NotificationThreshold {
  rating: number;
  confidence: number;
  minVolume?: number;
  maxRisk?: number;
  requiredFactors?: string[];
}

export interface RiskAdjustment {
  riskLevel: 'low' | 'medium' | 'high' | 'extreme';
  ratingModifier: number; // Added/subtracted from base rating
  confidenceModifier: number; // Multiplier for confidence
  notificationThreshold: number; // Higher rating required for notifications
}

export class RatingThresholds {
  /**
   * Core 1-10 rating scale definitions
   */
  public static readonly RATING_SCALE: Record<number, RatingThreshold> = {
    10: {
      min: 9.5,
      max: 10,
      label: 'Exceptional',
      description: 'Extraordinary opportunity with exceptional technical alignment and momentum. Extremely rare rating.',
      recommendation: 'strong_buy',
      notificationPriority: 'critical',
      minConfidence: 85,
      color: '#00FF00',
      icon: '🚀'
    },
    9: {
      min: 8.5,
      max: 9.5,
      label: 'Excellent',
      description: 'Outstanding opportunity with strong technical indicators and high momentum. Top 5% of tokens.',
      recommendation: 'strong_buy',
      notificationPriority: 'critical',
      minConfidence: 80,
      color: '#32CD32',
      icon: '⭐'
    },
    8: {
      min: 7.5,
      max: 8.5,
      label: 'Very Good',
      description: 'Very strong opportunity with good technical setup and momentum. High probability setup.',
      recommendation: 'strong_buy',
      notificationPriority: 'high',
      minConfidence: 75,
      color: '#9AFF9A',
      icon: '🔥'
    },
    7: {
      min: 6.5,
      max: 7.5,
      label: 'Good',
      description: 'Good opportunity with favorable technical indicators. Solid entry point for momentum traders.',
      recommendation: 'buy',
      notificationPriority: 'high',
      minConfidence: 70,
      color: '#ADFF2F',
      icon: '📈'
    },
    6: {
      min: 5.5,
      max: 6.5,
      label: 'Above Average',
      description: 'Above average opportunity with some positive signals. Moderate upside potential.',
      recommendation: 'buy',
      notificationPriority: 'medium',
      minConfidence: 65,
      color: '#FFFF00',
      icon: '👍'
    },
    5: {
      min: 4.5,
      max: 5.5,
      label: 'Average',
      description: 'Neutral rating with mixed signals. No clear directional bias.',
      recommendation: 'hold',
      notificationPriority: 'low',
      minConfidence: 60,
      color: '#FFA500',
      icon: '➖'
    },
    4: {
      min: 3.5,
      max: 4.5,
      label: 'Below Average',
      description: 'Below average opportunity with limited upside. Some concerning indicators.',
      recommendation: 'hold',
      notificationPriority: 'none',
      minConfidence: 55,
      color: '#FF6347',
      icon: '👎'
    },
    3: {
      min: 2.5,
      max: 3.5,
      label: 'Poor',
      description: 'Poor opportunity with negative technical indicators. High downside risk.',
      recommendation: 'sell',
      notificationPriority: 'none',
      minConfidence: 50,
      color: '#FF4500',
      icon: '⚠️'
    },
    2: {
      min: 1.5,
      max: 2.5,
      label: 'Very Poor',
      description: 'Very poor opportunity with strong negative signals. Significant downside risk.',
      recommendation: 'strong_sell',
      notificationPriority: 'none',
      minConfidence: 45,
      color: '#FF0000',
      icon: '🔻'
    },
    1: {
      min: 0,
      max: 1.5,
      label: 'Extremely Poor',
      description: 'Extremely poor opportunity with severe negative indicators. Avoid at all costs.',
      recommendation: 'strong_sell',
      notificationPriority: 'none',
      minConfidence: 40,
      color: '#8B0000',
      icon: '💀'
    }
  };

  /**
   * Notification trigger thresholds
   */
  public static readonly NOTIFICATION_THRESHOLDS: NotificationThreshold[] = [
    {
      rating: 9.0,
      confidence: 85,
      minVolume: 1000000, // $1M minimum volume
      maxRisk: 60,        // Maximum 60% risk score
      requiredFactors: ['technical', 'momentum', 'volume'] // All major factors must be present
    },
    {
      rating: 8.0,
      confidence: 80,
      minVolume: 500000,  // $500K minimum volume
      maxRisk: 70,        // Maximum 70% risk score
      requiredFactors: ['technical', 'momentum']
    },
    {
      rating: 7.0,
      confidence: 75,
      minVolume: 250000,  // $250K minimum volume
      maxRisk: 80,        // Maximum 80% risk score
      requiredFactors: ['technical'] // At least technical analysis required
    }
  ];

  /**
   * Risk-based rating adjustments
   */
  public static readonly RISK_ADJUSTMENTS: Record<string, RiskAdjustment> = {
    low: {
      riskLevel: 'low',
      ratingModifier: 0.2,      // +0.2 rating bonus for low risk
      confidenceModifier: 1.05,  // +5% confidence bonus
      notificationThreshold: 6.8 // Lower threshold for notifications
    },
    medium: {
      riskLevel: 'medium',
      ratingModifier: 0,        // No adjustment for medium risk
      confidenceModifier: 1.0,  // No confidence adjustment
      notificationThreshold: 7.0 // Standard threshold
    },
    high: {
      riskLevel: 'high',
      ratingModifier: -0.3,     // -0.3 rating penalty for high risk
      confidenceModifier: 0.9,  // -10% confidence penalty
      notificationThreshold: 7.5 // Higher threshold required
    },
    extreme: {
      riskLevel: 'extreme',
      ratingModifier: -0.8,     // -0.8 rating penalty for extreme risk
      confidenceModifier: 0.75, // -25% confidence penalty
      notificationThreshold: 8.5 // Much higher threshold required
    }
  };

  /**
   * Component score weight configurations for different market conditions
   * Updated for momentum-focused mid-cap memecoin trading strategy
   */
  public static readonly WEIGHT_CONFIGS = {
    bull_market: {
      volume: 0.40,        // Volume is primary signal in bull markets
      momentum: 0.30,      // Strong momentum weight
      technical: 0.15,     // Technical in supporting role
      multiTimeframe: 0.10, // Timeframe alignment less critical in strong bull
      risk: 0.05           // Minimal risk consideration for max reward
    },
    bear_market: {
      volume: 0.25,        // Volume less reliable in bear markets
      momentum: 0.20,      // Reduced momentum in bear markets
      technical: 0.30,     // Technical more important for risk management
      multiTimeframe: 0.15, // Timeframe alignment helps identify reversals
      risk: 0.10           // Increased risk awareness in bear markets
    },
    sideways_market: {
      volume: 0.35,        // Volume critical for breakout detection
      momentum: 0.25,      // Moderate momentum weight
      technical: 0.20,     // Technical for range identification
      multiTimeframe: 0.15, // Alignment critical for breakout confirmation
      risk: 0.05           // Reduced risk to capture breakout opportunities
    },
    high_volatility: {
      volume: 0.30,        // Volume important but reliability reduced
      momentum: 0.20,      // Momentum less reliable in high volatility
      technical: 0.25,     // Technical for stability assessment
      multiTimeframe: 0.15, // Alignment helps filter noise
      risk: 0.10           // Balanced risk in volatile conditions
    },
    default: {
      volume: 0.35,        // Primary momentum signal (updated default)
      momentum: 0.25,      // Secondary momentum factor
      technical: 0.20,     // Supporting technical analysis
      multiTimeframe: 0.15, // Multi-timeframe alignment
      risk: 0.05           // Reduced risk for higher reward potential
    }
  };

  /**
   * Alert condition configurations
   */
  public static readonly ALERT_CONDITIONS = {
    volume_spike: {
      threshold: 5.0,       // 5x average volume
      ratingBonus: 0.3,     // +0.3 rating bonus
      confidenceBonus: 5    // +5% confidence bonus
    },
    breakout_pattern: {
      threshold: 0.8,       // 80% breakout probability
      ratingBonus: 0.4,     // +0.4 rating bonus
      confidenceBonus: 8    // +8% confidence bonus
    },
    momentum_surge: {
      threshold: 2.0,       // 200% momentum increase
      ratingBonus: 0.2,     // +0.2 rating bonus
      confidenceBonus: 3    // +3% confidence bonus
    },
    technical_confluence: {
      threshold: 0.85,      // 85% indicator agreement
      ratingBonus: 0.3,     // +0.3 rating bonus
      confidenceBonus: 10   // +10% confidence bonus
    }
  };

  /**
   * Get rating threshold for a given rating value
   */
  public static getRatingThreshold(rating: number): RatingThreshold {
    const roundedRating = Math.round(Math.max(1, Math.min(10, rating)));
    return this.RATING_SCALE[roundedRating];
  }

  /**
   * Check if rating meets notification threshold
   */
  public static shouldNotify(
    rating: number,
    confidence: number,
    volume?: number,
    riskScore?: number,
    availableFactors: string[] = []
  ): { shouldNotify: boolean; threshold?: NotificationThreshold; priority: string } {
    
    // Find the highest applicable threshold
    for (const threshold of this.NOTIFICATION_THRESHOLDS) {
      if (rating >= threshold.rating && confidence >= threshold.confidence) {
        // Check optional conditions
        if (threshold.minVolume && volume && volume < threshold.minVolume) {
          continue;
        }
        
        if (threshold.maxRisk && riskScore && riskScore > threshold.maxRisk) {
          continue;
        }
        
        if (threshold.requiredFactors) {
          const hasRequiredFactors = threshold.requiredFactors.every(factor => 
            availableFactors.includes(factor)
          );
          if (!hasRequiredFactors) {
            continue;
          }
        }
        
        // All conditions met
        const ratingThreshold = this.getRatingThreshold(rating);
        return {
          shouldNotify: true,
          threshold,
          priority: ratingThreshold.notificationPriority
        };
      }
    }
    
    return { shouldNotify: false, priority: 'none' };
  }

  /**
   * Apply risk-based adjustments to rating
   */
  public static applyRiskAdjustment(
    rating: number,
    confidence: number,
    riskLevel: 'low' | 'medium' | 'high' | 'extreme'
  ): { adjustedRating: number; adjustedConfidence: number } {
    const adjustment = this.RISK_ADJUSTMENTS[riskLevel];
    
    const adjustedRating = Math.max(1, Math.min(10, rating + adjustment.ratingModifier));
    const adjustedConfidence = Math.max(0, Math.min(100, confidence * adjustment.confidenceModifier));
    
    return { adjustedRating, adjustedConfidence };
  }

  /**
   * Get component weights based on market conditions
   */
  public static getWeights(
    marketTrend: 'bull' | 'bear' | 'sideways',
    volatilityIndex: number
  ): Record<string, number> {
    if (volatilityIndex > 70) {
      return this.WEIGHT_CONFIGS.high_volatility;
    }
    
    switch (marketTrend) {
      case 'bull':
        return this.WEIGHT_CONFIGS.bull_market;
      case 'bear':
        return this.WEIGHT_CONFIGS.bear_market;
      case 'sideways':
        return this.WEIGHT_CONFIGS.sideways_market;
      default:
        return this.WEIGHT_CONFIGS.default;
    }
  }

  /**
   * Check for special alert conditions
   */
  public static checkAlertConditions(
    volumeSpikeFactor: number,
    breakoutPotential: number,
    momentumSurge: number,
    technicalConfluence: number
  ): {
    alerts: string[];
    ratingBonus: number;
    confidenceBonus: number;
  } {
    const alerts: string[] = [];
    let ratingBonus = 0;
    let confidenceBonus = 0;

    // Volume spike alert
    if (volumeSpikeFactor >= this.ALERT_CONDITIONS.volume_spike.threshold) {
      alerts.push(`🚨 VOLUME SPIKE: ${volumeSpikeFactor.toFixed(1)}x average volume`);
      ratingBonus += this.ALERT_CONDITIONS.volume_spike.ratingBonus;
      confidenceBonus += this.ALERT_CONDITIONS.volume_spike.confidenceBonus;
    }

    // Breakout pattern alert
    if (breakoutPotential >= this.ALERT_CONDITIONS.breakout_pattern.threshold) {
      alerts.push(`📊 BREAKOUT PATTERN: ${(breakoutPotential * 100).toFixed(0)}% probability`);
      ratingBonus += this.ALERT_CONDITIONS.breakout_pattern.ratingBonus;
      confidenceBonus += this.ALERT_CONDITIONS.breakout_pattern.confidenceBonus;
    }

    // Momentum surge alert
    if (momentumSurge >= this.ALERT_CONDITIONS.momentum_surge.threshold) {
      alerts.push(`⚡ MOMENTUM SURGE: ${(momentumSurge * 100).toFixed(0)}% increase`);
      ratingBonus += this.ALERT_CONDITIONS.momentum_surge.ratingBonus;
      confidenceBonus += this.ALERT_CONDITIONS.momentum_surge.confidenceBonus;
    }

    // Technical confluence alert
    if (technicalConfluence >= this.ALERT_CONDITIONS.technical_confluence.threshold) {
      alerts.push(`🎯 TECHNICAL CONFLUENCE: ${(technicalConfluence * 100).toFixed(0)}% indicator agreement`);
      ratingBonus += this.ALERT_CONDITIONS.technical_confluence.ratingBonus;
      confidenceBonus += this.ALERT_CONDITIONS.technical_confluence.confidenceBonus;
    }

    return { alerts, ratingBonus, confidenceBonus };
  }

  /**
   * Generate rating explanation text
   */
  public static generateExplanation(
    rating: number,
    confidence: number,
    components: Record<string, number>
  ): string {
    const threshold = this.getRatingThreshold(rating);
    const explanations = [
      `${threshold.icon} Rating: ${rating.toFixed(1)}/10 (${threshold.label})`,
      `Confidence: ${confidence.toFixed(1)}%`,
      `${threshold.description}`
    ];

    // Add component breakdown
    const sortedComponents = Object.entries(components)
      .filter(([_, score]) => score > 0)
      .sort(([_, a], [__, b]) => b - a);

    if (sortedComponents.length > 0) {
      explanations.push('');
      explanations.push('Score Breakdown:');
      sortedComponents.forEach(([component, score]) => {
        const emoji = this.getComponentEmoji(component);
        explanations.push(`${emoji} ${component.charAt(0).toUpperCase() + component.slice(1)}: ${score.toFixed(1)}/100`);
      });
    }

    return explanations.join('\n');
  }

  /**
   * Get emoji for component type
   */
  private static getComponentEmoji(component: string): string {
    const emojis: Record<string, string> = {
      technical: '📊',
      momentum: '📈',
      volume: '📢',
      risk: '⚠️',
      pattern: '🔍',
      fundamentals: '🏛️'
    };
    return emojis[component] || '📋';
  }

  /**
   * Validate rating configuration
   */
  public static validateConfiguration(): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check rating scale completeness
    for (let i = 1; i <= 10; i++) {
      if (!this.RATING_SCALE[i]) {
        errors.push(`Missing rating scale definition for rating ${i}`);
      }
    }

    // Check threshold ordering
    const thresholds = this.NOTIFICATION_THRESHOLDS;
    for (let i = 1; i < thresholds.length; i++) {
      if (thresholds[i].rating >= thresholds[i - 1].rating) {
        warnings.push(`Notification thresholds may not be properly ordered at index ${i}`);
      }
    }

    // Check weight configurations sum to 1.0
    Object.entries(this.WEIGHT_CONFIGS).forEach(([config, weights]) => {
      const sum = Object.values(weights).reduce((total, weight) => total + weight, 0);
      if (Math.abs(sum - 1.0) > 0.01) {
        errors.push(`Weight configuration '${config}' sums to ${sum.toFixed(3)}, should be 1.0`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}