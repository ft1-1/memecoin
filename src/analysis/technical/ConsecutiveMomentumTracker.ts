/**
 * Consecutive Momentum Tracker
 * Tracks consecutive 15-minute intervals where technical signals remain strong
 * Implements scoring boosts with safeguards for momentum exhaustion
 */

import { ConsecutiveMomentumPeriod, ConsecutiveMomentumTracking } from '../../types/analysis';
import { OHLCVData } from './types';

export interface MomentumPeriodAnalysis {
  rsi: number;
  macdHistogram: number;
  volume: number;
  averageVolume: number;
  price: number;
  trendDirection: 'bullish' | 'bearish' | 'neutral';
  strength: number;
}

export class ConsecutiveMomentumTracker {
  private intervalMinutes: number;
  private maxBoostPercentage: number;
  private exhaustionThreshold: number;
  private volumeConfirmationRequired: boolean;
  private consecutivePeriods: ConsecutiveMomentumPeriod[];
  private lastResetTimestamp: number;

  constructor(config?: {
    intervalMinutes?: number;
    maxBoostPercentage?: number;
    exhaustionThreshold?: number;
    volumeConfirmationRequired?: boolean;
  }) {
    this.intervalMinutes = config?.intervalMinutes || 15;
    this.maxBoostPercentage = config?.maxBoostPercentage || 25;
    this.exhaustionThreshold = config?.exhaustionThreshold || 80;
    this.volumeConfirmationRequired = config?.volumeConfirmationRequired ?? true;
    this.consecutivePeriods = [];
    this.lastResetTimestamp = 0;
  }

  /**
   * Track momentum for a new period
   */
  public trackPeriod(
    timestamp: number,
    analysis: MomentumPeriodAnalysis
  ): ConsecutiveMomentumTracking {
    // Check if this is a new 15-minute interval
    const intervalStart = this.getIntervalStart(timestamp);
    const lastPeriod = this.consecutivePeriods[this.consecutivePeriods.length - 1];

    // Reset if trend direction changes significantly
    if (this.shouldResetForTrendBreak(analysis, lastPeriod)) {
      this.resetTracking(timestamp);
    }

    // Create new momentum period
    const period: ConsecutiveMomentumPeriod = {
      periodIndex: this.consecutivePeriods.length,
      timestamp: intervalStart,
      rsi: analysis.rsi,
      macdHistogram: analysis.macdHistogram,
      volumeConfirmed: this.isVolumeConfirmed(analysis),
      trendDirection: analysis.trendDirection,
      strength: analysis.strength,
      exhaustionRisk: this.detectExhaustionRisk(analysis)
    };

    // Add period if it's a new interval or update current one
    if (!lastPeriod || lastPeriod.timestamp < intervalStart) {
      this.consecutivePeriods.push(period);
    } else {
      // Update current period with latest data
      this.consecutivePeriods[this.consecutivePeriods.length - 1] = period;
    }

    // Limit tracking to last 10 periods to prevent memory issues
    if (this.consecutivePeriods.length > 10) {
      this.consecutivePeriods = this.consecutivePeriods.slice(-10);
    }

    return this.calculateTracking();
  }

  /**
   * Calculate current consecutive momentum tracking state
   */
  private calculateTracking(): ConsecutiveMomentumTracking {
    const validPeriods = this.getConsecutiveValidPeriods();
    const consecutiveCount = validPeriods.length;
    
    // Calculate score boost based on consecutive periods
    let scoreBoost = 0;
    if (consecutiveCount >= 2) {
      scoreBoost = 15; // +15% for 2nd period
    }
    if (consecutiveCount >= 3) {
      scoreBoost = Math.min(this.maxBoostPercentage, 25); // +25% for 3rd+ periods (capped)
    }

    // Apply safeguards
    const exhaustionWarning = this.hasExhaustionWarning(validPeriods);
    const diminishingReturns = consecutiveCount > 3;

    // Cap boost if RSI >80 for 2+ periods
    const rsiExhaustion = this.hasRsiExhaustion(validPeriods);
    if (rsiExhaustion && scoreBoost > 10) {
      scoreBoost = 10; // Cap at +10% for RSI exhaustion
    }

    // Reset if exhaustion detected
    const trendBreakReset = this.detectTrendBreak(validPeriods);

    return {
      periods: [...this.consecutivePeriods],
      consecutiveCount,
      scoreBoost,
      exhaustionWarning,
      trendBreakReset,
      diminishingReturns
    };
  }

  /**
   * Get consecutive valid periods from the end
   */
  private getConsecutiveValidPeriods(): ConsecutiveMomentumPeriod[] {
    const validPeriods: ConsecutiveMomentumPeriod[] = [];
    
    // Walk backwards from most recent period
    for (let i = this.consecutivePeriods.length - 1; i >= 0; i--) {
      const period = this.consecutivePeriods[i];
      
      // Check if period is valid (strong signal, volume confirmed if required)
      if (this.isPeriodValid(period)) {
        validPeriods.unshift(period); // Add to beginning to maintain order
      } else {
        break; // Stop at first invalid period
      }
    }

    return validPeriods;
  }

