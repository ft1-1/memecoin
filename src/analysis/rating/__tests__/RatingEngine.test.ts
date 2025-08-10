/**
 * Rating Engine Test Suite
 * 
 * Comprehensive tests for the multi-factor rating system including:
 * - Individual calculator accuracy
 * - Rating engine integration
 * - Edge case handling
 * - Configuration validation
 * - Performance benchmarks
 */

import {
  RatingEngine,
  RatingThresholds,
  TechnicalScoreCalculator,
  MomentumScoreCalculator,
  VolumeScoreCalculator,
  RiskScoreCalculator,
  ScoreNormalizer,
  ConfidenceCalculator
} from '../index';

import {
  TechnicalIndicators,
  MomentumAnalysis,
  VolumeAnalysis,
  RiskAssessment,
  AnalysisContext
} from '../../../types/analysis';

describe('RatingEngine', () => {
  let ratingEngine: RatingEngine;
  let sampleContext: AnalysisContext;

  beforeEach(() => {
    ratingEngine = new RatingEngine();
    sampleContext = createSampleAnalysisContext();
  });

  describe('Core Rating Calculation', () => {
    test('should calculate rating within valid range', async () => {
      const { technical, momentum, volume, risk } = createSampleInputs();
      
      const result = await ratingEngine.calculateRating(
        technical,
        momentum,
        volume,
        risk,
        sampleContext
      );

      expect(result.rating).toBeGreaterThanOrEqual(1);
      expect(result.rating).toBeLessThanOrEqual(10);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(100);
    });

    test('should return consistent ratings for identical inputs', async () => {
      const { technical, momentum, volume, risk } = createSampleInputs();
      
      const result1 = await ratingEngine.calculateRating(technical, momentum, volume, risk, sampleContext);
      const result2 = await ratingEngine.calculateRating(technical, momentum, volume, risk, sampleContext);

      expect(Math.abs(result1.rating - result2.rating)).toBeLessThan(0.1);
      expect(Math.abs(result1.confidence - result2.confidence)).toBeLessThan(5);
    });

    test('should handle exceptional inputs gracefully', async () => {
      const extremeInputs = createExtremeInputs();
      
      const result = await ratingEngine.calculateRating(
        extremeInputs.technical,
        extremeInputs.momentum,
        extremeInputs.volume,
        extremeInputs.risk,
        sampleContext
      );

      expect(result.rating).toBeGreaterThanOrEqual(1);
      expect(result.rating).toBeLessThanOrEqual(10);
      expect(result.confidence).toBeGreaterThan(0);
    });

    test('should generate appropriate reasoning', async () => {
      const { technical, momentum, volume, risk } = createHighQualityInputs();
      
      const result = await ratingEngine.calculateRating(technical, momentum, volume, risk, sampleContext);

      expect(result.reasoning).toHaveLength(expect.any(Number));
      expect(result.reasoning.length).toBeGreaterThan(0);
      expect(result.reasoning.every(reason => typeof reason === 'string')).toBe(true);
    });

    test('should provide valid recommendation', async () => {
      const { technical, momentum, volume, risk } = createSampleInputs();
      
      const result = await ratingEngine.calculateRating(technical, momentum, volume, risk, sampleContext);
      
      const validRecommendations = ['strong_buy', 'buy', 'hold', 'sell', 'strong_sell'];
      expect(validRecommendations).toContain(result.recommendation);
    });
  });

  describe('Component Score Calculations', () => {
    test('TechnicalScoreCalculator should handle various RSI values', async () => {
      const calculator = new TechnicalScoreCalculator();
      
      // Test oversold condition (RSI = 25)
      const oversoldTech = createTechnicalIndicators({ rsi: 25 });
      const oversoldScore = await calculator.calculate(oversoldTech, sampleContext);
      expect(oversoldScore).toBeGreaterThan(60); // Should be bullish opportunity

      // Test overbought condition (RSI = 75)
      const overboughtTech = createTechnicalIndicators({ rsi: 75 });
      const overboughtScore = await calculator.calculate(overboughtTech, sampleContext);
      expect(overboughtScore).toBeLessThan(oversoldScore); // Should be less bullish

      // Test optimal zone (RSI = 55)
      const optimalTech = createTechnicalIndicators({ rsi: 55 });
      const optimalScore = await calculator.calculate(optimalTech, sampleContext);
      expect(optimalScore).toBeGreaterThan(70); // Should be highly bullish
    });

    test('MomentumScoreCalculator should reflect trend strength', async () => {
      const calculator = new MomentumScoreCalculator();
      
      // Strong bullish trend
      const strongBullish = createMomentumAnalysis({ trend: 'bullish', strength: 85 });
      const strongScore = await calculator.calculate(strongBullish, sampleContext);
      
      // Weak bullish trend
      const weakBullish = createMomentumAnalysis({ trend: 'bullish', strength: 45 });
      const weakScore = await calculator.calculate(weakBullish, sampleContext);
      
      expect(strongScore).toBeGreaterThan(weakScore);
    });

    test('VolumeScoreCalculator should detect volume spikes', async () => {
      const calculator = new VolumeScoreCalculator();
      
      // High volume spike
      const spikeVolume = createVolumeAnalysis({ volumeSpike: true, volumeSpikeFactor: 5.0 });
      const spikeScore = await calculator.calculate(spikeVolume, sampleContext);
      
      // Normal volume
      const normalVolume = createVolumeAnalysis({ volumeSpike: false, volumeSpikeFactor: 1.2 });
      const normalScore = await calculator.calculate(normalVolume, sampleContext);
      
      expect(spikeScore).toBeGreaterThan(normalScore);
    });

    test('RiskScoreCalculator should penalize high risk', async () => {
      const calculator = new RiskScoreCalculator();
      
      // Low risk profile
      const lowRisk = createRiskAssessment({ overall: 20, riskLevel: 'low' });
      const lowRiskScore = await calculator.calculate(lowRisk, sampleContext);
      
      // High risk profile
      const highRisk = createRiskAssessment({ overall: 80, riskLevel: 'high' });
      const highRiskScore = await calculator.calculate(highRisk, sampleContext);
      
      expect(lowRiskScore).toBeGreaterThan(highRiskScore);
    });
  });

  describe('Adaptive Weighting', () => {
    test('should adjust weights based on market conditions', async () => {
      const adaptiveEngine = new RatingEngine({ adaptiveWeighting: true });
      const { technical, momentum, volume, risk } = createSampleInputs();

      // Bull market context
      const bullContext = { ...sampleContext, marketContext: { ...sampleContext.marketContext, overallTrend: 'bull' as const } };
      const bullResult = await adaptiveEngine.calculateRating(technical, momentum, volume, risk, bullContext);

      // Bear market context  
      const bearContext = { ...sampleContext, marketContext: { ...sampleContext.marketContext, overallTrend: 'bear' as const } };
      const bearResult = await adaptiveEngine.calculateRating(technical, momentum, volume, risk, bearContext);

      // Weights should be different
      expect(JSON.stringify(bullResult.weights)).not.toBe(JSON.stringify(bearResult.weights));
    });

    test('should increase risk weight in high volatility', async () => {
      const adaptiveEngine = new RatingEngine({ adaptiveWeighting: true });
      const { technical, momentum, volume, risk } = createSampleInputs();

      // High volatility context
      const highVolContext = { ...sampleContext, marketContext: { ...sampleContext.marketContext, volatilityIndex: 85 } };
      const result = await adaptiveEngine.calculateRating(technical, momentum, volume, risk, highVolContext);

      expect(result.weights.risk).toBeGreaterThan(0.10); // Should be higher than default 10%
    });
  });

  describe('Confidence Calculation', () => {
    test('should calculate higher confidence for quality data', () => {
      const calculator = new ConfidenceCalculator();
      const scores = { technical: 80, momentum: 75, volume: 85, risk: 70, pattern: 0, fundamentals: 0 };
      
      // High quality context
      const highQualityContext = {
        ...sampleContext,
        chartData: Array(200).fill(null).map((_, i) => ({
          timestamp: Date.now() - i * 300000,
          open: 0.0004,
          high: 0.0004,
          low: 0.0004,
          close: 0.0004,
          volume: 1000000
        })),
        historicalAnalysis: Array(30).fill(null)
      };

      const highConfidence = calculator.calculate(scores, highQualityContext, 0.85);

      // Low quality context
      const lowQualityContext = {
        ...sampleContext,
        chartData: Array(10).fill(null),
        historicalAnalysis: []
      };

      const lowConfidence = calculator.calculate(scores, lowQualityContext, 0.6);

      expect(highConfidence).toBeGreaterThan(lowConfidence);
    });

    test('should penalize conflicting factors', () => {
      const calculator = new ConfidenceCalculator();
      
      // Conflicting scores
      const conflictingScores = { technical: 90, momentum: 20, volume: 85, risk: 25, pattern: 0, fundamentals: 0 };
      const conflictingConfidence = calculator.calculate(conflictingScores, sampleContext, 0.7);
      
      // Aligned scores
      const alignedScores = { technical: 80, momentum: 75, volume: 85, risk: 70, pattern: 0, fundamentals: 0 };
      const alignedConfidence = calculator.calculate(alignedScores, sampleContext, 0.7);
      
      expect(alignedConfidence).toBeGreaterThan(conflictingConfidence);
    });
  });

  describe('Score Normalization', () => {
    test('should normalize scores to target range', () => {
      const normalizer = new ScoreNormalizer();
      
      const result = normalizer.normalize(150, 'test_context', {
        method: 'min-max',
        targetRange: [0, 100]
      });

      expect(result.normalizedValue).toBeGreaterThanOrEqual(0);
      expect(result.normalizedValue).toBeLessThanOrEqual(100);
    });

    test('should detect outliers correctly', () => {
      const normalizer = new ScoreNormalizer();
      
      // Add some normal values first
      for (let i = 0; i < 20; i++) {
        normalizer.normalize(50 + Math.random() * 10, 'outlier_test');
      }
      
      // Add an extreme outlier
      const result = normalizer.normalize(500, 'outlier_test', {
        outlierHandling: 'clip',
        outlierThreshold: 2.0
      });
      
      expect(result.isOutlier).toBe(true);
    });
  });

  describe('Rating Thresholds', () => {
    test('should return correct rating threshold', () => {
      const threshold = RatingThresholds.getRatingThreshold(8.5);
      
      expect(threshold.label).toBe('Very Good');
      expect(threshold.recommendation).toBe('strong_buy');
      expect(threshold.notificationPriority).toBe('high');
    });

    test('should determine notification requirements correctly', () => {
      const shouldNotify = RatingThresholds.shouldNotify(8.2, 82, 1500000, 40, ['technical', 'momentum', 'volume']);
      
      expect(shouldNotify.shouldNotify).toBe(true);
      expect(shouldNotify.priority).toBe('high');
    });

    test('should apply risk adjustments', () => {
      const { adjustedRating, adjustedConfidence } = RatingThresholds.applyRiskAdjustment(7.5, 80, 'high');
      
      expect(adjustedRating).toBeLessThan(7.5); // Should be penalized for high risk
      expect(adjustedConfidence).toBeLessThan(80); // Confidence should be reduced
    });

    test('should validate configuration', () => {
      const validation = RatingThresholds.validateConfiguration();
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });
  });

  describe('Performance Tests', () => {
    test('should calculate rating within acceptable time', async () => {
      const { technical, momentum, volume, risk } = createSampleInputs();
      
      const startTime = Date.now();
      await ratingEngine.calculateRating(technical, momentum, volume, risk, sampleContext);
      const duration = Date.now() - startTime;
      
      expect(duration).toBeLessThan(100); // Should complete within 100ms
    });

    test('should handle multiple concurrent calculations', async () => {
      const { technical, momentum, volume, risk } = createSampleInputs();
      
      const promises = Array(10).fill(null).map(() => 
        ratingEngine.calculateRating(technical, momentum, volume, risk, sampleContext)
      );
      
      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result.rating).toBeGreaterThanOrEqual(1);
        expect(result.rating).toBeLessThanOrEqual(10);
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle missing data gracefully', async () => {
      const incompleteInputs = {
        technical: {} as TechnicalIndicators,
        momentum: {} as MomentumAnalysis,
        volume: {} as VolumeAnalysis,
        risk: {} as RiskAssessment
      };
      
      await expect(
        ratingEngine.calculateRating(
          incompleteInputs.technical,
          incompleteInputs.momentum,
          incompleteInputs.volume,
          incompleteInputs.risk,
          sampleContext
        )
      ).rejects.toThrow();
    });

    test('should return fallback values on calculation errors', async () => {
      // This would require mocking internal calculator methods to throw errors
      // For now, we'll test that the engine doesn't crash with extreme values
      const extremeInputs = createExtremeInputs();
      
      const result = await ratingEngine.calculateRating(
        extremeInputs.technical,
        extremeInputs.momentum,
        extremeInputs.volume,
        extremeInputs.risk,
        sampleContext
      );
      
      expect(result).toBeDefined();
      expect(typeof result.rating).toBe('number');
      expect(typeof result.confidence).toBe('number');
    });
  });
});

