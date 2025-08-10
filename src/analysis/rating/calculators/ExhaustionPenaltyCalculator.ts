/**
 * Exhaustion Penalty Calculator
 * Detects overextended market conditions and applies risk-adjusted penalties
 * Penalties range from -50 to 0 points based on exhaustion severity
 */

import { Logger } from '../../../utils/Logger';
import { 
  TechnicalIndicators, 
  MomentumAnalysis, 
  VolumeAnalysis, 
  MultiTimeframeData,
  AnalysisContext 
} from '../../../types/analysis';

export interface ExhaustionSignal {
  type: 'rsi_overbought' | 'rsi_oversold' | 'volume_exhaustion' | 'momentum_divergence' | 'price_extension';
  severity: 'mild' | 'moderate' | 'severe';
  timeframe: string;
  description: string;
  penalty: number; // Negative value
  confidence: number; // 0-100
}

export interface ExhaustionPenaltyResult {
  totalPenalty: number; // -50 to 0
  signals: ExhaustionSignal[];
  exhaustionLevel: 'none' | 'mild' | 'moderate' | 'severe' | 'extreme';
  timeframeBreakdown: Record<string, number>;
  reasoning: string[];
  recommendations: string[];
}

export interface ExhaustionConfig {
  rsiOverboughtThreshold: number;
  rsiOversoldThreshold: number;
  rsiExtremeThreshold: number;
  volumeExhaustionRatio: number;
  momentumDivergenceThreshold: number;
  priceExtensionStdDev: number;
  timeframeWeights: Record<string, number>;
}

export class ExhaustionPenaltyCalculator {
  private logger = Logger.getInstance();
  
  private config: ExhaustionConfig = {
    rsiOverboughtThreshold: 70,
    rsiOversoldThreshold: 30,
    rsiExtremeThreshold: 80,
    volumeExhaustionRatio: 0.5, // Volume drops to 50% of recent average
    momentumDivergenceThreshold: 0.02,
    priceExtensionStdDev: 2.5, // Price beyond 2.5 standard deviations
    timeframeWeights: {
      '4h': 0.60,
      '1h': 0.40
    }
  };

  constructor(config?: Partial<ExhaustionConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  /**
   * Calculate exhaustion penalty based on technical indicators and multi-timeframe data
   */
  public async calculatePenalty(
    technicalIndicators: TechnicalIndicators,
    momentum: MomentumAnalysis,
    volume: VolumeAnalysis,
    multiTimeframeData?: MultiTimeframeData,
    context?: AnalysisContext
  ): Promise<ExhaustionPenaltyResult> {
    try {
      this.logger.debug('Starting exhaustion penalty calculation', {
        tokenAddress: context?.tokenData?.address || 'unknown',
        rsi: technicalIndicators.rsi,
        momentum: momentum.trend,
        hasMultiTimeframe: !!multiTimeframeData
      });

      const signals: ExhaustionSignal[] = [];

      // Analyze single timeframe exhaustion
      const singleTimeframeSignals = this.analyzeSingleTimeframeExhaustion(
        technicalIndicators,
        momentum,
        volume,
        'current'
      );
      signals.push(...singleTimeframeSignals);

      // Analyze multi-timeframe exhaustion if available
      if (multiTimeframeData) {
        const multiTimeframeSignals = this.analyzeMultiTimeframeExhaustion(multiTimeframeData);
        signals.push(...multiTimeframeSignals);
      }

      // Calculate total penalty
      const result = this.calculateTotalPenalty(signals, context);

      this.logger.debug('Exhaustion penalty calculation completed', {
        tokenAddress: context?.tokenData?.address || 'unknown',
        totalPenalty: result.totalPenalty,
        exhaustionLevel: result.exhaustionLevel,
        signalCount: result.signals.length
      });

      return result;

    } catch (error) {
      this.logger.error('Exhaustion penalty calculation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        tokenAddress: context?.tokenData?.address || 'unknown'
      });

      return this.getDefaultResult();
    }
  }

  /**
   * Analyze exhaustion in single timeframe
   */
  private analyzeSingleTimeframeExhaustion(
    indicators: TechnicalIndicators,
    momentum: MomentumAnalysis,
    volume: VolumeAnalysis,
    timeframe: string
  ): ExhaustionSignal[] {
    const signals: ExhaustionSignal[] = [];

    // RSI Exhaustion Analysis
    const rsiSignals = this.analyzeRSIExhaustion(indicators.rsi, timeframe);
    signals.push(...rsiSignals);

    // Volume Exhaustion Analysis
    const volumeSignals = this.analyzeVolumeExhaustion(volume, timeframe);
    signals.push(...volumeSignals);

    // Momentum Divergence Analysis
    const momentumSignals = this.analyzeMomentumDivergence(indicators, momentum, timeframe);
    signals.push(...momentumSignals);

    // Price Extension Analysis
    const priceSignals = this.analyzePriceExtension(indicators, momentum, timeframe);
    signals.push(...priceSignals);

    return signals;
  }

