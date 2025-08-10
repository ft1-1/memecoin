/**
 * Consecutive Momentum Bonus Calculator - MOMENTUM OPTIMIZED
 * 
 * CRITICAL FIX: Previous thresholds were too restrictive (0 uses out of 86 ratings)
 * - MIN_STRENGTH_THRESHOLD: 60 → 45 (key fix for activation)
 * - EXHAUSTION_THRESHOLD: 80 → 85 (less restrictive)
 * - VOLUME_CONFIRMATION_REQUIRED: true → false (remove blocking requirement)
 * - Relaxed RSI and strength drop thresholds
 * 
 * Tracks consecutive 15-minute periods of strong momentum with database persistence
 * Applies progressive bonuses: +15% for 2nd period, +25% for 3rd+ periods (max)
 */

import { Logger } from '../../../utils/Logger';
import { ConsecutiveMomentumTracking, ConsecutiveMomentumPeriod, AnalysisContext } from '../../../types/analysis';
import { DatabaseManager } from '../../../database/DatabaseManager';

export interface MomentumBonusResult {
  consecutiveCount: number;
  bonusPercentage: number; // 0-25%
  scoreBoost: number; // Applied to base technical score
  exhaustionWarning: boolean;
  trendBreakReset: boolean;
  diminishingReturns: boolean;
  reasoning: string[];
  periods: ConsecutiveMomentumPeriod[];
}

export interface CurrentMomentumAnalysis {
  rsi: number;
  macdHistogram: number;
  volume: number;
  averageVolume: number;
  price: number;
  trendDirection: 'bullish' | 'bearish' | 'neutral';
  strength: number;
  timestamp: number;
}

export class ConsecutiveMomentumCalculator {
  private logger = Logger.getInstance();
  private dbManager?: DatabaseManager;
  
  // Configuration - MOMENTUM OPTIMIZED THRESHOLDS
  // Previous thresholds were too strict and prevented activation (0 uses out of 86 ratings)
  private readonly INTERVAL_MINUTES = 15;
  private readonly MAX_BOOST_PERCENTAGE = 25;
  private readonly EXHAUSTION_THRESHOLD = 85; // Raised from 80 to 85 - less restrictive
  private readonly VOLUME_CONFIRMATION_REQUIRED = false; // Changed to false - was blocking too many signals
  private readonly MIN_STRENGTH_THRESHOLD = 45; // Lowered from 60 to 45 - CRITICAL FIX for activation

  constructor(dbManager?: DatabaseManager) {
    this.dbManager = dbManager;
  }

