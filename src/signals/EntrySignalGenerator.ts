/**
 * Entry Signal Generator
 * 
 * Combines multiple momentum indicators into clear, actionable trading signals
 * optimized for mid-cap memecoin momentum plays. Focus is on high-quality 
 * entry points with strong confirmation across multiple factors.
 */

import { Logger } from '../utils/Logger';
import { VolumeAnalyzer, VolumeMetrics, VolumePattern } from '../analysis/technical/VolumeAnalyzer';
import { MomentumAccelerationTracker } from '../analysis/momentum/MomentumAccelerationTracker';
import { RatingEngine } from '../analysis/rating/RatingEngine';
import { MultiTimeframeAnalyzer } from '../analysis/technical/MultiTimeframeAnalyzer';
import { VolumeAnalysis, MomentumAnalysis, AnalysisContext } from '../types/analysis';
import { OHLCVData } from '../analysis/technical/types';
import { OHLCV } from '../data/api/solana-tracker/types';
import { TokenData, ChartDataPoint } from '../types/api';

export interface EntrySignal {
  type: 'strong_buy' | 'buy' | 'watch' | 'no_signal';
  confidence: number; // 0-100
  score: number; // Combined signal score 0-100
  reasons: string[]; // Why this signal was generated
  risks: string[]; // Potential risks identified
  timestamp: Date;
  token?: string | undefined; // Token identifier
  entry?: {
    price: number;
    maxSlippage: number;
    positionSize: number; // 0-1 (percentage of portfolio)
    timeHorizon: 'short' | 'medium' | 'long';
  };
}

export interface SignalComponents {
  volumeSurge: {
    detected: boolean;
    factor: number;
    persistence: number;
    score: number;
  };
  momentumAcceleration: {
    strength: number;
    sustainability: number;
    fatigueLevel: string;
    score: number;
  };
  rating: {
    value: number;
    confidence: number;
    score: number;
  };
  multiTimeframe: {
    alignment: number;
    consensus: string;
    score: number;
  };
  qualityFilters: {
    liquidity: boolean;
    volatility: boolean;
    trend: boolean;
    exhaustion: boolean;
    overallPass: boolean;
  };
}

export interface EntrySignalConfig {
  // Volume thresholds
  volumeSurgeThreshold: number; // Minimum volume spike factor (default: 3.0)
  volumePersistencePeriods: number; // Required consecutive periods with elevated volume (default: 3)
  
  // Rating thresholds
  minRatingThreshold: number; // Minimum rating for entry (default: 7.0)
  minConfidenceThreshold: number; // Minimum confidence (default: 70)
  
  // Multi-timeframe requirements
  timeframeAlignmentThreshold: number; // Required alignment percentage (default: 60)
  requiredTimeframes: string[]; // Timeframes that must align (default: ['1h', '4h'])
  
  // Quality filters
  minLiquidityScore: number; // Minimum liquidity score (default: 40)
  maxVolatilityThreshold: number; // Maximum volatility for entry (default: 80)
  
  // Signal scoring weights
  weights: {
    volumeSurge: number;
    momentumAcceleration: number;
    rating: number;
    multiTimeframe: number;
  };
  
  // Signal type thresholds
  thresholds: {
    strongBuy: number; // Score threshold for strong_buy (default: 80)
    buy: number; // Score threshold for buy (default: 60)
    watch: number; // Score threshold for watch (default: 40)
  };
}

export class EntrySignalGenerator {
  private logger = Logger.getInstance();
  private volumeAnalyzer: VolumeAnalyzer;
  private momentumTracker: MomentumAccelerationTracker;
  private ratingEngine: RatingEngine;
  private multiTimeframeAnalyzer: MultiTimeframeAnalyzer;
  private config: EntrySignalConfig;

