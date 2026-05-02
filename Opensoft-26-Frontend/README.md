# OakCapital — Frontend

React 19 trading terminal for the OakCapital platform.

## What This Does

A professional-grade web trading terminal that:

- **Streams live market data** from the Go backend via WebSocket — order book, trades, candles, portfolio updates at 10 Hz
- **Renders interactive charts** using TradingView Lightweight Charts v5 with candlestick, line, and area modes, multi-timeframe (1s / 5s), and a split-pane dual-chart view with draggable divider
- **Provides a full drawing toolkit** — trend lines, Fibonacci retracements, horizontal rays, geometric shapes, and measurement overlays via a custom 38 KB SVG overlay
- **Handles manual trading** — limit and market orders, long/short, stop-loss / take-profit, global keyboard shortcuts
- **Displays the order book** live with colour-coded volume bars and depth visualisation
- **Shows portfolio state** — real-time P&L, holdings breakdown, asset distribution charts, trade history, and a global leaderboard
- **Manages bots** — Alpha Bot configuration, Bulbul BYOB visual node-graph strategy builder, and custom Python/JS script upload
- **Handles auth** — register, login, forgot password flow with JWT session management

## Structure

```
src/
  components/
    TerminalLayout.tsx      ← main trading terminal layout and panel management
    DesktopPage.tsx         ← desktop landing page
    PortfolioPage.tsx       ← portfolio dashboard with P&L and holdings
    SettingsPage.tsx        ← user settings
    markets/
      MarketsPage.tsx       ← market overview, asset discovery, heatmap
    terminal/
      ChartPanel.tsx        ← charting engine (Lightweight Charts + SVG overlay)
    alphaBot/               ← Alpha Bot UI and configuration
    bulbul/                 ← Bulbul BYOB visual node graph editor

  hooks/
    useLiveMarket.ts        ← WebSocket connection, reconnect, message parsing, state
    useAlphaBot.ts          ← Alpha Bot state management and node editor logic
    useMockMarket.ts        ← offline development mock data
    usePortfolio.ts         ← portfolio data fetching and real-time updates
    useTradeControls.ts     ← order placement form state
```

## Running

```bash
# From the root opensoft/ directory:
docker compose up --build

# Or run frontend only:
cd Opensoft-26-Frontend
docker compose up --build
```

Frontend available at `http://localhost:3976`

## Technical Highlights

- **Throttled flush** — WebSocket messages are buffered in a ref and flushed to React state every 100 ms, keeping the UI at 60 FPS even during 600+ packets/sec bursts
- **Split-pane charts** — two independent chart instances share a single time axis with pane-aware coordinate mapping for the SVG drawing overlay
- **Exponential backoff reconnect** — `useLiveMarket` automatically reconnects on WebSocket drop with capped backoff, preserving subscriptions
- **Lightweight Charts v5** — all OHLCV rendering, technical indicators (EMA, RSI, MACD, Bollinger Bands, VWAP, Supertrend), and real-time candle updates go through a single chart manager instance to avoid re-mount cost
