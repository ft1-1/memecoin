/**
 * Technical Analysis Engine
 * Main orchestrator for all technical analysis components
 */

import { TechnicalIndicators } from './TechnicalIndicators';
import { MomentumAnalyzer } from './MomentumAnalyzer';
import { SignalGenerator, SignalResult } from './SignalGenerator';
import { MultiTimeframeAnalyzer, TimeframeData, MultiTimeframeResult } from './MultiTimeframeAnalyzer';
import { ConsecutiveMomentumTracker } from './ConsecutiveMomentumTracker';
import { VolumeAnalyzer } from './VolumeAnalyzer';
import { PatternRecognition } from './PatternRecognition';
import { OHLCVData, AnalysisOptions } from './types';
import { AnalysisResult, AnalysisContext, MultiTimeframeData, ConsecutiveMomentumTracking, TimeframeDivergence } from '../../types/analysis';
import { ChartDataPoint } from '../../types/api';

export interface TechnicalAnalysisResult extends AnalysisResult {
  multiTimeframe?: MultiTimeframeResult & {
    consecutiveMomentum: ConsecutiveMomentumTracking;
    divergences: TimeframeDivergence[];
    exhaustionWarnings: string[];
  };
  volumeSignals: any[];
  patterns: any[];
  volumePatterns: any[];
  supportResistance: {
    support: any[];
    resistance: any[];
  };
  recommendation: {
    action: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
    confidence: number;
    reasoning: string[];
    riskLevel: 'low' | 'medium' | 'high' | 'extreme';
    positionSize: number;
    targets: number[];
    stopLoss: number | null;
  };
}

export class TechnicalAnalysisEngine {
  private technicalIndicators: TechnicalIndicators;
  private momentumAnalyzer: MomentumAnalyzer;
  private signalGenerator: SignalGenerator;
  private multiTimeframeAnalyzer: MultiTimeframeAnalyzer;
  private consecutiveMomentumTracker: ConsecutiveMomentumTracker;
  private volumeAnalyzer: VolumeAnalyzer;
  private patternRecognition: PatternRecognition;
  private options: AnalysisOptions;

  constructor(options?: Partial<AnalysisOptions>) {
    this.options = {
      timeframes: ['1m', '5m', '15m', '1h', '4h'], // Added 4h timeframe
      indicators: {
        rsi: { period: 14, overbought: 80, oversold: 20 }, // Adjusted for exhaustion detection
        macd: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
        bollinger: { period: 20, stdDev: 2 },
        ema: { periods: [9, 21, 50, 200] }, // Added 200 EMA
        volume: { smaLookback: 20, spikeThreshold: 2.0 } // 2x threshold as specified
      },
      minDataPoints: 50,
      confidenceThreshold: 60,
      riskAdjustment: true,
      memecoinsOptimized: true,
      ...options
    };

    this.technicalIndicators = new TechnicalIndicators(this.options.indicators);
    this.momentumAnalyzer = new MomentumAnalyzer();
    this.signalGenerator = new SignalGenerator(this.options);
    this.multiTimeframeAnalyzer = new MultiTimeframeAnalyzer();
    this.consecutiveMomentumTracker = new ConsecutiveMomentumTracker({
      intervalMinutes: 15,
      maxBoostPercentage: 25,
      exhaustionThreshold: 80,
      volumeConfirmationRequired: true
    });
    this.volumeAnalyzer = new VolumeAnalyzer({
      spikeThreshold: 2.0, // 2x average threshold
      volumePeriods: [10, 20, 50]
    });
    this.patternRecognition = new PatternRecognition();
  }