  constructor(
    config?: Partial<EntrySignalConfig>,
    ratingEngine?: RatingEngine
  ) {
    this.config = {
      // Volume configuration
      volumeSurgeThreshold: 3.0, // 3x average volume threshold
      volumePersistencePeriods: 3,
      
      // Rating configuration
      minRatingThreshold: 7.0,
      minConfidenceThreshold: 70,
      
      // Multi-timeframe configuration
      timeframeAlignmentThreshold: 60,
      requiredTimeframes: ['1h', '4h'],
      
      // Quality filters
      minLiquidityScore: 40,
      maxVolatilityThreshold: 80,
      
      // Scoring weights (must sum to 1.0)
      weights: {
        volumeSurge: 0.35,        // Volume is primary momentum signal
        momentumAcceleration: 0.30, // Momentum acceleration strength
        rating: 0.25,             // Overall rating score
        multiTimeframe: 0.10      // Timeframe alignment bonus
      },
      
      // Signal type thresholds
      thresholds: {
        strongBuy: 80,
        buy: 60,
        watch: 40
      },
      
      ...config
    };

    // Initialize analyzers
    this.volumeAnalyzer = new VolumeAnalyzer({
      spikeThreshold: this.config.volumeSurgeThreshold,
      volumePeriods: [10, 20, 50]
    });
    
    this.momentumTracker = new MomentumAccelerationTracker();
    this.ratingEngine = ratingEngine || new RatingEngine();
    this.multiTimeframeAnalyzer = new MultiTimeframeAnalyzer();
  }

  /**
   * Generate entry signal for a token
   */
  public async generateEntrySignal(
    tokenData: TokenData,
    ohlcvData: OHLCV[],
    multiTimeframeData?: Record<string, OHLCV[]>,
    chartData?: ChartDataPoint[]
  ): Promise<EntrySignal> {
    try {
      this.logger.info(`Generating entry signal for token: ${tokenData?.address || 'unknown'}`);
      
      // Convert OHLCV to OHLCVData format for compatibility
      const convertedData = this.convertOHLCVData(ohlcvData);
      
      // Analyze all components
      const components = await this.analyzeSignalComponents(
        convertedData,
        ohlcvData,
        multiTimeframeData,
        tokenData,
        chartData
      );
      
      // Check quality filters first
      if (!components.qualityFilters.overallPass) {
        return this.createSignal('no_signal', 0, components, tokenData?.address);
      }
      
      // Calculate combined score
      const score = this.calculateCombinedScore(components);
      
      // Determine signal type based on score
      const signalType = this.determineSignalType(score, components);
      
      return this.createSignal(signalType, score, components, tokenData?.address);
      
    } catch (error) {
      this.logger.error(`Error generating entry signal: ${error}`);
      return this.createErrorSignal(tokenData?.address);
    }
  }

  /**
   * Analyze all signal components
   */
  private async analyzeSignalComponents(
    convertedData: OHLCVData[],
    ohlcvData: OHLCV[],
    multiTimeframeData?: Record<string, OHLCV[]>,
    tokenData?: TokenData,
    chartData?: ChartDataPoint[]
  ): Promise<SignalComponents> {
    // Volume analysis
    const volumeAnalysis = this.volumeAnalyzer.analyzeVolume(convertedData);
    const volumeMetrics = this.volumeAnalyzer.calculateVolumeMetrics(convertedData);
    const volumePatterns = this.volumeAnalyzer.detectVolumePatterns(convertedData);
    
    // Volume surge analysis
    const volumeSurge = this.analyzeVolumeSurge(
      convertedData,
      volumeAnalysis,
      volumeMetrics,
      volumePatterns
    );
    
    // Momentum acceleration analysis
    const momentumAcceleration = this.analyzeMomentumAcceleration(ohlcvData);
    
    // Rating analysis
    const rating = await this.analyzeRating(convertedData, tokenData, chartData);
    
    // Multi-timeframe analysis
    const multiTimeframe = await this.analyzeMultiTimeframe(
      convertedData,
      multiTimeframeData
    );
    
    // Quality filters
    const qualityFilters = this.checkQualityFilters(
      volumeAnalysis,
      momentumAcceleration,
      convertedData
    );

    return {
      volumeSurge,
      momentumAcceleration,
      rating,
      multiTimeframe,
      qualityFilters
    };
  }

