/**
 * Momentum Analysis Implementation
 * Specialized for memecoin momentum detection and trend analysis
 */

import { OHLCVData, MomentumMetrics, SupportResistanceLevel } from './types';
import { MomentumAnalysis } from '../../types/analysis';

export class MomentumAnalyzer {
  private rocPeriods: number[];
  private trendPeriods: number[];
  private volatilityPeriod: number;
  private supportResistanceTouchThreshold: number;

  constructor(config?: {
    rocPeriods?: number[];
    trendPeriods?: number[];
    volatilityPeriod?: number;
    supportResistanceTouchThreshold?: number;
  }) {
    this.rocPeriods = config?.rocPeriods || [1, 3, 5, 10];
    this.trendPeriods = config?.trendPeriods || [5, 10, 20];
    this.volatilityPeriod = config?.volatilityPeriod || 20;
    this.supportResistanceTouchThreshold = config?.supportResistanceTouchThreshold || 0.02; // 2%
  }

  /**
   * Perform comprehensive momentum analysis
   */
  public analyzeMomentum(data: OHLCVData[]): MomentumAnalysis {
    if (data.length < 10) {
      return this.getDefaultAnalysis();
    }

    const closes = data.map(d => d.close);
    const highs = data.map(d => d.high);
    const lows = data.map(d => d.low);
    const volumes = data.map(d => d.volume);

    const momentum = this.calculateMomentumMetrics(closes, volumes);
    const trend = this.determineTrend(closes);
    const strength = this.calculateTrendStrength(closes, momentum);
    const volatility = this.calculateVolatility(closes);
    const supportResistance = this.findSupportResistanceLevels(highs, lows, closes, volumes);

    return {
      trend,
      strength,
      momentum: momentum.momentum,
      volatility,
      support: supportResistance.support.map(sr => sr.price),
      resistance: supportResistance.resistance.map(sr => sr.price),
      priceAction: {
        breakoutPotential: this.calculateBreakoutPotential(data, supportResistance),
        consolidation: this.isConsolidating(closes, volatility),
        reversalSignal: this.detectReversalSignal(data, momentum)
      }
    };
  }

  /**
   * Calculate comprehensive momentum metrics
   */
  public calculateMomentumMetrics(closes: number[], volumes: number[]): MomentumMetrics {
    const currentPrice = closes[closes.length - 1];
    
    // Rate of Change calculations
    const rocs = this.rocPeriods.map(period => this.calculateROC(closes, period));
    const avgROC = rocs.reduce((sum, roc) => sum + roc, 0) / rocs.length;

    // Momentum calculation (price momentum + volume momentum)
    const momentum = this.calculatePriceMomentum(closes) + this.calculateVolumeMomentum(volumes);

    // Acceleration (rate of change of momentum)
    const acceleration = this.calculateAcceleration(closes);

    // Velocity (average rate of change)
    const velocity = this.calculateVelocity(closes);

    // Trend strength and direction
    const trendAnalysis = this.analyzeTrendMetrics(closes);

    return {
      roc: avgROC,
      momentum,
      acceleration,
      velocity,
      trendStrength: trendAnalysis.strength,
      trendDirection: trendAnalysis.direction
    };
  }

  /**
   * Calculate Rate of Change (ROC)
   */
  private calculateROC(closes: number[], period: number): number {
    if (closes.length < period + 1) return 0;

    const current = closes[closes.length - 1];
    const previous = closes[closes.length - 1 - period];

    return ((current - previous) / previous) * 100;
  }

  /**
   * Calculate price momentum using multiple timeframes
   */
  private calculatePriceMomentum(closes: number[]): number {
    let totalMomentum = 0;
    let weightSum = 0;

    for (const period of this.trendPeriods) {
      if (closes.length > period) {
        const weight = 1 / period; // Shorter periods get higher weight
        const momentum = this.calculateROC(closes, period);
        totalMomentum += momentum * weight;
        weightSum += weight;
      }
    }

    return weightSum > 0 ? totalMomentum / weightSum : 0;
  }

