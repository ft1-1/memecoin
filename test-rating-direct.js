const { RatingEngine } = require('./dist/analysis/rating/RatingEngine.js');
const { DatabaseManager } = require('./dist/database/DatabaseManager.js');

console.log('🧪 Testing Rating Engine directly...\n');

async function testRating() {
  const db = new DatabaseManager('./database/data/test.db');
  await db.initialize();
  
  const ratingEngine = new RatingEngine({}, db);
  
  // Test data
  const technicalIndicators = {
    rsi: 65,
    macd: { macd: 0.05, signal: 0.03, histogram: 0.02 },
    bollinger: { upper: 1.2, middle: 1.0, lower: 0.8, position: 0.7 },
    ema: { short: 1.1, long: 1.0 },
    sma: { short: 1.1, long: 1.0 },
    volume: { ratio: 1.5, trend: 'increasing' }
  };
  
  const momentum = {
    trend: 'bullish',
    strength: 75,
    breakoutPotential: 80,
    trendDuration: 5
  };
  
  const volume = {
    currentVolume: 1000000,
    averageVolume: 750000,
    volumeRatio: 1.33,
    buyVolume: 600000,
    sellVolume: 400000,
    liquidityScore: 70
  };
  
  const risk = {
    volatility: 'medium',
    rugPullRisk: 'low',
    liquidityRisk: 'low',
    overallRisk: 30
  };
  
  const context = {
    tokenData: {
      address: 'test-token',
      symbol: 'TEST',
      name: 'Test Token',
      price: 1.0,
      marketCap: 10000000
    },
    marketContext: {
      overallTrend: 'bullish',
      volatilityIndex: 45,
      marketSentiment: 65
    }
  };
  
  console.log('Starting rating calculation...');
  const startTime = Date.now();
  
  try {
    const result = await ratingEngine.calculateRating(
      technicalIndicators,
      momentum,
      volume,
      risk,
      context
    );
    
    const duration = Date.now() - startTime;
    console.log(`\n✅ Rating calculation completed in ${duration}ms`);
    console.log('\nResult:', {
      rating: result.rating.toFixed(1),
      confidence: result.confidence.toFixed(1),
      recommendation: result.recommendation,
      alerts: result.alerts
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.log(`\n❌ Rating calculation failed after ${duration}ms`);
    console.log('Error:', error.message);
  } finally {
    await db.close();
  }
}

testRating().catch(console.error);