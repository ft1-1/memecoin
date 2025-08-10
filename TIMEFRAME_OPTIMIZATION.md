# Timeframe Optimization for 15-Minute Cycles

## Recommended Configuration

### 1. Update Analysis Interval (cron schedule)
```bash
# .env
ANALYSIS_INTERVAL=*/15 * * * *    # Run every 15 minutes instead of 5
```

### 2. Update Timeframes in Code
```typescript
// src/orchestrator/AnalysisWorkflow.ts (line 422)
// Change from:
['5m', '15m', '1h', '4h']
// To:
['1h', '4h']
```

### 3. Update Timeframe Weights
```bash
# .env
# Adjust weights since we only have 2 timeframes now
TIMEFRAME_WEIGHTS_4H=0.6    # 60% weight for major trend
TIMEFRAME_WEIGHTS_1H=0.4    # 40% weight for medium-term momentum
```

### 4. Update Cache TTL
```typescript
// src/orchestrator/AnalysisWorkflow.ts (line 454)
// Increase cache to 10 minutes (still fresh for 15-min cycles)
this.analysisCache.set(chartCacheKey, chartData, 10 * 60 * 1000);
```

## Expected Benefits

1. **API Calls Reduced by 60%**
   - Before: 5 calls per token (1 details + 4 charts)
   - After: 3 calls per token (1 details + 2 charts)
   - Per cycle: 70 calls → 42 calls

2. **Better Signal Quality**
   - 1h captures momentum shifts in memecoins
   - 4h confirms whether it's a real trend or just noise
   - Less false positives from micro-movements

3. **Ideal for Memecoin Trading**
   - 1h: Catches early momentum (critical for memecoins)
   - 4h: Confirms sustainability (filters out pump & dumps)
   - Together: Good balance of speed and reliability

## Alternative Option: 30m + 2h

If you want slightly faster signals:
- **30m**: Quicker momentum detection
- **2h**: Medium-term trend confirmation
- Better for very volatile memecoins
- Still only 2 API calls per token

## Implementation Priority

1. First: Change timeframes to ['1h', '4h']
2. Second: Update cron to */15 * * * *
3. Third: Adjust cache TTL
4. Fourth: Monitor and tune weights based on results