# Implementation Plan: Addressing Momentum Detection Gaps

## Overview
This plan addresses critical gaps in the momentum detection system that are causing missed opportunities for early token movement detection.

## Gap 1: 5-Minute Candle Assumption Fix

### Problem
- `MomentumAccelerationTracker` hardcodes 5-minute intervals in `findPriceAtInterval()`
- Workflow often requests 1h/4h data, causing incorrect velocity/acceleration calculations
- Math assumes 5m candles but receives various intervals → inaccurate momentum detection

### Solution
1. **Make MomentumAccelerationTracker interval-aware**
   - Add `intervalMinutes` parameter to constructor
   - Update `findPriceAtInterval()` to use actual candle interval
   - Pass interval from chart data metadata

2. **Standardize on 1m source data with aggregation**
   - Fetch 1m data once per token (reducing API calls)
   - Use `ChartDataAggregator` to create 5m, 15m, 1h, 4h timeframes
   - Available Solana Tracker intervals: 1m, 3m, 5m, 15m, 30m, 1h, 2h, 4h, 6h, 8h, 12h, 1d, 3d

### Implementation Steps
```typescript
// MomentumAccelerationTracker.ts
constructor(private intervalMinutes: number = 5) {
  // Dynamic interval support
}

private findPriceAtInterval(targetTime: number): number | null {
  const targetIndex = Math.floor((currentTime - targetTime) / (this.intervalMinutes * 60 * 1000));
  // ... rest of logic
}
```

## Gap 2: Consecutive Momentum State Persistence

### Problem
- `ConsecutiveMomentumCalculator` has DB support but no `DatabaseManager` wired
- Falls back to empty history each run → bonus rarely triggers
- Loses valuable momentum tracking between analysis cycles

### Solution
1. **Implement lightweight SQLite persistence**
   - Create `src/database/DatabaseManager.ts`
   - Schema: `consecutive_momentum (token_address, timestamp, momentum_score, streak_count)`
   - Keep last 24 hours of data per token

2. **Wire into SystemOrchestrator**
   - Initialize DatabaseManager as system component
   - Pass to ConsecutiveMomentumCalculator via dependency injection

### Implementation Steps
```typescript
// DatabaseManager.ts
interface MomentumRecord {
  tokenAddress: string;
  timestamp: Date;
  momentumScore: number;
  streakCount: number;
}

class DatabaseManager {
  private db: Database;
  
  async saveMomentumRecord(record: MomentumRecord): Promise<void>;
  async getRecentMomentum(tokenAddress: string, hours: number = 24): Promise<MomentumRecord[]>;
  async cleanOldRecords(hoursToKeep: number = 48): Promise<void>;
}
```

## Gap 3: Optimize Timeframe Coverage

### Problem
- Current workflow fetches each timeframe separately (multiple API calls)
- Defaults to 1h/4h, missing early 5m/15m movements
- "Just started running" patterns live on shorter timeframes

### Solution
1. **Single 1m data pull strategy**
   - Fetch 1m data covering max analysis period (e.g., 24-48 hours)
   - Use existing `ChartDataAggregator` to create all timeframes
   - Pass all timeframes to analysis modules

2. **Update AnalysisWorkflow**
```typescript
// AnalysisWorkflow.ts
private async fetchAndAggregateData(token: Token): Promise<MultiTimeframeData> {
  // Fetch 1m data for last 48 hours
  const rawData = await this.dataFetcher.getChartData(token.address, '1m', 2880); // 48h * 60
  
  // Aggregate to multiple timeframes
  return {
    '1m': rawData,
    '5m': this.aggregator.aggregate(rawData, 5),
    '15m': this.aggregator.aggregate(rawData, 15),
    '1h': this.aggregator.aggregate(rawData, 60),
    '4h': this.aggregator.aggregate(rawData, 240)
  };
}
```

### Benefits
- Single API call per token (5x reduction)
- Complete timeframe coverage for early detection
- Consistent data across all analysis modules

## Gap 4: Configurable Volume Surge Thresholds

### Problem
- `EntrySignalGenerator` uses hardcoded 3× volume with 3-period persistence
- Too strict for mid-cap tokens ($5M-$50M range)
- Missing moves that show 2-2.5× volume surges

### Solution
1. **Environment-based configuration**
```env
# .env additions
VOLUME_SURGE_MULTIPLIER=2.5      # Down from 3.0
VOLUME_SURGE_PERIODS=2           # Down from 3
VOLUME_BASELINE_PERIODS=20       # For average calculation
```

2. **Update EntrySignalGenerator**
```typescript
// EntrySignalGenerator.ts
private readonly volumeSurgeMultiplier = parseFloat(process.env.VOLUME_SURGE_MULTIPLIER || '2.5');
private readonly volumeSurgePeriods = parseInt(process.env.VOLUME_SURGE_PERIODS || '2');
```

## Implementation Priority & Timeline

### Phase 1: Critical Fixes (Day 1-2)
1. **Timeframe Optimization** (Highest Impact)
   - Update AnalysisWorkflow for single 1m pull
   - Implement multi-timeframe aggregation
   - Test API call reduction

2. **Fix Candle Assumptions**
   - Update MomentumAccelerationTracker
   - Add interval awareness
   - Verify calculations with different intervals

### Phase 2: State & Configuration (Day 3-4)
3. **Database Persistence**
   - Implement DatabaseManager
   - Wire into momentum tracking
   - Add cleanup routines

4. **Volume Configuration**
   - Add environment variables
   - Update EntrySignalGenerator
   - Test threshold sensitivity

### Phase 3: Integration Testing (Day 5)
- End-to-end testing with all fixes
- Performance benchmarking
- Deployment preparation

## Success Metrics
- API calls reduced by 80% (from 5 to 1 per token)
- Early momentum detection rate increased by 40%+
- Volume-based signals trigger 20-30% earlier
- Consecutive momentum bonuses apply consistently across runs

## Risk Mitigation
1. **Backward Compatibility**: Keep existing interfaces, add parameters as optional
2. **Gradual Rollout**: Test each fix independently before combining
3. **Monitoring**: Add metrics for momentum detection accuracy
4. **Fallbacks**: Maintain current behavior if new systems fail