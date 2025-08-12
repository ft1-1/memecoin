# Claude AI Response Logging

This document describes the Claude AI response logging feature implemented in the memecoin analyzer.

## Overview

The system now logs complete Claude API interactions including:
- Full prompts sent to Claude
- Complete responses received from Claude
- Metadata (timestamps, token info, response lengths, usage stats)

## Log Files

Claude interactions are logged to dedicated daily rotating log files:

```
./logs/claude-responses-YYYY-MM-DD.log
```

### Log Format

Each log entry is a JSON object containing:

```json
{
  "action": "CLAUDE_PROMPT_SENT" | "CLAUDE_FULL_RESPONSE",
  "timestamp": "ISO-8601 timestamp",
  "tokenSymbol": "TOKEN_SYMBOL",
  "tokenAddress": "0x...",
  "promptLength": 12345,        // For prompts
  "responseLength": 5678,       // For responses
  "fullPrompt": "...",          // Complete prompt text
  "fullResponse": "...",        // Complete response text
  "usage": {                    // Token usage stats (for responses)
    "input_tokens": 1234,
    "output_tokens": 567
  },
  "requestId": "msg_...",       // Claude message ID
  "model": "claude-3-5-sonnet-20241022",
  "attempt": 1                  // Retry attempt number
}
```

## Configuration

The Claude logging feature uses these settings:

- **Log retention**: 14 days
- **Max file size**: 50MB per day
- **Compression**: Automatic gzip compression of old logs
- **Log level**: Info (all Claude interactions are logged)

## Viewing Logs

To view Claude interactions:

```bash
# View today's Claude logs
tail -f ./logs/claude-responses-$(date +%Y-%m-%d).log | jq .

# Search for specific token analysis
grep "PEPE" ./logs/claude-responses-*.log | jq .

# Extract just the responses
jq 'select(.action == "CLAUDE_FULL_RESPONSE")' ./logs/claude-responses-*.log

# Extract just the prompts
jq 'select(.action == "CLAUDE_PROMPT_SENT")' ./logs/claude-responses-*.log
```

## Storage Considerations

Full Claude responses can be verbose. With typical usage:
- Each analysis generates ~5-10KB of logs
- At 100 analyses/day = ~1MB/day
- 14-day retention = ~14MB total

Monitor disk usage and adjust retention if needed in the configuration.

## Privacy & Security

⚠️ **Important**: Claude logs may contain sensitive information:
- Token addresses and market data
- Analysis strategies and prompts
- Full AI responses with trading insights

Ensure proper access controls on the logs directory.

## Testing

Run the test script to verify logging works:

```bash
npm run build
node test-claude-logging.js
```

This will:
1. Send a test token for analysis
2. Log the full interaction
3. Display the log file location