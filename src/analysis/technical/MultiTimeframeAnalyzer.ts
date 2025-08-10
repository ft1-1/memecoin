/**
 * Multi-Timeframe Technical Analysis
 * Combines analysis across different timeframes with weighted scoring
 */

import { TechnicalIndicators } from './TechnicalIndicators';
import { MomentumAnalyzer } from './MomentumAnalyzer';
import { SignalGenerator, SignalResult } from './SignalGenerator';
import { ConsecutiveMomentumTracker } from './ConsecutiveMomentumTracker';
import { OHLCVData, MultiTimeframeAnalysis, TimeframeWeight } from './types';
import { MultiTimeframeData, TimeframeDivergence, ConsecutiveMomentumTracking } from '../../types/analysis';

export interface TimeframeData {
  timeframe: string;
  data: OHLCVData[];
  weight: number;
  importance: 'primary' | 'secondary' | 'confirmation';
}

export interface MultiTimeframeResult {
  timeframes: MultiTimeframeAnalysis[];
  consolidatedSignal: SignalResult;
  timeframeAlignment: {
    bullish: number; // Percentage of timeframes showing bullish bias
    bearish: number; // Percentage of timeframes showing bearish bias
    neutral: number; // Percentage of timeframes showing neutral bias
    consensus: 'strong_bull' | 'bull' | 'neutral' | 'bear' | 'strong_bear';
  };
  riskAssessment: {
    overallRisk: 'low' | 'medium' | 'high' | 'extreme';
    timeframeDivergence: number; // 0-100, higher = more divergence
    confidence: number; // 0-100
  };
  recommendations: {
    entry: number | null;
    stopLoss: number | null;
    takeProfit: number[];
    positionSize: number; // 0-1, percentage of portfolio
    timeHorizon: 'scalp' | 'swing' | 'position' | 'hold';
  };
}

export class MultiTimeframeAnalyzer {
  private technicalIndicators: TechnicalIndicators;
  private momentumAnalyzer: MomentumAnalyzer;
  private signalGenerator: SignalGenerator;
  private consecutiveMomentumTracker: ConsecutiveMomentumTracker;
  private timeframeWeights: Map<string, TimeframeWeight>;

  constructor() {
    this.technicalIndicators = new TechnicalIndicators();
    this.momentumAnalyzer = new MomentumAnalyzer();
    this.signalGenerator = new SignalGenerator();
    this.consecutiveMomentumTracker = new ConsecutiveMomentumTracker();

    // Initialize timeframe weights as specified: 4h (60%), 1h (40%)
    this.timeframeWeights = new Map([
      ['4h', { timeframe: '4h', weight: 0.60, importance: 'primary' }],
      ['1h', { timeframe: '1h', weight: 0.40, importance: 'primary' }]
    ]);
  }

  /**
   * Perform comprehensive multi-timeframe analysis with consecutive momentum tracking
   */
  public async analyzeMultiTimeframe(data: OHLCVData[]): Promise<MultiTimeframeResult & {
    consecutiveMomentum: ConsecutiveMomentumTracking;
    divergences: TimeframeDivergence[];
    exhaustionWarnings: string[];
  }> {
    if (data.length === 0) {
      throw new Error('No data provided for multi-timeframe analysis');
    }

    // Calculate indicators for all timeframes
    const multiTimeframeData = this.technicalIndicators.calculateMultiTimeframe(data);
    
    // Convert to TimeframeData format for existing analysis
    const timeframeDataArray = this.convertToTimeframeDataArray(data, multiTimeframeData);
    
    return this.performEnhancedAnalysis(timeframeDataArray, data);
  }

  /**
   * Convert multi-timeframe data to TimeframeData array format
   */
  private convertToTimeframeDataArray(originalData: OHLCVData[], multiTimeframeData: MultiTimeframeData): TimeframeData[] {
    const timeframeDataArray: TimeframeData[] = [];
    
    const timeframes = ['4h', '1h'];
    
    for (const timeframe of timeframes) {
      const tfData = multiTimeframeData[timeframe as keyof MultiTimeframeData];
      if (tfData) {
        const aggregatedData = this.aggregateToTimeframe(originalData, timeframe);
        if (aggregatedData.length > 0) {
          timeframeDataArray.push({
            timeframe,
            data: aggregatedData,
            weight: tfData.weight,
            importance: this.timeframeWeights.get(timeframe)?.importance || 'secondary'
          });
        }
      }
    }
    
    return timeframeDataArray;
  }

