/**
 * Technical Score Calculator - 40% Weight in Overall Rating
 * 
 * Analyzes technical indicators to generate a 0-100 technical score:
 * - RSI analysis (overbought/oversold conditions)
 * - MACD momentum and signal crossovers
 * - Bollinger Bands position and squeeze patterns
 * - Moving average alignment and golden cross patterns
 * - Multi-timeframe technical confluence
 */

import { TechnicalIndicators, AnalysisContext } from '../../../types/analysis';
import { Logger } from '../../../utils/Logger';

export class TechnicalScoreCalculator {
  private logger = Logger.getInstance();

  /**
   * Calculate technical analysis score (0-100)
   */
  public async calculate(
    indicators: TechnicalIndicators,
    context: AnalysisContext
  ): Promise<number> {
    try {
      const scores = {
        rsi: this.calculateRSIScore(indicators.rsi),
        macd: this.calculateMACDScore(indicators.macd),
        bollinger: this.calculateBollingerScore(indicators.bollinger, context.tokenData.price),
        movingAverages: this.calculateMovingAverageScore(indicators.ema, indicators.sma, context.tokenData.price),
        confluence: this.calculateConfluenceScore(indicators)
      };

      // Weighted combination of technical indicators
      const weights = {
        rsi: 0.25,           // 25% - Momentum oscillator
        macd: 0.25,          // 25% - Trend and momentum
        bollinger: 0.20,     // 20% - Volatility and position
        movingAverages: 0.20, // 20% - Trend direction
        confluence: 0.10     // 10% - Multi-indicator alignment
      };

      const technicalScore = Object.entries(scores).reduce(
        (total, [key, score]) => total + score * weights[key as keyof typeof weights],
        0
      );

      this.logger.debug('Technical score calculated', {
        tokenAddress: context.tokenData.address,
        scores,
        finalScore: technicalScore
      });

      return Math.max(0, Math.min(100, technicalScore));

    } catch (error) {
      this.logger.error('Technical score calculation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        tokenAddress: context.tokenData.address
      });
      return 50; // Return neutral score on error
    }
  }

  /**
   * Calculate RSI-based score
   */
  private calculateRSIScore(rsi: number): number {
    // RSI scoring with non-linear scaling
    if (rsi >= 70) {
      // Overbought region - decreasing score as RSI increases
      return Math.max(20, 100 - (rsi - 70) * 2.5);
    } else if (rsi <= 30) {
      // Oversold region - increasing score as RSI decreases  
      return Math.min(80, 100 - rsi);
    } else if (rsi >= 45 && rsi <= 65) {
      // Optimal range for bullish momentum
      return 85 + (60 - Math.abs(rsi - 55)) * 0.5;
    } else {
      // Transitional zones
      return 50 + (rsi - 50) * 0.8;
    }
  }

  /**
   * Calculate MACD-based score
   */
  private calculateMACDScore(macd: TechnicalIndicators['macd']): number {
    let score = 50; // Base neutral score

    // MACD line vs Signal line
    if (macd.macd > macd.signal) {
      score += 25; // Bullish crossover
      
      // Bonus for strong separation
      const separation = Math.abs(macd.macd - macd.signal);
      score += Math.min(15, separation * 1000); // Assume MACD values are small
    } else {
      score -= 20; // Bearish condition
    }

    // Histogram analysis (momentum acceleration)
    if (macd.histogram > 0) {
      score += 15; // Positive momentum
      
      // Bonus for increasing histogram (acceleration)
      if (macd.histogram > Math.abs(macd.macd - macd.signal) * 0.5) {
        score += 10; // Strong acceleration
      }
    } else {
      score -= 10; // Negative momentum
    }

    // MACD above/below zero line
    if (macd.macd > 0) {
      score += 10; // Above zero - bullish trend
    } else {
      score -= 5; // Below zero - bearish trend
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate Bollinger Bands score
   */
  private calculateBollingerScore(
    bollinger: TechnicalIndicators['bollinger'],
    currentPrice: number
  ): number {
    const position = bollinger.position;
    let score = 50;

    // Position within bands analysis
    if (position > 0.8) {
      // Near upper band - potential resistance
      score += 10 + (position - 0.8) * 50; // Moderate bullish
    } else if (position < 0.2) {
      // Near lower band - potential support/oversold
      score += 30 + (0.2 - position) * 100; // Strong bullish signal
    } else if (position >= 0.4 && position <= 0.6) {
      // Middle zone - neutral but stable
      score += 20;
    } else {
      // Transitional zones
      score += Math.abs(position - 0.5) * 20;
    }

    // Band squeeze analysis (volatility contraction)
    const bandWidth = (bollinger.upper - bollinger.lower) / bollinger.middle;
    if (bandWidth < 0.1) { // Tight bands indicate potential breakout
      score += 15;
    } else if (bandWidth > 0.3) { // Wide bands indicate high volatility
      score -= 10;
    }

    // Price vs middle band (20-period SMA)
    if (currentPrice > bollinger.middle) {
      score += 10; // Above middle band is bullish
    } else {
      score -= 5; // Below middle band is bearish
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate Moving Average score
   */
  private calculateMovingAverageScore(
    ema: Record<string, number>,
    sma: Record<string, number>,
    currentPrice: number
  ): number {
    let score = 50;
    let validSignals = 0;

    // Common periods for analysis
    const periods = ['12', '26', '50', '200'];
    
    // EMA alignment analysis
    let emaAlignment = 0;
    const emaValues = periods
      .filter(period => ema[period] !== undefined)
      .map(period => ({ period: parseInt(period), value: ema[period] }))
      .sort((a, b) => a.period - b.period);

    if (emaValues.length >= 2) {
      // Check for proper bullish alignment (shorter EMA > longer EMA)
      for (let i = 0; i < emaValues.length - 1; i++) {
        if (emaValues[i].value > emaValues[i + 1].value) {
          emaAlignment++;
        } else {
          emaAlignment--;
        }
      }
      
      score += (emaAlignment / (emaValues.length - 1)) * 25;
      validSignals++;
    }

    // Price vs EMAs
    let priceVsEma = 0;
    emaValues.forEach(({ value }) => {
      if (currentPrice > value) priceVsEma++;
      else priceVsEma--;
    });
    
    if (emaValues.length > 0) {
      score += (priceVsEma / emaValues.length) * 20;
      validSignals++;
    }

    // Golden Cross / Death Cross detection
    if (ema['50'] && ema['200']) {
      const shortTerm = ema['50'];
      const longTerm = ema['200'];
      
      if (shortTerm > longTerm) {
        score += 15; // Golden cross (bullish)
      } else {
        score -= 10; // Death cross (bearish)
      }
      validSignals++;
    }

    // EMA vs SMA comparison (trend strength)
    if (ema['26'] && sma['26']) {
      if (ema['26'] > sma['26']) {
        score += 10; // EMA above SMA indicates strong trend
      } else {
        score -= 5; // EMA below SMA indicates weakening trend
      }
      validSignals++;
    }

    // Penalize if insufficient data
    if (validSignals < 2) {
      score *= 0.7; // 30% penalty for limited data
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate multi-indicator confluence score
   */
  private calculateConfluenceScore(indicators: TechnicalIndicators): number {
    let bullishSignals = 0;
    let totalSignals = 0;

    // RSI confluence
    if (indicators.rsi >= 40 && indicators.rsi <= 70) {
      bullishSignals++;
    } else if (indicators.rsi > 70) {
      bullishSignals += 0.3; // Partial signal - overbought but still bullish
    }
    totalSignals++;

    // MACD confluence
    if (indicators.macd.macd > indicators.macd.signal && indicators.macd.histogram > 0) {
      bullishSignals++;
    } else if (indicators.macd.macd > indicators.macd.signal) {
      bullishSignals += 0.7; // Partial signal
    }
    totalSignals++;

    // Bollinger confluence
    if (indicators.bollinger.position < 0.3 || 
       (indicators.bollinger.position > 0.5 && indicators.bollinger.position < 0.9)) {
      bullishSignals++;
    } else if (indicators.bollinger.position > 0.9) {
      bullishSignals += 0.4; // Partial signal - near resistance
    }
    totalSignals++;

    // Moving average confluence
    const emaValues = Object.values(indicators.ema).filter(val => !isNaN(val));
    if (emaValues.length >= 2) {
      const shortEma = Math.min(...emaValues);
      const longEma = Math.max(...emaValues);
      
      if (shortEma > longEma * 0.98) { // Within 2% tolerance
        bullishSignals++;
      } else if (shortEma > longEma * 0.95) {
        bullishSignals += 0.6; // Partial signal
      }
      totalSignals++;
    }

    const confluenceRatio = totalSignals > 0 ? bullishSignals / totalSignals : 0.5;
    
    // Non-linear scaling for confluence - reward high confluence
    return Math.pow(confluenceRatio, 0.8) * 100;
  }

  /**
   * Get detailed technical analysis breakdown
   */
  public getDetailedAnalysis(
    indicators: TechnicalIndicators,
    context: AnalysisContext
  ): {
    rsi: { score: number; signal: string; description: string };
    macd: { score: number; signal: string; description: string };
    bollinger: { score: number; signal: string; description: string };
    movingAverages: { score: number; signal: string; description: string };
    confluence: { score: number; signal: string; description: string };
  } {
    const rsiScore = this.calculateRSIScore(indicators.rsi);
    const macdScore = this.calculateMACDScore(indicators.macd);
    const bollingerScore = this.calculateBollingerScore(indicators.bollinger, context.tokenData.price);
    const maScore = this.calculateMovingAverageScore(indicators.ema, indicators.sma, context.tokenData.price);
    const confluenceScore = this.calculateConfluenceScore(indicators);

    return {
      rsi: {
        score: rsiScore,
        signal: rsiScore > 70 ? 'BULLISH' : rsiScore > 50 ? 'NEUTRAL' : 'BEARISH',
        description: this.getRSIDescription(indicators.rsi)
      },
      macd: {
        score: macdScore,
        signal: macdScore > 70 ? 'BULLISH' : macdScore > 50 ? 'NEUTRAL' : 'BEARISH',
        description: this.getMACDDescription(indicators.macd)
      },
      bollinger: {
        score: bollingerScore,
        signal: bollingerScore > 70 ? 'BULLISH' : bollingerScore > 50 ? 'NEUTRAL' : 'BEARISH',
        description: this.getBollingerDescription(indicators.bollinger)
      },
      movingAverages: {
        score: maScore,
        signal: maScore > 70 ? 'BULLISH' : maScore > 50 ? 'NEUTRAL' : 'BEARISH',
        description: this.getMADescription(indicators.ema, indicators.sma, context.tokenData.price)
      },
      confluence: {
        score: confluenceScore,
        signal: confluenceScore > 70 ? 'STRONG' : confluenceScore > 50 ? 'MODERATE' : 'WEAK',
        description: `${confluenceScore.toFixed(1)}% of technical indicators showing bullish alignment`
      }
    };
  }

  private getRSIDescription(rsi: number): string {
    if (rsi > 70) return `Overbought at ${rsi.toFixed(1)} - potential reversal zone`;
    if (rsi < 30) return `Oversold at ${rsi.toFixed(1)} - potential bounce opportunity`;
    if (rsi >= 45 && rsi <= 65) return `Healthy momentum at ${rsi.toFixed(1)} - bullish zone`;
    return `Neutral momentum at ${rsi.toFixed(1)}`;
  }

  private getMACDDescription(macd: TechnicalIndicators['macd']): string {
    const trend = macd.macd > macd.signal ? 'bullish' : 'bearish';
    const momentum = macd.histogram > 0 ? 'accelerating' : 'decelerating';
    return `${trend.charAt(0).toUpperCase() + trend.slice(1)} trend with ${momentum} momentum`;
  }

  private getBollingerDescription(bollinger: TechnicalIndicators['bollinger']): string {
    const position = bollinger.position;
    if (position > 0.8) return `Near upper band (${(position * 100).toFixed(1)}%) - potential resistance`;
    if (position < 0.2) return `Near lower band (${(position * 100).toFixed(1)}%) - potential support`;
    return `Mid-channel position (${(position * 100).toFixed(1)}%) - neutral zone`;
  }

  private getMADescription(
    ema: Record<string, number>,
    sma: Record<string, number>,
    price: number
  ): string {
    const ema26 = ema['26'];
    const ema50 = ema['50'];
    
    if (ema26 && ema50) {
      if (price > ema26 && ema26 > ema50) {
        return 'Strong bullish alignment - price above short and long EMAs';
      } else if (price < ema26 && ema26 < ema50) {
        return 'Bearish alignment - price below EMAs with downtrend';
      }
    }
    
    return 'Mixed moving average signals - trend unclear';
  }
}