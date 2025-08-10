# Rating Engine Calibration Needed

## Current Issue
The rating engine is producing ratings that are too conservative:
- 75.6% of tokens get a rating of 5
- No tokens have achieved ratings ≥6
- This prevents AI analysis and Discord notifications from triggering

## Root Causes

### 1. Conservative Scoring Components
The individual score calculators may be too conservative:
- Technical indicators centering around 50 (neutral)
- Momentum scores not recognizing strong trends
- Volume scores not rewarding high activity
- Risk penalties too harsh

### 2. Unused Enhancement Features
- **Consecutive Momentum Bonus**: 0 uses
  - Should boost ratings for tokens with sustained momentum
  - May have too strict criteria or implementation issues
  
- **Exhaustion Penalty**: 0 applications
  - Should reduce ratings for overextended tokens
  - May not be detecting exhaustion conditions

### 3. Weight Distribution
Current weights might be dampening high scores:
```
technical: 25%
momentum: 20%
volume: 15%
risk: 10%
multiTimeframe: 20%
consecutiveMomentum: 10%
```

## Recommended Adjustments

### 1. Immediate Fixes
```typescript
// In TechnicalScoreCalculator
// Increase RSI oversold bonus
if (rsi < 30) {
  score += (30 - rsi) * 1.0; // Increased from 0.5
}

// In MomentumScoreCalculator
// Reward strong trends more
if (momentum.strength > 70) {
  score += (momentum.strength - 70) * 0.8; // Increased multiplier
}

// In VolumeScoreCalculator
// Boost high volume scenarios
if (volumeRatio > 2.0) {
  score += Math.min(30, (volumeRatio - 1) * 20); // More aggressive
}
```

### 2. Enable Consecutive Momentum
Check why consecutive momentum isn't triggering:
- Verify database is storing momentum periods correctly
- Lower threshold for consecutive period detection
- Increase bonus percentage (currently max 25%)

### 3. Adjust Base Scores
Instead of starting at 50 (neutral), consider:
- Start optimistic tokens at 60
- Start neutral at 50
- Start bearish at 40

### 4. Add Breakout Detection
Implement pattern recognition for:
- Cup and handle formations
- Ascending triangles
- Bull flags
- Volume breakouts

## Testing Strategy

1. **Temporarily lower thresholds** for testing:
   ```env
   AI_ANALYSIS_THRESHOLD=4
   MIN_RATING_THRESHOLD=5
   ```

2. **Add rating adjustment config**:
   ```env
   RATING_BOOST_FACTOR=1.2  # Multiply all ratings by 1.2
   ```

3. **Monitor distribution** after changes:
   - Target: 10-15% of tokens rated ≥6
   - Goal: 2-5% of tokens rated ≥7

## Expected Outcome

After calibration:
- Rating distribution: More spread from 3-8
- AI analysis: Triggered for 10-15% of tokens
- Discord alerts: 2-5% of high-potential tokens
- Better identification of momentum plays

The current system is too conservative for memecoin trading where higher risk/reward is expected.