  /**
   * Check if a period is valid for consecutive momentum
   */
  private isPeriodValid(period: ConsecutiveMomentumPeriod): boolean {
    // Must have strong momentum signal
    if (period.strength < 60) return false;

    // Must have clear trend direction
    if (period.trendDirection === 'neutral') return false;

    // Volume confirmation required if enabled
    if (this.volumeConfirmationRequired && !period.volumeConfirmed) return false;

    // Skip if exhaustion risk is too high
    if (period.exhaustionRisk) return false;

    return true;
  }

  /**
   * Check if volume is confirmed for this period
   */
  private isVolumeConfirmed(analysis: MomentumPeriodAnalysis): boolean {
    if (analysis.averageVolume === 0) return false;
    const volumeRatio = analysis.volume / analysis.averageVolume;
    return volumeRatio >= 1.2; // At least 20% above average
  }

  /**
   * Detect momentum exhaustion risk
   */
  private detectExhaustionRisk(analysis: MomentumPeriodAnalysis): boolean {
    // RSI exhaustion (>80 for bullish, <20 for bearish)
    if (analysis.trendDirection === 'bullish' && analysis.rsi > this.exhaustionThreshold) {
      return true;
    }
    if (analysis.trendDirection === 'bearish' && analysis.rsi < (100 - this.exhaustionThreshold)) {
      return true;
    }

    // MACD divergence exhaustion
    if (Math.abs(analysis.macdHistogram) < 0.01) {
      return true; // MACD histogram approaching zero
    }

    return false;
  }

  /**
   * Check if we should reset tracking due to trend break
   */
  private shouldResetForTrendBreak(
    current: MomentumPeriodAnalysis,
    lastPeriod?: ConsecutiveMomentumPeriod
  ): boolean {
    if (!lastPeriod) return false;

    // Trend direction changed
    if (lastPeriod.trendDirection !== current.trendDirection && 
        current.trendDirection !== 'neutral') {
      return true;
    }

    // Significant strength drop (>40 points)
    if (lastPeriod.strength - current.strength > 40) {
      return true;
    }

    // RSI crossed major levels (bullish to bearish or vice versa)
    if ((lastPeriod.rsi > 60 && current.rsi < 40) || 
        (lastPeriod.rsi < 40 && current.rsi > 60)) {
      return true;
    }

    return false;
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
   * Check for RSI exhaustion (>80 for 2+ periods)
   */
  private hasRsiExhaustion(periods: ConsecutiveMomentumPeriod[]): boolean {
    if (periods.length < 2) return false;

    const recentPeriods = periods.slice(-2);
    return recentPeriods.every(p => 
      (p.trendDirection === 'bullish' && p.rsi > this.exhaustionThreshold) ||
      (p.trendDirection === 'bearish' && p.rsi < (100 - this.exhaustionThreshold))
    );
  }

  /**
   * Detect trend break requiring reset
   */
  private detectTrendBreak(periods: ConsecutiveMomentumPeriod[]): boolean {
    if (periods.length < 2) return false;

    const latest = periods[periods.length - 1];
    const previous = periods[periods.length - 2];

    // Major trend reversal
    return (previous.trendDirection === 'bullish' && latest.trendDirection === 'bearish') ||
           (previous.trendDirection === 'bearish' && latest.trendDirection === 'bullish');
  }

  /**
   * Reset tracking state
   */
  private resetTracking(timestamp: number): void {
    this.consecutivePeriods = [];
    this.lastResetTimestamp = timestamp;
  }

  /**
   * Get interval start timestamp (rounded to 15-minute intervals)
   */
  private getIntervalStart(timestamp: number): number {
    const intervalMs = this.intervalMinutes * 60 * 1000;
    return Math.floor(timestamp / intervalMs) * intervalMs;
  }

  /**
   * Get current tracking state
   */
  public getCurrentTracking(): ConsecutiveMomentumTracking {
    return this.calculateTracking();
  }

  /**
   * Clear all tracking data
   */
  public clearTracking(): void {
    this.consecutivePeriods = [];
    this.lastResetTimestamp = Date.now();
  }

  /**
   * Update configuration
   */
  public updateConfig(config: {
    intervalMinutes?: number;
    maxBoostPercentage?: number;
    exhaustionThreshold?: number;
    volumeConfirmationRequired?: boolean;
  }): void {
    if (config.intervalMinutes !== undefined) this.intervalMinutes = config.intervalMinutes;
    if (config.maxBoostPercentage !== undefined) this.maxBoostPercentage = config.maxBoostPercentage;
    if (config.exhaustionThreshold !== undefined) this.exhaustionThreshold = config.exhaustionThreshold;
    if (config.volumeConfirmationRequired !== undefined) this.volumeConfirmationRequired = config.volumeConfirmationRequired;
  }
}