  /**
   * Aggregate data to specific timeframe
   */
  private aggregateToTimeframe(data: OHLCVData[], timeframe: string): OHLCVData[] {
    const intervalMinutes = this.getTimeframeMinutes(timeframe);
    const intervalMs = intervalMinutes * 60 * 1000;
    
    if (intervalMinutes === 1) {
      return data;
    }
    
    const aggregated: OHLCVData[] = [];
    const groups = new Map<number, OHLCVData[]>();
    
    for (const candle of data) {
      const intervalStart = Math.floor(candle.timestamp / intervalMs) * intervalMs;
      if (!groups.has(intervalStart)) {
        groups.set(intervalStart, []);
      }
      groups.get(intervalStart)!.push(candle);
    }
    
    for (const [timestamp, candles] of groups) {
      if (candles.length === 0) continue;
      
      candles.sort((a, b) => a.timestamp - b.timestamp);
      
      aggregated.push({
        open: candles[0].open,
        high: Math.max(...candles.map(c => c.high)),
        low: Math.min(...candles.map(c => c.low)),
        close: candles[candles.length - 1].close,
        volume: candles.reduce((sum, c) => sum + c.volume, 0),
        timestamp
      });
    }
    
    return aggregated.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Perform enhanced analysis with consecutive momentum and divergence detection
   */
  private async performEnhancedAnalysis(
    timeframeDataArray: TimeframeData[], 
    originalData: OHLCVData[]
  ): Promise<MultiTimeframeResult & {
    consecutiveMomentum: ConsecutiveMomentumTracking;
    divergences: TimeframeDivergence[];
    exhaustionWarnings: string[];
  }> {
    // Analyze each timeframe
    const timeframeAnalyses = await this.analyzeIndividualTimeframes(timeframeDataArray);
    
    // Track consecutive momentum for 15-minute intervals
    const consecutiveMomentum = this.trackConsecutiveMomentum(originalData);
    
    // Detect divergences between timeframes
    const divergences = this.detectTimeframeDivergences(timeframeAnalyses);
    
    // Generate exhaustion warnings
    const exhaustionWarnings = this.generateExhaustionWarnings(timeframeAnalyses);
    
    // Calculate timeframe alignment with enhancements
    const alignment = this.calculateEnhancedTimeframeAlignment(timeframeAnalyses, consecutiveMomentum);
    
    // Generate consolidated signal with momentum boost
    const consolidatedSignal = this.generateEnhancedConsolidatedSignal(
      timeframeAnalyses, 
      alignment, 
      consecutiveMomentum, 
      divergences
    );
    
    // Assess risk with exhaustion and divergence factors
    const riskAssessment = this.assessEnhancedMultiTimeframeRisk(
      timeframeAnalyses, 
      alignment, 
      exhaustionWarnings, 
      divergences
    );
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(timeframeAnalyses, alignment, riskAssessment);

    return {
      timeframes: timeframeAnalyses,
      consolidatedSignal,
      timeframeAlignment: alignment,
      riskAssessment,
      recommendations,
      consecutiveMomentum,
      divergences,
      exhaustionWarnings
    };
  }

  /**
   * Analyze individual timeframes
   */
  private async analyzeIndividualTimeframes(timeframeDataArray: TimeframeData[]): Promise<MultiTimeframeAnalysis[]> {
    const analyses: MultiTimeframeAnalysis[] = [];

    for (const timeframeData of timeframeDataArray) {
      if (timeframeData.data.length < 20) continue; // Skip timeframes with insufficient data

      const indicators = this.technicalIndicators.calculateAll(timeframeData.data);
      const momentum = this.momentumAnalyzer.analyzeMomentum(timeframeData.data);
      const signals = this.signalGenerator.generateSignals(timeframeData.data);

      // Determine overall bias for this timeframe
      const overallBias = this.determineTimeframeBias(signals, indicators, momentum);
      
      // Calculate confidence based on signal strength and agreement
      const confidence = this.calculateTimeframeConfidence(signals, indicators, momentum);

      const analysis: MultiTimeframeAnalysis = {
        timeframe: timeframeData.timeframe,
        weight: this.getTimeframeWeight(timeframeData.timeframe),
        signals: signals.signals,
        indicators: {
          rsi: indicators.rsi,
          macd: indicators.macd,
          bollinger: indicators.bollinger,
          ema: indicators.ema,
          sma: indicators.sma
        },
        momentum: {
          roc: momentum.momentum,
          momentum: momentum.momentum,
          acceleration: 0, // Will be calculated by momentum analyzer
          velocity: 0,
          trendStrength: momentum.strength,
          trendDirection: momentum.trend === 'bullish' ? 1 : momentum.trend === 'bearish' ? -1 : 0
        },
        volume: {
          averageVolume: timeframeData.data.slice(-20).reduce((sum, d) => sum + d.volume, 0) / Math.min(20, timeframeData.data.length),
          currentVolume: timeframeData.data[timeframeData.data.length - 1].volume,
          volumeRatio: 0, // Will be calculated
          volumeSpike: false,
          volumeTrend: 'stable',
          buyVolume: 0,
          sellVolume: 0,
          volumeWeightedPrice: 0
        },
        overallBias,
        confidence
      };

      // Calculate volume metrics
      this.enhanceVolumeAnalysis(analysis, timeframeData.data);

      analyses.push(analysis);
    }

    return analyses;
  }

  /**
   * Enhance volume analysis for timeframe
   */
  private enhanceVolumeAnalysis(analysis: MultiTimeframeAnalysis, data: OHLCVData[]): void {
    if (data.length < 10) return;

    const volumes = data.map(d => d.volume);
    const currentVolume = volumes[volumes.length - 1];
    const avgVolume = volumes.slice(-10).reduce((sum, vol) => sum + vol, 0) / Math.min(10, volumes.length);

    analysis.volume!.volumeRatio = avgVolume > 0 ? currentVolume / avgVolume : 1;
    analysis.volume!.volumeSpike = analysis.volume!.volumeRatio > 2;

    // Calculate volume trend
    const recentVolumes = volumes.slice(-5);
    const olderVolumes = volumes.slice(-10, -5);
    const recentAvg = recentVolumes.reduce((sum, vol) => sum + vol, 0) / recentVolumes.length;
    const olderAvg = olderVolumes.reduce((sum, vol) => sum + vol, 0) / olderVolumes.length;

    if (recentAvg > olderAvg * 1.2) {
      analysis.volume!.volumeTrend = 'increasing';
    } else if (recentAvg < olderAvg * 0.8) {
      analysis.volume!.volumeTrend = 'decreasing';
    }

    // Calculate volume-weighted price
    let totalVolumePrice = 0;
    let totalVolume = 0;
    
    for (const candle of data.slice(-20)) {
      const typicalPrice = (candle.high + candle.low + candle.close) / 3;
      totalVolumePrice += typicalPrice * candle.volume;
      totalVolume += candle.volume;
    }

    analysis.volume!.volumeWeightedPrice = totalVolume > 0 ? totalVolumePrice / totalVolume : data[data.length - 1].close;
  }

  /**
   * Determine bias for a specific timeframe
   */
  private determineTimeframeBias(signals: SignalResult, indicators: any, momentum: any): 'bullish' | 'bearish' | 'neutral' {
    let bullishScore = 0;
    let bearishScore = 0;

    // Analyze signal scores
    for (const signal of signals.signals) {
      if (signal.type === 'buy') {
        bullishScore += signal.strength * (signal.confidence / 100);
      } else if (signal.type === 'sell') {
        bearishScore += signal.strength * (signal.confidence / 100);
      }
    }

    // Add momentum bias
    if (momentum.trend === 'bullish') {
      bullishScore += momentum.strength;
    } else if (momentum.trend === 'bearish') {
      bearishScore += momentum.strength;
    }

    // Add indicator bias
    if (indicators.rsi < 30) bullishScore += 30;
    else if (indicators.rsi > 70) bearishScore += 30;

    if (indicators.macd.macd > indicators.macd.signal) bullishScore += 20;
    else bearishScore += 20;

    const totalScore = bullishScore + bearishScore;
    if (totalScore === 0) return 'neutral';

    const bullishRatio = bullishScore / totalScore;
    if (bullishRatio > 0.65) return 'bullish';
    if (bullishRatio < 0.35) return 'bearish';
    return 'neutral';
  }

  /**
   * Calculate confidence for a timeframe
   */
  private calculateTimeframeConfidence(signals: SignalResult, indicators: any, momentum: any): number {
    let confidence = signals.confidence;

    // Boost confidence for aligned signals
    const buySignals = signals.signals.filter(s => s.type === 'buy').length;
    const sellSignals = signals.signals.filter(s => s.type === 'sell').length;
    const totalSignals = buySignals + sellSignals;

    if (totalSignals > 0) {
      const alignment = Math.abs(buySignals - sellSignals) / totalSignals;
      confidence *= (0.8 + alignment * 0.2); // Boost for aligned signals
    }

    // Adjust for momentum strength
    confidence *= (0.8 + (momentum.strength / 100) * 0.2);

    return Math.min(100, confidence);
  }

  /**
   * Calculate alignment across timeframes
   */
  private calculateTimeframeAlignment(analyses: MultiTimeframeAnalysis[]): {
    bullish: number;
    bearish: number;
    neutral: number;
    consensus: 'strong_bull' | 'bull' | 'neutral' | 'bear' | 'strong_bear';
  } {
    let totalWeight = 0;
    let bullishWeight = 0;
    let bearishWeight = 0;
    let neutralWeight = 0;

    for (const analysis of analyses) {
      totalWeight += analysis.weight;

      if (analysis.overallBias === 'bullish') {
        bullishWeight += analysis.weight;
      } else if (analysis.overallBias === 'bearish') {
        bearishWeight += analysis.weight;
      } else {
        neutralWeight += analysis.weight;
      }
    }

    const bullish = totalWeight > 0 ? (bullishWeight / totalWeight) * 100 : 0;
    const bearish = totalWeight > 0 ? (bearishWeight / totalWeight) * 100 : 0;
    const neutral = totalWeight > 0 ? (neutralWeight / totalWeight) * 100 : 0;

    let consensus: 'strong_bull' | 'bull' | 'neutral' | 'bear' | 'strong_bear';

    if (bullish > 75) consensus = 'strong_bull';
    else if (bullish > 55) consensus = 'bull';
    else if (bearish > 75) consensus = 'strong_bear';
    else if (bearish > 55) consensus = 'bear';
    else consensus = 'neutral';

    return { bullish, bearish, neutral, consensus };
  }

  /**
   * Generate consolidated signal from all timeframes
   */
  private generateConsolidatedSignal(
    analyses: MultiTimeframeAnalysis[], 
    alignment: any
  ): SignalResult {
    let totalScore = 0;
    let totalWeight = 0;
    let totalConfidence = 0;
    const allSignals: any[] = [];
    const reasoning: string[] = [];
    const alerts: string[] = [];

    // Combine weighted scores from all timeframes
    for (const analysis of analyses) {
      const timeframeScore = this.calculateTimeframeScore(analysis);
      totalScore += timeframeScore * analysis.weight;
      totalWeight += analysis.weight;
      totalConfidence += analysis.confidence * analysis.weight;

      // Add significant signals to combined list
      for (const signal of analysis.signals) {
        if (signal.strength > 50) {
          allSignals.push({
            ...signal,
            source: `${signal.source} (${analysis.timeframe})`
          });
        }
      }
    }

    const avgScore = totalWeight > 0 ? totalScore / totalWeight : 0;
    const avgConfidence = totalWeight > 0 ? totalConfidence / totalWeight : 0;

    // Generate reasoning based on alignment
    reasoning.push(`Timeframe consensus: ${alignment.consensus} (${alignment.bullish.toFixed(0)}% bullish, ${alignment.bearish.toFixed(0)}% bearish)`);
    
    // Add strongest timeframe signals
    const strongTimeframes = analyses
      .filter(a => a.confidence > 70)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 2);

    for (const tf of strongTimeframes) {
      reasoning.push(`${tf.timeframe}: ${tf.overallBias} bias with ${tf.confidence.toFixed(0)}% confidence`);
    }

    // Generate alerts for divergences
    const divergence = this.calculateTimeframeDivergence(analyses);
    if (divergence > 50) {
      alerts.push(`High timeframe divergence detected (${divergence.toFixed(0)}%)`);
    }

    // Determine overall signal
    let overallSignal: 'strong_buy' | 'buy' | 'neutral' | 'sell' | 'strong_sell';
    
    if (avgScore > 70 && avgConfidence > 70) overallSignal = 'strong_buy';
    else if (avgScore > 30 && avgConfidence > 60) overallSignal = 'buy';
    else if (avgScore < -70 && avgConfidence > 70) overallSignal = 'strong_sell';
    else if (avgScore < -30 && avgConfidence > 60) overallSignal = 'sell';
    else overallSignal = 'neutral';

    return {
      signals: allSignals,
      overallSignal,
      confidence: avgConfidence,
      score: avgScore,
      reasoning,
      alerts,
      riskLevel: this.determineRiskLevel(avgScore, avgConfidence, divergence)
    };
  }