  /**
   * Analyze volume surge conditions
   */
  private analyzeVolumeSurge(
    data: OHLCVData[],
    volumeAnalysis: VolumeAnalysis,
    volumeMetrics: VolumeMetrics,
    volumePatterns: VolumePattern[]
  ): SignalComponents['volumeSurge'] {
    const detected = volumeAnalysis.volumeSpike && 
                    volumeAnalysis.volumeSpikeFactor >= this.config.volumeSurgeThreshold;
    
    const factor = volumeAnalysis.volumeSpikeFactor;
    
    // Check volume persistence
    const persistence = this.checkVolumePersistence(data);
    
    // Calculate volume surge score
    let score = 0;
    if (detected) {
      // Base score from volume factor
      score = Math.min(100, (factor / this.config.volumeSurgeThreshold) * 60);
      
      // Persistence bonus
      if (persistence >= this.config.volumePersistencePeriods) {
        score *= 1.3;
      }
      
      // Pattern bonuses
      const breakoutPattern = volumePatterns.find(p => p.name === 'Volume Breakout' && p.detected);
      if (breakoutPattern && breakoutPattern.confidence > 70) {
        score *= 1.2;
      }
      
      // Buying pressure bonus
      if (volumeMetrics.volumeDistribution.buyingPressure > 65) {
        score *= 1.1;
      }
      
      score = Math.min(100, score);
    }
    
    return {
      detected,
      factor,
      persistence,
      score
    };
  }

  /**
   * Check volume persistence over multiple periods
   */
  private checkVolumePersistence(data: OHLCVData[]): number {
    if (data.length < this.config.volumePersistencePeriods + 5) return 0;
    
    const recentVolumes = data.slice(-this.config.volumePersistencePeriods);
    const historicalAvg = data
      .slice(-20, -(this.config.volumePersistencePeriods))
      .reduce((sum, d) => sum + d.volume, 0) / 
      (20 - this.config.volumePersistencePeriods);
    
    let persistentPeriods = 0;
    for (const candle of recentVolumes) {
      if (candle.volume > historicalAvg * (this.config.volumeSurgeThreshold * 0.7)) {
        persistentPeriods++;
      }
    }
    
    return persistentPeriods;
  }

  /**
   * Analyze momentum acceleration
   */
  private analyzeMomentumAcceleration(ohlcvData: OHLCV[]): SignalComponents['momentumAcceleration'] {
    try {
      const momentum = this.momentumTracker.analyzeMomentum(ohlcvData);
      
      // Calculate momentum score
      let score = 0;
      
      // Positive acceleration bonus
      if (momentum.acceleration1h > 0 && momentum.acceleration4h > 0) {
        score += 40;
      } else if (momentum.acceleration1h > 0) {
        score += 20;
      }
      
      // Sustainability score
      score += momentum.sustainabilityScore * 0.4;
      
      // Entry signal strength
      score += momentum.entrySignalStrength * 0.3;
      
      // Fatigue penalty
      switch (momentum.fatigueLevel) {
        case 'severe':
          score *= 0.3;
          break;
        case 'moderate':
          score *= 0.6;
          break;
        case 'mild':
          score *= 0.8;
          break;
        default:
          // No penalty for 'none'
          break;
      }
      
      score = Math.min(100, score);
      
      return {
        strength: momentum.entrySignalStrength,
        sustainability: momentum.sustainabilityScore,
        fatigueLevel: momentum.fatigueLevel,
        score
      };
      
    } catch (error) {
      this.logger.warn(`Error analyzing momentum acceleration: ${error}`);
      return {
        strength: 0,
        sustainability: 0,
        fatigueLevel: 'severe',
        score: 0
      };
    }
  }

