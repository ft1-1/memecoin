/**
 * Volume Analysis for Memecoin Trading
 * Specialized volume analysis optimized for memecoin characteristics
 */

import { OHLCVData, VolumeProfile } from './types';
import { VolumeAnalysis } from '../../types/analysis';

export interface VolumeSignal {
  type: 'accumulation' | 'distribution' | 'breakout' | 'exhaustion' | 'neutral';
  strength: number; // 0-100
  confidence: number; // 0-100
  description: string;
  timestamp: number;
}

export interface VolumePattern {
  name: string;
  detected: boolean;
  confidence: number;
  significance: 'high' | 'medium' | 'low';
  description: string;
  bullishImplication: boolean;
}

export interface VolumeMetrics {
  relativeVolume: number; // Current volume vs average
  volumeRate: number; // Volume acceleration/deceleration
  volumeDistribution: {
    buyingPressure: number; // 0-100
    sellingPressure: number; // 0-100
    netPressure: number; // -100 to 100
  };
  liquidityScore: number; // 0-100
  marketImpact: number; // How much volume moves price
}

export class VolumeAnalyzer {
  private volumePeriods: number[];
  private spikeThreshold: number;
  private dryUpThreshold: number;
  private liquidityLookback: number;

  constructor(config?: {
    volumePeriods?: number[];
    spikeThreshold?: number;
    dryUpThreshold?: number;
    liquidityLookback?: number;
  }) {
    this.volumePeriods = config?.volumePeriods || [10, 20, 50];
    this.spikeThreshold = config?.spikeThreshold || 2.0; // 2x average threshold as specified
    this.dryUpThreshold = config?.dryUpThreshold || 0.3;
    this.liquidityLookback = config?.liquidityLookback || 100;
  }

  /**
   * Perform comprehensive volume analysis
   */
  public analyzeVolume(data: OHLCVData[]): VolumeAnalysis {
    if (data.length < 10) {
      return this.getDefaultVolumeAnalysis();
    }

    const volumes = data.map(d => d.volume);
    const closes = data.map(d => d.close);
    const highs = data.map(d => d.high);
    const lows = data.map(d => d.low);

    const currentVolume = volumes[volumes.length - 1];
    const averageVolume = this.calculateAverageVolume(volumes, 20);
    
    const volumeProfile = this.createVolumeProfile(data);
    const volumeSpike = this.detectVolumeSpike(volumes);
    const liquidityScore = this.calculateLiquidityScore(data);

    return {
      averageVolume,
      currentVolume,
      volumeSpike: volumeSpike.detected,
      volumeSpikeFactor: volumeSpike.factor,
      volumeProfile: {
        buyPressure: volumeProfile.volumeDistribution.buyingPressure,
        sellPressure: volumeProfile.volumeDistribution.sellingPressure,
        netFlow: volumeProfile.volumeDistribution.netPressure
      },
      liquidityScore
    };
  }

  /**
   * Generate volume-based trading signals
   */
  public generateVolumeSignals(data: OHLCVData[]): VolumeSignal[] {
    if (data.length < 20) return [];

    const signals: VolumeSignal[] = [];
    const volumes = data.map(d => d.volume);
    const closes = data.map(d => d.close);
    const timestamp = data[data.length - 1].timestamp;

    // Enhanced volume spike signal with pattern analysis
    const spikeSignal = this.detectVolumeSpike(volumes);
    if (spikeSignal.detected) {
      const priceChange = this.calculatePriceChange(closes);
      signals.push({
        type: priceChange > 0 ? 'breakout' : 'distribution',
        strength: Math.min(100, spikeSignal.factor * 25),
        confidence: spikeSignal.confidence,
        description: `${spikeSignal.pattern} volume spike ${spikeSignal.factor.toFixed(1)}x average with ${priceChange > 0 ? 'positive' : 'negative'} price action`,
        timestamp
      });
    }

    // Volume dry-up signal
    const dryUpSignal = this.detectVolumeDryUp(volumes);
    if (dryUpSignal.detected) {
      signals.push({
        type: 'accumulation',
        strength: 60,
        confidence: 70,
        description: `Volume dry-up detected - potential accumulation phase`,
        timestamp
      });
    }

    // Climax volume signal
    const climaxSignal = this.detectClimaxVolume(data);
    if (climaxSignal.detected) {
      signals.push({
        type: 'exhaustion',
        strength: climaxSignal.strength,
        confidence: climaxSignal.confidence,
        description: climaxSignal.description,
        timestamp
      });
    }

    // On-balance volume signal
    const obvSignal = this.analyzeOnBalanceVolume(data);
    signals.push(obvSignal);

    return signals;
  }