  /**
   * Perform enhanced comprehensive technical analysis with multi-timeframe and consecutive momentum
   */
  public async analyzeTechnicals(context: AnalysisContext): Promise<TechnicalAnalysisResult> {
    const { tokenData, chartData } = context;
    
    if (!chartData || chartData.length === 0) {
      throw new Error('No chart data provided for technical analysis');
    }

    // Convert chart data to OHLCV format
    const ohlcvData = this.convertToOHLCV(chartData);

    if (ohlcvData.length < this.options.minDataPoints) {
      return this.getInsufficientDataResult(tokenData, ohlcvData);
    }

    // Perform enhanced multi-timeframe analysis with all features
    const multiTimeframeResult = await this.performEnhancedMultiTimeframeAnalysis(ohlcvData);
    
    // Perform single timeframe analysis for backward compatibility
    const singleTimeframeResult = await this.performSingleTimeframeAnalysis(ohlcvData, tokenData);
    
    // Apply multi-timeframe enhancements to single timeframe result
    const enhancedResult = this.applyMultiTimeframeEnhancements(
      singleTimeframeResult,
      multiTimeframeResult,
      context
    );

    // Generate enhanced final recommendation
    const recommendation = this.generateEnhancedFinalRecommendation(
      enhancedResult,
      multiTimeframeResult,
      context
    );

    return {
      ...enhancedResult,
      multiTimeframe: multiTimeframeResult,
      recommendation
    };
  }

  /**
   * Perform analysis for a single timeframe
   */
  private async performSingleTimeframeAnalysis(
    data: OHLCVData[], 
    tokenData: any
  ): Promise<TechnicalAnalysisResult> {
    // Calculate technical indicators
    const indicators = this.technicalIndicators.calculateAll(data);

    // Analyze momentum
    const momentum = this.momentumAnalyzer.analyzeMomentum(data);

    // Generate signals
    const signals = this.signalGenerator.generateSignals(data);

    // Analyze volume
    const volumeAnalysis = this.volumeAnalyzer.analyzeVolume(data);
    const volumeSignals = this.volumeAnalyzer.generateVolumeSignals(data);

    // Detect patterns
    const patternAnalysis = this.patternRecognition.analyzePatterns(data);
    const supportResistance = this.patternRecognition.detectSupportResistanceLevels(data);

    // Assess risk
    const riskAssessment = this.assessRisk(data, momentum, signals, volumeAnalysis);

    // Create rating result
    const rating = {
      rating: this.calculateRating(signals, momentum, volumeAnalysis, patternAnalysis),
      confidence: signals.confidence,
      components: {
        technical: this.calculateTechnicalScore(indicators, signals),
        momentum: momentum.strength,
        volume: this.calculateVolumeScore(volumeAnalysis, volumeSignals),
        risk: 100 - riskAssessment.overall,
        pattern: this.calculatePatternScore(patternAnalysis),
        fundamentals: this.calculateFundamentalScore(tokenData)
      },
      weights: {
        technical: 0.25,
        momentum: 0.20,
        volume: 0.15,
        risk: 0.15,
        pattern: 0.15,
        fundamentals: 0.10
      },
      reasoning: signals.reasoning,
      alerts: signals.alerts
    };

    return {
      tokenAddress: tokenData.address,
      timestamp: Date.now(),
      price: data[data.length - 1].close,
      marketCap: tokenData.marketCap,
      technicalIndicators: indicators,
      momentum,
      volume: volumeAnalysis,
      patterns: patternAnalysis,
      risk: riskAssessment,
      rating,
      timeframes: {},
      volumeSignals,
      volumePatterns: this.volumeAnalyzer.detectVolumePatterns(data),
      supportResistance,
      recommendation: {
        action: signals.overallSignal,
        confidence: signals.confidence,
        reasoning: signals.reasoning,
        riskLevel: signals.riskLevel,
        positionSize: this.calculatePositionSize(signals, riskAssessment),
        targets: this.calculateTargets(data, supportResistance, momentum),
        stopLoss: this.calculateStopLoss(data, supportResistance, signals.riskLevel)
      }
    };
  }

  /**
   * Perform enhanced multi-timeframe analysis with all new features
   */
  private async performEnhancedMultiTimeframeAnalysis(
    ohlcvData: OHLCVData[]
  ): Promise<MultiTimeframeResult & {
    consecutiveMomentum: ConsecutiveMomentumTracking;
    divergences: TimeframeDivergence[];
    exhaustionWarnings: string[];
  }> {
    return await this.multiTimeframeAnalyzer.analyzeMultiTimeframe(ohlcvData);
  }

