/**
 * Technical Analysis Module Exports
 * Main entry point for all technical analysis components
 */

// Import for local usage in factory functions
import { Logger } from 'winston';
import { TechnicalAnalysisEngine } from './TechnicalAnalysisEngine';
import { AnalysisOptions, OHLCVData } from './types';

// Core Engine
export { TechnicalAnalysisEngine } from './TechnicalAnalysisEngine';
export type { TechnicalAnalysisResult } from './TechnicalAnalysisEngine';

// System Component
export { TechnicalAnalysisSystemComponent } from './TechnicalAnalysisSystemComponent';
export type { TechnicalAnalysisComponentConfig } from './TechnicalAnalysisSystemComponent';
export { 
  createTechnicalAnalysisSystemComponent,
  createMemecoinTechnicalAnalysisSystemComponent
} from './TechnicalAnalysisSystemComponent';

// Individual Components
export { TechnicalIndicators } from './TechnicalIndicators';
export { MomentumAnalyzer } from './MomentumAnalyzer';
export { SignalGenerator } from './SignalGenerator';
export type { SignalResult, SignalWeights } from './SignalGenerator';
export { MultiTimeframeAnalyzer } from './MultiTimeframeAnalyzer';
export type { MultiTimeframeResult, TimeframeData } from './MultiTimeframeAnalyzer';
export { VolumeAnalyzer } from './VolumeAnalyzer';
export type { VolumeSignal, VolumePattern, VolumeMetrics } from './VolumeAnalyzer';
export { PatternRecognition } from './PatternRecognition';
export type { CandlestickPattern, ChartPattern } from './PatternRecognition';

// Types
export type {
  OHLCVData,
  IndicatorConfig,
  TechnicalSignal,
  MomentumMetrics,
  TimeframeWeight,
  SupportResistanceLevel,
  PatternMatch,
  VolumeProfile,
  MultiTimeframeAnalysis,
  AnalysisOptions
} from './types';

/**
 * Factory function to create a pre-configured technical analysis engine
 * optimized for memecoin analysis
 * 
 * @deprecated Use createMemecoinTechnicalAnalysisSystemComponent for system integration
 */
export function createMemecoinAnalysisEngine(customOptions?: Partial<AnalysisOptions>): TechnicalAnalysisEngine {
  const defaultMemecoinOptions: AnalysisOptions = {
    timeframes: ['1m', '5m', '15m', '1h'],
    indicators: {
      rsi: {
        period: 14,
        overbought: 75, // Slightly higher for memecoins
        oversold: 25    // Slightly lower for memecoins
      },
      macd: {
        fastPeriod: 12,
        slowPeriod: 26,
        signalPeriod: 9
      },
      bollinger: {
        period: 20,
        stdDev: 2.2 // Slightly wider for high volatility
      },
      ema: {
        periods: [9, 21, 50] // Focus on shorter periods for memes
      },
      volume: {
        smaLookback: 20,
        spikeThreshold: 3.0 // Higher threshold for meme volume spikes
      }
    },
    minDataPoints: 30, // Lower requirement for fast-moving memes
    confidenceThreshold: 65, // Slightly higher threshold
    riskAdjustment: true,
    memecoinsOptimized: true
  };

  const mergedOptions = {
    ...defaultMemecoinOptions,
    ...customOptions,
    indicators: {
      ...defaultMemecoinOptions.indicators,
      ...customOptions?.indicators
    }
  };

  return new TechnicalAnalysisEngine(mergedOptions);
}

/**
 * Factory function to create a conservative analysis engine
 * for higher quality/established tokens
 */