  /**
   * Analyze rating score
   */
  private async analyzeRating(
    convertedData: OHLCVData[],
    tokenData?: TokenData,
    chartData?: ChartDataPoint[]
  ): Promise<SignalComponents['rating']> {
    try {
      // Create proper analysis context for rating engine
      const context: AnalysisContext = {
        tokenData: tokenData || {
          address: 'unknown',
          symbol: 'UNKNOWN',
          name: 'Unknown Token',
          decimals: 9,
          supply: 1000000000,
          marketCap: 25000000, // Assume mid-cap
          price: convertedData[convertedData.length - 1]?.close || 0,
          priceChange24h: this.calculatePriceChange24h(convertedData),
          volume24h: convertedData[convertedData.length - 1]?.volume || 0,
          holders: 1000, // Mock value
          createdAt: new Date().toISOString(),
          riskLevel: 'medium',
          riskScore: 50
        },
        chartData: chartData || convertedData.map(d => ({
          timestamp: d.timestamp,
          open: d.open,
          high: d.high,
          low: d.low,
          close: d.close,
          volume: d.volume
        })),
        multiTimeframeData: undefined, // Rating engine expects different format
        historicalAnalysis: [], // Empty for now
        marketContext: {
          overallTrend: 'sideways' as const,
          volatilityIndex: 50,
          marketSentiment: 50
        }
      };
      
      // Generate mock technical/volume/momentum analysis for rating
      const technicalData = this.generateMockTechnicalData(convertedData);
      const volumeAnalysis = this.volumeAnalyzer.analyzeVolume(convertedData);
      const momentumAnalysis = this.generateMockMomentumAnalysis(convertedData);
      const riskAssessment = this.generateMockRiskAssessment();
      
      const ratingResult = await this.ratingEngine.calculateRating(
        technicalData,
        momentumAnalysis,
        volumeAnalysis,
        riskAssessment,
        context
      );
      
      // Calculate rating score
      const meetsThreshold = ratingResult.rating >= this.config.minRatingThreshold;
      const meetsConfidence = ratingResult.confidence >= this.config.minConfidenceThreshold;
      
      let score = 0;
      if (meetsThreshold && meetsConfidence) {
        // Scale rating to 0-100
        score = ((ratingResult.rating - 1) / 9) * 100;
        
        // Confidence bonus
        score *= (ratingResult.confidence / 100);
      }
      
      return {
        value: ratingResult.rating,
        confidence: ratingResult.confidence,
        score: Math.min(100, score)
      };
      
    } catch (error) {
      this.logger.warn(`Error analyzing rating: ${error}`);
      return {
        value: 0,
        confidence: 0,
        score: 0
      };
    }
  }

  /**
   * Analyze multi-timeframe alignment
   */
  private async analyzeMultiTimeframe(
    convertedData: OHLCVData[],
    multiTimeframeData?: Record<string, OHLCV[]>
  ): Promise<SignalComponents['multiTimeframe']> {
    if (!multiTimeframeData) {
      return {
        alignment: 0,
        consensus: 'neutral',
        score: 0
      };
    }

    try {
      // Convert multi-timeframe data to required format
      const timeframeData = Object.entries(multiTimeframeData)
        .filter(([timeframe]) => this.config.requiredTimeframes.includes(timeframe))
        .map(([timeframe, data]) => ({
          timeframe,
          data: this.convertOHLCVData(data),
          weight: timeframe === '1h' ? 0.6 : 0.4,
          importance: timeframe === '1h' ? 'primary' : 'secondary' as const
        }));

      if (timeframeData.length === 0) {
        return {
          alignment: 0,
          consensus: 'neutral',
          score: 0
        };
      }

      // Convert TimeframeData format to OHLCVData for the analyzer
      const primaryTimeframeData = timeframeData.length > 0 ? timeframeData[0].data : [];
      const result = await this.multiTimeframeAnalyzer.analyzeMultiTimeframe(primaryTimeframeData);
      
      // Calculate alignment score
      const bullishAlignment = result.timeframeAlignment.bullish;
      const bearishAlignment = result.timeframeAlignment.bearish;
      
      const alignment = Math.max(bullishAlignment, bearishAlignment);
      const meetsThreshold = alignment >= this.config.timeframeAlignmentThreshold;
      
      let score = 0;
      if (meetsThreshold) {
        score = alignment;
        
        // Bonus for strong consensus
        if (result.timeframeAlignment.consensus === 'strong_bull') {
          score *= 1.2;
        }
      }
      
      return {
        alignment,
        consensus: result.timeframeAlignment.consensus,
        score: Math.min(100, score)
      };
      
    } catch (error) {
      this.logger.warn(`Error analyzing multi-timeframe: ${error}`);
      return {
        alignment: 0,
        consensus: 'neutral',
        score: 0
      };
    }
  }