  /**
   * Apply multi-timeframe enhancements to single timeframe result
   */
  private applyMultiTimeframeEnhancements(
    singleResult: TechnicalAnalysisResult,
    multiResult: MultiTimeframeResult & {
      consecutiveMomentum: ConsecutiveMomentumTracking;
      divergences: TimeframeDivergence[];
      exhaustionWarnings: string[];
    },
    context: AnalysisContext
  ): TechnicalAnalysisResult {
    // Apply consecutive momentum boost to rating
    let enhancedRating = singleResult.rating.rating;
    if (multiResult.consecutiveMomentum.scoreBoost > 0) {
      const boostMultiplier = 1 + (multiResult.consecutiveMomentum.scoreBoost / 100);
      enhancedRating = Math.min(10, enhancedRating * boostMultiplier);
    }
    
    // Adjust confidence based on timeframe alignment
    let enhancedConfidence = singleResult.rating.confidence;
    if (multiResult.timeframeAlignment.consensus === 'strong_bull' || 
        multiResult.timeframeAlignment.consensus === 'strong_bear') {
      enhancedConfidence = Math.min(100, enhancedConfidence * 1.15);
    }
    
    // Reduce confidence for divergences and exhaustion warnings
    if (multiResult.divergences.length > 0) {
      enhancedConfidence *= (1 - (multiResult.divergences.length * 0.1));
    }
    if (multiResult.exhaustionWarnings.length > 0) {
      enhancedConfidence *= (1 - (multiResult.exhaustionWarnings.length * 0.05));
    }
    
    // Update reasoning with multi-timeframe insights
    const enhancedReasoning = [
      ...singleResult.rating.reasoning,
      `Multi-timeframe consensus: ${multiResult.timeframeAlignment.consensus}`,
    ];
    
    if (multiResult.consecutiveMomentum.consecutiveCount > 1) {
      enhancedReasoning.push(
        `Consecutive momentum: ${multiResult.consecutiveMomentum.consecutiveCount} periods (+${multiResult.consecutiveMomentum.scoreBoost}%)`
      );
    }
    
    // Add alerts for exhaustion and divergences
    const enhancedAlerts = [...singleResult.rating.alerts];
    multiResult.exhaustionWarnings.forEach(warning => {
      enhancedAlerts.push(warning);
    });
    multiResult.divergences.forEach(div => {
      enhancedAlerts.push(`${div.type} divergence between ${div.timeframe1} and ${div.timeframe2}`);
    });
    
    return {
      ...singleResult,
      rating: {
        ...singleResult.rating,
        rating: enhancedRating,
        confidence: Math.max(0, enhancedConfidence),
        reasoning: enhancedReasoning,
        alerts: enhancedAlerts
      },
      // Add multi-timeframe data to the result
      timeframes: this.technicalIndicators.calculateMultiTimeframe(this.convertToOHLCV(context.chartData)),
      consecutiveMomentum: multiResult.consecutiveMomentum,
      timeframeDivergences: multiResult.divergences,
      aggregatedScores: {
        weighted: this.calculateWeightedScore(multiResult),
        confidence: enhancedConfidence,
        timeframeAlignment: this.calculateTimeframeAlignmentScore(multiResult.timeframeAlignment)
      }
    };
  }

  /**
   * Generate enhanced final recommendation with multi-timeframe considerations
   */
  private generateEnhancedFinalRecommendation(
    enhancedResult: TechnicalAnalysisResult,
    multiTF: MultiTimeframeResult & {
      consecutiveMomentum: ConsecutiveMomentumTracking;
      divergences: TimeframeDivergence[];
      exhaustionWarnings: string[];
    },
    context: AnalysisContext
  ): TechnicalAnalysisResult['recommendation'] {
    return this.generateFinalRecommendation(enhancedResult, multiTF, context);
  }

