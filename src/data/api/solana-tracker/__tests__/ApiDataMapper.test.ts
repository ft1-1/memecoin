/**
 * Tests for ApiDataMapper
 * 
 * Verifies proper transformation of Solana Tracker API responses
 * to rating engine expected formats.
 */

import { ApiDataMapper } from '../ApiDataMapper';
import { SolanaTrackerTokenResponse } from '../types';

describe('ApiDataMapper', () => {
  let mapper: ApiDataMapper;
  let mockTokenResponse: SolanaTrackerTokenResponse;

  beforeEach(() => {
    mapper = new ApiDataMapper();
    
    // Create comprehensive mock response
    mockTokenResponse = {
      token: {
        name: 'Test Memecoin',
        symbol: 'TEST',
        mint: 'ABC123DEF456',
        decimals: 9,
        description: 'A test memecoin',
        image: 'https://example.com/test.png',
        creation: {
          creator: 'CreatorAddress123',
          created_tx: 'TxHash123',
          created_time: 1640995200 // Jan 1, 2022
        }
      },
      pools: [{
        poolId: 'pool123',
        liquidity: {
          quote: 100000,
          usd: 100000
        },
        price: {
          quote: 0.001,
          usd: 0.001
        },
        tokenSupply: 1000000000,
        lpBurn: 0,
        tokenAddress: 'ABC123DEF456',
        marketCap: {
          quote: 1000000,
          usd: 1000000
        },
        market: 'test-market',
        quoteToken: 'SOL',
        decimals: 9,
        lastUpdated: 1640995200,
        txns: {
          buys: 150,
          sells: 50,
          total: 200,
          volume: 50000,
          volume24h: 75000
        }
      }],
      events: {
        '1h': { priceChangePercentage: 5.5 },
        '24h': { priceChangePercentage: -2.3 }
      },
      risk: {
        score: 7, // 0-10 scale (API format)
        rugged: false,
        risks: ['high_insider_percentage'],
        top10: 45,
        jupiterVerified: true
      },
      holders: 1250,
      buys: 150,
      sells: 50,
      txns: 200
    };
  });

  describe('mapTokenResponse', () => {
    it('should transform basic token data correctly', () => {
      const result = mapper.mapTokenResponse(mockTokenResponse);

      expect(result.address).toBe('ABC123DEF456');
      expect(result.symbol).toBe('TEST');
      expect(result.name).toBe('Test Memecoin');
      expect(result.decimals).toBe(9);
      expect(result.marketCap).toBe(1000000);
      expect(result.price).toBe(0.001);
      expect(result.priceChange24h).toBe(-2.3);
      expect(result.volume24h).toBe(75000);
      expect(result.holders).toBe(1250);
    });

    it('should scale risk score from 0-10 to 0-100', () => {
      const result = mapper.mapTokenResponse(mockTokenResponse);
      
      // API risk score of 7 should become 70 (7 * 10)
      expect(result.riskScore).toBe(70);
      expect(result.riskLevel).toBe('medium'); // 70 is medium risk
    });

    it('should handle missing risk data gracefully', () => {
      const responseWithoutRisk = { ...mockTokenResponse, risk: undefined };
      const result = mapper.mapTokenResponse(responseWithoutRisk);

      expect(result.riskScore).toBe(50); // Default medium risk
      expect(result.riskLevel).toBe('medium');
    });

    it('should extract tags correctly', () => {
      const result = mapper.mapTokenResponse(mockTokenResponse);
      
      expect(result.tags).toContain('verified');
      expect(result.tags).toContain('risky');
      expect(result.tags).not.toContain('rugged');
    });
  });

  describe('mapVolumeAnalysis', () => {
    it('should transform volume data correctly', () => {
      const result = mapper.mapVolumeAnalysis(mockTokenResponse.pools, mockTokenResponse);

      expect(result.averageVolume).toBe(75000); // 24h volume as baseline
      expect(result.currentVolume).toBe(50000);
      expect(result.volumeSpike).toBe(false); // 50k < 2x 75k
      expect(result.volumeSpikeFactor).toBeCloseTo(0.67, 2);
    });

    it('should calculate buy/sell pressure correctly', () => {
      const result = mapper.mapVolumeAnalysis(mockTokenResponse.pools, mockTokenResponse);

      // 150 buys out of 200 total = 75% buy pressure
      expect(result.volumeProfile.buyPressure).toBe(75);
      // 50 sells out of 200 total = 25% sell pressure  
      expect(result.volumeProfile.sellPressure).toBe(25);
      // Net flow = 75 - 25 = 50
      expect(result.volumeProfile.netFlow).toBe(50);
    });

    it('should calculate liquidity score based on liquidity and volume', () => {
      const result = mapper.mapVolumeAnalysis(mockTokenResponse.pools, mockTokenResponse);

      // Should be calculated from $100k liquidity and $75k volume
      expect(result.liquidityScore).toBeGreaterThan(0);
      expect(result.liquidityScore).toBeLessThanOrEqual(100);
    });

    it('should handle missing pool data gracefully', () => {
      const result = mapper.mapVolumeAnalysis([], mockTokenResponse);

      expect(result.averageVolume).toBe(0);
      expect(result.currentVolume).toBe(0);
      expect(result.volumeSpike).toBe(false);
      expect(result.volumeProfile.buyPressure).toBe(50);
      expect(result.volumeProfile.sellPressure).toBe(50);
      expect(result.liquidityScore).toBe(0);
    });
  });

  describe('mapRiskAssessment', () => {
    it('should transform risk score correctly (inverted)', () => {
      const result = mapper.mapRiskAssessment(
        mockTokenResponse.risk, 
        mockTokenResponse.pools, 
        1000000
      );

      // API score of 7 becomes 70 (scaled), then inverted to 30 for risk assessment
      // (0 = low risk, 100 = high risk in our system)
      expect(result.overall).toBe(30); // 100 - 70 = 30
      expect(result.riskLevel).toBe('low'); // 30 is low risk
    });

    it('should calculate individual risk factors', () => {
      const result = mapper.mapRiskAssessment(
        mockTokenResponse.risk, 
        mockTokenResponse.pools, 
        1000000
      );

      expect(result.factors.liquidity).toBeDefined();
      expect(result.factors.volatility).toBeDefined();
      expect(result.factors.holderConcentration).toBeDefined();
      expect(result.factors.marketCap).toBeDefined();
      expect(result.factors.age).toBeDefined();
      expect(result.factors.rugPullRisk).toBeDefined();

      // All factors should be 0-100
      Object.values(result.factors).forEach(factor => {
        expect(factor).toBeGreaterThanOrEqual(0);
        expect(factor).toBeLessThanOrEqual(100);
      });
    });

    it('should generate appropriate warnings', () => {
      const result = mapper.mapRiskAssessment(
        mockTokenResponse.risk, 
        mockTokenResponse.pools, 
        1000000
      );

      expect(Array.isArray(result.warnings)).toBe(true);
      
      // Should include warning about risk factors from API
      const hasRiskFactorWarning = result.warnings.some(warning => 
        warning.includes('high insider percentage')
      );
      expect(hasRiskFactorWarning).toBe(true);
    });

    it('should handle rugged tokens', () => {
      const ruggedResponse = {
        ...mockTokenResponse.risk!,
        rugged: true,
        score: 0
      };

      const result = mapper.mapRiskAssessment(
        ruggedResponse, 
        mockTokenResponse.pools, 
        1000000
      );

      expect(result.overall).toBe(100); // 100 - 0 = 100 (maximum risk)
      expect(result.riskLevel).toBe('extreme');
      expect(result.warnings).toContain('Token has been flagged as rugged');
      expect(result.factors.rugPullRisk).toBe(100);
    });
  });

  describe('mapCompleteTokenData', () => {
    it('should create complete mapped data structure', () => {
      const result = mapper.mapCompleteTokenData(mockTokenResponse);

      expect(result.tokenData).toBeDefined();
      expect(result.volumeAnalysis).toBeDefined();
      expect(result.riskAssessment).toBeDefined();
      
      // Verify data consistency
      expect(result.tokenData.address).toBe('ABC123DEF456');
      expect(result.tokenData.marketCap).toBe(1000000);
      expect(result.riskAssessment.overall).toBeLessThan(100); // Not rugged
      expect(result.volumeAnalysis.averageVolume).toBeGreaterThan(0);
    });

    it('should include chart data when provided', () => {
      const chartResponse = {
        oclhv: [
          {
            open: 0.001,
            close: 0.0011,
            low: 0.0009,
            high: 0.0012,
            volume: 1000,
            time: 1640995200
          }
        ]
      };

      const result = mapper.mapCompleteTokenData(mockTokenResponse, chartResponse);
      
      expect(result.chartData).toBeDefined();
      expect(result.chartData!).toHaveLength(1);
      expect(result.chartData![0].timestamp).toBe(1640995200);
      expect(result.chartData![0].open).toBe(0.001);
      expect(result.chartData![0].close).toBe(0.0011);
    });
  });

  describe('createAnalysisContext', () => {
    it('should create valid analysis context', () => {
      const mappedData = mapper.mapCompleteTokenData(mockTokenResponse);
      const context = mapper.createAnalysisContext(mappedData);

      expect(context.tokenData).toBeDefined();
      expect(context.chartData).toBeDefined();
      expect(context.historicalAnalysis).toBeDefined();
      expect(context.marketContext).toBeDefined();

      // Verify structure
      expect(context.tokenData.address).toBe('ABC123DEF456');
      expect(context.marketContext.overallTrend).toBe('sideways');
      expect(context.marketContext.volatilityIndex).toBe(50);
      expect(context.marketContext.marketSentiment).toBe(50);
    });
  });
});