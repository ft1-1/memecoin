import { OHLCV } from '../../data/api/solana-tracker/types';

/**
 * Represents the fatigue level of momentum
 */
export type MomentumFatigueLevel = 'none' | 'mild' | 'moderate' | 'severe';

/**
 * Core momentum acceleration data
 */
export interface MomentumAcceleration {
  /** Price velocity (% change per hour) */
  velocity1h: number;
  velocity4h: number;
  
  /** Price acceleration (change in velocity) */
  acceleration1h: number;
  acceleration4h: number;
  
  /** Consecutive directional candles */
  consecutiveCandles: {
    count: number;
    direction: 'bullish' | 'bearish' | 'neutral';
    weightedStrength: number;
  };
  
  /** Overall sustainability score (0-100) */
  sustainabilityScore: number;
  
  /** Momentum fatigue level */
  fatigueLevel: MomentumFatigueLevel;
  
  /** Signal strength for entry timing */
  entrySignalStrength: number; // 0-100
}

/**
 * Detailed momentum calculation metrics
 */
export interface MomentumMetrics {
  /** Raw price changes */
  priceChanges: {
    period1h: number;
    period4h: number;
    period12h: number;
  };
  
  /** Velocity calculations */
  velocityMetrics: {
    current1h: number;
    previous1h: number;
    current4h: number;
    previous4h: number;
    normalizedVelocity: number;
  };
  
  /** Acceleration metrics */
  accelerationMetrics: {
    raw1h: number;
    raw4h: number;
    smoothed1h: number;
    smoothed4h: number;
  };
  
  /** Candle analysis */
  candleMetrics: {
    totalCandles: number;
    bullishCandles: number;
    bearishCandles: number;
    consecutiveStreak: number;
    averageCandleSize: number;
    volumeWeightedSize: number;
  };
  
  /** Sustainability factors */
  sustainabilityFactors: {
    velocityConsistency: number;
    accelerationTrend: number;
    volumeSupport: number;
    priceStability: number;
  };
}

/**
 * Configuration for momentum acceleration tracking
 */
export interface MomentumConfig {
  /** Minimum data points required for analysis */
  minDataPoints: number;
  
  /** Velocity calculation windows */
  velocityWindows: {
    short: number; // 1h equivalent in minutes
    medium: number; // 4h equivalent in minutes
  };
  
  /** Acceleration smoothing factor */
  accelerationSmoothing: number;
  
  /** Consecutive candle weights (more recent = higher weight) */
  candleWeights: number[];
  
  /** Sustainability scoring weights */
  sustainabilityWeights: {
    velocity: number;
    acceleration: number;
    consistency: number;
    volume: number;
  };
  
  /** Fatigue level thresholds */
  fatigueThresholds: {
    mild: number;
    moderate: number;
    severe: number;
  };
}

/**
 * Default configuration for momentum tracking
 */
const DEFAULT_CONFIG: MomentumConfig = {
  minDataPoints: 48, // 4 hours of 5-minute data (will be adjusted based on interval)
  velocityWindows: {
    short: 60, // 1 hour
    medium: 240, // 4 hours
  },
  accelerationSmoothing: 0.3,
  candleWeights: [1.0, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1],
  sustainabilityWeights: {
    velocity: 0.3,
    acceleration: 0.35,
    consistency: 0.2,
    volume: 0.15,
  },
  fatigueThresholds: {
    mild: 25,
    moderate: 50,
    severe: 75,
  },
};

/**
 * Advanced momentum acceleration tracker for memecoin analysis
 */
export class MomentumAccelerationTracker {
  private config: MomentumConfig;
  private intervalMinutes: number;

