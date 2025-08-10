/**
 * Enhanced Confidence Calculator Utility
 * 
 * Calculates confidence intervals and uncertainty metrics for rating systems:
 * - Statistical confidence based on data quality and quantity
 * - Model uncertainty quantification
 * - Historical accuracy tracking
 * - Multi-factor confidence aggregation
 * - Adaptive confidence adjustment
 * - Multi-timeframe alignment confidence
 * - Consecutive momentum confidence boost
 * - Exhaustion risk confidence penalty
 */

import { 
  ScoreComponents, 
  AnalysisContext, 
  MultiTimeframeData,
  ConsecutiveMomentumTracking 
} from '../../../types/analysis';
import { Logger } from '../../../utils/Logger';

export interface ConfidenceFactors {
  dataQuality: number;           // 0-1: Quality of input data
  sampleSize: number;            // 0-1: Sufficiency of historical data
  modelStability: number;        // 0-1: Consistency of model predictions
  marketConditions: number;      // 0-1: Favorability of market conditions for prediction
  factorAgreement: number;       // 0-1: Agreement between different scoring factors
  historicalAccuracy: number;    // 0-1: Historical prediction accuracy
  timeframeAlignment: number;    // 0-1: Multi-timeframe consensus strength
  consecutiveMomentum: number;   // 0-1: Consecutive momentum confirmation
  exhaustionRisk: number;        // 0-1: Inverse exhaustion penalty (1 = no exhaustion)
}

export interface ConfidenceResult {
  overallConfidence: number;  // 0-100: Overall confidence percentage
  factors: ConfidenceFactors;
  uncertainty: number;        // 0-100: Uncertainty level (inverse of confidence)
  confidenceInterval: {       // Statistical confidence interval
    lower: number;
    upper: number;
    level: number;            // Confidence level (e.g., 95%)
  };
  reliability: 'very_high' | 'high' | 'moderate' | 'low' | 'very_low';
  qualityMetrics: {
    consistency: number;      // Rating consistency over time
    volatility: number;       // Rating volatility
    predictiveness: number;   // Predictive power
  };
}

export class ConfidenceCalculator {
  private logger = Logger.getInstance();
  private historicalPredictions: Map<string, Array<{
    rating: number;
    timestamp: number;
    actualPerformance?: number; // Future price performance
    confidence: number;
  }>> = new Map();

  constructor() {
    this.logger.debug('ConfidenceCalculator initialized');
  }

