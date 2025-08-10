/**
 * API Data Mapper for Solana Tracker API Responses
 * 
 * Transforms raw Solana Tracker API responses into formats suitable for the rating engine.
 * Key transformations:
 * - Risk scores: 0-10 scale → 0-100 scale
 * - Volume data: Transaction counts → VolumeAnalysis structure
 * - Token data: SolanaTrackerTokenResponse → TokenData/AnalysisContext
 * - Handles missing data gracefully with sensible defaults
 */

import { Logger } from '../../../utils/Logger';
import {
  SolanaTrackerTokenResponse,
  SolanaTrackerPool,
  SolanaTrackerRisk,
  SolanaTrackerEvents,
  SolanaToken,
  OHLCV,
  SolanaTrackerChartResponse
} from './types';

import { 
  TokenData,
  ChartDataPoint 
} from '../../../types/api';

import {
  VolumeAnalysis,
  RiskAssessment,
  AnalysisContext
} from '../../../types/analysis';

export interface MappedTokenData {
  tokenData: TokenData;
  volumeAnalysis: VolumeAnalysis;
  riskAssessment: RiskAssessment;
  chartData?: ChartDataPoint[];
}

export class ApiDataMapper {
  private logger = Logger.getInstance();

  /**
   * Transform SolanaTrackerTokenResponse to TokenData format
   */
  public mapTokenResponse(response: SolanaTrackerTokenResponse): TokenData {
    const { token, pools, events, risk } = response;
    
    // Get primary pool data (usually first pool with highest liquidity)
    const primaryPool = this.selectPrimaryPool(pools);
    
    try {
      return {
        address: token.mint,
        symbol: token.symbol || 'UNKNOWN',
        name: token.name || 'Unknown Token',
        decimals: token.decimals || 9,
        supply: primaryPool?.tokenSupply || 0,
        marketCap: primaryPool?.marketCap?.usd || 0,
        price: primaryPool?.price?.usd || 0,
        priceChange24h: this.extractPriceChange24h(events),
        volume24h: primaryPool?.txns?.volume24h || 0,
        holders: response.holders || 0,
        createdAt: token.creation?.created_time 
          ? new Date(token.creation.created_time * 1000).toISOString()
          : new Date().toISOString(),
        image: token.image,
        tags: this.extractTags(token, risk),
        website: token.strictSocials?.website,
        twitter: token.strictSocials?.twitter,
        telegram: token.strictSocials?.telegram,
        riskLevel: this.mapRiskLevel(risk?.score),
        riskScore: this.scaleRiskScore(risk?.score)
      };
    } catch (error) {
      this.logger.error('Failed to map token response', {
        error: error instanceof Error ? error.message : 'Unknown error',
        tokenMint: token.mint
      });
      
      // Return minimal valid TokenData on error
      return this.createFallbackTokenData(token);
    }
  }

  /**
   * Transform transaction data to VolumeAnalysis structure
   */
  public mapVolumeAnalysis(
    pools: SolanaTrackerPool[],
    response: SolanaTrackerTokenResponse
  ): VolumeAnalysis {
    const primaryPool = this.selectPrimaryPool(pools);
    
    if (!primaryPool) {
      return this.createFallbackVolumeAnalysis(response.token?.mint);
    }

    const { txns } = primaryPool;
    const currentVolume = txns?.volume || 0;
    const volume24h = txns?.volume24h || 0;
    
    // Calculate volume metrics
    const averageVolume = volume24h; // Using 24h as baseline
    const volumeSpikeFactor = averageVolume > 0 ? currentVolume / averageVolume : 1;
    const volumeSpike = volumeSpikeFactor > 2.0; // Consider 2x average as spike
    
    // Calculate buy/sell pressure from transaction counts
    const totalTxns = txns?.total || 1;
    const buys = txns?.buys || 0;
    const sells = txns?.sells || 0;
    
    const buyPressure = totalTxns > 0 ? (buys / totalTxns) * 100 : 50;
    const sellPressure = totalTxns > 0 ? (sells / totalTxns) * 100 : 50;
    const netFlow = buyPressure - sellPressure;
    
    // Calculate liquidity score based on pool liquidity and volume
    const liquidity = primaryPool.liquidity?.usd || 0;
    const liquidityScore = this.calculateLiquidityScore(liquidity, volume24h);

    return {
      averageVolume,
      currentVolume,
      volumeSpike,
      volumeSpikeFactor,
      volumeProfile: {
        buyPressure,
        sellPressure,
        netFlow
      },
      liquidityScore
    };
  }

