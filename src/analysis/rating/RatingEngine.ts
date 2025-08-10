/**
 * Advanced Multi-Factor Rating Engine for Memecoin Analysis
 * 
 * Implements momentum-focused scoring algorithms optimized for mid-cap memecoins:
 * - Volume Analysis (35%): PRIMARY momentum signal - Volume spikes, liquidity, buy/sell pressure
 * - Momentum Analysis (25%): Trend acceleration and strength - breakout potential, price action
 * - Technical Analysis (20%): Supporting indicators - RSI, MACD, Bollinger Bands, Moving Averages
 * - Multi-timeframe (15%): Alignment confirmation across timeframes
 * - Risk Assessment (5%): Reduced weight for higher reward potential
 * - Consecutive Momentum: Dynamic bonus applied separately for sustained momentum patterns
 * 
 * Total base weights = 1.00 (consecutive momentum bonus applied as multiplier)
 */

import { Logger } from '../../utils/Logger';
import {
  TechnicalIndicators,
  MomentumAnalysis,
  VolumeAnalysis,
  RiskAssessment,
  RatingResult,
  ScoreComponents,
  AnalysisContext
} from '../../types/analysis';

import { TechnicalScoreCalculator } from './calculators/TechnicalScoreCalculator';
import { MomentumScoreCalculator } from './calculators/MomentumScoreCalculator';
import { VolumeScoreCalculator } from './calculators/VolumeScoreCalculator';
import { RiskScoreCalculator } from './calculators/RiskScoreCalculator';
import { MultiTimeframeScoreCalculator } from './calculators/MultiTimeframeScoreCalculator';
import { ConsecutiveMomentumCalculator, CurrentMomentumAnalysis } from './calculators/ConsecutiveMomentumCalculator';
import { ExhaustionPenaltyCalculator } from './calculators/ExhaustionPenaltyCalculator';
import { ConfidenceCalculator } from './utils/ConfidenceCalculator';
import { ContextDefaults } from './utils/ContextDefaults';
import { DatabaseManager } from '../../database/DatabaseManager';

export interface RatingEngineConfig {
  weights: {
    technical: number;
    momentum: number;
    volume: number;
    risk: number;
    multiTimeframe: number;
    consecutiveMomentum: number;
  };
  adaptiveWeighting: boolean;
  riskAdjustment: boolean;
  confidenceThreshold: number;
  smoothingFactor: number;
  enableMultiTimeframe: boolean;
  enableConsecutiveMomentum: boolean;
  enableExhaustionPenalty: boolean;
}

export class RatingEngine {
  private logger = Logger.getInstance();
  private technicalCalculator: TechnicalScoreCalculator;
  private momentumCalculator: MomentumScoreCalculator;
  private volumeCalculator: VolumeScoreCalculator;
  private riskCalculator: RiskScoreCalculator;
  private multiTimeframeCalculator: MultiTimeframeScoreCalculator;
  private consecutiveMomentumCalculator: ConsecutiveMomentumCalculator;
  private exhaustionPenaltyCalculator: ExhaustionPenaltyCalculator;
  private confidenceCalculator: ConfidenceCalculator;
  
  private config: RatingEngineConfig;
  private historicalRatings: Map<string, RatingResult[]> = new Map();
  private dbManager?: DatabaseManager;

  constructor(config?: Partial<RatingEngineConfig>, dbManager?: DatabaseManager) {
    // Momentum-focused weighting strategy for mid-cap memecoin trading:
    // Volume is prioritized as the primary momentum indicator since volume surges
    // typically precede and confirm price movements in memecoin markets.
    // Momentum analysis provides acceleration context, while technical indicators
    // offer supporting confirmation. Risk is reduced to capture higher reward opportunities.
    this.config = {
      weights: {
        volume: 0.35,              // 35% weight - Volume analysis (PRIMARY signal for momentum)
        momentum: 0.25,            // 25% weight - Momentum analysis (acceleration and strength)
        technical: 0.20,           // 20% weight - Technical indicators (supporting role)
        multiTimeframe: 0.15,      // 15% weight - Multi-timeframe analysis (alignment confirmation)
        risk: 0.05,                // 5% weight - Risk assessment (reduced for higher reward)
        consecutiveMomentum: 0.00  // Dynamic bonus applied separately (not part of base weights)
      },
      adaptiveWeighting: true,
      riskAdjustment: true,
      confidenceThreshold: 70,
      smoothingFactor: 0.15,
      enableMultiTimeframe: true,
      enableConsecutiveMomentum: true,
      enableExhaustionPenalty: true,
      ...config
    };

    this.dbManager = dbManager;

    // Initialize calculators with optimized parameters
    this.technicalCalculator = new TechnicalScoreCalculator();
    this.momentumCalculator = new MomentumScoreCalculator();
    this.volumeCalculator = new VolumeScoreCalculator();
    this.riskCalculator = new RiskScoreCalculator();
    this.multiTimeframeCalculator = new MultiTimeframeScoreCalculator(dbManager);
    this.consecutiveMomentumCalculator = new ConsecutiveMomentumCalculator(dbManager);
    this.exhaustionPenaltyCalculator = new ExhaustionPenaltyCalculator();
    this.confidenceCalculator = new ConfidenceCalculator();

    this.logger.info('Enhanced RatingEngine initialized', { 
      weights: this.config.weights,
      adaptiveWeighting: this.config.adaptiveWeighting,
      enableMultiTimeframe: this.config.enableMultiTimeframe,
      enableConsecutiveMomentum: this.config.enableConsecutiveMomentum,
      hasDatabase: !!dbManager
    });
  }