  /**
   * Check quality filters
   */
  private checkQualityFilters(
    volumeAnalysis: VolumeAnalysis,
    momentumAcceleration: SignalComponents['momentumAcceleration'],
    data: OHLCVData[]
  ): SignalComponents['qualityFilters'] {
    // Liquidity check
    const liquidity = volumeAnalysis.liquidityScore >= this.config.minLiquidityScore;
    
    // Volatility check
    const volatility = this.checkVolatilityThreshold(data);
    
    // Trend check (avoid tokens in strong downtrends)
    const trend = this.checkTrendDirection(data);
    
    // Momentum exhaustion check
    const exhaustion = momentumAcceleration.fatigueLevel !== 'severe';
    
    const overallPass = liquidity && volatility && trend && exhaustion;
    
    return {
      liquidity,
      volatility,
      trend,
      exhaustion,
      overallPass
    };
  }

  /**
   * Check volatility threshold
   */
  private checkVolatilityThreshold(data: OHLCVData[]): boolean {
    if (data.length < 20) return false;
    
    const recentData = data.slice(-20);
    const volatility = recentData.reduce((sum, candle) => {
      const range = (candle.high - candle.low) / candle.open;
      return sum + range;
    }, 0) / recentData.length;
    
    return (volatility * 100) <= this.config.maxVolatilityThreshold;
  }

  /**
   * Check trend direction
   */
  private checkTrendDirection(data: OHLCVData[]): boolean {
    if (data.length < 20) return false;
    
    const recent = data.slice(-10);
    const older = data.slice(-20, -10);
    
    const recentAvg = recent.reduce((sum, d) => sum + d.close, 0) / recent.length;
    const olderAvg = older.reduce((sum, d) => sum + d.close, 0) / older.length;
    
    const trend = (recentAvg - olderAvg) / olderAvg;
    
    // Allow neutral to slightly positive trends, avoid strong downtrends
    return trend > -0.15;
  }

  /**
   * Calculate combined signal score
   */
  private calculateCombinedScore(components: SignalComponents): number {
    const weights = this.config.weights;
    
    return (
      components.volumeSurge.score * weights.volumeSurge +
      components.momentumAcceleration.score * weights.momentumAcceleration +
      components.rating.score * weights.rating +
      components.multiTimeframe.score * weights.multiTimeframe
    );
  }

  /**
   * Determine signal type based on score
   */
  private determineSignalType(
    score: number, 
    components: SignalComponents
  ): EntrySignal['type'] {
    const thresholds = this.config.thresholds;
    
    // Additional checks for strong_buy
    if (score >= thresholds.strongBuy) {
      // Require all key components to be strong
      const strongVolume = components.volumeSurge.score >= 70;
      const strongMomentum = components.momentumAcceleration.score >= 60;
      const strongRating = components.rating.score >= 60;
      
      if (strongVolume && strongMomentum && strongRating) {
        return 'strong_buy';
      }
      return 'buy';
    }
    
    if (score >= thresholds.buy) {
      return 'buy';
    }
    
    if (score >= thresholds.watch) {
      return 'watch';
    }
    
    return 'no_signal';
  }

  /**
   * Create entry signal result
   */
  private createSignal(
    type: EntrySignal['type'],
    score: number,
    components: SignalComponents,
    token?: string
  ): EntrySignal {
    const confidence = this.calculateConfidence(score, components);
    const reasons = this.generateReasons(type, components);
    const risks = this.generateRisks(components);
    
    const signal: EntrySignal = {
      type,
      confidence,
      score,
      reasons,
      risks,
      timestamp: new Date(),
      token
    };
    
    // Add entry details for actionable signals
    if (type === 'strong_buy' || type === 'buy') {
      signal.entry = {
        price: 0, // Would be filled with current market price
        maxSlippage: type === 'strong_buy' ? 0.02 : 0.015, // 2% or 1.5%
        positionSize: this.calculatePositionSize(type, confidence, components),
        timeHorizon: this.determineTimeHorizon(components)
      };
    }
    
    return signal;
  }