  constructor(config: Partial<MomentumConfig> = {}, intervalMinutes: number = 5) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.intervalMinutes = intervalMinutes;
  }

  /**
   * Analyze momentum acceleration for a token
   */
  public analyzeMomentum(ohlcvData: OHLCV[]): MomentumAcceleration {
    // Adjust minimum data points based on actual interval
    const adjustedMinDataPoints = Math.floor((4 * 60) / this.intervalMinutes); // 4 hours worth of data
    const minDataPoints = Math.max(this.config.minDataPoints, adjustedMinDataPoints);
    
    if (ohlcvData.length < minDataPoints) {
      // Graceful degradation for insufficient data
      return this.createMinimalMomentumAnalysis(ohlcvData);
    }

    // Sort data by timestamp (newest first)
    const sortedData = [...ohlcvData].sort((a, b) => b.timestamp - a.timestamp);
    
    const metrics = this.calculateDetailedMetrics(sortedData);
    
    return {
      velocity1h: metrics.velocityMetrics.current1h,
      velocity4h: metrics.velocityMetrics.current4h,
      acceleration1h: metrics.accelerationMetrics.smoothed1h,
      acceleration4h: metrics.accelerationMetrics.smoothed4h,
      consecutiveCandles: this.analyzeConsecutiveCandles(sortedData),
      sustainabilityScore: this.calculateSustainabilityScore(metrics),
      fatigueLevel: this.determineFatigueLevel(metrics),
      entrySignalStrength: this.calculateEntrySignalStrength(metrics),
    };
  }

  /**
   * Calculate detailed momentum metrics
   */
  public calculateDetailedMetrics(sortedData: OHLCV[]): MomentumMetrics {
    const priceChanges = this.calculatePriceChanges(sortedData);
    const velocityMetrics = this.calculateVelocityMetrics(sortedData);
    const accelerationMetrics = this.calculateAccelerationMetrics(velocityMetrics);
    const candleMetrics = this.analyzeCandleMetrics(sortedData);
    const sustainabilityFactors = this.calculateSustainabilityFactors(
      velocityMetrics,
      accelerationMetrics,
      candleMetrics,
      sortedData
    );

    return {
      priceChanges,
      velocityMetrics,
      accelerationMetrics,
      candleMetrics,
      sustainabilityFactors,
    };
  }

  /**
   * Calculate price changes over different periods
   */
  private calculatePriceChanges(sortedData: OHLCV[]) {
    const current = sortedData[0].close;
    
    // Find prices at different time intervals
    const price1hAgo = this.findPriceAtInterval(sortedData, 60);
    const price4hAgo = this.findPriceAtInterval(sortedData, 240);
    const price12hAgo = this.findPriceAtInterval(sortedData, 720);

    return {
      period1h: price1hAgo ? ((current - price1hAgo) / price1hAgo) * 100 : 0,
      period4h: price4hAgo ? ((current - price4hAgo) / price4hAgo) * 100 : 0,
      period12h: price12hAgo ? ((current - price12hAgo) / price12hAgo) * 100 : 0,
    };
  }

  /**
   * Calculate velocity metrics (first derivative of price)
   */
  private calculateVelocityMetrics(sortedData: OHLCV[]) {
    const current1h = this.calculateVelocity(sortedData, this.config.velocityWindows.short);
    const candlesToSkip1h = Math.floor(this.config.velocityWindows.short / this.intervalMinutes);
    const previous1h = this.calculateVelocity(
      sortedData.slice(candlesToSkip1h), // Skip 1 hour of data based on actual interval
      this.config.velocityWindows.short
    );
    
    const current4h = this.calculateVelocity(sortedData, this.config.velocityWindows.medium);
    const candlesToSkip4h = Math.floor(this.config.velocityWindows.medium / this.intervalMinutes);
    const previous4h = this.calculateVelocity(
      sortedData.slice(candlesToSkip4h), // Skip 4 hours of data based on actual interval
      this.config.velocityWindows.medium
    );

    // Normalize velocity based on token's typical volatility
    const normalizedVelocity = this.normalizeVelocity(current1h, sortedData);

    return {
      current1h,
      previous1h,
      current4h,
      previous4h,
      normalizedVelocity,
    };
  }

  /**
   * Calculate acceleration metrics (second derivative of price)
   */
  private calculateAccelerationMetrics(velocityMetrics: any) {
    const raw1h = velocityMetrics.current1h - velocityMetrics.previous1h;
    const raw4h = velocityMetrics.current4h - velocityMetrics.previous4h;

    // Apply exponential smoothing to reduce noise
    const smoothed1h = this.applyExponentialSmoothing(raw1h, this.config.accelerationSmoothing);
    const smoothed4h = this.applyExponentialSmoothing(raw4h, this.config.accelerationSmoothing);

    return {
      raw1h,
      raw4h,
      smoothed1h,
      smoothed4h,
    };
  }

  /**
   * Analyze consecutive directional candles
   */
  private analyzeConsecutiveCandles(sortedData: OHLCV[]) {
    let consecutiveCount = 0;
    let direction: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    let weightedStrength = 0;

    // Analyze last 10 candles with decreasing weights
    const candlesToAnalyze = Math.min(10, sortedData.length - 1);
    let currentDirection: 'bullish' | 'bearish' | 'neutral' = 'neutral';

    for (let i = 0; i < candlesToAnalyze; i++) {
      const candle = sortedData[i];
      const candleDirection = candle.close > candle.open ? 'bullish' : 
                             candle.close < candle.open ? 'bearish' : 'neutral';

      if (i === 0) {
        currentDirection = candleDirection;
        direction = candleDirection;
      }

      if (candleDirection === currentDirection && candleDirection !== 'neutral') {
        consecutiveCount++;
        const weight = this.config.candleWeights[i] || 0.1;
        const candleSize = Math.abs(candle.close - candle.open) / candle.open;
        weightedStrength += candleSize * weight;
      } else {
        break;
      }
    }

    return {
      count: consecutiveCount,
      direction,
      weightedStrength: Math.min(weightedStrength * 100, 100), // Cap at 100
    };
  }

  /**
   * Calculate sustainability score (0-100)
   */
  private calculateSustainabilityScore(metrics: MomentumMetrics): number {
    const weights = this.config.sustainabilityWeights;
    
    // Velocity component (consistency of direction)
    const velocityScore = this.scoreVelocityConsistency(metrics.velocityMetrics);
    
    // Acceleration component (positive acceleration = momentum building)
    const accelerationScore = this.scoreAcceleration(metrics.accelerationMetrics);
    
    // Consistency component (consecutive candles)
    const consistencyScore = Math.min(metrics.candleMetrics.consecutiveStreak * 10, 100);
    
    // Volume component (volume supporting the move)
    const volumeScore = metrics.sustainabilityFactors.volumeSupport;

    const totalScore = 
      velocityScore * weights.velocity +
      accelerationScore * weights.acceleration +
      consistencyScore * weights.consistency +
      volumeScore * weights.volume;

    return Math.max(0, Math.min(100, totalScore));
  }

  /**
   * Determine momentum fatigue level
   */
  private determineFatigueLevel(metrics: MomentumMetrics): MomentumFatigueLevel {
    // Calculate fatigue based on multiple factors
    let fatigueScore = 0;

    // Velocity deceleration
    if (metrics.accelerationMetrics.smoothed1h < 0) fatigueScore += 20;
    if (metrics.accelerationMetrics.smoothed4h < 0) fatigueScore += 25;

    // Consistency breakdown
    if (metrics.candleMetrics.consecutiveStreak < 3) fatigueScore += 15;
    
    // Volume divergence
    if (metrics.sustainabilityFactors.volumeSupport < 50) fatigueScore += 20;

    // Price stability issues
    if (metrics.sustainabilityFactors.priceStability < 30) fatigueScore += 20;

    const thresholds = this.config.fatigueThresholds;
    
    if (fatigueScore >= thresholds.severe) return 'severe';
    if (fatigueScore >= thresholds.moderate) return 'moderate';
    if (fatigueScore >= thresholds.mild) return 'mild';
    return 'none';
  }

  /**
   * Calculate entry signal strength (0-100)
   */
  private calculateEntrySignalStrength(metrics: MomentumMetrics): number {
    let signalStrength = 0;

    // Strong positive acceleration
    if (metrics.accelerationMetrics.smoothed1h > 0) signalStrength += 30;
    if (metrics.accelerationMetrics.smoothed4h > 0) signalStrength += 25;

    // Consistent direction
    if (metrics.candleMetrics.consecutiveStreak >= 3) signalStrength += 20;

    // Volume support
    signalStrength += metrics.sustainabilityFactors.volumeSupport * 0.15;

    // Velocity momentum
    if (metrics.velocityMetrics.current1h > metrics.velocityMetrics.previous1h) {
      signalStrength += 10;
    }

    return Math.max(0, Math.min(100, signalStrength));
  }

  /**
   * Helper methods for calculations
   */
  
  private findPriceAtInterval(sortedData: OHLCV[], intervalMinutes: number): number | null {
    // Use the actual candle interval instead of hardcoded 5 minutes
    const candlesBack = Math.floor(intervalMinutes / this.intervalMinutes);
    return sortedData[candlesBack]?.close || null;
  }

  private calculateVelocity(data: OHLCV[], windowMinutes: number): number {
    const candlesInWindow = Math.floor(windowMinutes / this.intervalMinutes);
    if (data.length < candlesInWindow) return 0;

    const startPrice = data[candlesInWindow - 1].close;
    const endPrice = data[0].close;
    const timeHours = windowMinutes / 60;

    return ((endPrice - startPrice) / startPrice) * 100 / timeHours;
  }

  private normalizeVelocity(velocity: number, data: OHLCV[]): number {
    // Calculate average volatility over the dataset
    const volatilities = data.slice(0, 24).map(candle => 
      Math.abs(candle.high - candle.low) / candle.open * 100
    );
    const avgVolatility = volatilities.reduce((sum, vol) => sum + vol, 0) / volatilities.length;
    
    return avgVolatility > 0 ? Math.abs(velocity) / avgVolatility : 0;
  }

  private applyExponentialSmoothing(value: number, alpha: number): number {
    // Simple exponential smoothing - in production, you'd maintain state
    return value * alpha;
  }

  private analyzeCandleMetrics(sortedData: OHLCV[]) {
    const recentCandles = sortedData.slice(0, 20);
    let bullishCandles = 0;
    let bearishCandles = 0;
    let consecutiveStreak = 0;
    let totalCandleSize = 0;
    let volumeWeightedSize = 0;
    let totalVolume = 0;

    let lastDirection: 'bullish' | 'bearish' | 'neutral' = 'neutral';

    for (let i = 0; i < recentCandles.length; i++) {
      const candle = recentCandles[i];
      const candleSize = Math.abs(candle.close - candle.open) / candle.open;
      const direction = candle.close > candle.open ? 'bullish' : 
                       candle.close < candle.open ? 'bearish' : 'neutral';

      if (direction === 'bullish') bullishCandles++;
      if (direction === 'bearish') bearishCandles++;

      totalCandleSize += candleSize;
      volumeWeightedSize += candleSize * candle.volume;
      totalVolume += candle.volume;

      // Calculate consecutive streak
      if (i === 0) {
        lastDirection = direction;
        consecutiveStreak = direction !== 'neutral' ? 1 : 0;
      } else if (direction === lastDirection && direction !== 'neutral') {
        consecutiveStreak++;
      }
    }

    return {
      totalCandles: recentCandles.length,
      bullishCandles,
      bearishCandles,
      consecutiveStreak,
      averageCandleSize: totalCandleSize / recentCandles.length,
      volumeWeightedSize: totalVolume > 0 ? volumeWeightedSize / totalVolume : 0,
    };
  }

  private calculateSustainabilityFactors(
    velocityMetrics: any,
    accelerationMetrics: any,
    candleMetrics: any,
    sortedData: OHLCV[]
  ) {
    // Velocity consistency
    const velocityConsistency = Math.abs(velocityMetrics.current1h) > 0 ?
      Math.min(Math.abs(velocityMetrics.current4h / velocityMetrics.current1h), 1) * 100 : 0;

    // Acceleration trend
    const accelerationTrend = accelerationMetrics.smoothed1h > 0 ? 100 : 
                             accelerationMetrics.smoothed1h < -1 ? 0 : 50;

    // Volume support (compare recent volume to average)
    const recentVolume = sortedData.slice(0, 12).reduce((sum, candle) => sum + candle.volume, 0) / 12;
    const avgVolume = sortedData.slice(12, 36).reduce((sum, candle) => sum + candle.volume, 0) / 24;
    const volumeSupport = avgVolume > 0 ? Math.min((recentVolume / avgVolume) * 50, 100) : 50;

    // Price stability (lower volatility = more stable momentum)
    const recentCandles = sortedData.slice(0, 12);
    const volatility = recentCandles.reduce((sum, candle) => 
      sum + (candle.high - candle.low) / candle.open, 0) / recentCandles.length;
    let priceStability = Math.max(0, 100 - (volatility * 1000)); // Scale volatility

    // Adjust price stability based on candle metrics
    if (candleMetrics.consecutiveStreak >= 5) {
      priceStability *= 1.1; // Bonus for consistent directional movement
    }
    
    // Adjust based on candle strength
    if (candleMetrics.averageCandleSize > 0.02) { // Large candles indicate strong moves
      priceStability *= 0.9; // Slight penalty for high volatility
    }

    return {
      velocityConsistency,
      accelerationTrend,
      volumeSupport,
      priceStability: Math.min(100, priceStability), // Cap at 100
    };
  }

  private scoreVelocityConsistency(velocityMetrics: any): number {
    // Score based on velocity being in same direction and magnitude
    const consistency = Math.abs(velocityMetrics.current1h) > 0 ?
      Math.min(Math.abs(velocityMetrics.current4h / velocityMetrics.current1h), 1) : 0;
    
    const magnitude = Math.min(Math.abs(velocityMetrics.current1h) * 10, 100);
    
    return (consistency * 0.6 + magnitude * 0.4) * 100;
  }

  private scoreAcceleration(accelerationMetrics: any): number {
    // Positive acceleration is good, negative is bad
    const acceleration1h = Math.max(0, accelerationMetrics.smoothed1h * 10);
    const acceleration4h = Math.max(0, accelerationMetrics.smoothed4h * 5);
    
    return Math.min((acceleration1h + acceleration4h) * 50, 100);
  }

  /**
   * Create minimal momentum analysis for insufficient data
   */
  private createMinimalMomentumAnalysis(ohlcvData: OHLCV[]): MomentumAcceleration {
    if (ohlcvData.length === 0) {
      return {
        velocity1h: 0,
        velocity4h: 0,
        acceleration1h: 0,
        acceleration4h: 0,
        consecutiveCandles: {
          count: 0,
          direction: 'neutral',
          weightedStrength: 0
        },
        sustainabilityScore: 25, // Low but not zero
        fatigueLevel: 'none',
        entrySignalStrength: 20 // Low confidence due to insufficient data
      };
    }

    // For very limited data, do basic analysis
    const sortedData = [...ohlcvData].sort((a, b) => b.timestamp - a.timestamp);
    const current = sortedData[0];
    const previous = sortedData.length > 1 ? sortedData[1] : current;
    
    // Basic price change calculation
    const priceChange = previous.close > 0 ? ((current.close - previous.close) / previous.close) * 100 : 0;
    
    // Simple consecutive candle analysis
    const consecutiveCandles = this.analyzeMinimalConsecutiveCandles(sortedData);
    
    // Basic sustainability based on available data
    const sustainabilityScore = Math.min(50, Math.abs(priceChange) * 10 + consecutiveCandles.weightedStrength);
    
    return {
      velocity1h: priceChange, // Use simple price change as velocity proxy
      velocity4h: priceChange * 0.5, // Assume 4h is more conservative
      acceleration1h: priceChange > 0 ? Math.min(priceChange, 10) : Math.max(priceChange, -10),
      acceleration4h: priceChange > 0 ? Math.min(priceChange * 0.3, 5) : Math.max(priceChange * 0.3, -5),
      consecutiveCandles,
      sustainabilityScore,
      fatigueLevel: 'none', // No fatigue detectable with limited data
      entrySignalStrength: Math.min(40, sustainabilityScore * 0.8) // Conservative due to limited data
    };
  }

  /**
   * Analyze consecutive candles with minimal data
   */
  private analyzeMinimalConsecutiveCandles(sortedData: OHLCV[]) {
    if (sortedData.length === 1) {
      const candle = sortedData[0];
      const direction = candle.close > candle.open ? 'bullish' : 
                       candle.close < candle.open ? 'bearish' : 'neutral';
      const strength = Math.abs(candle.close - candle.open) / candle.open * 100;
      
      return {
        count: direction !== 'neutral' ? 1 : 0,
        direction: direction as 'bullish' | 'bearish' | 'neutral',
        weightedStrength: Math.min(strength, 20)
      };
    }

    // For 2+ candles, do basic consecutive analysis
    let consecutiveCount = 0;
    let direction: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    let weightedStrength = 0;

    const analysisLength = Math.min(5, sortedData.length);
    let currentDirection: 'bullish' | 'bearish' | 'neutral' = 'neutral';

    for (let i = 0; i < analysisLength; i++) {
      const candle = sortedData[i];
      const candleDirection = candle.close > candle.open ? 'bullish' : 
                             candle.close < candle.open ? 'bearish' : 'neutral';

      if (i === 0) {
        currentDirection = candleDirection;
        direction = candleDirection;
      }

      if (candleDirection === currentDirection && candleDirection !== 'neutral') {
        consecutiveCount++;
        const weight = Math.max(0.1, 1.0 - (i * 0.2)); // Decreasing weight
        const candleSize = Math.abs(candle.close - candle.open) / candle.open;
        weightedStrength += candleSize * weight * 100;
      } else {
        break;
      }
    }

    return {
      count: consecutiveCount,
      direction: direction as 'bullish' | 'bearish' | 'neutral',
      weightedStrength: Math.min(weightedStrength, 50) // Cap for limited data
    };
  }
}

