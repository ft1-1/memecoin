/**
 * ApiDataMapper Usage Examples
 * 
 * Demonstrates how to use the ApiDataMapper to transform Solana Tracker API
 * responses for the rating engine.
 */

import { ApiDataMapper } from '../ApiDataMapper';
import { SolanaTrackerClient } from '../SolanaTrackerClient';
import { RatingEngine } from '../../../analysis/rating/RatingEngine';
import { TechnicalAnalysisEngine } from '../../../analysis/technical/TechnicalAnalysisEngine';
import { Logger } from '../../../utils/Logger';

/**
 * Example 1: Basic Token Data Transformation
 */
export async function basicTokenTransformation() {
  const logger = Logger.getInstance();
  const mapper = new ApiDataMapper();
  
  // Simulate getting token data from Solana Tracker API
  const client = new SolanaTrackerClient({
    apiKey: 'your-api-key',
    baseUrl: 'https://data.solanatracker.io'
  }, logger);
  
  try {
    // Get token details from API
    const tokenAddress = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'; // USDC example
    const tokenResponse = await client.getTokenDetails(tokenAddress);
    
    // Transform API response to our internal format
    const mappedData = mapper.mapCompleteTokenData(tokenResponse);
    
    logger.info('Token data transformed', {
      original: {
        riskScore: tokenResponse.risk?.score, // 0-10 scale
        txns: tokenResponse.pools[0]?.txns
      },
      transformed: {
        riskScore: mappedData.tokenData.riskScore, // 0-100 scale
        volumeAnalysis: mappedData.volumeAnalysis,
        riskLevel: mappedData.riskAssessment.riskLevel
      }
    });
    
    return mappedData;
    
  } catch (error) {
    logger.error('Failed to transform token data', { error });
    throw error;
  }
}

/**
 * Example 2: Complete Analysis Pipeline
 */
export async function completeAnalysisPipeline() {
  const logger = Logger.getInstance();
  const mapper = new ApiDataMapper();
  const ratingEngine = new RatingEngine();
  const technicalEngine = new TechnicalAnalysisEngine();
  
  const client = new SolanaTrackerClient({
    apiKey: 'your-api-key',
    baseUrl: 'https://data.solanatracker.io'
  }, logger);
  
  try {
    const tokenAddress = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
    
    // Step 1: Get data from API
    const [tokenResponse, chartResponse] = await Promise.all([
      client.getTokenDetails(tokenAddress),
      client.getChartData({
        token: tokenAddress,
        interval: '1h',
        limit: 100
      })
    ]);
    
    // Step 2: Transform API data
    const mappedData = mapper.mapCompleteTokenData(tokenResponse, chartResponse);
    const analysisContext = mapper.createAnalysisContext(mappedData);
    
    // Step 3: Perform technical analysis
    const technicalIndicators = await technicalEngine.calculateIndicators(
      analysisContext.chartData
    );
    
    const momentum = await technicalEngine.analyzeMomentum(
      analysisContext.chartData,
      technicalIndicators
    );
    
    // Step 4: Calculate rating using transformed data
    const rating = await ratingEngine.calculateRating(
      technicalIndicators,
      momentum,
      mappedData.volumeAnalysis, // Properly transformed volume data
      mappedData.riskAssessment, // Properly scaled risk data (0-100)
      analysisContext
    );
    
    logger.info('Complete analysis completed', {
      tokenAddress,
      rating: rating.rating,
      confidence: rating.confidence,
      recommendation: rating.recommendation,
      components: rating.components
    });
    
    return {
      mappedData,
      rating,
      technicalIndicators,
      momentum
    };
    
  } catch (error) {
    logger.error('Complete analysis pipeline failed', { error });
    throw error;
  }
}

/**
 * Example 3: Batch Processing with Transformation
 */
