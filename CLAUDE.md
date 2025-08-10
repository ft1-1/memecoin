# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **memecoin momentum analyzer** that automatically identifies high-potential memecoins using technical analysis, risk assessment, and intelligent scoring. The system:

- Fetches trending tokens every 5 minutes from Solana Tracker API
- Filters tokens by $5M-$50M market cap range  
- Performs comprehensive technical analysis and momentum detection
- Generates buy ratings (1-10) using multi-factor scoring
- Sends Discord notifications for high-rated opportunities (≥7)

## Agent-Driven Development Approach

This project uses **specialized Claude Code agents** for domain expertise:

### Required Agent Delegation

**ALWAYS delegate to specialist agents for their domains:**

1. **system-orchestrator**: Overall architecture, component coordination, scheduling, and system integration
2. **api-integration-specialist**: All Solana Tracker API integration, rate limiting, error handling (reference: `solanatracker_full_api_reference.md`)  
3. **crypto-technical-analyst**: Technical analysis, momentum indicators, chart patterns, and trading signals
4. **rating-engine-architect**: Multi-factor scoring algorithms, confidence metrics, and decision systems
5. **discord-integration-developer**: Discord webhooks, rich embeds, notification formatting, and bot features

### Agent Coordination Pattern

```
system-orchestrator coordinates → delegates to specialists → integrates results
```

**Example delegation commands:**
- "Use the api-integration-specialist agent to implement Solana Tracker integration..."
- "Delegate to crypto-technical-analyst agent for momentum analysis..."
- "Engage rating-engine-architect agent for the scoring system..."

## Technology Stack

- **Runtime**: Node.js with TypeScript
- **API Client**: Axios with retry logic and circuit breakers  
- **Technical Analysis**: Custom indicators (RSI, MACD, Bollinger Bands)
- **Database**: SQLite for historical tracking
- **Scheduling**: node-cron for 5-minute intervals
- **Notifications**: Discord webhooks with rich embeds
- **Containerization**: Docker for deployment

## Architecture Requirements

### Core Components (assign to appropriate agents)

1. **Data Pipeline** (api-integration-specialist):
   - Solana Tracker API client with rate limiting
   - Token filtering by market cap ($5M-$50M)
   - Chart data retrieval (OHLCV)
   - Error handling and retry logic

2. **Analysis Engine** (crypto-technical-analyst):
   - Technical indicators (RSI, MACD, EMAs, Bollinger Bands)
   - Momentum detection algorithms
   - Volume analysis and pattern recognition
   - Multi-timeframe analysis (1m, 5m, 15m, 1h)

3. **Rating System** (rating-engine-architect):
   - Multi-factor scoring (technical + momentum + volume + risk)
   - Weighted algorithms with confidence intervals
   - 1-10 rating scale with clear thresholds
   - Risk-adjusted scoring

4. **Notification System** (discord-integration-developer):
   - Rich Discord embeds with token data
   - Rate limiting for Discord API
   - Error handling and retry logic
   - Configurable alert thresholds

5. **System Coordination** (system-orchestrator):
   - Main application loop and scheduling
   - Component orchestration and data flow
   - Health checks and monitoring
   - Graceful shutdown and error recovery

## Configuration

### Environment Variables
```env
# API Configuration
SOLANA_TRACKER_API_KEY=your_api_key_here
DISCORD_WEBHOOK_URL=your_webhook_url_here

# Analysis Parameters  
MARKET_CAP_MIN=5000000      # $5M
MARKET_CAP_MAX=50000000     # $50M
ANALYSIS_INTERVAL=5         # 5 minutes
MIN_RATING_THRESHOLD=7      # Only notify for ratings ≥7

# System Configuration
HEALTH_CHECK_PORT=3001
LOG_LEVEL=info
```

## Development Commands

```bash
# Setup
npm install

# Development
npm run dev          # Run with hot reload
npm run build        # Compile TypeScript  
npm start           # Run compiled application

# Testing  
npm test            # Run test suite
npm run lint        # Check code quality

# Production
npm run docker:build  # Build Docker image
npm run deploy       # Deploy to production
```

## API Integration

### Solana Tracker Endpoints (for api-integration-specialist)

- **Base URL**: `https://data.solanatracker.io`
- **Authentication**: `x-api-key` header
- **Key Endpoints**:
  - `GET /tokens/trending/{timeframe}` - Trending tokens
  - `GET /tokens/{address}` - Token details with risk scores
  - `GET /chart/{token}` - OHLCV data
  - `GET /price/multi` - Batch pricing

### Rate Limits
- Free: 10k requests/month, 1/second
- Paid plans: Higher limits, no rate restrictions

## Monitoring and Health Checks

- **Health endpoint**: `http://localhost:3001/health`
- **Structured logging** with correlation IDs
- **Metrics collection** for performance monitoring
- **Circuit breakers** for external dependencies

## Quality Standards

### Code Requirements
- **TypeScript** with strict typing
- **Error handling** at all levels
- **Comprehensive logging** with structured output
- **Unit tests** for critical components
- **Integration tests** for API endpoints

### Agent Responsibilities
Each agent must ensure:
- Production-ready patterns in their domain
- Proper error handling and recovery
- Performance optimization
- Security best practices
- Comprehensive documentation

## Current Development Phase

**Status**: Fresh rebuild with proper agent delegation
**Goal**: Build production-ready memecoin analyzer using all specialist agents
**Priority**: Ensure each agent contributes domain expertise

## Agent Usage Verification

When building, verify all agents are used:
- [ ] system-orchestrator: Architecture and coordination
- [ ] api-integration-specialist: Solana Tracker integration  
- [ ] crypto-technical-analyst: Technical analysis implementation
- [ ] rating-engine-architect: Scoring system design
- [ ] discord-integration-developer: Notification system

**Remember**: The power of this project comes from specialist agent collaboration, not single-agent development.