/**
 * Signal Generation for Technical Analysis
 * Combines multiple indicators to generate buy/sell signals with confidence scores
 */

import { TechnicalIndicators } from './TechnicalIndicators';
import { MomentumAnalyzer } from './MomentumAnalyzer';
import { OHLCVData, TechnicalSignal, AnalysisOptions } from './types';
import { TechnicalIndicators as TechnicalIndicatorsInterface, MomentumAnalysis } from '../../types/analysis';

export interface SignalWeights {
  rsi: number;
  macd: number;
  bollinger: number;
  ema: number;
  momentum: number;
  volume: number;
  supportResistance: number;
}

export interface SignalResult {
  signals: TechnicalSignal[];
  overallSignal: 'strong_buy' | 'buy' | 'neutral' | 'sell' | 'strong_sell';
  confidence: number;
  score: number; // -100 to 100 (-100 = strong sell, 100 = strong buy)
  reasoning: string[];
  alerts: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'extreme';
}

export class SignalGenerator {
  private technicalIndicators: TechnicalIndicators;
  private momentumAnalyzer: MomentumAnalyzer;
  private weights: SignalWeights;
  private options: AnalysisOptions;

  constructor(
    options?: Partial<AnalysisOptions>,
    weights?: Partial<SignalWeights>
  ) {
    this.technicalIndicators = new TechnicalIndicators(options?.indicators);
    this.momentumAnalyzer = new MomentumAnalyzer();
    
    this.weights = {
      rsi: 0.15,
      macd: 0.20,
      bollinger: 0.15,
      ema: 0.20,
      momentum: 0.15,
      volume: 0.10,
      supportResistance: 0.05,
      ...weights
    };

    this.options = {
      timeframes: ['1m', '5m', '15m', '1h'],
      indicators: options?.indicators || {
        rsi: { period: 14, overbought: 70, oversold: 30 },
        macd: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
        bollinger: { period: 20, stdDev: 2 },
        ema: { periods: [9, 21, 50] },
        volume: { smaLookback: 20, spikeThreshold: 2.0 }
      },
      minDataPoints: 50,
      confidenceThreshold: 60,
      riskAdjustment: true,
      memecoinsOptimized: true,
      ...options
    };
  }

  /**
   * Generate comprehensive trading signals
   */
  public generateSignals(data: OHLCVData[], previousData?: OHLCVData[]): SignalResult {
    if (data.length < this.options.minDataPoints) {
      return this.getInsufficientDataResult();
    }

    const indicators = this.technicalIndicators.calculateAll(data);
    const momentum = this.momentumAnalyzer.analyzeMomentum(data);
    
    const signals = this.generateIndividualSignals(data, indicators, momentum, previousData);
    const overallScore = this.calculateOverallScore(signals);
    const confidence = this.calculateConfidence(signals, data);
    const overallSignal = this.determineOverallSignal(overallScore, confidence);
    
    const reasoning = this.generateReasoning(signals, indicators, momentum);
    const alerts = this.generateAlerts(signals, indicators, momentum, data);
    const riskLevel = this.assessRiskLevel(data, momentum, confidence);

    return {
      signals,
      overallSignal,
      confidence,
      score: overallScore,
      reasoning,
      alerts,
      riskLevel
    };
  }

  /**
   * Generate individual signals from each indicator
   */
  private generateIndividualSignals(
    data: OHLCVData[],
    indicators: TechnicalIndicatorsInterface,
    momentum: MomentumAnalysis,
    previousData?: OHLCVData[]
  ): TechnicalSignal[] {
    const signals: TechnicalSignal[] = [];
    const currentPrice = data[data.length - 1].close;
    const timestamp = data[data.length - 1].timestamp;

    // RSI Signals
    signals.push(this.generateRSISignal(indicators.rsi, currentPrice, timestamp));

    // MACD Signals
    if (previousData && previousData.length > 0) {
      const previousIndicators = this.technicalIndicators.calculateAll(previousData);
      signals.push(this.generateMACDSignal(indicators.macd, previousIndicators.macd, currentPrice, timestamp));
    }

    // Bollinger Bands Signals
    signals.push(this.generateBollingerSignal(indicators.bollinger, currentPrice, timestamp));

    // EMA Signals
    signals.push(this.generateEMASignal(indicators.ema, currentPrice, timestamp));

    // Momentum Signals
    signals.push(this.generateMomentumSignal(momentum, currentPrice, timestamp));

    // Volume Signals
    signals.push(this.generateVolumeSignal(data, currentPrice, timestamp));

    // Support/Resistance Signals
    signals.push(this.generateSupportResistanceSignal(momentum, currentPrice, timestamp));

    return signals.filter(signal => signal.type !== 'neutral' || signal.strength > 20);
  }