  /**
   * Analyze RSI exhaustion signals
   */
  private analyzeRSIExhaustion(rsi: number, timeframe: string): ExhaustionSignal[] {
    const signals: ExhaustionSignal[] = [];

    // Extreme overbought conditions
    if (rsi > 85) {
      signals.push({
        type: 'rsi_overbought',
        severity: 'severe',
        timeframe,
        description: `RSI extremely overbought at ${rsi.toFixed(1)}`,
        penalty: -20,
        confidence: 90
      });
    } else if (rsi > this.config.rsiExtremeThreshold) {
      signals.push({
        type: 'rsi_overbought',
        severity: 'moderate',
        timeframe,
        description: `RSI overbought at ${rsi.toFixed(1)}`,
        penalty: -10,
        confidence: 75
      });
    } else if (rsi > this.config.rsiOverboughtThreshold) {
      signals.push({
        type: 'rsi_overbought',
        severity: 'mild',
        timeframe,
        description: `RSI approaching overbought at ${rsi.toFixed(1)}`,
        penalty: -5,
        confidence: 60
      });
    }

    // Extreme oversold conditions (for short positions or reversal plays)
    if (rsi < 15) {
      signals.push({
        type: 'rsi_oversold',
        severity: 'severe',
        timeframe,
        description: `RSI extremely oversold at ${rsi.toFixed(1)} - high reversal risk`,
        penalty: -15,
        confidence: 85
      });
    } else if (rsi < 20) {
      signals.push({
        type: 'rsi_oversold',
        severity: 'moderate',
        timeframe,
        description: `RSI oversold at ${rsi.toFixed(1)} - potential reversal`,
        penalty: -8,
        confidence: 70
      });
    }

    return signals;
  }

  /**
   * Analyze volume exhaustion signals
   */
  private analyzeVolumeExhaustion(volume: VolumeAnalysis, timeframe: string): ExhaustionSignal[] {
    const signals: ExhaustionSignal[] = [];

    const volumeRatio = volume.currentVolume / volume.averageVolume;

    // Volume exhaustion after spike
    if (volume.volumeSpike && volumeRatio < this.config.volumeExhaustionRatio) {
      signals.push({
        type: 'volume_exhaustion',
        severity: 'moderate',
        timeframe,
        description: `Volume exhaustion after spike - ratio: ${volumeRatio.toFixed(2)}`,
        penalty: -12,
        confidence: 80
      });
    }

    // Sustained low volume
    if (volumeRatio < 0.3) {
      signals.push({
        type: 'volume_exhaustion',
        severity: 'mild',
        timeframe,
        description: `Abnormally low volume - ratio: ${volumeRatio.toFixed(2)}`,
        penalty: -8,
        confidence: 65
      });
    }

    // Volume divergence with price
    if (volume.volumeSpikeFactor > 3 && volume.netFlow < 0) {
      signals.push({
        type: 'volume_exhaustion',
        severity: 'severe',
        timeframe,
        description: `High volume with negative net flow - distribution pattern`,
        penalty: -18,
        confidence: 85
      });
    }

    return signals;
  }

  /**
   * Analyze momentum divergence signals
   */
  private analyzeMomentumDivergence(
    indicators: TechnicalIndicators,
    momentum: MomentumAnalysis,
    timeframe: string
  ): ExhaustionSignal[] {
    const signals: ExhaustionSignal[] = [];

    // MACD histogram weakening
    if (Math.abs(indicators.macd.histogram) < this.config.momentumDivergenceThreshold) {
      const severity = Math.abs(indicators.macd.histogram) < 0.005 ? 'severe' : 'moderate';
      const penalty = severity === 'severe' ? -15 : -8;
      
      signals.push({
        type: 'momentum_divergence',
        severity,
        timeframe,
        description: `MACD momentum weakening - histogram: ${indicators.macd.histogram.toFixed(4)}`,
        penalty,
        confidence: 75
      });
    }

    // Momentum vs trend strength divergence
    if (momentum.trend === 'bullish' && momentum.strength < 40) {
      signals.push({
        type: 'momentum_divergence',
        severity: 'moderate',
        timeframe,
        description: `Bullish trend with weak momentum strength: ${momentum.strength}`,
        penalty: -10,
        confidence: 70
      });
    } else if (momentum.trend === 'bearish' && momentum.strength < 40) {
      signals.push({
        type: 'momentum_divergence',
        severity: 'mild',
        timeframe,
        description: `Bearish trend with weak momentum - potential consolidation`,
        penalty: -6,
        confidence: 60
      });
    }

    return signals;
  }

