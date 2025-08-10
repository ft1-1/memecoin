/**
 * Context Defaults Utility
 * 
 * Provides defensive defaults for AnalysisContext properties to prevent
 * undefined access errors in rating calculations.
 */

import { AnalysisContext } from '../../../types/analysis';

export class ContextDefaults {
  /**
   * Ensure AnalysisContext has all required properties with safe defaults
   */
  public static ensureMarketContext(context: AnalysisContext): AnalysisContext {
    const safeContext = { ...context };
    
    // Ensure marketContext exists with defaults
    if (!safeContext.marketContext) {
      safeContext.marketContext = this.getDefaultMarketContext();
    } else {
      safeContext.marketContext = {
        overallTrend: context.marketContext.overallTrend || 'sideways',
        volatilityIndex: context.marketContext.volatilityIndex ?? 50,
        marketSentiment: context.marketContext.marketSentiment ?? 50
      };
    }

    return safeContext;
  }

  /**
   * Get safe market context values with fallbacks
   */
  public static getMarketContextValues(context: AnalysisContext) {
    return {
      overallTrend: context.marketContext?.overallTrend || 'sideways' as const,
      volatilityIndex: context.marketContext?.volatilityIndex ?? 50,
      marketSentiment: context.marketContext?.marketSentiment ?? 50
    };
  }

  /**
   * Check if market context is properly initialized
   */
  public static isMarketContextValid(context: AnalysisContext): boolean {
    return !!(
      context.marketContext &&
      typeof context.marketContext.overallTrend === 'string' &&
      typeof context.marketContext.volatilityIndex === 'number' &&
      typeof context.marketContext.marketSentiment === 'number'
    );
  }

  /**
   * Get default market context for fallback scenarios
   */
  public static getDefaultMarketContext(): AnalysisContext['marketContext'] {
    return {
      overallTrend: 'sideways',
      volatilityIndex: 50,
      marketSentiment: 50
    };
  }
}