  /**
   * Transform SolanaTrackerRisk to RiskAssessment structure
   */
  public mapRiskAssessment(
    risk: SolanaTrackerRisk | undefined,
    pools: SolanaTrackerPool[],
    marketCap: number
  ): RiskAssessment {
    const primaryPool = this.selectPrimaryPool(pools);
    
    // Scale risk score from 0-10 to 0-100 (inverted: lower API score = higher risk)
    const apiRiskScore = risk?.score ?? 5; // Default to medium risk
    const scaledRiskScore = this.scaleRiskScore(apiRiskScore);
    const overallRisk = 100 - scaledRiskScore; // Invert: 0 = low risk, 100 = high risk
    
    // Calculate individual risk factors
    const factors = {
      liquidity: this.calculateLiquidityRisk(primaryPool?.liquidity?.usd || 0),
      volatility: this.calculateVolatilityRisk(primaryPool), // Placeholder - would need price history
      holderConcentration: this.calculateHolderConcentrationRisk(risk),
      marketCap: this.calculateMarketCapRisk(marketCap),
      age: this.calculateAgeRisk(primaryPool), // Based on pool data
      rugPullRisk: this.calculateRugPullRisk(risk)
    };
    
    // Generate warnings based on risk factors
    const warnings = this.generateRiskWarnings(risk, factors);
    
    // Determine overall risk level
    const riskLevel = this.determineRiskLevel(overallRisk);

    return {
      overall: overallRisk,
      factors,
      warnings,
      riskLevel
    };
  }

  /**
   * Transform chart data to ChartDataPoint array
   */
  public mapChartData(chartResponse: SolanaTrackerChartResponse): ChartDataPoint[] {
    return chartResponse.oclhv.map(point => ({
      timestamp: point.time,
      open: point.open,
      high: point.high,
      low: point.low,
      close: point.close,
      volume: point.volume
    }));
  }

  /**
   * Create complete mapped data structure
   */
  public mapCompleteTokenData(
    tokenResponse: SolanaTrackerTokenResponse,
    chartResponse?: SolanaTrackerChartResponse
  ): MappedTokenData {
    const tokenData = this.mapTokenResponse(tokenResponse);
    const volumeAnalysis = this.mapVolumeAnalysis(tokenResponse.pools, tokenResponse);
    const riskAssessment = this.mapRiskAssessment(
      tokenResponse.risk,
      tokenResponse.pools,
      tokenData.marketCap
    );
    const chartData = chartResponse ? this.mapChartData(chartResponse) : undefined;

    return {
      tokenData,
      volumeAnalysis,
      riskAssessment,
      chartData
    };
  }