  /**
   * Detect volume patterns
   */
  public detectVolumePatterns(data: OHLCVData[]): VolumePattern[] {
    if (data.length < 30) return [];

    const patterns: VolumePattern[] = [];

    // Volume accumulation pattern
    patterns.push(this.detectAccumulationPattern(data));

    // Volume distribution pattern  
    patterns.push(this.detectDistributionPattern(data));

    // Volume breakout pattern
    patterns.push(this.detectBreakoutPattern(data));

    // Volume divergence pattern
    patterns.push(this.detectVolumeDivergence(data));

    // Volume exhaustion pattern
    patterns.push(this.detectExhaustionPattern(data));

    return patterns.filter(p => p.detected);
  }

  /**
   * Calculate comprehensive volume metrics
   */
  public calculateVolumeMetrics(data: OHLCVData[]): VolumeMetrics {
    if (data.length < 20) {
      return {
        relativeVolume: 1,
        volumeRate: 0,
        volumeDistribution: { buyingPressure: 50, sellingPressure: 50, netPressure: 0 },
        liquidityScore: 0,
        marketImpact: 0
      };
    }

    const volumes = data.map(d => d.volume);
    const closes = data.map(d => d.close);

    return {
      relativeVolume: this.calculateRelativeVolume(volumes),
      volumeRate: this.calculateVolumeRate(volumes),
      volumeDistribution: this.calculateVolumeDistribution(data),
      liquidityScore: this.calculateLiquidityScore(data),
      marketImpact: this.calculateMarketImpact(data)
    };
  }

  /**
   * Create detailed volume profile
   */
  private createVolumeProfile(data: OHLCVData[]): VolumeMetrics {
    const volumeDistribution = this.calculateVolumeDistribution(data);
    const relativeVolume = this.calculateRelativeVolume(data.map(d => d.volume));
    const volumeRate = this.calculateVolumeRate(data.map(d => d.volume));
    const liquidityScore = this.calculateLiquidityScore(data);
    const marketImpact = this.calculateMarketImpact(data);

    return {
      relativeVolume,
      volumeRate,
      volumeDistribution,
      liquidityScore,
      marketImpact
    };
  }

  /**
   * Calculate average volume over period
   */
  private calculateAverageVolume(volumes: number[], period: number): number {
    if (volumes.length < period) return 0;
    
    const recentVolumes = volumes.slice(-period);
    return recentVolumes.reduce((sum, vol) => sum + vol, 0) / period;
  }

  /**
   * Enhanced volume spike detection with 2x average threshold and pattern analysis
   */
  private detectVolumeSpike(volumes: number[]): { 
    detected: boolean; 
    factor: number; 
    pattern: 'sudden' | 'gradual' | 'sustained';
    confidence: number;
  } {
    if (volumes.length < 10) return { detected: false, factor: 1, pattern: 'sudden', confidence: 0 };

    const currentVolume = volumes[volumes.length - 1];
    const avgVolume = this.calculateAverageVolume(volumes.slice(0, -1), Math.min(20, volumes.length - 1));
    const factor = avgVolume > 0 ? currentVolume / avgVolume : 1;
    
    // Enhanced spike detection with 2x threshold
    const detected = factor >= this.spikeThreshold;
    
    // Analyze spike pattern
    let pattern: 'sudden' | 'gradual' | 'sustained' = 'sudden';
    let confidence = 0;
    
    if (detected) {
      // Check if spike is sudden (current period only) or gradual (building up)
      const recent3 = volumes.slice(-3);
      const recent5 = volumes.slice(-5);
      
      const recent3Avg = recent3.reduce((sum, v) => sum + v, 0) / recent3.length;
      const recent5Avg = recent5.reduce((sum, v) => sum + v, 0) / recent5.length;
      
      if (recent3Avg > avgVolume * 1.5) {
        pattern = 'sustained';
        confidence = Math.min(100, factor * 40); // Higher confidence for sustained spikes
      } else if (recent5Avg > avgVolume * 1.2) {
        pattern = 'gradual';
        confidence = Math.min(100, factor * 30);
      } else {
        pattern = 'sudden';
        confidence = Math.min(100, factor * 25);
      }
      
      // Boost confidence for higher multiples
      if (factor > 5) confidence = Math.min(100, confidence * 1.2);
      if (factor > 10) confidence = Math.min(100, confidence * 1.4);
    }
    
    return { detected, factor, pattern, confidence };
  }

