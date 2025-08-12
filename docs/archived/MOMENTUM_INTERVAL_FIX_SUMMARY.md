# MomentumAccelerationTracker Interval Fix Summary

## Problem
The `MomentumAccelerationTracker` was hardcoded to assume 5-minute candle intervals throughout the codebase, but the system feeds it data with various intervals (1m, 1h, 4h). This caused incorrect momentum calculations for non-5-minute data.

## Root Cause
Several methods in `MomentumAccelerationTracker` had hardcoded assumptions:
- `findPriceAtInterval()`: `const candlesBack = Math.floor(intervalMinutes / 5);`
- `calculateVelocity()`: `const candlesInWindow = Math.floor(windowMinutes / 5);`
- `calculateVelocityMetrics()`: Used hardcoded slice values like `sortedData.slice(12)` and `sortedData.slice(48)`

## Solution Implemented

### 1. MomentumAccelerationTracker.ts Changes
- **Added `intervalMinutes` parameter** to constructor: `constructor(config, intervalMinutes = 5)`
- **Updated `findPriceAtInterval()`** to use actual interval: `Math.floor(intervalMinutes / this.intervalMinutes)`
- **Updated `calculateVelocity()`** to use actual interval: `Math.floor(windowMinutes / this.intervalMinutes)`
- **Updated `calculateVelocityMetrics()`** to calculate skip values dynamically:
  ```typescript
  const candlesToSkip1h = Math.floor(this.config.velocityWindows.short / this.intervalMinutes);
  const candlesToSkip4h = Math.floor(this.config.velocityWindows.medium / this.intervalMinutes);
  ```
- **Updated `analyzeMomentum()`** to adjust minimum data points based on interval
- **Updated factory function** to accept `intervalMinutes` parameter

### 2. MomentumAccelerationSystemComponent.ts Changes
- **Added `defaultIntervalMinutes` config** option (defaults to 5)
- **Replaced single tracker** with `Map<number, MomentumAccelerationTracker>` for multiple intervals
- **Added `detectInterval()` method** to automatically detect candle intervals from timestamp analysis
- **Added `getTrackerForInterval()` method** to create/retrieve trackers for specific intervals
- **Updated `analyzeMomentumAcceleration()`** to accept optional `intervalMinutes` parameter and auto-detect
- **Updated caching** to include interval in cache keys: `${tokenAddress}-${ohlcvData.length}-${detectedInterval}min`
- **Enhanced statistics** to show tracker count and supported intervals

### 3. EntrySignalGenerator.ts Changes
- **Replaced single tracker** with `Map<number, MomentumAccelerationTracker>` for multiple intervals
- **Added interval detection** and tracker management methods
- **Updated momentum analysis** to detect interval and use appropriate tracker

## Interval Detection Algorithm
The system now automatically detects candle intervals by:
1. Analyzing timestamp differences between consecutive candles
2. Calculating average interval in minutes
3. Rounding to nearest common interval (1, 5, 15, 60, 240 minutes)
4. Creating/using appropriate tracker for that interval

## Benefits
- ✅ **Accurate calculations** for all timeframes (1m, 5m, 15m, 1h, 4h)
- ✅ **Automatic detection** - no manual interval specification required
- ✅ **Backward compatibility** - existing code works unchanged
- ✅ **Performance optimization** - separate trackers cached per interval
- ✅ **Flexible architecture** - easy to add new intervals

## Files Modified
1. `/src/analysis/momentum/MomentumAccelerationTracker.ts`
2. `/src/analysis/momentum/MomentumAccelerationSystemComponent.ts` 
3. `/src/signals/EntrySignalGenerator.ts`

## Testing
- Created `test_momentum_interval_fix.js` to verify interval support
- Tests interval detection accuracy
- Tests momentum calculation for different intervals
- Verifies no errors with various timeframes

## Impact
This fix ensures that momentum acceleration analysis works correctly regardless of the input data's candle interval, providing accurate technical analysis across all supported timeframes in the memecoin analyzer system.