  /**
   * Generate RSI signal
   */
  private generateRSISignal(rsi: number, price: number, timestamp: number): TechnicalSignal {
    let type: 'buy' | 'sell' | 'neutral' = 'neutral';
    let strength = 0;
    let confidence = 70;
    let reasoning = '';

    if (this.technicalIndicators.isOversold(rsi)) {
      type = 'buy';
      strength = Math.min(100, (30 - rsi) * 3); // Stronger signal the more oversold
      reasoning = `RSI oversold at ${rsi.toFixed(2)} - potential bounce opportunity`;
    } else if (this.technicalIndicators.isOverbought(rsi)) {
      type = 'sell';
      strength = Math.min(100, (rsi - 70) * 3); // Stronger signal the more overbought
      reasoning = `RSI overbought at ${rsi.toFixed(2)} - potential pullback expected`;
    } else {
      strength = Math.abs(rsi - 50) * 2; // Neutral strength based on distance from midline
      reasoning = `RSI neutral at ${rsi.toFixed(2)}`;
    }

    return {
      type,
      strength,
      confidence,
      source: 'RSI',
      timestamp,
      price,
      reasoning
    };
  }

  /**
   * Generate MACD signal
   */
  private generateMACDSignal(
    currentMACD: { macd: number; signal: number; histogram: number },
    previousMACD: { macd: number; signal: number; histogram: number },
    price: number,
    timestamp: number
  ): TechnicalSignal {
    let type: 'buy' | 'sell' | 'neutral' = 'neutral';
    let strength = 0;
    let confidence = 75;
    let reasoning = '';

    if (this.technicalIndicators.isMACDBullishCrossover(currentMACD, previousMACD)) {
      type = 'buy';
      strength = 80;
      reasoning = 'MACD bullish crossover - momentum turning positive';
    } else if (this.technicalIndicators.isMACDBearishCrossover(currentMACD, previousMACD)) {
      type = 'sell';
      strength = 80;
      reasoning = 'MACD bearish crossover - momentum turning negative';
    } else if (currentMACD.macd > currentMACD.signal) {
      type = 'buy';
      strength = Math.min(70, Math.abs(currentMACD.histogram) * 100);
      reasoning = 'MACD above signal line - bullish momentum';
    } else if (currentMACD.macd < currentMACD.signal) {
      type = 'sell';
      strength = Math.min(70, Math.abs(currentMACD.histogram) * 100);
      reasoning = 'MACD below signal line - bearish momentum';
    }

    return {
      type,
      strength,
      confidence,
      source: 'MACD',
      timestamp,
      price,
      reasoning
    };
  }

  /**
   * Generate Bollinger Bands signal
   */
  private generateBollingerSignal(
    bollinger: { upper: number; middle: number; lower: number; position: number },
    price: number,
    timestamp: number
  ): TechnicalSignal {
    let type: 'buy' | 'sell' | 'neutral' = 'neutral';
    let strength = 0;
    let confidence = 65;
    let reasoning = '';

    const breakouts = this.technicalIndicators.isBollingerBreakout(bollinger);

    if (breakouts.lower) {
      type = 'buy';
      strength = 75;
      reasoning = 'Price breaking below lower Bollinger Band - oversold bounce expected';
    } else if (breakouts.upper && this.options.memecoinsOptimized) {
      // For memecoins, upper band breakout can be continuation rather than reversal
      type = 'buy';
      strength = 60;
      reasoning = 'Price breaking above upper Bollinger Band - potential momentum continuation';
    } else if (breakouts.upper) {
      type = 'sell';
      strength = 70;
      reasoning = 'Price breaking above upper Bollinger Band - overbought';
    } else if (bollinger.position < 0.2) {
      type = 'buy';
      strength = 50;
      reasoning = 'Price near lower Bollinger Band - potential support';
    } else if (bollinger.position > 0.8) {
      type = 'sell';
      strength = 50;
      reasoning = 'Price near upper Bollinger Band - potential resistance';
    }

    return {
      type,
      strength,
      confidence,
      source: 'Bollinger Bands',
      timestamp,
      price,
      reasoning
    };
  }

