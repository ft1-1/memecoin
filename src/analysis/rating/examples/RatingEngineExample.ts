/**
 * Rating Engine Usage Example and Integration Guide
 * 
 * Demonstrates how to integrate and use the sophisticated multi-factor
 * rating system within the memecoin analyzer application.
 */

import {
  RatingEngine,
  RatingThresholds,
  TechnicalScoreCalculator,
  MomentumScoreCalculator,
  VolumeScoreCalculator,
  RiskScoreCalculator
} from '../index';

import {
  TechnicalIndicators,
  MomentumAnalysis,
  VolumeAnalysis,
  RiskAssessment,
  AnalysisContext,
  RatingResult
} from '../../../types/analysis';

import { Logger } from '../../../utils/Logger';

/**
 * Example usage of the Rating Engine for memecoin analysis
 */
export class RatingEngineExample {
  private ratingEngine: RatingEngine;
  private logger = Logger.getInstance();

  constructor() {
    // Initialize rating engine with custom configuration
    this.ratingEngine = new RatingEngine({
      weights: {
        technical: 0.40,    // 40% weight for technical analysis
        momentum: 0.30,     // 30% weight for momentum analysis
        volume: 0.20,       // 20% weight for volume analysis
        risk: 0.10          // 10% weight for risk assessment
      },
      adaptiveWeighting: true,    // Enable adaptive weight adjustment
      riskAdjustment: true,       // Enable risk-based rating adjustments
      confidenceThreshold: 70,    // Minimum 70% confidence for high ratings
      smoothingFactor: 0.15       // 15% smoothing factor for rating stability
    });

    this.logger.info('RatingEngineExample initialized');
  }

  /**
   * Complete example of rating calculation workflow
   */
  public async demonstrateRatingCalculation(): Promise<RatingResult> {
    // Step 1: Create sample technical indicators
    const technicalIndicators: TechnicalIndicators = {
      rsi: 58.5,  // Healthy RSI in bullish zone
      macd: {
        macd: 0.025,
        signal: 0.018,
        histogram: 0.007  // Positive momentum
      },
      bollinger: {
        upper: 0.00045,
        middle: 0.00042,
        lower: 0.00039,
        position: 0.68    // Near upper band - bullish
      },
      ema: {
        '12': 0.000425,
        '26': 0.000418,
        '50': 0.000410    // Bullish EMA alignment
      },
      sma: {
        '20': 0.000420,
        '50': 0.000412
      }
    };

    // Step 2: Create sample momentum analysis
    const momentum: MomentumAnalysis = {
      trend: 'bullish',
      strength: 75,       // Strong trend
      momentum: 1.8,      // Positive momentum
      volatility: 28,     // Moderate volatility
      support: [0.000395, 0.000388, 0.000380],
      resistance: [0.000448, 0.000455, 0.000465],
      priceAction: {
        breakoutPotential: 0.82,  // High breakout potential
        consolidation: true,
        reversalSignal: false
      }
    };

    // Step 3: Create sample volume analysis
    const volume: VolumeAnalysis = {
      averageVolume: 2500000,
      currentVolume: 8750000,     // 3.5x volume spike
      volumeSpike: true,
      volumeSpikeFactor: 3.5,
      volumeProfile: {
        buyPressure: 0.72,        // Strong buying pressure
        sellPressure: 0.28,
        netFlow: 0.44             // Net buying
      },
      liquidityScore: 78          // Good liquidity
    };

    // Step 4: Create sample risk assessment
    const risk: RiskAssessment = {
      overall: 45,                // Moderate overall risk
      factors: {
        liquidity: 25,            // Low liquidity risk (good)
        volatility: 55,           // Moderate volatility
        holderConcentration: 40,  // Moderate concentration risk
        marketCap: 35,            // Low market cap risk
        age: 60,                  // Moderate age risk (relatively new)
        rugPullRisk: 30           // Low rug pull risk
      },
      warnings: [
        'Token is relatively new (< 3 months)',
        'Moderate volatility expected'
      ],
      riskLevel: 'medium'
    };

    // Step 5: Create analysis context
    const context: AnalysisContext = {
      tokenData: {
        address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
        symbol: 'EXAMPLE',
        name: 'Example Memecoin',
        price: 0.000432,
        marketCap: 15750000,      // $15.75M market cap
        volume24h: 8750000,
        change24h: 18.5,
        holders: 12400,
        decimals: 9,
        totalSupply: 1000000000000,
        verified: true,
        tags: ['meme', 'solana'],
        description: 'Example memecoin for demonstration',
        socials: {
          twitter: 'https://twitter.com/example',
          telegram: 'https://t.me/example',
          website: 'https://example.com'
        },
        riskScore: 45,
        liquidityUSD: 2850000,
        createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString() // 45 days ago
      },
      chartData: this.generateSampleChartData(100), // 100 data points
      historicalAnalysis: [],
      marketContext: {
        overallTrend: 'bull',
        volatilityIndex: 42,
        marketSentiment: 68
      }
    };

    // Step 6: Calculate the rating
    const rating = await this.ratingEngine.calculateRating(
      technicalIndicators,
      momentum,
      volume,
      risk,
      context
    );

    // Step 7: Process and display results
    this.displayRatingResults(rating, context);

    return rating;
  }