  /**
   * Calculate score for a single timeframe
   */
  private calculateTimeframeScore(analysis: MultiTimeframeAnalysis): number {
    if (analysis.overallBias === 'bullish') {
      return analysis.momentum?.trendStrength || 50;
    } else if (analysis.overallBias === 'bearish') {
      return -(analysis.momentum?.trendStrength || 50);
    }
    return 0;
  }

  /**
   * Calculate divergence between timeframes
   */
  private calculateTimeframeDivergence(analyses: MultiTimeframeAnalysis[]): number {
    if (analyses.length < 2) return 0;

    const biases = analyses.map(a => a.overallBias);
    const bullishCount = biases.filter(b => b === 'bullish').length;
    const bearishCount = biases.filter(b => b === 'bearish').length;
    const neutralCount = biases.filter(b => b === 'neutral').length;

    const total = analyses.length;
    const maxCount = Math.max(bullishCount, bearishCount, neutralCount);
    
    // Higher divergence when timeframes disagree
    const agreement = maxCount / total;
    return (1 - agreement) * 100;
  }

  /**
   * Assess multi-timeframe risk
   */
  private assessMultiTimeframeRisk(
    analyses: MultiTimeframeAnalysis[], 
    alignment: any
  ): { overallRisk: 'low' | 'medium' | 'high' | 'extreme'; timeframeDivergence: number; confidence: number } {
    const divergence = this.calculateTimeframeDivergence(analyses);
    const avgConfidence = analyses.length > 0 ? 
      analyses.reduce((sum, a) => sum + a.confidence, 0) / analyses.length : 0;
    
    let riskScore = 0;

    // Divergence risk
    if (divergence > 70) riskScore += 40;
    else if (divergence > 50) riskScore += 25;
    else if (divergence > 30) riskScore += 15;

    // Confidence risk
    if (avgConfidence < 50) riskScore += 30;
    else if (avgConfidence < 70) riskScore += 15;

    // Consensus risk
    if (alignment.consensus === 'neutral') riskScore += 20;

    let overallRisk: 'low' | 'medium' | 'high' | 'extreme';
    if (riskScore > 75) overallRisk = 'extreme';
    else if (riskScore > 50) overallRisk = 'high';
    else if (riskScore > 25) overallRisk = 'medium';
    else overallRisk = 'low';

    return {
      overallRisk,
      timeframeDivergence: divergence,
      confidence: avgConfidence
    };
  }