  /**
   * Detect volume dry-up
   */
  private detectVolumeDryUp(volumes: number[]): { detected: boolean; severity: number } {
    if (volumes.length < 20) return { detected: false, severity: 0 };

    const recentVolumes = volumes.slice(-5);
    const historicalVolumes = volumes.slice(-20, -5);

    const recentAvg = recentVolumes.reduce((sum, vol) => sum + vol, 0) / recentVolumes.length;
    const historicalAvg = historicalVolumes.reduce((sum, vol) => sum + vol, 0) / historicalVolumes.length;

    const ratio = historicalAvg > 0 ? recentAvg / historicalAvg : 1;
    const severity = Math.max(0, (this.dryUpThreshold - ratio) / this.dryUpThreshold);

    return {
      detected: ratio <= this.dryUpThreshold,
      severity
    };
  }

  /**
   * Detect climax volume (exhaustion)
   */
  private detectClimaxVolume(data: OHLCVData[]): { detected: boolean; strength: number; confidence: number; description: string } {
    if (data.length < 20) return { detected: false, strength: 0, confidence: 0, description: '' };

    const volumes = data.map(d => d.volume);
    const closes = data.map(d => d.close);
    
    // Look for very high volume with price reversal
    const currentVolume = volumes[volumes.length - 1];
    const avgVolume = this.calculateAverageVolume(volumes.slice(0, -1), 20);
    const volumeRatio = avgVolume > 0 ? currentVolume / avgVolume : 1;

    // Check for price reversal pattern
    const priceChange = closes.length > 1 ? (closes[closes.length - 1] - closes[closes.length - 2]) / closes[closes.length - 2] : 0;
    const previousPriceChange = closes.length > 2 ? (closes[closes.length - 2] - closes[closes.length - 3]) / closes[closes.length - 3] : 0;

    const reversal = (priceChange > 0 && previousPriceChange < 0) || (priceChange < 0 && previousPriceChange > 0);
    const highVolume = volumeRatio > 3;

    const detected = highVolume && reversal;
    const strength = detected ? Math.min(100, volumeRatio * 20) : 0;
    const confidence = detected ? 75 : 0;
    const description = detected ? `Climax volume ${volumeRatio.toFixed(1)}x with price reversal - potential exhaustion` : '';

    return { detected, strength, confidence, description };
  }

  /**
   * Analyze On-Balance Volume (OBV)
   */
  private analyzeOnBalanceVolume(data: OHLCVData[]): VolumeSignal {
    if (data.length < 10) {
      return {
        type: 'neutral',
        strength: 0,
        confidence: 0,
        description: 'Insufficient data for OBV analysis',
        timestamp: data[data.length - 1].timestamp
      };
    }

    let obv = 0;
    const obvValues: number[] = [];

    // Calculate OBV
    for (let i = 1; i < data.length; i++) {
      if (data[i].close > data[i - 1].close) {
        obv += data[i].volume;
      } else if (data[i].close < data[i - 1].close) {
        obv -= data[i].volume;
      }
      obvValues.push(obv);
    }

    // Analyze OBV trend
    const recentOBV = obvValues.slice(-5);
    const olderOBV = obvValues.slice(-10, -5);
    
    const recentAvg = recentOBV.reduce((sum, val) => sum + val, 0) / recentOBV.length;
    const olderAvg = olderOBV.reduce((sum, val) => sum + val, 0) / olderOBV.length;

    const obvTrend = recentAvg - olderAvg;
    const strength = Math.min(100, Math.abs(obvTrend) / 1000000); // Normalize based on typical values

    let type: 'accumulation' | 'distribution' | 'neutral';
    if (obvTrend > 0) type = 'accumulation';
    else if (obvTrend < 0) type = 'distribution';
    else type = 'neutral';

    return {
      type,
      strength,
      confidence: 70,
      description: `OBV trend: ${type} with ${obvTrend > 0 ? 'positive' : 'negative'} momentum`,
      timestamp: data[data.length - 1].timestamp
    };
  }