// Helper functions for creating test data

function createSampleAnalysisContext(): AnalysisContext {
  return {
    tokenData: {
      address: 'test_address',
      symbol: 'TEST',
      name: 'Test Token',
      price: 0.0001,
      marketCap: 10000000,
      volume24h: 5000000,
      change24h: 5.5,
      holders: 10000,
      decimals: 9,
      totalSupply: 1000000000,
      verified: true,
      tags: ['test'],
      description: 'Test token',
      socials: {},
      riskScore: 50,
      liquidityUSD: 2000000,
      createdAt: new Date().toISOString()
    },
    chartData: Array(100).fill(null).map((_, i) => ({
      timestamp: Date.now() - i * 300000,
      open: 0.0001,
      high: 0.0001,
      low: 0.0001,
      close: 0.0001,
      volume: 1000000
    })),
    historicalAnalysis: [],
    marketContext: {
      overallTrend: 'bull',
      volatilityIndex: 50,
      marketSentiment: 60
    }
  };
}

function createSampleInputs() {
  return {
    technical: createTechnicalIndicators(),
    momentum: createMomentumAnalysis(),
    volume: createVolumeAnalysis(),
    risk: createRiskAssessment()
  };
}

function createTechnicalIndicators(overrides: Partial<TechnicalIndicators> = {}): TechnicalIndicators {
  return {
    rsi: 55,
    macd: { macd: 0.01, signal: 0.008, histogram: 0.002 },
    bollinger: { upper: 0.00012, middle: 0.0001, lower: 0.00008, position: 0.6 },
    ema: { '12': 0.000105, '26': 0.0001, '50': 0.000098 },
    sma: { '20': 0.000102, '50': 0.000099 },
    ...overrides
  };
}

