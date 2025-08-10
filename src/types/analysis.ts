/**
 * Type definitions for technical analysis and rating system
 */

export interface TechnicalIndicators {
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
    position: number; // Price position within bands (0-1)
  };
  ema: Record<string, number>; // Period -> EMA value
  sma: Record<string, number>; // Period -> SMA value
}

export interface MomentumAnalysis {
  trend: 'bullish' | 'bearish' | 'neutral';
  strength: number; // 0-100
  momentum: number; // Rate of change
  volatility: number;
  support: number[];
  resistance: number[];
  priceAction: {
    breakoutPotential: number;
    consolidation: boolean;
    reversalSignal: boolean;
  };
}

export interface VolumeAnalysis {
  averageVolume: number;
  currentVolume: number;
  volumeSpike: boolean;
  volumeSpikeFactor: number;
  volumeProfile: {
    buyPressure: number;
    sellPressure: number;
    netFlow: number;
  };
  liquidityScore: number;
}

export interface PatternAnalysis {
  patterns: Array<{
    type: string;
    confidence: number;
    description: string;
    bullish: boolean;
    target?: number;
    stopLoss?: number;
  }>;
  candlestickPatterns: Array<{
    name: string;
    type: 'reversal' | 'continuation';
    bullish: boolean;
    confidence: number;
  }>;
}

export interface RiskAssessment {
  overall: number; // 0-100 (0 = low risk, 100 = high risk)
  factors: {
    liquidity: number;
    volatility: number;
    holderConcentration: number;
    marketCap: number;
    age: number;
    rugPullRisk: number;
  };
  warnings: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'extreme';
}

export interface ScoreComponents {
  technical: number; // 0-100
  momentum: number; // 0-100
  volume: number; // 0-100
  risk: number; // 0-100 (adjusted for risk)
  pattern: number; // 0-100
  fundamentals: number; // 0-100
}

export interface RatingResult {
  rating: number; // 1-10 final rating
  confidence: number; // 0-100 confidence in rating
  components: ScoreComponents;
  weights: Record<keyof ScoreComponents, number>;
  reasoning: string[];
  alerts: string[];
  recommendation: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
}

export interface ConsecutiveMomentumPeriod {
  periodIndex: number;
  timestamp: number;
  rsi: number;
  macdHistogram: number;
  volumeConfirmed: boolean;
  trendDirection: 'bullish' | 'bearish' | 'neutral';
  strength: number;
  exhaustionRisk: boolean;
}

export interface ConsecutiveMomentumTracking {
  periods: ConsecutiveMomentumPeriod[];
  consecutiveCount: number;
  scoreBoost: number; // 0% base, +15% period 2, +25% period 3 max
  exhaustionWarning: boolean;
  trendBreakReset: boolean;
  diminishingReturns: boolean;
}

export interface TimeframeIndicators extends TechnicalIndicators {
  timeframe: string;
  weight: number;
  dataPoints: number;
  exhaustionSignals: {
    rsiOverbought: { active: boolean; periods: number };
    rsiOversold: { active: boolean; periods: number };
    volumeSpike: { active: boolean; threshold: number };
    divergence: { detected: boolean; type: 'bullish' | 'bearish' | null };
  };
}

export interface MultiTimeframeData {
  '1h': TimeframeIndicators;
  '4h': TimeframeIndicators;
}

export interface TimeframeDivergence {
  timeframe1: string;
  timeframe2: string;
  type: 'bullish' | 'bearish';
  strength: number;
  priceAction: 'higher_highs' | 'lower_lows' | 'diverging';
  indicatorAction: 'lower_highs' | 'higher_lows' | 'converging';
  confidence: number;
}

