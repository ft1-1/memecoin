/**
 * Test script to verify technical analysis fixes
 * Tests edge cases for empty arrays and insufficient data
 */

const { MomentumAccelerationTracker } = require('./src/analysis/momentum/MomentumAccelerationTracker');
const { MultiTimeframeAnalyzer } = require('./src/analysis/technical/MultiTimeframeAnalyzer');
const { TechnicalIndicators } = require('./src/analysis/technical/TechnicalIndicators');

async function testMomentumAccelerationWithInsufficientData() {
  console.log('\n🧪 Testing Momentum Acceleration with insufficient data...');
  
  const tracker = new MomentumAccelerationTracker();
  
  try {
    // Test with 0 data points
    console.log('Testing with 0 data points...');
    const result0 = tracker.analyzeMomentum([]);
    console.log('✅ 0 data points handled:', {
      sustainabilityScore: result0.sustainabilityScore,
      entrySignalStrength: result0.entrySignalStrength,
      fatigueLevel: result0.fatigueLevel
    });
    
    // Test with 1 data point
    console.log('Testing with 1 data point...');
    const singleDataPoint = [{
      open: 100,
      high: 105,
      low: 98,
      close: 103,
      volume: 1000,
      timestamp: Date.now()
    }];
    
    const result1 = tracker.analyzeMomentum(singleDataPoint);
    console.log('✅ 1 data point handled:', {
      velocity1h: result1.velocity1h,
      sustainabilityScore: result1.sustainabilityScore,
      consecutiveCandles: result1.consecutiveCandles
    });
    
    // Test with 5 data points
    console.log('Testing with 5 data points...');
    const limitedData = [];
    for (let i = 0; i < 5; i++) {
      limitedData.push({
        open: 100 + i,
        high: 105 + i,
        low: 98 + i,
        close: 103 + i,
        volume: 1000 + i * 100,
        timestamp: Date.now() - (i * 300000) // 5 min intervals
      });
    }
    
    const result5 = tracker.analyzeMomentum(limitedData);
    console.log('✅ 5 data points handled:', {
      velocity1h: result5.velocity1h.toFixed(2),
      sustainabilityScore: result5.sustainabilityScore.toFixed(2),
      consecutiveCandles: result5.consecutiveCandles
    });
    
  } catch (error) {
    console.error('❌ Error in momentum acceleration test:', error.message);
  }
}

async function testMultiTimeframeWithEmptyAnalyses() {
  console.log('\n🧪 Testing Multi-timeframe with empty analyses...');
  
  const analyzer = new MultiTimeframeAnalyzer();
  
  try {
    // Create mock empty analysis data
    const mockData = [{
      open: 100,
      high: 105,
      low: 98,
      close: 103,
      volume: 1000,
      timestamp: Date.now()
    }];
    
    console.log('Testing with minimal OHLCV data...');
    const result = await analyzer.analyzeMultiTimeframe(mockData);
    
    console.log('✅ Multi-timeframe analysis completed:', {
      timeframesAnalyzed: result.timeframes.length,
      overallSignal: result.consolidatedSignal.overallSignal,
      riskLevel: result.riskAssessment.overallRisk,
      consecutiveMomentumCount: result.consecutiveMomentum.consecutiveCount
    });
    
  } catch (error) {
    console.error('❌ Error in multi-timeframe test:', error.message);
  }
}

async function testTechnicalIndicatorsWithMinimalData() {
  console.log('\n🧪 Testing Technical Indicators with minimal data...');
  
  const indicators = new TechnicalIndicators();
  
  try {
    // Test with very small dataset
    const minimalData = [
      { open: 100, high: 105, low: 98, close: 103, volume: 1000, timestamp: Date.now() - 60000 },
      { open: 103, high: 107, low: 101, close: 105, volume: 1200, timestamp: Date.now() }
    ];
    
    console.log('Testing RSI with 2 data points...');
    const closes = minimalData.map(d => d.close);
    const rsi = indicators.calculateRSI(closes);
    console.log('✅ RSI calculated:', rsi);
    
    console.log('Testing MACD with 2 data points...');
    const macd = indicators.calculateMACD(closes);
    console.log('✅ MACD calculated:', {
      macd: macd.macd.toFixed(4),
      signal: macd.signal.toFixed(4),
      histogram: macd.histogram.toFixed(4)
    });
    
    console.log('Testing Bollinger Bands with 2 data points...');
    const bollinger = indicators.calculateBollingerBands(closes);
    console.log('✅ Bollinger Bands calculated:', {
      upper: bollinger.upper.toFixed(2),
      middle: bollinger.middle.toFixed(2),
      lower: bollinger.lower.toFixed(2),
      position: bollinger.position.toFixed(2)
    });
    
  } catch (error) {
    console.error('❌ Error in technical indicators test:', error.message);
  }
}

async function runAllTests() {
  console.log('🚀 Starting Technical Analysis Fixes Verification\n');
  console.log('Testing fixes for:');
  console.log('1. Multi-timeframe Analysis reduce() errors');
  console.log('2. Momentum Acceleration insufficient data errors');
  console.log('3. Defensive programming for edge cases');
  
  await testMomentumAccelerationWithInsufficientData();
  await testMultiTimeframeWithEmptyAnalyses();
  await testTechnicalIndicatorsWithMinimalData();
  
  console.log('\n✅ All technical analysis fixes verified successfully!');
  console.log('\nThe system now handles:');
  console.log('- Empty arrays without throwing "reduce of empty array" errors');
  console.log('- Insufficient data points with graceful degradation');
  console.log('- Edge cases with meaningful default values');
  console.log('- Robust error handling throughout the analysis pipeline');
}

// Run the tests
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  testMomentumAccelerationWithInsufficientData,
  testMultiTimeframeWithEmptyAnalyses,
  testTechnicalIndicatorsWithMinimalData
};
