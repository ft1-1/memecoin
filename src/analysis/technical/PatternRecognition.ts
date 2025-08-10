/**
 * Pattern Recognition for Technical Analysis
 * Detects chart patterns, support/resistance levels, and candlestick patterns
 */

import { OHLCVData, PatternMatch, SupportResistanceLevel } from './types';
import { PatternAnalysis } from '../../types/analysis';

export interface CandlestickPattern {
  name: string;
  type: 'reversal' | 'continuation' | 'indecision';
  bullish: boolean;
  confidence: number;
  description: string;
  index: number;
  significance: 'high' | 'medium' | 'low';
}

export interface ChartPattern {
  name: string;
  type: 'breakout' | 'reversal' | 'continuation' | 'consolidation';
  confidence: number;
  bullish: boolean;
  startIndex: number;
  endIndex: number;
  keyLevels: number[];
  target?: number;
  stopLoss?: number;
  description: string;
}

export class PatternRecognition {
  private minPatternLength: number;
  private supportResistanceThreshold: number;
  private minTouches: number;
  private volumeWeightEnabled: boolean;

  constructor(config?: {
    minPatternLength?: number;
    supportResistanceThreshold?: number;
    minTouches?: number;
    volumeWeightEnabled?: boolean;
  }) {
    this.minPatternLength = config?.minPatternLength || 10;
    this.supportResistanceThreshold = config?.supportResistanceThreshold || 0.02; // 2%
    this.minTouches = config?.minTouches || 2;
    this.volumeWeightEnabled = config?.volumeWeightEnabled || true;
  }

  /**
   * Perform comprehensive pattern analysis
   */
  public analyzePatterns(data: OHLCVData[]): PatternAnalysis {
    if (data.length < this.minPatternLength) {
      return this.getDefaultPatternAnalysis();
    }

    const chartPatterns = this.detectChartPatterns(data);
    const candlestickPatterns = this.detectCandlestickPatterns(data);

    return {
      patterns: chartPatterns.map(p => ({
        type: p.name,
        confidence: p.confidence,
        description: p.description,
        bullish: p.bullish,
        target: p.target,
        stopLoss: p.stopLoss
      })),
      candlestickPatterns: candlestickPatterns.map(c => ({
        name: c.name,
        type: c.type,
        bullish: c.bullish,
        confidence: c.confidence
      }))
    };
  }

  /**
   * Detect support and resistance levels
   */
  public detectSupportResistanceLevels(data: OHLCVData[]): {
    support: SupportResistanceLevel[];
    resistance: SupportResistanceLevel[];
  } {
    if (data.length < 20) {
      return { support: [], resistance: [] };
    }

    const highs = data.map(d => d.high);
    const lows = data.map(d => d.low);
    const volumes = data.map(d => d.volume);

    const peaks = this.findPeaks(highs, 3);
    const troughs = this.findTroughs(lows, 3);

    const resistanceLevels = this.createSupportResistanceLevels(peaks, highs, volumes, 'resistance');
    const supportLevels = this.createSupportResistanceLevels(troughs, lows, volumes, 'support');

    return {
      support: supportLevels.sort((a, b) => b.strength - a.strength).slice(0, 5),
      resistance: resistanceLevels.sort((a, b) => b.strength - a.strength).slice(0, 5)
    };
  }

  /**
   * Detect chart patterns
   */
  private detectChartPatterns(data: OHLCVData[]): ChartPattern[] {
    const patterns: ChartPattern[] = [];

    // Triangle patterns
    patterns.push(...this.detectTrianglePatterns(data));

    // Head and shoulders patterns
    patterns.push(...this.detectHeadAndShouldersPatterns(data));

    // Double top/bottom patterns
    patterns.push(...this.detectDoubleTopBottomPatterns(data));

    // Flag and pennant patterns
    patterns.push(...this.detectFlagPennantPatterns(data));

    // Cup and handle patterns
    patterns.push(...this.detectCupHandlePatterns(data));

    // Wedge patterns
    patterns.push(...this.detectWedgePatterns(data));

    return patterns.filter(p => p.confidence > 60);
  }