  /**
   * Example of individual component score analysis
   */
  public async demonstrateComponentAnalysis(): Promise<void> {
    this.logger.info('Demonstrating individual component analysis...');

    // Create calculators for detailed analysis
    const technicalCalculator = new TechnicalScoreCalculator();
    const momentumCalculator = new MomentumScoreCalculator();
    const volumeCalculator = new VolumeScoreCalculator();
    const riskCalculator = new RiskScoreCalculator();

    // Sample data (simplified for example)
    const technicalIndicators: TechnicalIndicators = this.getSampleTechnicalIndicators();
    const momentum: MomentumAnalysis = this.getSampleMomentumAnalysis();
    const volume: VolumeAnalysis = this.getSampleVolumeAnalysis();
    const risk: RiskAssessment = this.getSampleRiskAssessment();
    const context: AnalysisContext = this.getSampleContext();

    // Get detailed breakdowns
    const technicalBreakdown = technicalCalculator.getDetailedAnalysis(technicalIndicators, context);
    const momentumBreakdown = momentumCalculator.getDetailedAnalysis(momentum, context);
    const volumeBreakdown = volumeCalculator.getDetailedAnalysis(volume, context);
    const riskBreakdown = riskCalculator.getDetailedAnalysis(risk, context);

    // Display detailed analysis
    console.log('\n=== DETAILED COMPONENT ANALYSIS ===');
    console.log('\n📊 Technical Analysis Breakdown:');
    Object.entries(technicalBreakdown).forEach(([factor, analysis]) => {
      console.log(`  ${factor}: ${analysis.score.toFixed(1)}/100 (${analysis.signal}) - ${analysis.description}`);
    });

    console.log('\n📈 Momentum Analysis Breakdown:');
    Object.entries(momentumBreakdown).forEach(([factor, analysis]) => {
      console.log(`  ${factor}: ${analysis.score.toFixed(1)}/100 (${analysis.signal}) - ${analysis.description}`);
    });

    console.log('\n📢 Volume Analysis Breakdown:');
    Object.entries(volumeBreakdown).forEach(([factor, analysis]) => {
      console.log(`  ${factor}: ${analysis.score.toFixed(1)}/100 (${analysis.signal}) - ${analysis.description}`);
    });

    console.log('\n⚠️ Risk Analysis Breakdown:');
    Object.entries(riskBreakdown).forEach(([factor, analysis]) => {
      if (factor !== 'warnings') {
        console.log(`  ${factor}: ${analysis.score.toFixed(1)}/100 (${analysis.signal}) - ${analysis.description}`);
      }
    });

    if (riskBreakdown.warnings.length > 0) {
      console.log('\n  Risk Warnings:');
      riskBreakdown.warnings.forEach(warning => console.log(`    • ${warning}`));
    }
  }