  /**
   * Generate EMA signal
   */
  private generateEMASignal(emas: Record<string, number>, price: number, timestamp: number): TechnicalSignal {
    const alignment = this.technicalIndicators.analyzeEMAAlignment(emas);
    
    let type: 'buy' | 'sell' | 'neutral' = 'neutral';
    let strength = 0;
    let confidence = 70;
    let reasoning = '';

    if (alignment.bullish) {
      type = 'buy';
      strength = Math.min(90, alignment.strength);
      reasoning = 'EMAs bullishly aligned - strong uptrend';
    } else if (alignment.bearish) {
      type = 'sell';
      strength = Math.min(90, alignment.strength);
      reasoning = 'EMAs bearishly aligned - strong downtrend';
    } else {
      // Check if price is above/below key EMAs
      const ema21 = emas['21'];
      const ema50 = emas['50'];
      
      if (ema21 && price > ema21) {
        type = 'buy';
        strength = 40;
        reasoning = 'Price above EMA21 - short-term bullish';
      } else if (ema21 && price < ema21) {
        type = 'sell';
        strength = 40;
        reasoning = 'Price below EMA21 - short-term bearish';
      }
    }

    return {
      type,
      strength,
      confidence,
      source: 'EMA',
      timestamp,
      price,
      reasoning
    };
  }

  /**
   * Generate momentum signal
   */
  private generateMomentumSignal(momentum: MomentumAnalysis, price: number, timestamp: number): TechnicalSignal {
    let type: 'buy' | 'sell' | 'neutral' = 'neutral';
    let strength = Math.min(100, momentum.strength);
    let confidence = 70;
    let reasoning = '';

    if (momentum.trend === 'bullish') {
      type = 'buy';
      reasoning = `Strong bullish momentum (${momentum.strength.toFixed(0)}%) with ${momentum.momentum.toFixed(2)}% rate of change`;
    } else if (momentum.trend === 'bearish') {
      type = 'sell';
      reasoning = `Strong bearish momentum (${momentum.strength.toFixed(0)}%) with ${momentum.momentum.toFixed(2)}% rate of change`;
    } else {
      reasoning = 'Neutral momentum - sideways action';
      strength = 20;
    }

    // Boost confidence for strong momentum with reversal signals
    if (momentum.priceAction.reversalSignal) {
      confidence += 10;
      reasoning += ' - reversal signal detected';
    }

    return {
      type,
      strength,
      confidence,
      source: 'Momentum',
      timestamp,
      price,
      reasoning
    };
  }

  /**
   * Generate volume signal
   */
  private generateVolumeSignal(data: OHLCVData[], price: number, timestamp: number): TechnicalSignal {
    if (data.length < 10) {
      return { type: 'neutral', strength: 0, confidence: 0, source: 'Volume', timestamp, price, reasoning: 'Insufficient volume data' };
    }

    const volumes = data.map(d => d.volume);
    const currentVolume = volumes[volumes.length - 1];
    const avgVolume = volumes.slice(-10).reduce((sum, vol) => sum + vol, 0) / Math.min(10, volumes.length);
    
    const volumeRatio = currentVolume / avgVolume;
    const priceChange = data.length > 1 ? (data[data.length - 1].close - data[data.length - 2].close) / data[data.length - 2].close : 0;

    let type: 'buy' | 'sell' | 'neutral' = 'neutral';
    let strength = 0;
    let confidence = 60;
    let reasoning = '';

    if (volumeRatio > 2 && priceChange > 0) {
      type = 'buy';
      strength = Math.min(90, volumeRatio * 20);
      reasoning = `High volume (${volumeRatio.toFixed(1)}x avg) with price increase - strong buying interest`;
    } else if (volumeRatio > 2 && priceChange < 0) {
      type = 'sell';
      strength = Math.min(90, volumeRatio * 20);
      reasoning = `High volume (${volumeRatio.toFixed(1)}x avg) with price decrease - strong selling pressure`;
    } else if (volumeRatio < 0.5) {
      strength = 30;
      reasoning = `Low volume (${volumeRatio.toFixed(1)}x avg) - lack of conviction`;
    }

    return {
      type,
      strength,
      confidence,
      source: 'Volume',
      timestamp,
      price,
      reasoning
    };
  }