  /**
   * Calculate consecutive momentum bonus with database persistence and timeout protection
   */
  public async calculateBonus(
    currentAnalysis: CurrentMomentumAnalysis,
    context: AnalysisContext
  ): Promise<MomentumBonusResult> {
    const startTime = Date.now();
    const tokenAddress = context.tokenData?.address || 'unknown';
    
    try {
      this.logger.debug('Starting consecutive momentum calculation', {
        tokenAddress,
        trendDirection: currentAnalysis.trendDirection,
        strength: currentAnalysis.strength,
        rsi: currentAnalysis.rsi
      });

      // Step 1: Load historical periods from database with timeout
      this.logger.debug('Step CM-1: Loading historical periods from database', { tokenAddress });
      const historicalPeriods = await this.withTimeout(
        this.loadHistoricalPeriods(tokenAddress),
        5000, // 5 second timeout
        `Historical periods load timeout for ${tokenAddress}`
      );
      
      this.logger.debug('Step CM-1 completed', { 
        tokenAddress, 
        historicalPeriodsCount: historicalPeriods.length,
        duration: `${Date.now() - startTime}ms` 
      });

      // Step 2: Check if we should reset tracking due to trend break
      this.logger.debug('Step CM-2: Checking for trend break reset', { tokenAddress });
      const shouldReset = this.shouldResetForTrendBreak(currentAnalysis, historicalPeriods);
      
      if (shouldReset) {
        this.logger.debug('Step CM-2a: Resetting tracking due to trend break', { tokenAddress });
        await this.withTimeout(
          this.resetTracking(tokenAddress),
          3000, // 3 second timeout
          `Reset tracking timeout for ${tokenAddress}`
        );
        historicalPeriods.length = 0; // Clear array
        this.logger.debug('Step CM-2a completed: Tracking reset', { tokenAddress });
      } else {
        this.logger.debug('Step CM-2 completed: No reset needed', { tokenAddress });
      }

      // Step 3: Create current period
      this.logger.debug('Step CM-3: Creating current momentum period', { tokenAddress });
      const currentPeriod = this.createMomentumPeriod(currentAnalysis, historicalPeriods.length);
      this.logger.debug('Step CM-3 completed', { 
        tokenAddress, 
        periodIndex: currentPeriod.periodIndex,
        duration: `${Date.now() - startTime}ms` 
      });

      // Step 4: Validate current period
      this.logger.debug('Step CM-4: Validating current period', { tokenAddress });
      const isValidPeriod = this.isPeriodValid(currentPeriod);
      this.logger.debug('Step CM-4 completed', { 
        tokenAddress, 
        isValidPeriod,
        duration: `${Date.now() - startTime}ms` 
      });

      let consecutivePeriods: ConsecutiveMomentumPeriod[];
      if (isValidPeriod) {
        // Step 5a: Add current period to chain and store
        this.logger.debug('Step CM-5a: Adding valid period to chain', { tokenAddress });
        consecutivePeriods = [...historicalPeriods, currentPeriod];
        
        // Store current period to database with timeout
        await this.withTimeout(
          this.storeMomentumPeriod(tokenAddress, currentPeriod),
          3000, // 3 second timeout
          `Store momentum period timeout for ${tokenAddress}`
        );
        
        this.logger.debug('Step CM-5a completed: Period stored', { 
          tokenAddress, 
          totalPeriods: consecutivePeriods.length,
          duration: `${Date.now() - startTime}ms` 
        });
      } else {
        // Step 5b: Invalid period breaks the chain
        this.logger.debug('Step CM-5b: Invalid period, breaking chain', { tokenAddress });
        consecutivePeriods = [];
        
        await this.withTimeout(
          this.resetTracking(tokenAddress),
          3000, // 3 second timeout
          `Reset tracking timeout for invalid period ${tokenAddress}`
        );
        
        this.logger.debug('Step CM-5b completed: Chain broken and reset', { tokenAddress });
      }

      // Step 6: Calculate momentum bonus
      this.logger.debug('Step CM-6: Calculating momentum bonus', { 
        tokenAddress, 
        periodsCount: consecutivePeriods.length 
      });
      const result = this.calculateMomentumBonus(consecutivePeriods, currentAnalysis);

      const totalDuration = Date.now() - startTime;
      this.logger.debug('Consecutive momentum calculation completed', {
        tokenAddress,
        consecutiveCount: result.consecutiveCount,
        bonusPercentage: result.bonusPercentage,
        exhaustionWarning: result.exhaustionWarning,
        totalDuration: `${totalDuration}ms`
      });

      return result;

    } catch (error) {
      this.logger.error('Consecutive momentum calculation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        tokenAddress: context.tokenData?.address || 'unknown'
      });
      
      // Return safe default on error
      return this.getDefaultResult();
    }
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
   * Load historical momentum periods from database
   */
  private async loadHistoricalPeriods(tokenAddress: string): Promise<ConsecutiveMomentumPeriod[]> {
    if (!this.dbManager) return [];

    try {
      const records = await this.dbManager.getConsecutiveMomentum(tokenAddress, '15m', 10);
      
      return records.map(record => ({
        periodIndex: record.period_index,
        timestamp: new Date(record.timestamp).getTime(),
        rsi: record.rsi,
        macdHistogram: record.macd_histogram,
        volumeConfirmed: record.volume_confirmed,
        trendDirection: record.trend_direction,
        strength: record.strength,
        exhaustionRisk: record.exhaustion_risk
      })).sort((a, b) => a.timestamp - b.timestamp);

    } catch (error) {
      this.logger.error('Failed to load historical momentum periods', {
        error: error instanceof Error ? error.message : 'Unknown error',
        tokenAddress
      });
      return [];
    }
  }

  /**
   * Store momentum period to database
   */
  private async storeMomentumPeriod(tokenAddress: string, period: ConsecutiveMomentumPeriod): Promise<void> {
    if (!this.dbManager) return;

    try {
      await this.dbManager.storeConsecutiveMomentum({
        token_address: tokenAddress,
        timeframe: '15m',
        period_index: period.periodIndex,
        timestamp: new Date(period.timestamp).toISOString(),
        rsi: period.rsi,
        macd_histogram: period.macdHistogram,
        volume_confirmed: period.volumeConfirmed,
        trend_direction: period.trendDirection,
        strength: period.strength,
        exhaustion_risk: period.exhaustionRisk
      });

      this.logger.debug('Momentum period stored to database', {
        tokenAddress,
        periodIndex: period.periodIndex,
        trendDirection: period.trendDirection
      });

    } catch (error) {
      this.logger.error('Failed to store momentum period', {
        error: error instanceof Error ? error.message : 'Unknown error',
        tokenAddress,
        periodIndex: period.periodIndex
      });
      // Don't throw - storage failure shouldn't break calculation
    }
  }