  /**
   * Example of notification threshold checking
   */
  public demonstrateNotificationLogic(rating: RatingResult, context: AnalysisContext): void {
    console.log('\n=== NOTIFICATION LOGIC DEMONSTRATION ===');

    // Check if rating meets notification thresholds
    const notificationCheck = RatingThresholds.shouldNotify(
      rating.rating,
      rating.confidence,
      context.tokenData.volume24h,
      100 - rating.components.risk, // Convert risk score to risk percentage
      Object.keys(rating.components).filter(key => rating.components[key as keyof typeof rating.components] > 0)
    );

    console.log(`\nNotification Decision: ${notificationCheck.shouldNotify ? '✅ SEND' : '❌ SKIP'}`);
    console.log(`Priority: ${notificationCheck.priority.toUpperCase()}`);

    if (notificationCheck.threshold) {
      console.log(`Triggered Threshold: Rating ≥ ${notificationCheck.threshold.rating}, Confidence ≥ ${notificationCheck.threshold.confidence}%`);
    }

    // Check for special alert conditions
    const alertConditions = RatingThresholds.checkAlertConditions(
      3.5,  // Volume spike factor
      0.82, // Breakout potential
      1.8,  // Momentum surge
      0.75  // Technical confluence
    );

    if (alertConditions.alerts.length > 0) {
      console.log('\nSpecial Alert Conditions:');
      alertConditions.alerts.forEach(alert => console.log(`  ${alert}`));
      console.log(`Bonus: +${alertConditions.ratingBonus.toFixed(1)} rating, +${alertConditions.confidenceBonus}% confidence`);
    }
  }

  /**
   * Display comprehensive rating results
   */
  private displayRatingResults(rating: RatingResult, context: AnalysisContext): void {
    const threshold = RatingThresholds.getRatingThreshold(rating.rating);
    
    console.log('\n' + '='.repeat(60));
    console.log('🎯 MEMECOIN RATING ANALYSIS RESULTS');
    console.log('='.repeat(60));
    
    console.log(`\n${threshold.icon} OVERALL RATING: ${rating.rating.toFixed(1)}/10`);
    console.log(`📊 CONFIDENCE: ${rating.confidence.toFixed(1)}%`);
    console.log(`🏷️  CLASSIFICATION: ${threshold.label.toUpperCase()}`);
    console.log(`🎯 RECOMMENDATION: ${rating.recommendation.toUpperCase().replace('_', ' ')}`);
    
    console.log(`\n💭 DESCRIPTION:`);
    console.log(`   ${threshold.description}`);
    
    console.log(`\n📈 COMPONENT SCORES:`);
    Object.entries(rating.components).forEach(([component, score]) => {
      if (score > 0) {
        const percentage = (score * (rating.weights[component as keyof typeof rating.weights] || 0)).toFixed(1);
        console.log(`   ${component.charAt(0).toUpperCase() + component.slice(1)}: ${score.toFixed(1)}/100 (${percentage}% contribution)`);
      }
    });
    
    console.log(`\n🧠 REASONING:`);
    rating.reasoning.forEach(reason => console.log(`   • ${reason}`));
    
    if (rating.alerts.length > 0) {
      console.log(`\n🚨 ALERTS:`);
      rating.alerts.forEach(alert => console.log(`   ${alert}`));
    }
    
    console.log(`\n📋 TOKEN INFORMATION:`);
    console.log(`   Symbol: ${context.tokenData.symbol}`);
    console.log(`   Price: $${context.tokenData.price.toFixed(8)}`);
    console.log(`   Market Cap: $${(context.tokenData.marketCap / 1e6).toFixed(2)}M`);
    console.log(`   24h Volume: $${(context.tokenData.volume24h / 1e6).toFixed(2)}M`);
    console.log(`   24h Change: ${context.tokenData.change24h > 0 ? '+' : ''}${context.tokenData.change24h.toFixed(2)}%`);
    
    console.log('\n' + '='.repeat(60));
  }

