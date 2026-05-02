import { useEffect, useRef, useState } from 'react'
import type { CandlePoint, MarketSnapshot, Side, TradeRequest, TradeAction, OpenOrder } from '../types/market'
import { terminalUniverse } from '../data/marketData'

const BACKEND_API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string) ?? 'http://localhost:8080/api/v1'
const BACKEND_API_URL = BACKEND_API_BASE_URL.replace(/\/+$/, '')

async function postToBackend<T>(path: string, payload: unknown): Promise<T> {
  const response = await fetch(`${BACKEND_API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(`Backend error ${response.status} ${response.statusText}`)
  }

  const body = (await response.json()) as { success: boolean; data?: T; error?: string; message?: string }
  if (!body.success) {
    throw new Error(body.error || body.message || 'Backend endpoint returned failure')
  }

  return body.data as T
}

type MutableBookLevel = {
  price: number
  quantity: number
  cumulative: number
  flashUntil: number
}

type MutableEngine = {
  lastPrice: number
  lastPublishedPrice: number
  bids: MutableBookLevel[]
  asks: MutableBookLevel[]
  candles1s: CandlePoint[]
  candles5s: CandlePoint[]
  cashBalance: number
  positions: MarketSnapshot['positions']
  fills: MarketSnapshot['fills']
  openOrders: OpenOrder[]
  trendingStocks: MarketSnapshot['trendingStocks']
  stockOpenMap: Record<string, number>
  stockTick: number
  stockCursor: number
  fillId: number
}

const gaussian = () => {
  let u = 0
  let v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

const buildBookSide = (
  side: Side,
  centerPrice: number,
  levels: number,
  tickSize: number,
  now: number,
  previous: MutableBookLevel[],
): MutableBookLevel[] => {
  const rows: MutableBookLevel[] = []
  let cumulative = 0
  for (let i = 0; i < levels; i += 1) {
    const levelPrice =
      side === 'bid' ? centerPrice - tickSize * (i + 1) : centerPrice + tickSize * (i + 1)
    const roundedPrice = Number(levelPrice.toFixed(2))
    const previousQuantity = previous[i]?.quantity ?? 0
    const quantityBase = Math.max(1, previousQuantity * (0.4 + Math.random() * 1.2))
    const quantity = Number(quantityBase.toFixed(3))
    cumulative += quantity
    const hasFlash = Math.abs(quantity - previousQuantity) / Math.max(1, previousQuantity) > 0.18
    rows.push({
      price: roundedPrice,
      quantity,
      cumulative: Number(cumulative.toFixed(3)),
      flashUntil: hasFlash ? now + 150 : previous[i]?.flashUntil ?? 0,
    })
  }
  return rows
}

const updateCandles = (candles: CandlePoint[], epochSec: number, price: number, sizeSec: number) => {
  const bucketTime = Math.floor(epochSec / sizeSec) * sizeSec
  const latest = candles[candles.length - 1]
  const volTick = Math.max(1, Math.floor(50 + Math.random() * 400))
  if (!latest || latest.time !== bucketTime) {
    candles.push({
      time: bucketTime,
      open: price,
      high: price,
      low: price,
      close: price,
      volume: volTick,
    })
    if (candles.length > 600) candles.shift()
    return
  }
  latest.high = Math.max(latest.high, price)
  latest.low = Math.min(latest.low, price)
  latest.close = price
  latest.volume = (latest.volume ?? 0) + volTick
}

const createInitialCandles = (seedPrice: number): { candles1s: CandlePoint[]; candles5s: CandlePoint[] } => {
  const nowSec = Math.floor(Date.now() / 1000)
  const candles1s: CandlePoint[] = []
  const candles5s: CandlePoint[] = []
  let p = seedPrice
  for (let i = 180; i > 0; i -= 1) {
    const t = nowSec - i
    p *= Math.exp(0.00002 + 0.003 * gaussian())
    const open = p
    const close = p * Math.exp(0.001 * gaussian())
    const high = Math.max(open, close) * (1 + Math.random() * 0.0009)
    const low = Math.min(open, close) * (1 - Math.random() * 0.0009)
    const barVol = Math.floor(800 + Math.random() * 12000)
    candles1s.push({
      time: t,
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume: barVol,
    })
  }
  for (let i = 0; i < candles1s.length; i += 5) {
    const group = candles1s.slice(i, i + 5)
    if (group.length === 0) continue
    candles5s.push({
      time: group[0].time - (group[0].time % 5),
      open: group[0].open,
      high: Math.max(...group.map((g) => g.high)),
      low: Math.min(...group.map((g) => g.low)),
      close: group[group.length - 1].close,
      volume: group.reduce((s, g) => s + (g.volume ?? 0), 0),
    })
  }
  return { candles1s, candles5s }
}

export type MarketFeed = {
  getSnapshot: () => MarketSnapshot
  subscribe: (listener: (snapshot: MarketSnapshot) => void) => () => void
  executeOrder: (request: TradeRequest) => void
  cancelOrder: (id: string) => void
  modifyOrder: (id: string, updates: Partial<OpenOrder>) => void
  destroy: () => void
}

const cloneSnapshot = (snapshot: MarketSnapshot): MarketSnapshot => ({
  activeSymbol: snapshot.activeSymbol,
  lastPrice: snapshot.lastPrice,
  tickDirection: snapshot.tickDirection,
  bids: snapshot.bids.map((row) => ({ ...row })),
  asks: snapshot.asks.map((row) => ({ ...row })),
  candles1s: snapshot.candles1s.map((row) => ({ ...row })),
  candles5s: snapshot.candles5s.map((row) => ({ ...row })),
  cashBalance: snapshot.cashBalance,
  positions: snapshot.positions.map((row) => ({ ...row })),
  fills: snapshot.fills.map((row) => ({ ...row })),
  openOrders: snapshot.openOrders.map((row) => ({ ...row })),
  trendingStocks: snapshot.trendingStocks.map((row) => ({ ...row })),
})

const markFromBasePrice = (asset: string, basePrice: number, stocks: MarketSnapshot['trendingStocks']) => {
  const stock = stocks.find((row) => row.symbol === asset)
  return stock ? stock.price : basePrice
}

const applyPositionMarks = (positions: MarketSnapshot['positions'], basePrice: number, stocks: MarketSnapshot['trendingStocks']) =>
  positions.map((position) => {
    const markPrice = markFromBasePrice(position.asset, basePrice, stocks)
    return {
      ...position,
      markPrice,
      pnl: Number(((markPrice - position.entryPrice) * position.quantity).toFixed(2)),
    }
  })

const seedStocks = () => {
  const base = terminalUniverse.map((row, idx) => ({
    symbol: row.symbol,
    price: Number(row.price.toFixed(2)),
    volume: Math.max(100000, Math.floor(900000 + Math.abs(row.price) * 1300 + (idx % 7) * 180000)),
  }))
  return {
    openMap: Object.fromEntries(base.map((row) => [row.symbol, row.price])),
    stocks: base.map((row) => ({ ...row, changePct: 0 })),
  }
}

const updateTrendingStocks = (engine: MutableEngine, baseMove: number) => {
  engine.stockTick += 1
  if (engine.stockTick % 4 !== 0) return
  const total = engine.trendingStocks.length
  if (total === 0) return
  const batch = Math.min(12, total)
  const next = engine.trendingStocks.slice()
  for (let i = 0; i < batch; i += 1) {
    const idx = (engine.stockCursor + i) % total
    const stock = next[idx]
    const microDrift = baseMove * 0.8 + 0.0012 * gaussian()
    const nextPrice = Math.max(1, stock.price * (1 + microDrift))
    const open = engine.stockOpenMap[stock.symbol] ?? stock.price
    const nextVolume = Math.max(100000, Math.floor(stock.volume * (0.985 + Math.random() * 0.04)))
    next[idx] = {
      ...stock,
      price: Number(nextPrice.toFixed(2)),
      volume: nextVolume,
      changePct: Number((((nextPrice - open) / open) * 100).toFixed(2)),
    }
  }
  engine.stockCursor = (engine.stockCursor + batch) % total
  engine.trendingStocks = next
}

const executeFill = (engine: MutableEngine, asset: string, action: TradeAction, direction: 'long'|'short', quantity: number, fillPrice: number, timestamp: number) => {
  const signedDelta = action === 'buy' ? quantity : -quantity
  engine.cashBalance = Number((engine.cashBalance - signedDelta * fillPrice).toFixed(2))
  const index = engine.positions.findIndex((position) => position.asset === asset)
  if (index >= 0) {
    const current = engine.positions[index]
    const nextQuantity = Number((current.quantity + signedDelta).toFixed(6))
    const sameSide = current.quantity === 0 || Math.sign(current.quantity) === Math.sign(nextQuantity)
    let nextEntry = current.entryPrice
    if (sameSide && nextQuantity !== 0) {
      const weighted =
        (Math.abs(current.quantity) * current.entryPrice + Math.abs(signedDelta) * fillPrice) /
        (Math.abs(current.quantity) + Math.abs(signedDelta))
      nextEntry = Number(weighted.toFixed(2))
    } else if (nextQuantity === 0) {
      nextEntry = fillPrice
    } else if (!sameSide) {
      nextEntry = fillPrice
    }
    engine.positions[index] = {
      ...current,
      quantity: nextQuantity,
      entryPrice: nextEntry,
    }
  } else {
    engine.positions.push({
      asset,
      quantity: Number(signedDelta.toFixed(6)),
      entryPrice: fillPrice,
      markPrice: fillPrice,
      pnl: 0,
    })
  }

  if (asset === (engine.trendingStocks[0]?.symbol ?? 'RELIANCE')) engine.lastPrice = fillPrice
  engine.trendingStocks = engine.trendingStocks.map((stock) => {
    if (stock.symbol !== asset) return stock
    const open = engine.stockOpenMap[stock.symbol] ?? stock.price
    return {
      ...stock,
      price: fillPrice,
      changePct: Number((((fillPrice - open) / open) * 100).toFixed(2)),
    }
  })
  
  const nowTrade = Date.now()
  const nowSec = Math.floor(nowTrade / 1000)
  updateCandles(engine.candles1s, nowSec, engine.lastPrice, 1)
  updateCandles(engine.candles5s, nowSec, engine.lastPrice, 5)
  engine.bids = buildBookSide('bid', engine.lastPrice, 14, 0.5, nowTrade, engine.bids)
  engine.asks = buildBookSide('ask', engine.lastPrice, 14, 0.5, nowTrade, engine.asks)
  engine.positions = applyPositionMarks(engine.positions, engine.lastPrice, engine.trendingStocks)
  updateTrendingStocks(engine, 0.0004 * (action === 'buy' ? 1 : -1))
  
  engine.fills = [
    {
      id: engine.fillId + 1,
      asset,
      action,
      direction,
      quantity,
      price: fillPrice,
      timestamp,
    },
    ...engine.fills,
  ].slice(0, 10)
  engine.fillId += 1
}

const createMockMarketFeed = (): MarketFeed => {
  const seedPrice = 52341.2
  const seedCandles = createInitialCandles(seedPrice)
  const seededStocks = seedStocks()
  const now = Date.now()
  const bids = buildBookSide('bid', seedPrice, 14, 0.5, now, [])
  const asks = buildBookSide('ask', seedPrice, 14, 0.5, now, [])
  const engine: MutableEngine = {
    lastPrice: seedPrice,
    lastPublishedPrice: seedPrice,
    bids,
    asks,
    candles1s: seedCandles.candles1s,
    candles5s: seedCandles.candles5s,
    cashBalance: 100000,
    positions: [
      { asset: seededStocks.stocks[0]?.symbol ?? 'RELIANCE', quantity: 30, entryPrice: seededStocks.stocks[0]?.price ?? 1411.8, markPrice: seededStocks.stocks[0]?.price ?? 1411.8, pnl: 0 },
      { asset: seededStocks.stocks[1]?.symbol ?? 'TCS', quantity: -8, entryPrice: seededStocks.stocks[1]?.price ?? 2398.8, markPrice: seededStocks.stocks[1]?.price ?? 2398.8, pnl: 0 },
      { asset: seededStocks.stocks[2]?.symbol ?? 'HDFCBANK', quantity: 24, entryPrice: seededStocks.stocks[2]?.price ?? 764.9, markPrice: seededStocks.stocks[2]?.price ?? 764.9, pnl: 0 },
    ],
    fills: [],
    openOrders: [],
    trendingStocks: seededStocks.stocks,
    stockOpenMap: seededStocks.openMap,
    stockTick: 0,
    stockCursor: 0,
    fillId: 0,
  }
  let snapshot: MarketSnapshot = {
    activeSymbol: '',
    lastPrice: seedPrice,
    tickDirection: 0,
    bids,
    asks,
    candles1s: seedCandles.candles1s,
    candles5s: seedCandles.candles5s,
    cashBalance: engine.cashBalance,
    positions: engine.positions,
    fills: [],
    openOrders: [],
    trendingStocks: engine.trendingStocks,
  }
  const listeners = new Set<(next: MarketSnapshot) => void>()
  const mu = 0.01
  const sigma = 0.35
  const tickRate = 100
  const dt = 1 / tickRate / (24 * 60 * 60)
  
  const publish = () => {
    snapshot = {
      activeSymbol: '',
      lastPrice: engine.lastPrice,
      tickDirection:
        engine.lastPrice > engine.lastPublishedPrice ? 1 : engine.lastPrice < engine.lastPublishedPrice ? -1 : 0,
      bids: engine.bids,
      asks: engine.asks,
      candles1s: engine.candles1s,
      candles5s: engine.candles5s,
      cashBalance: engine.cashBalance,
      positions: engine.positions,
      fills: engine.fills,
      openOrders: engine.openOrders,
      trendingStocks: engine.trendingStocks,
    }
    engine.lastPublishedPrice = engine.lastPrice
    listeners.forEach((listener) => listener(snapshot))
  }

  const stream = setInterval(() => {
    const drift = (mu - 0.5 * sigma * sigma) * dt
    const diffusion = sigma * Math.sqrt(dt) * gaussian()
    const nextPrice = engine.lastPrice * Math.exp(drift + diffusion)
    const baseMove = (nextPrice - engine.lastPrice) / Math.max(1, engine.lastPrice)
    engine.lastPrice = Number(nextPrice.toFixed(2))
    const currentNow = Date.now()
    const nowSec = Math.floor(currentNow / 1000)
    updateCandles(engine.candles1s, nowSec, engine.lastPrice, 1)
    updateCandles(engine.candles5s, nowSec, engine.lastPrice, 5)
    engine.bids = buildBookSide('bid', engine.lastPrice, 14, 0.5, currentNow, engine.bids)
    engine.asks = buildBookSide('ask', engine.lastPrice, 14, 0.5, currentNow, engine.asks)

    engine.positions = applyPositionMarks(engine.positions, engine.lastPrice, engine.trendingStocks)
    updateTrendingStocks(engine, baseMove)
    
    // Check open orders
    const remainingOrders: OpenOrder[] = []
    for (const order of engine.openOrders) {
      const currentPrice = markFromBasePrice(order.asset, engine.lastPrice, engine.trendingStocks)
      const crossed = order.action === 'buy' ? currentPrice <= order.limitPrice : currentPrice >= order.limitPrice
      if (crossed) {
        executeFill(engine, order.asset, order.action, order.direction, order.quantity, order.limitPrice, Date.now())
      } else {
        remainingOrders.push(order)
      }
    }
    engine.openOrders = remainingOrders
    
    publish()
  }, 10)

  return {
    getSnapshot: () => cloneSnapshot(snapshot),
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    executeOrder: (request) => {
      const backendPayload = {
        symbol: request.asset,
        side: request.action,
        quantity: request.quantity,
        ...(request.orderType === 'limit' ? { limit_price: Math.round(request.limitPrice * 100) } : {}),
      }

      const apiPath = request.orderType === 'limit'
        ? '/order/limit/add'
        : '/order/market'
      postToBackend(apiPath, backendPayload)
        .catch((err) => {
          console.error('Order submission to backend failed:', err)
        })

      if (request.orderType === 'limit') {
        engine.openOrders = [
          {
            id: String(engine.fillId + 1),
            asset: request.asset,
            action: request.action,
            direction: request.direction,
            quantity: request.quantity,
            limitPrice: request.limitPrice,
            timestamp: request.timestamp,
          },
          ...engine.openOrders,
        ]
        engine.fillId += 1
        publish()
        return
      }

      const marketAssetPrice = markFromBasePrice(request.asset, engine.lastPrice, engine.trendingStocks)
      const fillPrice = Number(marketAssetPrice.toFixed(2))
      executeFill(engine, request.asset, request.action, request.direction, request.quantity, fillPrice, request.timestamp)
      publish()
    },
    cancelOrder: (id) => {
      const order = engine.openOrders.find((o) => o.id === id)
      if (order) {
        postToBackend('/order/limit/cancel', {
          symbol: order.asset,
          order_id: Number(order.id),
        }).catch((err) => {
          console.error('Cancel order request failed:', err)
        })
      }
      engine.openOrders = engine.openOrders.filter((o) => o.id !== id)
      publish()
    },
    modifyOrder: (id, updates) => {
      const order = engine.openOrders.find((o) => o.id === id)
      if (order && updates.limitPrice !== undefined && updates.quantity !== undefined) {
        postToBackend('/order/limit/modify', {
          symbol: order.asset,
          order_id: Number(order.id),
          quantity: updates.quantity,
          limit_price: Math.round(updates.limitPrice * 100),
        }).catch((err) => {
          console.error('Modify order request failed:', err)
        })
      }
      engine.openOrders = engine.openOrders.map((o) => (o.id === id ? { ...o, ...updates } : o))
      publish()
    },
    destroy: () => clearInterval(stream),
  }
}

export const useMockMarket = (): MarketFeed => {
  const feedRef = useRef<MarketFeed | null>(null)
  const [, setReady] = useState(0)

  if (!feedRef.current) {
    feedRef.current = createMockMarketFeed()
  }

  useEffect(() => {
    if (!feedRef.current) {
      feedRef.current = createMockMarketFeed()
      setReady((v) => v + 1)
    }
    const feed = feedRef.current
    return () => {
      feed.destroy()
      feedRef.current = null
    }
  }, [])

  return feedRef.current
}
