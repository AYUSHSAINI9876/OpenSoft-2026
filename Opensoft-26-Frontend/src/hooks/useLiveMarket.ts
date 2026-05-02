/**
 * useLiveMarket – WebSocket-backed MarketFeed with REST Order Integration
 *
 * Connects to the backend WebSocket for real-time market data and handles 
 * trade execution via the REST API from services/api.ts.
 */

import { useEffect, useMemo, useState } from 'react'
import type { BookLevel, CandlePoint, MarketSnapshot, OpenOrder, TradeRequest } from '../types/market'
import type { MarketFeed } from './useMockMarket'
import { indianStocks, terminalUniverse } from '../data/marketData'
import * as api from '../services/api'
import type { CandleRaw } from '../services/api'

// ─── Public status type ─────────────────────────────────────────────────────

export type WsStatus = 'connecting' | 'connected' | 'disconnected'

import type { PortfolioSnapshot } from './usePortfolio';

export type OrderNotice = {
  level: 'error' | 'success'
  message: string
  timestamp: number
}

export type LiveMarketFeed = MarketFeed & {
  wsStatus: WsStatus;
  onStatusChange: (cb: (s: WsStatus) => void) => () => void;
  subscribeSymbol: (symbol: string) => void;
  /** When split chart is open, pass the secondary symbol so it receives trade/candle/depth (not just ticker). */
  setSplitComparisonSymbol: (symbol: string | null) => void;
  getSymbolCandles: (symbol: string) => { candles1s: CandlePoint[]; candles5s: CandlePoint[] };
  onPortfolioUpdate: (cb: (snapshot: PortfolioSnapshot) => void) => () => void;
  onOrderNotice: (cb: (notice: OrderNotice) => void) => () => void;
  getPortfolioSnapshot: () => Promise<PortfolioSnapshot | null>;
};

// ─── Internal types ──────────────────────────────────────────────────────────

type PerSymbolState = {
  lastPrice: number
  prevPrice: number
  bids: BookLevel[]
  asks: BookLevel[]
  candles1s: CandlePoint[]
  candles5s: CandlePoint[]
  openPrice: number
}

type MutableEngine = {
  symbols: Record<string, PerSymbolState>
  cashBalance: number
  positions: MarketSnapshot['positions']
  fills: MarketSnapshot['fills']
  openOrders: OpenOrder[]
  fillId: number
  activeSymbol: string
  /** Second symbol subscribed to full WS feed while split chart is open (not primary). */
  splitComparisonSymbol: string | null
  orderIdSeed: number
}

type PortfolioPositionWire = {
  symbol: string
  quantity: number
  avg_entry: number
  mark_price: number
  pnl: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const centsToPrice = (cents: number): number => Number((cents / 100).toFixed(2))

/** Accept number, numeric string, or common alternate JSON keys from APIs. */
function parseVolumeField(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.max(0, v)
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    if (Number.isFinite(n)) return Math.max(0, n)
  }
  return 0
}

function rawToCandles(data: CandleRaw[]): CandlePoint[] {
  return data.map((c) => {
    const row = c as CandleRaw & { Volume?: unknown }
    const vol = parseVolumeField(row.volume ?? row.Volume)
    return {
      time: c.time,
      open: centsToPrice(c.open),
      high: centsToPrice(c.high),
      low: centsToPrice(c.low),
      close: centsToPrice(c.close),
      volume: vol,
    }
  })
}

function formatOrderSuccessMessage(
  request: TradeRequest,
  hasStop: boolean,
  apiMessage?: string,
): string {
  const kind = hasStop
    ? (request.orderType === 'market' ? 'stop' : 'stop-limit')
    : request.orderType
  const action = request.action === 'buy' ? 'Buy' : 'Sell'
  const summary = `${action} ${request.quantity} ${request.asset} (${kind})`
  const base = typeof apiMessage === 'string' ? apiMessage.trim() : ''
  return base.length > 0 ? `${base} · ${summary}` : `Order accepted · ${summary}`
}

function isPortfolioPositionWire(value: unknown): value is PortfolioPositionWire {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return typeof v.symbol === 'string'
    && typeof v.quantity === 'number'
    && typeof v.avg_entry === 'number'
    && typeof v.mark_price === 'number'
    && typeof v.pnl === 'number'
}

function isPortfolioSnapshotWire(value: unknown): value is PortfolioSnapshot {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return typeof v.available_cash === 'number'
    && Array.isArray(v.positions)
    && v.positions.every((p) => isPortfolioPositionWire(p))
}