  /**
   * Calculate volume momentum
   */
  private calculateVolumeMomentum(volumes: number[]): number {
    if (volumes.length < 10) return 0;

    const recentVolumes = volumes.slice(-5);
    const historicalVolumes = volumes.slice(-20, -5);

    const recentAvg = recentVolumes.reduce((sum, vol) => sum + vol, 0) / recentVolumes.length;
    const historicalAvg = historicalVolumes.reduce((sum, vol) => sum + vol, 0) / historicalVolumes.length;

    return historicalAvg > 0 ? ((recentAvg - historicalAvg) / historicalAvg) * 100 : 0;
  }

  /**
   * Calculate acceleration (second derivative of price)
   */
  private calculateAcceleration(closes: number[]): number {
    if (closes.length < 3) return 0;

    const velocities: number[] = [];
    for (let i = 1; i < closes.length; i++) {
      const velocity = (closes[i] - closes[i - 1]) / closes[i - 1];
      velocities.push(velocity);
    }

    if (velocities.length < 2) return 0;

    const recentVelocity = velocities[velocities.length - 1];
    const previousVelocity = velocities[velocities.length - 2];

    return recentVelocity - previousVelocity;
  }

  /**
   * Calculate velocity (first derivative of price)
   */
  private calculateVelocity(closes: number[]): number {
    if (closes.length < 5) return 0;

    const velocities: number[] = [];
    for (let i = 1; i < closes.length; i++) {
      const velocity = (closes[i] - closes[i - 1]) / closes[i - 1];
      velocities.push(velocity);
    }

    const recentVelocities = velocities.slice(-5);
    return recentVelocities.reduce((sum, vel) => sum + vel, 0) / recentVelocities.length;
  }

  /**
   * Analyze trend metrics
   */
  private analyzeTrendMetrics(closes: number[]): { strength: number; direction: 1 | 0 | -1 } {
    if (closes.length < 10) return { strength: 0, direction: 0 };

    let upMoves = 0;
    let downMoves = 0;
    let totalMoves = 0;

    // Analyze price movements
    for (let i = 1; i < closes.length; i++) {
      const change = closes[i] - closes[i - 1];
      if (change > 0) upMoves++;
      else if (change < 0) downMoves++;
      totalMoves++;
    }

    // Calculate trend direction
    const upRatio = upMoves / totalMoves;
    let direction: 1 | 0 | -1 = 0;

    if (upRatio > 0.6) direction = 1;
    else if (upRatio < 0.4) direction = -1;

    // Calculate trend strength based on consistency and magnitude
    const consistency = Math.abs(upRatio - 0.5) * 2; // 0-1
    const magnitude = this.calculatePriceMagnitude(closes);
    const strength = (consistency * 0.6 + magnitude * 0.4) * 100;

    return { strength: Math.min(100, strength), direction };
  }

  /**
   * Calculate price magnitude for trend strength
   */
  private calculatePriceMagnitude(closes: number[]): number {
    if (closes.length < 2) return 0;

    const totalChange = Math.abs(closes[closes.length - 1] - closes[0]) / closes[0];
    return Math.min(1, totalChange * 5); // Normalize to 0-1
  }

  /**
   * Determine overall trend
   */
  private determineTrend(closes: number[]): 'bullish' | 'bearish' | 'neutral' {
    if (closes.length < 10) return 'neutral';

    const shortTermROC = this.calculateROC(closes, 5);
    const mediumTermROC = this.calculateROC(closes, 10);
    const longTermROC = this.calculateROC(closes, 20);

    const avgROC = (shortTermROC * 0.5 + mediumTermROC * 0.3 + longTermROC * 0.2);

    if (avgROC > 5) return 'bullish';
    if (avgROC < -5) return 'bearish';
    return 'neutral';
  }

  /**
   * Calculate trend strength
   */
  private calculateTrendStrength(closes: number[], momentum: MomentumMetrics): number {
    const roc = Math.abs(momentum.roc);
    const consistency = this.calculateTrendConsistency(closes);
    const volume = Math.abs(momentum.momentum);

    // Weighted combination of factors
    const strength = (roc * 0.4 + consistency * 0.4 + volume * 0.2);
    return Math.min(100, strength);
  }