  /**
   * Calculate confidence level
   */
  private calculateConfidence(score: number, components: SignalComponents): number {
    let confidence = score * 0.8; // Base confidence from score
    
    // Boost confidence for strong individual components
    if (components.volumeSurge.detected && components.volumeSurge.factor > 5) {
      confidence += 10;
    }
    
    if (components.momentumAcceleration.fatigueLevel === 'none') {
      confidence += 5;
    }
    
    if (components.rating.confidence > 80) {
      confidence += 5;
    }
    
    if (components.multiTimeframe.consensus === 'strong_bull') {
      confidence += 10;
    }
    
    return Math.min(100, confidence);
  }

  /**
   * Generate signal reasons
   */
  private generateReasons(type: EntrySignal['type'], components: SignalComponents): string[] {
    const reasons: string[] = [];
    
    if (type === 'no_signal') {
      reasons.push('Insufficient signal strength for entry');
      if (!components.qualityFilters.overallPass) {
        reasons.push('Failed quality filters');
      }
      return reasons;
    }
    
    if (components.volumeSurge.detected) {
      reasons.push(
        `Volume surge detected: ${components.volumeSurge.factor.toFixed(1)}x average with ${components.volumeSurge.persistence} periods persistence`
      );
    }
    
    if (components.momentumAcceleration.score > 60) {
      reasons.push(
        `Strong momentum acceleration with ${components.momentumAcceleration.sustainability.toFixed(0)}% sustainability`
      );
    }
    
    if (components.rating.value >= this.config.minRatingThreshold) {
      reasons.push(
        `High rating: ${components.rating.value.toFixed(1)}/10 with ${components.rating.confidence.toFixed(0)}% confidence`
      );
    }
    
    if (components.multiTimeframe.alignment > this.config.timeframeAlignmentThreshold) {
      reasons.push(
        `Multi-timeframe alignment: ${components.multiTimeframe.alignment.toFixed(0)}% bullish consensus`
      );
    }
    
    return reasons;
  }

  /**
   * Generate risk warnings
   */
  private generateRisks(components: SignalComponents): string[] {
    const risks: string[] = [];
    
    if (!components.qualityFilters.liquidity) {
      risks.push('Low liquidity - potential slippage risk');
    }
    
    if (!components.qualityFilters.volatility) {
      risks.push('High volatility - increased price risk');
    }
    
    if (components.momentumAcceleration.fatigueLevel === 'moderate') {
      risks.push('Moderate momentum fatigue detected');
    }
    
    if (components.rating.confidence < 70) {
      risks.push('Low rating confidence - uncertain analysis');
    }
    
    if (components.multiTimeframe.alignment < 70) {
      risks.push('Weak multi-timeframe alignment');
    }
    
    // General memecoin risks
    risks.push('High-risk memecoin investment - volatile and speculative');
    
    return risks;
  }

  /**
   * Calculate recommended position size
   */
  private calculatePositionSize(
    type: EntrySignal['type'],
    confidence: number,
    components: SignalComponents
  ): number {
    let baseSize = 0;
    
    switch (type) {
      case 'strong_buy':
        baseSize = 0.05; // 5% of portfolio
        break;
      case 'buy':
        baseSize = 0.03; // 3% of portfolio
        break;
      default:
        baseSize = 0.01; // 1% of portfolio
    }
    
    // Adjust based on confidence
    const confidenceMultiplier = confidence / 100;
    
    // Adjust based on liquidity
    const liquidityMultiplier = components.qualityFilters.liquidity ? 1.0 : 0.5;
    
    return Math.min(0.1, baseSize * confidenceMultiplier * liquidityMultiplier);
  }

  /**
   * Determine time horizon
   */
  private determineTimeHorizon(components: SignalComponents): 'short' | 'medium' | 'long' {
    if (components.volumeSurge.detected && components.momentumAcceleration.score > 70) {
      return 'short'; // Quick momentum play
    }
    
    if (components.rating.value >= 8) {
      return 'medium'; // Strong fundamentals for medium-term hold
    }
    
    return 'short'; // Default to short-term for memecoins
  }

