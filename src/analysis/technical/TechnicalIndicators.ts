/**
 * Technical Indicators Implementation
 * Optimized for memecoin analysis with high volatility considerations
 */

import { OHLCVData, IndicatorConfig } from './types';
import { TechnicalIndicators as TechnicalIndicatorsInterface, TimeframeIndicators, MultiTimeframeData } from '../../types/analysis';

export class TechnicalIndicators {
  private config: IndicatorConfig;

  constructor(config?: Partial<IndicatorConfig>) {
    this.config = {
      rsi: {
        period: 14,
        overbought: 70,
        oversold: 30,
        ...config?.rsi
      },
      macd: {
        fastPeriod: 12,
        slowPeriod: 26,
        signalPeriod: 9,
        ...config?.macd
      },
      bollinger: {
        period: 20,
        stdDev: 2,
        ...config?.bollinger
      },
      ema: {
        periods: [9, 21, 50],
        ...config?.ema
      },
      volume: {
        smaLookback: 20,
        spikeThreshold: 2.0,
        ...config?.volume
      }
    };
  }

  /**
   * Calculate indicators for all timeframes
   */
  public calculateMultiTimeframe(data: OHLCVData[]): MultiTimeframeData {
    const timeframes = ['1h', '4h'];
    const weights = { '4h': 0.6, '1h': 0.4 };
    
    const result: Partial<MultiTimeframeData> = {};
    
    for (const timeframe of timeframes) {
      const timeframeData = this.aggregateToTimeframe(data, timeframe);
      if (timeframeData.length > 0) {
        result[timeframe as keyof MultiTimeframeData] = this.calculateTimeframeIndicators(
          timeframeData, 
          timeframe, 
          weights[timeframe as keyof typeof weights]
        );
      }
    }
    
    return result as MultiTimeframeData;
  }

  /**
   * Calculate indicators for a specific timeframe
   */
  private calculateTimeframeIndicators(data: OHLCVData[], timeframe: string, weight: number): TimeframeIndicators {
    const baseIndicators = this.calculateAll(data);
    
    return {
      ...baseIndicators,
      timeframe,
      weight,
      dataPoints: data.length,
      exhaustionSignals: this.detectExhaustionSignals(data, baseIndicators)
    };
  }

