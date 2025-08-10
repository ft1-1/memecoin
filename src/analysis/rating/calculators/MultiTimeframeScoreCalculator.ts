/**
 * Multi-Timeframe Score Calculator
 * Implements sophisticated multi-timeframe weighted scoring with alignment bonuses
 * Weights: 4h (60%), 1h (40%)
 */

import { Logger } from '../../../utils/Logger';
import { MultiTimeframeData, TimeframeIndicators, AnalysisContext } from '../../../types/analysis';
import { DatabaseManager } from '../../../database/DatabaseManager';

export interface TimeframeScore {
  timeframe: string;
  score: number;
  weight: number;
  confidence: number;
  exhaustionRisk: boolean;
  alignment: 'bullish' | 'bearish' | 'neutral';
}

export interface MultiTimeframeScoreResult {
  weightedScore: number; // 0-100 base score
  timeframeAlignment: number; // 0-25 bonus points
  exhaustionPenalty: number; // -50 to 0 penalty points
  finalScore: number; // weighted + alignment - penalty
  confidence: number; // 0-100
  timeframeScores: TimeframeScore[];
  alignmentDetails: {
    bullishTimeframes: number;
    bearishTimeframes: number;
    neutralTimeframes: number;
    consensusStrength: number;
  };
}

export class MultiTimeframeScoreCalculator {
  private logger = Logger.getInstance();
  private dbManager?: DatabaseManager;

  // Timeframe weights as specified: 4h (60%), 1h (40%)
  private readonly TIMEFRAME_WEIGHTS: Record<string, number> = {
    '4h': 0.60,
    '1h': 0.40
  };

  constructor(dbManager?: DatabaseManager) {
    this.dbManager = dbManager;
  }

