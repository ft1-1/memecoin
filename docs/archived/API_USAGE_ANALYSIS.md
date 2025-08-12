# API Usage Analysis

## Current API Call Pattern

Based on the logs, here's what's happening for each token analysis:

### Per Token API Calls:
1. **Token Details**: 1 API call to get token information
2. **Multi-Timeframe Chart Data**: 4 API calls (one for each timeframe)
   - 5m chart data
   - 15m chart data 
   - 1h chart data
   - 4h chart data

**Total: 5 API calls per token**

### Example for 14 tokens:
- Token details: 14 calls
- Chart data: 14 tokens × 4 timeframes = 56 calls
- **Total: 70 API calls per analysis cycle**

## Why So Many Calls?

The system is fetching separate chart data for each timeframe to perform multi-timeframe analysis. This provides:
- Different perspectives on momentum
- Timeframe alignment detection
- More accurate technical indicators

## Optimization Options

### 1. **Reduce Timeframes** (Quick Win)
Instead of 4 timeframes, use 2:
```typescript
// Change from:
['5m', '15m', '1h', '4h']
// To:
['15m', '1h']
```
This would reduce chart calls from 56 to 28 per cycle.

### 2. **Use Chart Aggregation** (Already Implemented)
The system already has `fallbackToAggregation: true` which fetches 1-minute data and aggregates it locally. This should reduce API calls but may still make initial requests.

### 3. **Implement Better Caching**
Current cache TTL is 2 minutes for chart data. Consider:
- Increase cache TTL to 5-10 minutes
- Cache token details longer (they change less frequently)

### 4. **Batch Analysis**
Instead of analyzing all tokens every 5 minutes:
- Analyze half the tokens each cycle
- Rotate through tokens

### 5. **Single Chart Request with Aggregation**
Fetch only 1m or 5m data and aggregate all other timeframes locally:
```typescript
// Fetch only 5m data
const chartData = await getChartData(token, '5m');
// Aggregate to 15m, 1h, 4h locally
const aggregated = aggregateTimeframes(chartData);
```

## Recommended Immediate Changes

1. **Reduce to 2 timeframes** (15m, 1h) - saves 50% of chart API calls
2. **Increase cache TTL** to 5 minutes - reduces repeated calls
3. **Enable full local aggregation** - fetch 5m data only and aggregate others

This would reduce API calls from 70 to approximately 28 per cycle (14 token details + 14 chart calls).