  /**
   * Reset tracking by clearing database records
   */
  private async resetTracking(tokenAddress: string): Promise<void> {
    if (!this.dbManager) return;

    try {
      // Delete recent records for this token (keep older data for analysis)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      await this.dbManager.query(
        'DELETE FROM consecutive_momentum WHERE token_address = ? AND timeframe = ? AND timestamp > ?',
        [tokenAddress, '15m', oneDayAgo]
      );

      this.logger.debug('Momentum tracking reset for token', { tokenAddress });

    } catch (error) {
      this.logger.error('Failed to reset momentum tracking', {
        error: error instanceof Error ? error.message : 'Unknown error',
        tokenAddress
      });
    }
  }

  /**
   * Create momentum period from current analysis
   */
  private createMomentumPeriod(
    analysis: CurrentMomentumAnalysis,
    currentIndex: number
  ): ConsecutiveMomentumPeriod {
    const intervalStart = this.getIntervalStart(analysis.timestamp);
    
    return {
      periodIndex: currentIndex,
      timestamp: intervalStart,
      rsi: analysis.rsi,
      macdHistogram: analysis.macdHistogram,
      volumeConfirmed: this.isVolumeConfirmed(analysis),
      trendDirection: analysis.trendDirection,
      strength: analysis.strength,
      exhaustionRisk: this.detectExhaustionRisk(analysis)
    };
  }

  /**
   * Check if period is valid for consecutive momentum - RELAXED THRESHOLDS
   * Previous version was too restrictive and never triggered
   */
  private isPeriodValid(period: ConsecutiveMomentumPeriod): boolean {
    // RELAXED: Must have moderate momentum signal (was 60, now 45)
    if (period.strength < this.MIN_STRENGTH_THRESHOLD) {
      this.logger.debug('Period invalid: strength too low', {
        strength: period.strength,
        threshold: this.MIN_STRENGTH_THRESHOLD
      });
      return false;
    }

    // Must have clear trend direction (kept same - reasonable)
    if (period.trendDirection === 'neutral') {
      this.logger.debug('Period invalid: neutral trend direction');
      return false;
    }

    // RELAXED: Volume confirmation optional (was required, now optional)
    if (this.VOLUME_CONFIRMATION_REQUIRED && !period.volumeConfirmed) {
      this.logger.debug('Period invalid: volume not confirmed');
      return false;
    }

    // RELAXED: Allow some exhaustion risk for momentum continuation
    // Only skip if VERY high exhaustion (previously any exhaustion blocked it)
    if (period.exhaustionRisk && period.rsi > 90) {
      this.logger.debug('Period invalid: extreme exhaustion risk', { rsi: period.rsi });
      return false;
    }

    this.logger.debug('Period validated for consecutive momentum', {
      strength: period.strength,
      trendDirection: period.trendDirection,
      volumeConfirmed: period.volumeConfirmed,
      exhaustionRisk: period.exhaustionRisk
    });

    return true;
  }

  /**
   * Check if volume is confirmed for the period - MOMENTUM FOCUSED
   * Lowered threshold to capture more momentum opportunities
   */
  private isVolumeConfirmed(analysis: CurrentMomentumAnalysis): boolean {
    if (analysis.averageVolume === 0) return false;
    const volumeRatio = analysis.volume / analysis.averageVolume;
    // RELAXED: Lowered from 1.2x to 1.1x (10% above average vs 20%)
    // This aligns with our focus on capturing early momentum
    return volumeRatio >= 1.1;
  }

  /**
   * Detect momentum exhaustion risk - LESS RESTRICTIVE
   * Previous version was too sensitive and blocked legitimate momentum
   */
  private detectExhaustionRisk(analysis: CurrentMomentumAnalysis): boolean {
    // RELAXED: RSI exhaustion thresholds (was 80/20, now 85/15)
    // Allow momentum to continue even in "overbought" conditions
    if (analysis.trendDirection === 'bullish' && analysis.rsi > this.EXHAUSTION_THRESHOLD) {
      this.logger.debug('Bullish exhaustion risk detected', { rsi: analysis.rsi, threshold: this.EXHAUSTION_THRESHOLD });
      return true;
    }
    if (analysis.trendDirection === 'bearish' && analysis.rsi < (100 - this.EXHAUSTION_THRESHOLD)) {
      this.logger.debug('Bearish exhaustion risk detected', { rsi: analysis.rsi, threshold: 100 - this.EXHAUSTION_THRESHOLD });
      return true;
    }

    // RELAXED: MACD divergence threshold (was 0.01, now 0.005)
    // Less sensitive to minor MACD weakening
    if (Math.abs(analysis.macdHistogram) < 0.005) {
      this.logger.debug('MACD exhaustion risk detected', { macdHistogram: analysis.macdHistogram });
      return true;
    }

    return false;
  }

  /**
   * Check if we should reset tracking due to trend break
   */
  private shouldResetForTrendBreak(
    current: CurrentMomentumAnalysis,
    historicalPeriods: ConsecutiveMomentumPeriod[]
  ): boolean {
    if (historicalPeriods.length === 0) return false;

    const lastPeriod = historicalPeriods[historicalPeriods.length - 1];

    // Trend direction changed significantly
    if (lastPeriod.trendDirection !== current.trendDirection && 
        current.trendDirection !== 'neutral') {
      return true;
    }

    // RELAXED: Significant strength drop (was >40 points, now >50 points)
    // Allow for normal momentum fluctuations
    if (lastPeriod.strength - current.strength > 50) {
      return true;
    }

    // RELAXED: RSI crossed major levels (was 60/40, now 70/30)
    // Less sensitive to RSI oscillations during momentum
    if ((lastPeriod.rsi > 70 && current.rsi < 30) || 
        (lastPeriod.rsi < 30 && current.rsi > 70)) {
      return true;
    }

    // Time gap too large (more than 30 minutes)
    const timeDiff = current.timestamp - lastPeriod.timestamp;
    if (timeDiff > 30 * 60 * 1000) {
      return true;
    }

    return false;
  }

  /**
   * Calculate momentum bonus from consecutive periods
   */
  private calculateMomentumBonus(
    periods: ConsecutiveMomentumPeriod[],
    currentAnalysis: CurrentMomentumAnalysis
  ): MomentumBonusResult {
    const consecutiveCount = periods.length;
    const reasoning: string[] = [];

    // Calculate base bonus percentage
    let bonusPercentage = 0;
    let scoreBoost = 0;

    if (consecutiveCount >= 2) {
      bonusPercentage = 15; // +15% for 2nd period
      reasoning.push(`2nd consecutive momentum period detected (+15% bonus)`);
    }
    
    if (consecutiveCount >= 3) {
      bonusPercentage = Math.min(this.MAX_BOOST_PERCENTAGE, 25); // +25% for 3rd+ periods (capped)
      reasoning.push(`${consecutiveCount} consecutive periods - maximum momentum bonus (+25%)`);
    }

    // Apply safeguards
    const exhaustionWarning = this.hasExhaustionWarning(periods);
    const diminishingReturns = consecutiveCount > 3;
    const trendBreakReset = false; // Already handled above

    // RELAXED: Cap bonus if RSI >85 for 2+ periods (was >80, now >85)
    const rsiExhaustion = this.hasRsiExhaustion(periods);
    if (rsiExhaustion && bonusPercentage > 15) {
      bonusPercentage = 15; // Cap at +15% for RSI exhaustion (was +10%)
      reasoning.push(`RSI exhaustion detected - momentum bonus capped at 15%`);
    }

    // Apply diminishing returns
    if (diminishingReturns) {
      bonusPercentage *= 0.8; // 20% reduction for extended periods
      reasoning.push(`Diminishing returns applied to extended momentum sequence`);
    }

    // Calculate score boost (applied to base technical score)
    scoreBoost = bonusPercentage;

    // Add contextual reasoning
    if (consecutiveCount === 0) {
      reasoning.push('No consecutive momentum periods detected');
    } else if (consecutiveCount === 1) {
      reasoning.push('Single momentum period - no bonus applied');
    }

    if (exhaustionWarning) {
      reasoning.push('Exhaustion warning: momentum showing signs of fatigue');
    }

    return {
      consecutiveCount,
      bonusPercentage,
      scoreBoost,
      exhaustionWarning,
      trendBreakReset,
      diminishingReturns,
      reasoning,
      periods
    };
  }

  /**
   * Check for exhaustion warning across periods
   */
  private hasExhaustionWarning(periods: ConsecutiveMomentumPeriod[]): boolean {
    if (periods.length < 2) return false;

    // Count consecutive periods with exhaustion risk
    let exhaustionCount = 0;
    for (const period of periods.slice(-3)) { // Check last 3 periods
      if (period.exhaustionRisk) {
        exhaustionCount++;
      }
    }

    return exhaustionCount >= 2;
  }

  /**
   * Check for RSI exhaustion - UPDATED THRESHOLDS
   * Now checks for >85 RSI for 2+ periods (was >80)
   */
  private hasRsiExhaustion(periods: ConsecutiveMomentumPeriod[]): boolean {
    if (periods.length < 2) return false;

    const recentPeriods = periods.slice(-2);
    return recentPeriods.every(p => 
      (p.trendDirection === 'bullish' && p.rsi > this.EXHAUSTION_THRESHOLD) ||
      (p.trendDirection === 'bearish' && p.rsi < (100 - this.EXHAUSTION_THRESHOLD))
    );
  }

  /**
   * Get interval start timestamp (rounded to 15-minute intervals)
   */
  private getIntervalStart(timestamp: number): number {
    const intervalMs = this.INTERVAL_MINUTES * 60 * 1000;
    return Math.floor(timestamp / intervalMs) * intervalMs;
  }

  /**
   * Get default result for error cases
   */
  private getDefaultResult(): MomentumBonusResult {
    return {
      consecutiveCount: 0,
      bonusPercentage: 0,
      scoreBoost: 0,
      exhaustionWarning: false,
      trendBreakReset: false,
      diminishingReturns: false,
      reasoning: ['Error in momentum calculation - using default values'],
      periods: []
    };
  }

  /**
   * Update configuration
   */
  public updateConfig(config: {
    intervalMinutes?: number;
    maxBoostPercentage?: number;
    exhaustionThreshold?: number;
    volumeConfirmationRequired?: boolean;
    minStrengthThreshold?: number;
  }): void {
    if (config.maxBoostPercentage !== undefined) {
      (this as any).MAX_BOOST_PERCENTAGE = config.maxBoostPercentage;
    }
    if (config.exhaustionThreshold !== undefined) {
      (this as any).EXHAUSTION_THRESHOLD = config.exhaustionThreshold;
    }
    if (config.volumeConfirmationRequired !== undefined) {
      (this as any).VOLUME_CONFIRMATION_REQUIRED = config.volumeConfirmationRequired;
    }
    if (config.minStrengthThreshold !== undefined) {
      (this as any).MIN_STRENGTH_THRESHOLD = config.minStrengthThreshold;
    }

    this.logger.info('Consecutive momentum calculator configuration updated', config);
  }

  /**
   * Get current configuration
   */
  public getConfig(): {
    intervalMinutes: number;
    maxBoostPercentage: number;
    exhaustionThreshold: number;
    volumeConfirmationRequired: boolean;
    minStrengthThreshold: number;
  } {
    return {
      intervalMinutes: this.INTERVAL_MINUTES,
      maxBoostPercentage: this.MAX_BOOST_PERCENTAGE,
      exhaustionThreshold: this.EXHAUSTION_THRESHOLD,
      volumeConfirmationRequired: this.VOLUME_CONFIRMATION_REQUIRED,
      minStrengthThreshold: this.MIN_STRENGTH_THRESHOLD
    };
  }

  /**
   * Clean up old momentum data for token
   */
  public async cleanupOldData(tokenAddress: string, daysToKeep: number = 7): Promise<number> {
    if (!this.dbManager) return 0;

    try {
      const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000).toISOString();
      
      const result = await this.dbManager.run(
        'DELETE FROM consecutive_momentum WHERE token_address = ? AND created_at < ?',
        [tokenAddress, cutoffDate]
      );

      this.logger.debug('Old momentum data cleaned up', {
        tokenAddress,
        recordsDeleted: result.changes,
        cutoffDate
      });

      return result.changes;

    } catch (error) {
      this.logger.error('Failed to cleanup old momentum data', {
        error: error instanceof Error ? error.message : 'Unknown error',
        tokenAddress
      });
      return 0;
    }
  }
}