  /**
   * Create error signal
   */
  private createErrorSignal(token?: string): EntrySignal {
    return {
      type: 'no_signal',
      confidence: 0,
      score: 0,
      reasons: ['Error occurred during signal generation'],
      risks: ['Unable to analyze due to technical error'],
      timestamp: new Date(),
      token
    };
  }

  /**
   * Helper methods for data conversion and mock data generation
   */

  private convertOHLCVData(ohlcvData: OHLCV[]): OHLCVData[] {
    return ohlcvData.map(candle => ({
      timestamp: candle.timestamp,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume
    }));
  }

  private calculatePriceChange24h(data: OHLCVData[]): number {
    if (data.length < 2) return 0;
    const current = data[data.length - 1].close;
    const previous = data[0].close;
    return ((current - previous) / previous) * 100;
  }

  private generateMockTechnicalData(data: OHLCVData[]) {
    // Generate basic technical indicators for rating engine
    const closes = data.map(d => d.close);
    const current = closes[closes.length - 1];
    
    return {
      rsi: 55, // Mock RSI
      macd: {
        macd: 0.001,
        signal: 0.0005,
        histogram: 0.0005
      },
      bollinger: {
        upper: current * 1.02,
        middle: current,
        lower: current * 0.98,
        position: 0.5
      },
      ema: {
        '9': current * 0.99,
        '21': current * 0.98,
        '50': current * 0.95
      },
      sma: {
        '20': current * 0.99,
        '50': current * 0.96
      }
    };
  }

  private generateMockMomentumAnalysis(data: OHLCVData[]): MomentumAnalysis {
    const priceChange = this.calculatePriceChange24h(data);
    
    return {
      trend: priceChange > 5 ? 'bullish' : priceChange < -5 ? 'bearish' : 'neutral',
      strength: Math.min(100, Math.abs(priceChange) * 2),
      momentum: priceChange,
      volatility: 25,
      support: [],
      resistance: [],
      priceAction: {
        breakoutPotential: 60,
        consolidation: false,
        reversalSignal: false
      }
    };
  }

  private generateMockRiskAssessment() {
    return {
      overall: 65, // Medium-high risk for memecoins
      factors: {
        liquidity: 30,
        volatility: 80,
        holderConcentration: 60,
        marketCap: 40,
        age: 70,
        rugPullRisk: 50
      },
      warnings: [],
      riskLevel: 'high' as const
    };
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<EntrySignalConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.info('Entry signal generator configuration updated');
  }

  /**
   * Get current configuration
   */
  public getConfig(): EntrySignalConfig {
    return { ...this.config };
  }
}

/**
 * Factory function to create entry signal generator
 */
export function createEntrySignalGenerator(
  config?: Partial<EntrySignalConfig>,
  ratingEngine?: RatingEngine
): EntrySignalGenerator {
  return new EntrySignalGenerator(config, ratingEngine);
}

/**
 * Utility function to format entry signal for display
 */
export function formatEntrySignal(signal: EntrySignal): string {
  const lines: string[] = [];
  
  lines.push(`🎯 ENTRY SIGNAL: ${signal.type.toUpperCase()}`);
  lines.push(`📊 Score: ${signal.score.toFixed(1)}/100`);
  lines.push(`🔒 Confidence: ${signal.confidence.toFixed(1)}%`);
  
  if (signal.token) {
    lines.push(`🪙 Token: ${signal.token}`);
  }
  
  if (signal.entry) {
    lines.push(`💰 Position Size: ${(signal.entry.positionSize * 100).toFixed(1)}%`);
    lines.push(`⏱️ Time Horizon: ${signal.entry.timeHorizon}`);
    lines.push(`📈 Max Slippage: ${(signal.entry.maxSlippage * 100).toFixed(1)}%`);
  }
  
  lines.push(`\n✅ REASONS:`);
  signal.reasons.forEach(reason => lines.push(`  • ${reason}`));
  
  if (signal.risks.length > 0) {
    lines.push(`\n⚠️ RISKS:`);
    signal.risks.forEach(risk => lines.push(`  • ${risk}`));
  }
  
  return lines.join('\n');
}