  /**
   * Calculate relative volume
   */
  private calculateRelativeVolume(volumes: number[]): number {
    if (volumes.length < 10) return 1;

    const currentVolume = volumes[volumes.length - 1];
    const avgVolume = this.calculateAverageVolume(volumes.slice(0, -1), Math.min(20, volumes.length - 1));

    return avgVolume > 0 ? currentVolume / avgVolume : 1;
  }

  /**
   * Calculate volume rate (acceleration/deceleration)
   */
  private calculateVolumeRate(volumes: number[]): number {
    if (volumes.length < 10) return 0;

    const recent = volumes.slice(-5);
    const previous = volumes.slice(-10, -5);

    const recentAvg = recent.reduce((sum, vol) => sum + vol, 0) / recent.length;
    const previousAvg = previous.reduce((sum, vol) => sum + vol, 0) / previous.length;

    return previousAvg > 0 ? (recentAvg - previousAvg) / previousAvg : 0;
  }

  /**
   * Calculate volume distribution (buying vs selling pressure)
   */
  private calculateVolumeDistribution(data: OHLCVData[]): {
    buyingPressure: number;
    sellingPressure: number;  
    netPressure: number;
  } {
    if (data.length < 5) {
      return { buyingPressure: 50, sellingPressure: 50, netPressure: 0 };
    }

    let buyingVolume = 0;
    let sellingVolume = 0;
    let totalVolume = 0;

    // Analyze recent candles to determine buying vs selling pressure
    for (let i = 1; i < data.length; i++) {
      const candle = data[i];
      const volume = candle.volume;
      totalVolume += volume;

      // Simple heuristic: if close > open, consider it buying pressure
      if (candle.close > candle.open) {
        buyingVolume += volume;
      } else if (candle.close < candle.open) {
        sellingVolume += volume;
      } else {
        // For doji candles, split volume based on position within range
        const midpoint = (candle.high + candle.low) / 2;
        if (candle.close > midpoint) {
          buyingVolume += volume * 0.6;
          sellingVolume += volume * 0.4;
        } else {
          buyingVolume += volume * 0.4;
          sellingVolume += volume * 0.6;
        }
      }
    }

    const buyingPressure = totalVolume > 0 ? (buyingVolume / totalVolume) * 100 : 50;
    const sellingPressure = totalVolume > 0 ? (sellingVolume / totalVolume) * 100 : 50;
    const netPressure = buyingPressure - sellingPressure;

    return { buyingPressure, sellingPressure, netPressure };
  }

  /**
   * Calculate liquidity score
   */
  private calculateLiquidityScore(data: OHLCVData[]): number {
    if (data.length < 20) return 0;

    const volumes = data.map(d => d.volume);
    const avgVolume = this.calculateAverageVolume(volumes, 20);
    const volumeConsistency = this.calculateVolumeConsistency(volumes.slice(-20));
    
    // Higher score for higher volume and consistency
    const volumeScore = Math.min(50, Math.log(avgVolume + 1) * 5);
    const consistencyScore = volumeConsistency * 50;

    return Math.min(100, volumeScore + consistencyScore);
  }

  /**
   * Calculate volume consistency
   */
  private calculateVolumeConsistency(volumes: number[]): number {
    if (volumes.length < 5) return 0;

    const mean = volumes.reduce((sum, vol) => sum + vol, 0) / volumes.length;
    const variance = volumes.reduce((sum, vol) => sum + Math.pow(vol - mean, 2), 0) / volumes.length;
    const coefficient = mean > 0 ? Math.sqrt(variance) / mean : 1;

    // Lower coefficient of variation = higher consistency
    return Math.max(0, 1 - coefficient);
  }