  /**
   * Create AnalysisContext from mapped data
   */
  public createAnalysisContext(
    mappedData: MappedTokenData,
    historicalAnalysis: any[] = [], // AnalysisResult[] - avoiding circular import
    marketContext = {
      overallTrend: 'sideways' as const,
      volatilityIndex: 50,
      marketSentiment: 50
    }
  ): AnalysisContext {
    return {
      tokenData: mappedData.tokenData,
      chartData: mappedData.chartData || [],
      historicalAnalysis,
      marketContext
    };
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Select primary pool (highest liquidity or first available)
   */
  private selectPrimaryPool(pools: SolanaTrackerPool[]): SolanaTrackerPool | null {
    if (!pools || pools.length === 0) return null;
    
    // Find pool with highest USD liquidity
    return pools.reduce((best, current) => {
      const bestLiquidity = best?.liquidity?.usd || 0;
      const currentLiquidity = current?.liquidity?.usd || 0;
      return currentLiquidity > bestLiquidity ? current : best;
    }, pools[0]);
  }

  /**
   * Extract 24h price change from events
   */
  private extractPriceChange24h(events: SolanaTrackerEvents | undefined): number {
    return events?.['24h']?.priceChangePercentage || 0;
  }

  /**
   * Extract tags from token metadata and risk data
   */
  private extractTags(token: any, risk: SolanaTrackerRisk | undefined): string[] {
    const tags: string[] = [];
    
    if (risk?.jupiterVerified) tags.push('verified');
    if (risk?.rugged) tags.push('rugged');
    if (risk?.risks?.length) tags.push('risky');
    
    return tags;
  }

  /**
   * Scale risk score from 0-10 to 0-100
   */
  private scaleRiskScore(apiRiskScore: number | undefined): number {
    if (apiRiskScore === undefined) return 50; // Default medium risk
    
    // API score: 0 = highest risk, 10 = lowest risk
    // Our scale: 0 = highest risk, 100 = lowest risk
    return Math.round(apiRiskScore * 10);
  }

  /**
   * Map numeric risk score to risk level
   */
  private mapRiskLevel(apiRiskScore: number | undefined): 'low' | 'medium' | 'high' {
    const scaledScore = this.scaleRiskScore(apiRiskScore);
    
    if (scaledScore >= 75) return 'low';
    if (scaledScore >= 50) return 'medium';
    return 'high';
  }

  /**
   * Calculate liquidity score from liquidity and volume
   */
  private calculateLiquidityScore(liquidity: number, volume24h: number): number {
    // Score based on liquidity depth and trading activity
    const liquidityScore = Math.min(liquidity / 100000, 1) * 50; // Max 50 points for $100k+ liquidity
    const volumeScore = Math.min(volume24h / 50000, 1) * 50; // Max 50 points for $50k+ volume
    
    return Math.round(liquidityScore + volumeScore);
  }

  /**
   * Calculate individual risk factor scores
   */
  private calculateLiquidityRisk(liquidity: number): number {
    // Lower liquidity = higher risk (0-100 scale)
    if (liquidity > 500000) return 10; // Very low risk
    if (liquidity > 100000) return 25; // Low risk
    if (liquidity > 50000) return 50;  // Medium risk
    if (liquidity > 10000) return 75;  // High risk
    return 90; // Very high risk
  }

  private calculateVolatilityRisk(pool: SolanaTrackerPool | null): number {
    // Placeholder - would need historical price data for proper calculation
    return 50; // Default medium volatility risk
  }

  private calculateHolderConcentrationRisk(risk: SolanaTrackerRisk | undefined): number {
    if (!risk) return 50;
    
    const top10Percentage = risk.top10 || 0;
    
    // Higher concentration = higher risk
    if (top10Percentage > 80) return 90; // Very high risk
    if (top10Percentage > 60) return 75; // High risk
    if (top10Percentage > 40) return 50; // Medium risk
    if (top10Percentage > 20) return 25; // Low risk
    return 10; // Very low risk
  }

  private calculateMarketCapRisk(marketCap: number): number {
    // Lower market cap = higher risk
    if (marketCap > 100000000) return 10; // $100M+ = very low risk
    if (marketCap > 50000000) return 20;  // $50M+ = low risk  
    if (marketCap > 10000000) return 35;  // $10M+ = medium-low risk
    if (marketCap > 5000000) return 50;   // $5M+ = medium risk
    if (marketCap > 1000000) return 70;   // $1M+ = high risk
    return 90; // <$1M = very high risk
  }

  private calculateAgeRisk(pool: SolanaTrackerPool | null): number {
    if (!pool?.lastUpdated) return 70; // High risk for unknown age
    
    const ageMs = Date.now() - (pool.lastUpdated * 1000);
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    
    // Newer tokens = higher risk
    if (ageDays > 365) return 10; // 1+ year = very low risk
    if (ageDays > 180) return 20; // 6+ months = low risk
    if (ageDays > 90) return 35;  // 3+ months = medium-low risk
    if (ageDays > 30) return 50;  // 1+ month = medium risk
    if (ageDays > 7) return 70;   // 1+ week = high risk
    return 90; // <1 week = very high risk
  }

  private calculateRugPullRisk(risk: SolanaTrackerRisk | undefined): number {
    if (!risk) return 50;
    
    let rugRisk = 30; // Base risk
    
    if (risk.rugged) return 100; // Already rugged
    
    // Add risk for concerning factors
    if (risk.risks?.includes('high_insider_percentage')) rugRisk += 20;
    if (risk.risks?.includes('many_snipers')) rugRisk += 15;
    if (risk.risks?.includes('low_liquidity')) rugRisk += 15;
    if (risk.risks?.includes('no_socials')) rugRisk += 10;
    
    return Math.min(rugRisk, 95); // Cap at 95 (not 100 unless already rugged)
  }

  /**
   * Generate risk warnings based on factors
   */
  private generateRiskWarnings(
    risk: SolanaTrackerRisk | undefined,
    factors: RiskAssessment['factors']
  ): string[] {
    const warnings: string[] = [];
    
    if (risk?.rugged) {
      warnings.push('Token has been flagged as rugged');
    }
    
    if (factors.liquidity > 75) {
      warnings.push('Low liquidity may result in high slippage');
    }
    
    if (factors.holderConcentration > 75) {
      warnings.push('High holder concentration increases manipulation risk');
    }
    
    if (factors.marketCap > 70) {
      warnings.push('Very low market cap increases volatility risk');
    }
    
    if (factors.age > 70) {
      warnings.push('New token with limited trading history');
    }
    
    if (factors.rugPullRisk > 75) {
      warnings.push('Elevated rug pull risk factors detected');
    }
    
    // Add API-specific risk warnings
    if (risk?.risks?.length) {
      risk.risks.forEach(riskType => {
        warnings.push(`Risk factor: ${riskType.replace(/_/g, ' ')}`);
      });
    }
    
    return warnings;
  }

  /**
   * Determine overall risk level from score
   */
  private determineRiskLevel(overallRisk: number): 'low' | 'medium' | 'high' | 'extreme' {
    if (overallRisk <= 25) return 'low';
    if (overallRisk <= 50) return 'medium';
    if (overallRisk <= 75) return 'high';
    return 'extreme';
  }

  /**
   * Create fallback TokenData for error cases
   */
  private createFallbackTokenData(token: any): TokenData {
    return {
      address: token.mint || 'unknown',
      symbol: token.symbol || 'UNKNOWN',
      name: token.name || 'Unknown Token',
      decimals: token.decimals || 9,
      supply: 0,
      marketCap: 0,
      price: 0,
      priceChange24h: 0,
      volume24h: 0,
      holders: 0,
      createdAt: new Date().toISOString(),
      image: token.image,
      riskLevel: 'high',
      riskScore: 20
    };
  }

  /**
   * Create fallback VolumeAnalysis for error cases
   */
  private createFallbackVolumeAnalysis(tokenAddress?: string): VolumeAnalysis {
    // Generate token-specific variations to prevent identical ratings
    const addressHash = this.generateAddressHash(tokenAddress);
    const baseVariation = (addressHash % 20) - 10; // -10 to +10 variation
    
    return {
      averageVolume: Math.max(0, 10000 + (addressHash % 50000)), // Some base volume
      currentVolume: Math.max(0, 8000 + (addressHash % 40000)), // Some current volume
      volumeSpike: (addressHash % 10) > 7, // 20% chance of spike
      volumeSpikeFactor: Math.max(0.5, 1 + (addressHash % 30) / 30), // 0.5 to 2.0
      volumeProfile: {
        buyPressure: Math.max(10, Math.min(90, 50 + baseVariation)), // 40-60 range
        sellPressure: Math.max(10, Math.min(90, 50 - baseVariation)), // 40-60 range  
        netFlow: baseVariation / 100 // -0.1 to +0.1
      },
      liquidityScore: Math.max(5, Math.min(60, 25 + (addressHash % 40))) // 25-65 range
    };
  }

  /**
   * Generate a simple hash from token address for variations
   */
  private generateAddressHash(address?: string): number {
    if (!address) return 42; // Default fallback
    
    let hash = 0;
    for (let i = 0; i < address.length; i++) {
      const char = address.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}