# BTC Dashboard

Real-time Bitcoin dashboard with technical indicators, market sentiment analysis, and buy/sell recommendations.

![Next.js](https://img.shields.io/badge/Next.js-14-black) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue) ![Tailwind](https://img.shields.io/badge/Tailwind-3-38bdf8)

## Features

- **Two modes**: Long-term investing and short-term day trading tabs
- **11 weighted indicators** for long-term scoring (RSI, MACD, MA cross, Bollinger Bands, Fear & Greed, cycle position, etc.)
- **6 intraday indicators** using Binance 1h candle data for short-term signals
- **Whale tracking** — top trader long/short ratios from Binance Futures
- **Interactive price chart** with MA, Bollinger Bands, and multiple timeframes
- **Auto-refresh** — market data every 60s, intraday data every 30s
- **Mobile responsive** dark theme UI

## Data Sources

| Source | Data |
|---|---|
| Binance | Price, candles (1h + 1d), volume, whale long/short ratios |
| CoinGecko | BTC dominance, market cap |
| Alternative.me | Fear & Greed Index |
| Mempool.space | Hashrate, mempool, fees, block data |

All APIs are public — no API keys required.

## Getting Started

```bash
# Clone
git clone https://github.com/villetoimela/btc-dashboard.git
cd btc-dashboard

# Install dependencies
npm install

# Run dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy

Works with Netlify, Vercel, or any platform that supports Next.js.

**Netlify:**
1. Import the repo from Git
2. Build command: `npm run build`
3. Framework: Next.js (auto-detected)

## Tech Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- TradingView Lightweight Charts
- Recharts