  /**
   * Calculate market impact (how much volume moves price)
   */
  private calculateMarketImpact(data: OHLCVData[]): number {
    if (data.length < 10) return 0;

    let totalImpact = 0;
    let impactCount = 0;

    for (let i = 1; i < data.length; i++) {
      const priceChange = Math.abs(data[i].close - data[i - 1].close) / data[i - 1].close;
      const volume = data[i].volume;
      
      if (volume > 0 && priceChange > 0) {
        const impact = priceChange / Math.log(volume + 1);
        totalImpact += impact;
        impactCount++;
      }
    }

    return impactCount > 0 ? (totalImpact / impactCount) * 10000 : 0; // Scale for readability
  }

  /**
   * Calculate price change
   */
  private calculatePriceChange(closes: number[]): number {
    if (closes.length < 2) return 0;
    return (closes[closes.length - 1] - closes[closes.length - 2]) / closes[closes.length - 2];
  }

  /**
   * Detect accumulation pattern
   */
  private detectAccumulationPattern(data: OHLCVData[]): VolumePattern {
    const volumes = data.map(d => d.volume);
    const closes = data.map(d => d.close);

    // Look for increasing volume with sideways or slightly rising price
    const volumeTrend = this.calculateTrend(volumes.slice(-10));
    const priceTrend = this.calculateTrend(closes.slice(-10));

    const detected = volumeTrend > 0.1 && Math.abs(priceTrend) < 0.05;
    const confidence = detected ? Math.min(100, volumeTrend * 200) : 0;

    return {
      name: 'Volume Accumulation',
      detected,
      confidence,
      significance: confidence > 70 ? 'high' : confidence > 40 ? 'medium' : 'low',
      description: 'Increasing volume with stable price - potential accumulation',
      bullishImplication: true
    };
  }

  /**
   * Enhanced distribution pattern detection
   */
  private detectDistributionPattern(data: OHLCVData[]): VolumePattern {
    const volumes = data.map(d => d.volume);
    const closes = data.map(d => d.close);

    // Enhanced volume spike detection
    const volumeSpike = this.detectVolumeSpike(volumes);
    const priceDecline = this.calculateTrend(closes.slice(-5)) < -0.05; // Adjusted threshold
    
    // Additional checks for distribution pattern
    const volumeDistribution = this.calculateVolumeDistribution(data.slice(-10));
    const sellingPressure = volumeDistribution.sellingPressure > 60;
    
    const detected = volumeSpike.detected && 
                    (priceDecline || sellingPressure) && 
                    volumeSpike.factor >= 2.0;
    
    let confidence = 0;
    if (detected) {
      confidence = Math.min(100, volumeSpike.factor * 35);
      
      // Boost confidence for strong selling pressure
      if (sellingPressure) confidence *= 1.2;
      
      // Boost for sustained high volume during decline
      if (volumeSpike.pattern === 'sustained' && priceDecline) confidence *= 1.3;
      
      confidence = Math.min(100, confidence);
    }

    return {
      name: 'Volume Distribution',
      detected,
      confidence,
      significance: confidence > 70 ? 'high' : confidence > 40 ? 'medium' : 'low',
      description: `${detected ? volumeSpike.pattern + ' ' : ''}high volume (${volumeSpike.factor.toFixed(1)}x) with ${priceDecline ? 'price decline' : 'selling pressure'}`,
      bullishImplication: false
    };
  }