  /**
   * Calculate comprehensive confidence for a rating with multi-timeframe and momentum data
   */
  public calculate(
    scores: ScoreComponents,
    context: AnalysisContext,
    historicalAccuracy: number = 0.7,
    multiTimeframeData?: MultiTimeframeData,
    consecutiveMomentum?: ConsecutiveMomentumTracking,
    exhaustionPenalty?: number
  ): number {
    try {
      const factors = this.calculateConfidenceFactors(
        scores, 
        context, 
        historicalAccuracy,
        multiTimeframeData,
        consecutiveMomentum,
        exhaustionPenalty
      );
      const confidence = this.aggregateConfidenceFactors(factors);
      
      // Store prediction for future accuracy tracking
      this.storePrediction(context.tokenData.address, {
        rating: this.calculateWeightedRating(scores),
        timestamp: Date.now(),
        confidence
      });

      this.logger.debug('Enhanced confidence calculated', {
        tokenAddress: context.tokenData.address,
        confidence,
        factors: {
          dataQuality: factors.dataQuality.toFixed(3),
          sampleSize: factors.sampleSize.toFixed(3),
          modelStability: factors.modelStability.toFixed(3),
          marketConditions: factors.marketConditions.toFixed(3),
          factorAgreement: factors.factorAgreement.toFixed(3),
          historicalAccuracy: factors.historicalAccuracy.toFixed(3),
          timeframeAlignment: factors.timeframeAlignment.toFixed(3),
          consecutiveMomentum: factors.consecutiveMomentum.toFixed(3),
          exhaustionRisk: factors.exhaustionRisk.toFixed(3)
        },
        factorWeightedSum: Object.entries(factors).reduce(
          (sum, [key, value]) => {
            const weights = {
              dataQuality: 0.16, sampleSize: 0.14, historicalAccuracy: 0.14,
              factorAgreement: 0.12, modelStability: 0.12, marketConditions: 0.12,
              timeframeAlignment: 0.10, consecutiveMomentum: 0.06, exhaustionRisk: 0.04
            };
            return sum + value * (weights[key as keyof typeof weights] || 0);
          },
          0
        ).toFixed(3),
        hasMultiTimeframe: !!multiTimeframeData,
        hasConsecutiveMomentum: !!consecutiveMomentum,
        contextData: {
          hasChartData: !!context.chartData?.length,
          chartDataPoints: context.chartData?.length || 0,
          hasHistoricalAnalysis: !!context.historicalAnalysis?.length,
          marketContext: context.marketContext
        }
      });

      return Math.max(0, Math.min(100, confidence));

    } catch (error) {
      this.logger.error('Confidence calculation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        tokenAddress: context.tokenData.address
      });
      return 50; // Return moderate confidence on error
    }
  }

  /**
   * Calculate detailed confidence result with uncertainty metrics
   */
  public calculateDetailed(
    scores: ScoreComponents,
    context: AnalysisContext,
    historicalAccuracy: number = 0.7
  ): ConfidenceResult {
    const factors = this.calculateConfidenceFactors(scores, context, historicalAccuracy);
    const overallConfidence = this.aggregateConfidenceFactors(factors);
    const uncertainty = 100 - overallConfidence;
    
    const confidenceInterval = this.calculateConfidenceInterval(
      this.calculateWeightedRating(scores),
      overallConfidence,
      95
    );

    const reliability = this.determineReliability(overallConfidence);
    const qualityMetrics = this.calculateQualityMetrics(context.tokenData.address, scores);

    return {
      overallConfidence,
      factors,
      uncertainty,
      confidenceInterval,
      reliability,
      qualityMetrics
    };
  }

  /**
   * Calculate individual confidence factors including multi-timeframe analysis
   */
  private calculateConfidenceFactors(
    scores: ScoreComponents,
    context: AnalysisContext,
    historicalAccuracy: number,
    multiTimeframeData?: MultiTimeframeData,
    consecutiveMomentum?: ConsecutiveMomentumTracking,
    exhaustionPenalty?: number
  ): ConfidenceFactors {
    return {
      dataQuality: this.calculateDataQuality(context),
      sampleSize: this.calculateSampleSizeConfidence(context),
      modelStability: this.calculateModelStability(scores, context),
      marketConditions: this.calculateMarketConditionsConfidence(context),
      factorAgreement: this.calculateFactorAgreement(scores),
      historicalAccuracy: Math.max(0, Math.min(1, historicalAccuracy)),
      timeframeAlignment: this.calculateTimeframeAlignment(multiTimeframeData),
      consecutiveMomentum: this.calculateConsecutiveMomentumConfidence(consecutiveMomentum),
      exhaustionRisk: this.calculateExhaustionRiskFactor(exhaustionPenalty)
    };
  }

  /**
   * Calculate data quality confidence factor
   */
  private calculateDataQuality(context: AnalysisContext): number {
    let quality = 0.8; // Base quality score

    // Chart data quality
    if (context.chartData && context.chartData.length > 0) {
      const dataPoints = context.chartData.length;
      
      if (dataPoints >= 100) {
        quality += 0.1; // Bonus for sufficient data points
      } else if (dataPoints < 20) {
        quality -= 0.2; // Penalty for insufficient data
      }

      // Check for data consistency (no extreme gaps or anomalies)
      const timestamps = context.chartData.map(d => d.timestamp);
      const intervals = timestamps.slice(1).map((t, i) => t - timestamps[i]);
      const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
      const irregularIntervals = intervals.filter(interval => 
        Math.abs(interval - avgInterval) > avgInterval * 0.5
      ).length;
      
      if (irregularIntervals / intervals.length > 0.1) {
        quality -= 0.15; // Penalty for irregular data
      }
    } else {
      quality -= 0.3; // Major penalty for no chart data
    }

    // Token data completeness
    const tokenData = context.tokenData;
    let completeFields = 0;
    let totalFields = 0;
    
    ['price', 'marketCap', 'volume24h', 'holders'].forEach(field => {
      totalFields++;
      if (tokenData[field as keyof typeof tokenData] !== undefined && 
          tokenData[field as keyof typeof tokenData] !== null) {
        completeFields++;
      }
    });
    
    quality += (completeFields / totalFields) * 0.1;

    return Math.max(0, Math.min(1, quality));
  }

  /**
   * Calculate sample size confidence factor
   */
  private calculateSampleSizeConfidence(context: AnalysisContext): number {
    let confidence = 0.5; // Base confidence

    // Historical analysis data
    if (context.historicalAnalysis && context.historicalAnalysis.length > 0) {
      const historyLength = context.historicalAnalysis.length;
      
      if (historyLength >= 30) {
        confidence = 0.95; // Excellent historical data
      } else if (historyLength >= 15) {
        confidence = 0.85; // Good historical data
      } else if (historyLength >= 7) {
        confidence = 0.70; // Moderate historical data
      } else if (historyLength >= 3) {
        confidence = 0.55; // Limited historical data
      }
    }

    // Chart data sample size
    if (context.chartData && context.chartData.length > 0) {
      const chartDataPoints = context.chartData.length;
      let chartConfidence = 0.5;
      
      if (chartDataPoints >= 200) {
        chartConfidence = 0.9;
      } else if (chartDataPoints >= 100) {
        chartConfidence = 0.8;
      } else if (chartDataPoints >= 50) {
        chartConfidence = 0.7;
      } else if (chartDataPoints >= 20) {
        chartConfidence = 0.6;
      }
      
      // Weighted average with historical analysis
      confidence = (confidence * 0.6 + chartConfidence * 0.4);
    }

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Calculate model stability confidence factor
   */
  private calculateModelStability(scores: ScoreComponents, context: AnalysisContext): number {
    let stability = 0.8; // Base stability

    // Check for extreme scores that might indicate instability
    const scoreValues = Object.values(scores).filter(score => score > 0);
    if (scoreValues.length > 0) {
      const mean = scoreValues.reduce((sum, score) => sum + score, 0) / scoreValues.length;
      const variance = scoreValues.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scoreValues.length;
      const stdDev = Math.sqrt(variance);
      
      // High variance in scores indicates instability
      if (stdDev > 30) {
        stability -= 0.2;
      } else if (stdDev > 20) {
        stability -= 0.1;
      } else if (stdDev < 10) {
        stability += 0.1; // Bonus for consistent scores
      }
    }

    // Check historical rating stability for this token
    const history = this.historicalPredictions.get(context.tokenData.address);
    if (history && history.length >= 3) {
      const recentRatings = history.slice(-5).map(h => h.rating);
      const ratingStdDev = this.calculateStandardDeviation(recentRatings);
      
      if (ratingStdDev > 2) {
        stability -= 0.15; // High rating volatility
      } else if (ratingStdDev < 0.5) {
        stability += 0.1; // Stable ratings
      }
    }

    return Math.max(0, Math.min(1, stability));
  }

  /**
   * Calculate market conditions confidence factor
   */
  private calculateMarketConditionsConfidence(context: AnalysisContext): number {
    let confidence = 0.7; // Base confidence

    const { overallTrend, volatilityIndex, marketSentiment } = context.marketContext;

    // Overall market trend impact
    switch (overallTrend) {
      case 'bull':
        confidence += 0.15; // Bull markets are more predictable for momentum strategies
        break;
      case 'bear':
        confidence -= 0.1; // Bear markets are more challenging
        break;
      case 'sideways':
        confidence -= 0.05; // Sideways markets reduce predictability
        break;
    }

    // Volatility impact
    if (volatilityIndex < 30) {
      confidence += 0.1; // Low volatility increases predictability
    } else if (volatilityIndex > 70) {
      confidence -= 0.15; // High volatility reduces predictability
    }

    // Market sentiment impact
    if (marketSentiment > 70 || marketSentiment < 30) {
      confidence += 0.05; // Extreme sentiment can be more predictable
    } else if (marketSentiment >= 45 && marketSentiment <= 55) {
      confidence -= 0.05; // Neutral sentiment is harder to predict
    }

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Calculate factor agreement confidence
   */
  private calculateFactorAgreement(scores: ScoreComponents): number {
    const activeScores = Object.values(scores).filter(score => score > 0);
    
    if (activeScores.length < 2) {
      return 0.5; // Insufficient factors for agreement calculation
    }

    const mean = activeScores.reduce((sum, score) => sum + score, 0) / activeScores.length;
    const deviations = activeScores.map(score => Math.abs(score - mean) / 100);
    const avgDeviation = deviations.reduce((sum, dev) => sum + dev, 0) / deviations.length;

    // High agreement = low average deviation
    let agreement = 1 - (avgDeviation * 2); // Scale deviation to 0-1 range

    // Bonus for factors pointing in same direction
    const bullishFactors = activeScores.filter(score => score > 60).length;
    const bearishFactors = activeScores.filter(score => score < 40).length;
    const neutralFactors = activeScores.length - bullishFactors - bearishFactors;

    const dominantDirection = Math.max(bullishFactors, bearishFactors, neutralFactors);
    const directionAgreement = dominantDirection / activeScores.length;

    if (directionAgreement > 0.7) {
      agreement += 0.1; // Bonus for strong directional agreement
    }

    return Math.max(0, Math.min(1, agreement));
  }

  /**
   * Calculate multi-timeframe alignment confidence factor
   */
  private calculateTimeframeAlignment(multiTimeframeData?: MultiTimeframeData): number {
    if (!multiTimeframeData) return 0.7; // Neutral confidence without multi-timeframe data

    const timeframes = Object.entries(multiTimeframeData).filter(([, data]) => data);
    if (timeframes.length < 2) return 0.6; // Low confidence with insufficient timeframes

    let bullishSignals = 0;
    let bearishSignals = 0;
    let totalWeight = 0;

    // Analyze alignment across timeframes
    for (const [timeframe, indicators] of timeframes) {
      const weight = indicators.weight || 0.1;
      totalWeight += weight;

      // Determine timeframe bias
      let timeframeBias = 0;
      
      // RSI signals
      if (indicators.rsi < 30) timeframeBias += 1;
      else if (indicators.rsi > 70) timeframeBias -= 1;

      // MACD signals
      if (indicators.macd.macd > indicators.macd.signal) timeframeBias += 1;
      else if (indicators.macd.macd < indicators.macd.signal) timeframeBias -= 1;

      // Bollinger position
      if (indicators.bollinger.position < 0.3) timeframeBias += 1;
      else if (indicators.bollinger.position > 0.7) timeframeBias -= 1;

      if (timeframeBias > 0) bullishSignals += weight;
      else if (timeframeBias < 0) bearishSignals += weight;
    }

    // Calculate alignment strength
    const totalSignalWeight = bullishSignals + bearishSignals;
    if (totalSignalWeight === 0) return 0.5; // Neutral if no clear signals

    const consensusStrength = Math.max(bullishSignals, bearishSignals) / totalSignalWeight;
    
    // High consensus = high confidence
    if (consensusStrength > 0.8) return 0.95;
    if (consensusStrength > 0.7) return 0.85;
    if (consensusStrength > 0.6) return 0.75;
    if (consensusStrength > 0.5) return 0.65;
    return 0.4; // Low confidence for high divergence
  }

  /**
   * Calculate consecutive momentum confidence factor
   */
  private calculateConsecutiveMomentumConfidence(consecutiveMomentum?: ConsecutiveMomentumTracking): number {
    if (!consecutiveMomentum) return 0.7; // Neutral confidence without momentum data

    const { consecutiveCount, scoreBoost, exhaustionWarning, diminishingReturns } = consecutiveMomentum;

    let confidence = 0.7; // Base confidence

    // Boost confidence for consecutive periods
    if (consecutiveCount >= 3) {
      confidence = 0.9; // High confidence for strong momentum
    } else if (consecutiveCount >= 2) {
      confidence = 0.8; // Good confidence for moderate momentum
    }

    // Apply score boost factor
    confidence += (scoreBoost / 100) * 0.1; // Up to +0.1 for 25% boost

    // Reduce confidence for exhaustion warning
    if (exhaustionWarning) {
      confidence -= 0.15;
    }

    // Reduce confidence for diminishing returns
    if (diminishingReturns) {
      confidence -= 0.1;
    }

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Calculate exhaustion risk confidence factor
   */
  private calculateExhaustionRiskFactor(exhaustionPenalty?: number): number {
    if (exhaustionPenalty === undefined) return 0.8; // Default if no exhaustion data

    // Convert penalty to confidence factor (penalty is negative)
    const normalizedPenalty = Math.abs(exhaustionPenalty) / 50; // Normalize to 0-1 scale
    
    // Higher penalty = lower confidence
    const confidence = 1 - normalizedPenalty;
    
    return Math.max(0.1, Math.min(1, confidence)); // Clamp to 0.1-1 range
  }

  /**
   * Aggregate confidence factors into overall confidence
   */
  private aggregateConfidenceFactors(factors: ConfidenceFactors): number {
    const weights = {
      dataQuality: 0.16,          // 16% - Data quality is critical
      sampleSize: 0.14,           // 14% - Sample size affects reliability  
      historicalAccuracy: 0.14,   // 14% - Historical performance matters
      factorAgreement: 0.12,      // 12% - Factor agreement indicates robustness
      modelStability: 0.12,       // 12% - Model stability is important
      marketConditions: 0.12,     // 12% - Market conditions affect predictability
      timeframeAlignment: 0.10,   // 10% - Multi-timeframe consensus
      consecutiveMomentum: 0.06,  // 6% - Consecutive momentum boost
      exhaustionRisk: 0.04        // 4% - Exhaustion risk penalty
    };

    const weightedSum = Object.entries(factors).reduce(
      (sum, [key, value]) => sum + value * (weights[key as keyof typeof weights] || 0),
      0
    );

    // Apply non-linear scaling to create more meaningful confidence distribution
    const scaledConfidence = Math.pow(weightedSum, 0.9) * 100;

    return Math.max(10, Math.min(95, scaledConfidence)); // Clamp to 10-95% range
  }

  /**
   * Calculate confidence interval for rating
   */
  private calculateConfidenceInterval(
    rating: number,
    confidence: number,
    level: number = 95
  ): { lower: number; upper: number; level: number } {
    // Convert confidence percentage to z-score
    const alpha = (100 - level) / 100;
    const zScore = this.getZScore(1 - alpha / 2);

    // Estimate standard error based on confidence
    // Lower confidence = higher standard error
    const standardError = (100 - confidence) / 100 * 1.5; // Scale factor for rating scale

    const marginOfError = zScore * standardError;

    return {
      lower: Math.max(1, rating - marginOfError),
      upper: Math.min(10, rating + marginOfError),
      level
    };
  }

  /**
   * Determine reliability category
   */
  private determineReliability(confidence: number): ConfidenceResult['reliability'] {
    if (confidence >= 85) return 'very_high';
    if (confidence >= 70) return 'high';
    if (confidence >= 55) return 'moderate';
    if (confidence >= 40) return 'low';
    return 'very_low';
  }

  /**
   * Calculate quality metrics for rating
   */
  private calculateQualityMetrics(tokenAddress: string, scores: ScoreComponents): {
    consistency: number;
    volatility: number;
    predictiveness: number;
  } {
    const history = this.historicalPredictions.get(tokenAddress) || [];
    
    let consistency = 70; // Default consistency
    let volatility = 50; // Default volatility
    let predictiveness = 60; // Default predictiveness

    if (history.length >= 3) {
      // Calculate rating consistency
      const recentRatings = history.slice(-10).map(h => h.rating);
      const ratingStdDev = this.calculateStandardDeviation(recentRatings);
      consistency = Math.max(0, Math.min(100, 100 - ratingStdDev * 10));

      // Calculate volatility (inverse of consistency)
      volatility = 100 - consistency;

      // Calculate predictiveness (simplified - would need actual performance data)
      const avgConfidence = history.slice(-5).reduce((sum, h) => sum + h.confidence, 0) / Math.min(5, history.length);
      predictiveness = avgConfidence;
    }

    return { consistency, volatility, predictiveness };
  }

  /**
   * Utility functions
   */
  private calculateWeightedRating(scores: ScoreComponents): number {
    const weights = { technical: 0.4, momentum: 0.3, volume: 0.2, risk: 0.1 };
    const weightedScore = Object.entries(scores).reduce(
      (sum, [key, score]) => sum + score * (weights[key as keyof typeof weights] || 0),
      0
    );
    return Math.max(1, Math.min(10, weightedScore / 10));
  }

  private calculateStandardDeviation(values: number[]): number {
    if (values.length < 2) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  private getZScore(probability: number): number {
    // Approximate inverse normal CDF for common confidence levels
    if (probability >= 0.975) return 1.96; // 95%
    if (probability >= 0.95) return 1.645;  // 90%
    if (probability >= 0.9) return 1.28;    // 80%
    return 1.0; // Default
  }

  private storePrediction(
    tokenAddress: string,
    prediction: { rating: number; timestamp: number; confidence: number }
  ): void {
    if (!this.historicalPredictions.has(tokenAddress)) {
      this.historicalPredictions.set(tokenAddress, []);
    }

    const predictions = this.historicalPredictions.get(tokenAddress)!;
    predictions.push(prediction);

    // Keep only last 100 predictions per token
    if (predictions.length > 100) {
      predictions.splice(0, predictions.length - 100);
    }
  }

  /**
   * Update prediction with actual performance (for future accuracy tracking)
   */
  public updatePredictionPerformance(
    tokenAddress: string,
    timestamp: number,
    actualPerformance: number
  ): void {
    const predictions = this.historicalPredictions.get(tokenAddress);
    if (predictions) {
      const prediction = predictions.find(p => 
        Math.abs(p.timestamp - timestamp) < 300000 // 5 minute tolerance
      );
      if (prediction) {
        prediction.actualPerformance = actualPerformance;
      }
    }
  }

  /**
   * Get confidence statistics for monitoring
   */
  public getStatistics(): {
    totalPredictions: number;
    averageConfidence: number;
    tokensTracked: number;
    accuracyMetrics?: {
      correctPredictions: number;
      totalEvaluated: number;
      accuracy: number;
    };
  } {
    let totalPredictions = 0;
    let totalConfidence = 0;
    let correctPredictions = 0;
    let totalEvaluated = 0;

    this.historicalPredictions.forEach(predictions => {
      predictions.forEach(prediction => {
        totalPredictions++;
        totalConfidence += prediction.confidence;

        if (prediction.actualPerformance !== undefined) {
          totalEvaluated++;
          // Simple accuracy check: if rating > 6 and performance > 0, or rating <= 6 and performance <= 0
          const predictedBullish = prediction.rating > 6;
          const actualBullish = prediction.actualPerformance > 0;
          if (predictedBullish === actualBullish) {
            correctPredictions++;
          }
        }
      });
    });

    const result: ReturnType<typeof this.getStatistics> = {
      totalPredictions,
      averageConfidence: totalPredictions > 0 ? totalConfidence / totalPredictions : 0,
      tokensTracked: this.historicalPredictions.size
    };

    if (totalEvaluated > 0) {
      result.accuracyMetrics = {
        correctPredictions,
        totalEvaluated,
        accuracy: correctPredictions / totalEvaluated
      };
    }

    return result;
  }
}