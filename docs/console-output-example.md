# Console Output Example with Rating Breakdowns

This shows what the new simplified console output looks like with rating breakdowns:

```
============================================================
🚀 Starting Analysis Cycle #42 at 14:23:45
============================================================
⬇️  Fetching trending tokens from Solana...
   ✓ Found 87 trending tokens
🔍 Analyzing 87 tokens (this may take a moment)...
   Notification threshold: ≥7.0/10
   • PEPE: 3.2/10 (Tech:2.5 Mom:3.0 Vol:4.1 Risk:3.2)
   • DOGE: 5.7/10 (Tech:6.0 Mom:5.5 Vol:6.2 Risk:5.1)
   • SHIB: 4.1/10 (Tech:3.8 Mom:4.2 Vol:4.5 Risk:4.0)
🤖 Getting AI analysis for BONK...
   • BONK: 7.2/10 (Tech:6.8 Mom:7.5 Vol:7.8 Risk:6.9 AI:7.5) ✓ Will notify
🌟 HIGH RATING: BONK scored 7.2/10!
🤖 Getting AI analysis for FLOKI...
   • FLOKI: 6.8/10 (Tech:6.5 Mom:6.9 Vol:7.1 Risk:6.7 AI:6.8) ⚡ Close to threshold
   • MEME: 2.9/10 (Tech:2.0 Mom:3.2 Vol:3.5 Risk:2.9)
🤖 Getting AI analysis for WOJAK...
   • WOJAK: 7.5/10 (Tech:7.0 Mom:7.8 Vol:8.0 Risk:7.2 AI:7.7) ✓ Will notify
🌟 HIGH RATING: WOJAK scored 7.5/10!
🤖 Getting AI analysis for PEPE2...
   • PEPE2: 6.9/10 (Tech:6.5 Mom:7.2 Vol:7.0 Risk:6.8 AI:6.9) ⚡ Close to threshold
📤 Sending Discord alert for BONK (7.2/10)
   ✓ Alert sent successfully
📤 Sending Discord alert for WOJAK (7.5/10)
   ✓ Alert sent successfully

✅ Analysis Cycle Complete
   • Tokens analyzed: 8
   • High-rated tokens (≥7): 2
   • Notifications sent: 2
   • Duration: 12.5s

   Rating Distribution:
    7/10:   2 ██ ← Notification threshold
    6/10:   2 ██
    5/10:   1 █
    4/10:   1 █
    3/10:   1 █
    2/10:   1 █

💚 System health: healthy
⏳ Waiting for next cycle... (in 5 minutes)
```

## Understanding the Output

### Rating Breakdown Format
```
Symbol: Total/10 (Tech:X Mom:X Vol:X Risk:X AI:X) [Status]
```

- **Tech**: Technical analysis score (RSI, MACD, Bollinger Bands)
- **Mom**: Momentum score (trend strength, velocity)
- **Vol**: Volume analysis score (spikes, liquidity)
- **Risk**: Risk assessment (inverse - higher = lower risk)
- **AI**: Claude AI analysis score (only for tokens ≥6 technical)

### Status Indicators
- **✓ Will notify**: Rating ≥7.0, notification will be sent
- **⚡ Close to threshold**: Rating 6.5-6.9, almost triggers notification
- *(no indicator)*: Rating <6.5, no notification

### Key Information at a Glance

1. **Which tokens will trigger notifications**: Look for green "✓ Will notify"
2. **Why tokens scored as they did**: See the component breakdown
3. **Which tokens got AI analysis**: Look for the AI score in cyan
4. **Close calls**: Yellow "⚡" shows tokens that almost made it
5. **Overall distribution**: The histogram shows rating patterns

### Notification Logic

A token triggers a Discord notification when:
1. Initial technical rating ≥ 6.0 (triggers AI analysis)
2. Final combined rating ≥ 7.0 (after AI enhancement)
3. Discord service is healthy

The rating formula:
- Without AI: Average of Tech, Mom, Vol, Risk components
- With AI: 70% technical average + 30% AI rating

This makes it clear exactly why you did or didn't receive notifications!