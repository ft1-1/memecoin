# Rating Engine Hang Debug Fixes

## Problem Summary

The memecoin analyzer's rating calculation was hanging at "Starting rating calculation for CHILLHOUSE" and never completing. The logs showed the calculation starting but never finishing, indicating a potential infinite loop, blocking database operation, or unhandled async operation.

## Root Cause Analysis

The hanging was likely caused by:

1. **Database operations without timeouts** - SQLite operations in `ConsecutiveMomentumCalculator` and `MultiTimeframeScoreCalculator`
2. **No timeout protection** - Promise.all operations in component score calculations could hang indefinitely
3. **Insufficient logging** - Difficult to pinpoint exactly where the hang occurred
4. **Unhandled edge cases** - Complex calculators with potential infinite loops or blocking operations

## Implemented Fixes

### 1. Added Comprehensive Timeout Protection

**File: `/src/analysis/rating/RatingEngine.ts`**

- Added `withTimeout()` method to wrap all async operations
- 30-second timeout for entire rating calculation
- 15-second timeout for component score calculations  
- 10-second timeout for multi-timeframe calculations
- 8-second timeout for consecutive momentum calculations
- 5-second timeout for exhaustion penalty calculations
- 5-second timeout for rating storage operations

**Key Changes:**
```typescript
// Main calculation wrapper with timeout
return await this.withTimeout(
  this.performRatingCalculation(...),
  RATING_TIMEOUT_MS,
  `Rating calculation timeout for ${tokenAddress}`
);

// Component calculations with individual timeouts
const baseScores = await this.withTimeout(
  this.calculateComponentScores(...),
  15000, // 15 second timeout
  `Component scores calculation timeout for ${tokenAddress}`
);
```

### 2. Enhanced Step-by-Step Logging

**File: `/src/analysis/rating/RatingEngine.ts`**

Added detailed debug logging for every major step:

- Step 1: Context preparation
- Step 2: Base component score calculations  
- Step 3: Multi-timeframe score calculation
- Step 4: Consecutive momentum calculation
- Step 5: Exhaustion penalty calculation
- Step 6: Enhanced component scoring
- Step 7: Final score calculations
- Step 8: Confidence and smoothing
- Step 9: Reasoning and alerts generation
- Step 10: Rating storage

Each step logs:
- Start time
- Completion time
- Duration
- Key metrics
- Error details (if any)

### 3. Database Operation Timeouts

**File: `/src/database/DatabaseManager.ts`**

Added timeout protection to all database operations:

```typescript
// Storage operations with 3-second timeout
const result = await this.withTimeout(
  this.db.run(query, params),
  3000,
  `Database insert timeout for ${tokenAddress}`
);

// Query operations with 3-second timeout  
const records = await this.withTimeout(
  this.db.all(query, params),
  3000,
  `Database query timeout for ${tokenAddress}`
);
```

### 4. ConsecutiveMomentumCalculator Protection

**File: `/src/analysis/rating/calculators/ConsecutiveMomentumCalculator.ts`**

Added comprehensive step-by-step logging and timeouts:

- Step CM-1: Load historical periods (5s timeout)
- Step CM-2: Check trend break reset (3s timeout if needed)
- Step CM-3: Create current period
- Step CM-4: Validate current period  
- Step CM-5a/5b: Store period or reset tracking (3s timeout)
- Step CM-6: Calculate momentum bonus

### 5. Graceful Error Handling

All timeout failures now:
- Log detailed error information including duration and timeout status
- Return safe default values instead of throwing
- Continue processing rather than aborting entirely
- Preserve partial results when possible

### 6. Debug and Test Tools

**Created debugging tools:**

1. **`debug-rating-hang.js`** - Simulates rating calculation with detailed monitoring
2. **`test-rating-timeouts.js`** - Tests timeout mechanisms work correctly

## Timeout Configuration

| Operation | Timeout | Justification |
|-----------|---------|---------------|
| Overall Rating | 30s | Maximum time for complete calculation |
| Component Scores | 15s | Parallel calculation of all 4 components |
| Individual Component | 5s | Single technical/momentum/volume/risk calc |
| Multi-timeframe | 10s | Complex cross-timeframe analysis |
| Consecutive Momentum | 8s | Database-heavy with multiple queries |
| Exhaustion Penalty | 5s | Lighter calculation |
| Database Insert | 3s | Single SQLite insert operation |
| Database Query | 3s | Single SQLite select operation |
| Rating Storage | 5s | Multiple database operations |

## Error Recovery Strategy

1. **Component Score Failures**: Return neutral score (50) and continue
2. **Enhancement Failures**: Use default values, log error, continue
3. **Database Failures**: Continue without persistence, log error
4. **Timeout Errors**: Clearly identify as timeout in logs
5. **Critical Failures**: Only abort if core calculation impossible

## Verification

Run the test tools to verify fixes:

```bash
# Test timeout mechanisms
node test-rating-timeouts.js

# Simulate rating calculation with monitoring  
node debug-rating-hang.js
```

## Monitoring

Enhanced logging now provides:

- **Step-by-step progress** - Easy to identify where hangs occur
- **Duration tracking** - Identify slow operations
- **Timeout detection** - Clear timeout vs other error types
- **Database operation timing** - Monitor SQLite performance
- **Component breakdown** - See which calculators are slow

## Expected Results

After these fixes:

1. **No more infinite hangs** - All operations have maximum timeout
2. **Clear hang location** - Detailed logging shows exactly where issues occur  
3. **Graceful degradation** - System continues with partial data on failures
4. **Better diagnostics** - Rich error information for debugging
5. **Improved reliability** - Multiple fallback mechanisms

## Future Improvements

Consider adding:

1. **Configurable timeouts** - Environment-based timeout configuration
2. **Performance metrics** - Track average calculation times
3. **Circuit breakers** - Temporarily disable slow components
4. **Health checks** - Endpoint to verify rating engine status
5. **Queue management** - Prevent multiple simultaneous calculations for same token

## Testing the Fix

To test if the hang is resolved:

1. Run the analyzer with the enhanced logging enabled
2. Monitor logs for step-by-step progress
3. Look for timeout errors instead of infinite hangs
4. Verify rating calculations complete within 30 seconds
5. Check that partial results are returned even on component failures

The enhanced logging will make it immediately clear where any remaining issues occur, making future debugging much faster and more effective.