  /**
   * Generate sample chart data for demonstration
   */
  private generateSampleChartData(points: number) {
    const data = [];
    let price = 0.0004;
    let volume = 2000000;
    const now = Date.now();
    
    for (let i = 0; i < points; i++) {
      const timestamp = now - (points - i) * 5 * 60 * 1000; // 5-minute intervals
      
      // Simulate price movement with trend
      price *= (0.995 + Math.random() * 0.01); // Slight upward bias
      volume *= (0.8 + Math.random() * 0.4);   // Random volume variation
      
      data.push({
        timestamp,
        open: price * (0.999 + Math.random() * 0.002),
        high: price * (1.001 + Math.random() * 0.008),
        low: price * (0.999 - Math.random() * 0.006),
        close: price,
        volume: Math.floor(volume)
      });
    }
    
    return data;
  }

  // Helper methods for sample data generation
  private getSampleTechnicalIndicators(): TechnicalIndicators {
    return {
      rsi: 58.5,
      macd: { macd: 0.025, signal: 0.018, histogram: 0.007 },
      bollinger: { upper: 0.00045, middle: 0.00042, lower: 0.00039, position: 0.68 },
      ema: { '12': 0.000425, '26': 0.000418, '50': 0.000410 },
      sma: { '20': 0.000420, '50': 0.000412 }
    };
  }

  private getSampleMomentumAnalysis(): MomentumAnalysis {
    return {
      trend: 'bullish',
      strength: 75,
      momentum: 1.8,
      volatility: 28,
      support: [0.000395, 0.000388, 0.000380],
      resistance: [0.000448, 0.000455, 0.000465],
      priceAction: {
        breakoutPotential: 0.82,
        consolidation: true,
        reversalSignal: false
      }
    };
  }

  private getSampleVolumeAnalysis(): VolumeAnalysis {
    return {
      averageVolume: 2500000,
      currentVolume: 8750000,
      volumeSpike: true,
      volumeSpikeFactor: 3.5,
      volumeProfile: {
        buyPressure: 0.72,
        sellPressure: 0.28,
        netFlow: 0.44
      },
      liquidityScore: 78
    };
  }

  private getSampleRiskAssessment(): RiskAssessment {
    return {
      overall: 45,
      factors: {
        liquidity: 25,
        volatility: 55,
        holderConcentration: 40,
        marketCap: 35,
        age: 60,
        rugPullRisk: 30
      },
      warnings: ['Token is relatively new (< 3 months)', 'Moderate volatility expected'],
      riskLevel: 'medium'
    };
  }

  private getSampleContext(): AnalysisContext {
    return {
      tokenData: {
        address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
        symbol: 'EXAMPLE',
        name: 'Example Memecoin',
        price: 0.000432,
        marketCap: 15750000,
        volume24h: 8750000,
        change24h: 18.5,
        holders: 12400,
        decimals: 9,
        totalSupply: 1000000000000,
        verified: true,
        tags: ['meme', 'solana'],
        description: 'Example memecoin for demonstration',
        socials: {
          twitter: 'https://twitter.com/example',
          telegram: 'https://t.me/example',
          website: 'https://example.com'
        },
        riskScore: 45,
        liquidityUSD: 2850000,
        createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString()
      },
      chartData: this.generateSampleChartData(100),
      historicalAnalysis: [],
      marketContext: {
        overallTrend: 'bull',
        volatilityIndex: 42,
        marketSentiment: 68
      }
    };
  }
}

/**
 * Main execution function for running the example
 */
export async function runRatingEngineExample(): Promise<void> {
  const example = new RatingEngineExample();
  
  console.log('🚀 Starting Rating Engine Example...\n');
  
  try {
    // Run complete rating calculation demonstration
    const rating = await example.demonstrateRatingCalculation();
    
    // Show component analysis
    await example.demonstrateComponentAnalysis();
    
    // Demonstrate notification logic
    const context = example.getSampleContext() as any;
    example.demonstrateNotificationLogic(rating, context);
    
    console.log('\n✅ Rating Engine Example completed successfully!');
    
  } catch (error) {
    console.error('❌ Rating Engine Example failed:', error);
  }
}

// Export for use in other modules
export { RatingEngineExample };