function updateCandles(candles: CandlePoint[], timeSec: number, price: number, tradeQty = 0): void {
  const last = candles[candles.length - 1]
  if (!last) {
    candles.push({ time: timeSec, open: price, high: price, low: price, close: price, volume: tradeQty })
    return
  }
  if (timeSec > last.time) {
    candles.push({ time: timeSec, open: price, high: price, low: price, close: price, volume: tradeQty })
    if (candles.length > 1800) candles.splice(0, candles.length - 1800)
    return
  }
  if (timeSec === last.time) {
    last.high = Math.max(last.high, price)
    last.low = Math.min(last.low, price)
    last.close = price
    last.volume = (last.volume ?? 0) + tradeQty
  }
  if (timeSec < last.time) {
    last.high = Math.max(last.high, price)
    last.low = Math.min(last.low, price)
  }
}

function depthToBookLevels(
  levels: { price: number; volume: number }[],
  side: 'bid' | 'ask',
): BookLevel[] {
  const now = Date.now()
  let cum = 0
  return levels.map((lvl) => {
    cum += lvl.volume
    return {
      price: centsToPrice(lvl.price),
      quantity: lvl.volume,
      cumulative: cum,
      flashUntil: now + 120,
    }
  }).sort((a, b) => side === 'bid' ? b.price - a.price : a.price - b.price)
}

function buildSyntheticBook(center: number, side: 'bid' | 'ask', levels = 14): BookLevel[] {
  const tick = center < 100 ? 0.01 : center < 1000 ? 0.05 : center < 5000 ? 0.1 : 0.5
  let cum = 0
  const now = Date.now()
  return Array.from({ length: levels }, (_, i) => {
    const price = side === 'bid'
      ? Number((center - tick * (i + 1)).toFixed(2))
      : Number((center + tick * (i + 1)).toFixed(2))
    const qty = Number((Math.random() * 5 + 1).toFixed(3))
    cum += qty
    return { price, quantity: qty, cumulative: Number(cum.toFixed(3)), flashUntil: now + 150 }
  })
}

function initialPerSymbol(price: number): PerSymbolState {
  return {
    lastPrice: price,
    prevPrice: price,
    bids: buildSyntheticBook(price, 'bid'),
    asks: buildSyntheticBook(price, 'ask'),
    candles1s: [],
    candles5s: [],
    openPrice: price,
  }
}

function buildSnapshot(engine: MutableEngine): MarketSnapshot {
  const entries = Object.entries(engine.symbols)
  const active = engine.symbols[engine.activeSymbol] || entries[0]?.[1]

  const trendingStocks = entries.map(([symbol, state]) => ({
    symbol,
    price: state.lastPrice,
    changePct: state.openPrice > 0
      ? Number((((state.lastPrice - state.openPrice) / state.openPrice) * 100).toFixed(2))
      : 0,
    volume: 500_000,
  }))

  const positions = engine.positions.map((pos) => {
    const sym = engine.symbols[pos.asset]
    const mark = sym?.lastPrice ?? pos.markPrice
    return {
      ...pos,
      markPrice: mark,
      pnl: Number(((mark - pos.entryPrice) * pos.quantity).toFixed(2)),
    }
  })

  return {
    activeSymbol: engine.activeSymbol,
    lastPrice: active?.lastPrice ?? 0,
    tickDirection: active && active.lastPrice > active.prevPrice ? 1
      : active && active.lastPrice < active.prevPrice ? -1 : 0,
    bids: active?.bids ?? [],
    asks: active?.asks ?? [],
    candles1s: active?.candles1s ?? [],
    candles5s: active?.candles5s ?? [],
    cashBalance: engine.cashBalance,
    positions,
    fills: engine.fills,
    openOrders: engine.openOrders,
    trendingStocks,
  }
}