  /**
   * Generate trading recommendations
   */
  private generateRecommendations(
    analyses: MultiTimeframeAnalysis[],
    alignment: any,
    riskAssessment: any
  ): any {
    const currentPrice = this.getCurrentPrice(analyses);
    let entry: number | null = null;
    let stopLoss: number | null = null;
    const takeProfit: number[] = [];
    let positionSize = 0;
    let timeHorizon: 'scalp' | 'swing' | 'position' | 'hold' = 'swing';

    // Determine position size based on confidence and risk
    if (riskAssessment.confidence > 80 && riskAssessment.overallRisk === 'low') {
      positionSize = 0.1; // 10% for high confidence, low risk
    } else if (riskAssessment.confidence > 70 && riskAssessment.overallRisk === 'medium') {
      positionSize = 0.05; // 5% for medium confidence
    } else if (riskAssessment.confidence > 60) {
      positionSize = 0.02; // 2% for lower confidence
    }

    // Set entry and targets for bullish scenarios
    if (alignment.consensus === 'strong_bull' || alignment.consensus === 'bull') {
      entry = currentPrice;
      stopLoss = currentPrice * 0.95; // 5% stop loss
      takeProfit.push(currentPrice * 1.1); // 10% target
      takeProfit.push(currentPrice * 1.2); // 20% target
      
      if (alignment.consensus === 'strong_bull') {
        takeProfit.push(currentPrice * 1.5); // 50% target for strong signals
        timeHorizon = 'position';
      }
    }

    // Adjust timeframe based on strongest signal timeframe
    if (analyses.length === 0) {
      timeHorizon = 'swing'; // Default fallback
      return {
        entry,
        stopLoss,
        takeProfit,
        positionSize,
        timeHorizon
      };
    }

    const strongestTimeframe = analyses.reduce((strongest, current) => 
      current.confidence > strongest.confidence ? current : strongest
    );

    if (strongestTimeframe.timeframe === '1h') {
      timeHorizon = 'swing';
    } else if (strongestTimeframe.timeframe === '4h') {
      timeHorizon = 'position';
    } else {
      timeHorizon = 'swing'; // Default fallback
    }

    return {
      entry,
      stopLoss,
      takeProfit,
      positionSize,
      timeHorizon
    };
  }

