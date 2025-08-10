# Memecoin Momentum Analyzer 🚀

A production-ready cryptocurrency analysis system that automatically identifies high-potential memecoins using technical analysis, momentum detection, and intelligent scoring algorithms.

## 🎯 Overview

The Memecoin Momentum Analyzer continuously monitors the Solana blockchain for trending tokens, performs comprehensive technical analysis, and sends Discord notifications for high-rated opportunities. Built with TypeScript and Node.js, it features:

- **Automated Analysis**: Fetches trending tokens every 5 minutes
- **Smart Filtering**: Targets tokens with $5M-$50M market cap
- **Technical Analysis**: RSI, MACD, Bollinger Bands, and custom momentum indicators
- **Intelligent Rating**: 1-10 scoring system with multi-factor analysis
- **Discord Alerts**: Rich embeds for tokens rated ≥7
- **Production-Ready**: Rate limiting, error recovery, health monitoring

## 🏗️ Architecture

This project follows an **agent-driven architecture** with specialized components:

1. **System Orchestrator**: Coordinates all components and manages workflows
2. **API Integration**: Solana Tracker client with rate limiting and caching
3. **Technical Analysis**: Advanced indicators and momentum detection
4. **Rating Engine**: Multi-factor scoring with confidence metrics
5. **Discord Notifications**: Rich embeds and smart batching

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Solana Tracker API key ([Get one here](https://docs.solanatracker.io))
- Discord webhook URL ([Create webhook](https://discord.com/developers/docs/resources/webhook))

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/memecoin-analyzer.git
cd memecoin-analyzer

# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env

# Edit .env with your API keys
nano .env
```

### Configuration

Edit `.env` with your credentials:

```env
SOLANA_TRACKER_API_KEY=your_api_key_here
DISCORD_WEBHOOK_URL=your_discord_webhook_url_here
```

### Running the Application

```bash
# Development mode with hot reload
npm run dev

# Production mode
npm run build
npm start

# Docker deployment
docker-compose up -d
```

## 📊 Features

### Technical Analysis
- **RSI (Relative Strength Index)**: Overbought/oversold detection
- **MACD**: Trend and momentum identification
- **Bollinger Bands**: Volatility analysis
- **Volume Analysis**: Unusual volume detection
- **Multi-timeframe**: 1m, 5m, 15m, 1h analysis

### Rating System
- **Technical Score (40%)**: Based on indicators and signals
- **Momentum Score (30%)**: Trend strength and acceleration
- **Volume Score (20%)**: Liquidity and trading activity
- **Risk Score (10%)**: Volatility and rug pull indicators

### Discord Notifications
- **Rich Embeds**: Beautiful messages with charts and data
- **Smart Batching**: Prevents spam with intelligent grouping
- **Rate Limiting**: Respects Discord API limits
- **Error Recovery**: Automatic retry with backoff

## 🛠️ Development

### Project Structure

```
src/
├── orchestrator/       # System coordination
├── data/api/          # Solana Tracker integration
├── analysis/          # Technical & rating engines
├── notifications/     # Discord integration
├── config/           # Configuration management
├── monitoring/       # Health checks & metrics
└── main.ts          # Application entry point
```

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test suite
npm test -- --testPathPattern=rating
```

### Development Commands

```bash
npm run dev          # Start development server
npm run build        # Compile TypeScript
npm run lint         # Run ESLint
npm run typecheck    # Run TypeScript compiler checks
npm run format       # Format code with Prettier
```

## 🐳 Docker Deployment

### Using Docker Compose

```bash
# Build and start containers
docker-compose up -d

# View logs
docker-compose logs -f analyzer

# Stop containers
docker-compose down
```

### Manual Docker Build

```bash
# Build image
docker build -t memecoin-analyzer .

# Run container
docker run -d \
  --name memecoin-analyzer \
  --env-file .env \
  -p 3001:3001 \
  -v $(pwd)/data:/app/data \
  memecoin-analyzer
```

## 📈 Monitoring

### Health Check
- Endpoint: `http://localhost:3001/health`
- Returns system status and component health

### Metrics
- Prometheus endpoint: `http://localhost:9090/metrics`
- Tracks analysis cycles, API calls, notifications

### Logging
- Structured JSON logging
- Configurable log levels
- Correlation IDs for request tracing

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SOLANA_TRACKER_API_KEY` | API key for Solana Tracker | Required |
| `DISCORD_WEBHOOK_URL` | Discord webhook for notifications | Required |
| `MARKET_CAP_MIN` | Minimum market cap filter | 5000000 |
| `MARKET_CAP_MAX` | Maximum market cap filter | 50000000 |
| `ANALYSIS_INTERVAL` | Minutes between analyses | 5 |
| `MIN_RATING_THRESHOLD` | Minimum rating for alerts | 7 |

See `.env.example` for complete configuration options.

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [Claude Code](https://claude.ai/code) using agent-driven development
- Powered by [Solana Tracker API](https://solanatracker.io)
- Technical analysis algorithms inspired by industry standards

## ⚠️ Disclaimer

This tool is for educational and informational purposes only. Cryptocurrency trading involves substantial risk of loss. Always do your own research and never invest more than you can afford to lose.

---

**Need Help?** Open an issue or join our [Discord community](https://discord.gg/your-invite)