function cloneSnapshot(s: MarketSnapshot): MarketSnapshot {
  return {
    activeSymbol: s.activeSymbol,
    lastPrice: s.lastPrice,
    tickDirection: s.tickDirection,
    bids: s.bids.map((r) => ({ ...r })),
    asks: s.asks.map((r) => ({ ...r })),
    candles1s: s.candles1s.map((r) => ({ ...r })),
    candles5s: s.candles5s.map((r) => ({ ...r })),
    cashBalance: s.cashBalance,
    positions: s.positions.map((r) => ({ ...r })),
    fills: s.fills.map((r) => ({ ...r })),
    openOrders: s.openOrders.map((r) => ({ ...r })),
    trendingStocks: s.trendingStocks.map((r) => ({ ...r })),
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

const getWsUrl = () => {
  const apiBase = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8080') as string
  let wsBase = 'ws://127.0.0.1:8080'
  try {
    if (apiBase.startsWith('http')) {
      const url = new URL(apiBase)
      wsBase = `${url.protocol === 'https:' ? 'wss:' : 'ws:'}//${url.host}`
    } else if (typeof window !== 'undefined') {
      wsBase = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`
    }
  } catch {
    wsBase = apiBase.replace(/^http/, 'ws')
  }
  const token = localStorage.getItem('token')
  const wsUrl = new URL('/ws', wsBase)
  // Backend currently authenticates websocket via query param token.
  if (token) wsUrl.searchParams.set('token', token)
  return wsUrl.toString()
}
const RECONNECT_DELAY_MS = 3000
const PING_INTERVAL_MS = 30_000

export function createLiveMarketFeed(preferredActiveSymbol = ''): LiveMarketFeed {
  // Static metadata lookup for initial prices (fallback if API is unreachable)
  const symbolMeta = new Map<string, { price: number }>()
  for (const { symbol, price } of terminalUniverse) {
    symbolMeta.set(symbol, { price })
  }

  // Start empty — populated from backend API on first connect
  const engine: MutableEngine = {
    symbols: {},
    cashBalance: 100_000,
    positions: [],
    fills: [],
    openOrders: [],
    fillId: 0,
    activeSymbol: '',
    splitComparisonSymbol: null,
    orderIdSeed: 5000,
  }

  let snapshot: MarketSnapshot = buildSnapshot(engine)
  const listeners = new Set<(s: MarketSnapshot) => void>()
  const statusListeners = new Set<(s: WsStatus) => void>()
  const portfolioListeners = new Set<(snapshot: PortfolioSnapshot) => void>()
  const orderNoticeListeners = new Set<(notice: OrderNotice) => void>()
  let currentStatus: WsStatus = 'connecting'
  let ws: WebSocket | null = null
  let destroyed = false
  let pingTimer: ReturnType<typeof setInterval> | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let connectTimeoutTimer: ReturnType<typeof setTimeout> | null = null
  let ordersRefreshTimer: ReturnType<typeof setTimeout> | null = null

  const setStatus = (s: WsStatus) => {
    if (currentStatus === s) return
    currentStatus = s
    statusListeners.forEach((cb) => cb(s))
  }

  const publish = () => {
    snapshot = buildSnapshot(engine)
    listeners.forEach((cb) => cb(cloneSnapshot(snapshot)))
  }

  const emitOrderNotice = (level: OrderNotice['level'], message: string) => {
    const trimmed = message.trim()
    const notice: OrderNotice = {
      level,
      message: trimmed.length > 0 ? trimmed : 'Order request failed',
      timestamp: Date.now(),
    }
    orderNoticeListeners.forEach((cb) => cb(notice))
  }

  const emitOrderError = (message: string) => emitOrderNotice('error', message)
  const emitOrderSuccess = (message: string) => emitOrderNotice('success', message)

  const applyTradesToPortfolio = (asset: string, trades: api.Trade[], action: 'buy' | 'sell') => {
    if (!trades || trades.length === 0) return
    for (const trade of trades) {
      const realPrice = trade.price / 100
      const qty = trade.qty
      const signedDelta = action === 'buy' ? qty : -qty
      engine.cashBalance -= signedDelta * realPrice
      const idx = engine.positions.findIndex(p => p.asset === asset)
      if (idx >= 0) {
        const current = engine.positions[idx]
        const nextQuantity = current.quantity + signedDelta
        let nextEntry = current.entryPrice
        if ((current.quantity >= 0 && signedDelta > 0) || (current.quantity <= 0 && signedDelta < 0)) {
          nextEntry = ((Math.abs(current.quantity) * current.entryPrice) + (qty * realPrice)) / (Math.abs(current.quantity) + qty)
        } else if (nextQuantity === 0) {
          nextEntry = realPrice
        } else if (Math.sign(current.quantity) !== Math.sign(nextQuantity)) {
          nextEntry = realPrice
        }
        engine.positions[idx] = { ...current, quantity: nextQuantity, entryPrice: nextEntry, markPrice: realPrice, pnl: (realPrice - nextEntry) * nextQuantity }
      } else {
        engine.positions.push({ asset, quantity: signedDelta, entryPrice: realPrice, markPrice: realPrice, pnl: 0 })
      }
      engine.fills.unshift({ id: ++engine.fillId, asset, action, direction: action === 'buy' ? 'long' : 'short', quantity: qty, price: realPrice, timestamp: Date.now() })
      if (engine.fills.length > 50) engine.fills.pop()
    }
  }

  let publishScheduled = false
  let symbolSwitching = false
  const schedulePublish = () => {
    if (symbolSwitching) return
    if (!publishScheduled) {
      publishScheduled = true
      queueMicrotask(() => {
        publishScheduled = false
        if (!symbolSwitching) publish()
      })
    }
  }

  const handleMessage = (raw: string) => {
    const parts = raw.split('\n')
    for (const part of parts) {
      const trimmed = part.trim()
      if (!trimmed) continue
      let parsed: unknown
      try { parsed = JSON.parse(trimmed) } catch { continue }
      const msg = parsed as { type?: string; symbol?: string; data?: Record<string, unknown> }
      const type = String(msg.type || '')
      if (['connected', 'success', 'pong', 'trade', 'ticker', 'depth', 'candle', 'portfolio', 'status'].includes(type)) {
        if (connectTimeoutTimer) { clearTimeout(connectTimeoutTimer); connectTimeoutTimer = null }
        setStatus('connected')
      }

      if (type === 'trade') {
        const sym = String(msg.symbol || '')
        const data = msg.data || {}
        const tmpPrice = Number(data.price)
        const validPrice = (isNaN(tmpPrice) || tmpPrice <= 0) ? (engine.symbols[sym]?.lastPrice || 0) : centsToPrice(tmpPrice)
        if (!engine.symbols[sym]) engine.symbols[sym] = initialPerSymbol(validPrice)
        const state = engine.symbols[sym]
        state.prevPrice = state.lastPrice
        state.lastPrice = validPrice || state.lastPrice
        const nowSec = Math.floor(Number(data.timestamp) / 1000)
        const qty = typeof data.quantity === 'number' && Number.isFinite(data.quantity) ? data.quantity : 0
        updateCandles(state.candles1s, nowSec, state.lastPrice, qty)
        updateCandles(state.candles5s, Math.floor(nowSec / 5) * 5, state.lastPrice, qty)
        schedulePublish()
      } else if (type === 'ticker') {
        const sym = String(msg.symbol || '')
        const data = msg.data || {}
        const tmpPrice = Number(data.last_price)
        const validPrice = (isNaN(tmpPrice) || tmpPrice <= 0) ? (engine.symbols[sym]?.lastPrice || 0) : centsToPrice(tmpPrice)
        if (!engine.symbols[sym]) engine.symbols[sym] = initialPerSymbol(validPrice)
        const state = engine.symbols[sym]
        state.prevPrice = state.lastPrice
        state.lastPrice = validPrice || state.lastPrice
        if (state.bids.length === 0) {
          state.bids = buildSyntheticBook(centsToPrice(Number(data.best_bid)), 'bid')
          state.asks = buildSyntheticBook(centsToPrice(Number(data.best_ask)), 'ask')
        }
        schedulePublish()
      } else if (type === 'depth' || type === 'orderbook') {
        const sym = String(msg.symbol || '')
        const data = msg.data || {}
        const tmpPrice = Number(data.lastPrice ?? data.last_price)
        const validPrice = (isNaN(tmpPrice) || tmpPrice <= 0) ? (engine.symbols[sym]?.lastPrice || 0) : centsToPrice(tmpPrice)
        if (!engine.symbols[sym]) engine.symbols[sym] = initialPerSymbol(validPrice)
        const state = engine.symbols[sym]
        state.prevPrice = state.lastPrice
        state.lastPrice = validPrice || state.lastPrice
        const normalizeLevels = (levels: Array<Record<string, unknown>>) => levels.map((lvl) => ({
          price: Number(lvl.price),
          volume: Number(lvl.volume ?? lvl.quantity ?? 0),
        }))
        const bids = Array.isArray(data.bids) ? (data.bids as Array<Record<string, unknown>>) : []
        const asks = Array.isArray(data.asks) ? (data.asks as Array<Record<string, unknown>>) : []
        if (bids.length > 0) state.bids = depthToBookLevels(normalizeLevels(bids), 'bid')
        if (asks.length > 0) state.asks = depthToBookLevels(normalizeLevels(asks), 'ask')
        schedulePublish()
      } else if (type === 'candle') {
        const sym = String(msg.symbol || '')
        const data = msg.data || {}
        const tmpPrice = Number(data.close)
        const validPrice = (isNaN(tmpPrice) || tmpPrice <= 0) ? (engine.symbols[sym]?.lastPrice || 0) : centsToPrice(tmpPrice)
        const state = engine.symbols[sym] || (engine.symbols[sym] = initialPerSymbol(validPrice))
        const timeSec = Math.floor(Number(data.timestamp) / 1000)
        const targetArr = Number(data.interval) === 5 ? state.candles5s : state.candles1s
        const last = targetArr[targetArr.length - 1]

        const parsePrice = (c: unknown) => {
          const v = Number(c)
          return (isNaN(v) || v <= 0) ? state.lastPrice : centsToPrice(v)
        }
        const vol = parseVolumeField(data.volume ?? data.Volume)
        const candle: CandlePoint = {
          time: timeSec,
          open: parsePrice(data.open),
          high: parsePrice(data.high),
          low: parsePrice(data.low),
          close: parsePrice(data.close),
          volume: vol,
        }

        // Fix: backend GBM-tick candles may have High < Close or Low > Close
        // because updateOHLC only sets Close without tracking High/Low.
        // Enforce the OHLC invariant so the chart library renders correctly.
        candle.high = Math.max(candle.open, candle.high, candle.close)
        candle.low = Math.min(candle.open, candle.low, candle.close)

        if (!last || timeSec > last.time) {
          targetArr.push(candle)
          if (targetArr.length > 1800) targetArr.shift()
        } else if (timeSec === last.time) {
          // Merge: the local candle may have wider H/L from trade events
          // that the backend's GBM-only partial candle doesn't reflect.
          candle.high = Math.max(candle.high, last.high)
          candle.low = Math.min(candle.low, last.low)
          targetArr[targetArr.length - 1] = candle
        }
        schedulePublish()
      } else if (type === 'portfolio') {
        if (!isPortfolioSnapshotWire(msg.data)) {
          console.warn('[useLiveMarket] Ignoring malformed portfolio payload', msg.data)
          continue
        }
        const portfolioSnapshot = msg.data
        engine.cashBalance = portfolioSnapshot.available_cash
        engine.positions = portfolioSnapshot.positions.map((p) => ({
          asset: p.symbol,
          quantity: p.quantity,
          entryPrice: p.avg_entry,
          markPrice: p.mark_price,
          pnl: p.pnl,
        }))
        portfolioListeners.forEach((cb) => cb(portfolioSnapshot))
        schedulePublish()
        scheduleOrdersRefresh()
      }
    }
  }

  /** Primary + optional split comparison get `all` events; every other known symbol stays on `ticker` only. */
  const applyWsSubscriptions = () => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    const syms = Object.keys(engine.symbols)
    if (syms.length === 0) return
    const full = new Set<string>()
    if (engine.activeSymbol) full.add(engine.activeSymbol)
    const split = engine.splitComparisonSymbol
    if (split && split !== engine.activeSymbol) full.add(split)
    for (const sym of syms) {
      if (full.has(sym)) {
        ws.send(JSON.stringify({ action: 'subscribe', symbols: [sym], event: 'all' }))
      } else {
        ws.send(JSON.stringify({ action: 'unsubscribe', symbols: [sym], event: 'all' }))
        ws.send(JSON.stringify({ action: 'subscribe', symbols: [sym], event: 'ticker' }))
      }
    }
  }

  const mergeCandles = (historical: CandlePoint[], live: CandlePoint[]): CandlePoint[] => {
    if (!historical.length) return live
    if (!live.length) return historical
    const earliestLive = live[0].time
    const older = historical.filter(c => c.time < earliestLive)
    const merged = [...older, ...live]
    if (merged.length > 1800) merged.splice(0, merged.length - 1800)
    return merged
  }

  const fetchAndSeedHistory = async (symbols: string[]) => {
    const results = await Promise.allSettled(
      symbols.map(sym =>
        api.getCandles(sym, '1s', 1800).then(raw1s => ({ sym, raw1s }))
      )
    )
    let changed = false
    for (const result of results) {
      if (result.status !== 'fulfilled') continue
      const { sym, raw1s } = result.value
      const state = engine.symbols[sym]
      if (!state) continue
      if (raw1s.length) {
        state.candles1s = mergeCandles(rawToCandles(raw1s), state.candles1s)
        changed = true
      }
    }
    if (changed) schedulePublish()
  }

  const fetchAndSeedOrders = async () => {
    try {
      const resp = await api.listOpenOrders()
      if (resp.success && resp.data?.orders) {
        let changed = false
        engine.openOrders = []
        engine.fills = []
        for (const o of resp.data.orders) {
          const status = String(o.status || '').toLowerCase()
          if (status === 'open' || status.includes('partial')) {
            engine.openOrders.push({
              id: String(o.id),
              asset: o.asset,
              action: o.action.toLowerCase() as 'buy' | 'sell',
              direction: o.action.toLowerCase() === 'buy' ? 'long' : 'short',
              quantity: o.quantity,
              limitPrice: o.limitPrice || 0,
              timestamp: o.timestamp,
            })
            changed = true
          } else if (status === 'filled') {
            engine.fills.push({
              id: Number(o.id) || 0,
              asset: o.asset,
              action: o.action.toLowerCase() as 'buy' | 'sell',
              quantity: o.filled_qty || o.quantity,
              price: o.avgPrice || o.limitPrice || 0,
              timestamp: o.timestamp,
              direction: o.action.toLowerCase() === 'buy' ? 'long' : 'short',
            })
            changed = true
          }
        }
        if (changed) schedulePublish()
      }
    } catch { /* ignore */ }
  }

  const scheduleOrdersRefresh = () => {
    if (ordersRefreshTimer) return
    ordersRefreshTimer = setTimeout(() => {
      ordersRefreshTimer = null
      fetchAndSeedOrders().catch(() => { /* ignore */ })
    }, 250)
  }

  const connect = async () => {
    if (destroyed) return
    setStatus('connecting')
    if (connectTimeoutTimer) clearTimeout(connectTimeoutTimer)

    if (Object.keys(engine.symbols).length === 0) {
      try {
        const res = await api.listActiveBooks()
        if (res.success && res.data?.symbols?.length) {
          for (const sym of res.data.symbols) {
            engine.symbols[sym] = initialPerSymbol(symbolMeta.get(sym)?.price ?? 100)
          }
        }
      } catch { /* API unreachable — fall back below */ }
      if (Object.keys(engine.symbols).length === 0) {
        // Avoid loading unsupported community/index symbols when backend discovery fails.
        for (const { symbol, price } of indianStocks) {
          engine.symbols[symbol] = initialPerSymbol(price)
        }
      }
      const symbolKeys = Object.keys(engine.symbols)
      const defaultFirst = symbolKeys[0] ?? 'RELIANCE'
      engine.activeSymbol =
        preferredActiveSymbol && engine.symbols[preferredActiveSymbol]
          ? preferredActiveSymbol
          : defaultFirst

      await fetchAndSeedHistory(symbolKeys)
      await fetchAndSeedOrders()
      publish()
    }

    try {
      ws = new WebSocket(getWsUrl())
      connectTimeoutTimer = setTimeout(() => {
        if (currentStatus !== 'connected' && ws) ws.close()
      }, 3000)
    } catch { scheduleReconnect(); return }

    ws.onopen = () => {
      const allSymbols = Object.keys(engine.symbols)
      ws!.send(JSON.stringify({ action: 'subscribe', symbols: allSymbols, event: 'ticker' }))
      applyWsSubscriptions()
      ws!.send(JSON.stringify({ action: 'subscribe', symbols: ['*'], event: 'portfolio' }))
      if (pingTimer) clearInterval(pingTimer)
      pingTimer = setInterval(() => {
        if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ action: 'ping' }))
      }, PING_INTERVAL_MS)
    }
    ws.onmessage = (e) => handleMessage(e.data)
    ws.onclose = () => {
      if (pingTimer) { clearInterval(pingTimer); pingTimer = null }
      if (connectTimeoutTimer) { clearTimeout(connectTimeoutTimer); connectTimeoutTimer = null }
      if (!destroyed) { setStatus('disconnected'); scheduleReconnect() }
    }
  }

  const scheduleReconnect = () => {
    if (destroyed) return
    if (reconnectTimer) clearTimeout(reconnectTimer)
    reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS)
  }

  connect()

  return {
    wsStatus: currentStatus,
    onStatusChange: (cb) => { cb(currentStatus); statusListeners.add(cb); return () => statusListeners.delete(cb) },
    getSnapshot: () => cloneSnapshot(snapshot),
    subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener) },
    executeOrder: async (request: TradeRequest) => {
      const isMarket = request.orderType === 'market';
      const hasStop = request.stopLoss !== undefined && request.stopLoss > 0;
      const stopPriceTicks = hasStop ? Math.round(request.stopLoss! * 100) : 0;

      if (isMarket) {
        try {
          let res;
          if (hasStop) {
            res = await api.submitStopOrder(request.asset, request.action, request.quantity, stopPriceTicks);
          } else {
            res = await api.submitMarketOrder(request.asset, request.action, request.quantity);
          }

          if (!res.success) {
            emitOrderError(res.error || res.message || 'Market order failed')
            return
          }

          if (res.success) {
            if (res.data?.trades && res.data.trades.length > 0) {
              applyTradesToPortfolio(request.asset, res.data.trades as api.Trade[], request.action)
            }
            // Portfolio state will be updated via WebSocket 'portfolio' message
            // We can optimistically update open orders if an ID is returned
            if (res.data?.order_id) {
              const remainingQty = request.quantity - ((res.data.trades as api.Trade[] | undefined)?.reduce((sum: number, t) => sum + (t.qty || 0), 0) || 0);
              if (remainingQty > 0) {
                engine.openOrders.unshift({
                  id: res.data.order_id.toString(),
                  asset: request.asset,
                  action: request.action,
                  direction: request.direction,
                  quantity: remainingQty,
                  limitPrice: request.limitPrice,
                  timestamp: Date.now(),
                });
                schedulePublish();
              }
            }
            emitOrderSuccess(formatOrderSuccessMessage(request, hasStop, res.message))
          } else if (res.error) {
            window.alert(`Order Failed: ${res.error}`);
          }
        } catch (e: any) {
          console.error(e);
          window.alert(`Execution Error: ${e.message || 'Unknown error'}`);
        }
      } else {
        try {
          const limitPriceTicks = request.limitPrice ? Math.round(request.limitPrice * 100) : 0;
          let res;
          if (hasStop) {
            res = await api.submitStopLimitOrder(request.asset, request.action, request.quantity, limitPriceTicks, stopPriceTicks);
          } else {
            res = await api.submitLimitOrder(request.asset, request.action, request.quantity, limitPriceTicks);
          }

          if (!res.success) {
            emitOrderError(res.error || res.message || 'Limit order failed')
            return
          }

          if (res.success && res.data) {
            let filledQty = 0;
            if (res.data.trades && res.data.trades.length > 0) {
              applyTradesToPortfolio(request.asset, res.data.trades, request.action);
              filledQty = (res.data.trades as api.Trade[]).reduce((sum: number, t) => sum + (t.qty || 0), 0);
            }
            const remainingQty = request.quantity - filledQty;
            if (remainingQty > 0) {
              engine.openOrders.unshift({
                id: (res.data.order_id || engine.orderIdSeed++).toString(),
                asset: request.asset,
                action: request.action,
                direction: request.direction,
                quantity: remainingQty,
                limitPrice: request.limitPrice,
                timestamp: Date.now(),
              });
            }
            publish();
            emitOrderSuccess(formatOrderSuccessMessage(request, hasStop, res.message))
          } else if (res.error) {
            window.alert(`Order Failed: ${res.error}`);
          }
        } catch (e: any) {
          console.error(e);
          window.alert(`Execution Error: ${e.message || 'Unknown error'}`);
        }
      }
    },
    cancelOrder: async (id) => {
      const order = engine.openOrders.find(o => o.id === id)
      if (order) {
        try {
          await api.cancelLimitOrder(order.asset, parseInt(id, 10))
          engine.openOrders = engine.openOrders.filter(o => o.id !== id)
          publish()
        } catch (e) { console.error(e) }
      }
    },
    modifyOrder: async (id, updates) => {
      const order = engine.openOrders.find(o => o.id === id)
      if (order) {
        try {
          const resolvedLimitPrice = updates.limitPrice ?? order.limitPrice ?? 0
          await api.modifyLimitOrder(order.asset, parseInt(id, 10), updates.quantity ?? order.quantity, Math.round(resolvedLimitPrice * 100))
          engine.openOrders = engine.openOrders.map(o => o.id === id ? { ...o, ...updates } : o)
          publish()
        } catch (e) { console.error(e) }
      }
    },
    subscribeSymbol: (symbol: string) => {
      if (symbol === engine.activeSymbol) return
      engine.activeSymbol = symbol
      symbolSwitching = true
      applyWsSubscriptions()
      fetchAndSeedHistory([symbol])
        .finally(() => { symbolSwitching = false; publish() })
    },
    setSplitComparisonSymbol: (symbol: string | null) => {
      engine.splitComparisonSymbol = symbol && symbol.trim() !== '' ? symbol : null
      applyWsSubscriptions()
      if (engine.splitComparisonSymbol) {
        symbolSwitching = true
        fetchAndSeedHistory([engine.splitComparisonSymbol])
          .finally(() => { symbolSwitching = false; publish() })
      }
    },
    getSymbolCandles: (symbol: string) => {
      const s = engine.symbols[symbol]
      if (!s) return { candles1s: [], candles5s: [] }
      return {
        candles1s: s.candles1s.map(c => ({ ...c })),
        candles5s: s.candles5s.map(c => ({ ...c })),
      }
    },
    onPortfolioUpdate: (cb) => {
      portfolioListeners.add(cb)
      return () => portfolioListeners.delete(cb)
    },
    onOrderNotice: (cb) => {
      orderNoticeListeners.add(cb)
      return () => orderNoticeListeners.delete(cb)
    },
    getPortfolioSnapshot: async () => {
      const res = await api.getPortfolio()
      if (res.success && res.data) return res.data as PortfolioSnapshot
      return null
    },
    destroy: () => {
      destroyed = true
      if (pingTimer) clearInterval(pingTimer)
      if (reconnectTimer) clearTimeout(reconnectTimer)
      if (connectTimeoutTimer) clearTimeout(connectTimeoutTimer)
      if (ordersRefreshTimer) clearTimeout(ordersRefreshTimer)
      ws?.close()
      ws = null
    }
  }
}

// ─── Shared singleton (one WebSocket connection across all hook consumers) ────
let _sharedFeed: LiveMarketFeed | null = null
let _sharedConsumers = 0

// Default empty snapshot returned before the feed is ready.
const _emptySnapshot: MarketSnapshot = {
  activeSymbol: '', lastPrice: 0, tickDirection: 0, bids: [], asks: [],
  candles1s: [], candles5s: [], cashBalance: 100_000,
  positions: [], fills: [], openOrders: [], trendingStocks: [],
}

export function useLiveMarket(activeSymbol?: string): LiveMarketFeed {
  const [status, setStatus] = useState<WsStatus>('connecting')

  // ── Feed lifecycle (handles StrictMode double-invoke) ────────────────────
  useEffect(() => {
    if (!_sharedFeed) {
      _sharedFeed = createLiveMarketFeed(activeSymbol)
    }
    _sharedConsumers++
    const feed = _sharedFeed!
    
    setStatus(feed.wsStatus)
    const unsub = feed.onStatusChange(setStatus)
    
    return () => {
      unsub()
      _sharedConsumers = Math.max(0, _sharedConsumers - 1)
      if (_sharedConsumers === 0 && _sharedFeed) {
        _sharedFeed.destroy()
        _sharedFeed = null
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return useMemo(
    () => ({
      wsStatus: status,
      onStatusChange: (cb) => _sharedFeed?.onStatusChange(cb) ?? (() => {}),
      getSnapshot: () => _sharedFeed?.getSnapshot() ?? _emptySnapshot,
      subscribe: (cb) => _sharedFeed?.subscribe(cb) ?? (() => {}),
      subscribeSymbol: (sym) => { _sharedFeed?.subscribeSymbol(sym) },
      setSplitComparisonSymbol: (sym) => { _sharedFeed?.setSplitComparisonSymbol(sym) },
      getSymbolCandles: (sym) => _sharedFeed?.getSymbolCandles(sym) ?? { candles1s: [], candles5s: [] },
      onPortfolioUpdate: (cb) => _sharedFeed?.onPortfolioUpdate(cb) ?? (() => {}),
      onOrderNotice: (cb) => _sharedFeed?.onOrderNotice(cb) ?? (() => {}),
      getPortfolioSnapshot: () => _sharedFeed?.getPortfolioSnapshot() ?? Promise.resolve(null),
      executeOrder: (req) => _sharedFeed?.executeOrder(req) ?? Promise.reject(new Error('feed not ready')),
      cancelOrder: (id) => { _sharedFeed?.cancelOrder(id) },
      modifyOrder: (id, u) => { _sharedFeed?.modifyOrder(id, u) },
      destroy: () => { _sharedFeed?.destroy() },
    }),
    [status],
  )
}