export interface AnalysisResult {
  tokenAddress: string;
  timestamp: number;
  price: number;
  marketCap: number;
  technicalIndicators: TechnicalIndicators;
  momentum: MomentumAnalysis;
  volume: VolumeAnalysis;
  patterns: PatternAnalysis;
  risk: RiskAssessment;
  rating: RatingResult;
  timeframes: MultiTimeframeData;
  consecutiveMomentum: ConsecutiveMomentumTracking;
  timeframeDivergences: TimeframeDivergence[];
  aggregatedScores: {
    weighted: number;
    confidence: number;
    timeframeAlignment: number;
  };
}

export interface AnalysisContext {
  tokenData: import('./api').TokenData;
  chartData: import('./api').ChartDataPoint[];
  multiTimeframeData?: {
    '1h': import('./api').ChartDataPoint[];
    '4h': import('./api').ChartDataPoint[];
  };
  historicalAnalysis: AnalysisResult[];
  marketContext: {
    overallTrend: 'bull' | 'bear' | 'sideways';
    volatilityIndex: number;
    marketSentiment: number;
  };
}

/**
 * AI Analysis Results from Claude API
 */
export interface AIAnalysisResult {
  momentumQuality: number; // 1-10 score
  entryRisk: number; // 1-10 score (higher = more risk)
  timeframeAnalysis: number; // 1-10 score
  volumeAnalysis: number; // 1-10 score
  finalRecommendation: {
    rating: number; // 1-10 final AI rating
    action: 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'AVOID';
  };
  reasoning: string[];
  confidence: number; // 0-100 confidence level
  warnings: string[];
  timestamp: number;
  tokenAddress: string;
}

/**
 * AI Analysis Input Data
 */
export interface AIAnalysisInput {
  tokenData: {
    symbol: string;
    address: string;
    price: number;
    marketCap: number;
    volume24h: number;
    priceChange24h: number;
  };
  multiTimeframeData: {
    '1h': import('./api').ChartDataPoint[];
    '4h': import('./api').ChartDataPoint[];
  };
  technicalIndicators: {
    '1h': TechnicalIndicators;
    '4h': TechnicalIndicators;
  };
  momentumAnalysis: MomentumAnalysis;
  volumeAnalysis: VolumeAnalysis;
  riskFactors: string[];
  initialTechnicalRating: number; // The ≥6 rating that triggered AI analysis
}

/**
 * AI Enhanced Score Components
 */
export interface AIEnhancedScoreComponents extends ScoreComponents {
  aiMomentum: number; // AI momentum quality score
  aiRisk: number; // AI risk assessment score
  aiTimeframe: number; // AI timeframe analysis score
  aiVolume: number; // AI volume analysis score
  aiOverall: number; // AI final recommendation score
}

export interface AnalysisConfiguration {
  timeframes: {
    enabled: string[];
    weights: {
      '4h': number;
      '1h': number;
    };
    consecutiveMomentum: {
      intervalMinutes: number;
      maxBoostPercentage: number;
      exhaustionThreshold: number;
      volumeConfirmationRequired: boolean;
    };
  };
  indicators: {
    enabled: (keyof TechnicalIndicators)[];
    parameters: Record<string, any>;
    exhaustionDetection: {
      rsiOverboughtPeriods: number;
      rsiOversoldPeriods: number;
      volumeSpikeThreshold: number;
    };
  };
  scoring: {
    weights: Record<keyof ScoreComponents, number>;
    riskAdjustment: boolean;
    confidenceThreshold: number;
    timeframeBoosts: {
      alignment: number;
      divergence: number;
      consecutiveMomentum: number;
    };
    aiAnalysis: {
      enabled: boolean;
      weight: number; // Weight of AI analysis in final rating (e.g., 0.30 for 30%)
      minTechnicalRating: number; // Minimum rating to trigger AI analysis (e.g., 6)
      timeout: number; // AI analysis timeout in ms
      maxRetries: number; // Max retries for AI analysis
    };
  };
  filters: {
    minRating: number;
    maxRisk: number;
    minConfidence: number;
    requiredPatterns?: string[];
    minTimeframeAlignment: number;
  };
}