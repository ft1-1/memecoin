# Testing Plan: Momentum Detection Improvements

## Overview
Comprehensive testing strategy to validate all momentum detection improvements and ensure they catch early token movements effectively.

## Test Categories

### 1. Unit Tests - Component Level

#### MomentumAccelerationTracker Tests
```javascript
// test-momentum-interval-awareness.js
describe('MomentumAccelerationTracker with Dynamic Intervals', () => {
  test('correctly calculates velocity with 1m candles', async () => {
    const tracker = new MomentumAccelerationTracker(1); // 1-minute intervals
    // Feed 1m candle data
    // Verify velocity calculations match expected values
  });

  test('correctly calculates velocity with 5m candles', async () => {
    const tracker = new MomentumAccelerationTracker(5); // 5-minute intervals
    // Feed 5m aggregated data
    // Verify calculations account for 5x time difference
  });

  test('handles mixed interval data gracefully', async () => {
    // Test error handling when wrong interval data is provided
  });
});
```

#### ChartDataAggregator Tests
```javascript
// test-aggregation-accuracy.js
describe('ChartDataAggregator Multi-Timeframe', () => {
  test('aggregates 1m to 5m correctly', async () => {
    const raw1m = generateTestData('1m', 300); // 5 hours of 1m data
    const aggregated5m = aggregator.aggregate(raw1m, 5);
    // Verify OHLCV values match manual calculations
  });

  test('maintains volume consistency across aggregations', async () => {
    // Sum of 1m volumes should equal 5m aggregated volume
  });

  test('handles gaps in 1m data', async () => {
    // Test with missing candles
  });
});
```

#### DatabaseManager Tests
```javascript
// test-database-persistence.js
describe('DatabaseManager Momentum Persistence', () => {
  test('saves and retrieves momentum records', async () => {
    const record = {
      tokenAddress: 'test123',
      timestamp: new Date(),
      momentumScore: 8.5,
      streakCount: 3
    };
    await dbManager.saveMomentumRecord(record);
    const retrieved = await dbManager.getRecentMomentum('test123', 1);
    expect(retrieved[0]).toEqual(record);
  });

  test('cleans old records beyond retention period', async () => {
    // Insert old records
    await dbManager.cleanOldRecords(24);
    // Verify only recent records remain
  });

  test('handles concurrent writes safely', async () => {
    // Test with multiple simultaneous momentum updates
  });
});
```

### 2. Integration Tests - Module Level

#### Workflow Integration Test
```javascript
// test-workflow-integration.js
describe('AnalysisWorkflow with Single Data Pull', () => {
  test('fetches 1m data once and creates all timeframes', async () => {
    const mockAPI = createMockSolanaTracker();
    const workflow = new AnalysisWorkflow(mockAPI);
    
    // Spy on API calls
    const apiSpy = jest.spyOn(mockAPI, 'getChartData');
    
    await workflow.analyzeToken(testToken);
    
    // Should only call API once with 1m interval
    expect(apiSpy).toHaveBeenCalledTimes(1);
    expect(apiSpy).toHaveBeenCalledWith(testToken.address, '1m', expect.any(Number));
  });

  test('all analysis modules receive consistent multi-timeframe data', async () => {
    // Verify technical, momentum, and rating modules get same aggregated data
  });
});
```

#### Consecutive Momentum Integration
```javascript
// test-consecutive-momentum-integration.js
describe('Consecutive Momentum with Persistence', () => {
  test('momentum streak persists across analysis runs', async () => {
    // Run 1: Detect initial momentum
    await orchestrator.analyzeTokens([testToken]);
    
    // Run 2: Should remember previous momentum
    await new Promise(resolve => setTimeout(resolve, 300000)); // 5 min
    const result = await orchestrator.analyzeTokens([testToken]);
    
    // Verify streak bonus applied
    expect(result.rating).toBeGreaterThan(baseRating);
  });
});
```

### 3. End-to-End Tests - System Level

#### Early Movement Detection Test
```javascript
// test-early-detection.js
describe('Early Movement Detection', () => {
  test('catches token starting to move on 5m timeframe', async () => {
    // Simulate gradual price increase pattern
    const testData = generateEarlyMovementPattern();
    
    // System should detect and rate highly before major pump
    const alerts = await runFullAnalysis(testData);
    
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts[0].rating).toBeGreaterThanOrEqual(7);
    expect(alerts[0].detectedAt).toBeLessThan('15m'); // Caught within 15 min
  });
});
```