  /**
   * Get current price from analyses
   */
  private getCurrentPrice(analyses: MultiTimeframeAnalysis[]): number {
    // Use the shortest timeframe for most current price
    if (analyses.length === 0) {
      return 0; // No data available
    }

    const shortestTimeframe = analyses.reduce((shortest, current) => 
      this.getTimeframeMinutes(current.timeframe) < this.getTimeframeMinutes(shortest.timeframe) ? current : shortest
    );

    // This would typically come from the last data point
    return 0; // Placeholder - would need actual price data
  }


  /**
   * Get weight for timeframe
   */
  private getTimeframeWeight(timeframe: string): number {
    return this.timeframeWeights.get(timeframe)?.weight || 0.1;
  }

  /**
   * Determine risk level from score and confidence
   */
  private determineRiskLevel(score: number, confidence: number, divergence: number): 'low' | 'medium' | 'high' | 'extreme' {
    let riskScore = 0;

    if (confidence < 50) riskScore += 30;
    else if (confidence < 70) riskScore += 15;

    if (divergence > 50) riskScore += 25;
    else if (divergence > 30) riskScore += 15;

    if (Math.abs(score) < 20) riskScore += 20; // Weak signal

    if (riskScore > 60) return 'extreme';
    if (riskScore > 40) return 'high';
    if (riskScore > 20) return 'medium';
    return 'low';
  }

