/**
 * Additional types specific to technical analysis implementation
 */

export interface OHLCVData {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: number;
}

export interface IndicatorConfig {
  rsi: {
    period: number;
    overbought: number;
    oversold: number;
  };
  macd: {
    fastPeriod: number;
    slowPeriod: number;
    signalPeriod: number;
  };
  bollinger: {
    period: number;
    stdDev: number;
  };
  ema: {
    periods: number[];
  };
  volume: {
    smaLookback: number;
    spikeThreshold: number;
  };
}

export interface TechnicalSignal {
  type: 'buy' | 'sell' | 'neutral';
  strength: number; // 0-100
  confidence: number; // 0-100
  source: string; // Which indicator generated the signal
  timestamp: number;
  price: number;
  reasoning: string;
}

export interface MomentumMetrics {
  roc: number; // Rate of change
  momentum: number;
  acceleration: number;
  velocity: number;
  trendStrength: number;
  trendDirection: 1 | 0 | -1; // 1 = up, 0 = sideways, -1 = down
}

export interface TimeframeWeight {
  timeframe: string;
  weight: number;
  importance: 'primary' | 'secondary' | 'confirmation';
}

export interface SupportResistanceLevel {
  price: number;
  strength: number; // 0-100
  type: 'support' | 'resistance';
  touches: number;
  volume: number;
  confidence: number;
  recent: boolean;
}

export interface PatternMatch {
  type: 'breakout' | 'reversal' | 'continuation' | 'consolidation';
  name: string;
  confidence: number;
  bullish: boolean;
  startIndex: number;
  endIndex: number;
  target?: number;
  stopLoss?: number;
  timeframe: string;
}

export interface VolumeProfile {
  averageVolume: number;
  currentVolume: number;
  volumeRatio: number;
  volumeSpike: boolean;
  volumeTrend: 'increasing' | 'decreasing' | 'stable';
  buyVolume: number;
  sellVolume: number;
  volumeWeightedPrice: number;
}

export interface MultiTimeframeAnalysis {
  timeframe: string;
  weight: number;
  signals: TechnicalSignal[];
  indicators: Partial<{
    rsi: number;
    macd: {
      macd: number;
      signal: number;
      histogram: number;
    };
    bollinger: {
      upper: number;
      middle: number;
      lower: number;
      position: number;
    };
    ema: Record<string, number>;
    sma: Record<string, number>;
  }>;
  momentum: Partial<MomentumMetrics>;
  volume: Partial<VolumeProfile>;
  overallBias: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
}

export interface AnalysisOptions {
  timeframes: string[];
  indicators: IndicatorConfig;
  minDataPoints: number;
  confidenceThreshold: number;
  riskAdjustment: boolean;
  memecoinsOptimized: boolean;
  consecutiveMomentumConfig?: {
    intervalMinutes: number;
    maxBoostPercentage: number;
    exhaustionThreshold: number;
    volumeConfirmationRequired: boolean;
  };
  exhaustionDetection?: {
    rsiOverboughtPeriods: number;
    rsiOversoldPeriods: number;
    volumeSpikeThreshold: number;
  };
}