export function createConservativeAnalysisEngine(customOptions?: Partial<AnalysisOptions>): TechnicalAnalysisEngine {
  const conservativeOptions: AnalysisOptions = {
    timeframes: ['15m', '1h', '4h', '1d'],
    indicators: {
      rsi: {
        period: 14,
        overbought: 70,
        oversold: 30
      },
      macd: {
        fastPeriod: 12,
        slowPeriod: 26,
        signalPeriod: 9
      },
      bollinger: {
        period: 20,
        stdDev: 2.0
      },
      ema: {
        periods: [21, 50, 100, 200] // Include longer periods
      },
      volume: {
        smaLookback: 50, // Longer lookback for stability
        spikeThreshold: 2.0
      }
    },
    minDataPoints: 100, // Higher data requirement
    confidenceThreshold: 75, // Higher confidence threshold
    riskAdjustment: true,
    memecoinsOptimized: false
  };

  const mergedOptions = {
    ...conservativeOptions,
    ...customOptions,
    indicators: {
      ...conservativeOptions.indicators,
      ...customOptions?.indicators
    }
  };

  return new TechnicalAnalysisEngine(mergedOptions);
}

/**
 * Utility function to validate OHLCV data
 */
export function validateOHLCVData(data: OHLCVData[]): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (data.length === 0) {
    errors.push('No data provided');
    return { isValid: false, errors, warnings };
  }

  // Check for required fields
  for (let i = 0; i < data.length; i++) {
    const candle = data[i];
    if (typeof candle.open !== 'number' || candle.open <= 0) {
      errors.push(`Invalid open price at index ${i}`);
    }
    if (typeof candle.high !== 'number' || candle.high <= 0) {
      errors.push(`Invalid high price at index ${i}`);
    }
    if (typeof candle.low !== 'number' || candle.low <= 0) {
      errors.push(`Invalid low price at index ${i}`);
    }
    if (typeof candle.close !== 'number' || candle.close <= 0) {
      errors.push(`Invalid close price at index ${i}`);
    }
    if (typeof candle.volume !== 'number' || candle.volume < 0) {
      errors.push(`Invalid volume at index ${i}`);
    }

    // Logical checks
    if (candle.high < Math.max(candle.open, candle.close)) {
      errors.push(`High price lower than open/close at index ${i}`);
    }
    if (candle.low > Math.min(candle.open, candle.close)) {
      errors.push(`Low price higher than open/close at index ${i}`);
    }

    // Warnings for unusual data
    if (candle.volume === 0) {
      warnings.push(`Zero volume at index ${i}`);
    }
    
    if (i > 0) {
      const prevCandle = data[i - 1];
      const priceChange = Math.abs(candle.close - prevCandle.close) / prevCandle.close;
      if (priceChange > 0.5) { // 50% price change
        warnings.push(`Large price change (${(priceChange * 100).toFixed(1)}%) at index ${i}`);
      }
    }
  }

  // Check data ordering
  for (let i = 1; i < data.length; i++) {
    if (data[i].timestamp <= data[i - 1].timestamp) {
      errors.push(`Data not properly ordered by timestamp at index ${i}`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Utility function to normalize timeframe strings
 */
export function normalizeTimeframe(timeframe: string): string {
  const normalized = timeframe.toLowerCase().trim();
  
  // Handle common variations
  const mappings: Record<string, string> = {
    '1min': '1m',
    '5min': '5m',
    '15min': '15m',
    '30min': '30m',
    '1hour': '1h',
    '4hour': '4h',
    '1day': '1d',
    '1week': '1w'
  };

  return mappings[normalized] || normalized;
}

/**
 * Utility function to get timeframe weight for memecoin analysis
 */
export function getMemecoinTimeframeWeight(timeframe: string): number {
  const weights: Record<string, number> = {
    '1m': 0.15,
    '5m': 0.30,
    '15m': 0.25,
    '1h': 0.20,
    '4h': 0.10
  };

  return weights[normalizeTimeframe(timeframe)] || 0.1;
}

// Export commonly used types from the main types file
export type {
  TechnicalIndicators as TechnicalIndicatorsInterface,
  MomentumAnalysis,
  VolumeAnalysis,
  PatternAnalysis,
  RiskAssessment,
  AnalysisResult,
  AnalysisContext
} from '../../types/analysis';

export type {
  ChartDataPoint,
  TokenData
} from '../../types/api';