  /**
   * Update timeframe weights
   */
  public updateTimeframeWeights(weights: Map<string, TimeframeWeight>): void {
    this.timeframeWeights = new Map(weights);
  }

  /**
   * Track consecutive momentum for 15-minute intervals
   */
  private trackConsecutiveMomentum(data: OHLCVData[]): ConsecutiveMomentumTracking {
    if (data.length < 20) {
      return {
        periods: [],
        consecutiveCount: 0,
        scoreBoost: 0,
        exhaustionWarning: false,
        trendBreakReset: false,
        diminishingReturns: false
      };
    }

    // Calculate analysis for current period
    const closes = data.map(d => d.close);
    const volumes = data.map(d => d.volume);
    const avgVolume = volumes.slice(-20).reduce((sum, v) => sum + v, 0) / 20;
    
    const rsi = this.technicalIndicators.calculateRSI(closes);
    const macd = this.technicalIndicators.calculateMACD(closes);
    
    // Determine trend direction and strength
    const priceChange = (closes[closes.length - 1] - closes[closes.length - 10]) / closes[closes.length - 10];
    const trendDirection = priceChange > 0.02 ? 'bullish' : priceChange < -0.02 ? 'bearish' : 'neutral';
    const strength = Math.min(100, Math.abs(priceChange * 1000) + Math.abs(macd.histogram * 100));
    
    const analysis = {
      rsi,
      macdHistogram: macd.histogram,
      volume: volumes[volumes.length - 1],
      averageVolume: avgVolume,
      price: closes[closes.length - 1],
      trendDirection,
      strength
    };
    
    return this.consecutiveMomentumTracker.trackPeriod(Date.now(), analysis);
  }