  /**
   * Enhanced breakout pattern detection with volume confirmation
   */
  private detectBreakoutPattern(data: OHLCVData[]): VolumePattern {
    const volumes = data.map(d => d.volume);
    const closes = data.map(d => d.close);
    const highs = data.map(d => d.high);
    const lows = data.map(d => d.low);

    // Enhanced volume spike detection
    const volumeSpike = this.detectVolumeSpike(volumes);
    const priceChange = Math.abs(this.calculatePriceChange(closes));
    
    // Check for price breakout above recent range
    const recentHigh = Math.max(...highs.slice(-10));
    const recentLow = Math.min(...lows.slice(-10));
    const currentPrice = closes[closes.length - 1];
    const priceRange = recentHigh - recentLow;
    
    const priceBreakout = currentPrice > recentHigh + (priceRange * 0.02) || 
                         currentPrice < recentLow - (priceRange * 0.02);
    
    // Enhanced detection criteria
    const detected = volumeSpike.detected && 
                    (priceChange > 0.03 || priceBreakout) && 
                    volumeSpike.factor >= 2.0; // Ensure 2x threshold
    
    let confidence = 0;
    if (detected) {
      // Base confidence from volume and price movement
      confidence = Math.min(100, (volumeSpike.factor * priceChange) * 80);
      
      // Boost for sustained volume patterns
      if (volumeSpike.pattern === 'sustained') confidence *= 1.2;
      if (volumeSpike.pattern === 'gradual') confidence *= 1.1;
      
      // Boost for actual price breakout beyond range
      if (priceBreakout) confidence *= 1.3;
      
      confidence = Math.min(100, confidence);
    }

    return {
      name: 'Volume Breakout',
      detected,
      confidence,
      significance: confidence > 70 ? 'high' : confidence > 40 ? 'medium' : 'low',
      description: `${detected ? volumeSpike.pattern + ' ' : ''}volume ${volumeSpike.factor.toFixed(1)}x with ${priceBreakout ? 'range breakout' : 'strong price movement'}`,
      bullishImplication: this.calculatePriceChange(closes) > 0
    };
  }

  /**
   * Detect volume divergence
   */
  private detectVolumeDivergence(data: OHLCVData[]): VolumePattern {
    if (data.length < 20) {
      return {
        name: 'Volume Divergence',
        detected: false,
        confidence: 0,
        significance: 'low',
        description: 'Insufficient data for divergence analysis',
        bullishImplication: false
      };
    }

    const volumes = data.map(d => d.volume);
    const closes = data.map(d => d.close);

    // Compare recent trends
    const recentVolumeTrend = this.calculateTrend(volumes.slice(-10));
    const recentPriceTrend = this.calculateTrend(closes.slice(-10));

    // Divergence: price trending one way, volume trending opposite
    const divergence = (recentPriceTrend > 0.05 && recentVolumeTrend < -0.1) || 
                      (recentPriceTrend < -0.05 && recentVolumeTrend > 0.1);

    const detected = divergence;
    const confidence = detected ? Math.min(100, Math.abs(recentPriceTrend - recentVolumeTrend) * 200) : 0;

    return {
      name: 'Volume Divergence',
      detected,
      confidence,
      significance: confidence > 70 ? 'high' : confidence > 40 ? 'medium' : 'low',
      description: 'Price and volume moving in opposite directions - potential reversal signal',
      bullishImplication: recentPriceTrend < 0 && recentVolumeTrend > 0
    };
  }

  /**
   * Detect exhaustion pattern
   */
  private detectExhaustionPattern(data: OHLCVData[]): VolumePattern {
    const climax = this.detectClimaxVolume(data);
    
    return {
      name: 'Volume Exhaustion',
      detected: climax.detected,
      confidence: climax.confidence,
      significance: climax.confidence > 70 ? 'high' : climax.confidence > 40 ? 'medium' : 'low',
      description: climax.description,
      bullishImplication: false // Usually indicates end of current trend
    };
  }

  /**
   * Calculate trend for array of values
   */
  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;

    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));

    const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;

    return firstAvg > 0 ? (secondAvg - firstAvg) / firstAvg : 0;
  }

  /**
   * Get default volume analysis for insufficient data
   */
  private getDefaultVolumeAnalysis(): VolumeAnalysis {
    return {
      averageVolume: 0,
      currentVolume: 0,
      volumeSpike: false,
      volumeSpikeFactor: 1,
      volumeProfile: {
        buyPressure: 50,
        sellPressure: 50,
        netFlow: 0
      },
      liquidityScore: 0
    };
  }
}