export async function batchProcessingExample() {
  const logger = Logger.getInstance();
  const mapper = new ApiDataMapper();
  
  const client = new SolanaTrackerClient({
    apiKey: 'your-api-key',
    baseUrl: 'https://data.solanatracker.io'
  }, logger);
  
  try {
    // Get trending tokens
    const trending = await client.getTrendingTokensFiltered('24h', {
      min: 5_000_000,  // $5M
      max: 50_000_000  // $50M
    });
    
    // Transform all tokens in batch
    const transformedTokens = await Promise.all(
      trending.tokens.slice(0, 10).map(async (token) => {
        try {
          // Get detailed data for each token
          const tokenResponse = await client.getTokenDetails(token.address);
          
          // Transform to our format
          const mappedData = mapper.mapCompleteTokenData(tokenResponse);
          
          return {
            address: token.address,
            symbol: token.symbol,
            mappedData,
            transformationSuccess: true
          };
          
        } catch (error) {
          logger.warn('Failed to transform token', {
            address: token.address,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          
          return {
            address: token.address,
            symbol: token.symbol,
            mappedData: null,
            transformationSuccess: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      })
    );
    
    // Summary of transformations
    const successful = transformedTokens.filter(t => t.transformationSuccess);
    const failed = transformedTokens.filter(t => !t.transformationSuccess);
    
    logger.info('Batch transformation completed', {
      total: transformedTokens.length,
      successful: successful.length,
      failed: failed.length,
      successRate: `${((successful.length / transformedTokens.length) * 100).toFixed(1)}%`
    });
    
    return {
      successful: successful.map(t => t.mappedData!),
      failed: failed.map(t => ({ address: t.address, error: t.error }))
    };
    
  } catch (error) {
    logger.error('Batch processing failed', { error });
    throw error;
  }
}

/**
 * Example 4: Risk Score Validation
 */
export async function riskScoreValidationExample() {
  const logger = Logger.getInstance();
  const mapper = new ApiDataMapper();
  
  // Example API responses with different risk scores
  const testCases = [
    { apiScore: 0, expectedRange: [90, 100], level: 'extreme' as const },
    { apiScore: 3, expectedRange: [60, 80], level: 'high' as const },
    { apiScore: 5, expectedRange: [40, 60], level: 'medium' as const },
    { apiScore: 7, expectedRange: [20, 40], level: 'low' as const },
    { apiScore: 10, expectedRange: [0, 20], level: 'low' as const }
  ];
  
  testCases.forEach(testCase => {
    const mockResponse = {
      token: {
        name: 'Test Token',
        symbol: 'TEST',
        mint: 'TestAddress123',
        decimals: 9
      },
      pools: [{
        poolId: 'test-pool',
        liquidity: { quote: 100000, usd: 100000 },
        price: { quote: 0.001, usd: 0.001 },
        tokenSupply: 1000000000,
        lpBurn: 0,
        tokenAddress: 'TestAddress123',
        marketCap: { quote: 10000000, usd: 10000000 },
        market: 'test',
        quoteToken: 'SOL',
        decimals: 9,
        lastUpdated: Date.now() / 1000,
        txns: { buys: 100, sells: 50, total: 150, volume: 50000, volume24h: 75000 }
      }],
      risk: {
        score: testCase.apiScore,
        rugged: false,
        risks: [],
        top10: 30
      },
      holders: 1000
    };
    
    const mappedData = mapper.mapCompleteTokenData(mockResponse);
    const overallRisk = mappedData.riskAssessment.overall;
    
    logger.info('Risk score transformation validation', {
      apiScore: testCase.apiScore,
      transformedScore: overallRisk,
      expectedRange: testCase.expectedRange,
      actualLevel: mappedData.riskAssessment.riskLevel,
      expectedLevel: testCase.level,
      withinExpectedRange: overallRisk >= testCase.expectedRange[0] && 
                          overallRisk <= testCase.expectedRange[1],
      levelMatch: mappedData.riskAssessment.riskLevel === testCase.level
    });
  });
}

/**
 * Example 5: Volume Analysis Transformation
 */
export async function volumeAnalysisExample() {
  const logger = Logger.getInstance();
  const mapper = new ApiDataMapper();
  
  // Mock response with different volume scenarios
  const scenarios = [
    {
      name: 'High Volume Spike',
      txns: { buys: 500, sells: 100, total: 600, volume: 200000, volume24h: 100000 }
    },
    {
      name: 'Balanced Trading',
      txns: { buys: 300, sells: 300, total: 600, volume: 50000, volume24h: 50000 }
    },
    {
      name: 'Sell Pressure',
      txns: { buys: 100, sells: 500, total: 600, volume: 30000, volume24h: 60000 }
    }
  ];
  
  scenarios.forEach(scenario => {
    const mockResponse = {
      token: {
        name: 'Test Token',
        symbol: 'TEST',
        mint: 'TestAddress123',
        decimals: 9
      },
      pools: [{
        poolId: 'test-pool',
        liquidity: { quote: 100000, usd: 100000 },
        price: { quote: 0.001, usd: 0.001 },
        tokenSupply: 1000000000,
        lpBurn: 0,
        tokenAddress: 'TestAddress123',
        marketCap: { quote: 10000000, usd: 10000000 },
        market: 'test',
        quoteToken: 'SOL',
        decimals: 9,
        lastUpdated: Date.now() / 1000,
        txns: scenario.txns
      }],
      holders: 1000
    };
    
    const mappedData = mapper.mapCompleteTokenData(mockResponse);
    const volumeAnalysis = mappedData.volumeAnalysis;
    
    logger.info('Volume analysis transformation', {
      scenario: scenario.name,
      original: scenario.txns,
      transformed: {
        volumeSpike: volumeAnalysis.volumeSpike,
        volumeSpikeFactor: volumeAnalysis.volumeSpikeFactor,
        buyPressure: volumeAnalysis.volumeProfile.buyPressure,
        sellPressure: volumeAnalysis.volumeProfile.sellPressure,
        netFlow: volumeAnalysis.volumeProfile.netFlow,
        liquidityScore: volumeAnalysis.liquidityScore
      }
    });
  });
}

// Export all examples for easy testing
export const examples = {
  basicTokenTransformation,
  completeAnalysisPipeline,
  batchProcessingExample,
  riskScoreValidationExample,
  volumeAnalysisExample
};