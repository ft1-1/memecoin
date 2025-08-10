/**
 * Risk Score Calculator - 10% Weight in Overall Rating
 * 
 * Analyzes risk factors to generate a 0-100 risk score (higher = lower risk):
 * - Liquidity risk assessment
 * - Volatility risk evaluation
 * - Holder concentration analysis
 * - Market cap stability
 * - Token age and maturity
 * - Rug pull risk indicators
 */

import { RiskAssessment, AnalysisContext } from '../../../types/analysis';
import { Logger } from '../../../utils/Logger';

export class RiskScoreCalculator {
  private logger = Logger.getInstance();

  /**
   * Calculate risk assessment score (0-100, where 100 = lowest risk)
   */
  public async calculate(
    risk: RiskAssessment,
    context: AnalysisContext
  ): Promise<number> {
    try {
      const scores = {
        liquidity: this.calculateLiquidityRiskScore(risk.factors.liquidity),
        volatility: this.calculateVolatilityRiskScore(risk.factors.volatility),
        holderConcentration: this.calculateHolderConcentrationScore(risk.factors.holderConcentration),
        marketCap: this.calculateMarketCapScore(risk.factors.marketCap, context.tokenData.marketCap),
        age: this.calculateAgeScore(risk.factors.age),
        rugPull: this.calculateRugPullScore(risk.factors.rugPullRisk),
        overall: this.calculateOverallRiskScore(risk.overall)
      };

      // Weighted combination of risk factors
      const weights = {
        liquidity: 0.20,         // 20% - Liquidity risk
        volatility: 0.18,        // 18% - Volatility risk
        rugPull: 0.17,          // 17% - Rug pull risk (critical for memecoins)
        holderConcentration: 0.15, // 15% - Holder concentration risk
        marketCap: 0.15,        // 15% - Market cap stability
        age: 0.10,              // 10% - Token maturity
        overall: 0.05           // 5% - Overall risk assessment validation
      };

      const riskScore = Object.entries(scores).reduce(
        (total, [key, score]) => total + score * weights[key as keyof typeof weights],
        0
      );

      // Apply risk level adjustments
      const adjustedScore = this.applyRiskLevelAdjustments(riskScore, risk.riskLevel);

      this.logger.debug('Risk score calculated', {
        tokenAddress: context.tokenData.address,
        scores,
        riskLevel: risk.riskLevel,
        finalScore: adjustedScore
      });

      return Math.max(0, Math.min(100, adjustedScore));

    } catch (error) {
      this.logger.error('Risk score calculation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        tokenAddress: context.tokenData.address
      });
      return 30; // Return conservative (higher risk) score on error
    }
  }

  /**
   * Calculate liquidity risk score (higher = better liquidity, lower risk)
   */
  private calculateLiquidityRiskScore(liquidityRisk: number): number {
    // liquidityRisk: 0-100 where 0 = no risk (high liquidity), 100 = high risk (low liquidity)
    let score = 100 - liquidityRisk; // Invert so higher score = lower risk

    // Apply non-linear scaling to emphasize good liquidity
    if (score >= 80) {
      score = 85 + (score - 80) * 0.75; // 85-100 range for excellent liquidity
    } else if (score >= 60) {
      score = 70 + (score - 60) * 0.75; // 70-85 range for good liquidity
    } else if (score >= 40) {
      score = 50 + (score - 40) * 1.0;  // 50-70 range for moderate liquidity
    } else if (score >= 20) {
      score = 25 + (score - 20) * 1.25; // 25-50 range for poor liquidity
    } else {
      score = score * 1.25; // 0-25 range for very poor liquidity
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate volatility risk score (moderate volatility is acceptable for memecoins)
   */
  private calculateVolatilityRiskScore(volatilityRisk: number): number {
    // volatilityRisk: 0-100 where higher = more volatile
    let score = 50; // Base score

    if (volatilityRisk < 20) {
      // Very low volatility - could indicate low interest
      score = 40 + volatilityRisk; // 40-60 range
    } else if (volatilityRisk <= 50) {
      // Moderate volatility - acceptable for memecoins
      score = 70 + (50 - volatilityRisk) * 0.6; // 70-88 range, peak at ~30%
    } else if (volatilityRisk <= 70) {
      // High volatility - still manageable
      score = 60 - (volatilityRisk - 50) * 0.5; // 60-50 range
    } else if (volatilityRisk <= 85) {
      // Very high volatility - risky
      score = 40 - (volatilityRisk - 70) * 0.8; // 40-28 range
    } else {
      // Extreme volatility - very risky
      score = Math.max(5, 28 - (volatilityRisk - 85) * 1.5);
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate holder concentration risk score
   */
  private calculateHolderConcentrationScore(concentrationRisk: number): number {
    // concentrationRisk: 0-100 where higher = more concentrated (riskier)
    let score = 100 - concentrationRisk;

    // Penalize high concentration more severely for memecoins
    if (concentrationRisk > 80) {
      score = Math.max(5, 20 - (concentrationRisk - 80) * 0.75); // 5-20 range for extreme concentration
    } else if (concentrationRisk > 60) {
      score = 40 - (concentrationRisk - 60) * 1.0; // 20-40 range for high concentration
    } else if (concentrationRisk > 40) {
      score = 60 - (concentrationRisk - 40) * 1.0; // 40-60 range for moderate concentration
    } else if (concentrationRisk > 20) {
      score = 80 - (concentrationRisk - 20) * 1.0; // 60-80 range for low concentration
    } else {
      score = 80 + (20 - concentrationRisk) * 1.0; // 80-100 range for very low concentration
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate market cap stability score
   */
  private calculateMarketCapScore(marketCapRisk: number, currentMarketCap: number): number {
    // marketCapRisk: 0-100 where higher = less stable
    let score = 100 - marketCapRisk;

    // Market cap size considerations for memecoins
    const marketCapMillion = currentMarketCap / 1e6;
    
    if (marketCapMillion < 1) {
      score *= 0.6; // Penalty for very small market cap (< $1M)
    } else if (marketCapMillion < 5) {
      score *= 0.8; // Small penalty for small market cap (< $5M)
    } else if (marketCapMillion > 100) {
      score *= 1.1; // Bonus for larger market cap (> $100M)
      score = Math.min(100, score);
    }

    // Additional stability factors
    if (marketCapRisk < 20) {
      score += 5; // Bonus for very stable market cap
    } else if (marketCapRisk > 80) {
      score -= 10; // Additional penalty for very unstable market cap
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate token age score
   */
  private calculateAgeScore(ageRisk: number): number {
    // ageRisk: 0-100 where higher = newer/riskier
    let score = 100 - ageRisk;

    // Non-linear scaling - newer tokens are much riskier
    if (ageRisk > 90) {
      score = Math.max(5, 10 - (ageRisk - 90) * 0.5); // 5-10 range for very new tokens
    } else if (ageRisk > 75) {
      score = 25 - (ageRisk - 75) * 1.0; // 10-25 range for new tokens
    } else if (ageRisk > 50) {
      score = 50 - (ageRisk - 50) * 1.0; // 25-50 range for relatively new tokens
    } else if (ageRisk > 25) {
      score = 75 - (ageRisk - 25) * 1.0; // 50-75 range for established tokens
    } else {
      score = 75 + (25 - ageRisk) * 1.0; // 75-100 range for mature tokens
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate rug pull risk score
   */
  private calculateRugPullScore(rugPullRisk: number): number {
    // rugPullRisk: 0-100 where higher = higher rug pull risk
    let score = 100 - rugPullRisk;

    // Severe penalty for rug pull indicators (critical for memecoins)
    if (rugPullRisk > 80) {
      score = Math.max(0, 5 - (rugPullRisk - 80) * 0.25); // 0-5 range for very high rug pull risk
    } else if (rugPullRisk > 60) {
      score = 20 - (rugPullRisk - 60) * 0.75; // 5-20 range for high rug pull risk
    } else if (rugPullRisk > 40) {
      score = 40 - (rugPullRisk - 40) * 1.0; // 20-40 range for moderate rug pull risk
    } else if (rugPullRisk > 20) {
      score = 70 - (rugPullRisk - 20) * 1.5; // 40-70 range for low rug pull risk
    } else {
      score = 70 + (20 - rugPullRisk) * 1.5; // 70-100 range for very low rug pull risk
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate overall risk validation score
   */
  private calculateOverallRiskScore(overallRisk: number): number {
    // overallRisk: 0-100 where higher = higher overall risk
    return Math.max(0, Math.min(100, 100 - overallRisk));
  }

  /**
   * Apply risk level adjustments to final score
   */
  private applyRiskLevelAdjustments(
    score: number,
    riskLevel: RiskAssessment['riskLevel']
  ): number {
    let adjustedScore = score;

    // Apply categorical risk level adjustments
    switch (riskLevel) {
      case 'low':
        adjustedScore += 5; // Bonus for low risk classification
        break;
      case 'medium':
        // No adjustment for medium risk
        break;
      case 'high':
        adjustedScore -= 10; // Penalty for high risk classification
        break;
      case 'extreme':
        adjustedScore -= 20; // Severe penalty for extreme risk
        adjustedScore = Math.max(5, adjustedScore); // Minimum score of 5
        break;
    }

    return Math.max(0, Math.min(100, adjustedScore));
  }

  /**
   * Get detailed risk analysis breakdown
   */
  public getDetailedAnalysis(
    risk: RiskAssessment,
    context: AnalysisContext
  ): {
    liquidity: { score: number; signal: string; description: string };
    volatility: { score: number; signal: string; description: string };
    holderConcentration: { score: number; signal: string; description: string };
    marketCap: { score: number; signal: string; description: string };
    age: { score: number; signal: string; description: string };
    rugPull: { score: number; signal: string; description: string };
    overall: { score: number; signal: string; description: string };
    warnings: string[];
  } {
    const liquidityScore = this.calculateLiquidityRiskScore(risk.factors.liquidity);
    const volatilityScore = this.calculateVolatilityRiskScore(risk.factors.volatility);
    const concentrationScore = this.calculateHolderConcentrationScore(risk.factors.holderConcentration);
    const marketCapScore = this.calculateMarketCapScore(risk.factors.marketCap, context.tokenData.marketCap);
    const ageScore = this.calculateAgeScore(risk.factors.age);
    const rugPullScore = this.calculateRugPullScore(risk.factors.rugPullRisk);
    const overallScore = this.calculateOverallRiskScore(risk.overall);

    return {
      liquidity: {
        score: liquidityScore,
        signal: this.getRiskSignal(liquidityScore),
        description: this.getLiquidityRiskDescription(risk.factors.liquidity, liquidityScore)
      },
      volatility: {
        score: volatilityScore,
        signal: this.getRiskSignal(volatilityScore),
        description: this.getVolatilityRiskDescription(risk.factors.volatility, volatilityScore)
      },
      holderConcentration: {
        score: concentrationScore,
        signal: this.getRiskSignal(concentrationScore),
        description: this.getConcentrationRiskDescription(risk.factors.holderConcentration, concentrationScore)
      },
      marketCap: {
        score: marketCapScore,
        signal: this.getRiskSignal(marketCapScore),
        description: this.getMarketCapRiskDescription(risk.factors.marketCap, context.tokenData.marketCap)
      },
      age: {
        score: ageScore,
        signal: this.getRiskSignal(ageScore),
        description: this.getAgeRiskDescription(risk.factors.age, ageScore)
      },
      rugPull: {
        score: rugPullScore,
        signal: this.getRugPullSignal(rugPullScore),
        description: this.getRugPullRiskDescription(risk.factors.rugPullRisk, rugPullScore)
      },
      overall: {
        score: overallScore,
        signal: this.getRiskLevelSignal(risk.riskLevel),
        description: `Overall risk level: ${risk.riskLevel.toUpperCase()} (${risk.overall}/100 risk factors)`
      },
      warnings: risk.warnings
    };
  }

  private getRiskSignal(score: number): string {
    if (score >= 80) return 'LOW_RISK';
    if (score >= 60) return 'MODERATE_RISK';
    if (score >= 40) return 'HIGH_RISK';
    if (score >= 20) return 'VERY_HIGH_RISK';
    return 'EXTREME_RISK';
  }

  private getRugPullSignal(score: number): string {
    if (score >= 70) return 'VERY_LOW';
    if (score >= 50) return 'LOW';
    if (score >= 30) return 'MODERATE';
    if (score >= 15) return 'HIGH';
    if (score >= 5) return 'VERY_HIGH';
    return 'EXTREME';
  }

  private getRiskLevelSignal(riskLevel: RiskAssessment['riskLevel']): string {
    return riskLevel.toUpperCase().replace('_', '_');
  }

  private getLiquidityRiskDescription(liquidityRisk: number, score: number): string {
    if (score >= 80) return `Excellent liquidity (${liquidityRisk}/100 risk) - easy entry/exit`;
    if (score >= 60) return `Good liquidity (${liquidityRisk}/100 risk) - manageable slippage`;
    if (score >= 40) return `Moderate liquidity (${liquidityRisk}/100 risk) - some slippage expected`;
    if (score >= 20) return `Poor liquidity (${liquidityRisk}/100 risk) - high slippage risk`;
    return `Very poor liquidity (${liquidityRisk}/100 risk) - significant exit difficulty`;
  }

  private getVolatilityRiskDescription(volatilityRisk: number, score: number): string {
    if (score >= 70) return `Optimal volatility (${volatilityRisk}/100) for memecoin momentum`;
    if (score >= 50) return `Acceptable volatility (${volatilityRisk}/100) - manageable risk`;
    if (score >= 30) return `High volatility (${volatilityRisk}/100) - significant price swings`;
    return `Extreme volatility (${volatilityRisk}/100) - very unpredictable price action`;
  }

  private getConcentrationRiskDescription(concentrationRisk: number, score: number): string {
    if (score >= 70) return `Well-distributed holders (${concentrationRisk}/100 concentration)`;
    if (score >= 50) return `Moderate holder concentration (${concentrationRisk}/100)`;
    if (score >= 30) return `High holder concentration (${concentrationRisk}/100) - whale risk`;
    return `Extreme concentration (${concentrationRisk}/100) - major whale manipulation risk`;
  }

  private getMarketCapRiskDescription(marketCapRisk: number, marketCap: number): string {
    const mcapMillion = (marketCap / 1e6).toFixed(1);
    if (marketCapRisk < 30) return `Stable $${mcapMillion}M market cap with low volatility`;
    if (marketCapRisk < 60) return `$${mcapMillion}M market cap with moderate stability`;
    return `$${mcapMillion}M market cap with high instability (${marketCapRisk}/100 risk)`;
  }

  private getAgeRiskDescription(ageRisk: number, score: number): string {
    if (score >= 70) return `Mature token (${ageRisk}/100 age risk) - established presence`;
    if (score >= 50) return `Moderately established (${ageRisk}/100 age risk)`;
    if (score >= 30) return `Relatively new token (${ageRisk}/100 age risk) - limited history`;
    return `Very new token (${ageRisk}/100 age risk) - high uncertainty`;
  }

  private getRugPullRiskDescription(rugPullRisk: number, score: number): string {
    if (score >= 70) return `Very low rug pull risk (${rugPullRisk}/100) - strong fundamentals`;
    if (score >= 50) return `Low rug pull risk (${rugPullRisk}/100) - good indicators`;
    if (score >= 30) return `Moderate rug pull risk (${rugPullRisk}/100) - some concerns`;
    if (score >= 15) return `High rug pull risk (${rugPullRisk}/100) - significant red flags`;
    return `Extreme rug pull risk (${rugPullRisk}/100) - major warning signs`;
  }
}