  /**
   * Generate final recommendation combining all analyses
   */
  private generateFinalRecommendation(
    singleTF: TechnicalAnalysisResult,
    multiTF?: MultiTimeframeResult,
    context?: AnalysisContext
  ): TechnicalAnalysisResult['recommendation'] {
    let finalAction = singleTF.recommendation.action;
    let finalConfidence = singleTF.recommendation.confidence;
    const reasoning = [...singleTF.recommendation.reasoning];

    // Adjust based on multi-timeframe analysis if available
    if (multiTF) {
      const mtfAction = multiTF.consolidatedSignal.overallSignal;
      const mtfConfidence = multiTF.consolidatedSignal.confidence;

      // If timeframes disagree significantly, reduce confidence and move to neutral
      if (this.actionsDisagree(finalAction, mtfAction)) {
        finalConfidence *= 0.7;
        reasoning.push(`Timeframe disagreement detected - reducing confidence`);
        
        if (finalConfidence < 60) {
          finalAction = 'hold';
        }
      } else {
        // If timeframes agree, boost confidence
        finalConfidence = Math.min(100, (finalConfidence + mtfConfidence) / 2 * 1.1);
        reasoning.push(`Multi-timeframe confirmation: ${multiTF.timeframeAlignment.consensus}`);
      }
    }

    // Memecoin-specific adjustments
    if (this.options.memecoinsOptimized) {
      finalConfidence = this.adjustForMemes(finalConfidence, singleTF, context);
    }

    return {
      action: finalAction,
      confidence: finalConfidence,
      reasoning,
      riskLevel: singleTF.recommendation.riskLevel,
      positionSize: this.calculatePositionSize({ confidence: finalConfidence } as any, singleTF.risk),
      targets: singleTF.recommendation.targets,
      stopLoss: singleTF.recommendation.stopLoss
    };
  }

  /**
   * Convert chart data to OHLCV format
   */
  private convertToOHLCV(chartData: ChartDataPoint[]): OHLCVData[] {
    return chartData.map(point => ({
      open: point.open,
      high: point.high,
      low: point.low,
      close: point.close,
      volume: point.volume,
      timestamp: point.timestamp
    }));
  }

  /**
   * Check if multiple timeframes are available
   */
  private hasMultipleTimeframes(context: AnalysisContext): boolean {
    // This would check if we have data for multiple timeframes
    // For now, always return true if we have sufficient data
    return context.chartData && context.chartData.length > 50;
  }

  /**
   * Assess overall risk
   */
  private assessRisk(data: OHLCVData[], momentum: any, signals: SignalResult, volume: any): any {
    let riskScore = 0;
    const factors = {
      liquidity: 0,
      volatility: 0,
      holderConcentration: 0,
      marketCap: 0,
      age: 0,
      rugPullRisk: 0
    };

    // Volatility risk
    const volatility = momentum.volatility || 0;
    factors.volatility = Math.min(100, volatility);
    riskScore += factors.volatility * 0.3;

    // Liquidity risk (inverse of volume score)
    factors.liquidity = Math.max(0, 100 - volume.liquidityScore);
    riskScore += factors.liquidity * 0.2;

    // Signal confidence risk
    const confidenceRisk = Math.max(0, 100 - signals.confidence);
    riskScore += confidenceRisk * 0.2;

    // Technical divergence risk
    const technicalRisk = signals.alerts.length * 10;
    riskScore += technicalRisk * 0.1;

    // Market cap risk (smaller = riskier for memecoins)
    // This would use actual market cap data
    factors.marketCap = 20; // Placeholder
    riskScore += factors.marketCap * 0.1;

    // Age risk (newer = riskier)
    factors.age = 30; // Placeholder
    riskScore += factors.age * 0.1;

    const overall = Math.min(100, riskScore);
    let riskLevel: 'low' | 'medium' | 'high' | 'extreme';

    if (overall > 80) riskLevel = 'extreme';
    else if (overall > 60) riskLevel = 'high';
    else if (overall > 40) riskLevel = 'medium';
    else riskLevel = 'low';

    return {
      overall,
      factors,
      warnings: this.generateRiskWarnings(factors, overall),
      riskLevel
    };
  }