  /**
   * Calculate trend consistency
   */
  private calculateTrendConsistency(closes: number[]): number {
    if (closes.length < 5) return 0;

    const changes = [];
    for (let i = 1; i < closes.length; i++) {
      changes.push(closes[i] - closes[i - 1]);
    }

    const positiveChanges = changes.filter(c => c > 0).length;
    const negativeChanges = changes.filter(c => c < 0).length;
    const totalChanges = changes.length;

    const consistency = Math.abs(positiveChanges - negativeChanges) / totalChanges;
    return consistency * 100;
  }

  /**
   * Calculate volatility
   */
  private calculateVolatility(closes: number[]): number {
    if (closes.length < this.volatilityPeriod) return 0;

    const recentCloses = closes.slice(-this.volatilityPeriod);
    const mean = recentCloses.reduce((sum, close) => sum + close, 0) / recentCloses.length;

    const variance = recentCloses.reduce((sum, close) => sum + Math.pow(close - mean, 2), 0) / recentCloses.length;
    const standardDeviation = Math.sqrt(variance);

    return (standardDeviation / mean) * 100; // Coefficient of variation as percentage
  }

  /**
   * Find support and resistance levels
   */
  private findSupportResistanceLevels(
    highs: number[],
    lows: number[],
    closes: number[],
    volumes: number[]
  ): { support: SupportResistanceLevel[]; resistance: SupportResistanceLevel[] } {
    const support: SupportResistanceLevel[] = [];
    const resistance: SupportResistanceLevel[] = [];

    // Find local peaks and troughs
    const peaks = this.findPeaks(highs);
    const troughs = this.findTroughs(lows);

    // Process resistance levels from peaks
    for (const peak of peaks) {
      const level = this.createSupportResistanceLevel(
        highs[peak.index],
        'resistance',
        peak.index,
        highs,
        lows,
        volumes
      );
      if (level) resistance.push(level);
    }

    // Process support levels from troughs
    for (const trough of troughs) {
      const level = this.createSupportResistanceLevel(
        lows[trough.index],
        'support',
        trough.index,
        highs,
        lows,
        volumes
      );
      if (level) support.push(level);
    }

    // Sort by strength and take top levels
    support.sort((a, b) => b.strength - a.strength);
    resistance.sort((a, b) => b.strength - a.strength);

    return {
      support: support.slice(0, 5),
      resistance: resistance.slice(0, 5)
    };
  }

  /**
   * Find peaks in price data
   */
  private findPeaks(values: number[]): { index: number; value: number }[] {
    const peaks: { index: number; value: number }[] = [];
    const lookback = 3;

    for (let i = lookback; i < values.length - lookback; i++) {
      let isPeak = true;

      // Check if current point is higher than surrounding points
      for (let j = i - lookback; j <= i + lookback; j++) {
        if (j !== i && values[j] >= values[i]) {
          isPeak = false;
          break;
        }
      }

      if (isPeak) {
        peaks.push({ index: i, value: values[i] });
      }
    }

    return peaks;
  }

  /**
   * Find troughs in price data
   */
  private findTroughs(values: number[]): { index: number; value: number }[] {
    const troughs: { index: number; value: number }[] = [];
    const lookback = 3;

    for (let i = lookback; i < values.length - lookback; i++) {
      let isTrough = true;

      // Check if current point is lower than surrounding points
      for (let j = i - lookback; j <= i + lookback; j++) {
        if (j !== i && values[j] <= values[i]) {
          isTrough = false;
          break;
        }
      }

      if (isTrough) {
        troughs.push({ index: i, value: values[i] });
      }
    }

    return troughs;
  }

  /**
   * Create support/resistance level with strength calculation
   */
  private createSupportResistanceLevel(
    price: number,
    type: 'support' | 'resistance',
    originalIndex: number,
    highs: number[],
    lows: number[],
    volumes: number[]
  ): SupportResistanceLevel | null {
    let touches = 1;
    let totalVolume = volumes[originalIndex] || 0;
    const recentIndex = Math.max(0, highs.length - 20); // Recent 20 periods

    // Count touches within threshold
    const values = type === 'resistance' ? highs : lows;
    for (let i = 0; i < values.length; i++) {
      if (i === originalIndex) continue;

      const priceDistance = Math.abs(values[i] - price) / price;
      if (priceDistance <= this.supportResistanceTouchThreshold) {
        touches++;
        totalVolume += volumes[i] || 0;
      }
    }

    // Calculate confidence based on touches, volume, and recency
    const touchStrength = Math.min(touches / 3, 1) * 40; // Max 40 points for touches
    const volumeStrength = Math.min(totalVolume / (volumes.reduce((sum, vol) => sum + vol, 0) / volumes.length), 3) * 20; // Max 20 points for volume
    const recencyBonus = originalIndex >= recentIndex ? 20 : 0; // 20 points for recent levels
    const baseStrength = 20; // Base 20 points

    const strength = touchStrength + volumeStrength + recencyBonus + baseStrength;
    const confidence = Math.min(100, strength);

    if (touches < 2 || confidence < 30) return null;

    return {
      price,
      strength,
      type,
      touches,
      volume: totalVolume,
      confidence,
      recent: originalIndex >= recentIndex
    };
  }