/**
 * Factory function to create a momentum acceleration tracker
 */
export function createMomentumAccelerationTracker(config?: Partial<MomentumConfig>, intervalMinutes: number = 5): MomentumAccelerationTracker {
  return new MomentumAccelerationTracker(config, intervalMinutes);
}

/**
 * Utility function to interpret momentum acceleration results
 */
export function interpretMomentumAcceleration(momentum: MomentumAcceleration): {
  signal: 'strong_buy' | 'buy' | 'hold' | 'avoid';
  confidence: number;
  reasoning: string[];
} {
  const reasoning: string[] = [];
  let signal: 'strong_buy' | 'buy' | 'hold' | 'avoid' = 'hold';
  let confidence = 50;

  // Analyze acceleration
  if (momentum.acceleration1h > 0 && momentum.acceleration4h > 0) {
    reasoning.push('Positive acceleration on both timeframes');
    confidence += 20;
  } else if (momentum.acceleration1h > 0) {
    reasoning.push('Short-term acceleration detected');
    confidence += 10;
  }

  // Analyze sustainability
  if (momentum.sustainabilityScore >= 80) {
    reasoning.push('High sustainability score');
    confidence += 20;
    signal = 'strong_buy';
  } else if (momentum.sustainabilityScore >= 60) {
    reasoning.push('Good sustainability score');
    confidence += 10;
    signal = confidence >= 70 ? 'buy' : 'hold';
  }

  // Analyze fatigue
  if (momentum.fatigueLevel === 'none') {
    reasoning.push('No momentum fatigue detected');
    confidence += 15;
  } else if (momentum.fatigueLevel === 'severe') {
    reasoning.push('Severe momentum fatigue - avoid entry');
    signal = 'avoid';
    confidence = Math.min(confidence, 30);
  }

  // Analyze consecutive candles
  if (momentum.consecutiveCandles.count >= 5) {
    reasoning.push(`Strong directional consistency (${momentum.consecutiveCandles.count} consecutive candles)`);
    confidence += 15;
  }

  // Final signal determination
  if (signal === 'hold' && confidence >= 80) signal = 'strong_buy';
  else if (signal === 'hold' && confidence >= 65) signal = 'buy';

  return {
    signal,
    confidence: Math.max(0, Math.min(100, confidence)),
    reasoning,
  };
}