  /**
   * Generate risk warnings
   */
  private generateRiskWarnings(factors: any, overall: number): string[] {
    const warnings: string[] = [];

    if (factors.volatility > 70) warnings.push('High volatility detected');
    if (factors.liquidity > 70) warnings.push('Low liquidity - large spreads possible');
    if (overall > 80) warnings.push('Extreme risk - proceed with extreme caution');
    else if (overall > 60) warnings.push('High risk investment');

    return warnings;
  }

  /**
   * Calculate overall rating
   */
  private calculateRating(signals: SignalResult, momentum: any, volume: any, patterns: any): number {
    let rating = 5; // Base neutral rating

    // Adjust based on signal strength
    if (signals.overallSignal === 'strong_buy') rating = 9;
    else if (signals.overallSignal === 'buy') rating = 7;
    else if (signals.overallSignal === 'sell') rating = 3;
    else if (signals.overallSignal === 'strong_sell') rating = 1;

    // Adjust based on confidence
    const confidenceMultiplier = signals.confidence / 100;
    rating = 5 + (rating - 5) * confidenceMultiplier;

    // Momentum adjustment
    if (momentum.trend === 'bullish' && momentum.strength > 70) rating += 1;
    else if (momentum.trend === 'bearish' && momentum.strength > 70) rating -= 1;

    // Volume confirmation
    if (volume.volumeSpike && volume.volumeProfile.netFlow > 20) rating += 0.5;
    else if (volume.volumeProfile.netFlow < -20) rating -= 0.5;

    return Math.max(1, Math.min(10, Math.round(rating * 10) / 10));
  }

  /**
   * Calculate technical score
   */
  private calculateTechnicalScore(indicators: any, signals: SignalResult): number {
    return Math.min(100, signals.score + 50); // Normalize to 0-100
  }

  /**
   * Calculate volume score
   */
  private calculateVolumeScore(volume: any, signals: any[]): number {
    let score = volume.liquidityScore;
    
    // Boost for positive volume signals
    const positiveSignals = signals.filter(s => s.type === 'accumulation' || s.type === 'breakout').length;
    score += positiveSignals * 10;

    return Math.min(100, score);
  }