  /**
   * Calculate comprehensive rating for a token with enhanced multi-timeframe analysis
   */
  public async calculateRating(
    technicalIndicators: TechnicalIndicators,
    momentum: MomentumAnalysis,
    volume: VolumeAnalysis,
    risk: RiskAssessment,
    context: AnalysisContext
  ): Promise<RatingResult> {
    const startTime = Date.now();
    const tokenAddress = context.tokenData?.address || 'unknown';
    
    // Create a timeout wrapper for the entire rating calculation
    const RATING_TIMEOUT_MS = 30000; // 30 seconds timeout
    
    try {
      this.logger.info('Starting enhanced rating calculation', {
        tokenAddress,
        hasTechnical: !!technicalIndicators,
        hasMomentum: !!momentum,
        hasVolume: !!volume,
        hasRisk: !!risk,
        hasMultiTimeframe: !!context.multiTimeframeData,
        enabledFeatures: {
          multiTimeframe: this.config.enableMultiTimeframe,
          consecutiveMomentum: this.config.enableConsecutiveMomentum,
          exhaustionPenalty: this.config.enableExhaustionPenalty
        },
        timeoutMs: RATING_TIMEOUT_MS
      });
      
      // Wrap entire calculation in timeout
      return await this.withTimeout(
        this.performRatingCalculation(
          technicalIndicators,
          momentum,
          volume,
          risk,
          context,
          startTime
        ),
        RATING_TIMEOUT_MS,
        `Rating calculation timeout for ${tokenAddress}`
      );
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error('Enhanced rating calculation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        tokenAddress,
        duration: `${duration}ms`,
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }
  
  /**
   * Perform the actual rating calculation with detailed step-by-step logging
   */
  private async performRatingCalculation(
    technicalIndicators: TechnicalIndicators,
    momentum: MomentumAnalysis,
    volume: VolumeAnalysis,
    risk: RiskAssessment,
    context: AnalysisContext,
    startTime: number
  ): Promise<RatingResult> {
    const tokenAddress = context.tokenData?.address || 'unknown';
    
    this.logger.debug('Step 1: Ensuring safe context', { tokenAddress });
      
    // Ensure context has safe defaults to prevent undefined access
    const safeContext = ContextDefaults.ensureMarketContext(context);
    
    this.logger.debug('Step 2: Starting base component score calculations', { tokenAddress });
    const baseScores = await this.withTimeout(
      this.calculateComponentScores(
        technicalIndicators,
        momentum,
        volume,
        risk,
        safeContext
      ),
      15000, // 15 second timeout for component scores
      `Component scores calculation timeout for ${tokenAddress}`
    );
    
    this.logger.debug('Step 2 completed: Base component scores calculated', {
      tokenAddress,
      scores: {
        technical: baseScores.technical.toFixed(1),
        momentum: baseScores.momentum.toFixed(1),
        volume: baseScores.volume.toFixed(1),
        risk: baseScores.risk.toFixed(1)
      },
      inputData: {
        technicalIndicators: {
          rsi: technicalIndicators?.rsi,
          macd: technicalIndicators?.macd ? 'present' : 'missing',
          bollinger: technicalIndicators?.bollinger ? 'present' : 'missing'
        },
        momentum: {
          trend: momentum?.trend,
          strength: momentum?.strength,
          momentum: momentum?.momentum
        },
        volume: {
          volumeSpike: volume?.volumeSpike,
          volumeSpikeFactor: volume?.volumeSpikeFactor,
          buyPressure: volume?.volumeProfile?.buyPressure,
          sellPressure: volume?.volumeProfile?.sellPressure,
          liquidityScore: volume?.liquidityScore
        },
        risk: {
          overall: risk?.overall,
          riskLevel: risk?.riskLevel,
          warningsCount: risk?.warnings?.length || 0
        },
        marketContext: {
          overallTrend: safeContext.marketContext?.overallTrend,
          volatilityIndex: safeContext.marketContext?.volatilityIndex,
          marketSentiment: safeContext.marketContext?.marketSentiment
        }
      },
      duration: `${Date.now() - startTime}ms`
    });
      
    let enhancedScores = { ...baseScores };
    let multiTimeframeResult = null;
    let consecutiveMomentumResult = null;
    let exhaustionPenaltyResult = null;

    // Calculate multi-timeframe score if enabled and data available
    if (this.config.enableMultiTimeframe && safeContext.multiTimeframeData) {
      this.logger.debug('Step 3: Starting multi-timeframe score calculation', { tokenAddress });
      try {
        multiTimeframeResult = await this.withTimeout(
          this.multiTimeframeCalculator.calculate(
            safeContext.multiTimeframeData,
            safeContext
          ),
          10000, // 10 second timeout
          `Multi-timeframe calculation timeout for ${tokenAddress}`
        );
        enhancedScores.pattern = multiTimeframeResult.finalScore;
        this.logger.debug('Step 3 completed: Multi-timeframe score calculated', {
          tokenAddress,
          finalScore: multiTimeframeResult.finalScore.toFixed(1),
          duration: `${Date.now() - startTime}ms`
        });
      } catch (error) {
        this.logger.error('Multi-timeframe calculation failed, using default', {
          tokenAddress,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        enhancedScores.pattern = 50; // Default neutral score
      }
    } else {
      this.logger.debug('Step 3 skipped: Multi-timeframe disabled or no data', { tokenAddress });
    }

    // Calculate consecutive momentum bonus if enabled
    if (this.config.enableConsecutiveMomentum) {
      this.logger.debug('Step 4: Starting consecutive momentum calculation', { tokenAddress });
      try {
        const currentAnalysis: CurrentMomentumAnalysis = {
          rsi: technicalIndicators.rsi,
          macdHistogram: technicalIndicators.macd.histogram,
          volume: volume.currentVolume,
          averageVolume: volume.averageVolume,
          price: safeContext.tokenData.price || 0,
          trendDirection: momentum.trend,
          strength: momentum.strength,
          timestamp: Date.now()
        };
        
        consecutiveMomentumResult = await this.withTimeout(
          this.consecutiveMomentumCalculator.calculateBonus(
            currentAnalysis,
            safeContext
          ),
          8000, // 8 second timeout
          `Consecutive momentum calculation timeout for ${tokenAddress}`
        );
        
        this.logger.debug('Step 4 completed: Consecutive momentum calculated', {
          tokenAddress,
          consecutiveCount: consecutiveMomentumResult.consecutiveCount,
          bonusPercentage: consecutiveMomentumResult.bonusPercentage.toFixed(1),
          duration: `${Date.now() - startTime}ms`
        });
      } catch (error) {
        this.logger.error('Consecutive momentum calculation failed, using default', {
          tokenAddress,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        consecutiveMomentumResult = {
          consecutiveCount: 0,
          bonusPercentage: 0,
          scoreBoost: 0,
          exhaustionWarning: false,
          trendBreakReset: false,
          diminishingReturns: false,
          reasoning: ['Calculation failed - using default values'],
          periods: []
        };
      }
    } else {
      this.logger.debug('Step 4 skipped: Consecutive momentum disabled', { tokenAddress });
    }

    // Calculate exhaustion penalty if enabled
    if (this.config.enableExhaustionPenalty) {
      this.logger.debug('Step 5: Starting exhaustion penalty calculation', { tokenAddress });
      try {
        exhaustionPenaltyResult = await this.withTimeout(
          this.exhaustionPenaltyCalculator.calculatePenalty(
            technicalIndicators,
            momentum,
            volume,
            safeContext.multiTimeframeData,
            safeContext
          ),
          5000, // 5 second timeout
          `Exhaustion penalty calculation timeout for ${tokenAddress}`
        );
        
        this.logger.debug('Step 5 completed: Exhaustion penalty calculated', {
          tokenAddress,
          totalPenalty: exhaustionPenaltyResult.totalPenalty.toFixed(1),
          duration: `${Date.now() - startTime}ms`
        });
      } catch (error) {
        this.logger.error('Exhaustion penalty calculation failed, using default', {
          tokenAddress,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        exhaustionPenaltyResult = {
          totalPenalty: 0,
          exhaustionLevel: 'none' as any,
          signals: [],
          reasoning: ['Calculation failed - using default values'],
          recommendations: []
        };
      }
    } else {
      this.logger.debug('Step 5 skipped: Exhaustion penalty disabled', { tokenAddress });
    }

    this.logger.debug('Step 6: All enhanced components calculated', {
      tokenAddress,
      baseScores: {
        technical: baseScores.technical.toFixed(1),
        momentum: baseScores.momentum.toFixed(1),
        volume: baseScores.volume.toFixed(1),
        risk: baseScores.risk.toFixed(1)
      },
      multiTimeframeScore: multiTimeframeResult?.finalScore.toFixed(1) || 'N/A',
      consecutiveMomentumBonus: consecutiveMomentumResult?.bonusPercentage.toFixed(1) || 'N/A',
      exhaustionPenalty: exhaustionPenaltyResult?.totalPenalty.toFixed(1) || 'N/A',
      duration: `${Date.now() - startTime}ms`
    });

    this.logger.debug('Step 7: Starting final score calculations', { tokenAddress });
    
    // Apply adaptive weighting based on market conditions
    const weights = this.config.adaptiveWeighting
      ? this.calculateAdaptiveWeights(safeContext, enhancedScores)
      : this.config.weights;

    // Calculate enhanced weighted composite score
    const compositeScore = this.calculateEnhancedWeightedScore(
      enhancedScores,
      weights,
      consecutiveMomentumResult,
      exhaustionPenaltyResult
    );

    // Apply non-linear scaling for better distribution
    const scaledScore = this.applyNonLinearScaling(compositeScore);

    // Convert to 1-10 rating scale
    const rating = this.convertToRatingScale(scaledScore);
    
    this.logger.debug('Step 7 completed: Core scores calculated', {
      tokenAddress,
      compositeScore: compositeScore.toFixed(1),
      scaledScore: scaledScore.toFixed(1),
      rating: rating.toFixed(1),
      duration: `${Date.now() - startTime}ms`
    });

    this.logger.debug('Step 8: Starting confidence and smoothing calculations', { tokenAddress });
    
    // Calculate enhanced confidence with all new factors
    const confidence = this.confidenceCalculator.calculate(
      enhancedScores,
      safeContext,
      this.getHistoricalAccuracy(safeContext.tokenData.address),
      safeContext.multiTimeframeData,
      consecutiveMomentumResult ? {
        periods: consecutiveMomentumResult.periods,
        consecutiveCount: consecutiveMomentumResult.consecutiveCount,
        scoreBoost: consecutiveMomentumResult.scoreBoost,
        exhaustionWarning: consecutiveMomentumResult.exhaustionWarning,
        trendBreakReset: consecutiveMomentumResult.trendBreakReset,
        diminishingReturns: consecutiveMomentumResult.diminishingReturns
      } : undefined,
      exhaustionPenaltyResult?.totalPenalty
    );

    // Apply score smoothing if historical data exists
    const smoothedRating = this.applySmoothing(
      rating,
      safeContext.tokenData.address
    );
    
    this.logger.debug('Step 8 completed: Confidence and smoothing calculated', {
      tokenAddress,
      confidence: confidence.toFixed(1),
      originalRating: rating.toFixed(1),
      smoothedRating: smoothedRating.toFixed(1),
      duration: `${Date.now() - startTime}ms`
    });

    this.logger.debug('Step 9: Generating reasoning, alerts, and recommendations', { tokenAddress });
    
    // Generate enhanced reasoning and alerts
    const reasoning = this.generateEnhancedReasoning(
      enhancedScores, 
      weights, 
      safeContext,
      multiTimeframeResult,
      consecutiveMomentumResult,
      exhaustionPenaltyResult
    );
    const alerts = this.generateEnhancedAlerts(
      enhancedScores, 
      rating, 
      confidence,
      multiTimeframeResult,
      consecutiveMomentumResult,
      exhaustionPenaltyResult
    );
    const recommendation = this.determineRecommendation(smoothedRating, confidence);
    
    this.logger.debug('Step 9 completed: Reasoning and alerts generated', {
      tokenAddress,
      reasoningCount: reasoning.length,
      alertsCount: alerts.length,
      recommendation,
      duration: `${Date.now() - startTime}ms`
    });

    const result: RatingResult = {
      rating: smoothedRating,
      confidence,
      components: enhancedScores,
      weights: {
        ...weights,
        fundamentals: 0
      } as Record<keyof ScoreComponents, number>,
      reasoning,
      alerts,
      recommendation
    };

    this.logger.debug('Step 10: Starting enhanced rating storage', { tokenAddress });
    
    // Store enhanced rating data with timeout
    try {
      await this.withTimeout(
        this.storeEnhancedRating(safeContext.tokenData.address, result, {
          multiTimeframe: multiTimeframeResult,
          consecutiveMomentum: consecutiveMomentumResult,
          exhaustionPenalty: exhaustionPenaltyResult
        }),
        5000, // 5 second timeout for storage
        `Rating storage timeout for ${tokenAddress}`
      );
      
      this.logger.debug('Step 10 completed: Rating data stored', {
        tokenAddress,
        duration: `${Date.now() - startTime}ms`
      });
    } catch (error) {
      this.logger.error('Rating storage failed, continuing with result', {
        tokenAddress,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      // Don't throw - storage failure shouldn't break rating calculation
    }

    const duration = Date.now() - startTime;
    this.logger.info('Rating calculation completed', {
      tokenAddress,
      rating: smoothedRating,
      confidence,
      duration: `${duration}ms`,
      enhancements: {
        multiTimeframe: !!multiTimeframeResult,
        consecutiveMomentum: !!consecutiveMomentumResult,
        exhaustionPenalty: !!exhaustionPenaltyResult
      }
    });

    return result;
  }
  
  /**
   * Wraps a promise with a timeout to prevent hanging operations
   */
  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    timeoutMessage: string
  ): Promise<T> {
    let timeoutHandle: NodeJS.Timeout;
    
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(new Error(`${timeoutMessage} (after ${timeoutMs}ms)`));
      }, timeoutMs);
    });
    
    try {
      const result = await Promise.race([promise, timeoutPromise]);
      clearTimeout(timeoutHandle);
      return result;
    } catch (error) {
      clearTimeout(timeoutHandle);
      throw error;
    }
  }

  /**
   * Calculate individual component scores with timeouts and detailed logging
   */
  private async calculateComponentScores(
    technicalIndicators: TechnicalIndicators,
    momentum: MomentumAnalysis,
    volume: VolumeAnalysis,
    risk: RiskAssessment,
    context: AnalysisContext
  ): Promise<ScoreComponents> {
    const tokenAddress = context.tokenData?.address || 'unknown';
    const componentStartTime = Date.now();
    
    try {
      this.logger.debug('Starting component score calculations with individual timeouts', {
        tokenAddress
      });

      const [technicalScore, momentumScore, volumeScore, riskScore] = await Promise.all([
        this.withTimeout(
          this.technicalCalculator.calculate(technicalIndicators, context),
          5000, // 5 second timeout per component
          `Technical score calculation timeout for ${tokenAddress}`
        ).catch(error => {
          this.logger.error('Technical score calculation failed', { 
            error: error instanceof Error ? error.message : 'Unknown error',
            tokenAddress,
            isTimeout: error instanceof Error && error.message.includes('timeout')
          });
          return 50; // Default fallback score
        }),
        this.withTimeout(
          this.momentumCalculator.calculate(momentum, context),
          5000,
          `Momentum score calculation timeout for ${tokenAddress}`
        ).catch(error => {
          this.logger.error('Momentum score calculation failed', { 
            error: error instanceof Error ? error.message : 'Unknown error',
            tokenAddress,
            isTimeout: error instanceof Error && error.message.includes('timeout')
          });
          return 50; // Default fallback score
        }),
        this.withTimeout(
          this.volumeCalculator.calculate(volume, context),
          5000,
          `Volume score calculation timeout for ${tokenAddress}`
        ).catch(error => {
          this.logger.error('Volume score calculation failed', { 
            error: error instanceof Error ? error.message : 'Unknown error',
            tokenAddress,
            isTimeout: error instanceof Error && error.message.includes('timeout')
          });
          return 50; // Default fallback score
        }),
        this.withTimeout(
          this.riskCalculator.calculate(risk, context),
          5000,
          `Risk score calculation timeout for ${tokenAddress}`
        ).catch(error => {
          this.logger.error('Risk score calculation failed', { 
            error: error instanceof Error ? error.message : 'Unknown error',
            tokenAddress,
            isTimeout: error instanceof Error && error.message.includes('timeout')
          });
          return 50; // Default fallback score
        })
      ]);

      const componentDuration = Date.now() - componentStartTime;
      this.logger.debug('Component score calculations completed', {
        tokenAddress,
        technicalScore: technicalScore.toFixed(1),
        momentumScore: momentumScore.toFixed(1),
        volumeScore: volumeScore.toFixed(1),
        riskScore: riskScore.toFixed(1),
        duration: `${componentDuration}ms`
      });

      return {
        technical: technicalScore,
        momentum: momentumScore,
        volume: volumeScore,
        risk: riskScore,
        pattern: 0, // Will be integrated later
        fundamentals: 0 // Will be integrated later
      };
    } catch (error) {
      this.logger.error('Component score calculation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        tokenAddress: context.tokenData?.address || 'unknown'
      });
      throw error;
    }
  }

  /**
   * Calculate adaptive weights based on market conditions
   */
  private calculateAdaptiveWeights(
    context: AnalysisContext,
    scores: ScoreComponents
  ): RatingEngineConfig['weights'] {
    const baseWeights = { ...this.config.weights };
    
    // Get safe market context values
    const { overallTrend, volatilityIndex } = ContextDefaults.getMarketContextValues(context);
    
    // Increase technical weight in trending markets
    if (overallTrend !== 'sideways') {
      baseWeights.technical += 0.05;
      baseWeights.momentum -= 0.025;
      baseWeights.volume -= 0.025;
    }
    
    // Increase risk weight in high volatility periods
    if (volatilityIndex > 70) {
      baseWeights.risk += 0.05;
      baseWeights.technical -= 0.03;
      baseWeights.momentum -= 0.02;
    }
    
    // Increase volume weight when volume score is exceptional
    if (scores.volume > 85) {
      baseWeights.volume += 0.05;
      baseWeights.technical -= 0.03;
      baseWeights.momentum -= 0.02;
    }

    // Normalize weights to sum to 1.0
    const totalWeight = Object.values(baseWeights).reduce((sum, weight) => sum + weight, 0);
    Object.keys(baseWeights).forEach(key => {
      baseWeights[key as keyof typeof baseWeights] /= totalWeight;
    });

    return baseWeights;
  }

  /**
   * Calculate enhanced weighted composite score with new components
   */
  private calculateEnhancedWeightedScore(
    scores: ScoreComponents,
    weights: RatingEngineConfig['weights'],
    consecutiveMomentumResult?: any,
    exhaustionPenaltyResult?: any
  ): number {
    let baseScore = (
      scores.technical * weights.technical +
      scores.momentum * weights.momentum +
      scores.volume * weights.volume +
      scores.risk * weights.risk
    );

    // Add multi-timeframe score if available (stored in pattern field)
    if (scores.pattern > 0 && weights.multiTimeframe) {
      baseScore += scores.pattern * weights.multiTimeframe;
    }

    // Apply consecutive momentum bonus
    if (consecutiveMomentumResult && weights.consecutiveMomentum) {
      const momentumBonus = (consecutiveMomentumResult.bonusPercentage / 100) * baseScore;
      baseScore += momentumBonus * weights.consecutiveMomentum;
    }

    // Apply exhaustion penalty
    if (exhaustionPenaltyResult) {
      // Penalty is already negative, so we add it (which subtracts)
      baseScore += exhaustionPenaltyResult.totalPenalty;
    }

    return Math.max(0, baseScore);
  }

  /**
   * Calculate weighted composite score (legacy method for compatibility)
   */
  private calculateWeightedScore(
    scores: ScoreComponents,
    weights: RatingEngineConfig['weights']
  ): number {
    return this.calculateEnhancedWeightedScore(scores, weights);
  }

  /**
   * Apply non-linear scaling for better rating distribution
   */
  private applyNonLinearScaling(score: number): number {
    // Use sigmoid-like transformation to create more balanced distribution
    // This prevents clustering around middle values
    const normalizedScore = score / 100;
    const scaledScore = 1 / (1 + Math.exp(-6 * (normalizedScore - 0.5)));
    return scaledScore * 100;
  }

  /**
   * Convert 0-100 score to 1-10 rating scale
   */
  private convertToRatingScale(score: number): number {
    // Non-linear mapping to create meaningful rating distribution
    if (score >= 95) return 10;      // Exceptional (top 5%)
    if (score >= 85) return 9;       // Excellent (top 15%)  
    if (score >= 75) return 8;       // Very Good (top 25%)
    if (score >= 65) return 7;       // Good (top 35%)
    if (score >= 55) return 6;       // Above Average
    if (score >= 45) return 5;       // Average
    if (score >= 35) return 4;       // Below Average
    if (score >= 25) return 3;       // Poor
    if (score >= 15) return 2;       // Very Poor
    return 1;                        // Extremely Poor
  }

  /**
   * Apply score smoothing to prevent rating volatility
   */
  private applySmoothing(rating: number, tokenAddress: string): number {
    const history = this.historicalRatings.get(tokenAddress);
    if (!history || history.length === 0) {
      return rating;
    }

    const lastRating = history[history.length - 1].rating;
    const smoothingFactor = this.config.smoothingFactor;
    
    return Math.round(
      (rating * (1 - smoothingFactor) + lastRating * smoothingFactor) * 10
    ) / 10;
  }

  /**
   * Generate detailed reasoning for the rating
   */
  private generateReasoning(
    scores: ScoreComponents,
    weights: RatingEngineConfig['weights'],
    context: AnalysisContext
  ): string[] {
    const reasoning: string[] = [];

    // Technical analysis contribution
    if (scores.technical > 75) {
      reasoning.push(`Strong technical signals: RSI, MACD, and moving averages show bullish alignment (${scores.technical.toFixed(1)}/100)`);
    } else if (scores.technical < 40) {
      reasoning.push(`Weak technical signals: Indicators suggest bearish or neutral conditions (${scores.technical.toFixed(1)}/100)`);
    }

    // Momentum analysis contribution  
    if (scores.momentum > 80) {
      reasoning.push(`Exceptional momentum: Strong trend with high breakout potential (${scores.momentum.toFixed(1)}/100)`);
    } else if (scores.momentum < 35) {
      reasoning.push(`Poor momentum: Weak trend with limited upside potential (${scores.momentum.toFixed(1)}/100)`);
    }

    // Volume analysis contribution
    if (scores.volume > 85) {
      reasoning.push(`Outstanding volume activity: Significant buying pressure detected (${scores.volume.toFixed(1)}/100)`);
    } else if (scores.volume < 30) {
      reasoning.push(`Low volume concern: Limited trading activity may indicate lack of interest (${scores.volume.toFixed(1)}/100)`);
    }

    // Risk assessment contribution
    if (scores.risk > 80) {
      reasoning.push(`Low risk profile: Good liquidity and market cap stability (${scores.risk.toFixed(1)}/100)`);
    } else if (scores.risk < 40) {
      reasoning.push(`High risk warning: Elevated volatility or liquidity concerns (${scores.risk.toFixed(1)}/100)`);
    }

    // Market context
    const { overallTrend } = ContextDefaults.getMarketContextValues(context);
    if (overallTrend === 'bull') {
      reasoning.push('Favorable market conditions support bullish outlook');
    } else if (overallTrend === 'bear') {
      reasoning.push('Challenging market conditions may limit upside potential');
    }

    return reasoning;
  }

  /**
   * Generate alerts based on scores and rating
   */
  private generateAlerts(
    scores: ScoreComponents,
    rating: number,
    confidence: number
  ): string[] {
    const alerts: string[] = [];

    if (rating >= 9 && confidence > 80) {
      alerts.push('🚀 EXCEPTIONAL OPPORTUNITY: Rare high-confidence rating above 9');
    }

    if (rating >= 7 && confidence > 75) {
      alerts.push('🔥 STRONG BUY SIGNAL: High rating with good confidence');
    }

    if (scores.volume > 90) {
      alerts.push('📈 VOLUME SPIKE: Unusual trading activity detected');
    }

    if (scores.risk < 30) {
      alerts.push('⚠️ HIGH RISK: Significant risk factors identified');
    }

    if (confidence < 50) {
      alerts.push('🤔 LOW CONFIDENCE: Rating based on limited or conflicting data');
    }

    return alerts;
  }

  /**
   * Determine recommendation based on rating and confidence
   */
  private determineRecommendation(
    rating: number,
    confidence: number
  ): RatingResult['recommendation'] {
    if (confidence < 50) return 'hold'; // Low confidence = hold

    if (rating >= 8) return 'strong_buy';
    if (rating >= 7) return 'buy';
    if (rating >= 5) return 'hold';
    if (rating >= 3) return 'sell';
    return 'strong_sell';
  }

  /**
   * Generate enhanced reasoning with new components
   */
  private generateEnhancedReasoning(
    scores: ScoreComponents,
    weights: RatingEngineConfig['weights'],
    context: AnalysisContext,
    multiTimeframeResult?: any,
    consecutiveMomentumResult?: any,
    exhaustionPenaltyResult?: any
  ): string[] {
    const reasoning = this.generateReasoning(scores, weights, context);

    // Add multi-timeframe reasoning
    if (multiTimeframeResult) {
      reasoning.push(`Multi-timeframe analysis: ${multiTimeframeResult.finalScore.toFixed(1)}/100 (alignment: ${multiTimeframeResult.alignmentDetails.consensusStrength.toFixed(1)}%)`);
      
      if (multiTimeframeResult.timeframeAlignment > 20) {
        reasoning.push(`Strong timeframe alignment bonus: +${multiTimeframeResult.timeframeAlignment.toFixed(1)} points`);
      }
    }

    // Add consecutive momentum reasoning
    if (consecutiveMomentumResult && consecutiveMomentumResult.consecutiveCount > 0) {
      reasoning.push(...consecutiveMomentumResult.reasoning);
    }

    // Add exhaustion penalty reasoning
    if (exhaustionPenaltyResult && exhaustionPenaltyResult.signals.length > 0) {
      reasoning.push(...exhaustionPenaltyResult.reasoning);
    }

    return reasoning;
  }

  /**
   * Generate enhanced alerts with new components
   */
  private generateEnhancedAlerts(
    scores: ScoreComponents,
    rating: number,
    confidence: number,
    multiTimeframeResult?: any,
    consecutiveMomentumResult?: any,
    exhaustionPenaltyResult?: any
  ): string[] {
    const alerts = this.generateAlerts(scores, rating, confidence);

    // Add multi-timeframe alerts
    if (multiTimeframeResult) {
      if (multiTimeframeResult.alignmentDetails.consensusStrength > 80) {
        alerts.push('🎯 EXCEPTIONAL TIMEFRAME ALIGNMENT: All timeframes showing strong consensus');
      } else if (multiTimeframeResult.alignmentDetails.consensusStrength < 40) {
        alerts.push('⚠️ TIMEFRAME DIVERGENCE: Conflicting signals across timeframes');
      }
    }

    // Add consecutive momentum alerts
    if (consecutiveMomentumResult) {
      if (consecutiveMomentumResult.consecutiveCount >= 3) {
        alerts.push('🔥 SUSTAINED MOMENTUM: 3+ consecutive strong periods detected');
      }
      if (consecutiveMomentumResult.exhaustionWarning) {
        alerts.push('⚠️ MOMENTUM EXHAUSTION: Signs of momentum fatigue detected');
      }
    }

    // Add exhaustion penalty alerts
    if (exhaustionPenaltyResult) {
      if (exhaustionPenaltyResult.exhaustionLevel === 'extreme' || exhaustionPenaltyResult.exhaustionLevel === 'severe') {
        alerts.push('🚨 EXTREME EXHAUSTION: High risk of momentum reversal');
      }
      
      if (exhaustionPenaltyResult.recommendations.length > 0) {
        alerts.push(...exhaustionPenaltyResult.recommendations.map(rec => `📋 ${rec}`));
      }
    }

    return alerts;
  }

  /**
   * Store enhanced rating with additional data
   */
  private async storeEnhancedRating(
    tokenAddress: string, 
    rating: RatingResult,
    enhancements: {
      multiTimeframe?: any;
      consecutiveMomentum?: any;
      exhaustionPenalty?: any;
    }
  ): Promise<void> {
    // Store in memory for historical tracking
    this.storeRating(tokenAddress, rating);

    // Store in database if available
    if (this.dbManager) {
      try {
        await this.dbManager.storeAnalysisRecord({
          token_address: tokenAddress,
          timestamp: new Date().toISOString(),
          timeframe: 'composite',
          price: 0, // Would need actual price
          market_cap: 0, // Would need actual market cap
          volume_24h: 0, // Would need actual volume
          technical_indicators: JSON.stringify({}),
          momentum_data: JSON.stringify({}),
          volume_analysis: JSON.stringify({}),
          pattern_analysis: JSON.stringify({}),
          risk_assessment: JSON.stringify({}),
          rating: rating.rating,
          confidence: rating.confidence,
          score_components: JSON.stringify(rating.components),
          recommendation: rating.recommendation,
          reasoning: JSON.stringify(rating.reasoning),
          alerts: JSON.stringify(rating.alerts),
          consecutive_momentum_boost: enhancements.consecutiveMomentum?.bonusPercentage || 0,
          timeframe_alignment_score: enhancements.multiTimeframe?.timeframeAlignment || 0,
          exhaustion_penalty: enhancements.exhaustionPenalty?.totalPenalty || 0
        });

        this.logger.debug('Enhanced rating stored to database', {
          tokenAddress,
          rating: rating.rating,
          hasEnhancements: {
            multiTimeframe: !!enhancements.multiTimeframe,
            consecutiveMomentum: !!enhancements.consecutiveMomentum,
            exhaustionPenalty: !!enhancements.exhaustionPenalty
          }
        });

      } catch (error) {
        this.logger.error('Failed to store enhanced rating to database', {
          error: error instanceof Error ? error.message : 'Unknown error',
          tokenAddress
        });
        // Don't throw - storage failure shouldn't break rating calculation
      }
    }
  }

  /**
   * Store rating for historical tracking (legacy method)
   */
  private storeRating(tokenAddress: string, rating: RatingResult): void {
    if (!this.historicalRatings.has(tokenAddress)) {
      this.historicalRatings.set(tokenAddress, []);
    }

    const history = this.historicalRatings.get(tokenAddress)!;
    history.push(rating);

    // Keep only last 50 ratings per token
    if (history.length > 50) {
      history.splice(0, history.length - 50);
    }
  }

  /**
   * Get historical rating accuracy for confidence calculation
   */
  private getHistoricalAccuracy(tokenAddress: string): number {
    const history = this.historicalRatings.get(tokenAddress);
    if (!history || history.length < 3) {
      return 0.7; // Default 70% accuracy for new tokens
    }

    // Calculate accuracy based on rating consistency and performance
    // This would integrate with actual price performance tracking
    return 0.75; // Placeholder - would be calculated from real performance data
  }

  /**
   * Clean up old data across all components
   */
  public async cleanupOldData(daysToKeep: number = 7): Promise<{
    databaseRecords: number;
    memoryRatings: number;
  }> {
    let databaseRecords = 0;
    let memoryRatings = 0;

    try {
      // Clean up database if available
      if (this.dbManager) {
        const dbCleanup = await this.dbManager.cleanupOldData();
        databaseRecords = dbCleanup.consecutiveMomentum + dbCleanup.timeframeIndicators + dbCleanup.analysisRecords;

        this.logger.info('Database cleanup completed', {
          consecutiveMomentum: dbCleanup.consecutiveMomentum,
          timeframeIndicators: dbCleanup.timeframeIndicators,
          analysisRecords: dbCleanup.analysisRecords,
          totalRecords: databaseRecords
        });
      }

      // Clean up memory cache (keep only recent ratings)
      const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
      
      for (const [tokenAddress, ratings] of this.historicalRatings.entries()) {
        const initialCount = ratings.length;
        // Remove old ratings (assuming they have timestamps)
        this.historicalRatings.set(tokenAddress, ratings.slice(-20)); // Keep last 20 regardless of time
        memoryRatings += initialCount - ratings.length;
      }

      this.logger.info('Memory cleanup completed', {
        databaseRecords,
        memoryRatings,
        daysToKeep
      });

      return { databaseRecords, memoryRatings };

    } catch (error) {
      this.logger.error('Cleanup failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return { databaseRecords, memoryRatings };
    }
  }

  /**
   * Get enhanced rating statistics for monitoring
   */
  public getRatingStatistics(): {
    totalRatings: number;
    averageRating: number;
    ratingDistribution: Record<number, number>;
    averageConfidence: number;
    enhancementUsage: {
      multiTimeframe: number;
      consecutiveMomentum: number;
      exhaustionPenalty: number;
    };
  } {
    let totalRatings = 0;
    let ratingSum = 0;
    let confidenceSum = 0;
    const distribution: Record<number, number> = {};
    const enhancementUsage = {
      multiTimeframe: 0,
      consecutiveMomentum: 0,
      exhaustionPenalty: 0
    };

    for (let i = 1; i <= 10; i++) {
      distribution[i] = 0;
    }

    this.historicalRatings.forEach(ratings => {
      ratings.forEach(rating => {
        totalRatings++;
        ratingSum += rating.rating;
        confidenceSum += rating.confidence;
        distribution[Math.round(rating.rating)]++;

        // Count enhancement usage (simplified detection)
        if (rating.components.pattern > 0) enhancementUsage.multiTimeframe++;
        if (rating.alerts.some(alert => alert.includes('SUSTAINED MOMENTUM'))) enhancementUsage.consecutiveMomentum++;
        if (rating.alerts.some(alert => alert.includes('EXHAUSTION'))) enhancementUsage.exhaustionPenalty++;
      });
    });

    return {
      totalRatings,
      averageRating: totalRatings > 0 ? ratingSum / totalRatings : 0,
      ratingDistribution: distribution,
      averageConfidence: totalRatings > 0 ? confidenceSum / totalRatings : 0,
      enhancementUsage
    };
  }

  /**
   * Update rating engine configuration
   */
  public updateConfig(config: Partial<RatingEngineConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Update individual calculator configurations if needed
    if (config.enableMultiTimeframe !== undefined || config.enableConsecutiveMomentum !== undefined) {
      this.logger.info('Rating engine configuration updated', {
        enableMultiTimeframe: this.config.enableMultiTimeframe,
        enableConsecutiveMomentum: this.config.enableConsecutiveMomentum,
        enableExhaustionPenalty: this.config.enableExhaustionPenalty
      });
    }
  }

  /**
   * Get current configuration
   */
  public getConfig(): RatingEngineConfig {
    return { ...this.config };
  }

  /**
   * Initialize database connection
   */
  public async initializeDatabase(dbPath?: string): Promise<void> {
    if (!this.dbManager) {
      this.dbManager = new DatabaseManager(dbPath);
      await this.dbManager.initialize();
      
      // Update calculators with database manager
      this.multiTimeframeCalculator = new MultiTimeframeScoreCalculator(this.dbManager);
      this.consecutiveMomentumCalculator = new ConsecutiveMomentumCalculator(this.dbManager);
      
      this.logger.info('Database initialized for rating engine', { dbPath });
    }
  }
}