  /**
   * Calculate breakout potential
   */
  private calculateBreakoutPotential(data: OHLCVData[], sr: { support: SupportResistanceLevel[]; resistance: SupportResistanceLevel[] }): number {
    if (data.length === 0) return 0;

    const currentPrice = data[data.length - 1].close;
    const currentVolume = data[data.length - 1].volume;
    const avgVolume = data.slice(-10).reduce((sum, d) => sum + d.volume, 0) / Math.min(10, data.length);

    let breakoutScore = 0;

    // Check proximity to key levels
    const allLevels = [...sr.support, ...sr.resistance];
    if (allLevels.length === 0) {
      return { score: breakoutScore, factors: [] };
    }

    const nearestLevel = allLevels.reduce((nearest, level) => {
      const distance = Math.abs(currentPrice - level.price) / currentPrice;
      return distance < Math.abs(currentPrice - nearest.price) / currentPrice ? level : nearest;
    }, allLevels[0]);

    if (nearestLevel) {
      const distanceToLevel = Math.abs(currentPrice - nearestLevel.price) / currentPrice;
      
      if (distanceToLevel < 0.05) { // Within 5% of key level
        breakoutScore += 30;
        
        // Volume confirmation
        if (currentVolume > avgVolume * 1.5) {
          breakoutScore += 30;
        }
        
        // Level strength bonus
        breakoutScore += (nearestLevel.strength / 100) * 20;
      }
    }

    // Consolidation bonus
    const volatility = this.calculateVolatility(data.map(d => d.close));
    if (volatility < 10) { // Low volatility suggests consolidation
      breakoutScore += 20;
    }

    return Math.min(100, breakoutScore);
  }

  /**
   * Check if price is consolidating
   */
  private isConsolidating(closes: number[], volatility: number): boolean {
    if (closes.length < 10) return false;

    // Low volatility + tight price range = consolidation
    const recentCloses = closes.slice(-10);
    const highestClose = Math.max(...recentCloses);
    const lowestClose = Math.min(...recentCloses);
    const priceRange = (highestClose - lowestClose) / lowestClose;

    return volatility < 15 && priceRange < 0.1; // Less than 15% volatility and 10% price range
  }

  /**
   * Detect reversal signals
   */
  private detectReversalSignal(data: OHLCVData[], momentum: MomentumMetrics): boolean {
    if (data.length < 5) return false;

    const closes = data.map(d => d.close);
    const volumes = data.map(d => d.volume);

    // Momentum divergence
    const priceChange = (closes[closes.length - 1] - closes[closes.length - 5]) / closes[closes.length - 5];
    const momentumChange = momentum.momentum;

    // Price making new highs/lows while momentum doesn't confirm
    const divergence = (priceChange > 0 && momentumChange < 0) || (priceChange < 0 && momentumChange > 0);

    // Volume spike confirmation
    const avgVolume = volumes.slice(-10).reduce((sum, vol) => sum + vol, 0) / Math.min(10, volumes.length);
    const currentVolume = volumes[volumes.length - 1];
    const volumeSpike = currentVolume > avgVolume * 2;

    return divergence && volumeSpike;
  }

  /**
   * Get default analysis for insufficient data
   */
  private getDefaultAnalysis(): MomentumAnalysis {
    return {
      trend: 'neutral',
      strength: 0,
      momentum: 0,
      volatility: 0,
      support: [],
      resistance: [],
      priceAction: {
        breakoutPotential: 0,
        consolidation: false,
        reversalSignal: false
      }
    };
  }
}