  /**
   * Aggregate 1-minute data to larger timeframes
   */
  private aggregateToTimeframe(data: OHLCVData[], timeframe: string): OHLCVData[] {
    const intervalMinutes = this.getTimeframeMinutes(timeframe);
    const intervalMs = intervalMinutes * 60 * 1000;
    
    if (intervalMinutes === 1) {
      return data; // Already 1-minute data
    }
    
    const aggregated: OHLCVData[] = [];
    const groups = new Map<number, OHLCVData[]>();
    
    // Group data by interval
    for (const candle of data) {
      const intervalStart = Math.floor(candle.timestamp / intervalMs) * intervalMs;
      if (!groups.has(intervalStart)) {
        groups.set(intervalStart, []);
      }
      groups.get(intervalStart)!.push(candle);
    }
    
    // Aggregate each group
    for (const [timestamp, candles] of groups) {
      if (candles.length === 0) continue;
      
      candles.sort((a, b) => a.timestamp - b.timestamp);
      
      const aggregatedCandle: OHLCVData = {
        open: candles[0].open,
        high: Math.max(...candles.map(c => c.high)),
        low: Math.min(...candles.map(c => c.low)),
        close: candles[candles.length - 1].close,
        volume: candles.reduce((sum, c) => sum + c.volume, 0),
        timestamp
      };
      
      aggregated.push(aggregatedCandle);
    }
    
    return aggregated.sort((a, b) => a.timestamp - b.timestamp);
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

  /**
   * Detect exhaustion signals for a timeframe
   */
  private detectExhaustionSignals(data: OHLCVData[], indicators: TechnicalIndicatorsInterface) {
    const volumes = data.map(d => d.volume);
    const avgVolume = volumes.length > 20 ? 
      volumes.slice(-20).reduce((sum, v) => sum + v, 0) / 20 : 
      volumes.reduce((sum, v) => sum + v, 0) / volumes.length;
    
    const currentVolume = volumes[volumes.length - 1];
    const volumeSpikeThreshold = this.config.volume.spikeThreshold;
    
    // Count consecutive RSI overbought/oversold periods
    const rsiOverboughtPeriods = this.countConsecutiveRsiPeriods(data, 'overbought');
    const rsiOversoldPeriods = this.countConsecutiveRsiPeriods(data, 'oversold');
    
    return {
      rsiOverbought: {
        active: indicators.rsi > this.config.rsi.overbought,
        periods: rsiOverboughtPeriods
      },
      rsiOversold: {
        active: indicators.rsi < this.config.rsi.oversold,
        periods: rsiOversoldPeriods
      },
      volumeSpike: {
        active: currentVolume > avgVolume * volumeSpikeThreshold,
        threshold: currentVolume / avgVolume
      },
      divergence: this.detectPriceMomentumDivergence(data, indicators)
    };
  }

  /**
   * Count consecutive RSI overbought/oversold periods
   */
  private countConsecutiveRsiPeriods(data: OHLCVData[], condition: 'overbought' | 'oversold'): number {
    const closes = data.map(d => d.close);
    let consecutiveCount = 0;
    
    // Calculate RSI for recent periods
    const recentPeriods = Math.min(10, Math.floor(closes.length / 2));
    
    for (let i = closes.length - 1; i >= closes.length - recentPeriods && i >= this.config.rsi.period; i--) {
      const periodCloses = closes.slice(0, i + 1);
      const rsi = this.calculateRSI(periodCloses);
      
      const isCondition = condition === 'overbought' ? 
        rsi > this.config.rsi.overbought : 
        rsi < this.config.rsi.oversold;
      
      if (isCondition) {
        consecutiveCount++;
      } else {
        break;
      }
    }
    
    return consecutiveCount;
  }

  /**
   * Detect price-momentum divergence
   */
  private detectPriceMomentumDivergence(data: OHLCVData[], indicators: TechnicalIndicatorsInterface) {
    if (data.length < 20) {
      return { detected: false, type: null };
    }
    
    const closes = data.map(d => d.close);
    const recentPrices = closes.slice(-10);
    const olderPrices = closes.slice(-20, -10);
    
    const recentHigh = Math.max(...recentPrices);
    const recentLow = Math.min(...recentPrices);
    const olderHigh = Math.max(...olderPrices);
    const olderLow = Math.min(...olderPrices);
    
    // Calculate RSI for both periods
    const recentRsi = this.calculateRSI(closes.slice(-15));
    const olderRsi = this.calculateRSI(closes.slice(-25, -10));
    
    // Bullish divergence: price makes lower lows, RSI makes higher lows
    const bullishDivergence = recentLow < olderLow && recentRsi > olderRsi && recentRsi < 40;
    
    // Bearish divergence: price makes higher highs, RSI makes lower highs
    const bearishDivergence = recentHigh > olderHigh && recentRsi < olderRsi && recentRsi > 60;
    
    if (bullishDivergence) {
      return { detected: true, type: 'bullish' as const };
    } else if (bearishDivergence) {
      return { detected: true, type: 'bearish' as const };
    }
    
    return { detected: false, type: null };
  }

  /**
   * Calculate all technical indicators for given data
   */
  public calculateAll(data: OHLCVData[]): TechnicalIndicatorsInterface {
    if (data.length === 0) {
      throw new Error('No data provided for technical analysis');
    }

    const closes = data.map(d => d.close);
    const highs = data.map(d => d.high);
    const lows = data.map(d => d.low);
    const volumes = data.map(d => d.volume);

    return {
      rsi: this.calculateRSI(closes),
      macd: this.calculateMACD(closes),
      bollinger: this.calculateBollingerBands(closes),
      ema: this.calculateEMAs(closes),
      sma: this.calculateSMAs(closes)
    };
  }

  /**
   * Calculate RSI (Relative Strength Index)
   * Optimized for memecoin volatility with dynamic overbought/oversold levels
   */
  public calculateRSI(closes: number[], period: number = this.config.rsi.period): number {
    if (closes.length < period + 1) {
      return 50; // Neutral RSI if insufficient data
    }

    const gains: number[] = [];
    const losses: number[] = [];

    // Calculate price changes
    for (let i = 1; i < closes.length; i++) {
      const change = closes[i] - closes[i - 1];
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? Math.abs(change) : 0);
    }

    // Calculate initial average gain and loss
    let avgGain = gains.slice(0, period).reduce((sum, gain) => sum + gain, 0) / period;
    let avgLoss = losses.slice(0, period).reduce((sum, loss) => sum + loss, 0) / period;

    // Calculate RSI using Wilder's smoothing method
    for (let i = period; i < gains.length; i++) {
      avgGain = ((avgGain * (period - 1)) + gains[i]) / period;
      avgLoss = ((avgLoss * (period - 1)) + losses[i]) / period;
    }

    if (avgLoss === 0) return 100;
    
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  /**
   * Calculate MACD (Moving Average Convergence Divergence)
   */
  public calculateMACD(closes: number[]): { macd: number; signal: number; histogram: number } {
    const { fastPeriod, slowPeriod, signalPeriod } = this.config.macd;

    if (closes.length < slowPeriod) {
      return { macd: 0, signal: 0, histogram: 0 };
    }

    const fastEMA = this.calculateEMA(closes, fastPeriod);
    const slowEMA = this.calculateEMA(closes, slowPeriod);

    // Calculate MACD line
    const macdLine = fastEMA[fastEMA.length - 1] - slowEMA[slowEMA.length - 1];

    // Calculate MACD values for signal line
    const macdValues: number[] = [];
    const minLength = Math.min(fastEMA.length, slowEMA.length);
    
    for (let i = 0; i < minLength; i++) {
      macdValues.push(fastEMA[fastEMA.length - minLength + i] - slowEMA[slowEMA.length - minLength + i]);
    }

    // Calculate signal line (EMA of MACD)
    const signalEMA = this.calculateEMA(macdValues, signalPeriod);
    const signal = signalEMA[signalEMA.length - 1];

    return {
      macd: macdLine,
      signal: signal,
      histogram: macdLine - signal
    };
  }

  /**
   * Calculate Bollinger Bands
   */
  public calculateBollingerBands(closes: number[]): { upper: number; middle: number; lower: number; position: number } {
    const { period, stdDev } = this.config.bollinger;

    if (closes.length < period) {
      const price = closes[closes.length - 1];
      return { upper: price, middle: price, lower: price, position: 0.5 };
    }

    // Calculate SMA (middle band)
    const sma = this.calculateSMA(closes, period);
    const middle = sma[sma.length - 1];

    // Calculate standard deviation
    const recentCloses = closes.slice(-period);
    const variance = recentCloses.reduce((sum, close) => sum + Math.pow(close - middle, 2), 0) / period;
    const standardDeviation = Math.sqrt(variance);

    const upper = middle + (stdDev * standardDeviation);
    const lower = middle - (stdDev * standardDeviation);

    // Calculate position within bands (0 = at lower band, 1 = at upper band)
    const currentPrice = closes[closes.length - 1];
    const position = (currentPrice - lower) / (upper - lower);

    return {
      upper,
      middle,
      lower,
      position: Math.max(0, Math.min(1, position))
    };
  }

  /**
   * Calculate multiple EMAs
   */
  public calculateEMAs(closes: number[]): Record<string, number> {
    const emas: Record<string, number> = {};

    for (const period of this.config.ema.periods) {
      const emaValues = this.calculateEMA(closes, period);
      emas[period.toString()] = emaValues[emaValues.length - 1];
    }

    return emas;
  }

  /**
   * Calculate multiple SMAs
   */
  public calculateSMAs(closes: number[]): Record<string, number> {
    const smas: Record<string, number> = {};
    const periods = [10, 20, 50, 100, 200];

    for (const period of periods) {
      if (closes.length >= period) {
        const smaValues = this.calculateSMA(closes, period);
        smas[period.toString()] = smaValues[smaValues.length - 1];
      }
    }

    return smas;
  }

  /**
   * Calculate EMA (Exponential Moving Average)
   */
  public calculateEMA(values: number[], period: number): number[] {
    if (values.length === 0) return [];
    
    const ema: number[] = [];
    const multiplier = 2 / (period + 1);

    // First EMA value is SMA
    ema[0] = values[0];

    for (let i = 1; i < values.length; i++) {
      if (i < period) {
        // Use SMA until we have enough data points
        const slice = values.slice(0, i + 1);
        ema[i] = slice.reduce((sum, val) => sum + val, 0) / slice.length;
      } else {
        // Calculate EMA
        ema[i] = (values[i] * multiplier) + (ema[i - 1] * (1 - multiplier));
      }
    }

    return ema;
  }

  /**
   * Calculate SMA (Simple Moving Average)
   */
  public calculateSMA(values: number[], period: number): number[] {
    if (values.length < period) return [];

    const sma: number[] = [];

    for (let i = period - 1; i < values.length; i++) {
      const slice = values.slice(i - period + 1, i + 1);
      const average = slice.reduce((sum, val) => sum + val, 0) / period;
      sma.push(average);
    }

    return sma;
  }

  /**
   * Check if RSI indicates overbought condition
   */
  public isOverbought(rsi: number): boolean {
    return rsi > this.config.rsi.overbought;
  }

  /**
   * Check if RSI indicates oversold condition
   */
  public isOversold(rsi: number): boolean {
    return rsi < this.config.rsi.oversold;
  }

  /**
   * Detect MACD bullish crossover
   */
  public isMACDBullishCrossover(currentMACD: { macd: number; signal: number }, previousMACD: { macd: number; signal: number }): boolean {
    return previousMACD.macd <= previousMACD.signal && currentMACD.macd > currentMACD.signal;
  }

  /**
   * Detect MACD bearish crossover
   */
  public isMACDBearishCrossover(currentMACD: { macd: number; signal: number }, previousMACD: { macd: number; signal: number }): boolean {
    return previousMACD.macd >= previousMACD.signal && currentMACD.macd < currentMACD.signal;
  }

  /**
   * Check if price is breaking out of Bollinger Bands
   */
  public isBollingerBreakout(bollinger: { upper: number; lower: number; position: number }): { upper: boolean; lower: boolean } {
    return {
      upper: bollinger.position > 1,
      lower: bollinger.position < 0
    };
  }

  /**
   * Analyze EMA alignment for trend confirmation
   */
  public analyzeEMAAlignment(emas: Record<string, number>): { bullish: boolean; bearish: boolean; strength: number } {
    const periods = this.config.ema.periods.sort((a, b) => a - b);
    let bullishAligned = true;
    let bearishAligned = true;

    // Check if EMAs are properly aligned
    for (let i = 1; i < periods.length; i++) {
      const shorter = emas[periods[i - 1].toString()];
      const longer = emas[periods[i].toString()];

      if (!shorter || !longer) continue;

      if (shorter <= longer) bullishAligned = false;
      if (shorter >= longer) bearishAligned = false;
    }

    // Calculate alignment strength based on separation
    let totalSeparation = 0;
    let separationCount = 0;

    for (let i = 1; i < periods.length; i++) {
      const shorter = emas[periods[i - 1].toString()];
      const longer = emas[periods[i].toString()];

      if (shorter && longer) {
        totalSeparation += Math.abs((shorter - longer) / longer);
        separationCount++;
      }
    }

    const strength = separationCount > 0 ? (totalSeparation / separationCount) * 100 : 0;

    return {
      bullish: bullishAligned,
      bearish: bearishAligned,
      strength: Math.min(100, strength * 10) // Scale for readability
    };
  }

  /**
   * Get indicator configuration
   */
  public getConfig(): IndicatorConfig {
    return { ...this.config };
  }

  /**
   * Update indicator configuration
   */
  public updateConfig(newConfig: Partial<IndicatorConfig>): void {
    this.config = {
      ...this.config,
      ...newConfig,
      rsi: { ...this.config.rsi, ...newConfig.rsi },
      macd: { ...this.config.macd, ...newConfig.macd },
      bollinger: { ...this.config.bollinger, ...newConfig.bollinger },
      ema: { ...this.config.ema, ...newConfig.ema },
      volume: { ...this.config.volume, ...newConfig.volume }
    };
  }
}