  /**
   * Detect candlestick patterns
   */
  private detectCandlestickPatterns(data: OHLCVData[]): CandlestickPattern[] {
    const patterns: CandlestickPattern[] = [];

    if (data.length < 3) return patterns;

    // Single candle patterns
    patterns.push(...this.detectSingleCandlePatterns(data));

    // Two-candle patterns
    patterns.push(...this.detectTwoCandlePatterns(data));

    // Three-candle patterns
    patterns.push(...this.detectThreeCandlePatterns(data));

    return patterns.filter(p => p.confidence > 60);
  }

  /**
   * Find peaks in data
   */
  private findPeaks(values: number[], lookback: number): { index: number; value: number }[] {
    const peaks: { index: number; value: number }[] = [];

    for (let i = lookback; i < values.length - lookback; i++) {
      let isPeak = true;

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
   * Find troughs in data
   */
  private findTroughs(values: number[], lookback: number): { index: number; value: number }[] {
    const troughs: { index: number; value: number }[] = [];

    for (let i = lookback; i < values.length - lookback; i++) {
      let isTrough = true;

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
   * Create support/resistance levels from peaks/troughs
   */
  private createSupportResistanceLevels(
    points: { index: number; value: number }[],
    values: number[],
    volumes: number[],
    type: 'support' | 'resistance'
  ): SupportResistanceLevel[] {
    const levels: SupportResistanceLevel[] = [];

    for (const point of points) {
      let touches = 1;
      let totalVolume = volumes[point.index] || 0;
      const recentIndex = Math.max(0, values.length - 20);

      // Count touches within threshold
      for (let i = 0; i < values.length; i++) {
        if (i === point.index) continue;

        const distance = Math.abs(values[i] - point.value) / point.value;
        if (distance <= this.supportResistanceThreshold) {
          touches++;
          totalVolume += volumes[i] || 0;
        }
      }

      if (touches >= this.minTouches) {
        const strength = this.calculateLevelStrength(touches, totalVolume, volumes, point.index >= recentIndex);
        const confidence = Math.min(100, strength);

        levels.push({
          price: point.value,
          strength,
          type,
          touches,
          volume: totalVolume,
          confidence,
          recent: point.index >= recentIndex
        });
      }
    }

    return levels;
  }

  /**
   * Calculate strength of support/resistance level
   */
  private calculateLevelStrength(
    touches: number,
    totalVolume: number,
    allVolumes: number[],
    isRecent: boolean
  ): number {
    let strength = 0;

    // Touch strength (max 40 points)
    strength += Math.min(40, (touches / 5) * 40);

    // Volume strength (max 30 points)
    if (this.volumeWeightEnabled && allVolumes.length > 0) {
      const avgVolume = allVolumes.reduce((sum, vol) => sum + vol, 0) / allVolumes.length;
      const volumeStrength = avgVolume > 0 ? Math.min(30, (totalVolume / avgVolume) * 10) : 0;
      strength += volumeStrength;
    }

    // Recency bonus (20 points)
    if (isRecent) strength += 20;

    // Base strength (10 points)
    strength += 10;

    return Math.min(100, strength);
  }

  /**
   * Detect triangle patterns
   */
  private detectTrianglePatterns(data: OHLCVData[]): ChartPattern[] {
    const patterns: ChartPattern[] = [];

    if (data.length < 20) return patterns;

    const highs = data.map(d => d.high);
    const lows = data.map(d => d.low);

    // Ascending triangle
    const ascendingTriangle = this.detectAscendingTriangle(data);
    if (ascendingTriangle) patterns.push(ascendingTriangle);

    // Descending triangle
    const descendingTriangle = this.detectDescendingTriangle(data);
    if (descendingTriangle) patterns.push(descendingTriangle);

    // Symmetrical triangle
    const symmetricalTriangle = this.detectSymmetricalTriangle(data);
    if (symmetricalTriangle) patterns.push(symmetricalTriangle);

    return patterns;
  }

  /**
   * Detect ascending triangle
   */
  private detectAscendingTriangle(data: OHLCVData[]): ChartPattern | null {
    if (data.length < 20) return null;

    const highs = data.map(d => d.high);
    const lows = data.map(d => d.low);
    
    // Find horizontal resistance and ascending support
    const peaks = this.findPeaks(highs, 2);
    const troughs = this.findTroughs(lows, 2);

    if (peaks.length < 2 || troughs.length < 2) return null;

    // Check for horizontal resistance (peaks at similar levels)
    const recentPeaks = peaks.slice(-3);
    const peakLevels = recentPeaks.map(p => p.value);
    const avgPeakLevel = peakLevels.reduce((sum, level) => sum + level, 0) / peakLevels.length;
    const peakVariation = Math.max(...peakLevels) - Math.min(...peakLevels);
    const horizontalResistance = (peakVariation / avgPeakLevel) < 0.03; // Within 3%

    // Check for ascending support (rising lows)
    const recentTroughs = troughs.slice(-3);
    const ascendingSupport = recentTroughs.length >= 2 && 
      recentTroughs[recentTroughs.length - 1].value > recentTroughs[0].value;

    if (horizontalResistance && ascendingSupport) {
      const startIndex = Math.min(...recentTroughs.map(t => t.index));
      const endIndex = data.length - 1;
      const confidence = 75;

      return {
        name: 'Ascending Triangle',
        type: 'breakout',
        confidence,
        bullish: true,
        startIndex,
        endIndex,
        keyLevels: [avgPeakLevel, recentTroughs[recentTroughs.length - 1].value],
        target: avgPeakLevel * 1.1, // 10% above resistance
        stopLoss: recentTroughs[recentTroughs.length - 1].value * 0.95,
        description: 'Ascending triangle with horizontal resistance and rising support - bullish breakout expected'
      };
    }

    return null;
  }

  /**
   * Detect descending triangle
   */
  private detectDescendingTriangle(data: OHLCVData[]): ChartPattern | null {
    if (data.length < 20) return null;

    const highs = data.map(d => d.high);
    const lows = data.map(d => d.low);
    
    const peaks = this.findPeaks(highs, 2);
    const troughs = this.findTroughs(lows, 2);

    if (peaks.length < 2 || troughs.length < 2) return null;

    // Check for horizontal support (troughs at similar levels)
    const recentTroughs = troughs.slice(-3);
    const troughLevels = recentTroughs.map(t => t.value);
    const avgTroughLevel = troughLevels.reduce((sum, level) => sum + level, 0) / troughLevels.length;
    const troughVariation = Math.max(...troughLevels) - Math.min(...troughLevels);
    const horizontalSupport = (troughVariation / avgTroughLevel) < 0.03;

    // Check for descending resistance (falling highs)
    const recentPeaks = peaks.slice(-3);
    const descendingResistance = recentPeaks.length >= 2 && 
      recentPeaks[recentPeaks.length - 1].value < recentPeaks[0].value;

    if (horizontalSupport && descendingResistance) {
      const startIndex = Math.min(...recentPeaks.map(p => p.index));
      const endIndex = data.length - 1;
      const confidence = 75;

      return {
        name: 'Descending Triangle',
        type: 'breakout',
        confidence,
        bullish: false,
        startIndex,
        endIndex,
        keyLevels: [recentPeaks[recentPeaks.length - 1].value, avgTroughLevel],
        target: avgTroughLevel * 0.9, // 10% below support
        stopLoss: recentPeaks[recentPeaks.length - 1].value * 1.05,
        description: 'Descending triangle with horizontal support and falling resistance - bearish breakdown expected'
      };
    }

    return null;
  }

  /**
   * Detect symmetrical triangle
   */
  private detectSymmetricalTriangle(data: OHLCVData[]): ChartPattern | null {
    if (data.length < 25) return null;

    const highs = data.map(d => d.high);
    const lows = data.map(d => d.low);
    
    const peaks = this.findPeaks(highs, 2);
    const troughs = this.findTroughs(lows, 2);

    if (peaks.length < 3 || troughs.length < 3) return null;

    const recentPeaks = peaks.slice(-3);
    const recentTroughs = troughs.slice(-3);

    // Check for converging trendlines
    const descendingResistance = recentPeaks[2].value < recentPeaks[0].value;
    const ascendingSupport = recentTroughs[2].value > recentTroughs[0].value;

    if (descendingResistance && ascendingSupport) {
      const startIndex = Math.min(recentPeaks[0].index, recentTroughs[0].index);
      const endIndex = data.length - 1;
      const confidence = 70;

      const currentPrice = data[data.length - 1].close;
      const range = recentPeaks[0].value - recentTroughs[0].value;

      return {
        name: 'Symmetrical Triangle',
        type: 'breakout',
        confidence,
        bullish: true, // Neutral but default to bullish for memecoins
        startIndex,
        endIndex,
        keyLevels: [recentPeaks[2].value, recentTroughs[2].value],
        target: currentPrice + (range * 0.5),
        stopLoss: currentPrice - (range * 0.3),
        description: 'Symmetrical triangle with converging trendlines - breakout direction determines trend'
      };
    }

    return null;
  }

  /**
   * Detect head and shoulders patterns
   */
  private detectHeadAndShouldersPatterns(data: OHLCVData[]): ChartPattern[] {
    const patterns: ChartPattern[] = [];

    if (data.length < 30) return patterns;

    // Head and shoulders top
    const headAndShouldersTop = this.detectHeadAndShouldersTop(data);
    if (headAndShouldersTop) patterns.push(headAndShouldersTop);

    // Inverse head and shoulders
    const inverseHeadAndShoulders = this.detectInverseHeadAndShoulders(data);
    if (inverseHeadAndShoulders) patterns.push(inverseHeadAndShoulders);

    return patterns;
  }

  /**
   * Detect head and shoulders top
   */
  private detectHeadAndShouldersTop(data: OHLCVData[]): ChartPattern | null {
    const highs = data.map(d => d.high);
    const peaks = this.findPeaks(highs, 3);

    if (peaks.length < 3) return null;

    const recentPeaks = peaks.slice(-3);
    const [leftShoulder, head, rightShoulder] = recentPeaks;

    // Check if middle peak is highest (head)
    const isHead = head.value > leftShoulder.value && head.value > rightShoulder.value;
    
    // Check if shoulders are roughly equal
    const shoulderDifference = Math.abs(leftShoulder.value - rightShoulder.value) / leftShoulder.value;
    const symmetricalShoulders = shoulderDifference < 0.05; // Within 5%

    if (isHead && symmetricalShoulders) {
      const neckline = (leftShoulder.value + rightShoulder.value) / 2;
      const headHeight = head.value - neckline;
      
      return {
        name: 'Head and Shoulders Top',
        type: 'reversal',
        confidence: 80,
        bullish: false,
        startIndex: leftShoulder.index,
        endIndex: rightShoulder.index,
        keyLevels: [head.value, neckline],
        target: neckline - headHeight,
        stopLoss: head.value,
        description: 'Head and shoulders top pattern - bearish reversal signal'
      };
    }

    return null;
  }

  /**
   * Detect inverse head and shoulders
   */
  private detectInverseHeadAndShoulders(data: OHLCVData[]): ChartPattern | null {
    const lows = data.map(d => d.low);
    const troughs = this.findTroughs(lows, 3);

    if (troughs.length < 3) return null;

    const recentTroughs = troughs.slice(-3);
    const [leftShoulder, head, rightShoulder] = recentTroughs;

    // Check if middle trough is lowest (head)
    const isHead = head.value < leftShoulder.value && head.value < rightShoulder.value;
    
    // Check if shoulders are roughly equal
    const shoulderDifference = Math.abs(leftShoulder.value - rightShoulder.value) / leftShoulder.value;
    const symmetricalShoulders = shoulderDifference < 0.05;

    if (isHead && symmetricalShoulders) {
      const neckline = (leftShoulder.value + rightShoulder.value) / 2;
      const headDepth = neckline - head.value;
      
      return {
        name: 'Inverse Head and Shoulders',
        type: 'reversal',
        confidence: 80,
        bullish: true,
        startIndex: leftShoulder.index,
        endIndex: rightShoulder.index,
        keyLevels: [head.value, neckline],
        target: neckline + headDepth,
        stopLoss: head.value,
        description: 'Inverse head and shoulders pattern - bullish reversal signal'
      };
    }

    return null;
  }

  /**
   * Detect double top/bottom patterns
   */
  private detectDoubleTopBottomPatterns(data: OHLCVData[]): ChartPattern[] {
    const patterns: ChartPattern[] = [];

    // Double top
    const doubleTop = this.detectDoubleTop(data);
    if (doubleTop) patterns.push(doubleTop);

    // Double bottom
    const doubleBottom = this.detectDoubleBottom(data);
    if (doubleBottom) patterns.push(doubleBottom);

    return patterns;
  }

  /**
   * Detect double top
   */
  private detectDoubleTop(data: OHLCVData[]): ChartPattern | null {
    if (data.length < 20) return null;

    const highs = data.map(d => d.high);
    const peaks = this.findPeaks(highs, 3);

    if (peaks.length < 2) return null;

    const recentPeaks = peaks.slice(-2);
    const [firstPeak, secondPeak] = recentPeaks;

    // Check if peaks are at similar levels
    const priceDifference = Math.abs(firstPeak.value - secondPeak.value) / firstPeak.value;
    const similarLevels = priceDifference < 0.03; // Within 3%

    // Check for valley between peaks
    const valleyStart = firstPeak.index;
    const valleyEnd = secondPeak.index;
    const valleyLows = data.slice(valleyStart, valleyEnd + 1).map(d => d.low);
    const valleyLow = Math.min(...valleyLows);
    const valleyDepth = ((firstPeak.value + secondPeak.value) / 2 - valleyLow) / firstPeak.value;

    if (similarLevels && valleyDepth > 0.05) { // Valley depth > 5%
      const neckline = valleyLow;
      const patternHeight = firstPeak.value - neckline;

      return {
        name: 'Double Top',
        type: 'reversal',
        confidence: 75,
        bullish: false,
        startIndex: firstPeak.index,
        endIndex: secondPeak.index,
        keyLevels: [firstPeak.value, neckline],
        target: neckline - patternHeight,
        stopLoss: Math.max(firstPeak.value, secondPeak.value),
        description: 'Double top pattern - bearish reversal signal'
      };
    }

    return null;
  }

  /**
   * Detect double bottom
   */
  private detectDoubleBottom(data: OHLCVData[]): ChartPattern | null {
    if (data.length < 20) return null;

    const lows = data.map(d => d.low);
    const troughs = this.findTroughs(lows, 3);

    if (troughs.length < 2) return null;

    const recentTroughs = troughs.slice(-2);
    const [firstTrough, secondTrough] = recentTroughs;

    // Check if troughs are at similar levels
    const priceDifference = Math.abs(firstTrough.value - secondTrough.value) / firstTrough.value;
    const similarLevels = priceDifference < 0.03;

    // Check for peak between troughs
    const peakStart = firstTrough.index;
    const peakEnd = secondTrough.index;
    const peakHighs = data.slice(peakStart, peakEnd + 1).map(d => d.high);
    const peakHigh = Math.max(...peakHighs);
    const peakHeight = (peakHigh - (firstTrough.value + secondTrough.value) / 2) / firstTrough.value;

    if (similarLevels && peakHeight > 0.05) {
      const neckline = peakHigh;
      const patternHeight = neckline - firstTrough.value;

      return {
        name: 'Double Bottom',
        type: 'reversal',
        confidence: 75,
        bullish: true,
        startIndex: firstTrough.index,
        endIndex: secondTrough.index,
        keyLevels: [firstTrough.value, neckline],
        target: neckline + patternHeight,
        stopLoss: Math.min(firstTrough.value, secondTrough.value),
        description: 'Double bottom pattern - bullish reversal signal'
      };
    }

    return null;
  }

  /**
   * Detect flag and pennant patterns (continuation patterns)
   */
  private detectFlagPennantPatterns(data: OHLCVData[]): ChartPattern[] {
    const patterns: ChartPattern[] = [];

    // Bull flag
    const bullFlag = this.detectBullFlag(data);
    if (bullFlag) patterns.push(bullFlag);

    // Bear flag  
    const bearFlag = this.detectBearFlag(data);
    if (bearFlag) patterns.push(bearFlag);

    return patterns;
  }

  /**
   * Detect bull flag pattern
   */
  private detectBullFlag(data: OHLCVData[]): ChartPattern | null {
    if (data.length < 15) return null;

    const closes = data.map(d => d.close);
    
    // Look for strong upward move followed by consolidation
    const recentData = data.slice(-15);
    const flagStart = 5; // Look back 5 periods for the pole
    
    const poleData = recentData.slice(0, flagStart);
    const flagData = recentData.slice(flagStart);

    // Check for strong upward pole
    const poleGain = (poleData[poleData.length - 1].close - poleData[0].open) / poleData[0].open;
    const strongPole = poleGain > 0.15; // 15% gain

    // Check for sideways/slight downward flag
    const flagRange = Math.max(...flagData.map(d => d.high)) - Math.min(...flagData.map(d => d.low));
    const flagMidpoint = (Math.max(...flagData.map(d => d.high)) + Math.min(...flagData.map(d => d.low))) / 2;
    const tightFlag = (flagRange / flagMidpoint) < 0.1; // Flag range < 10%

    if (strongPole && tightFlag) {
      const currentPrice = data[data.length - 1].close;
      const poleHeight = poleData[poleData.length - 1].close - poleData[0].open;

      return {
        name: 'Bull Flag',
        type: 'continuation',
        confidence: 70,
        bullish: true,
        startIndex: data.length - 15,
        endIndex: data.length - 1,
        keyLevels: [Math.max(...flagData.map(d => d.high)), Math.min(...flagData.map(d => d.low))],
        target: currentPrice + poleHeight,
        stopLoss: Math.min(...flagData.map(d => d.low)),
        description: 'Bull flag pattern - bullish continuation signal'
      };
    }

    return null;
  }

  /**
   * Detect bear flag pattern
   */
  private detectBearFlag(data: OHLCVData[]): ChartPattern | null {
    if (data.length < 15) return null;

    const recentData = data.slice(-15);
    const flagStart = 5;
    
    const poleData = recentData.slice(0, flagStart);
    const flagData = recentData.slice(flagStart);

    // Check for strong downward pole
    const poleLoss = (poleData[0].open - poleData[poleData.length - 1].close) / poleData[0].open;
    const strongPole = poleLoss > 0.15; // 15% loss

    // Check for sideways/slight upward flag
    const flagRange = Math.max(...flagData.map(d => d.high)) - Math.min(...flagData.map(d => d.low));
    const flagMidpoint = (Math.max(...flagData.map(d => d.high)) + Math.min(...flagData.map(d => d.low))) / 2;
    const tightFlag = (flagRange / flagMidpoint) < 0.1;

    if (strongPole && tightFlag) {
      const currentPrice = data[data.length - 1].close;
      const poleHeight = poleData[0].open - poleData[poleData.length - 1].close;

      return {
        name: 'Bear Flag',
        type: 'continuation',
        confidence: 70,
        bullish: false,
        startIndex: data.length - 15,
        endIndex: data.length - 1,
        keyLevels: [Math.max(...flagData.map(d => d.high)), Math.min(...flagData.map(d => d.low))],
        target: currentPrice - poleHeight,
        stopLoss: Math.max(...flagData.map(d => d.high)),
        description: 'Bear flag pattern - bearish continuation signal'
      };
    }

    return null;
  }

  /**
   * Detect cup and handle patterns
   */
  private detectCupHandlePatterns(data: OHLCVData[]): ChartPattern[] {
    const patterns: ChartPattern[] = [];

    const cupHandle = this.detectCupAndHandle(data);
    if (cupHandle) patterns.push(cupHandle);

    return patterns;
  }

  /**
   * Detect cup and handle pattern
   */
  private detectCupAndHandle(data: OHLCVData[]): ChartPattern | null {
    if (data.length < 30) return null;

    // This is a simplified detection - full implementation would be more complex
    const lows = data.map(d => d.low);
    const highs = data.map(d => d.high);
    
    // Look for U-shaped bottom followed by small consolidation
    const cupData = data.slice(-25, -5);
    const handleData = data.slice(-5);

    // Find cup bottom
    const cupLow = Math.min(...cupData.map(d => d.low));
    const cupHigh = Math.max(cupData[0].high, cupData[cupData.length - 1].high);
    const cupDepth = (cupHigh - cupLow) / cupHigh;

    // Check cup characteristics
    const validCup = cupDepth > 0.12 && cupDepth < 0.5; // 12-50% depth

    // Check handle characteristics  
    const handleHigh = Math.max(...handleData.map(d => d.high));
    const handleLow = Math.min(...handleData.map(d => d.low));
    const handleDepth = (handleHigh - handleLow) / handleHigh;
    const validHandle = handleDepth < 0.12; // Handle < 12% depth

    if (validCup && validHandle) {
      const targetHeight = cupHigh - cupLow;
      
      return {
        name: 'Cup and Handle',
        type: 'continuation',
        confidence: 65,
        bullish: true,
        startIndex: data.length - 25,
        endIndex: data.length - 1,
        keyLevels: [cupHigh, cupLow, handleHigh],
        target: cupHigh + targetHeight,
        stopLoss: handleLow,
        description: 'Cup and handle pattern - bullish continuation signal'
      };
    }

    return null;
  }

  /**
   * Detect wedge patterns
   */
  private detectWedgePatterns(data: OHLCVData[]): ChartPattern[] {
    const patterns: ChartPattern[] = [];

    // Rising wedge (bearish)
    const risingWedge = this.detectRisingWedge(data);
    if (risingWedge) patterns.push(risingWedge);

    // Falling wedge (bullish)
    const fallingWedge = this.detectFallingWedge(data);
    if (fallingWedge) patterns.push(fallingWedge);

    return patterns;
  }

  /**
   * Detect rising wedge (bearish pattern)
   */
  private detectRisingWedge(data: OHLCVData[]): ChartPattern | null {
    if (data.length < 20) return null;

    const highs = data.map(d => d.high);
    const lows = data.map(d => d.low);

    const peaks = this.findPeaks(highs, 2);
    const troughs = this.findTroughs(lows, 2);

    if (peaks.length < 3 || troughs.length < 3) return null;

    const recentPeaks = peaks.slice(-3);
    const recentTroughs = troughs.slice(-3);

    // Check for rising highs and rising lows, but lows rising faster
    const risingHighs = recentPeaks[2].value > recentPeaks[0].value;
    const risingLows = recentTroughs[2].value > recentTroughs[0].value;

    // Calculate slopes
    const highSlope = (recentPeaks[2].value - recentPeaks[0].value) / (recentPeaks[2].index - recentPeaks[0].index);
    const lowSlope = (recentTroughs[2].value - recentTroughs[0].value) / (recentTroughs[2].index - recentTroughs[0].index);

    // Rising wedge: both rising but lows rising faster (converging upward)
    const convergingUpward = risingHighs && risingLows && (lowSlope > highSlope * 1.5);

    if (convergingUpward) {
      return {
        name: 'Rising Wedge',
        type: 'reversal',
        confidence: 70,
        bullish: false,
        startIndex: Math.min(recentPeaks[0].index, recentTroughs[0].index),
        endIndex: data.length - 1,
        keyLevels: [recentPeaks[2].value, recentTroughs[2].value],
        target: recentTroughs[0].value,
        stopLoss: recentPeaks[2].value,
        description: 'Rising wedge pattern - bearish reversal signal'
      };
    }

    return null;
  }

  /**
   * Detect falling wedge (bullish pattern)
   */
  private detectFallingWedge(data: OHLCVData[]): ChartPattern | null {
    if (data.length < 20) return null;

    const highs = data.map(d => d.high);
    const lows = data.map(d => d.low);

    const peaks = this.findPeaks(highs, 2);
    const troughs = this.findTroughs(lows, 2);

    if (peaks.length < 3 || troughs.length < 3) return null;

    const recentPeaks = peaks.slice(-3);
    const recentTroughs = troughs.slice(-3);

    // Check for falling highs and falling lows, but highs falling faster
    const fallingHighs = recentPeaks[2].value < recentPeaks[0].value;
    const fallingLows = recentTroughs[2].value < recentTroughs[0].value;

    // Calculate slopes (negative for falling)
    const highSlope = (recentPeaks[2].value - recentPeaks[0].value) / (recentPeaks[2].index - recentPeaks[0].index);
    const lowSlope = (recentTroughs[2].value - recentTroughs[0].value) / (recentTroughs[2].index - recentTroughs[0].index);

    // Falling wedge: both falling but highs falling faster (converging downward)
    const convergingDownward = fallingHighs && fallingLows && (Math.abs(highSlope) > Math.abs(lowSlope) * 1.5);

    if (convergingDownward) {
      return {
        name: 'Falling Wedge',
        type: 'reversal',
        confidence: 70,
        bullish: true,
        startIndex: Math.min(recentPeaks[0].index, recentTroughs[0].index),
        endIndex: data.length - 1,
        keyLevels: [recentPeaks[2].value, recentTroughs[2].value],
        target: recentPeaks[0].value,
        stopLoss: recentTroughs[2].value,
        description: 'Falling wedge pattern - bullish reversal signal'
      };
    }

    return null;
  }

  /**
   * Detect single candle patterns
   */
  private detectSingleCandlePatterns(data: OHLCVData[]): CandlestickPattern[] {
    const patterns: CandlestickPattern[] = [];
    const lastCandle = data[data.length - 1];
    const index = data.length - 1;

    const open = lastCandle.open;
    const high = lastCandle.high;
    const low = lastCandle.low;
    const close = lastCandle.close;

    const bodySize = Math.abs(close - open);
    const totalRange = high - low;
    const upperShadow = high - Math.max(open, close);
    const lowerShadow = Math.min(open, close) - low;

    // Doji
    if (bodySize / totalRange < 0.1) {
      patterns.push({
        name: 'Doji',
        type: 'reversal',
        bullish: false,
        confidence: 60,
        description: 'Doji candle indicates indecision',
        index,
        significance: 'medium'
      });
    }

    // Hammer (bullish reversal)
    if (lowerShadow > bodySize * 2 && upperShadow < bodySize * 0.5 && close < open) {
      patterns.push({
        name: 'Hammer',
        type: 'reversal',
        bullish: true,
        confidence: 75,
        description: 'Hammer pattern - potential bullish reversal',
        index,
        significance: 'high'
      });
    }

    // Shooting Star (bearish reversal)
    if (upperShadow > bodySize * 2 && lowerShadow < bodySize * 0.5 && close < open) {
      patterns.push({
        name: 'Shooting Star',
        type: 'reversal',
        bullish: false,
        confidence: 75,
        description: 'Shooting star pattern - potential bearish reversal',
        index,
        significance: 'high'
      });
    }

    return patterns;
  }

  /**
   * Detect two candle patterns
   */
  private detectTwoCandlePatterns(data: OHLCVData[]): CandlestickPattern[] {
    const patterns: CandlestickPattern[] = [];
    
    if (data.length < 2) return patterns;

    const current = data[data.length - 1];
    const previous = data[data.length - 2];
    const index = data.length - 1;

    // Bullish Engulfing
    if (previous.close < previous.open && // Previous bearish
        current.close > current.open && // Current bullish
        current.open < previous.close && // Gap down
        current.close > previous.open) { // Engulfing
      
      patterns.push({
        name: 'Bullish Engulfing',
        type: 'reversal',
        bullish: true,
        confidence: 80,
        description: 'Bullish engulfing pattern - strong reversal signal',
        index,
        significance: 'high'
      });
    }

    // Bearish Engulfing
    if (previous.close > previous.open && // Previous bullish
        current.close < current.open && // Current bearish
        current.open > previous.close && // Gap up
        current.close < previous.open) { // Engulfing
      
      patterns.push({
        name: 'Bearish Engulfing',
        type: 'reversal',
        bullish: false,
        confidence: 80,
        description: 'Bearish engulfing pattern - strong reversal signal',
        index,
        significance: 'high'
      });
    }

    return patterns;
  }

  /**
   * Detect three candle patterns
   */
  private detectThreeCandlePatterns(data: OHLCVData[]): CandlestickPattern[] {
    const patterns: CandlestickPattern[] = [];
    
    if (data.length < 3) return patterns;

    const third = data[data.length - 1];
    const second = data[data.length - 2];
    const first = data[data.length - 3];
    const index = data.length - 1;

    // Morning Star (bullish reversal)
    if (first.close < first.open && // First bearish
        Math.abs(second.close - second.open) < (first.open - first.close) * 0.3 && // Small body
        third.close > third.open && // Third bullish
        third.close > (first.open + first.close) / 2) { // Third closes above midpoint
      
      patterns.push({
        name: 'Morning Star',
        type: 'reversal',
        bullish: true,
        confidence: 85,
        description: 'Morning star pattern - strong bullish reversal',
        index,
        significance: 'high'
      });
    }

    // Evening Star (bearish reversal)
    if (first.close > first.open && // First bullish
        Math.abs(second.close - second.open) < (first.close - first.open) * 0.3 && // Small body
        third.close < third.open && // Third bearish
        third.close < (first.open + first.close) / 2) { // Third closes below midpoint
      
      patterns.push({
        name: 'Evening Star',
        type: 'reversal',
        bullish: false,
        confidence: 85,
        description: 'Evening star pattern - strong bearish reversal',
        index,
        significance: 'high'
      });
    }

    return patterns;
  }

  /**
   * Get default pattern analysis for insufficient data
   */
  private getDefaultPatternAnalysis(): PatternAnalysis {
    return {
      patterns: [],
      candlestickPatterns: []
    };
  }
}