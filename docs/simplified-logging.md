# Simplified Logging Configuration

This document explains the new simplified console output feature for the Memecoin Analyzer.

## Overview

The analyzer now supports two logging modes:
- **Simple Mode** (default): Clean, human-readable output showing only what's happening
- **Detailed Mode**: Full technical logging with all metadata

## Simple Mode Output Example

```
============================================================
🚀 Starting Analysis Cycle #42 at 14:23:45
============================================================
⬇️  Fetching trending tokens from Solana...
   ✓ Found 87 trending tokens
🔍 Analyzing 87 tokens (this may take a moment)...
   • PEPE: 3.2/10
   • DOGE: 5.7/10
   • SHIB: 4.1/10
🌟 HIGH RATING: BONK scored 7.2/10!
🤖 Getting AI analysis for BONK...
   • FLOKI: 6.8/10
   • MEME: 2.9/10
🌟 HIGH RATING: WOJAK scored 7.5/10!
🤖 Getting AI analysis for WOJAK...
📤 Sending Discord alert for BONK (7.2/10)
   ✓ Alert sent successfully
📤 Sending Discord alert for WOJAK (7.5/10)
   ✓ Alert sent successfully

✅ Analysis Cycle Complete
   • Tokens analyzed: 87
   • High-rated tokens (≥7): 2
   • Notifications sent: 2
   • Duration: 12.5s

💚 System health: healthy
⏳ Waiting for next cycle... (in 5 minutes)
```

## Configuration

### Environment Variables

```bash
# Use simplified logging (default in production)
LOG_FORMAT=simple

# Use detailed logging (for debugging)
LOG_FORMAT=detailed

# Node environment also affects logging
NODE_ENV=production  # Uses simple by default
NODE_ENV=development # Uses detailed by default
```

### Priority Rules

1. `LOG_FORMAT` takes precedence over `NODE_ENV`
2. If `LOG_FORMAT` is not set:
   - `production` environment → Simple logging
   - Other environments → Detailed logging

## What's Shown in Simple Mode

### ✅ Displayed:
- Analysis cycle start/completion
- Token fetching progress
- High-rated tokens (≥7 rating)
- AI analysis for promising tokens
- Discord notifications
- System health status
- Important errors and warnings
- Cycle summary statistics

### ❌ Hidden:
- Technical details (API response times, etc.)
- Debug information
- Detailed error stack traces
- Configuration details
- Performance metrics
- Circuit breaker states

## Color Coding

- 🚀 **Cyan**: Cycle starts and AI operations
- ⬇️ **Blue**: Data fetching operations
- 🔍 **Yellow**: Analysis in progress
- 🌟 **Green**: High-rated tokens found
- 📤 **Magenta**: Notifications
- ✅ **Green**: Success messages
- ❌ **Red**: Errors
- ⚠️ **Yellow**: Warnings
- 💚💛❤️ Health status indicators

## Implementation in Code

To use the simplified logging in your code:

```javascript
const { ActivityLogger } = require('./utils/ActivityLogger');

// Create activity logger
const activity = new ActivityLogger(logger);

// Use simple activity methods
activity.cycleStart(cycleNumber);
activity.fetchingTokens();
activity.tokensFetched(count);
activity.tokenAnalyzed(symbol, rating);
activity.sendingNotification(symbol, rating);
activity.cycleComplete({
  tokensAnalyzed: 87,
  highRatedTokens: 2,
  notificationsSent: 2,
  duration: '12.5s'
});

// Technical details go to debug level
logger.debug('Technical details here', { technical: true });
```

## Testing

Run the test script to see the difference:

```bash
# Build first
npm run build

# Test simplified logging
node test-simplified-logging.js

# Compare with detailed mode
LOG_FORMAT=detailed node test-simplified-logging.js
```

## Benefits

1. **Clarity**: Instantly understand what the system is doing
2. **Less Noise**: Only see important information
3. **User-Friendly**: Non-technical users can monitor the system
4. **Debugging**: Switch to detailed mode when needed
5. **Performance**: Less console I/O in production