  /**
   * Detect divergences between timeframes
   */
  private detectTimeframeDivergences(analyses: MultiTimeframeAnalysis[]): TimeframeDivergence[] {
    const divergences: TimeframeDivergence[] = [];
    
    for (let i = 0; i < analyses.length - 1; i++) {
      for (let j = i + 1; j < analyses.length; j++) {
        const tf1 = analyses[i];
        const tf2 = analyses[j];
        
        // Check for divergence between momentum indicators
        const divergence = this.checkDivergenceBetweenTimeframes(tf1, tf2);
        if (divergence) {
          divergences.push(divergence);
        }
      }
    }
    
    return divergences;
  }

  /**
   * Check for divergence between two timeframes
   */
  private checkDivergenceBetweenTimeframes(
    tf1: MultiTimeframeAnalysis, 
    tf2: MultiTimeframeAnalysis
  ): TimeframeDivergence | null {
    if (!tf1.indicators.rsi || !tf2.indicators.rsi || 
        !tf1.indicators.macd || !tf2.indicators.macd) {
      return null;
    }
    
    const rsiDiff = tf1.indicators.rsi - tf2.indicators.rsi;
    const macdDiff = tf1.indicators.macd.macd - tf2.indicators.macd.macd;
    
    // Check for significant divergence (>20 points RSI difference)
    if (Math.abs(rsiDiff) < 20) return null;
    
    // Determine divergence type
    let type: 'bullish' | 'bearish';
    let priceAction: 'higher_highs' | 'lower_lows' | 'diverging';
    let indicatorAction: 'lower_highs' | 'higher_lows' | 'converging';
    
    if (tf1.overallBias === 'bullish' && tf2.overallBias === 'bearish') {
      type = 'bullish';
      priceAction = 'higher_highs';
      indicatorAction = 'lower_highs';
    } else if (tf1.overallBias === 'bearish' && tf2.overallBias === 'bullish') {
      type = 'bearish';
      priceAction = 'lower_lows';
      indicatorAction = 'higher_lows';
    } else {
      priceAction = 'diverging';
      indicatorAction = 'converging';
      type = rsiDiff > 0 ? 'bullish' : 'bearish';
    }
    
    const strength = Math.min(100, Math.abs(rsiDiff) + Math.abs(macdDiff * 100));
    const confidence = Math.min(100, (tf1.confidence + tf2.confidence) / 2);
    
    return {
      timeframe1: tf1.timeframe,
      timeframe2: tf2.timeframe,
      type,
      strength,
      priceAction,
      indicatorAction,
      confidence
    };
  }

  /**
   * Generate exhaustion warnings
   */
  private generateExhaustionWarnings(analyses: MultiTimeframeAnalysis[]): string[] {
    const warnings: string[] = [];
    
    for (const analysis of analyses) {
      if (!analysis.indicators.rsi) continue;
      
      // RSI exhaustion warnings
      if (analysis.indicators.rsi > 80) {
        warnings.push(`${analysis.timeframe}: RSI extremely overbought (${analysis.indicators.rsi.toFixed(1)})`);
      } else if (analysis.indicators.rsi < 20) {
        warnings.push(`${analysis.timeframe}: RSI extremely oversold (${analysis.indicators.rsi.toFixed(1)})`);
      }
      
      // Volume spike warnings
      if (analysis.volume?.volumeSpike) {
        warnings.push(`${analysis.timeframe}: Unusual volume spike detected (${analysis.volume.volumeRatio.toFixed(1)}x average)`);
      }
      
      // MACD momentum warnings
      if (analysis.indicators.macd && Math.abs(analysis.indicators.macd.histogram) < 0.01) {
        warnings.push(`${analysis.timeframe}: MACD momentum weakening`);
      }
    }
    
    return warnings;
  }

