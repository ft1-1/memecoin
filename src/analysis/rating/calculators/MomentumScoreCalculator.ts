/**
 * Momentum Score Calculator - 30% Weight in Overall Rating
 * 
 * Analyzes momentum and trend characteristics to generate a 0-100 momentum score:
 * - Trend direction and strength analysis
 * - Breakout potential assessment
 * - Price action and consolidation patterns
 * - Support and resistance level proximity
 * - Momentum acceleration and sustainability
 */

import { MomentumAnalysis, AnalysisContext } from '../../../types/analysis';
import { Logger } from '../../../utils/Logger';
import { ContextDefaults } from '../utils/ContextDefaults';

export class MomentumScoreCalculator {
  private logger = Logger.getInstance();

  /**
   * Calculate momentum analysis score (0-100)
   */
  public async calculate(
    momentum: MomentumAnalysis,
    context: AnalysisContext
  ): Promise<number> {
    try {
      const scores = {
        trend: this.calculateTrendScore(momentum.trend, momentum.strength),
        momentum: this.calculateMomentumScore(momentum.momentum),
        volatility: this.calculateVolatilityScore(momentum.volatility),
        priceAction: this.calculatePriceActionScore(momentum.priceAction, context),
        levels: this.calculateLevelsScore(momentum.support, momentum.resistance, context.tokenData.price)
      };

      // Weighted combination of momentum factors
      const weights = {
        trend: 0.30,        // 30% - Primary trend direction and strength
        momentum: 0.25,     // 25% - Rate of change momentum
        priceAction: 0.20,  // 20% - Breakout and consolidation patterns
        volatility: 0.15,   // 15% - Volatility assessment (controlled volatility is good)
        levels: 0.10        // 10% - Support/resistance proximity
      };

      const momentumScore = Object.entries(scores).reduce(
        (total, [key, score]) => total + score * weights[key as keyof typeof weights],
        0
      );

      this.logger.debug('Momentum score calculated', {
        tokenAddress: context.tokenData.address,
        scores,
        finalScore: momentumScore
      });

      return Math.max(0, Math.min(100, momentumScore));

    } catch (error) {
      this.logger.error('Momentum score calculation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        tokenAddress: context.tokenData.address
      });
      return 50; // Return neutral score on error
    }
  }

  /**
   * Calculate trend-based score
   */
  private calculateTrendScore(trend: MomentumAnalysis['trend'], strength: number): number {
    let baseScore = 50; // Neutral starting point

    // Trend direction scoring
    switch (trend) {
      case 'bullish':
        baseScore = 75; // Strong positive base for bullish trend
        break;
      case 'bearish':
        baseScore = 25; // Low base for bearish trend
        break;
      case 'neutral':
        baseScore = 50; // Neutral base
        break;
    }

    // Apply strength multiplier (0-100 strength scale)
    const strengthMultiplier = Math.min(strength / 100, 1.0);
    
    if (trend === 'bullish') {
      // For bullish trends, higher strength = higher score
      baseScore += (100 - baseScore) * strengthMultiplier;
    } else if (trend === 'bearish') {
      // For bearish trends, higher strength = lower score
      baseScore *= (1 - strengthMultiplier * 0.6); // Max 60% reduction
    } else {
      // For neutral trends, moderate strength is preferred
      const optimalStrength = 0.4; // 40% strength is optimal for neutral
      const strengthDeviation = Math.abs(strengthMultiplier - optimalStrength);
      baseScore += (20 - strengthDeviation * 30); // Penalty for extreme strength in neutral
    }

    return Math.max(0, Math.min(100, baseScore));
  }

  /**
   * Calculate momentum rate-of-change score
   */
  private calculateMomentumScore(momentum: number): number {
    // Momentum is rate of change (can be positive or negative)
    const absMomentum = Math.abs(momentum);
    let score = 50;

    if (momentum > 0) {
      // Positive momentum (bullish)
      score = 60 + Math.min(40, absMomentum * 2); // Scale momentum to 0-40 points
    } else if (momentum < 0) {
      // Negative momentum (bearish)
      score = 40 - Math.min(35, absMomentum * 1.5); // Reduce score based on negative momentum
    } else {
      // Zero momentum (neutral)
      score = 45; // Slightly below neutral as lack of momentum isn't ideal
    }

    // Bonus for sustainable momentum (not too extreme)
    if (absMomentum > 0.5 && absMomentum < 2.0) {
      score += 5; // Sweet spot for sustainable momentum
    } else if (absMomentum > 5.0) {
      score -= 10; // Penalty for unsustainable extreme momentum
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate volatility score (controlled volatility is positive)
   */
  private calculateVolatilityScore(volatility: number): number {
    // Volatility is typically measured as percentage (0-100+)
    let score = 50;

    if (volatility < 5) {
      // Very low volatility - could indicate lack of interest
      score = 30 + volatility * 4; // 30-50 range
    } else if (volatility >= 5 && volatility <= 25) {
      // Optimal volatility range - good for momentum
      score = 70 + (25 - volatility) * 1.2; // 70-94 range, peak at ~15%
    } else if (volatility > 25 && volatility <= 50) {
      // High volatility - risky but potentially profitable
      score = 60 - (volatility - 25) * 0.8; // 60-40 range
    } else {
      // Extreme volatility - very risky
      score = Math.max(10, 40 - (volatility - 50) * 0.5);
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate price action score
   */
  private calculatePriceActionScore(
    priceAction: MomentumAnalysis['priceAction'],
    context: AnalysisContext
  ): number {
    let score = 50;

    // Breakout potential scoring
    score += priceAction.breakoutPotential * 30; // 0-30 points for breakout potential

    // Consolidation analysis
    if (priceAction.consolidation) {
      if (priceAction.breakoutPotential > 0.6) {
        score += 15; // Consolidation with high breakout potential is very bullish
      } else if (priceAction.breakoutPotential > 0.3) {
        score += 8; // Moderate consolidation is still positive
      } else {
        score -= 5; // Long consolidation without breakout potential is negative
      }
    } else {
      // Not in consolidation
      if (priceAction.breakoutPotential > 0.7) {
        score += 10; // Strong breakout signal without consolidation
      } else {
        score -= 3; // Lack of consolidation might indicate instability
      }
    }

    // Reversal signal analysis
    if (priceAction.reversalSignal) {
      // Reversal signals can be bullish or bearish depending on context
      const currentTrend = this.inferTrendFromContext(context);
      
      if (currentTrend === 'bearish') {
        score += 20; // Reversal from bearish trend is very positive
      } else if (currentTrend === 'bullish') {
        score -= 15; // Reversal from bullish trend is negative
      } else {
        score += 5; // Reversal from neutral could go either way
      }
    }

    // Market context adjustment
    const { overallTrend } = ContextDefaults.getMarketContextValues(context);
    if (overallTrend === 'bull') {
      score += 5; // Favorable market conditions
    } else if (overallTrend === 'bear') {
      score -= 8; // Challenging market conditions
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate support/resistance levels score
   */
  private calculateLevelsScore(
    support: number[],
    resistance: number[],
    currentPrice: number
  ): number {
    let score = 50;

    // Analyze proximity to support levels
    if (support.length > 0) {
      const nearestSupport = support.reduce((closest, level) => {
        const currentDistance = Math.abs(currentPrice - closest);
        const levelDistance = Math.abs(currentPrice - level);
        return levelDistance < currentDistance && level < currentPrice ? level : closest;
      }, support[0]);

      const supportDistance = (currentPrice - nearestSupport) / currentPrice;
      
      if (supportDistance > 0 && supportDistance < 0.05) {
        score += 20; // Very close to strong support (within 5%)
      } else if (supportDistance > 0 && supportDistance < 0.10) {
        score += 10; // Close to support (within 10%)
      } else if (supportDistance > 0.20) {
        score -= 5; // Far from support levels
      }
    }

    // Analyze proximity to resistance levels
    if (resistance.length > 0) {
      const nearestResistance = resistance.reduce((closest, level) => {
        const currentDistance = Math.abs(currentPrice - closest);
        const levelDistance = Math.abs(currentPrice - level);
        return levelDistance < currentDistance && level > currentPrice ? level : closest;
      }, resistance[0]);

      const resistanceDistance = (nearestResistance - currentPrice) / currentPrice;
      
      if (resistanceDistance > 0 && resistanceDistance < 0.03) {
        score -= 15; // Very close to resistance (within 3%) - potential rejection
      } else if (resistanceDistance > 0 && resistanceDistance < 0.08) {
        score -= 5; // Close to resistance (within 8%)
      } else if (resistanceDistance > 0.15) {
        score += 8; // Far from resistance - room to move up
      }
    }

    // Bonus for breaking through resistance
    const brokenResistance = resistance.filter(level => currentPrice > level);
    if (brokenResistance.length > 0) {
      score += brokenResistance.length * 8; // Bonus for each broken resistance
    }

    // Support/resistance level quality
    const totalLevels = support.length + resistance.length;
    if (totalLevels > 3) {
      score += 5; // Good level identification
    } else if (totalLevels < 2) {
      score -= 5; // Insufficient level data
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Infer trend from analysis context
   */
  private inferTrendFromContext(context: AnalysisContext): 'bullish' | 'bearish' | 'neutral' {
    // Use market context and recent price action to infer trend
    const { marketSentiment } = ContextDefaults.getMarketContextValues(context);
    if (marketSentiment > 60) {
      return 'bullish';
    } else if (marketSentiment < 40) {
      return 'bearish';
    }
    return 'neutral';
  }

  /**
   * Get detailed momentum analysis breakdown
   */
  public getDetailedAnalysis(
    momentum: MomentumAnalysis,
    context: AnalysisContext
  ): {
    trend: { score: number; signal: string; description: string };
    momentum: { score: number; signal: string; description: string };
    volatility: { score: number; signal: string; description: string };
    priceAction: { score: number; signal: string; description: string };
    levels: { score: number; signal: string; description: string };
  } {
    const trendScore = this.calculateTrendScore(momentum.trend, momentum.strength);
    const momentumScore = this.calculateMomentumScore(momentum.momentum);
    const volatilityScore = this.calculateVolatilityScore(momentum.volatility);
    const priceActionScore = this.calculatePriceActionScore(momentum.priceAction, context);
    const levelsScore = this.calculateLevelsScore(momentum.support, momentum.resistance, context.tokenData.price);

    return {
      trend: {
        score: trendScore,
        signal: this.getTrendSignal(momentum.trend, momentum.strength),
        description: this.getTrendDescription(momentum.trend, momentum.strength)
      },
      momentum: {
        score: momentumScore,
        signal: momentum.momentum > 0.5 ? 'STRONG' : momentum.momentum > 0 ? 'POSITIVE' : momentum.momentum > -0.5 ? 'WEAK' : 'NEGATIVE',
        description: this.getMomentumDescription(momentum.momentum)
      },
      volatility: {
        score: volatilityScore,
        signal: this.getVolatilitySignal(momentum.volatility),
        description: this.getVolatilityDescription(momentum.volatility)
      },
      priceAction: {
        score: priceActionScore,
        signal: priceActionScore > 70 ? 'BULLISH' : priceActionScore > 50 ? 'NEUTRAL' : 'BEARISH',
        description: this.getPriceActionDescription(momentum.priceAction)
      },
      levels: {
        score: levelsScore,
        signal: levelsScore > 65 ? 'FAVORABLE' : levelsScore > 45 ? 'NEUTRAL' : 'CHALLENGING',
        description: this.getLevelsDescription(momentum.support, momentum.resistance, context.tokenData.price)
      }
    };
  }

  private getTrendSignal(trend: MomentumAnalysis['trend'], strength: number): string {
    const strengthLevel = strength > 70 ? 'STRONG' : strength > 40 ? 'MODERATE' : 'WEAK';
    return `${strengthLevel} ${trend.toUpperCase()}`;
  }

  private getTrendDescription(trend: MomentumAnalysis['trend'], strength: number): string {
    return `${trend.charAt(0).toUpperCase() + trend.slice(1)} trend with ${strength.toFixed(1)}% strength`;
  }

  private getMomentumDescription(momentum: number): string {
    const direction = momentum > 0 ? 'upward' : 'downward';
    return `${direction.charAt(0).toUpperCase() + direction.slice(1)} momentum at ${(momentum * 100).toFixed(1)}% rate of change`;
  }

  private getVolatilitySignal(volatility: number): string {
    if (volatility < 5) return 'LOW';
    if (volatility <= 25) return 'OPTIMAL';
    if (volatility <= 50) return 'HIGH';
    return 'EXTREME';
  }

  private getVolatilityDescription(volatility: number): string {
    return `${volatility.toFixed(1)}% volatility - ${this.getVolatilitySignal(volatility).toLowerCase()} range for momentum trading`;
  }

  private getPriceActionDescription(priceAction: MomentumAnalysis['priceAction']): string {
    const patterns = [];
    
    if (priceAction.consolidation) {
      patterns.push(`consolidation (${(priceAction.breakoutPotential * 100).toFixed(0)}% breakout potential)`);
    }
    
    if (priceAction.reversalSignal) {
      patterns.push('reversal signal detected');
    }
    
    if (patterns.length === 0) {
      patterns.push(`${(priceAction.breakoutPotential * 100).toFixed(0)}% breakout potential`);
    }
    
    return patterns.join(', ');
  }

  private getLevelsDescription(support: number[], resistance: number[], currentPrice: number): string {
    const descriptions = [];
    
    if (support.length > 0) {
      const nearestSupport = support.find(level => level < currentPrice);
      if (nearestSupport) {
        const distance = ((currentPrice - nearestSupport) / currentPrice * 100);
        descriptions.push(`${distance.toFixed(1)}% above nearest support`);
      }
    }
    
    if (resistance.length > 0) {
      const nearestResistance = resistance.find(level => level > currentPrice);
      if (nearestResistance) {
        const distance = ((nearestResistance - currentPrice) / currentPrice * 100);
        descriptions.push(`${distance.toFixed(1)}% below nearest resistance`);
      }
    }
    
    return descriptions.length > 0 ? descriptions.join(', ') : `${support.length} support, ${resistance.length} resistance levels identified`;
  }
}