  /**
   * Analyze price extension signals
   */
  private analyzePriceExtension(
    indicators: TechnicalIndicators,
    momentum: MomentumAnalysis,
    timeframe: string
  ): ExhaustionSignal[] {
    const signals: ExhaustionSignal[] = [];

    // Bollinger Bands extension
    if (indicators.bollinger.position > 0.95) {
      signals.push({
        type: 'price_extension',
        severity: 'severe',
        timeframe,
        description: `Price at extreme upper Bollinger Band - position: ${indicators.bollinger.position.toFixed(3)}`,
        penalty: -18,
        confidence: 85
      });
    } else if (indicators.bollinger.position > 0.85) {
      signals.push({
        type: 'price_extension',
        severity: 'moderate',
        timeframe,
        description: `Price extended beyond upper Bollinger Band - position: ${indicators.bollinger.position.toFixed(3)}`,
        penalty: -10,
        confidence: 75
      });
    }

    // Price extension with high volatility
    if (momentum.volatility > 80 && indicators.bollinger.position > 0.8) {
      signals.push({
        type: 'price_extension',
        severity: 'severe',
        timeframe,
        description: `High volatility with price extension - unsustainable momentum`,
        penalty: -15,
        confidence: 80
      });
    }

    return signals;
  }

  /**
   * Analyze multi-timeframe exhaustion
   */
  private analyzeMultiTimeframeExhaustion(multiTimeframeData: MultiTimeframeData): ExhaustionSignal[] {
    const signals: ExhaustionSignal[] = [];

    for (const [timeframe, indicators] of Object.entries(multiTimeframeData)) {
      if (!indicators) continue;

      const weight = this.config.timeframeWeights[timeframe] || 0.1;

      // Check for exhaustion signals in this timeframe
      if (indicators.exhaustionSignals) {
        // RSI extended periods
        if (indicators.exhaustionSignals.rsiOverbought.active && 
            indicators.exhaustionSignals.rsiOverbought.periods >= 3) {
          
          const severity: 'mild' | 'moderate' | 'severe' = 
            indicators.exhaustionSignals.rsiOverbought.periods >= 5 ? 'severe' :
            indicators.exhaustionSignals.rsiOverbought.periods >= 4 ? 'moderate' : 'mild';
          
          signals.push({
            type: 'rsi_overbought',
            severity,
            timeframe,
            description: `RSI overbought for ${indicators.exhaustionSignals.rsiOverbought.periods} periods`,
            penalty: -1 * weight * (severity === 'severe' ? 25 : severity === 'moderate' ? 15 : 8),
            confidence: 80
          });
        }

        // Volume spike exhaustion
        if (indicators.exhaustionSignals.volumeSpike.active) {
          signals.push({
            type: 'volume_exhaustion',
            severity: 'moderate',
            timeframe,
            description: `Volume spike exhaustion in ${timeframe} timeframe`,
            penalty: -1 * weight * 12,
            confidence: 75
          });
        }

        // Divergence detected
        if (indicators.exhaustionSignals.divergence.detected) {
          const divergenceType = indicators.exhaustionSignals.divergence.type || 'bearish';
          signals.push({
            type: 'momentum_divergence',
            severity: 'moderate',
            timeframe,
            description: `${divergenceType} divergence detected in ${timeframe}`,
            penalty: -1 * weight * 10,
            confidence: 70
          });
        }
      }

      // Direct indicator analysis
      if (indicators.rsi > 85) {
        signals.push({
          type: 'rsi_overbought',
          severity: 'severe',
          timeframe,
          description: `Extreme RSI in ${timeframe}: ${indicators.rsi.toFixed(1)}`,
          penalty: -1 * weight * 20,
          confidence: 90
        });
      }
    }

    return signals;
  }