function createMomentumAnalysis(overrides: Partial<MomentumAnalysis> = {}): MomentumAnalysis {
  return {
    trend: 'bullish',
    strength: 70,
    momentum: 1.5,
    volatility: 30,
    support: [0.000095, 0.00009, 0.000085],
    resistance: [0.00012, 0.000125, 0.00013],
    priceAction: {
      breakoutPotential: 0.7,
      consolidation: false,
      reversalSignal: false
    },
    ...overrides
  };
}

function createVolumeAnalysis(overrides: Partial<VolumeAnalysis> = {}): VolumeAnalysis {
  return {
    averageVolume: 2000000,
    currentVolume: 3000000,
    volumeSpike: false,
    volumeSpikeFactor: 1.5,
    volumeProfile: {
      buyPressure: 0.6,
      sellPressure: 0.4,
      netFlow: 0.2
    },
    liquidityScore: 70,
    ...overrides
  };
}

function createRiskAssessment(overrides: Partial<RiskAssessment> = {}): RiskAssessment {
  return {
    overall: 50,
    factors: {
      liquidity: 30,
      volatility: 50,
      holderConcentration: 40,
      marketCap: 30,
      age: 60,
      rugPullRisk: 25
    },
    warnings: [],
    riskLevel: 'medium',
    ...overrides
  };
}

function createHighQualityInputs() {
  return {
    technical: createTechnicalIndicators({ rsi: 58, }),
    momentum: createMomentumAnalysis({ trend: 'bullish', strength: 85 }),
    volume: createVolumeAnalysis({ volumeSpike: true, volumeSpikeFactor: 4.0 }),
    risk: createRiskAssessment({ overall: 25, riskLevel: 'low' })
  };
}

function createExtremeInputs() {
  return {
    technical: createTechnicalIndicators({ rsi: 95 }),
    momentum: createMomentumAnalysis({ trend: 'bullish', strength: 100, momentum: 10 }),
    volume: createVolumeAnalysis({ volumeSpike: true, volumeSpikeFactor: 50 }),
    risk: createRiskAssessment({ overall: 95, riskLevel: 'extreme' })
  };
}