  /**
   * Generate support/resistance signal
   */
  private generateSupportResistanceSignal(momentum: MomentumAnalysis, price: number, timestamp: number): TechnicalSignal {
    let type: 'buy' | 'sell' | 'neutral' = 'neutral';
    let strength = 0;
    let confidence = 50;
    let reasoning = '';

    // Check proximity to support levels
    for (const supportLevel of momentum.support) {
      const distance = Math.abs(price - supportLevel) / price;
      if (distance < 0.02) { // Within 2%
        type = 'buy';
        strength = 60;
        reasoning = `Price near key support at ${supportLevel.toFixed(6)}`;
        break;
      }
    }

    // Check proximity to resistance levels
    for (const resistanceLevel of momentum.resistance) {
      const distance = Math.abs(price - resistanceLevel) / price;
      if (distance < 0.02) { // Within 2%
        if (momentum.priceAction.breakoutPotential > 70) {
          type = 'buy';
          strength = 70;
          reasoning = `Price approaching resistance at ${resistanceLevel.toFixed(6)} with high breakout potential`;
        } else {
          type = 'sell';
          strength = 60;
          reasoning = `Price near key resistance at ${resistanceLevel.toFixed(6)}`;
        }
        break;
      }
    }

    return {
      type,
      strength,
      confidence,
      source: 'Support/Resistance',
      timestamp,
      price,
      reasoning
    };
  }

  /**
   * Calculate overall score from individual signals
   */
  private calculateOverallScore(signals: TechnicalSignal[]): number {
    let totalScore = 0;
    let totalWeight = 0;

    for (const signal of signals) {
      const weight = this.getSignalWeight(signal.source);
      const signalScore = signal.type === 'buy' ? signal.strength : 
                         signal.type === 'sell' ? -signal.strength : 0;
      
      totalScore += signalScore * weight * (signal.confidence / 100);
      totalWeight += weight;
    }

    return totalWeight > 0 ? totalScore / totalWeight : 0;
  }

  /**
   * Get weight for a signal source
   */
  private getSignalWeight(source: string): number {
    switch (source) {
      case 'RSI': return this.weights.rsi;
      case 'MACD': return this.weights.macd;
      case 'Bollinger Bands': return this.weights.bollinger;
      case 'EMA': return this.weights.ema;
      case 'Momentum': return this.weights.momentum;
      case 'Volume': return this.weights.volume;
      case 'Support/Resistance': return this.weights.supportResistance;
      default: return 0.1;
    }
  }

  /**
   * Calculate confidence in the overall signal
   */
  private calculateConfidence(signals: TechnicalSignal[], data: OHLCVData[]): number {
    const avgConfidence = signals.reduce((sum, signal) => sum + signal.confidence, 0) / signals.length;
    
    // Adjust confidence based on data quality and signal agreement
    const signalAgreement = this.calculateSignalAgreement(signals);
    const dataQuality = Math.min(100, (data.length / this.options.minDataPoints) * 100);
    
    const baseConfidence = (avgConfidence * 0.6 + signalAgreement * 0.3 + dataQuality * 0.1);
    
    // Reduce confidence for conflicting signals
    const conflictPenalty = this.calculateConflictPenalty(signals);
    
    return Math.max(0, Math.min(100, baseConfidence - conflictPenalty));
  }

  /**
   * Calculate how well signals agree with each other
   */
  private calculateSignalAgreement(signals: TechnicalSignal[]): number {
    const buySignals = signals.filter(s => s.type === 'buy').length;
    const sellSignals = signals.filter(s => s.type === 'sell').length;
    const totalSignals = buySignals + sellSignals;

    if (totalSignals === 0) return 50;

    const agreement = Math.abs(buySignals - sellSignals) / totalSignals;
    return agreement * 100;
  }

  /**
   * Calculate penalty for conflicting signals
   */
  private calculateConflictPenalty(signals: TechnicalSignal[]): number {
    const strongBuySignals = signals.filter(s => s.type === 'buy' && s.strength > 70).length;
    const strongSellSignals = signals.filter(s => s.type === 'sell' && s.strength > 70).length;

    if (strongBuySignals > 0 && strongSellSignals > 0) {
      return 30; // High penalty for strong conflicting signals
    } else if (signals.filter(s => s.type === 'buy').length > 0 && signals.filter(s => s.type === 'sell').length > 0) {
      return 15; // Moderate penalty for mixed signals
    }

    return 0;
  }