  /**
   * Calculate enhanced timeframe alignment with consecutive momentum boost
   */
  private calculateEnhancedTimeframeAlignment(
    analyses: MultiTimeframeAnalysis[],
    consecutiveMomentum: ConsecutiveMomentumTracking
  ) {
    const baseAlignment = this.calculateTimeframeAlignment(analyses);
    
    // Apply consecutive momentum boost to consensus strength
    let enhancedConsensus = baseAlignment.consensus;
    
    if (consecutiveMomentum.consecutiveCount >= 2) {
      if (baseAlignment.consensus === 'bull') {
        enhancedConsensus = 'strong_bull';
      } else if (baseAlignment.consensus === 'bear') {
        enhancedConsensus = 'strong_bear';
      }
    }
    
    // Reduce confidence if exhaustion warning
    if (consecutiveMomentum.exhaustionWarning) {
      if (enhancedConsensus === 'strong_bull' || enhancedConsensus === 'strong_bear') {
        enhancedConsensus = enhancedConsensus === 'strong_bull' ? 'bull' : 'bear';
      }
    }
    
    return {
      ...baseAlignment,
      consensus: enhancedConsensus
    };
  }

  /**
   * Generate enhanced consolidated signal with momentum boost
   */
  private generateEnhancedConsolidatedSignal(
    analyses: MultiTimeframeAnalysis[],
    alignment: any,
    consecutiveMomentum: ConsecutiveMomentumTracking,
    divergences: TimeframeDivergence[]
  ): SignalResult {
    const baseSignal = this.generateConsolidatedSignal(analyses, alignment);
    
    // Apply consecutive momentum boost
    let boostedScore = baseSignal.score;
    let boostedConfidence = baseSignal.confidence;
    
    if (consecutiveMomentum.scoreBoost > 0) {
      const boostMultiplier = 1 + (consecutiveMomentum.scoreBoost / 100);
      boostedScore *= boostMultiplier;
      boostedConfidence = Math.min(100, boostedConfidence * boostMultiplier);
      
      baseSignal.reasoning.push(
        `Consecutive momentum boost: +${consecutiveMomentum.scoreBoost}% (${consecutiveMomentum.consecutiveCount} periods)`
      );
    }
    
    // Reduce confidence for divergences
    if (divergences.length > 0) {
      const divergencePenalty = Math.min(20, divergences.length * 5);
      boostedConfidence = Math.max(0, boostedConfidence - divergencePenalty);
      baseSignal.alerts.push(`${divergences.length} timeframe divergence(s) detected`);
    }
    
    // Adjust for exhaustion warnings
    if (consecutiveMomentum.exhaustionWarning) {
      boostedConfidence *= 0.8;
      baseSignal.alerts.push('Momentum exhaustion warning active');
    }
    
    return {
      ...baseSignal,
      score: boostedScore,
      confidence: boostedConfidence
    };
  }

  /**
   * Assess enhanced multi-timeframe risk with exhaustion and divergence factors
   */
  private assessEnhancedMultiTimeframeRisk(
    analyses: MultiTimeframeAnalysis[],
    alignment: any,
    exhaustionWarnings: string[],
    divergences: TimeframeDivergence[]
  ) {
    const baseRisk = this.assessMultiTimeframeRisk(analyses, alignment);
    
    let adjustedRiskScore = 0;
    
    // Base risk factors
    if (baseRisk.overallRisk === 'low') adjustedRiskScore = 10;
    else if (baseRisk.overallRisk === 'medium') adjustedRiskScore = 30;
    else if (baseRisk.overallRisk === 'high') adjustedRiskScore = 60;
    else adjustedRiskScore = 80;
    
    // Add exhaustion risk
    adjustedRiskScore += exhaustionWarnings.length * 10;
    
    // Add divergence risk
    adjustedRiskScore += divergences.length * 15;
    
    // Determine final risk level
    let finalRisk: 'low' | 'medium' | 'high' | 'extreme';
    if (adjustedRiskScore > 80) finalRisk = 'extreme';
    else if (adjustedRiskScore > 60) finalRisk = 'high';
    else if (adjustedRiskScore > 30) finalRisk = 'medium';
    else finalRisk = 'low';
    
    return {
      ...baseRisk,
      overallRisk: finalRisk
    };
  }

  /**
   * Get current timeframe weights
   */
  public getTimeframeWeights(): Map<string, TimeframeWeight> {
    return new Map(this.timeframeWeights);
  }

  /**
   * Get timeframe in minutes
   */
  private getTimeframeMinutes(timeframe: string): number {
    const match = timeframe.match(/(\d+)([mh])/i);
    if (!match) return 1;
    
    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    
    return unit === 'h' ? value * 60 : value;
  }
}