  /**
   * Calculate total penalty from all signals
   */
  private calculateTotalPenalty(
    signals: ExhaustionSignal[],
    context?: AnalysisContext
  ): ExhaustionPenaltyResult {
    let totalPenalty = 0;
    const timeframeBreakdown: Record<string, number> = {};
    const reasoning: string[] = [];
    const recommendations: string[] = [];

    // Aggregate penalties by timeframe
    for (const signal of signals) {
      totalPenalty += signal.penalty;
      
      if (!timeframeBreakdown[signal.timeframe]) {
        timeframeBreakdown[signal.timeframe] = 0;
      }
      timeframeBreakdown[signal.timeframe] += signal.penalty;
    }

    // Cap total penalty at -50
    totalPenalty = Math.max(-50, totalPenalty);

    // Determine exhaustion level
    let exhaustionLevel: 'none' | 'mild' | 'moderate' | 'severe' | 'extreme';
    if (totalPenalty >= -5) exhaustionLevel = 'none';
    else if (totalPenalty >= -15) exhaustionLevel = 'mild';
    else if (totalPenalty >= -25) exhaustionLevel = 'moderate';
    else if (totalPenalty >= -40) exhaustionLevel = 'severe';
    else exhaustionLevel = 'extreme';

    // Generate reasoning
    if (signals.length === 0) {
      reasoning.push('No exhaustion signals detected - healthy momentum conditions');
    } else {
      reasoning.push(`${signals.length} exhaustion signal(s) detected with total penalty of ${totalPenalty.toFixed(1)} points`);
      
      // Group signals by type
      const signalsByType = signals.reduce((acc, signal) => {
        if (!acc[signal.type]) acc[signal.type] = [];
        acc[signal.type].push(signal);
        return acc;
      }, {} as Record<string, ExhaustionSignal[]>);

      for (const [type, typeSignals] of Object.entries(signalsByType)) {
        const severityCount = typeSignals.reduce((acc, s) => {
          acc[s.severity] = (acc[s.severity] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        const severityStr = Object.entries(severityCount)
          .map(([sev, count]) => `${count} ${sev}`)
          .join(', ');
        
        reasoning.push(`${type.replace('_', ' ')}: ${severityStr}`);
      }
    }

    // Generate recommendations
    if (exhaustionLevel === 'extreme' || exhaustionLevel === 'severe') {
      recommendations.push('AVOID entry - extreme exhaustion conditions detected');
      recommendations.push('Wait for momentum reset and consolidation before considering entry');
    } else if (exhaustionLevel === 'moderate') {
      recommendations.push('CAUTION - moderate exhaustion signals present');
      recommendations.push('Consider reduced position size or tighter stop losses');
    } else if (exhaustionLevel === 'mild') {
      recommendations.push('Monitor closely - mild exhaustion signals detected');
      recommendations.push('Watch for momentum divergence or volume confirmation');
    }

    // Timeframe-specific recommendations
    const highestPenaltyTimeframe = Object.entries(timeframeBreakdown)
      .sort(([,a], [,b]) => a - b)[0];
    
    if (highestPenaltyTimeframe && highestPenaltyTimeframe[1] < -10) {
      recommendations.push(`Primary concern in ${highestPenaltyTimeframe[0]} timeframe`);
    }

    return {
      totalPenalty,
      signals,
      exhaustionLevel,
      timeframeBreakdown,
      reasoning,
      recommendations
    };
  }

  /**
   * Get default result for error cases
   */
  private getDefaultResult(): ExhaustionPenaltyResult {
    return {
      totalPenalty: 0,
      signals: [],
      exhaustionLevel: 'none',
      timeframeBreakdown: {},
      reasoning: ['Error in exhaustion calculation - no penalty applied'],
      recommendations: []
    };
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<ExhaustionConfig>): void {
    this.config = { ...this.config, ...config };
    this.logger.info('Exhaustion penalty calculator configuration updated', config);
  }

  /**
   * Get current configuration
   */
  public getConfig(): ExhaustionConfig {
    return { ...this.config };
  }

  /**
   * Get exhaustion level description
   */
  public getExhaustionLevelDescription(level: string): string {
    const descriptions = {
      none: 'No exhaustion signals - healthy momentum conditions',
      mild: 'Minor exhaustion signals - monitor closely',
      moderate: 'Moderate exhaustion - exercise caution',
      severe: 'Severe exhaustion - high risk of reversal',
      extreme: 'Extreme exhaustion - avoid new positions'
    };

    return descriptions[level as keyof typeof descriptions] || 'Unknown exhaustion level';
  }

  /**
   * Calculate exhaustion recovery score (for future use)
   */
  public calculateRecoveryScore(
    currentSignals: ExhaustionSignal[],
    previousSignals: ExhaustionSignal[]
  ): {
    recoveryScore: number; // 0-100
    improving: boolean;
    reasoning: string[];
  } {
    const currentPenalty = currentSignals.reduce((sum, s) => sum + s.penalty, 0);
    const previousPenalty = previousSignals.reduce((sum, s) => sum + s.penalty, 0);
    
    const improvement = previousPenalty - currentPenalty;
    const improving = improvement > 0;
    
    // Calculate recovery score (0 = no recovery, 100 = full recovery)
    const recoveryScore = Math.max(0, Math.min(100, 50 + improvement * 2));
    
    const reasoning = [];
    if (improving) {
      reasoning.push(`Exhaustion improving by ${improvement.toFixed(1)} points`);
    } else if (improvement < 0) {
      reasoning.push(`Exhaustion worsening by ${Math.abs(improvement).toFixed(1)} points`);
    } else {
      reasoning.push('Exhaustion conditions unchanged');
    }

    return {
      recoveryScore,
      improving,
      reasoning
    };
  }
}