#### Volume Surge Detection Test
```javascript
// test-volume-surge-thresholds.js
describe('Configurable Volume Thresholds', () => {
  test('detects 2.5x volume surge with 2 period persistence', async () => {
    process.env.VOLUME_SURGE_MULTIPLIER = '2.5';
    process.env.VOLUME_SURGE_PERIODS = '2';
    
    const volumePattern = generateVolumeSurgePattern(2.5);
    const signal = await entrySignalGenerator.analyze(volumePattern);
    
    expect(signal.volumeSurgeDetected).toBe(true);
  });

  test('compares detection timing: 2.5x vs 3x threshold', async () => {
    // Run same data with different thresholds
    // Verify 2.5x catches movement earlier
  });
});
```

### 4. Performance Tests

#### API Call Reduction Test
```javascript
// test-api-optimization.js
describe('API Call Optimization', () => {
  test('reduces API calls by 80%', async () => {
    const tokens = generateTestTokens(10);
    
    // Old method
    const oldAPICalls = await countAPICallsOldMethod(tokens);
    
    // New method
    const newAPICalls = await countAPICallsNewMethod(tokens);
    
    const reduction = (oldAPICalls - newAPICalls) / oldAPICalls;
    expect(reduction).toBeGreaterThanOrEqual(0.8);
  });
});
```

#### Processing Speed Test
```javascript
// test-processing-performance.js
describe('Multi-timeframe Processing Performance', () => {
  test('processes 50 tokens in under 30 seconds', async () => {
    const tokens = generateTestTokens(50);
    const startTime = Date.now();
    
    await orchestrator.analyzeTokens(tokens);
    
    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(30000);
  });
});
```

### 5. Regression Tests

#### Backward Compatibility Tests
```javascript
// test-backward-compatibility.js
describe('Backward Compatibility', () => {
  test('existing configurations still work', async () => {
    // Run with old config format
    // Verify system functions correctly
  });

  test('handles missing new environment variables', async () => {
    // Remove new env vars
    // System should use sensible defaults
  });
});
```

## Test Data Generation

### Mock Data Generators
```javascript
// test-data-generators.js
function generateEarlyMovementPattern() {
  // Create realistic price movement starting subtle
  return {
    '1m': [
      { time: 0, close: 1.000, volume: 1000 },
      { time: 1, close: 1.001, volume: 1100 }, // 0.1% increase
      { time: 2, close: 1.003, volume: 1300 }, // Accelerating
      // ... gradual buildup
    ]
  };
}

function generateVolumeSurgePattern(multiplier) {
  // Create volume surge at specified multiplier
}

function generateMomentumStreakPattern() {
  // Multi-day momentum pattern for streak testing
}
```

## Test Execution Plan

### Phase 1: Unit Tests (Day 1)
1. Run all unit tests in isolation
2. Verify each component fix works correctly
3. Generate coverage reports

### Phase 2: Integration Tests (Day 2)
1. Test module interactions
2. Verify data flow between components
3. Check persistence mechanisms

### Phase 3: E2E Tests (Day 3)
1. Full system tests with realistic data
2. Performance benchmarking
3. Stress testing with high token volumes

### Phase 4: Production Simulation (Day 4)
1. Run against live testnet data
2. Compare detection rates before/after
3. Monitor for false positives

## Success Criteria

### Functional Success
- ✅ All unit tests pass (100%)
- ✅ Integration tests pass (100%)
- ✅ E2E tests show 40%+ improvement in early detection
- ✅ API calls reduced by 80%+
- ✅ Volume signals trigger 20-30% earlier

### Performance Success
- ✅ Processing time < 30s for 50 tokens
- ✅ Memory usage stable over 24h run
- ✅ Database size manageable (< 100MB for 1 week)

### Quality Success
- ✅ No regression in existing functionality
- ✅ False positive rate < 10%
- ✅ Code coverage > 85%

## Monitoring & Validation

### Test Metrics Dashboard
```javascript
// test-metrics-collector.js
class TestMetricsCollector {
  trackDetectionTiming(tokenAddress, detectedAt, actualPumpAt);
  trackAPICallReduction(before, after);
  trackProcessingSpeed(tokenCount, duration);
  generateReport();
}
```

### Continuous Validation
1. Run subset of tests every 5 minutes in production
2. Alert if detection accuracy drops below threshold
3. Compare live results with test predictions

## Rollback Plan
If any critical test fails:
1. Revert to previous version immediately
2. Analyze failure logs
3. Fix issues in staging environment
4. Re-run full test suite before re-deployment