  /**
   * Determine overall signal from score and confidence
   */
  private determineOverallSignal(score: number, confidence: number): 'strong_buy' | 'buy' | 'neutral' | 'sell' | 'strong_sell' {
    if (confidence < this.options.confidenceThreshold) {
      return 'neutral';
    }

    if (score > 70) return 'strong_buy';
    if (score > 30) return 'buy';
    if (score < -70) return 'strong_sell';
    if (score < -30) return 'sell';
    return 'neutral';
  }

  /**
   * Generate reasoning for the overall signal
   */
  private generateReasoning(signals: TechnicalSignal[], indicators: TechnicalIndicatorsInterface, momentum: MomentumAnalysis): string[] {
    const reasoning: string[] = [];

    // Add strongest signals to reasoning
    const strongSignals = signals.filter(s => s.strength > 60).sort((a, b) => b.strength - a.strength);
    strongSignals.slice(0, 3).forEach(signal => {
      reasoning.push(signal.reasoning);
    });

    // Add key indicator levels
    reasoning.push(
      `RSI: ${indicators.rsi.toFixed(2)}, MACD: ${indicators.macd.macd.toFixed(4)}, BB Position: ${(indicators.bollinger.position * 100).toFixed(1)}%`
    );

    // Add momentum summary
    reasoning.push(
      `${momentum.trend.charAt(0).toUpperCase() + momentum.trend.slice(1)} momentum with ${momentum.strength.toFixed(0)}% strength`
    );

    return reasoning;
  }

  /**
   * Generate alerts for significant conditions
   */
  private generateAlerts(signals: TechnicalSignal[], indicators: TechnicalIndicatorsInterface, momentum: MomentumAnalysis, data: OHLCVData[]): string[] {
    const alerts: string[] = [];

    // RSI extreme levels
    if (indicators.rsi > 85) alerts.push('RSI extremely overbought (>85)');
    if (indicators.rsi < 15) alerts.push('RSI extremely oversold (<15)');

    // High volatility alert
    if (momentum.volatility > 50) alerts.push(`High volatility detected (${momentum.volatility.toFixed(1)}%)`);

    // Breakout potential alert
    if (momentum.priceAction.breakoutPotential > 80) alerts.push('High breakout potential detected');

    // Reversal signal alert
    if (momentum.priceAction.reversalSignal) alerts.push('Potential reversal pattern identified');

    // Volume spike alert
    if (data.length > 10) {
      const currentVolume = data[data.length - 1].volume;
      const avgVolume = data.slice(-10).reduce((sum, d) => sum + d.volume, 0) / 10;
      if (currentVolume > avgVolume * 3) {
        alerts.push(`Unusual volume spike detected (${(currentVolume / avgVolume).toFixed(1)}x average)`);
      }
    }

    return alerts;
  }

  /**
   * Assess risk level based on analysis
   */
  private assessRiskLevel(data: OHLCVData[], momentum: MomentumAnalysis, confidence: number): 'low' | 'medium' | 'high' | 'extreme' {
    let riskScore = 0;

    // Volatility risk
    if (momentum.volatility > 50) riskScore += 30;
    else if (momentum.volatility > 30) riskScore += 20;
    else if (momentum.volatility > 15) riskScore += 10;

    // Confidence risk (lower confidence = higher risk)
    riskScore += (100 - confidence) * 0.3;

    // Data quality risk
    if (data.length < this.options.minDataPoints) riskScore += 20;

    // Reversal signal risk
    if (momentum.priceAction.reversalSignal) riskScore += 15;

    if (riskScore > 75) return 'extreme';
    if (riskScore > 50) return 'high';
    if (riskScore > 25) return 'medium';
    return 'low';
  }

  /**
   * Get default result for insufficient data
   */
  private getInsufficientDataResult(): SignalResult {
    return {
      signals: [],
      overallSignal: 'neutral',
      confidence: 0,
      score: 0,
      reasoning: ['Insufficient data for technical analysis'],
      alerts: ['Minimum data requirement not met'],
      riskLevel: 'extreme'
    };
  }

  /**
   * Update signal weights
   */
  public updateWeights(newWeights: Partial<SignalWeights>): void {
    this.weights = { ...this.weights, ...newWeights };
  }

  /**
   * Get current weights
   */
  public getWeights(): SignalWeights {
    return { ...this.weights };
  }
}