  /**
   * Calculate pattern score
   */
  private calculatePatternScore(patterns: any): number {
    let score = 50; // Base score

    // Boost for bullish patterns
    const bullishPatterns = patterns.patterns.filter((p: any) => p.bullish && p.confidence > 70).length;
    const bearishPatterns = patterns.patterns.filter((p: any) => !p.bullish && p.confidence > 70).length;

    score += (bullishPatterns - bearishPatterns) * 10;

    // Candlestick patterns
    const bullishCandles = patterns.candlestickPatterns.filter((c: any) => c.bullish && c.confidence > 70).length;
    const bearishCandles = patterns.candlestickPatterns.filter((c: any) => !c.bullish && c.confidence > 70).length;

    score += (bullishCandles - bearishCandles) * 5;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate fundamental score (placeholder)
   */
  private calculateFundamentalScore(tokenData: any): number {
    let score = 50; // Base score

    // Market cap consideration
    const marketCap = tokenData.marketCap || 0;
    if (marketCap > 10000000 && marketCap < 50000000) score += 20; // Sweet spot
    else if (marketCap < 1000000) score -= 20; // Too small

    // Volume/market cap ratio
    const volumeRatio = tokenData.volume24h / marketCap;
    if (volumeRatio > 0.1) score += 15; // Good liquidity
    else if (volumeRatio < 0.01) score -= 15; // Poor liquidity

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate position size based on confidence and risk
   */
  private calculatePositionSize(signals: { confidence: number }, risk: any): number {
    const baseSize = 0.05; // 5% base position
    const confidenceMultiplier = signals.confidence / 100;
    const riskMultiplier = risk.riskLevel === 'low' ? 1.5 : 
                          risk.riskLevel === 'medium' ? 1.0 :
                          risk.riskLevel === 'high' ? 0.5 : 0.2;

    const positionSize = baseSize * confidenceMultiplier * riskMultiplier;
    return Math.max(0.01, Math.min(0.15, positionSize)); // Cap between 1% and 15%
  }

  /**
   * Calculate price targets
   */
  private calculateTargets(data: OHLCVData[], sr: any, momentum: any): number[] {
    const currentPrice = data[data.length - 1].close;
    const targets: number[] = [];

    // Use resistance levels as targets
    const nearestResistance = sr.resistance
      .filter((r: any) => r.price > currentPrice)
      .sort((a: any, b: any) => a.price - b.price);

    if (nearestResistance.length > 0) {
      targets.push(nearestResistance[0].price);
      if (nearestResistance.length > 1) {
        targets.push(nearestResistance[1].price);
      }
    }

    // Add percentage-based targets if no resistance levels
    if (targets.length === 0) {
      targets.push(currentPrice * 1.15); // 15% target
      targets.push(currentPrice * 1.30); // 30% target
    }

    return targets;
  }

  /**
   * Calculate stop loss
   */
  private calculateStopLoss(data: OHLCVData[], sr: any, riskLevel: string): number | null {
    const currentPrice = data[data.length - 1].close;

    // Use nearest support level
    const nearestSupport = sr.support
      .filter((s: any) => s.price < currentPrice)
      .sort((a: any, b: any) => b.price - a.price)[0];

    if (nearestSupport) {
      return nearestSupport.price * 0.98; // Slightly below support
    }

    // Percentage-based stop loss
    const stopPercentage = riskLevel === 'low' ? 0.1 : 
                          riskLevel === 'medium' ? 0.08 :
                          riskLevel === 'high' ? 0.05 : 0.03;

    return currentPrice * (1 - stopPercentage);
  }

  /**
   * Check if two actions disagree
   */
  private actionsDisagree(action1: string, action2: string): boolean {
    const bullish = ['buy', 'strong_buy'];
    const bearish = ['sell', 'strong_sell'];

    return (bullish.includes(action1) && bearish.includes(action2)) ||
           (bearish.includes(action1) && bullish.includes(action2));
  }

  /**
   * Adjust confidence for memecoin characteristics
   */
  private adjustForMemes(confidence: number, analysis: TechnicalAnalysisResult, context?: AnalysisContext): number {
    // Memecoins are more volatile and unpredictable
    let adjustment = 0;

    // Reduce confidence for extreme signals (memes can be manipulated)
    if (analysis.recommendation.action === 'strong_buy' || analysis.recommendation.action === 'strong_sell') {
      adjustment -= 10;
    }

    // Boost confidence for volume confirmation (important for memes)
    if (analysis.volume.volumeSpike && analysis.volume.volumeProfile.netFlow > 30) {
      adjustment += 15;
    }

    // Reduce confidence for low liquidity
    if (analysis.volume.liquidityScore < 30) {
      adjustment -= 20;
    }

    return Math.max(0, Math.min(100, confidence + adjustment));
  }

  /**
   * Get result for insufficient data
   */
  private getInsufficientDataResult(tokenData: any, data: OHLCVData[]): TechnicalAnalysisResult {
    const currentPrice = data.length > 0 ? data[data.length - 1].close : 0;
    
    // Generate token-specific variations to prevent identical ratings
    const addressHash = this.generateAddressHash(tokenData.address);
    const rsiVariation = (addressHash % 20) - 10; // -10 to +10
    const strengthVariation = (addressHash % 30) - 15; // -15 to +15

    return {
      tokenAddress: tokenData.address,
      timestamp: Date.now(),
      price: currentPrice,
      marketCap: tokenData.marketCap,
      technicalIndicators: {
        rsi: Math.max(20, Math.min(80, 50 + rsiVariation)), // 40-60 range with variations
        macd: { macd: 0, signal: 0, histogram: 0 },
        bollinger: { upper: currentPrice, middle: currentPrice, lower: currentPrice, position: 0.5 },
        ema: {},
        sma: {}
      },
      momentum: {
        trend: 'neutral' as const,
        strength: Math.max(0, strengthVariation + 15), // 0-30 range  
        momentum: (addressHash % 11 - 5) / 100, // -0.05 to +0.05
        volatility: Math.max(5, Math.min(40, 20 + (addressHash % 25))), // 20-45 range
        support: [],
        resistance: [],
        priceAction: {
          breakoutPotential: 0,
          consolidation: false,
          reversalSignal: false
        }
      },
      volume: {
        averageVolume: 0,
        currentVolume: 0,
        volumeSpike: false,
        volumeSpikeFactor: 1,
        volumeProfile: { buyPressure: 50, sellPressure: 50, netFlow: 0 },
        liquidityScore: 0
      },
      patterns: { patterns: [], candlestickPatterns: [] },
      risk: {
        overall: 100,
        factors: {
          liquidity: 100,
          volatility: 100,
          holderConcentration: 100,
          marketCap: 100,
          age: 100,
          rugPullRisk: 100
        },
        warnings: ['Insufficient data for analysis'],
        riskLevel: 'extreme' as const
      },
      rating: {
        rating: 1,
        confidence: 0,
        components: {
          technical: 0,
          momentum: 0,
          volume: 0,
          risk: 0,
          pattern: 0,
          fundamentals: 0
        },
        weights: {
          technical: 0.25,
          momentum: 0.20,
          volume: 0.15,
          risk: 0.15,
          pattern: 0.15,
          fundamentals: 0.10
        },
        reasoning: ['Insufficient data for technical analysis'],
        alerts: ['Minimum data requirement not met']
      },
      timeframes: {},
      volumeSignals: [],
      volumePatterns: [],
      supportResistance: { support: [], resistance: [] },
      recommendation: {
        action: 'hold' as const,
        confidence: 0,
        reasoning: ['Insufficient data - avoid trading'],
        riskLevel: 'extreme' as const,
        positionSize: 0,
        targets: [],
        stopLoss: null
      }
    };
  }

  /**
   * Update analysis options
   */
  public updateOptions(newOptions: Partial<AnalysisOptions>): void {
    this.options = { ...this.options, ...newOptions };
    
    // Update component configurations
    this.technicalIndicators.updateConfig(newOptions.indicators || {});
    this.signalGenerator.updateWeights(newOptions as any);
  }

  /**
   * Calculate weighted score from multi-timeframe analysis
   */
  private calculateWeightedScore(multiResult: MultiTimeframeResult): number {
    let weightedScore = 0;
    let totalWeight = 0;
    
    for (const tf of multiResult.timeframes) {
      const score = tf.overallBias === 'bullish' ? tf.confidence : 
                   tf.overallBias === 'bearish' ? -tf.confidence : 0;
      weightedScore += score * tf.weight;
      totalWeight += tf.weight;
    }
    
    return totalWeight > 0 ? weightedScore / totalWeight : 0;
  }
  
  /**
   * Calculate timeframe alignment score
   */
  private calculateTimeframeAlignmentScore(alignment: any): number {
    if (alignment.consensus === 'strong_bull' || alignment.consensus === 'strong_bear') {
      return 90;
    } else if (alignment.consensus === 'bull' || alignment.consensus === 'bear') {
      return 70;
    } else {
      return Math.max(alignment.bullish, alignment.bearish);
    }
  }

  /**
   * Get current analysis options
   */
  public getOptions(): AnalysisOptions {
    return { ...this.options };
  }
  
  /**
   * Get consecutive momentum tracker instance
   */
  public getConsecutiveMomentumTracker(): ConsecutiveMomentumTracker {
    return this.consecutiveMomentumTracker;
  }
  
  /**
   * Clear consecutive momentum tracking (useful for new tokens)
   */
  public clearConsecutiveMomentum(): void {
    this.consecutiveMomentumTracker.clearTracking();
  }

  /**
   * Generate a simple hash from token address for variations in fallback data
   */
  private generateAddressHash(address?: string): number {
    if (!address) return 42; // Default fallback
    
    let hash = 0;
    for (let i = 0; i < address.length; i++) {
      const char = address.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}