  /**
   * Calculate multi-timeframe score with alignment bonuses and exhaustion penalties
   */
  public async calculate(
    multiTimeframeData: MultiTimeframeData,
    context: AnalysisContext
  ): Promise<MultiTimeframeScoreResult> {
    try {
      this.logger.debug('Starting multi-timeframe score calculation', {
        tokenAddress: context.tokenData?.address || 'unknown',
        availableTimeframes: Object.keys(multiTimeframeData)
      });

      // Calculate individual timeframe scores
      const timeframeScores = await this.calculateTimeframeScores(multiTimeframeData, context);

      // Handle case where no valid timeframes were found
      if (timeframeScores.length === 0) {
        this.logger.warn('No valid timeframes found for scoring', {
          tokenAddress: context.tokenData?.address || 'unknown',
          availableTimeframes: Object.keys(multiTimeframeData)
        });
        
        // Return a neutral result with low confidence
        return {
          weightedScore: 50,
          timeframeAlignment: 0,
          exhaustionPenalty: 0,
          finalScore: 50,
          confidence: 20,
          timeframeScores: [],
          alignmentDetails: {
            bullishTimeframes: 0,
            bearishTimeframes: 0,
            neutralTimeframes: 0,
            consensusStrength: 0
          }
        };
      }

      // Calculate weighted base score
      const weightedScore = this.calculateWeightedScore(timeframeScores);

      // Calculate timeframe alignment bonus (0-25 points)
      const alignmentResult = this.calculateTimeframeAlignment(timeframeScores);

      // Calculate exhaustion penalty (-50 to 0 points)
      const exhaustionPenalty = this.calculateExhaustionPenalty(timeframeScores);

      // Calculate final score and confidence
      const finalScore = Math.max(0, Math.min(100, weightedScore + alignmentResult.score + exhaustionPenalty));
      const confidence = this.calculateConfidence(timeframeScores, alignmentResult.consensusStrength);

      // Store timeframe data if database available
      if (this.dbManager && context.tokenData?.address) {
        await this.storeTimeframeData(context.tokenData.address, multiTimeframeData);
      }

      const result: MultiTimeframeScoreResult = {
        weightedScore,
        timeframeAlignment: alignmentResult.score,
        exhaustionPenalty,
        finalScore,
        confidence,
        timeframeScores,
        alignmentDetails: alignmentResult.details
      };

      this.logger.debug('Multi-timeframe score calculation completed', {
        tokenAddress: context.tokenData?.address || 'unknown',
        weightedScore: weightedScore.toFixed(1),
        alignmentBonus: alignmentResult.score.toFixed(1),
        exhaustionPenalty: exhaustionPenalty.toFixed(1),
        finalScore: finalScore.toFixed(1),
        confidence: confidence.toFixed(1)
      });

      return result;

    } catch (error) {
      this.logger.error('Multi-timeframe score calculation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        tokenAddress: context.tokenData?.address || 'unknown'
      });
      throw error;
    }
  }

  /**
   * Calculate scores for individual timeframes
   */
  private async calculateTimeframeScores(
    multiTimeframeData: MultiTimeframeData,
    context: AnalysisContext
  ): Promise<TimeframeScore[]> {
    const scores: TimeframeScore[] = [];

    for (const [timeframe, indicators] of Object.entries(multiTimeframeData)) {
      // Enhanced validation checks
      if (!indicators || 
          !this.TIMEFRAME_WEIGHTS[timeframe] || 
          !this.isValidTimeframeIndicators(indicators)) {
        this.logger.warn('Invalid or incomplete indicators for timeframe', {
          timeframe,
          hasIndicators: !!indicators,
          hasWeight: !!this.TIMEFRAME_WEIGHTS[timeframe],
          tokenAddress: context.tokenData?.address || 'unknown'
        });
        continue;
      }

      const score = this.calculateSingleTimeframeScore(indicators);
      const confidence = this.calculateTimeframeConfidence(indicators);
      const exhaustionRisk = this.detectExhaustionRisk(indicators);
      const alignment = this.determineTimeframeAlignment(indicators);

      scores.push({
        timeframe,
        score,
        weight: this.TIMEFRAME_WEIGHTS[timeframe],
        confidence,
        exhaustionRisk,
        alignment
      });

      this.logger.debug('Calculated timeframe score', {
        timeframe,
        score: score.toFixed(1),
        confidence: confidence.toFixed(1),
        alignment,
        exhaustionRisk,
        tokenAddress: context.tokenData?.address || 'unknown'
      });
    }

    return scores.sort((a, b) => b.weight - a.weight); // Sort by weight descending
  }

  /**
   * Calculate score for a single timeframe
   */
  private calculateSingleTimeframeScore(indicators: TimeframeIndicators): number {
    let score = 50; // Start with neutral base

    // RSI contribution (0-30 points) - with null check
    if (typeof indicators.rsi === 'number' && !isNaN(indicators.rsi)) {
      if (indicators.rsi < 30) {
        score += (30 - indicators.rsi) * 0.5; // Oversold bonus
      } else if (indicators.rsi > 70) {
        score += (indicators.rsi - 70) * 0.3; // Overbought moderate bonus
      } else {
        score += Math.abs(50 - indicators.rsi) * 0.2; // Neutral zone scoring
      }
    }

    // MACD contribution (0-25 points) - with comprehensive null checks
    if (indicators.macd && 
        typeof indicators.macd.macd === 'number' && 
        typeof indicators.macd.signal === 'number' &&
        !isNaN(indicators.macd.macd) && 
        !isNaN(indicators.macd.signal)) {
      
      const macdSignal = indicators.macd.macd - indicators.macd.signal;
      if (macdSignal > 0) {
        score += Math.min(15, macdSignal * 100); // Bullish MACD
      } else {
        score += Math.max(-15, macdSignal * 100); // Bearish MACD
      }

      // MACD histogram momentum (0-10 points)
      if (typeof indicators.macd.histogram === 'number' && !isNaN(indicators.macd.histogram)) {
        if (indicators.macd.histogram > 0) {
          score += Math.min(10, indicators.macd.histogram * 200);
        } else {
          score += Math.max(-10, indicators.macd.histogram * 200);
        }
      }
    }

    // Bollinger Bands position (0-20 points) - with null checks
    if (indicators.bollinger && 
        typeof indicators.bollinger.position === 'number' && 
        !isNaN(indicators.bollinger.position)) {
      
      const bbPosition = indicators.bollinger.position;
      if (bbPosition < 0.2) {
        score += (0.2 - bbPosition) * 50; // Near lower band bonus
      } else if (bbPosition > 0.8) {
        score += (bbPosition - 0.8) * 30; // Near upper band moderate bonus
      }
    }

    // Moving average alignment (0-15 points) - with null checks
    if (indicators.ema && typeof indicators.ema === 'object') {
      const emaAlignment = this.calculateEMAAlignment(indicators.ema);
      score += emaAlignment * 15;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate EMA alignment score
   */
  private calculateEMAAlignment(emaData: Record<string, number>): number {
    if (!emaData || typeof emaData !== 'object') return 0;
    
    const periods = [9, 21, 50, 200].filter(period => {
      const value = emaData[period.toString()];
      return typeof value === 'number' && !isNaN(value);
    });
    
    if (periods.length < 2) return 0;

    let alignmentScore = 0;
    let comparisons = 0;

    for (let i = 0; i < periods.length - 1; i++) {
      const shorter = emaData[periods[i].toString()];
      const longer = emaData[periods[i + 1].toString()];
      
      if (typeof shorter === 'number' && typeof longer === 'number' && 
          !isNaN(shorter) && !isNaN(longer)) {
        if (shorter > longer) {
          alignmentScore += 1; // Bullish alignment
        } else if (shorter < longer) {
          alignmentScore -= 1; // Bearish alignment
        }
        comparisons++;
      }
    }

    return comparisons > 0 ? Math.abs(alignmentScore / comparisons) : 0;
  }

  /**
   * Calculate confidence for a timeframe
   */
  private calculateTimeframeConfidence(indicators: TimeframeIndicators): number {
    let confidence = 70; // Base confidence

    // Data quality factor
    if (typeof indicators.dataPoints === 'number' && !isNaN(indicators.dataPoints)) {
      if (indicators.dataPoints >= 50) {
        confidence += 15;
      } else if (indicators.dataPoints >= 20) {
        confidence += 10;
      } else {
        confidence -= 20;
      }
    }

    // Signal clarity factor
    const rsiClearSignal = typeof indicators.rsi === 'number' && 
                          !isNaN(indicators.rsi) && 
                          (indicators.rsi < 30 || indicators.rsi > 70);
    
    const macdClearSignal = indicators.macd && 
                           typeof indicators.macd.histogram === 'number' && 
                           !isNaN(indicators.macd.histogram) && 
                           Math.abs(indicators.macd.histogram) > 0.01;
    
    if (rsiClearSignal && macdClearSignal) {
      confidence += 15;
    } else if (rsiClearSignal || macdClearSignal) {
      confidence += 8;
    }

    // Exhaustion detection reduces confidence
    if (this.detectExhaustionRisk(indicators)) {
      confidence -= 20;
    }

    return Math.max(0, Math.min(100, confidence));
  }

  /**
   * Detect exhaustion risk for a timeframe
   */
  private detectExhaustionRisk(indicators: TimeframeIndicators): boolean {
    // RSI extreme levels - with null check
    if (typeof indicators.rsi === 'number' && !isNaN(indicators.rsi)) {
      if (indicators.rsi > 85 || indicators.rsi < 15) return true;
    }

    // RSI overbought/oversold for extended periods - with null checks
    if (indicators.exhaustionSignals && 
        indicators.exhaustionSignals.rsiOverbought && 
        indicators.exhaustionSignals.rsiOverbought.active && 
        typeof indicators.exhaustionSignals.rsiOverbought.periods === 'number' &&
        indicators.exhaustionSignals.rsiOverbought.periods >= 3) return true;
    
    if (indicators.exhaustionSignals && 
        indicators.exhaustionSignals.rsiOversold && 
        indicators.exhaustionSignals.rsiOversold.active && 
        typeof indicators.exhaustionSignals.rsiOversold.periods === 'number' &&
        indicators.exhaustionSignals.rsiOversold.periods >= 3) return true;

    // Volume spike with divergence - with null checks
    if (indicators.exhaustionSignals && 
        indicators.exhaustionSignals.volumeSpike && 
        indicators.exhaustionSignals.volumeSpike.active && 
        indicators.exhaustionSignals.divergence && 
        indicators.exhaustionSignals.divergence.detected) return true;

    // MACD momentum weakening - with null checks
    if (indicators.macd && 
        typeof indicators.macd.histogram === 'number' && 
        !isNaN(indicators.macd.histogram) &&
        Math.abs(indicators.macd.histogram) < 0.005) return true;

    return false;
  }

  /**
   * Determine timeframe alignment
   */
  private determineTimeframeAlignment(indicators: TimeframeIndicators): 'bullish' | 'bearish' | 'neutral' {
    let bullishSignals = 0;
    let bearishSignals = 0;

    // RSI signals - with null check
    if (typeof indicators.rsi === 'number' && !isNaN(indicators.rsi)) {
      if (indicators.rsi < 30) bullishSignals++;
      else if (indicators.rsi > 70) bearishSignals++;
    }

    // MACD signals - with null checks
    if (indicators.macd && 
        typeof indicators.macd.macd === 'number' && 
        typeof indicators.macd.signal === 'number' &&
        !isNaN(indicators.macd.macd) && 
        !isNaN(indicators.macd.signal)) {
      
      if (indicators.macd.macd > indicators.macd.signal) bullishSignals++;
      else bearishSignals++;

      // MACD histogram
      if (typeof indicators.macd.histogram === 'number' && !isNaN(indicators.macd.histogram)) {
        if (indicators.macd.histogram > 0) bullishSignals++;
        else bearishSignals++;
      }
    }

    // Bollinger position - with null checks
    if (indicators.bollinger && 
        typeof indicators.bollinger.position === 'number' && 
        !isNaN(indicators.bollinger.position)) {
      
      if (indicators.bollinger.position < 0.3) bullishSignals++;
      else if (indicators.bollinger.position > 0.7) bearishSignals++;
    }

    if (bullishSignals > bearishSignals + 1) return 'bullish';
    if (bearishSignals > bullishSignals + 1) return 'bearish';
    return 'neutral';
  }

  /**
   * Calculate weighted score from all timeframes
   */
  private calculateWeightedScore(timeframeScores: TimeframeScore[]): number {
    let totalWeightedScore = 0;
    let totalWeight = 0;

    for (const tfScore of timeframeScores) {
      totalWeightedScore += tfScore.score * tfScore.weight;
      totalWeight += tfScore.weight;
    }

    return totalWeight > 0 ? totalWeightedScore / totalWeight : 50;
  }

  /**
   * Calculate timeframe alignment bonus (0-25 points)
   */
  private calculateTimeframeAlignment(timeframeScores: TimeframeScore[]): {
    score: number;
    consensusStrength: number;
    details: {
      bullishTimeframes: number;
      bearishTimeframes: number;
      neutralTimeframes: number;
      consensusStrength: number;
    };
  } {
    let bullishCount = 0;
    let bearishCount = 0;
    let neutralCount = 0;
    let totalWeight = 0;
    let alignedWeight = 0;

    // Count alignments by weight
    for (const tfScore of timeframeScores) {
      totalWeight += tfScore.weight;
      
      if (tfScore.alignment === 'bullish') {
        bullishCount++;
        if (bullishCount === 1) alignedWeight += tfScore.weight;
        else if (tfScore.alignment === timeframeScores[0].alignment) alignedWeight += tfScore.weight;
      } else if (tfScore.alignment === 'bearish') {
        bearishCount++;
        if (bearishCount === 1) alignedWeight += tfScore.weight;
        else if (tfScore.alignment === timeframeScores[0].alignment) alignedWeight += tfScore.weight;
      } else {
        neutralCount++;
      }
    }

    // Calculate consensus strength (weighted alignment percentage)
    const consensusStrength = totalWeight > 0 ? (alignedWeight / totalWeight) * 100 : 0;

    // Calculate alignment bonus
    let alignmentScore = 0;
    
    // Strong consensus bonus (75%+ agreement)
    if (consensusStrength >= 75) {
      alignmentScore = 25; // Maximum bonus
    } else if (consensusStrength >= 60) {
      alignmentScore = 15; // Good consensus
    } else if (consensusStrength >= 50) {
      alignmentScore = 8; // Moderate consensus
    }

    // Penalty for high divergence
    if (consensusStrength < 30) {
      alignmentScore = -5; // Divergence penalty
    }

    return {
      score: alignmentScore,
      consensusStrength,
      details: {
        bullishTimeframes: bullishCount,
        bearishTimeframes: bearishCount,
        neutralTimeframes: neutralCount,
        consensusStrength
      }
    };
  }

  /**
   * Calculate exhaustion penalty (-50 to 0 points)
   */
  private calculateExhaustionPenalty(timeframeScores: TimeframeScore[]): number {
    let penalty = 0;
    let totalWeight = 0;
    let exhaustionWeight = 0;

    for (const tfScore of timeframeScores) {
      totalWeight += tfScore.weight;
      if (tfScore.exhaustionRisk) {
        exhaustionWeight += tfScore.weight;
      }
    }

    if (totalWeight === 0) return 0;

    const exhaustionRatio = exhaustionWeight / totalWeight;

    // Apply penalties based on exhaustion ratio
    if (exhaustionRatio >= 0.6) {
      penalty = -50; // Severe exhaustion across major timeframes
    } else if (exhaustionRatio >= 0.4) {
      penalty = -30; // Moderate exhaustion
    } else if (exhaustionRatio >= 0.2) {
      penalty = -15; // Minor exhaustion
    }

    return penalty;
  }

  /**
   * Calculate overall confidence
   */
  private calculateConfidence(
    timeframeScores: TimeframeScore[],
    consensusStrength: number
  ): number {
    // Weighted average of timeframe confidences
    let totalWeightedConfidence = 0;
    let totalWeight = 0;

    for (const tfScore of timeframeScores) {
      totalWeightedConfidence += tfScore.confidence * tfScore.weight;
      totalWeight += tfScore.weight;
    }

    const baseConfidence = totalWeight > 0 ? totalWeightedConfidence / totalWeight : 50;

    // Adjust for consensus strength
    const consensusBonus = (consensusStrength / 100) * 20; // Up to +20 for perfect consensus
    
    // Adjust for data quality
    const avgDataPoints = timeframeScores.length > 0 ? 
      timeframeScores.reduce((sum, tf) => sum + tf.weight * 50, 0) : 0; // Assume 50 average
    const dataQualityBonus = avgDataPoints > 40 ? 5 : avgDataPoints > 20 ? 0 : -10;

    return Math.max(0, Math.min(100, baseConfidence + consensusBonus + dataQualityBonus));
  }

  /**
   * Store timeframe data to database
   */
  private async storeTimeframeData(
    tokenAddress: string,
    multiTimeframeData: MultiTimeframeData
  ): Promise<void> {
    if (!this.dbManager) return;

    try {
      const timestamp = new Date().toISOString();

      for (const [timeframe, indicators] of Object.entries(multiTimeframeData)) {
        if (!indicators) continue;

        await this.dbManager.storeTimeframeIndicators({
          token_address: tokenAddress,
          timeframe,
          timestamp,
          rsi: indicators.rsi,
          macd_line: indicators.macd.macd,
          macd_signal: indicators.macd.signal,
          macd_histogram: indicators.macd.histogram,
          bb_upper: indicators.bollinger.upper,
          bb_middle: indicators.bollinger.middle,
          bb_lower: indicators.bollinger.lower,
          bb_position: indicators.bollinger.position,
          ema_data: JSON.stringify(indicators.ema),
          sma_data: JSON.stringify(indicators.sma),
          exhaustion_signals: JSON.stringify(indicators.exhaustionSignals),
          data_points: indicators.dataPoints,
          weight: indicators.weight
        });
      }

      this.logger.debug('Timeframe data stored to database', {
        tokenAddress,
        timeframes: Object.keys(multiTimeframeData).length
      });

    } catch (error) {
      this.logger.error('Failed to store timeframe data', {
        error: error instanceof Error ? error.message : 'Unknown error',
        tokenAddress
      });
      // Don't throw - storage failure shouldn't break calculation
    }
  }

  /**
   * Validate timeframe indicators data structure
   */
  private isValidTimeframeIndicators(indicators: TimeframeIndicators): boolean {
    // Check required basic properties exist
    if (!indicators || typeof indicators !== 'object') return false;
    
    // At least one valid indicator should be present
    let hasValidIndicator = false;
    
    // Check RSI
    if (typeof indicators.rsi === 'number' && !isNaN(indicators.rsi)) {
      hasValidIndicator = true;
    }
    
    // Check MACD
    if (indicators.macd && 
        typeof indicators.macd === 'object' &&
        typeof indicators.macd.macd === 'number' && 
        typeof indicators.macd.signal === 'number' &&
        typeof indicators.macd.histogram === 'number' &&
        !isNaN(indicators.macd.macd) && 
        !isNaN(indicators.macd.signal) &&
        !isNaN(indicators.macd.histogram)) {
      hasValidIndicator = true;
    }
    
    // Check Bollinger Bands
    if (indicators.bollinger && 
        typeof indicators.bollinger === 'object' &&
        typeof indicators.bollinger.position === 'number' &&
        !isNaN(indicators.bollinger.position)) {
      hasValidIndicator = true;
    }
    
    // Check EMA data
    if (indicators.ema && 
        typeof indicators.ema === 'object' &&
        Object.keys(indicators.ema).length > 0) {
      hasValidIndicator = true;
    }
    
    return hasValidIndicator;
  }

  /**
   * Get scoring breakdown for debugging
   */
  public getScoreBreakdown(result: MultiTimeframeScoreResult): {
    breakdown: string[];
    recommendations: string[];
    warnings: string[];
  } {
    const breakdown: string[] = [];
    const recommendations: string[] = [];
    const warnings: string[] = [];

    // Score breakdown
    breakdown.push(`Base weighted score: ${result.weightedScore.toFixed(1)}/100`);
    breakdown.push(`Timeframe alignment bonus: ${result.timeframeAlignment.toFixed(1)} points`);
    breakdown.push(`Exhaustion penalty: ${result.exhaustionPenalty.toFixed(1)} points`);
    breakdown.push(`Final score: ${result.finalScore.toFixed(1)}/100`);
    breakdown.push(`Confidence: ${result.confidence.toFixed(1)}%`);

    // Timeframe details
    for (const tf of result.timeframeScores) {
      breakdown.push(`${tf.timeframe}: ${tf.score.toFixed(1)} (weight: ${(tf.weight * 100).toFixed(0)}%, ${tf.alignment})`);
    }

    // Recommendations
    if (result.alignmentDetails.consensusStrength > 70) {
      recommendations.push(`Strong ${result.timeframeScores[0].alignment} consensus across timeframes`);
    }

    if (result.finalScore > 75) {
      recommendations.push('Exceptional multi-timeframe setup detected');
    } else if (result.finalScore > 60) {
      recommendations.push('Good multi-timeframe alignment');
    }

    // Warnings
    if (result.exhaustionPenalty < -20) {
      warnings.push('Significant exhaustion signals detected across timeframes');
    }

    if (result.alignmentDetails.consensusStrength < 40) {
      warnings.push('High timeframe divergence - conflicting signals');
    }

    const exhaustedTimeframes = result.timeframeScores.filter(tf => tf.exhaustionRisk);
    if (exhaustedTimeframes.length > 0) {
      warnings.push(`Exhaustion risk in: ${exhaustedTimeframes.map(tf => tf.timeframe).join(', ')}`);
    }

    return { breakdown, recommendations, warnings };
  }
}