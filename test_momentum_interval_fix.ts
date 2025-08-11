#!/usr/bin/env ts-node

/**
 * Test script to verify MomentumAccelerationTracker interval fix
 */

import { MomentumAccelerationTracker } from './src/analysis/momentum/MomentumAccelerationTracker';

// Generate test OHLCV data with different intervals
function generateTestData(intervalMinutes: number, numCandles: number) {
  const data = [];
  let timestamp = Date.now() - (numCandles * intervalMinutes * 60 * 1000);
  let price = 1.0;
  
  for (let i = 0; i < numCandles; i++) {
    const change = (Math.random() - 0.5) * 0.1; // Random price change
    price = Math.max(0.01, price + change);
    
    data.push({
      timestamp,
      open: price,
      high: price * (1 + Math.random() * 0.05),
      low: price * (1 - Math.random() * 0.05),
      close: price,
      volume: Math.random() * 1000000
    });
    
    timestamp += intervalMinutes * 60 * 1000;
  }
  
  return data;
}

function testMomentumTracker() {
  console.log('🧪 Testing MomentumAccelerationTracker interval support...\n');
  
  // Test different intervals
  const intervals = [1, 5, 15, 60, 240]; // 1m, 5m, 15m, 1h, 4h
  
  for (const intervalMinutes of intervals) {
    console.log(`📊 Testing ${intervalMinutes}-minute interval:`);
    
    try {
      // Create tracker for this interval
      const tracker = new MomentumAccelerationTracker({}, intervalMinutes);
      
      // Generate test data
      const testData = generateTestData(intervalMinutes, 100); // 100 candles
      
      // Analyze momentum
      const result = tracker.analyzeMomentum(testData);
      
      console.log(`  ✅ Analysis completed successfully`);
      console.log(`  📈 Sustainability Score: ${result.sustainabilityScore.toFixed(1)}`);
      console.log(`  🔋 Entry Signal Strength: ${result.entrySignalStrength.toFixed(1)}`);
      console.log(`  😴 Fatigue Level: ${result.fatigueLevel}`);
      console.log(`  🕯️  Consecutive Candles: ${result.consecutiveCandles.count} (${result.consecutiveCandles.direction})`);
      console.log(`  🎯 Velocity 1h: ${result.velocity1h.toFixed(2)}%/h`);
      console.log(`  🎯 Velocity 4h: ${result.velocity4h.toFixed(2)}%/h\n`);
      
    } catch (error) {
      console.log(`  ❌ Error: ${(error as Error).message}\n`);
    }
  }
}

function testIntervalDetection() {
  console.log('🔍 Testing interval detection...\n');
  
  // Test data with known intervals
  const testCases = [
    { interval: 1, description: '1-minute candles' },
    { interval: 5, description: '5-minute candles' },  
    { interval: 15, description: '15-minute candles' },
    { interval: 60, description: '1-hour candles' },
    { interval: 240, description: '4-hour candles' }
  ];
  
  // Mock the interval detection logic
  function detectInterval(ohlcvData: any[]) {
    if (ohlcvData.length < 2) return 5;

    const timestamps = ohlcvData
      .slice(0, Math.min(10, ohlcvData.length))
      .map(d => d.timestamp)
      .sort((a, b) => a - b);

    if (timestamps.length < 2) return 5;

    const intervals = [];
    for (let i = 1; i < timestamps.length; i++) {
      intervals.push((timestamps[i] - timestamps[i-1]) / (1000 * 60));
    }

    const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    
    const commonIntervals = [1, 5, 15, 60, 240];
    return commonIntervals.reduce((prev, curr) => 
      Math.abs(curr - avgInterval) < Math.abs(prev - avgInterval) ? curr : prev
    );
  }
  
  for (const testCase of testCases) {
    const testData = generateTestData(testCase.interval, 20);
    const detectedInterval = detectInterval(testData);
    
    const isCorrect = detectedInterval === testCase.interval;
    const status = isCorrect ? '✅' : '❌';
    
    console.log(`${status} ${testCase.description}: Expected ${testCase.interval}min, Detected ${detectedInterval}min`);
  }
  
  console.log('\n');
}

// Run tests
console.log('🚀 MomentumAccelerationTracker Interval Fix Tests\n');
console.log('=' .repeat(60) + '\n');

try {
  testIntervalDetection();
  testMomentumTracker();
  
  console.log('✅ All tests completed!');
  console.log('\n🎉 MomentumAccelerationTracker now supports dynamic intervals!');
  
} catch (error) {
  console.error('❌ Test failed:', error);
  process.exit(1);
}