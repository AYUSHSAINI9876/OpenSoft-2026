// @ts-nocheck
import { useCallback, useEffect, useId, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react'
import {
  AlignJustify,
  ArrowRight,
  ArrowUpRight,
  Camera,
  ChevronDown,
  ChevronUp,
  Circle,
  Crosshair,
  Eraser,
  Expand,
  Eye,
  EyeOff,
  Info,
  GitCommitHorizontal,
  GripVertical,
  Magnet,
  Maximize2,
  Minus,
  MoveHorizontal,
  MoveUpRight,
  MousePointer2,
  Pencil,
  PenTool,
  Plus,
  Redo2,
  RotateCcw,
  Ruler,
  Search,
  Slash,
  SlidersHorizontal,
  SplitSquareVertical,
  Square,
  Trash2,
  TrendingUp,
  Triangle,
  Type,
  Undo2,
  X,
  ZoomIn,
} from 'lucide-react'
import { OverlayFragment } from './overlayFragment'
import { CandlestickSeries, HistogramSeries, LineSeries, createChart, type IChartApi, type ISeriesApi, type UTCTimestamp } from 'lightweight-charts'
import type { CandlePoint } from '../../types/market'
import { monoClass, scrollClass } from './constants'

// ─── lightweight-charts layout constants ────────────────────────────────────
const PRICE_SCALE_WIDTH = 65   // px – right price-scale gutter
const TIME_SCALE_HEIGHT = 26   // px – bottom time-scale gutter

/** Shared chart chrome (primary, secondary, lower indicator strip). */
const chartThemeOptions = {
  layout: { background: { color: '#0B0E11' }, textColor: '#AAB0B6' },
  rightPriceScale: {
    borderColor: '#2B2F36',
    borderVisible: true,
    ticksVisible: true,
    minimumWidth: PRICE_SCALE_WIDTH,
    entireTextOnly: false,
  },
  timeScale: { borderColor: '#2B2F36', timeVisible: true, secondsVisible: true, barSpacing: 24 },
  grid: { horzLines: { color: '#1C2128' }, vertLines: { color: '#1C2128' } },
}

/** Right scale for the volume histogram pane (pane index 1); per-pane `right` is independent from price pane. */
const volumeHistogramPriceScaleOptions = {
  borderVisible: true,
  borderColor: '#2B2F36',
  scaleMargins: { top: 0.8, bottom: 0 },
  alignLabels: false,
  ticksVisible: true,
  entireTextOnly: false,
  ensureEdgeTickMarksVisible: true,
  minimumWidth: PRICE_SCALE_WIDTH,
  autoScale: true,
}

/** After setData, restore the user's zoom when possible; otherwise fit all bars (first paint, symbol change, regression). */
function restoreTimeScaleOrFit(chart: IChartApi | null, saved: { from: number; to: number } | null) {
  if (!chart) return
  const ts = chart.timeScale()
  if (saved != null && Number.isFinite(saved.from) && Number.isFinite(saved.to)) {
    try {
      ts.setVisibleLogicalRange(saved)
      return
    } catch {
      // Logical range may be invalid after bar count changed
    }
  }
  ts.fitContent()
}

export type IntervalKey = '1s' | '5s' | '15s' | '30s' | '1m' | '3m' | '5m' | '15m'
type ToolKey = 'cursor' | 'cross' | 'line' | 'hline' | 'vline' | 'ray' | 'xline' | 'fib' | 'rect' | 'brush' | 'text' | 'arrow' | 'measure' | 'move' | 'magnet' | 'eraser' | 'zoom' | 'hray' | 'crossline' | 'infoline' | 'angle'
type IndicatorTab = 'all' | 'favorites' | 'builtins'
type StudyKey =
  | 'ema9'
  | 'ema21'
  | 'ema50'
  | 'ema200'
  | 'sma20'
  | 'sma50'
  | 'wma20'
  | 'vwap'
  | 'bbUpper'
  | 'bbMid'
  | 'bbLower'
  | 'rsi14'
  | 'macd'
  | 'atr14'
  | 'stoch14'
  | 'supertrend'
  | 'avgprice'
  | 'alma'
  | 'adx'
  | 'aroonUp'
  | 'accdist'
  | 'hi52'
  | 'lo52'

type IndicatorItem = {
  id: string
  label: string
  category: string
  key?: StudyKey
}

type Props = {
  symbol: string
  secondarySymbol?: string
  assets: string[]
  lastPrice: number
  tickDirection: 1 | -1 | 0
  candles1s: CandlePoint[]
  secondaryCandles1s?: CandlePoint[]
  onSelectAsset?: (symbol: string) => void
  onSelectSecondaryAsset?: (symbol: string) => void
  onQuickTrade?: (action: 'buy' | 'sell', quantity: number, orderType: 'limit' | 'market', limitPrice: number) => void
  wsStatus?: 'connected' | 'connecting' | 'disconnected'
  /** Fired when split-view is toggled so the feed can subscribe the secondary symbol to full market events. */
  onSplitViewChange?: (splitOpen: boolean) => void
  /** Fired when the user changes the chart timeframe so parent components can use the live value. */
  onIntervalChange?: (interval: IntervalKey) => void
}

type StudySeriesMap = Partial<Record<StudyKey, ISeriesApi<'Line'>>>
type LowerPaneKey = 'none' | 'rsi' | 'macd' | 'atr' | 'stoch' | 'adx' | 'aroon' | 'accdist'
type LineKind = 'line' | 'hline' | 'vline' | 'ray' | 'xline' | 'arrow' | 'hray' | 'crossline' | 'infoline' | 'angle'
type OverlayLine = { id: number; kind: LineKind; x1: number; y1: number; x2: number; y2: number; logical1?: number; price1?: number; logical2?: number; price2?: number; targetPane?: 'primary' | 'secondary' }
type OverlayRect = { id: number; x1: number; y1: number; x2: number; y2: number; logical1?: number; price1?: number; logical2?: number; price2?: number; targetPane?: 'primary' | 'secondary' }
type OverlayFib = { id: number; x1: number; y1: number; x2: number; y2: number; logical1?: number; price1?: number; logical2?: number; price2?: number; targetPane?: 'primary' | 'secondary' }
type OverlayLabel = { id: number; x: number; y: number; logical?: number; price?: number; text: string; targetPane?: 'primary' | 'secondary' }
type OverlayPoint = { x: number; y: number; logical?: number; price?: number; targetPane?: 'primary' | 'secondary' }
type OverlayBrush = { id: number; points: OverlayPoint[]; targetPane?: 'primary' | 'secondary' }

const timeframeToSeconds: Record<IntervalKey, number> = {
  '1s': 1, '5s': 5, '15s': 15, '30s': 30, '1m': 60, '3m': 180, '5m': 300, '15m': 900,
}

const timeframeOptions: IntervalKey[] = ['1s', '5s', '15s', '30s', '1m', '3m', '5m', '15m']

const overlayStudies: { key: StudyKey; label: string; color: string }[] = [
  { key: 'ema9', label: 'EMA 9', color: '#F59E0B' },
  { key: 'ema21', label: 'EMA 21', color: '#60A5FA' },
  { key: 'ema50', label: 'EMA 50', color: '#A78BFA' },
  { key: 'ema200', label: 'EMA 200', color: '#F97316' },
  { key: 'sma20', label: 'SMA 20', color: '#22D3EE' },
  { key: 'sma50', label: 'SMA 50', color: '#34D399' },
  { key: 'wma20', label: 'WMA 20', color: '#F472B6' },
  { key: 'vwap', label: 'VWAP', color: '#FCD34D' },
  { key: 'bbUpper', label: 'BB Upper', color: '#93C5FD' },
  { key: 'bbMid', label: 'BB Mid', color: '#A3A3A3' },
  { key: 'bbLower', label: 'BB Lower', color: '#93C5FD' },
  { key: 'supertrend', label: 'Supertrend', color: '#E879F9' },
  { key: 'avgprice', label: 'Avg Price', color: '#FB923C' },
  { key: 'alma', label: 'ALMA', color: '#38BDF8' },
  { key: 'hi52', label: '52W High', color: '#4ADE80' },
  { key: 'lo52', label: '52W Low', color: '#F87171' },
]

const indicatorCatalog: IndicatorItem[] = [
  { id: 'ema9', label: 'Exponential Moving Average (9)', category: 'Moving Averages', key: 'ema9' },
  { id: 'ema21', label: 'Exponential Moving Average (21)', category: 'Moving Averages', key: 'ema21' },
  { id: 'ema50', label: 'Exponential Moving Average (50)', category: 'Moving Averages', key: 'ema50' },
  { id: 'ema200', label: 'Exponential Moving Average (200)', category: 'Moving Averages', key: 'ema200' },
  { id: 'sma20', label: 'Simple Moving Average (20)', category: 'Moving Averages', key: 'sma20' },
  { id: 'sma50', label: 'Simple Moving Average (50)', category: 'Moving Averages', key: 'sma50' },
  { id: 'wma20', label: 'Weighted Moving Average (20)', category: 'Moving Averages', key: 'wma20' },
  { id: 'vwap', label: 'VWAP', category: 'Volume', key: 'vwap' },
  { id: 'bbands', label: 'Bollinger Bands', category: 'Volatility', key: 'bbMid' },
  { id: 'rsi14', label: 'Relative Strength Index (14)', category: 'Oscillators', key: 'rsi14' },
  { id: 'macd', label: 'MACD (12,26,9)', category: 'Oscillators', key: 'macd' },
  { id: 'atr14', label: 'Average True Range (14)', category: 'Volatility', key: 'atr14' },
  { id: 'stoch14', label: 'Stochastic (14,3)', category: 'Oscillators', key: 'stoch14' },
  { id: 'supertrend', label: 'Supertrend (10,3)', category: 'Trend', key: 'supertrend' },
  { id: '52w', label: '52 Week High/Low', category: 'Price Action', key: 'hi52' },
  { id: 'accdist', label: 'Accumulation/Distribution', category: 'Volume', key: 'accdist' },
  { id: 'alma', label: 'Arnaud Legoux Moving Average', category: 'Moving Averages', key: 'alma' },
  { id: 'aroon', label: 'Aroon', category: 'Trend', key: 'aroonUp' },
  { id: 'adx', label: 'Average Directional Index', category: 'Trend', key: 'adx' },
  { id: 'avgprice', label: 'Average Price', category: 'Price Action', key: 'avgprice' },
]

const localTime = (t: number) => (Math.floor(t) - new Date().getTimezoneOffset() * 60) as UTCTimestamp

const normalizeCandles = (candles: CandlePoint[]) => {
  if (candles.length === 0) return []
  const sorted = [...candles]
    .map((c) => ({
      time: Number(c.time),
      open: Number(c.open),
      high: Number(c.high),
      low: Number(c.low),
      close: Number(c.close),
      volume: Number(c.volume ?? 0),
    }))
    .filter((c) => Number.isFinite(c.time) && Number.isFinite(c.open) && Number.isFinite(c.high) && Number.isFinite(c.low) && Number.isFinite(c.close))
    .filter((c) => c.open > 0 && c.high > 0 && c.low > 0 && c.close > 0)
    .map((c) => ({ ...c, time: Math.floor(c.time), high: Math.max(c.open, c.high, c.low, c.close), low: Math.min(c.open, c.high, c.low, c.close) }))
    .sort((a, b) => a.time - b.time)
  const normalized: CandlePoint[] = []
  for (const candle of sorted) {
    const prev = normalized[normalized.length - 1]
    if (!prev || prev.time !== candle.time) {
      normalized.push({ ...candle })
      continue
    }
    prev.high = Math.max(prev.high, candle.high)
    prev.low = Math.min(prev.low, candle.low)
    prev.close = candle.close
    prev.volume = (prev.volume ?? 0) + (candle.volume ?? 0)
  }
  return normalized
}

const toCandleSeries = (candles: CandlePoint[]) =>
  normalizeCandles(candles).map((c) => ({ time: localTime(c.time), open: c.open, high: c.high, low: c.low, close: c.close }))

const toVolumeHistogram = (candles: CandlePoint[]) =>
  normalizeCandles(candles).map((c) => ({
    time: localTime(c.time),
    value: Math.max(0, c.volume ?? 0),
    color: c.close >= c.open ? '#00C07666' : '#FF3B3066',
  }))

const aggregateCandles = (candles: CandlePoint[], bucketSeconds: number) => {
  if (bucketSeconds <= 1) return candles
  const aggregated: CandlePoint[] = []
  let current: CandlePoint | null = null
  for (const candle of candles) {
    const bucketTime = Math.floor(candle.time / bucketSeconds) * bucketSeconds
    if (!current || current.time !== bucketTime) {
      if (current) aggregated.push(current)
      current = {
        time: bucketTime,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume ?? 0,
      }
      continue
    }
    current.high = Math.max(current.high, candle.high)
    current.low = Math.min(current.low, candle.low)
    current.close = candle.close
    current.volume = (current.volume ?? 0) + (candle.volume ?? 0)
  }
  if (current) aggregated.push(current)
  return aggregated
}

const ema = (candles: CandlePoint[], period: number) => {
  if (candles.length === 0) return []
  const k = 2 / (period + 1)
  let value = candles[0].close
  return candles.map((candle, index) => {
    value = index === 0 ? candle.close : candle.close * k + value * (1 - k)
    return { time: localTime(candle.time), value: Number(value.toFixed(2)) }
  })
}

const sma = (candles: CandlePoint[], period: number) => {
  const output: { time: UTCTimestamp; value: number }[] = []
  let sum = 0
  for (let i = 0; i < candles.length; i += 1) {
    sum += candles[i].close
    if (i >= period) sum -= candles[i - period].close
    const value = i + 1 >= period ? sum / period : candles[i].close
    output.push({ time: localTime(candles[i].time), value: Number(value.toFixed(2)) })
  }
  return output
}

const wma = (candles: CandlePoint[], period: number) => {
  const output: { time: UTCTimestamp; value: number }[] = []
  const denominator = (period * (period + 1)) / 2
  for (let i = 0; i < candles.length; i += 1) {
    if (i + 1 < period) {
      output.push({ time: localTime(candles[i].time), value: candles[i].close })
      continue
    }
    let weighted = 0
    for (let j = 0; j < period; j += 1) weighted += candles[i - j].close * (period - j)
    output.push({ time: localTime(candles[i].time), value: Number((weighted / denominator).toFixed(2)) })
  }
  return output
}

const bbands = (candles: CandlePoint[]) => {
  const mid: { time: UTCTimestamp; value: number }[] = []
  const upper: { time: UTCTimestamp; value: number }[] = []
  const lower: { time: UTCTimestamp; value: number }[] = []
  for (let i = 0; i < candles.length; i += 1) {
    const sample = candles.slice(Math.max(0, i - 19), i + 1).map((c) => c.close)
    const mean = sample.reduce((a, b) => a + b, 0) / sample.length
    const std = Math.sqrt(sample.reduce((a, b) => a + (b - mean) ** 2, 0) / sample.length)
    mid.push({ time: localTime(candles[i].time), value: Number(mean.toFixed(2)) })
    upper.push({ time: localTime(candles[i].time), value: Number((mean + 2 * std).toFixed(2)) })
    lower.push({ time: localTime(candles[i].time), value: Number((mean - 2 * std).toFixed(2)) })
  }
  return { mid, upper, lower }
}

const vwap = (candles: CandlePoint[]) => {
  let cumulativePV = 0
  let cumulativeVol = 0
  return candles.map((candle) => {
    const typical = (candle.high + candle.low + candle.close) / 3
    const volume = Math.max(0, candle.volume ?? 0)
    cumulativePV += typical * volume
    cumulativeVol += volume
    return { time: localTime(candle.time), value: Number((cumulativePV / Math.max(1, cumulativeVol)).toFixed(2)) }
  })
}

const rsi = (candles: CandlePoint[]) => {
  if (candles.length < 2) return 50
  let gains = 0, losses = 0
  const start = Math.max(1, candles.length - 15)
  for (let i = start; i < candles.length; i += 1) {
    const delta = candles[i].close - candles[i - 1].close
    if (delta >= 0) gains += delta
    else losses += Math.abs(delta)
  }
  if (losses === 0) return 100
  const rs = (gains / 14) / (losses / 14)
  return Number((100 - 100 / (1 + rs)).toFixed(2))
}

const macd = (candles: CandlePoint[]) => {
  const ema12 = ema(candles, 12).map((p) => p.value)
  const ema26 = ema(candles, 26).map((p) => p.value)
  const line = ema12.map((v, i) => v - (ema26[i] ?? v))
  if (line.length === 0) return { line: 0, signal: 0, hist: 0 }
  let signal = line[0]
  const k = 2 / 10
  for (let i = 1; i < line.length; i += 1) signal = line[i] * k + signal * (1 - k)
  const latest = line[line.length - 1]
  return { line: Number(latest.toFixed(2)), signal: Number(signal.toFixed(2)), hist: Number((latest - signal).toFixed(2)) }
}

const atr = (candles: CandlePoint[]) => {
  if (candles.length < 2) return 0
  const trValues: number[] = []
  for (let i = 1; i < candles.length; i += 1) {
    trValues.push(Math.max(candles[i].high - candles[i].low, Math.abs(candles[i].high - candles[i - 1].close), Math.abs(candles[i].low - candles[i - 1].close)))
  }
  const sample = trValues.slice(-14)
  return Number((sample.reduce((a, b) => a + b, 0) / Math.max(1, sample.length)).toFixed(2))
}

const stoch = (candles: CandlePoint[]) => {
  if (candles.length === 0) return { k: 0, d: 0 }
  const values: number[] = []
  for (let i = 0; i < candles.length; i += 1) {
    const sample = candles.slice(Math.max(0, i - 13), i + 1)
    const hh = Math.max(...sample.map((c) => c.high))
    const ll = Math.min(...sample.map((c) => c.low))
    values.push(hh === ll ? 50 : ((candles[i].close - ll) / (hh - ll)) * 100)
  }
  const k = values[values.length - 1]
  const d = values.slice(-3).reduce((a, b) => a + b, 0) / Math.max(1, values.slice(-3).length)
  return { k: Number(k.toFixed(2)), d: Number(d.toFixed(2)) }
}

const supertrend = (candles: CandlePoint[]) => {
  if (candles.length === 0) return { value: 0, direction: 'UP' as 'UP' | 'DOWN' }
  const latest = candles[candles.length - 1]
  const latestAtr = atr(candles)
  const mid = (latest.high + latest.low) / 2
  const direction: 'UP' | 'DOWN' = latest.close >= mid ? 'UP' : 'DOWN'
  return { value: Number((direction === 'UP' ? mid - 3 * latestAtr : mid + 3 * latestAtr).toFixed(2)), direction }
}

const rsiSeries = (candles: CandlePoint[], period = 14) => {
  if (candles.length === 0) return []
  const values: { time: UTCTimestamp; value: number }[] = []
  for (let i = 0; i < candles.length; i += 1) {
    if (i === 0) { values.push({ time: localTime(candles[i].time), value: 50 }); continue }
    let gains = 0, losses = 0
    const start = Math.max(1, i - period + 1)
    for (let j = start; j <= i; j += 1) {
      const delta = candles[j].close - candles[j - 1].close
      if (delta >= 0) gains += delta
      else losses += Math.abs(delta)
    }
    const rs = losses === 0 ? 100 : (gains / period) / (losses / period)
    const value = losses === 0 ? 100 : 100 - 100 / (1 + rs)
    values.push({ time: localTime(candles[i].time), value: Number(value.toFixed(2)) })
  }
  return values
}

const macdSeries = (candles: CandlePoint[]) => {
  const fast = ema(candles, 12)
  const slow = ema(candles, 26)
  return fast.map((p, i) => ({ time: p.time, value: Number((p.value - (slow[i]?.value ?? p.value)).toFixed(2)) }))
}

const supertrendSeries = (candles: CandlePoint[]) => {
  if (candles.length < 2) return []
  const period = 10, mult = 3
  const output: { time: UTCTimestamp; value: number }[] = []
  let prevUpper = 0, prevLower = 0, trend = 1
  for (let i = 0; i < candles.length; i++) {
    const hl2 = (candles[i].high + candles[i].low) / 2
    const trs: number[] = []
    for (let j = Math.max(1, i - period + 1); j <= i; j++) {
      trs.push(Math.max(candles[j].high - candles[j].low, Math.abs(candles[j].high - candles[j - 1].close), Math.abs(candles[j].low - candles[j - 1].close)))
    }
    if (i === 0) trs.push(candles[0].high - candles[0].low)
    const atrVal = trs.reduce((a, b) => a + b, 0) / trs.length
    let upper = hl2 + mult * atrVal
    let lower = hl2 - mult * atrVal
    if (i > 0) {
      upper = upper < prevUpper || candles[i - 1].close > prevUpper ? upper : prevUpper
      lower = lower > prevLower || candles[i - 1].close < prevLower ? lower : prevLower
    }
    if (i === 0) trend = 1
    else if (candles[i].close > prevUpper) trend = 1
    else if (candles[i].close < prevLower) trend = -1
    output.push({ time: localTime(candles[i].time), value: Number((trend === 1 ? lower : upper).toFixed(2)) })
    prevUpper = upper
    prevLower = lower
  }
  return output
}

const avgPriceSeries = (candles: CandlePoint[]) =>
  candles.map((c) => ({ time: localTime(c.time), value: Number(((c.high + c.low + c.close) / 3).toFixed(2)) }))

const almaSeries = (candles: CandlePoint[], windowSize = 20, sigma = 6, offset = 0.85) => {
  const output: { time: UTCTimestamp; value: number }[] = []
  const m = offset * (windowSize - 1)
  const s = windowSize / sigma
  for (let i = 0; i < candles.length; i++) {
    if (i + 1 < windowSize) { output.push({ time: localTime(candles[i].time), value: candles[i].close }); continue }
    let weightSum = 0, alma = 0
    for (let j = 0; j < windowSize; j++) {
      const w = Math.exp(-((j - m) * (j - m)) / (2 * s * s))
      alma += candles[i - windowSize + 1 + j].close * w
      weightSum += w
    }
    output.push({ time: localTime(candles[i].time), value: Number((alma / weightSum).toFixed(2)) })
  }
  return output
}

const hiLoSeries = (candles: CandlePoint[]) => {
  if (candles.length === 0) return { hi: [] as { time: UTCTimestamp; value: number }[], lo: [] as { time: UTCTimestamp; value: number }[] }
  let high = -Infinity, low = Infinity
  for (const c of candles) { high = Math.max(high, c.high); low = Math.min(low, c.low) }
  return {
    hi: candles.map((c) => ({ time: localTime(c.time), value: Number(high.toFixed(2)) })),
    lo: candles.map((c) => ({ time: localTime(c.time), value: Number(low.toFixed(2)) })),
  }
}

const atrTimeSeries = (candles: CandlePoint[], period = 14) => {
  if (candles.length < 2) return []
  const output: { time: UTCTimestamp; value: number }[] = [{ time: localTime(candles[0].time), value: candles[0].high - candles[0].low }]
  let prev = candles[0].high - candles[0].low
  for (let i = 1; i < candles.length; i++) {
    const tr = Math.max(candles[i].high - candles[i].low, Math.abs(candles[i].high - candles[i - 1].close), Math.abs(candles[i].low - candles[i - 1].close))
    prev = i < period ? (prev * i + tr) / (i + 1) : (prev * (period - 1) + tr) / period
    output.push({ time: localTime(candles[i].time), value: Number(prev.toFixed(2)) })
  }
  return output
}

const stochKSeries = (candles: CandlePoint[], period = 14) =>
  candles.map((_, i) => {
    const slice = candles.slice(Math.max(0, i - period + 1), i + 1)
    const hh = Math.max(...slice.map((c) => c.high))
    const ll = Math.min(...slice.map((c) => c.low))
    return { time: localTime(candles[i].time), value: Number((hh === ll ? 50 : ((candles[i].close - ll) / (hh - ll)) * 100).toFixed(2)) }
  })

const adxSeries = (candles: CandlePoint[], period = 14) => {
  if (candles.length < 2) return []
  const output: { time: UTCTimestamp; value: number }[] = [{ time: localTime(candles[0].time), value: 25 }]
  const dxValues: number[] = []
  let smoothPDM = 0, smoothNDM = 0, smoothTR = 0, adxSmooth = 25
  for (let i = 1; i < candles.length; i++) {
    const upMove = candles[i].high - candles[i - 1].high
    const downMove = candles[i - 1].low - candles[i].low
    const pdm = upMove > downMove && upMove > 0 ? upMove : 0
    const ndm = downMove > upMove && downMove > 0 ? downMove : 0
    const tr = Math.max(candles[i].high - candles[i].low, Math.abs(candles[i].high - candles[i - 1].close), Math.abs(candles[i].low - candles[i - 1].close))
    if (i <= period) {
      smoothPDM += pdm; smoothNDM += ndm; smoothTR += tr
      if (i === period) { smoothPDM /= period; smoothNDM /= period; smoothTR /= period }
      output.push({ time: localTime(candles[i].time), value: 25 }); continue
    }
    smoothPDM = smoothPDM - smoothPDM / period + pdm
    smoothNDM = smoothNDM - smoothNDM / period + ndm
    smoothTR = smoothTR - smoothTR / period + tr
    const pdi = smoothTR === 0 ? 0 : (smoothPDM / smoothTR) * 100
    const ndi = smoothTR === 0 ? 0 : (smoothNDM / smoothTR) * 100
    const dx = pdi + ndi === 0 ? 0 : (Math.abs(pdi - ndi) / (pdi + ndi)) * 100
    dxValues.push(dx)
    adxSmooth = dxValues.length < period ? dx : (adxSmooth * (period - 1) + dx) / period
    output.push({ time: localTime(candles[i].time), value: Number(adxSmooth.toFixed(2)) })
  }
  return output
}

const aroonUpTimeSeries = (candles: CandlePoint[], period = 14) =>
  candles.map((_, i) => {
    const slice = candles.slice(Math.max(0, i - period + 1), i + 1)
    let highIdx = 0
    for (let j = 1; j < slice.length; j++) { if (slice[j].high >= slice[highIdx].high) highIdx = j }
    return { time: localTime(candles[i].time), value: Number(((highIdx) / Math.max(1, slice.length - 1) * 100).toFixed(2)) }
  })

const accDistSeries = (candles: CandlePoint[]) => {
  let ad = 0
  return candles.map((c) => {
    const mfm = c.high === c.low ? 0 : ((c.close - c.low) - (c.high - c.close)) / (c.high - c.low)
    ad += mfm * Math.max(0, c.volume ?? 0)
    return { time: localTime(c.time), value: Number(ad.toFixed(2)) }
  })
}

const pointsToSmoothPath = (points: OverlayPoint[]): string => {
  if (points.length < 2) return ''
  if (points.length === 2) {
    const mx = (points[0].x + points[1].x) / 2
    const my = (points[0].y + points[1].y) / 2
    return `M ${points[0].x} ${points[0].y} Q ${mx} ${my}, ${points[1].x} ${points[1].y}`
  }
  // Midpoint quadratic bezier — smoother for freehand strokes
  let d = `M ${points[0].x} ${points[0].y}`
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i]
    const p2 = points[i + 1]
    const mx = (p1.x + p2.x) / 2
    const my = (p1.y + p2.y) / 2
    d += ` Q ${p1.x} ${p1.y}, ${mx} ${my}`
  }
  const last = points[points.length - 1]
  d += ` L ${last.x} ${last.y}`
  return d
}

const extendLine = (
  x1: number, y1: number, x2: number, y2: number, w: number, h: number, bothDirs: boolean,
): [number, number, number, number] => {
  const dx = x2 - x1
  const dy = y2 - y1
  if (dx === 0 && dy === 0) return [x1, y1, x2, y2]
  const ts: number[] = []
  if (dx !== 0) { ts.push(-x1 / dx); ts.push((w - x1) / dx) }
  if (dy !== 0) { ts.push(-y1 / dy); ts.push((h - y1) / dy) }
  let tFwd = Infinity
  for (const t of ts) {
    if (t <= 0) continue
    const px = x1 + dx * t
    const py = y1 + dy * t
    if (px >= -0.5 && px <= w + 0.5 && py >= -0.5 && py <= h + 0.5) {
      if (t < tFwd) tFwd = t
    }
  }
  if (!isFinite(tFwd)) tFwd = 1
  let tBwd = -Infinity
  if (bothDirs) {
    for (const t of ts) {
      if (t >= 0) continue
      const px = x1 + dx * t
      const py = y1 + dy * t
      if (px >= -0.5 && px <= w + 0.5 && py >= -0.5 && py <= h + 0.5) {
        if (t > tBwd) tBwd = t
      }
    }
    if (!isFinite(tBwd)) tBwd = 0
  }
  const tStart = bothDirs ? tBwd : 0
  return [x1 + dx * tStart, y1 + dy * tStart, x1 + dx * tFwd, y1 + dy * tFwd]
}

const lowerPaneLabel: Record<Exclude<LowerPaneKey, 'none'>, string> = {
  rsi: 'RSI (14)', macd: 'MACD (12,26,9)', atr: 'ATR (14)',
  stoch: 'Stochastic (14,3)', adx: 'ADX (14)', aroon: 'Aroon Up (14)', accdist: 'Acc/Dist',
}

const lowerPaneColor: Record<Exclude<LowerPaneKey, 'none'>, string> = {
  rsi: '#60A5FA', macd: '#F59E0B', atr: '#A78BFA',
  stoch: '#22D3EE', adx: '#E879F9', aroon: '#34D399', accdist: '#F472B6',
}

const lowerPaneKeyForStudy: Partial<Record<StudyKey, LowerPaneKey>> = {
  rsi14: 'rsi', macd: 'macd', atr14: 'atr',
  stoch14: 'stoch', adx: 'adx', aroonUp: 'aroon', accdist: 'accdist',
}

type ToolDef = { key: ToolKey; icon: ReactNode; tip: string }
type ToolGroupDef = { id: string; defaultKey: ToolKey; tools: ToolDef[] }

const toolGroups: ToolGroupDef[] = [
  {
    id: 'cursors',
    defaultKey: 'cursor',
    tools: [
      { key: 'cursor', icon: <MousePointer2 size={14} />, tip: 'Cursor' },
      { key: 'cross', icon: <Crosshair size={14} />, tip: 'Crosshair' },
      { key: 'move', icon: <GripVertical size={14} />, tip: 'Move' },
    ],
  },
  {
    id: 'lines',
    defaultKey: 'line',
    tools: [
      { key: 'line', icon: <TrendingUp size={14} />, tip: 'Trend Line' },
      { key: 'hline', icon: <Minus size={14} />, tip: 'Horizontal Line' },
      { key: 'vline', icon: <GitCommitHorizontal size={14} />, tip: 'Vertical Line' },
      { key: 'ray', icon: <ArrowUpRight size={14} />, tip: 'Ray' },
      { key: 'xline', icon: <MoveHorizontal size={14} />, tip: 'Extended Line' },
      { key: 'hray', icon: <Slash size={14} />, tip: 'Horizontal Ray' },
      { key: 'crossline', icon: <Plus size={14} />, tip: 'Cross Line' },
      { key: 'infoline', icon: <Ruler size={14} />, tip: 'Info Line' },
      { key: 'angle', icon: <Triangle size={14} />, tip: 'Trend Angle' },
      { key: 'arrow', icon: <ArrowUpRight size={14} />, tip: 'Arrow' },
    ],
  },
  {
    id: 'shapes',
    defaultKey: 'fib',
    tools: [
      { key: 'fib', icon: <Slash size={14} />, tip: 'Fibonacci' },
      { key: 'rect', icon: <Square size={14} />, tip: 'Rectangle' },
    ],
  },
  {
    id: 'annotations',
    defaultKey: 'brush',
    tools: [
      { key: 'brush', icon: <PenTool size={14} />, tip: 'Brush' },
      { key: 'text', icon: <Type size={14} />, tip: 'Text' },
    ],
  },
]


type DrawingSnapshot = {
  lines: OverlayLine[]
  rects: OverlayRect[]
  fibs: OverlayFib[]
  labels: OverlayLabel[]
  brushes: OverlayBrush[]
}

export function ChartPanel({ symbol, secondarySymbol, assets, lastPrice, tickDirection, candles1s, secondaryCandles1s, onSelectAsset, onSelectSecondaryAsset, onQuickTrade, wsStatus, onSplitViewChange, onIntervalChange }: Props) {
  const overlayRef = useRef<HTMLDivElement | null>(null)
  const secondaryOverlayRef = useRef<HTMLDivElement | null>(null)
  const overlayIdRef = useRef(1)
  const modalDragRef = useRef<{ dragging: boolean; offsetX: number; offsetY: number }>({ dragging: false, offsetX: 0, offsetY: 0 })
  const sectionRef = useRef<HTMLElement | null>(null)
  const undoStackRef = useRef<DrawingSnapshot[]>([])
  const redoStackRef = useRef<DrawingSnapshot[]>([])
  const primaryChartRef = useRef<HTMLDivElement | null>(null)
  const secondaryChartRef = useRef<HTMLDivElement | null>(null)
  const chartClipId = `chart-clip-${useId().replace(/:/g, '')}`

  const [topHeightPct, setTopHeightPct] = useState(50)
  const splitDragRef = useRef<{ startY: number; startPct: number } | null>(null)

  const onSplitDragStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    splitDragRef.current = { startY: e.clientY, startPct: topHeightPct }
    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'
  }, [topHeightPct])

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const drag = splitDragRef.current
      if (!drag) return
      const section = sectionRef.current
      if (!section) return
      const rect = section.getBoundingClientRect()
      const deltaY = e.clientY - drag.startY
      const deltaPct = (deltaY / rect.height) * 100
      setTopHeightPct(Math.max(10, Math.min(90, drag.startPct + deltaPct)))
    }
    const onUp = () => {
      splitDragRef.current = null
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [])

  const [interval, setInterval] = useState<IntervalKey>(() => {
    return (localStorage.getItem('oak_capital_chart_interval') as IntervalKey)
      || (localStorage.getItem('synthbull_chart_interval') as IntervalKey)
      || '1m'
  })
  const [secondaryInterval, setSecondaryInterval] = useState<IntervalKey>(() => {
    return (localStorage.getItem('oak_capital_secondary_chart_interval') as IntervalKey)
      || (localStorage.getItem('synthbull_secondary_chart_interval') as IntervalKey)
      || '5s'
  })

  useEffect(() => {
    localStorage.setItem('oak_capital_chart_interval', interval)
    onIntervalChange?.(interval)
  }, [interval, onIntervalChange])

  useEffect(() => {
    localStorage.setItem('oak_capital_secondary_chart_interval', secondaryInterval)
  }, [secondaryInterval])

  const [splitView, setSplitView] = useState(false)
  const [crosshairOn, setCrosshairOn] = useState(true)
  const [activeTool, setActiveTool] = useState<ToolKey>('cursor')

  const [openDrawMenuId, setOpenDrawMenuId] = useState<string | null>(null)
  const [openMenuPos, setOpenMenuPos] = useState<{ top: number; left: number } | null>(null)
  const [activeGroupTools, setActiveGroupTools] = useState<Record<string, ToolKey>>({
    cursors: 'cursor', lines: 'line', shapes: 'fib', annotations: 'brush'
  })

  // FIX B2: always clear draftStart when switching tools
  const doSelectTool = (key: ToolKey, groupId?: string) => {
    if (activeTool === 'text') clearToolDrafts()
    clearToolDrafts() // always wipe stale draftStart from previous tool
    setActiveTool(key)
    if (key === 'eraser') clearToolDrafts()
    if (groupId) {
      setActiveGroupTools(prev => ({ ...prev, [groupId]: key }))
    }
    setOpenDrawMenuId(null)
    setOpenMenuPos(null)
  }

  useEffect(() => {
    const handleDocClick = () => { setOpenDrawMenuId(null); setOpenMenuPos(null) }
    document.addEventListener('click', handleDocClick)
    return () => document.removeEventListener('click', handleDocClick)
  }, [])

  const [indicatorModalOpen, setIndicatorModalOpen] = useState(false)
  const [indicatorSearch, setIndicatorSearch] = useState('')
  const [indicatorTab, setIndicatorTab] = useState<IndicatorTab>('all')
  const [modalPosition, setModalPosition] = useState<{ x: number; y: number } | null>(null)
  const [favorites, setFavorites] = useState<string[]>(['ema21', 'rsi14'])
  const [lowerPane, setLowerPane] = useState<LowerPaneKey>('none')

  const [lowerPaneHeight, setLowerPaneHeight] = useState(130)
  const lowerPaneDragRef = useRef<{ startY: number; startHeight: number } | null>(null)

  const onLowerPaneDragStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    lowerPaneDragRef.current = { startY: e.clientY, startHeight: lowerPaneHeight }
    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'
  }, [lowerPaneHeight])

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const drag = lowerPaneDragRef.current
      if (!drag) return
      const deltaY = drag.startY - e.clientY // dragging UP makes it taller
      setLowerPaneHeight(Math.max(60, Math.min(800, drag.startHeight + deltaY)))
    }
    const onUp = () => {
      lowerPaneDragRef.current = null
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [])
  const [, setRedrawTick] = useState(0)
  const [overlayLines, setOverlayLines] = useState<OverlayLine[]>([])
  const [overlayRects, setOverlayRects] = useState<OverlayRect[]>([])
  const [overlayFibs, setOverlayFibs] = useState<OverlayFib[]>([])
  const [overlayLabels, setOverlayLabels] = useState<OverlayLabel[]>([])
  const [overlayBrushes, setOverlayBrushes] = useState<OverlayBrush[]>([])
  const [draftStart, setDraftStart] = useState<OverlayPoint | null>(null)
  const [hoverPoint, setHoverPoint] = useState<OverlayPoint | null>(null)
  const [measureStart, setMeasureStart] = useState<OverlayPoint | null>(null)
  const [measureEnd, setMeasureEnd] = useState<OverlayPoint | null>(null)
  const [activePane, setActivePane] = useState<'primary' | 'secondary'>('primary')

  const [textDraft, setTextDraft] = useState<{ point: OverlayPoint, text: string } | null>(null)

  const [selectedOverlayId, setSelectedOverlayId] = useState<number | null>(null)
  const dragStateRef = useRef<{ id: number; collection: 'lines' | 'rects' | 'fibs' | 'labels'; type: 'p1' | 'p2' | 'body'; startX: number; startY: number; startLogical?: number; startPrice?: number; origItem: any } | null>(null)
  const isDraggingOverlayRef = useRef(false)

  const [showOverlays, setShowOverlays] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [hiddenStudies, setHiddenStudies] = useState<Set<StudyKey>>(new Set())
  const [overlayCollapsed, setOverlayCollapsed] = useState(false)
  const [assetMenuOpen, setAssetMenuOpen] = useState(false)
  const [assetSearch, setAssetSearch] = useState('')
  const [sidebarTip, setSidebarTip] = useState<{ text: string; top: number; x: number } | null>(null)
  const [quickTrade, setQuickTrade] = useState<{
    action: 'buy' | 'sell'
    quantity: string
    orderType: 'limit' | 'market'
    limitPrice: string
    stopLoss: string
    target: string
    useRisk: boolean
  } | null>(null)
  const [quickTradePos, setQuickTradePos] = useState({ x: 28, y: 44 })
  const quickDragRef = useRef<{ dragging: boolean; dx: number; dy: number }>({ dragging: false, dx: 0, dy: 0 })
  const [studies, setStudies] = useState<Record<StudyKey, boolean>>({
    ema9: true, ema21: true, ema50: false, ema200: false,
    sma20: false, sma50: false, wma20: false, vwap: false,
    bbUpper: false, bbMid: false, bbLower: false,
    rsi14: true, macd: false, atr14: false, stoch14: false, supertrend: false,
    avgprice: false, alma: false, adx: false, aroonUp: false, accdist: false,
    hi52: false, lo52: false,
  })

  useEffect(() => {
    let ro: ResizeObserver | null = null

    const attachObserver = () => {
      const canvas = primaryChartRef.current?.querySelector('canvas')
      if (canvas) {
        if (ro) ro.disconnect()
        ro = new ResizeObserver(() => {
          setClipW(canvas.clientWidth)
          setClipH(canvas.clientHeight)
        })
        ro.observe(canvas)
        setClipW(canvas.clientWidth)
        setClipH(canvas.clientHeight)
        return true
      }
      return false
    }

    // Try to attach immediately
    if (!attachObserver()) {
      // If lightweight-charts hasn't mounted the DOM yet, observe the container until it does
      const observer = new MutationObserver((mutations, obs) => {
        if (attachObserver()) obs.disconnect()
      })
      if (primaryChartRef.current) {
        observer.observe(primaryChartRef.current, { childList: true, subtree: true })
      }
      return () => {
        observer.disconnect()
        if (ro) ro.disconnect()
      }
    }

    return () => {
      if (ro) ro.disconnect()
    }
  }, [])

  const candleMap = useMemo(() => ({
    '1s': candles1s,
    '5s': aggregateCandles(candles1s, timeframeToSeconds['5s']),
    '15s': aggregateCandles(candles1s, timeframeToSeconds['15s']),
    '30s': aggregateCandles(candles1s, timeframeToSeconds['30s']),
    '1m': aggregateCandles(candles1s, timeframeToSeconds['1m']),
    '3m': aggregateCandles(candles1s, timeframeToSeconds['3m']),
    '5m': aggregateCandles(candles1s, timeframeToSeconds['5m']),
    '15m': aggregateCandles(candles1s, timeframeToSeconds['15m']),
  } as Record<IntervalKey, CandlePoint[]>), [candles1s])

  const activeCandles = useMemo(() => normalizeCandles(candleMap[interval]), [candleMap, interval])

  const secondaryCandleMap = useMemo(() => {
    if (!secondaryCandles1s) return candleMap
    return {
      '1s': secondaryCandles1s,
      '5s': aggregateCandles(secondaryCandles1s, 5),
      '15s': aggregateCandles(secondaryCandles1s, 15),
      '30s': aggregateCandles(secondaryCandles1s, 30),
      '1m': aggregateCandles(secondaryCandles1s, 60),
      '3m': aggregateCandles(secondaryCandles1s, 180),
      '5m': aggregateCandles(secondaryCandles1s, 300),
      '15m': aggregateCandles(secondaryCandles1s, 900),
    } as Record<IntervalKey, CandlePoint[]>
  }, [secondaryCandles1s, candleMap])

  const secondaryCandles = useMemo(() => normalizeCandles(secondaryCandleMap[secondaryInterval]), [secondaryInterval, secondaryCandleMap])

  const stableActiveCandles = useMemo(() => (activeCandles.length > 1 ? activeCandles.slice(0, -1) : activeCandles), [activeCandles])
  const stableSecondaryCandles = useMemo(() => (secondaryCandles.length > 1 ? secondaryCandles.slice(0, -1) : secondaryCandles), [secondaryCandles])

  const [secAssetMenuOpen, setSecAssetMenuOpen] = useState(false)
  const [secAssetSearch, setSecAssetSearch] = useState('')
  const filteredSecAssets = useMemo(() => {
    const q = secAssetSearch.trim().toLowerCase()
    return q ? assets.filter((a) => a.toLowerCase().includes(q)).slice(0, 12) : assets.slice(0, 12)
  }, [assets, secAssetSearch])

  const lowerPaneChartRef = useRef<HTMLDivElement | null>(null)
  const apiRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const secondaryApiRef = useRef<IChartApi | null>(null)
  const secondarySeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const secondaryVolumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const lowerApiRef = useRef<IChartApi | null>(null)
  const lowerSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const primaryStudiesRef = useRef<StudySeriesMap>({})
  const secondaryStudiesRef = useRef<StudySeriesMap>({})
  const seededRef = useRef<string | null>(null)
  const secondarySeededRef = useRef<string | null>(null)
  const lastCandleRef = useRef<number>(0)
  const lastSecondaryCandleRef = useRef<number>(0)
  const prevCandleLenRef = useRef<number>(0)
  const prevSecondaryCandleLenRef = useRef<number>(0)
  /** Detects sliding history window (same length, new earliest bar). */
  const firstPrimaryCandleTimeRef = useRef<number | null>(null)
  const firstSecondaryCandleTimeRef = useRef<number | null>(null)
  /** Last candlestick `time` passed to the chart (localTime); detects regressions update() cannot handle. */
  const lastPrimaryPlotTimeRef = useRef<number | null>(null)
  const lastSecondaryPlotTimeRef = useRef<number | null>(null)

  // Symbol can change one frame before candle props switch; reseeding with stale bars
  // then update() with the new symbol causes "Cannot update oldest data" in lightweight-charts.
  useEffect(() => {
    seededRef.current = null
    prevCandleLenRef.current = 0
    lastCandleRef.current = 0
    lastPrimaryPlotTimeRef.current = null
    firstPrimaryCandleTimeRef.current = null
  }, [symbol])

  useEffect(() => {
    secondarySeededRef.current = null
    prevSecondaryCandleLenRef.current = 0
    lastSecondaryCandleRef.current = 0
    lastSecondaryPlotTimeRef.current = null
    firstSecondaryCandleTimeRef.current = null
  }, [secondarySymbol])

  useEffect(() => {
    const el = primaryChartRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => { if (e.ctrlKey) e.preventDefault(); };
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, []);

  // ── Price-scale wheel zoom (TradingView-style, slow & gradual) ───────────────
  const pinnedPriceRangeRef = useRef<{ minValue: number; maxValue: number } | null>(null)

  useEffect(() => {
    const el = primaryChartRef.current
    if (!el) return

    // Accumulator + RAF handle — batches all events in one frame into a single step
    let accDelta = 0
    let rafId: number | null = null

    const applyZoom = () => {
      rafId = null
      const series = seriesRef.current
      const rect = el.getBoundingClientRect()
      const chartHeight = rect.height - TIME_SCALE_HEIGHT
      if (!series || chartHeight <= 0) { accDelta = 0; return }

      let high: number, low: number

      if (pinnedPriceRangeRef.current) {
        // Already in manual mode — use the pinned range directly
        high = pinnedPriceRangeRef.current.maxValue
        low = pinnedPriceRangeRef.current.minValue
      } else {
        // Auto-scale mode: derive a sane initial range from the visible candle data
        // so the first scroll doesn't jump to the full auto-scaled chart range.
        const candles = activeCandles
        if (!candles.length) { accDelta = 0; return }
        // Use candle high/low to get the price range of recent visible data
        const visibleHighs = candles.map(c => c.high)
        const visibleLows = candles.map(c => c.low)
        const dataHigh = Math.max(...visibleHighs)
        const dataLow = Math.min(...visibleLows)
        const margin = (dataHigh - dataLow) * 0.1 || dataHigh * 0.002
        high = dataHigh + margin
        low = dataLow - margin
      }

      if (high - low <= 0) { accDelta = 0; return }

      // Normalize delta: a standard mouse-wheel notch is 100px in deltaMode=0.
      // We cap each RAF step to ±1 notch equivalent for smoothness.
      // ZOOM_SPEED = 3% per notch → matches graph's built-in Y-zoom speed.
      const ZOOM_SPEED = 0.03
      const normalizedDelta = Math.max(-1, Math.min(1, accDelta / 100))
      const factor = 1 + normalizedDelta * ZOOM_SPEED
      accDelta = 0   // reset after consuming

      // Anchor around the middle of the visible range
      const anchor = (high + low) / 2
      const newHigh = anchor + (high - anchor) * factor
      const newLow = anchor + (low - anchor) * factor

      pinnedPriceRangeRef.current = {
        minValue: Math.min(newLow, newHigh),
        maxValue: Math.max(newLow, newHigh),
      }

      series.applyOptions({
        autoscaleInfoProvider: () => ({
          priceRange: pinnedPriceRangeRef.current!,
          margins: { above: 0, below: 0 },
        }),
      })
    }

    const onWheel = (e: WheelEvent) => {
      const rect = el.getBoundingClientRect()
      if (e.clientX < rect.right - PRICE_SCALE_WIDTH) return  // only price scale column

      e.preventDefault()
      e.stopPropagation()

      accDelta += e.deltaY   // accumulate direction + magnitude
      if (rafId === null) rafId = requestAnimationFrame(applyZoom)
    }

    // Double-click price scale → reset to auto-scale
    const onDblClick = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect()
      if (e.clientX < rect.right - PRICE_SCALE_WIDTH) return
      pinnedPriceRangeRef.current = null
      seriesRef.current?.applyOptions({ autoscaleInfoProvider: undefined })
    }

    // Use capture:true so our handler runs BEFORE LightweightCharts' own wheel
    // listener on the canvas. Without capture, LC processes the event first
    // (causing horizontal zoom) and our stopPropagation() is too late.
    el.addEventListener('wheel', onWheel, { passive: false, capture: true })
    el.addEventListener('dblclick', onDblClick, { capture: true })
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId)
      el.removeEventListener('wheel', onWheel, { capture: true })
      el.removeEventListener('dblclick', onDblClick, { capture: true })
    }
  }, [activeCandles])

  // Forward wheel events from SVG overlay to chart canvas so zoom always works.
  // IMPORTANT: skip forwarding when cursor is over the price-scale column — our
  // custom vertical-zoom handler (above) will handle those instead.
  useEffect(() => {
    const svg = overlayRef.current
    if (!svg) return
    const forwardWheel = (e: WheelEvent) => {
      // Check if the pointer is inside the price-scale gutter (right edge of chart)
      const el = primaryChartRef.current
      if (el) {
        const rect = el.getBoundingClientRect()
        if (e.clientX >= rect.right - PRICE_SCALE_WIDTH) {
          // Price-scale zone — let the custom zoom handler deal with it; don't forward
          e.preventDefault()
          e.stopPropagation()
          return
        }
      }

      e.preventDefault()
      e.stopPropagation()
      // Find the chart canvas underneath and dispatch the wheel event to it
      const chartCanvas = el?.querySelector('canvas')
      if (chartCanvas) {
        const clone = new WheelEvent('wheel', {
          deltaX: e.deltaX, deltaY: e.deltaY, deltaZ: e.deltaZ, deltaMode: e.deltaMode,
          clientX: e.clientX, clientY: e.clientY, screenX: e.screenX, screenY: e.screenY,
          ctrlKey: e.ctrlKey, shiftKey: e.shiftKey, altKey: e.altKey, metaKey: e.metaKey,
          bubbles: true, cancelable: true,
        })
        chartCanvas.dispatchEvent(clone)
      }
    }
    svg.addEventListener('wheel', forwardWheel, { passive: false })
    return () => svg.removeEventListener('wheel', forwardWheel)
  }, []);

  useEffect(() => {
    const el = secondaryChartRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => { if (e.ctrlKey) e.preventDefault(); };
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, []);

  const isBrushingRef = useRef(false)
  const activeBrushIdRef = useRef<number | null>(null)
  const liveBrushPointsRef = useRef<OverlayPoint[]>([])
  const brushRafRef = useRef<number | null>(null)
  const [brushTick, setBrushTick] = useState(0)

  const drawingStateRef = useRef<{ tool: ToolKey, draftStart: OverlayPoint | null, hoverPoint: OverlayPoint | null }>({ tool: activeTool, draftStart: null, hoverPoint: null })
  useEffect(() => { drawingStateRef.current.tool = activeTool }, [activeTool])

  const [clipW, setClipW] = useState(0)
  const [clipH, setClipH] = useState(0)

  const metrics = useMemo(() => ({
    rsi14: studies.rsi14 ? rsi(activeCandles) : 50,
    macd: studies.macd ? macd(activeCandles) : { line: 0, signal: 0, hist: 0 },
    atr14: studies.atr14 ? atr(activeCandles) : 0,
    stoch14: studies.stoch14 ? stoch(activeCandles) : { k: 0, d: 0 },
    supertrend: studies.supertrend ? supertrend(activeCandles) : { value: 0, direction: 'UP' as const },
    adx: studies.adx ? (() => { const d = adxSeries(activeCandles); return d.length ? d[d.length - 1].value : 25 })() : 25,
  }), [activeCandles, studies.rsi14, studies.macd, studies.atr14, studies.stoch14, studies.supertrend, studies.adx])

  const latestCandle = useMemo(() => activeCandles[activeCandles.length - 1], [activeCandles])
  const previousClose = useMemo(() => {
    if (activeCandles.length < 2) return latestCandle?.close ?? lastPrice
    return activeCandles[activeCandles.length - 2].close
  }, [activeCandles, latestCandle, lastPrice])
  const delta = (latestCandle?.close ?? lastPrice) - previousClose
  const deltaPct = previousClose === 0 ? 0 : (delta / previousClose) * 100

  const filteredIndicators = useMemo(() => {
    const query = indicatorSearch.trim().toLowerCase()
    const tabSource =
      indicatorTab === 'favorites' ? indicatorCatalog.filter((i) => favorites.includes(i.id))
        : indicatorTab === 'builtins' ? indicatorCatalog.filter((i) => Boolean(i.key))
          : indicatorCatalog
    const source = query.length ? tabSource.filter((i) => i.label.toLowerCase().includes(query) || i.category.toLowerCase().includes(query)) : tabSource
    return [...source].sort((a, b) => Number(favorites.includes(b.id)) - Number(favorites.includes(a.id)))
  }, [indicatorSearch, indicatorTab, favorites])

  const filteredAssets = useMemo(() => {
    const q = assetSearch.trim().toLowerCase()
    return q ? assets.filter((a) => a.toLowerCase().includes(q)).slice(0, 12) : assets.slice(0, 12)
  }, [assets, assetSearch])

  const activeStudyChips = useMemo(() => {
    const candles = stableActiveCandles
    if (!candles.length) return []
    const enabled = overlayStudies.filter((s) => studies[s.key])
    if (!enabled.length) return []
    let bbData: ReturnType<typeof bbands> | null = null
    let hlData: ReturnType<typeof hiLoSeries> | null = null
    const last = (arr: { value: number }[]) => arr.length ? arr[arr.length - 1].value.toFixed(2) : '--'
    const valueFor = (key: StudyKey): string => {
      switch (key) {
        case 'ema9': return last(ema(candles, 9))
        case 'ema21': return last(ema(candles, 21))
        case 'ema50': return last(ema(candles, 50))
        case 'ema200': return last(ema(candles, 200))
        case 'sma20': return last(sma(candles, 20))
        case 'sma50': return last(sma(candles, 50))
        case 'wma20': return last(wma(candles, 20))
        case 'vwap': return last(vwap(candles))
        case 'bbUpper': return last((bbData ??= bbands(candles)).upper)
        case 'bbMid': return last((bbData ??= bbands(candles)).mid)
        case 'bbLower': return last((bbData ??= bbands(candles)).lower)
        case 'supertrend': return last(supertrendSeries(candles))
        case 'avgprice': return last(avgPriceSeries(candles))
        case 'alma': return last(almaSeries(candles))
        case 'hi52': return last((hlData ??= hiLoSeries(candles)).hi)
        case 'lo52': return last((hlData ??= hiLoSeries(candles)).lo)
        default: return ''
      }
    }
    return enabled.map((s) => ({ key: s.key, label: s.label, value: valueFor(s.key) }))
  }, [studies, stableActiveCandles])

  const secondaryActiveStudyChips = useMemo(() => {
    const candles = stableSecondaryCandles
    if (!candles.length) return []
    const enabled = overlayStudies.filter((s) => studies[s.key])
    if (!enabled.length) return []
    let bbData: ReturnType<typeof bbands> | null = null
    let hlData: ReturnType<typeof hiLoSeries> | null = null
    const last = (arr: { value: number }[]) => arr.length ? arr[arr.length - 1].value.toFixed(2) : '--'
    const valueFor = (key: StudyKey): string => {
      switch (key) {
        case 'ema9': return last(ema(candles, 9))
        case 'ema21': return last(ema(candles, 21))
        case 'ema50': return last(ema(candles, 50))
        case 'ema200': return last(ema(candles, 200))
        case 'sma20': return last(sma(candles, 20))
        case 'sma50': return last(sma(candles, 50))
        case 'wma20': return last(wma(candles, 20))
        case 'vwap': return last(vwap(candles))
        case 'bbUpper': return last((bbData ??= bbands(candles)).upper)
        case 'bbMid': return last((bbData ??= bbands(candles)).mid)
        case 'bbLower': return last((bbData ??= bbands(candles)).lower)
        case 'supertrend': return last(supertrendSeries(candles))
        case 'avgprice': return last(avgPriceSeries(candles))
        case 'alma': return last(almaSeries(candles))
        case 'hi52': return last((hlData ??= hiLoSeries(candles)).hi)
        case 'lo52': return last((hlData ??= hiLoSeries(candles)).lo)
        default: return ''
      }
    }
    return enabled.map((s) => ({ key: s.key, label: s.label, value: valueFor(s.key) }))
  }, [studies, stableSecondaryCandles])

  // FIX B10: added hray, crossline, infoline, angle to drawingTools so SVG overlay
  // gets pointerEvents:'all' when these tools are active
  const drawingTools: ToolKey[] = ['line', 'hline', 'vline', 'ray', 'xline', 'arrow', 'hray', 'crossline', 'infoline', 'angle', 'rect', 'fib', 'brush', 'text', 'measure', 'eraser', 'zoom']
  const isDrawingToolActive = drawingTools.includes(activeTool)

  const clampToPlot = (p: OverlayPoint): OverlayPoint => ({
    x: Math.max(0, Math.min(clipW > 0 ? clipW : (overlayRef.current?.clientWidth ?? 800) - PRICE_SCALE_WIDTH, p.x)),
    y: Math.max(0, Math.min(clipH > 0 ? clipH : (overlayRef.current?.clientHeight ?? 500) - TIME_SCALE_HEIGHT, p.y)),
  })

  const getOverlayPoint = (event: ReactMouseEvent<Element> | MouseEvent, paneOverride?: 'primary' | 'secondary'): OverlayPoint | null => {
    const isSec = (paneOverride ?? activePane) === 'secondary'
    const oRef = isSec ? secondaryOverlayRef : overlayRef
    const aRef = isSec ? secondaryApiRef : apiRef
    const sRef = isSec ? secondarySeriesRef : seriesRef
    const cands = isSec ? (secondaryCandles1s ?? []) : activeCandles

    if (!oRef.current) return null
    const rect = oRef.current.getBoundingClientRect()
    // For secondary pane we use its own dimensions for clamping
    const cw = isSec ? (secondaryOverlayRef.current?.clientWidth ?? 800) - PRICE_SCALE_WIDTH : (clipW > 0 ? clipW : (overlayRef.current?.clientWidth ?? 800) - PRICE_SCALE_WIDTH)
    const ch = isSec ? (secondaryOverlayRef.current?.clientHeight ?? 500) - TIME_SCALE_HEIGHT : (clipH > 0 ? clipH : (overlayRef.current?.clientHeight ?? 500) - TIME_SCALE_HEIGHT)

    const raw = {
      x: Math.max(0, Math.min(cw, event.clientX - rect.left)),
      y: Math.max(0, Math.min(ch, event.clientY - rect.top))
    }

    let logical = aRef.current?.timeScale().coordinateToLogical(raw.x) ?? undefined
    let price = sRef.current?.coordinateToPrice(raw.y) ?? undefined

    if (crosshairOn && activeTool !== 'cursor' && activeTool !== 'cross' && logical !== undefined && price !== undefined && cands.length > 0) {
      const candleIndex = Math.round(logical);
      if (candleIndex >= 0 && candleIndex < cands.length) {
        const candle = cands[candleIndex];
        const prices = [candle.open, candle.high, candle.low, candle.close];
        let closestPrice = prices[0];
        let minDiff = Math.abs(price - closestPrice);
        for (const p of prices) {
          if (Math.abs(price - p) < minDiff) { minDiff = Math.abs(price - p); closestPrice = p; }
        }
        const yPixel = sRef.current?.priceToCoordinate(closestPrice);
        if (yPixel !== undefined && yPixel !== null && Math.abs(yPixel - raw.y) < 25) {
          price = closestPrice as any;
          raw.y = yPixel;
          logical = candleIndex as any;
          const snappedX = aRef.current?.timeScale().logicalToCoordinate(logical as any);
          if (snappedX !== null && snappedX !== undefined) raw.x = snappedX;
        }
      }
    }
    return { ...raw, logical, price, targetPane: paneOverride ?? activePane }
  }

  const nextOverlayId = () => { const id = overlayIdRef.current; overlayIdRef.current += 1; return id }

  const clearToolDrafts = () => {
    setDraftStart(null); setHoverPoint(null); setMeasureStart(null); setMeasureEnd(null); setTextDraft(null);
    drawingStateRef.current.draftStart = null; drawingStateRef.current.hoverPoint = null;
  }

  // FIX B9: added 'infoline' and 'angle' to the line-kind commit branch
  const finishDrawing = (tool: string, start: OverlayPoint, end: OverlayPoint) => {
    pushUndoSnapshot()
    if (tool === 'line' || tool === 'ray' || tool === 'xline' || tool === 'arrow' || tool === 'infoline' || tool === 'angle') {
      setOverlayLines((prev) => [...prev, { id: nextOverlayId(), kind: tool as LineKind, x1: start.x, y1: start.y, logical1: start.logical, price1: start.price, x2: end.x, y2: end.y, logical2: end.logical, price2: end.price, targetPane: start.targetPane }])
    } else if (tool === 'rect') {
      setOverlayRects((prev) => [...prev, { id: nextOverlayId(), x1: start.x, y1: start.y, logical1: start.logical, price1: start.price, x2: end.x, y2: end.y, logical2: end.logical, price2: end.price, targetPane: start.targetPane }])
    } else if (tool === 'fib') {
      setOverlayFibs((prev) => [...prev, { id: nextOverlayId(), x1: start.x, y1: start.y, logical1: start.logical, price1: start.price, x2: end.x, y2: end.y, logical2: end.logical, price2: end.price, targetPane: start.targetPane }])
    }
    clearToolDrafts()
  }

  const handleOverlayClick = (event: ReactMouseEvent<SVGSVGElement>, paneOverride?: 'primary' | 'secondary') => {
    if (activeTool === 'zoom') return
    // In cursor/move/cross mode, don't block events — let chart handle them
    // Individual drawn elements have their own onClick that calls stopPropagation
    if (activeTool === 'cursor' || activeTool === 'move' || activeTool === 'cross') {
      setSelectedOverlayId(null)
      return
    }
    event.stopPropagation()
    event.preventDefault()
    if (isDraggingOverlayRef.current) return
    const targetPane = paneOverride ?? activePane
    const point = getOverlayPoint(event, targetPane)
    if (!point) return

    const svgW = clipW || (overlayRef.current?.clientWidth ?? 800) - PRICE_SCALE_WIDTH
    // FIX B5: use clipH (excludes time-scale gutter) instead of full SVG height
    const svgH = clipH || (overlayRef.current?.clientHeight ?? 500) - TIME_SCALE_HEIGHT

    // FIX B3: store price1/price2 on hline so y re-resolves correctly on zoom/scroll
    if (activeTool === 'hline') {
      pushUndoSnapshot()
      setOverlayLines((prev) => [...prev, {
        id: nextOverlayId(), kind: 'hline',
        x1: 0, y1: point.y, x2: svgW, y2: point.y,
        price1: point.price, price2: point.price,
        targetPane: point.targetPane
      }])
      return
    }
    // FIX B7: store price1 and logical1 on hray so position tracks on zoom/scroll
    if (activeTool === 'hray') {
      pushUndoSnapshot()
      setOverlayLines((prev) => [...prev, {
        id: nextOverlayId(), kind: 'hray',
        x1: point.x, y1: point.y, x2: svgW, y2: point.y,
        logical1: point.logical, price1: point.price, price2: point.price,
        targetPane: point.targetPane
      }])
      return
    }
    // FIX B6: store logical1 and price1 on crossline so both axes track on zoom/scroll
    if (activeTool === 'crossline') {
      pushUndoSnapshot()
      setOverlayLines((prev) => [...prev, {
        id: nextOverlayId(), kind: 'crossline',
        x1: point.x, y1: point.y, x2: point.x, y2: point.y,
        logical1: point.logical, price1: point.price,
        targetPane: point.targetPane
      }])
      return
    }
    // FIX B5: use svgH (which is now clipH) so vline doesn't bleed into time-scale
    if (activeTool === 'vline') {
      pushUndoSnapshot()
      setOverlayLines((prev) => [...prev, {
        id: nextOverlayId(), kind: 'vline',
        x1: point.x, y1: 0, x2: point.x, y2: svgH,
        logical1: point.logical,
        targetPane: point.targetPane
      }])
      return
    }
    if (activeTool === 'text') { setTextDraft({ point, text: '' }); return }
    if (activeTool === 'eraser') { clearToolDrafts(); return }
  }

  const handleOverlayMove = (event: ReactMouseEvent<SVGSVGElement> | MouseEvent, paneOverride?: 'primary' | 'secondary') => {
    const targetPane = paneOverride ?? (isBrushingRef.current ? liveBrushPointsRef.current[0]?.targetPane : activePane) ?? activePane
    const point = getOverlayPoint(event, targetPane)
    if (!point) return

    if (dragStateRef.current) {
      isDraggingOverlayRef.current = true
      const state = dragStateRef.current
      const dxLogical = point.logical !== undefined && state.startLogical !== undefined ? point.logical - state.startLogical : undefined
      const dyPrice = point.price !== undefined && state.startPrice !== undefined ? point.price - state.startPrice : undefined
      const dxPx = point.x - state.startX
      const dyPx = point.y - state.startY

      const updater = (prev: any[]) => prev.map((item) => {
        if (item.id !== state.id) return item
        const updated = { ...item }
        if (state.collection === 'lines' || state.collection === 'rects' || state.collection === 'fibs') {
          // Constrained-axis drag for single-click line tools
          const kind = updated.kind as string | undefined
          if (state.collection === 'lines' && (kind === 'hline' || kind === 'hray' || kind === 'vline' || kind === 'crossline')) {
            if (kind === 'hline') {
              // hline: only move vertically (price axis)
              if (dyPrice !== undefined && updated.price1 !== undefined) updated.price1 = state.origItem.price1 + dyPrice
              if (dyPrice !== undefined && updated.price2 !== undefined) updated.price2 = state.origItem.price2 + dyPrice
              updated.y1 = state.origItem.y1 + dyPx; updated.y2 = state.origItem.y2 + dyPx
            } else if (kind === 'vline') {
              // vline: only move horizontally (time axis)
              if (dxLogical !== undefined && updated.logical1 !== undefined) updated.logical1 = state.origItem.logical1 + dxLogical
              updated.x1 = state.origItem.x1 + dxPx; updated.x2 = state.origItem.x2 + dxPx
            } else if (kind === 'hray') {
              // hray: move start point in both axes, end stays at right edge
              if (dxLogical !== undefined && updated.logical1 !== undefined) updated.logical1 = state.origItem.logical1 + dxLogical
              if (dyPrice !== undefined && updated.price1 !== undefined) updated.price1 = state.origItem.price1 + dyPrice
              if (dyPrice !== undefined && updated.price2 !== undefined) updated.price2 = state.origItem.price2 + dyPrice
              updated.x1 = state.origItem.x1 + dxPx
              updated.y1 = state.origItem.y1 + dyPx; updated.y2 = state.origItem.y2 + dyPx
            } else if (kind === 'crossline') {
              // crossline: move center point in both axes
              if (dxLogical !== undefined && updated.logical1 !== undefined) updated.logical1 = state.origItem.logical1 + dxLogical
              if (dyPrice !== undefined && updated.price1 !== undefined) updated.price1 = state.origItem.price1 + dyPrice
              updated.x1 = state.origItem.x1 + dxPx; updated.x2 = state.origItem.x2 + dxPx
              updated.y1 = state.origItem.y1 + dyPx; updated.y2 = state.origItem.y2 + dyPx
            }
          } else if (state.type === 'p1') {
            if (dxLogical !== undefined && updated.logical1 !== undefined) updated.logical1 = state.origItem.logical1 + dxLogical
            if (dyPrice !== undefined && updated.price1 !== undefined) updated.price1 = state.origItem.price1 + dyPrice
            updated.x1 = state.origItem.x1 + dxPx; updated.y1 = state.origItem.y1 + dyPx
          } else if (state.type === 'p2') {
            if (dxLogical !== undefined && updated.logical2 !== undefined) updated.logical2 = state.origItem.logical2 + dxLogical
            if (dyPrice !== undefined && updated.price2 !== undefined) updated.price2 = state.origItem.price2 + dyPrice
            updated.x2 = state.origItem.x2 + dxPx; updated.y2 = state.origItem.y2 + dyPx
          } else if (state.type === 'body') {
            if (dxLogical !== undefined && updated.logical1 !== undefined && updated.logical2 !== undefined) {
              updated.logical1 = state.origItem.logical1 + dxLogical; updated.logical2 = state.origItem.logical2 + dxLogical
            }
            if (dyPrice !== undefined && updated.price1 !== undefined && updated.price2 !== undefined) {
              updated.price1 = state.origItem.price1 + dyPrice; updated.price2 = state.origItem.price2 + dyPrice
            }
            updated.x1 = state.origItem.x1 + dxPx; updated.x2 = state.origItem.x2 + dxPx
            updated.y1 = state.origItem.y1 + dyPx; updated.y2 = state.origItem.y2 + dyPx
          }
        }
        return updated
      })

      if (state.collection === 'lines') setOverlayLines(updater)
      else if (state.collection === 'rects') setOverlayRects(updater)
      else if (state.collection === 'fibs') setOverlayFibs(updater)
      return
    }

    if (draftStart || (activeTool === 'measure' && measureStart && !measureEnd) || activeTool === 'zoom') {
      drawingStateRef.current.hoverPoint = point;
      setHoverPoint(point)
    }
    if (activeTool === 'brush' && isBrushingRef.current) {
      // Use raw pixel coords — skip logical/price re-mapping entirely for brush
      // so strokes don't snap to discrete bar centers
      const oRef = targetPane === 'secondary' ? secondaryOverlayRef : overlayRef
      const rect = oRef.current?.getBoundingClientRect()
      if (rect) {
        // We use the same clamping logic
        const cw = targetPane === 'secondary' ? (secondaryOverlayRef.current?.clientWidth ?? 800) - PRICE_SCALE_WIDTH : (clipW > 0 ? clipW : (overlayRef.current?.clientWidth ?? 800) - PRICE_SCALE_WIDTH)
        const ch = targetPane === 'secondary' ? (secondaryOverlayRef.current?.clientHeight ?? 500) - TIME_SCALE_HEIGHT : (clipH > 0 ? clipH : (overlayRef.current?.clientHeight ?? 500) - TIME_SCALE_HEIGHT)
        const rawPoint = {
          x: Math.max(0, Math.min(cw, event.clientX - rect.left)),
          y: Math.max(0, Math.min(ch, event.clientY - rect.top))
        }
        const pts = liveBrushPointsRef.current
        const last = pts[pts.length - 1]
        // Only add point if mouse moved at least 2px (avoids jitter wobble)
        if (!last || Math.hypot(rawPoint.x - last.x, rawPoint.y - last.y) >= 2) {
          liveBrushPointsRef.current = [...pts, { x: rawPoint.x, y: rawPoint.y, targetPane }]
          // RAF-batch re-renders so SVG path updates smoothly without per-point setState overhead
          if (brushRafRef.current === null) {
            brushRafRef.current = requestAnimationFrame(() => {
              brushRafRef.current = null
              setBrushTick(t => t + 1)
            })
          }
        }
      }
    }
  }

  // FIX B1: two-click tools now commit on the SECOND mouseDown, not on mouseUp.
  // mouseUp only handles zoom drag, overlay drag, and brush.
  const handleOverlayMouseDown = (event: ReactMouseEvent<SVGSVGElement>, paneOverride?: 'primary' | 'secondary') => {
    // In cursor/move/cross mode, don't intercept — let chart handle scroll/pan
    if (activeTool === 'cursor' || activeTool === 'move' || activeTool === 'cross') return
    const targetPane = paneOverride ?? activePane
    const point = getOverlayPoint(event, targetPane)
    if (!point) return
    // FIX B1: 'infoline' and 'angle' included in two-click tool list
    const isDrawingTool = ['line', 'ray', 'xline', 'arrow', 'rect', 'fib', 'infoline', 'angle', 'measure'].includes(activeTool)
    if (activeTool === 'brush') {
      pushUndoSnapshot()
      const id = nextOverlayId()
      activeBrushIdRef.current = id
      isBrushingRef.current = true
      liveBrushPointsRef.current = [point]
    } else if (activeTool === 'zoom') {
      setDraftStart(point)
      drawingStateRef.current.draftStart = point
    } else if (isDrawingTool) {
      if (!draftStart) {
        // First click: set start anchor
        setDraftStart(point)
        drawingStateRef.current.draftStart = point
        drawingStateRef.current.hoverPoint = point
      } else {
        // FIX B1: Second click → commit. Do NOT wait for mouseUp.
        finishDrawing(activeTool, draftStart, point)
        // clearToolDrafts is called inside finishDrawing
      }
    } else if (activeTool === 'measure') {
      if (!measureStart || (measureStart && measureEnd)) { setMeasureStart(point); setMeasureEnd(null) }
      else setMeasureEnd(point)
    }
  }

  const pushUndoSnapshot = () => {
    undoStackRef.current.push({ lines: [...overlayLines], rects: [...overlayRects], fibs: [...overlayFibs], labels: [...overlayLabels], brushes: [...overlayBrushes] })
    redoStackRef.current = []
  }

  const handleUndo = useCallback(() => {
    const snap = undoStackRef.current.pop()
    if (!snap) return
    setOverlayLines((prev) => {
      redoStackRef.current.push({ lines: [...prev], rects: [...overlayRects], fibs: [...overlayFibs], labels: [...overlayLabels], brushes: [...overlayBrushes] })
      return snap.lines
    })
    setOverlayRects(snap.rects); setOverlayFibs(snap.fibs); setOverlayLabels(snap.labels); setOverlayBrushes(snap.brushes)
  }, [overlayRects, overlayFibs, overlayLabels, overlayBrushes])

  const handleRedo = useCallback(() => {
    const snap = redoStackRef.current.pop()
    if (!snap) return
    setOverlayLines((prev) => {
      undoStackRef.current.push({ lines: [...prev], rects: [...overlayRects], fibs: [...overlayFibs], labels: [...overlayLabels], brushes: [...overlayBrushes] })
      return snap.lines
    })
    setOverlayRects(snap.rects); setOverlayFibs(snap.fibs); setOverlayLabels(snap.labels); setOverlayBrushes(snap.brushes)
  }, [overlayRects, overlayFibs, overlayLabels, overlayBrushes])

  const handleScreenshot = () => {
    const canvas = primaryChartRef.current?.querySelector('canvas')
    if (!canvas) return
    const link = document.createElement('a')
    link.download = `chart-${Date.now()}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  const toggleFullscreen = () => {
    if (!sectionRef.current) return
    if (document.fullscreenElement) { document.exitFullscreen(); setIsFullscreen(false) }
    else { sectionRef.current.requestFullscreen(); setIsFullscreen(true) }
  }

  const openIndicatorModal = () => {
    if (!modalPosition) {
      const x = Math.max(20, (window.innerWidth - 430) / 2)
      const y = Math.max(24, window.innerHeight * 0.12)
      setModalPosition({ x, y })
    }
    setIndicatorModalOpen(true)
  }

  const openQuickTrade = (action: 'buy' | 'sell') =>
    setQuickTrade({ action, quantity: '0', orderType: 'market', limitPrice: lastPrice.toFixed(2), stopLoss: '', target: '', useRisk: false })

  const submitQuickTrade = () => {
    if (!quickTrade || !onQuickTrade) return
    const quantity = Number(quickTrade.quantity)
    const limitPrice = Number(quickTrade.limitPrice)
    if (!Number.isFinite(quantity) || quantity <= 0) return
    if (quickTrade.orderType === 'limit' && (!Number.isFinite(limitPrice) || limitPrice <= 0)) return
    if (quickTrade.useRisk) {
      const sl = Number(quickTrade.stopLoss), tg = Number(quickTrade.target)
      const ref = quickTrade.orderType === 'market' ? lastPrice : limitPrice
      if (!Number.isFinite(sl) || sl <= 0 || !Number.isFinite(tg) || tg <= 0) return
      if (quickTrade.action === 'buy' && !(sl < ref && tg > ref)) return
      if (quickTrade.action === 'sell' && !(sl > ref && tg < ref)) return
    }
    onQuickTrade(quickTrade.action, quantity, quickTrade.orderType, quickTrade.orderType === 'limit' ? limitPrice : lastPrice)
    setQuickTrade(null)
  }

  useEffect(() => {
    if (!quickTrade || quickTrade.orderType !== 'market') return
    const live = lastPrice.toFixed(2)
    if (quickTrade.limitPrice === live) return
    setQuickTrade((prev) => (prev && prev.orderType === 'market' ? { ...prev, limitPrice: live } : prev))
  }, [lastPrice, quickTrade])

  const quickTradeError = useMemo(() => {
    if (!quickTrade) return ''
    const quantity = Number(quickTrade.quantity)
    if (!Number.isFinite(quantity) || quantity <= 0) return 'Enter valid quantity.'
    const limitPrice = Number(quickTrade.limitPrice)
    if (quickTrade.orderType === 'limit' && (!Number.isFinite(limitPrice) || limitPrice <= 0)) return 'Enter valid limit price.'
    if (!quickTrade.useRisk) return ''
    const sl = Number(quickTrade.stopLoss), tg = Number(quickTrade.target)
    const ref = quickTrade.orderType === 'market' ? lastPrice : limitPrice
    if (!Number.isFinite(sl) || sl <= 0) return 'Enter valid stoploss.'
    if (!Number.isFinite(tg) || tg <= 0) return 'Enter valid target.'
    if (quickTrade.action === 'buy') {
      if (sl >= ref) return 'For BUY, stoploss must be below current price.'
      if (tg <= ref) return 'For BUY, target must be above current price.'
    } else {
      if (sl <= ref) return 'For SELL, stoploss must be above current price.'
      if (tg >= ref) return 'For SELL, target must be below current price.'
    }
    return ''
  }, [quickTrade, lastPrice])

  // FIX B12: added 'infoline' and 'angle' to twoClickTools
  const twoClickTools: ToolKey[] = ['line', 'ray', 'xline', 'arrow', 'rect', 'fib', 'infoline', 'angle', 'measure']
  const selectTool = (tool: ToolKey) => { setActiveTool(tool); if (!twoClickTools.includes(tool)) clearToolDrafts() }

  const startModalDrag = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!modalPosition) return
    modalDragRef.current.dragging = true
    modalDragRef.current.offsetX = event.clientX - modalPosition.x
    modalDragRef.current.offsetY = event.clientY - modalPosition.y
  }

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!modalDragRef.current.dragging) return
      setModalPosition({ x: Math.max(12, e.clientX - modalDragRef.current.offsetX), y: Math.max(12, e.clientY - modalDragRef.current.offsetY) })
    }
    const onUp = () => { modalDragRef.current.dragging = false }
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!quickDragRef.current.dragging) return
      setQuickTradePos({ x: Math.max(10, e.clientX - quickDragRef.current.dx), y: Math.max(28, e.clientY - quickDragRef.current.dy) })
    }
    const onUp = () => { quickDragRef.current.dragging = false }
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [])

  useEffect(() => {
    // FIX B1: onGlobalUp no longer finishes two-click drawing tools.
    // Two-click tools commit on the second mouseDown instead (see handleOverlayMouseDown).
    // onGlobalUp only handles: zoom drag, overlay drag, and brush stroke end.
    const onGlobalUp = () => {
      // Zoom: finish on drag-up (zoom is a drag operation, not two-click)
      if (drawingStateRef.current.tool === 'zoom' && drawingStateRef.current.draftStart && drawingStateRef.current.hoverPoint) {
        const leftLogical = Math.min(drawingStateRef.current.draftStart.logical ?? 0, drawingStateRef.current.hoverPoint.logical ?? 0)
        const rightLogical = Math.max(drawingStateRef.current.draftStart.logical ?? 0, drawingStateRef.current.hoverPoint.logical ?? 0)
        if (rightLogical > leftLogical) {
          apiRef.current?.timeScale().setVisibleLogicalRange({ from: leftLogical as any, to: rightLogical as any })
        }
        clearToolDrafts()
        setActiveTool('cursor')
      }

      if (dragStateRef.current) {
        if (isDraggingOverlayRef.current) { pushUndoSnapshot() }
        dragStateRef.current = null
        setTimeout(() => { isDraggingOverlayRef.current = false }, 50)
        return
      }
      if (isBrushingRef.current) {
        if (brushRafRef.current !== null) { cancelAnimationFrame(brushRafRef.current); brushRafRef.current = null }
        const points = liveBrushPointsRef.current
        if (points.length >= 2) {
          const id = activeBrushIdRef.current ?? overlayIdRef.current++
          const brushTarget = points[0]?.targetPane || activePane
          setOverlayBrushes((prev) => [...prev, { id, points, targetPane: brushTarget }])
        }
        isBrushingRef.current = false
        activeBrushIdRef.current = null
        liveBrushPointsRef.current = []
      }
    }
    const onGlobalMove = (e: MouseEvent) => {
      if (dragStateRef.current || drawingStateRef.current.draftStart || isBrushingRef.current) {
        handleOverlayMove(e as any)
      }
    }
    window.addEventListener('mouseup', onGlobalUp)
    window.addEventListener('mousemove', onGlobalMove)
    return () => {
      window.removeEventListener('mouseup', onGlobalUp)
      window.removeEventListener('mousemove', onGlobalMove)
    }
  }, [handleOverlayMove])

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (indicatorModalOpen && e.key === 'Escape') { setIndicatorModalOpen(false); return }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); handleUndo() }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); handleRedo() }
      if ((e.key === 'Backspace' || e.key === 'Delete') && selectedOverlayId !== null) {
        pushUndoSnapshot()
        setOverlayLines(prev => prev.filter(x => x.id !== selectedOverlayId))
        setOverlayRects(prev => prev.filter(x => x.id !== selectedOverlayId))
        setOverlayFibs(prev => prev.filter(x => x.id !== selectedOverlayId))
        setOverlayLabels(prev => prev.filter(x => x.id !== selectedOverlayId))
        setOverlayBrushes(prev => prev.filter(x => x.id !== selectedOverlayId))
        setSelectedOverlayId(null)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [indicatorModalOpen, handleUndo, handleRedo])

  useEffect(() => {
    const drawing = drawingTools.includes(activeTool)
    const scrollEnabled = !drawing && (activeTool === 'move' || activeTool === 'cross' || activeTool === 'cursor')
    const opts = {
      handleScroll: scrollEnabled,
      handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: true },
      crosshair: { mode: crosshairOn ? (activeTool === 'magnet' ? 1 : 0) : 1 },
    }
    apiRef.current?.applyOptions(opts)
    secondaryApiRef.current?.applyOptions(opts)
  }, [activeTool, crosshairOn])

  const applyStudyData = useCallback(
    (candles: CandlePoint[], map: StudySeriesMap) => {
      let bbData: ReturnType<typeof bbands> | null = null
      let hlData: ReturnType<typeof hiLoSeries> | null = null
      const compute = (key: StudyKey): { time: UTCTimestamp; value: number }[] => {
        switch (key) {
          case 'ema9': return ema(candles, 9)
          case 'ema21': return ema(candles, 21)
          case 'ema50': return ema(candles, 50)
          case 'ema200': return ema(candles, 200)
          case 'sma20': return sma(candles, 20)
          case 'sma50': return sma(candles, 50)
          case 'wma20': return wma(candles, 20)
          case 'vwap': return vwap(candles)
          case 'bbUpper': return (bbData ??= bbands(candles)).upper
          case 'bbMid': return (bbData ??= bbands(candles)).mid
          case 'bbLower': return (bbData ??= bbands(candles)).lower
          case 'supertrend': return supertrendSeries(candles)
          case 'avgprice': return avgPriceSeries(candles)
          case 'alma': return almaSeries(candles)
          case 'hi52': return (hlData ??= hiLoSeries(candles)).hi
          case 'lo52': return (hlData ??= hiLoSeries(candles)).lo
          default: return []
        }
      }
      overlayStudies.forEach((study) => {
        const series = map[study.key]
        if (!series) return
        if (!studies[study.key] || hiddenStudies.has(study.key)) { series.setData([]); return }
        series.setData(compute(study.key))
      })
    },
    [studies, hiddenStudies],
  )

  useEffect(() => {
    if (!primaryChartRef.current) return
    const chart = createChart(primaryChartRef.current, {
      ...chartThemeOptions,
      crosshair: { mode: crosshairOn ? 0 : 1 },
      width: primaryChartRef.current.clientWidth,
      height: primaryChartRef.current.clientHeight,
    })
    seriesRef.current = chart.addSeries(CandlestickSeries, {
      upColor: '#00C076', downColor: '#FF3B30', borderUpColor: '#00C076', borderDownColor: '#FF3B30', wickUpColor: '#00C076', wickDownColor: '#FF3B30',
      lastValueVisible: true,
      priceLineVisible: true,
      priceLineColor: '#F0B90B',
      priceLineWidth: 2,
      priceLineStyle: 0,
    })
    apiRef.current = chart
    const onRangeChange = () => setRedrawTick((t) => t + 1)
    chart.timeScale().subscribeVisibleLogicalRangeChange(onRangeChange)
    overlayStudies.forEach((study) => {
      primaryStudiesRef.current[study.key] = chart.addSeries(LineSeries, {
        color: study.color, lineWidth: study.key === 'bbMid' ? 1 : 2, lastValueVisible: false, priceLineVisible: false,
      })
    })
    volumeSeriesRef.current = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceLineVisible: false,
      lastValueVisible: true,
      priceScaleId: 'volume',
    })
    chart.priceScale('volume').applyOptions(volumeHistogramPriceScaleOptions)
    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect
      if (box) chart.applyOptions({ width: box.width, height: box.height })
    })
    observer.observe(primaryChartRef.current)
    return () => { chart.timeScale().unsubscribeVisibleLogicalRangeChange(onRangeChange); observer.disconnect(); chart.remove(); apiRef.current = null; seriesRef.current = null; volumeSeriesRef.current = null; primaryStudiesRef.current = {}; seededRef.current = null; lastPrimaryPlotTimeRef.current = null; prevCandleLenRef.current = 0; firstPrimaryCandleTimeRef.current = null }
  }, [crosshairOn])

  useEffect(() => {
    if (!splitView || !secondaryChartRef.current) {
      secondaryApiRef.current?.remove(); secondaryApiRef.current = null; secondarySeriesRef.current = null; secondaryVolumeSeriesRef.current = null; secondaryStudiesRef.current = {}; secondarySeededRef.current = null; lastSecondaryPlotTimeRef.current = null; return
    }
    const chart = createChart(secondaryChartRef.current, {
      ...chartThemeOptions,
      crosshair: { mode: crosshairOn ? 0 : 1 },
      width: secondaryChartRef.current.clientWidth,
      height: secondaryChartRef.current.clientHeight,
    })
    secondarySeriesRef.current = chart.addSeries(CandlestickSeries, {
      upColor: '#00C076', downColor: '#FF3B30', borderUpColor: '#00C076', borderDownColor: '#FF3B30', wickUpColor: '#00C076', wickDownColor: '#FF3B30',
      lastValueVisible: true,
      priceLineVisible: true,
      priceLineColor: '#F0B90B',
      priceLineWidth: 2,
      priceLineStyle: 0,
    })
    secondaryApiRef.current = chart
    const onRangeChange = () => setRedrawTick((t) => t + 1)
    chart.timeScale().subscribeVisibleLogicalRangeChange(onRangeChange)
    overlayStudies.forEach((study) => {
      secondaryStudiesRef.current[study.key] = chart.addSeries(LineSeries, {
        color: study.color, lineWidth: study.key === 'bbMid' ? 1 : 2, lastValueVisible: false, priceLineVisible: false,
      })
    })
    secondaryVolumeSeriesRef.current = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceLineVisible: false,
      lastValueVisible: true,
      priceScaleId: 'volume',
    })
    chart.priceScale('volume').applyOptions(volumeHistogramPriceScaleOptions)
    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect
      if (box) chart.applyOptions({ width: box.width, height: box.height })
    })
    observer.observe(secondaryChartRef.current)
    return () => { chart.timeScale().unsubscribeVisibleLogicalRangeChange(onRangeChange); observer.disconnect(); chart.remove(); secondaryApiRef.current = null; secondarySeriesRef.current = null; secondaryVolumeSeriesRef.current = null; secondaryStudiesRef.current = {}; secondarySeededRef.current = null; lastSecondaryPlotTimeRef.current = null; prevSecondaryCandleLenRef.current = 0; firstSecondaryCandleTimeRef.current = null }
  }, [splitView, crosshairOn])

  useEffect(() => {
    seriesRef.current?.setData([])
    volumeSeriesRef.current?.setData([])
    overlayStudies.forEach((study) => {
      primaryStudiesRef.current[study.key]?.setData([])
    })
    seededRef.current = null
    lastCandleRef.current = 0
    prevCandleLenRef.current = 0
    firstPrimaryCandleTimeRef.current = null
    lastPrimaryPlotTimeRef.current = null
    pinnedPriceRangeRef.current = null
    seriesRef.current?.applyOptions({ autoscaleInfoProvider: undefined })
  }, [symbol, interval])

  useEffect(() => {
    secondarySeriesRef.current?.setData([])
    secondaryVolumeSeriesRef.current?.setData([])
    overlayStudies.forEach((study) => {
      secondaryStudiesRef.current[study.key]?.setData([])
    })
    secondarySeededRef.current = null
    lastSecondaryCandleRef.current = 0
    prevSecondaryCandleLenRef.current = 0
    firstSecondaryCandleTimeRef.current = null
    lastSecondaryPlotTimeRef.current = null
  }, [secondarySymbol, secondaryInterval])

  useEffect(() => {
    const series = seriesRef.current
    if (!series || !activeCandles.length) return
    const cleaned = normalizeCandles(activeCandles)
    if (!cleaned.length) return
    const latest = cleaned[cleaned.length - 1]
    const seedKey = `${symbol}:${interval}`
    const plotTime = localTime(latest.time) as number
    const timeRegression =
      lastPrimaryPlotTimeRef.current !== null &&
      Number.isFinite(plotTime) &&
      plotTime < lastPrimaryPlotTimeRef.current
    const prevLen = prevCandleLenRef.current
    const firstT = activeCandles[0]?.time
    const bulkHistoryArrived = activeCandles.length - prevLen > 1
    const headShifted =
      firstT !== undefined &&
      firstPrimaryCandleTimeRef.current !== null &&
      firstT !== firstPrimaryCandleTimeRef.current
    const needsReseed =
      seededRef.current !== seedKey ||
      activeCandles.length < prevLen ||
      bulkHistoryArrived ||
      headShifted ||
      !Number.isFinite(plotTime) ||
      timeRegression
    const lengthDecreased = activeCandles.length < prevLen
    const sameSeedAlready = seededRef.current === seedKey
    const chart = apiRef.current
    const savedLogical =
      chart && sameSeedAlready && !timeRegression && !lengthDecreased && !bulkHistoryArrived && !headShifted
        ? chart.timeScale().getVisibleLogicalRange()
        : null
    prevCandleLenRef.current = activeCandles.length
    if (needsReseed) {
      series.setData(toCandleSeries(activeCandles))
      volumeSeriesRef.current?.setData(toVolumeHistogram(activeCandles))
      applyStudyData(stableActiveCandles, primaryStudiesRef.current)
      restoreTimeScaleOrFit(chart, savedLogical)
      seededRef.current = seedKey
      firstPrimaryCandleTimeRef.current = firstT ?? null
      lastCandleRef.current = latest.time
      lastPrimaryPlotTimeRef.current = Number.isFinite(plotTime) ? plotTime : null
      return
    }
    if (latest.time < lastCandleRef.current) {
      series.setData(toCandleSeries(activeCandles))
      volumeSeriesRef.current?.setData(toVolumeHistogram(activeCandles))
      applyStudyData(stableActiveCandles, primaryStudiesRef.current)
      firstPrimaryCandleTimeRef.current = activeCandles[0]?.time ?? null
      lastCandleRef.current = activeCandles[activeCandles.length - 1]?.time ?? latest.time
      lastPrimaryPlotTimeRef.current = Number.isFinite(plotTime) ? plotTime : null
      return
    }
    // If multiple new candles accumulated (e.g. tab was backgrounded), a single
    // series.update() would only push the latest bar — intermediate candles are
    // lost from the chart. Detect this and do a full reseed instead.
    const bucketSec = timeframeToSeconds[interval] || 1
    const gap = latest.time - lastCandleRef.current
    if (gap >= bucketSec * 2) {
      series.setData(toCandleSeries(activeCandles))
      volumeSeriesRef.current?.setData(toVolumeHistogram(activeCandles))
      applyStudyData(stableActiveCandles, primaryStudiesRef.current)
      firstPrimaryCandleTimeRef.current = activeCandles[0]?.time ?? null
      lastCandleRef.current = latest.time
      lastPrimaryPlotTimeRef.current = Number.isFinite(plotTime) ? plotTime : null
      return
    }
    try {
      const t = localTime(latest.time) as UTCTimestamp
      series.update({ time: t, open: latest.open, high: latest.high, low: latest.low, close: latest.close })
      volumeSeriesRef.current?.update({
        time: t,
        value: Math.max(0, latest.volume ?? 0),
        color: latest.close >= latest.open ? '#00C07666' : '#FF3B3066',
      })
      lastPrimaryPlotTimeRef.current = Number.isFinite(plotTime) ? plotTime : null
    } catch {
      series.setData(toCandleSeries(activeCandles))
      volumeSeriesRef.current?.setData(toVolumeHistogram(activeCandles))
      applyStudyData(stableActiveCandles, primaryStudiesRef.current)
      firstPrimaryCandleTimeRef.current = activeCandles[0]?.time ?? null
      lastCandleRef.current = activeCandles[activeCandles.length - 1]?.time ?? latest.time
      lastPrimaryPlotTimeRef.current = Number.isFinite(plotTime) ? plotTime : null
      return
    }
    if (latest.time !== lastCandleRef.current) {
      applyStudyData(stableActiveCandles, primaryStudiesRef.current)
      lastCandleRef.current = latest.time
    }
  }, [activeCandles, stableActiveCandles, interval, symbol, applyStudyData, crosshairOn])

  useEffect(() => {
    if (!splitView) return
    const series = secondarySeriesRef.current
    if (!series || !secondaryCandles.length) return
    const cleaned = normalizeCandles(secondaryCandles)
    if (!cleaned.length) return
    const latest = cleaned[cleaned.length - 1]
    const seedKey = `${secondarySymbol ?? symbol}:${secondaryInterval}`
    const plotTime = localTime(latest.time) as number
    const timeRegression =
      lastSecondaryPlotTimeRef.current !== null &&
      Number.isFinite(plotTime) &&
      plotTime < lastSecondaryPlotTimeRef.current
    const prevLen = prevSecondaryCandleLenRef.current
    const firstT = secondaryCandles[0]?.time
    const bulkHistoryArrived = secondaryCandles.length - prevLen > 1
    const headShifted =
      firstT !== undefined &&
      firstSecondaryCandleTimeRef.current !== null &&
      firstT !== firstSecondaryCandleTimeRef.current
    const needsReseed =
      secondarySeededRef.current !== seedKey ||
      secondaryCandles.length < prevLen ||
      bulkHistoryArrived ||
      headShifted ||
      !Number.isFinite(plotTime) ||
      timeRegression
    const lengthDecreased = secondaryCandles.length < prevLen
    const sameSeedAlready = secondarySeededRef.current === seedKey
    const chart = secondaryApiRef.current
    const savedLogical =
      chart && sameSeedAlready && !timeRegression && !lengthDecreased && !bulkHistoryArrived && !headShifted
        ? chart.timeScale().getVisibleLogicalRange()
        : null
    prevSecondaryCandleLenRef.current = secondaryCandles.length
    if (needsReseed) {
      series.setData(toCandleSeries(secondaryCandles))
      secondaryVolumeSeriesRef.current?.setData(toVolumeHistogram(secondaryCandles))
      applyStudyData(stableSecondaryCandles, secondaryStudiesRef.current)
      restoreTimeScaleOrFit(chart, savedLogical)
      secondarySeededRef.current = seedKey
      firstSecondaryCandleTimeRef.current = firstT ?? null
      lastSecondaryCandleRef.current = latest.time
      lastSecondaryPlotTimeRef.current = Number.isFinite(plotTime) ? plotTime : null
      return
    }
    if (latest.time < lastSecondaryCandleRef.current) {
      series.setData(toCandleSeries(secondaryCandles))
      secondaryVolumeSeriesRef.current?.setData(toVolumeHistogram(secondaryCandles))
      applyStudyData(stableSecondaryCandles, secondaryStudiesRef.current)
      firstSecondaryCandleTimeRef.current = secondaryCandles[0]?.time ?? null
      lastSecondaryCandleRef.current = secondaryCandles[secondaryCandles.length - 1]?.time ?? latest.time
      lastSecondaryPlotTimeRef.current = Number.isFinite(plotTime) ? plotTime : null
      return
    }
    const bucketSec = timeframeToSeconds[secondaryInterval] || 1
    const gap = latest.time - lastSecondaryCandleRef.current
    if (gap >= bucketSec * 2) {
      series.setData(toCandleSeries(secondaryCandles))
      secondaryVolumeSeriesRef.current?.setData(toVolumeHistogram(secondaryCandles))
      applyStudyData(stableSecondaryCandles, secondaryStudiesRef.current)
      firstSecondaryCandleTimeRef.current = secondaryCandles[0]?.time ?? null
      lastSecondaryCandleRef.current = latest.time
      lastSecondaryPlotTimeRef.current = Number.isFinite(plotTime) ? plotTime : null
      return
    }
    try {
      const t = localTime(latest.time) as UTCTimestamp
      series.update({ time: t, open: latest.open, high: latest.high, low: latest.low, close: latest.close })
      secondaryVolumeSeriesRef.current?.update({
        time: t,
        value: Math.max(0, latest.volume ?? 0),
        color: latest.close >= latest.open ? '#00C07666' : '#FF3B3066',
      })
      lastSecondaryPlotTimeRef.current = Number.isFinite(plotTime) ? plotTime : null
    } catch {
      series.setData(toCandleSeries(secondaryCandles))
      secondaryVolumeSeriesRef.current?.setData(toVolumeHistogram(secondaryCandles))
      applyStudyData(stableSecondaryCandles, secondaryStudiesRef.current)
      firstSecondaryCandleTimeRef.current = secondaryCandles[0]?.time ?? null
      lastSecondaryCandleRef.current = secondaryCandles[secondaryCandles.length - 1]?.time ?? latest.time
      lastSecondaryPlotTimeRef.current = Number.isFinite(plotTime) ? plotTime : null
      return
    }
    if (latest.time !== lastSecondaryCandleRef.current) {
      applyStudyData(stableSecondaryCandles, secondaryStudiesRef.current)
      lastSecondaryCandleRef.current = latest.time
    }
  }, [secondaryCandles, stableSecondaryCandles, secondaryInterval, splitView, secondarySymbol, symbol, applyStudyData, crosshairOn])

  useEffect(() => {
    if (seededRef.current === `${symbol}:${interval}`) applyStudyData(stableActiveCandles, primaryStudiesRef.current)
    if (splitView && secondarySeededRef.current === `${secondarySymbol ?? symbol}:${secondaryInterval}`) applyStudyData(stableSecondaryCandles, secondaryStudiesRef.current)
  }, [applyStudyData, interval, splitView, secondaryInterval, stableActiveCandles, stableSecondaryCandles, symbol, secondarySymbol])

  useEffect(() => {
    if (lowerPane === 'none' || !lowerPaneChartRef.current) {
      lowerApiRef.current?.remove(); lowerApiRef.current = null; lowerSeriesRef.current = null; return
    }
    const chart = createChart(lowerPaneChartRef.current, {
      ...chartThemeOptions,
      width: lowerPaneChartRef.current.clientWidth,
      height: lowerPaneChartRef.current.clientHeight,
    })
    const series = chart.addSeries(LineSeries, { color: lowerPaneColor[lowerPane], lineWidth: 2, lastValueVisible: false, priceLineVisible: false })
    lowerApiRef.current = chart; lowerSeriesRef.current = series
    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect
      if (box) chart.applyOptions({ width: box.width, height: box.height })
    })
    observer.observe(lowerPaneChartRef.current)
    return () => { observer.disconnect(); chart.remove(); lowerApiRef.current = null; lowerSeriesRef.current = null }
  }, [lowerPane])

  useEffect(() => {
    if (lowerPane === 'none' || !lowerSeriesRef.current || !activeCandles.length) return
    const dataMap: Record<Exclude<LowerPaneKey, 'none'>, () => { time: UTCTimestamp; value: number }[]> = {
      rsi: () => rsiSeries(activeCandles), macd: () => macdSeries(activeCandles),
      atr: () => atrTimeSeries(activeCandles), stoch: () => stochKSeries(activeCandles),
      adx: () => adxSeries(activeCandles), aroon: () => aroonUpTimeSeries(activeCandles),
      accdist: () => accDistSeries(activeCandles),
    }
    lowerSeriesRef.current.setData(dataMap[lowerPane]())
    lowerApiRef.current?.timeScale().fitContent()
  }, [lowerPane, activeCandles])

  const resetView = () => { apiRef.current?.timeScale().fitContent(); secondaryApiRef.current?.timeScale().fitContent() }
  const toggleFavorite = (id: string) => setFavorites((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id])

  const toggleStudy = (item: IndicatorItem) => {
    if (!item.key) return
    if (item.id === 'bbands') { setStudies((prev) => ({ ...prev, bbUpper: !prev.bbUpper, bbMid: !prev.bbMid, bbLower: !prev.bbLower })); return }
    if (item.id === '52w') { setStudies((prev) => ({ ...prev, hi52: !prev.hi52, lo52: !prev.lo52 })); return }
    const key = item.key as StudyKey
    const enabledNext = !studies[key]
    setStudies((prev) => ({ ...prev, [key]: enabledNext }))
    const paneKey = lowerPaneKeyForStudy[key]
    if (paneKey) setLowerPane(enabledNext ? paneKey : lowerPane === paneKey ? 'none' : lowerPane)
  }

  const isStudyEnabled = (item: IndicatorItem) => {
    if (!item.key) return false
    if (item.id === 'bbands') return studies.bbUpper || studies.bbMid || studies.bbLower
    if (item.id === '52w') return studies.hi52 || studies.lo52
    return studies[item.key]
  }

  const applyPreset = (preset: 'scalp' | 'swing' | 'trend') => {
    const next: Record<StudyKey, boolean> = {
      ema9: false, ema21: false, ema50: false, ema200: false, sma20: false, sma50: false, wma20: false, vwap: false,
      bbUpper: false, bbMid: false, bbLower: false, rsi14: false, macd: false, atr14: false, stoch14: false,
      supertrend: false, avgprice: false, alma: false, adx: false, aroonUp: false, accdist: false, hi52: false, lo52: false,
    }
    if (preset === 'scalp') (['ema9', 'ema21', 'vwap', 'rsi14'] as StudyKey[]).forEach((k) => { next[k] = true })
    if (preset === 'swing') (['ema50', 'ema200', 'bbUpper', 'bbMid', 'bbLower', 'macd'] as StudyKey[]).forEach((k) => { next[k] = true })
    if (preset === 'trend') (['ema21', 'ema50', 'sma50', 'atr14', 'supertrend', 'adx'] as StudyKey[]).forEach((k) => { next[k] = true })
    setStudies(next)
    if (next.rsi14) setLowerPane('rsi')
    else if (next.macd) setLowerPane('macd')
    else if (next.atr14) setLowerPane('atr')
    else if (next.adx) setLowerPane('adx')
    else setLowerPane('none')
  }
  const getCursorStyle = () => {
    if (!isDrawingToolActive) return 'default'
    switch (activeTool) {
      case 'text': return 'text'
      case 'zoom': return 'zoom-in'
      case 'eraser': return 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23FF3B30\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'><path d=\'m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21\'/><path d=\'M22 21H7\'/><path d=\'m5 11 9 9\'/></svg>") 0 16, auto'
      case 'brush': return 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%2300C076\' stroke-width=\'2\'><path d=\'M12 19l7-7 3 3-7 7-3-3z\'/><path d=\'M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z\'/><path d=\'M2 2l7.586 7.586\'/><circle cx=\'11\' cy=\'11\' r=\'2\'/></svg>") 0 16, crosshair'
      case 'measure': return 'crosshair'
      case 'fib': return 'cell'
      case 'cursor': return 'default'
      case 'move': return 'move'
      default: return 'crosshair'
    }
  }

  return (
    <section ref={sectionRef} className="flex h-full min-h-0 min-w-0 flex-col rounded border border-[#2B2F36] bg-[#10141A]">
      {/* ─── TOP HEADER TOOLBAR (TradingView-style) ─── */}
      <div className="relative z-50 shrink-0 flex flex-wrap items-center gap-1.5 border-b border-[#2B2F36] bg-[#0B0E11] px-2 py-1 min-w-0">
        {/* Symbol selector */}
        <div className="relative z-50">
          <button
            className="inline-flex h-7 items-center gap-1.5 rounded px-2 text-[13px] font-semibold text-[#D9DEE3] hover:bg-[#1C2128] transition-colors"
            onClick={() => setAssetMenuOpen((v) => !v)}
          >
            <Search size={14} className="text-[#848E9C]" />
            {symbol}
            <Plus size={14} className="text-[#848E9C]" />
          </button>
          {assetMenuOpen && (
            <div className="absolute left-0 top-8 w-52 rounded border border-[#2B2F36] bg-[#0B0E11] py-1 shadow-2xl" style={{ zIndex: 9999 }}>
              <div className="px-2 pb-1.5 mb-1 border-b border-[#2B2F36]">
                <div className="relative flex items-center mt-1">
                  <Search size={13} className="absolute left-2 text-[#848E9C]" />
                  <input
                    value={assetSearch}
                    onChange={(e) => setAssetSearch(e.target.value)}
                    placeholder="Search symbol"
                    autoFocus
                    className="w-full bg-transparent pl-7 pr-2 py-1 text-[12px] text-[#D9DEE3] outline-none placeholder:text-[#657080]"
                  />
                </div>
              </div>
              <div
                className="max-h-56 overflow-y-auto px-1.5"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                {filteredAssets.map((asset) => (
                  <button
                    key={asset}
                    className={`block w-full rounded px-2 py-1.5 text-left text-[11px] transition-colors ${asset === symbol ? 'bg-[#00C076]/15 text-[#00C076]' : 'text-[#D9DEE3] hover:bg-[#1C2128]'
                      }`}
                    onClick={() => {
                      onSelectAsset?.(asset)
                      setAssetMenuOpen(false)
                      setAssetSearch('')
                    }}
                  >
                    {asset}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Separator */}
        <span className="mx-1 h-4 w-px bg-[#2B2F36] shrink-0" />

        {/* Timeframe selector */}
        <div className="flex items-center gap-0.5">
          {timeframeOptions.map((tf) => (
            <button
              key={tf}
              className={`rounded px-2 py-1 text-[10px] font-medium transition-colors ${interval === tf
                ? 'bg-[#2B2F36] text-white shadow-sm'
                : 'text-[#848E9C] hover:text-[#D9DEE3] hover:bg-[#1C2128]'
                }`}
              onClick={() => setInterval(tf)}
            >
              {tf}
            </button>
          ))}
        </div>

        {/* Separator */}
        <span className="mx-1 h-4 w-px bg-[#2B2F36] shrink-0" />

        <button
          className="inline-flex h-7 items-center gap-1 rounded px-2 text-[11px] text-[#AAB0B6] hover:bg-[#1C2128] hover:text-[#D9DEE3] transition-colors"
          onClick={openIndicatorModal}
        >
          <SlidersHorizontal size={13} />
          Indicators
        </button>

        {/* WS Status Indicator */}
        <span className="mx-1 h-3.5 w-px bg-[#2B2F36] shrink-0" />
        {wsStatus === 'connected' && (
          <span className="flex items-center gap-1.5 text-[9px] font-bold text-[#00C076] px-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00C076] animate-pulse" />
            LIVE
          </span>
        )}
        {wsStatus === 'connecting' && (
          <span className="flex items-center gap-1.5 text-[9px] font-bold text-yellow-500 px-1">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" />
            CONNECTING
          </span>
        )}
        {wsStatus === 'disconnected' && (
          <span className="flex items-center gap-1.5 text-[9px] font-bold text-[#FF4560] px-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#FF4560]" />
            OFFLINE
          </span>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right utilities */}
        <div className="flex items-center gap-1">
          <button
            className={`inline-flex h-6 w-6 items-center justify-center rounded transition-colors ${splitView ? 'bg-[#2B2F36] text-[#D9DEE3]' : 'text-[#848E9C] hover:text-[#D9DEE3] hover:bg-[#1C2128]'}`}
            title="Split View"
            onClick={() => setSplitView((v) => {
              const next = !v
              onSplitViewChange?.(next)
              return next
            })}
          >
            <SplitSquareVertical size={13} />
          </button>
          <button
            className={`inline-flex h-6 w-6 items-center justify-center rounded transition-colors ${crosshairOn ? 'bg-[#2B2F36] text-[#D9DEE3]' : 'text-[#848E9C] hover:text-[#D9DEE3] hover:bg-[#1C2128]'}`}
            title="Crosshair"
            onClick={() => setCrosshairOn((v) => !v)}
          >
            <Crosshair size={13} />
          </button>
          <button
            className="inline-flex h-6 w-6 items-center justify-center rounded text-[#848E9C] hover:text-[#D9DEE3] hover:bg-[#1C2128] transition-colors"
            title="Reset Zoom"
            onClick={resetView}
          >
            <RotateCcw size={13} />
          </button>

        </div>
      </div>

      {/* ─── MAIN CONTENT (tools sidebar + chart) ─── */}
      <div className="flex min-h-0 min-w-0 flex-1 gap-0 p-0.5">
        {/* ─── LEFT DRAWING TOOLS SIDEBAR (all tools visible) ─── */}
        <div className="shrink-0 w-[44px] flex flex-col items-center gap-2 border-r border-[#2B2F36] bg-[#0B0E11] py-2 overflow-y-auto [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }} onMouseLeave={() => setSidebarTip(null)}>
          {/* Top Utilities (Cursor & Fullscreen) */}
          <button
            onMouseEnter={(e) => { const r = e.currentTarget.getBoundingClientRect(); setSidebarTip({ text: 'Cursor', top: r.top + r.height / 2, x: r.right + 8 }) }}
            className={`flex h-[28px] w-[28px] aspect-square items-center justify-center rounded transition-all ${activeTool === 'cursor' ? 'text-white bg-[#2B2F36] shadow-sm' : 'text-[#848E9C] hover:text-white hover:bg-white/[0.04]'}`}
            onClick={() => doSelectTool('cursor')}
          >
            <MousePointer2 size={14} />
          </button>
          <button
            onMouseEnter={(e) => { const r = e.currentTarget.getBoundingClientRect(); setSidebarTip({ text: isFullscreen ? 'Exit Fullscreen' : 'Fullscreen', top: r.top + r.height / 2, x: r.right + 8 }) }}
            className={`flex h-[28px] w-[28px] aspect-square items-center justify-center rounded transition-all ${isFullscreen ? 'text-[#00C076] bg-[#2B2F36]' : 'text-[#848E9C] hover:text-white hover:bg-white/[0.04]'}`}
            onClick={toggleFullscreen}
          >
            <Maximize2 size={14} />
          </button>

          <span className="my-1 h-px w-7 bg-[#2B2F36] shrink-0" />

          {/* Line tools */}
          {[
            { key: 'line' as ToolKey, icon: <TrendingUp size={14} />, tip: 'Trend Line' },
            { key: 'hline' as ToolKey, icon: <Minus size={14} />, tip: 'Horizontal Line' },
            { key: 'vline' as ToolKey, icon: <GitCommitHorizontal size={14} />, tip: 'Vertical Line' },
            { key: 'ray' as ToolKey, icon: <ArrowUpRight size={14} />, tip: 'Ray' },
            { key: 'xline' as ToolKey, icon: <MoveHorizontal size={14} />, tip: 'Extended Line' },
            { key: 'hray' as ToolKey, icon: <ArrowRight size={14} />, tip: 'Horizontal Ray' },
            { key: 'crossline' as ToolKey, icon: <Plus size={14} />, tip: 'Cross Line' },
            { key: 'infoline' as ToolKey, icon: <Info size={14} />, tip: 'Info Line' },
            { key: 'angle' as ToolKey, icon: <Triangle size={14} />, tip: 'Trend Angle' },
            { key: 'arrow' as ToolKey, icon: <MoveUpRight size={14} />, tip: 'Arrow' },
          ].map((t) => (
            <button key={t.key}
              onMouseEnter={(e) => { const r = e.currentTarget.getBoundingClientRect(); setSidebarTip({ text: t.tip, top: r.top + r.height / 2, x: r.right + 8 }) }}
              className={`flex h-[28px] w-[28px] aspect-square items-center justify-center rounded transition-all ${activeTool === t.key ? 'text-white bg-[#2B2F36] shadow-sm' : 'text-[#848E9C] hover:text-white hover:bg-white/[0.04]'
                }`}
              onClick={() => doSelectTool(t.key)}>{t.icon}</button>
          ))}

          <span className="my-1 h-px w-7 bg-[#2B2F36] shrink-0" />

          {/* Shape tools */}
          {[
            { key: 'fib' as ToolKey, icon: <AlignJustify size={14} />, tip: 'Fibonacci Retracement' },
            { key: 'rect' as ToolKey, icon: <Square size={14} />, tip: 'Rectangle' },
          ].map((t) => (
            <button key={t.key}
              onMouseEnter={(e) => { const r = e.currentTarget.getBoundingClientRect(); setSidebarTip({ text: t.tip, top: r.top + r.height / 2, x: r.right + 8 }) }}
              className={`flex h-[28px] w-[28px] aspect-square items-center justify-center rounded transition-all ${activeTool === t.key ? 'text-white bg-[#2B2F36] shadow-sm' : 'text-[#848E9C] hover:text-white hover:bg-white/[0.04]'
                }`}
              onClick={() => doSelectTool(t.key)}>{t.icon}</button>
          ))}

          <span className="my-1 h-px w-7 bg-[#2B2F36] shrink-0" />

          {/* Annotation tools */}
          {[
            { key: 'brush' as ToolKey, icon: <Pencil size={14} />, tip: 'Brush' },
            { key: 'text' as ToolKey, icon: <Type size={14} />, tip: 'Text Label' },
          ].map((t) => (
            <button key={t.key}
              onMouseEnter={(e) => { const r = e.currentTarget.getBoundingClientRect(); setSidebarTip({ text: t.tip, top: r.top + r.height / 2, x: r.right + 8 }) }}
              className={`flex h-[28px] w-[28px] aspect-square items-center justify-center rounded transition-all ${activeTool === t.key ? 'text-white bg-[#2B2F36] shadow-sm' : 'text-[#848E9C] hover:text-white hover:bg-white/[0.04]'
                }`}
              onClick={() => doSelectTool(t.key)}>{t.icon}</button>
          ))}

          <span className="my-1 h-px w-7 bg-[#2B2F36] shrink-0" />

          {/* Measurement / utility tools */}
          {[
            { key: 'measure' as ToolKey, icon: <Ruler size={14} />, tip: 'Measure', accent: '' },
            { key: 'zoom' as ToolKey, icon: <ZoomIn size={14} />, tip: 'Zoom In', accent: '' },
            { key: 'magnet' as ToolKey, icon: <Magnet size={14} />, tip: 'Magnet Snap', accent: 'text-[#F59E0B]' },
            { key: 'eraser' as ToolKey, icon: <Eraser size={14} />, tip: 'Eraser', accent: 'text-[#FF3B30]' },
          ].map((t) => (
            <button key={t.key} data-tip={t.tip}
              className={`flex h-[28px] w-[28px] aspect-square items-center justify-center rounded transition-all ${activeTool === t.key
                ? `${t.accent || 'text-white'} bg-[#2B2F36] shadow-sm`
                : `${t.accent || 'text-[#848E9C]'} hover:text-white hover:bg-white/[0.04]`
                }`}
              onClick={() => doSelectTool(t.key)}>{t.icon}</button>
          ))}

          <span className="my-1 h-px w-7 bg-[#2B2F36] shrink-0" />

          {/* Visibility / undo / redo */}
          <button
            onMouseEnter={(e) => { const r = e.currentTarget.getBoundingClientRect(); setSidebarTip({ text: showOverlays ? 'Hide Overlays' : 'Show Overlays', top: r.top + r.height / 2, x: r.right + 8 }) }}
            className={`flex h-[28px] w-[28px] aspect-square items-center justify-center rounded transition-all ${showOverlays ? 'text-[#D9DEE3] hover:bg-white/[0.04]' : 'text-[#585E68] hover:bg-white/[0.04]'
              }`}
            onClick={() => setShowOverlays((v) => !v)}>
            {showOverlays ? <Eye size={14} /> : <EyeOff size={14} />}
          </button>
          <button
            onMouseEnter={(e) => { const r = e.currentTarget.getBoundingClientRect(); setSidebarTip({ text: 'Undo (Ctrl+Z)', top: r.top + r.height / 2, x: r.right + 8 }) }}
            className="flex h-[28px] w-[28px] aspect-square items-center justify-center rounded text-[#848E9C] hover:text-white hover:bg-white/[0.04] transition-all"
            onClick={handleUndo}>
            <Undo2 size={14} />
          </button>
          <button
            onMouseEnter={(e) => { const r = e.currentTarget.getBoundingClientRect(); setSidebarTip({ text: 'Redo (Ctrl+Y)', top: r.top + r.height / 2, x: r.right + 8 }) }}
            className="flex h-[28px] w-[28px] aspect-square items-center justify-center rounded text-[#848E9C] hover:text-white hover:bg-white/[0.04] transition-all"
            onClick={handleRedo}>
            <Redo2 size={14} />
          </button>

          <div className="flex-1" />

          {/* Screenshot */}
          <button
            onMouseEnter={(e) => { const r = e.currentTarget.getBoundingClientRect(); setSidebarTip({ text: 'Screenshot', top: r.top + r.height / 2, x: r.right + 8 }) }}
            className="flex h-[28px] w-[28px] aspect-square items-center justify-center rounded text-[#848E9C] hover:text-white hover:bg-white/[0.04] transition-all"
            onClick={handleScreenshot}>
            <Camera size={14} />
          </button>
        </div>

        {/* ─── SIDEBAR TOOLTIP (fixed, avoids overflow clip) ─── */}
        {sidebarTip && (
          <div
            style={{
              position: 'fixed',
              left: sidebarTip.x,
              top: sidebarTip.top,
              transform: 'translateY(-50%)',
              zIndex: 9999,
              pointerEvents: 'none',
            }}
          >
            <div style={{
              background: '#1C2128',
              color: '#D9DEE3',
              fontSize: 11,
              fontFamily: 'Inter, system-ui, sans-serif',
              padding: '4px 9px',
              borderRadius: 4,
              border: '1px solid #2B2F36',
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
              whiteSpace: 'nowrap',
              lineHeight: 1.4,
            }}>
              {sidebarTip.text}
            </div>
          </div>
        )}

        {/* ─── CHART AREA ─── */}
        <div className="flex flex-col min-h-0 min-w-0 flex-1 gap-0.5">
          <div className="flex flex-1 flex-col overflow-hidden min-h-0 min-w-0">
            <div className="relative flex flex-1 flex-col overflow-hidden rounded border border-[#2B2F36] min-h-0 min-w-0">
              {/* PRIMARY CHART CONTAINER */}
              <div
                ref={primaryChartRef}
                className="h-full w-full min-w-0"
                style={{ flex: splitView ? '1 1 0%' : undefined }}
                onMouseEnter={() => setActivePane('primary')}
              />
              {activeStudyChips.length > 0 && (
                <div className="pointer-events-none absolute left-1 top-1 z-30 flex flex-col">
                  {!overlayCollapsed && activeStudyChips.map((chip) => {
                    const study = overlayStudies.find((s) => s.key === chip.key)
                    const color = study?.color ?? '#AAB0B6'
                    const hidden = hiddenStudies.has(chip.key)
                    return (
                      <div key={chip.key} className="pointer-events-auto group flex items-center gap-1 rounded px-1 py-px hover:bg-[#1C2128]/60">
                        <Circle size={6} fill={color} stroke="none" className="shrink-0" />
                        <span className="text-[10px] text-[#AAB0B6]">{chip.label}</span>
                        <span className={`text-[10px] ${monoClass}`} style={{ color }}>{chip.value}</span>
                        <span className="ml-auto flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                          <button className="inline-flex h-4 w-4 items-center justify-center rounded text-[#AAB0B6] hover:text-[#D9DEE3]"
                            onClick={() => setHiddenStudies((prev) => { const next = new Set(prev); next.has(chip.key) ? next.delete(chip.key) : next.add(chip.key); return next })}>
                            {hidden ? <EyeOff size={10} /> : <Eye size={10} />}
                          </button>
                          <button className="inline-flex h-4 w-4 items-center justify-center rounded text-[#AAB0B6] hover:text-[#FF3B30]"
                            onClick={() => setStudies((prev) => ({ ...prev, [chip.key]: false }))}><Trash2 size={10} /></button>
                        </span>
                      </div>
                    )
                  })}
                  <button className="pointer-events-auto mt-0.5 flex items-center gap-0.5 rounded px-1 py-px text-[9px] text-[#6B7280] hover:text-[#AAB0B6]"
                    onClick={() => setOverlayCollapsed((v) => !v)}>
                    {overlayCollapsed ? <ChevronDown size={10} /> : <ChevronUp size={10} />}
                    {overlayCollapsed ? `${activeStudyChips.length} indicators` : 'collapse'}
                  </button>
                </div>
              )}

              <OverlayFragment
                pane="primary"
                currentOverlayRef={overlayRef}
                currentApiRef={apiRef}
                currentSeriesRef={seriesRef}
                clipWLocal={clipW > 0 ? clipW : ((overlayRef.current?.clientWidth ?? 800) - PRICE_SCALE_WIDTH)}
                clipHLocal={clipH > 0 ? clipH : ((overlayRef.current?.clientHeight ?? 500) - TIME_SCALE_HEIGHT)}
                localClipId={`${chartClipId}-primary`}
                activeTool={activeTool} getCursorStyle={getCursorStyle} handleOverlayClick={handleOverlayClick} handleOverlayMove={handleOverlayMove} handleOverlayMouseDown={handleOverlayMouseDown} isDrawingToolActive={isDrawingToolActive} clearToolDrafts={clearToolDrafts} showOverlays={showOverlays} overlayBrushes={overlayBrushes} setOverlayBrushes={setOverlayBrushes} pointsToSmoothPath={pointsToSmoothPath} pushUndoSnapshot={pushUndoSnapshot} isBrushingRef={isBrushingRef} liveBrushPointsRef={liveBrushPointsRef} brushTick={brushTick} overlayLines={overlayLines} setOverlayLines={setOverlayLines} setSelectedOverlayId={setSelectedOverlayId} dragStateRef={dragStateRef} getOverlayPoint={getOverlayPoint} extendLine={extendLine} selectedOverlayId={selectedOverlayId} overlayRects={overlayRects} setOverlayRects={setOverlayRects} overlayFibs={overlayFibs} setOverlayFibs={setOverlayFibs} overlayLabels={overlayLabels} setOverlayLabels={setOverlayLabels} draftStart={draftStart} hoverPoint={hoverPoint} measureStart={measureStart} measureEnd={measureEnd} activePane={activePane} setActivePane={setActivePane} interval={interval} timeframeToSeconds={timeframeToSeconds}
              />

              {showOverlays && textDraft && (textDraft.point.targetPane || 'primary') === 'primary' && (
                <div
                  className="absolute z-50 pointer-events-auto"
                  style={{
                    left: textDraft.point.logical !== undefined ? (apiRef.current?.timeScale().logicalToCoordinate(textDraft.point.logical as any) ?? textDraft.point.x) : textDraft.point.x,
                    top: textDraft.point.price !== undefined ? (seriesRef.current?.priceToCoordinate(textDraft.point.price) ?? textDraft.point.y) : textDraft.point.y,
                    transform: 'translate(-50%, -50%)'
                  }}
                >
                  <input
                    autoFocus
                    placeholder="Type here..."
                    className="bg-[#0B0E11] border border-[#00C076] text-[#D9DEE3] text-[11px] px-2 py-1 rounded outline-none text-center shadow-lg"
                    value={textDraft.text}
                    onChange={(e) => setTextDraft({ ...textDraft, text: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        if (textDraft.text.trim()) {
                          pushUndoSnapshot()
                          setOverlayLabels((prev) => [...prev, { id: nextOverlayId(), x: textDraft.point.x, y: textDraft.point.y, logical: textDraft.point.logical, price: textDraft.point.price, text: textDraft.text.trim() }])
                        }
                        setTextDraft(null)
                        setActiveTool('cursor')
                      }
                      if (e.key === 'Escape') { setTextDraft(null) }
                    }}
                    onBlur={() => {
                      if (textDraft.text.trim()) {
                        pushUndoSnapshot()
                        setOverlayLabels((prev) => [...prev, { id: nextOverlayId(), x: textDraft.point.x, y: textDraft.point.y, logical: textDraft.point.logical, price: textDraft.point.price, text: textDraft.text.trim() }])
                      }
                      setTextDraft(null)
                      setActiveTool('cursor')
                    }}
                  />
                </div>
              )}
            </div>

            {splitView && (
              <>
                <div
                  className="h-1.25 shrink-0 cursor-row-resize bg-[#2B2F36] hover:bg-[#00C076]/80 transition-colors z-10"
                  onPointerDown={onSplitDragStart}
                />
                <div className="relative overflow-hidden rounded border border-[#2B2F36] min-h-0 min-w-0" style={{ flex: '1 1 0%' }}>
                  {/* ─── Secondary chart header bar (matching primary style) ─── */}
                  <div className="absolute top-0 left-0 right-0 z-50 flex items-center gap-1 border-b border-[#2B2F36] bg-[#0B0E11]/95 px-2 py-1 backdrop-blur-sm">
                    {/* Symbol selector */}
                    <div className="relative z-50">
                      <button
                        className="inline-flex h-6 items-center gap-1.5 rounded px-1.5 text-[12px] font-semibold text-[#D9DEE3] hover:bg-[#1C2128] transition-colors"
                        onClick={() => setSecAssetMenuOpen((v) => !v)}
                      >
                        <Search size={13} className="text-[#848E9C]" />
                        {secondarySymbol}
                        <Plus size={13} className="text-[#848E9C]" />
                      </button>
                      {secAssetMenuOpen && (
                        <div className="absolute left-0 top-7 w-48 rounded border border-[#2B2F36] bg-[#0B0E11] py-1 shadow-2xl" style={{ zIndex: 9999 }}>
                          <div className="px-2 pb-1.5 mb-1 border-b border-[#2B2F36]">
                            <div className="relative flex items-center mt-1">
                              <Search size={12} className="absolute left-2 text-[#848E9C]" />
                              <input
                                value={secAssetSearch}
                                onChange={(e) => setSecAssetSearch(e.target.value)}
                                placeholder="Search symbol"
                                autoFocus
                                className="w-full bg-transparent pl-7 pr-2 py-1 text-[12px] text-[#D9DEE3] outline-none placeholder:text-[#657080]"
                              />
                            </div>
                          </div>
                          <div
                            className="max-h-40 overflow-y-auto px-1.5"
                            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                          >
                            {filteredSecAssets.map((asset) => (
                              <button
                                key={asset}
                                className={`block w-full rounded px-2 py-1.5 text-left text-[11px] transition-colors ${asset === secondarySymbol ? 'bg-[#00C076]/15 text-[#00C076]' : 'text-[#D9DEE3] hover:bg-[#1C2128]'
                                  }`}
                                onClick={() => { onSelectSecondaryAsset?.(asset); setSecAssetMenuOpen(false); setSecAssetSearch('') }}
                              >
                                {asset}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <span className="mx-0.5 h-3 w-px bg-[#2B2F36] shrink-0" />

                    {/* Secondary timeframe pills */}
                    {timeframeOptions.map((tf) => (
                      <button
                        key={`secondary-${tf}`}
                        className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${secondaryInterval === tf
                          ? 'bg-[#2B2F36] text-white shadow-sm'
                          : 'text-[#848E9C] hover:text-[#D9DEE3] hover:bg-[#1C2128]'
                          }`}
                        onClick={() => setSecondaryInterval(tf)}
                      >
                        {tf}
                      </button>
                    ))}

                    <span className="mx-0.5 h-3 w-px bg-[#2B2F36] shrink-0" />
                    <button
                      className="inline-flex h-6 items-center gap-1 rounded px-1.5 text-[10px] text-[#AAB0B6] hover:bg-[#1C2128] hover:text-[#D9DEE3] transition-colors"
                      onClick={openIndicatorModal}
                    >
                      <SlidersHorizontal size={11} />
                      Indicators
                    </button>

                    {/* Secondary Status */}
                    {wsStatus === 'connected' && (
                      <span className="flex items-center gap-1 text-[8px] font-bold text-[#00C076] px-1 opacity-80">
                        <span className="w-1 h-1 rounded-full bg-[#00C076] animate-pulse" />
                        LIVE
                      </span>
                    )}
                  </div>
                  {secondaryActiveStudyChips.length > 0 && (
                    <div className="pointer-events-none absolute left-1 top-8 z-30 flex flex-col">
                      {!overlayCollapsed && secondaryActiveStudyChips.map((chip) => {
                        const study = overlayStudies.find((s) => s.key === chip.key)
                        const color = study?.color ?? '#AAB0B6'
                        const hidden = hiddenStudies.has(chip.key)
                        return (
                          <div key={chip.key} className="pointer-events-auto group flex items-center gap-1 rounded px-1 py-px hover:bg-[#1C2128]/60">
                            <Circle size={6} fill={color} stroke="none" className="shrink-0" />
                            <span className="text-[10px] text-[#AAB0B6]">{chip.label}</span>
                            <span className={`text-[10px] ${monoClass}`} style={{ color }}>{chip.value}</span>
                            <span className="ml-auto flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                              <button className="inline-flex h-4 w-4 items-center justify-center rounded text-[#AAB0B6] hover:text-[#D9DEE3]" onClick={() => setHiddenStudies((prev) => { const next = new Set(prev); next.has(chip.key) ? next.delete(chip.key) : next.add(chip.key); return next })}>
                                {hidden ? <EyeOff size={10} /> : <Eye size={10} />}
                              </button>
                              <button className="inline-flex h-4 w-4 items-center justify-center rounded text-[#AAB0B6] hover:text-[#FF3B30]" onClick={() => setStudies((prev) => ({ ...prev, [chip.key]: false }))}><Trash2 size={10} /></button>
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  <div ref={secondaryChartRef} className="h-full w-full" onMouseEnter={() => setActivePane('secondary')} />

                  <OverlayFragment
                    pane="secondary"
                    currentOverlayRef={secondaryOverlayRef}
                    currentApiRef={secondaryApiRef}
                    currentSeriesRef={secondarySeriesRef}
                    clipWLocal={(secondaryOverlayRef.current?.clientWidth ?? 800) - PRICE_SCALE_WIDTH}
                    clipHLocal={(secondaryOverlayRef.current?.clientHeight ?? 500) - TIME_SCALE_HEIGHT}
                    localClipId={`${chartClipId}-secondary`}
                    activeTool={activeTool} getCursorStyle={getCursorStyle} handleOverlayClick={handleOverlayClick} handleOverlayMove={handleOverlayMove} handleOverlayMouseDown={handleOverlayMouseDown} isDrawingToolActive={isDrawingToolActive} clearToolDrafts={clearToolDrafts} showOverlays={showOverlays} overlayBrushes={overlayBrushes} setOverlayBrushes={setOverlayBrushes} pointsToSmoothPath={pointsToSmoothPath} pushUndoSnapshot={pushUndoSnapshot} isBrushingRef={isBrushingRef} liveBrushPointsRef={liveBrushPointsRef} brushTick={brushTick} overlayLines={overlayLines} setOverlayLines={setOverlayLines} setSelectedOverlayId={setSelectedOverlayId} dragStateRef={dragStateRef} getOverlayPoint={getOverlayPoint} extendLine={extendLine} selectedOverlayId={selectedOverlayId} overlayRects={overlayRects} setOverlayRects={setOverlayRects} overlayFibs={overlayFibs} setOverlayFibs={setOverlayFibs} overlayLabels={overlayLabels} setOverlayLabels={setOverlayLabels} draftStart={draftStart} hoverPoint={hoverPoint} measureStart={measureStart} measureEnd={measureEnd} activePane={activePane} setActivePane={setActivePane} interval={interval} timeframeToSeconds={timeframeToSeconds}
                  />

                  {showOverlays && textDraft && (textDraft.point.targetPane || 'secondary') === 'secondary' && (
                    <div
                      className="absolute z-50 pointer-events-auto"
                      style={{
                        left: textDraft.point.logical !== undefined ? (secondaryApiRef.current?.timeScale().logicalToCoordinate(textDraft.point.logical as any) ?? textDraft.point.x) : textDraft.point.x,
                        top: textDraft.point.price !== undefined ? (secondarySeriesRef.current?.priceToCoordinate(textDraft.point.price) ?? textDraft.point.y) : textDraft.point.y,
                        transform: 'translate(-50%, -50%)'
                      }}
                    >
                      <input
                        autoFocus
                        placeholder="Type here..."
                        className="bg-[#0B0E11] border border-[#00C076] text-[#D9DEE3] text-[11px] px-2 py-1 rounded outline-none text-center shadow-lg"
                        value={textDraft.text}
                        onChange={(e) => setTextDraft({ ...textDraft, text: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            if (textDraft.text.trim()) {
                              pushUndoSnapshot()
                              setOverlayLabels((prev) => [...prev, { id: nextOverlayId(), x: textDraft.point.x, y: textDraft.point.y, logical: textDraft.point.logical, price: textDraft.point.price, text: textDraft.text.trim(), targetPane: 'secondary' }])
                            }
                            setTextDraft(null)
                            setActiveTool('cursor')
                          }
                          if (e.key === 'Escape') { setTextDraft(null) }
                        }}
                        onBlur={() => {
                          if (textDraft.text.trim()) {
                            pushUndoSnapshot()
                            setOverlayLabels((prev) => [...prev, { id: nextOverlayId(), x: textDraft.point.x, y: textDraft.point.y, logical: textDraft.point.logical, price: textDraft.point.price, text: textDraft.text.trim(), targetPane: 'secondary' }])
                          }
                          setTextDraft(null)
                          setActiveTool('cursor')
                        }}
                      />
                    </div>
                  )}
                </div>
              </>
            )}
          </div>



          {lowerPane !== 'none' && (
            <>
              <div
                className="relative z-10 h-1.5 w-full shrink-0 cursor-row-resize opacity-0 hover:opacity-100 hover:bg-[#00C076] transition-colors -mb-1"
                onPointerDown={onLowerPaneDragStart}
              />
              <div className="relative flex flex-col overflow-hidden rounded border border-[#2B2F36] bg-[#0B0E11] min-w-0 shrink-0" style={{ height: lowerPaneHeight }}>
                <div className="border-b border-[#2B2F36] px-2 py-0.5 flex justify-between items-center group shrink-0">
                  <span className="text-[10px] text-[#AAB0B6] truncate">{lowerPaneLabel[lowerPane]}</span>
                  <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1.5 transition-opacity">
                    <button onClick={() => {
                      const studyKey = Object.entries(lowerPaneKeyForStudy).find(([, v]) => v === lowerPane)?.[0] as StudyKey | undefined
                      if (studyKey) setStudies((prev) => ({ ...prev, [studyKey]: false }))
                      setLowerPane('none')
                    }} className="text-[#AAB0B6] hover:text-[#FF3B30]" title="Close Pane">
                      <X size={12} />
                    </button>
                  </div>
                </div>
                <div ref={lowerPaneChartRef} className="flex-1 w-full min-h-0 min-w-0 relative" />
              </div>
            </>
          )}
        </div>
      </div>

      {
        quickTrade && (
          <div className="absolute z-40 w-72 rounded border border-[#2B2F36] bg-[#10141A] shadow-2xl" style={{ left: quickTradePos.x, top: quickTradePos.y }}>
            <div className="flex cursor-move items-center justify-between border-b border-[#2B2F36] px-2 py-1.5"
              onMouseDown={(e) => { quickDragRef.current.dragging = true; quickDragRef.current.dx = e.clientX - quickTradePos.x; quickDragRef.current.dy = e.clientY - quickTradePos.y }}>
              <div>
                <div className="text-[11px] font-semibold text-[#D9DEE3]">{quickTrade.action === 'buy' ? 'Quick Buy' : 'Quick Sell'} · {symbol}</div>
                <div className={`text-[11px] ${monoClass} ${tickDirection >= 0 ? 'text-[#00C076]' : 'text-[#FF3B30]'}`}>${lastPrice.toFixed(2)}</div>
              </div>
              <button className="inline-flex h-5 w-5 items-center justify-center rounded text-[#AAB0B6] hover:bg-[#1C2128]" onClick={() => setQuickTrade(null)}><X size={11} /></button>
            </div>
            <div className="space-y-2 p-2">
              <div className="grid grid-cols-2 gap-1 text-[10px]">
                <button className={`rounded border px-2 py-1 ${quickTrade.action === 'buy' ? 'border-[#00C076] bg-[#00C076]/20 text-[#00C076]' : 'border-[#2B2F36] bg-[#0B0E11] text-[#AAB0B6]'}`}
                  onClick={() => setQuickTrade((p) => p ? { ...p, action: 'buy' } : p)}>BUY</button>
                <button className={`rounded border px-2 py-1 ${quickTrade.action === 'sell' ? 'border-[#FF3B30] bg-[#FF3B30]/20 text-[#FF3B30]' : 'border-[#2B2F36] bg-[#0B0E11] text-[#AAB0B6]'}`}
                  onClick={() => setQuickTrade((p) => p ? { ...p, action: 'sell' } : p)}>SELL</button>
              </div>
              <div className="grid grid-cols-[1fr_1.1fr] items-center gap-1 text-[10px]">
                <span className="text-[#AAB0B6]">Qty</span>
                <input className={`h-8 rounded border border-[#2B2F36] bg-[#0B0E11] px-2 text-right text-[11px] text-[#D9DEE3] ${monoClass}`}
                  value={quickTrade.quantity} onChange={(e) => setQuickTrade((p) => p ? { ...p, quantity: e.target.value } : p)} />
                <span className="text-[#AAB0B6]">Price (USD)</span>
                <input className={`h-8 rounded border border-[#2B2F36] bg-[#0B0E11] px-2 text-right text-[11px] text-[#D9DEE3] disabled:opacity-50 ${monoClass}`}
                  value={quickTrade.limitPrice} disabled={quickTrade.orderType === 'market'} onChange={(e) => setQuickTrade((p) => p ? { ...p, limitPrice: e.target.value } : p)} />
              </div>
              <div className="grid grid-cols-2 gap-1 text-[10px]">
                <button className={`rounded border px-2 py-1 ${quickTrade.orderType === 'market' ? 'border-[#F59E0B] bg-[#F59E0B]/15 text-[#F59E0B]' : 'border-[#2B2F36] bg-[#0B0E11] text-[#AAB0B6]'}`}
                  onClick={() => setQuickTrade((p) => p ? { ...p, orderType: 'market', limitPrice: lastPrice.toFixed(2) } : p)}>Market</button>
                <button className={`rounded border px-2 py-1 ${quickTrade.orderType === 'limit' ? 'border-[#60A5FA] bg-[#60A5FA]/15 text-[#60A5FA]' : 'border-[#2B2F36] bg-[#0B0E11] text-[#AAB0B6]'}`}
                  onClick={() => setQuickTrade((p) => p ? { ...p, orderType: 'limit' } : p)}>Limit</button>
              </div>
              <button className={`w-full rounded border px-2 py-1 text-[10px] ${quickTrade.useRisk ? 'border-[#60A5FA] bg-[#60A5FA]/15 text-[#60A5FA]' : 'border-[#2B2F36] bg-[#0B0E11] text-[#AAB0B6]'}`}
                onClick={() => setQuickTrade((p) => p ? { ...p, useRisk: !p.useRisk } : p)}>
                {quickTrade.useRisk ? 'Hide Stoploss / Target' : 'Add Stoploss / Target'}
              </button>
              {quickTrade.useRisk && (
                <div className="grid grid-cols-[1fr_1.1fr] items-center gap-1 text-[10px]">
                  <span className="text-[#AAB0B6]">Stoploss</span>
                  <input className={`h-8 rounded border border-[#2B2F36] bg-[#0B0E11] px-2 text-right text-[11px] text-[#D9DEE3] ${monoClass}`}
                    value={quickTrade.stopLoss} placeholder="e.g. 210.50" onChange={(e) => setQuickTrade((p) => p ? { ...p, stopLoss: e.target.value } : p)} />
                  <span className="text-[#AAB0B6]">Target</span>
                  <input className={`h-8 rounded border border-[#2B2F36] bg-[#0B0E11] px-2 text-right text-[11px] text-[#D9DEE3] ${monoClass}`}
                    value={quickTrade.target} placeholder="e.g. 218.00" onChange={(e) => setQuickTrade((p) => p ? { ...p, target: e.target.value } : p)} />
                </div>
              )}
              <div className="rounded border border-[#2B2F36] bg-[#0B0E11] px-2 py-1 text-[10px] text-[#AAB0B6]">
                Est. Notional: <span className={`${monoClass} text-[#D9DEE3]`}>${(Number(quickTrade.quantity || 0) * (quickTrade.orderType === 'market' ? lastPrice : Number(quickTrade.limitPrice || 0))).toFixed(2)}</span>
              </div>
              {quickTradeError && <div className="rounded border border-[#FF3B30]/30 bg-[#FF3B30]/10 px-2 py-1 text-[10px] text-[#FF7C74]">{quickTradeError}</div>}
              <button className={`w-full rounded px-2 py-2 text-[11px] font-semibold disabled:cursor-not-allowed disabled:opacity-45 ${quickTrade.action === 'buy' ? 'bg-[#00C076] text-black' : 'bg-[#FF3B30] text-white'}`}
                onClick={submitQuickTrade} disabled={Boolean(quickTradeError)}>
                Confirm {quickTrade.action === 'buy' ? 'Buy' : 'Sell'}
              </button>
            </div>
          </div>
        )
      }

      {
        indicatorModalOpen && (
          <div className="absolute inset-0 z-30 bg-black/50 p-4" onMouseDown={() => setIndicatorModalOpen(false)}>
            <div className="absolute flex h-[72%] w-107.5 flex-col overflow-hidden rounded border border-[#2B2F36] bg-[#0F1218] shadow-2xl"
              style={{ left: modalPosition?.x ?? 24, top: modalPosition?.y ?? 24 }} onMouseDown={(e) => e.stopPropagation()}>
              <div className="flex cursor-move items-center justify-between border-b border-[#2B2F36] px-4 py-3" onMouseDown={startModalDrag}>
                <h3 className="text-[18px] font-semibold text-[#D9DEE3]">Indicators</h3>
                <button className="inline-flex h-8 w-8 items-center justify-center rounded bg-[#1C2128] text-[#AAB0B6]" onClick={() => setIndicatorModalOpen(false)}><X size={16} /></button>
              </div>
              <div className="border-b border-[#2B2F36] p-3">
                <label className="flex items-center gap-2 rounded border border-[#2B2F36] bg-[#0B0E11] px-3 py-2 text-[#AAB0B6]">
                  <Search size={14} />
                  <input value={indicatorSearch} onChange={(e) => setIndicatorSearch(e.target.value)}
                    className="w-full bg-transparent text-[13px] outline-none placeholder:text-[#657080]" placeholder="Search" />
                </label>
                <div className="mt-2 flex gap-1">
                  {(['all', 'favorites', 'builtins'] as IndicatorTab[]).map((tab) => (
                    <button key={tab} className={`rounded px-2 py-0.75 text-[10px] ${indicatorTab === tab ? 'bg-[#1F2937] text-[#D9DEE3]' : 'bg-[#1C2128] text-[#AAB0B6]'}`}
                      onClick={() => setIndicatorTab(tab)}>{tab.charAt(0).toUpperCase() + tab.slice(1)}</button>
                  ))}
                </div>
                <div className="mt-2 flex gap-1">
                  {(['scalp', 'swing', 'trend'] as const).map((p) => (
                    <button key={p} className="rounded bg-[#1C2128] px-2 py-0.75 text-[10px] text-[#AAB0B6]" onClick={() => applyPreset(p)}>{p.charAt(0).toUpperCase() + p.slice(1)}</button>
                  ))}
                </div>
              </div>
              <div className={`min-h-0 flex-1 overflow-y-auto p-2 ${scrollClass}`}>
                {filteredIndicators.length === 0 && (
                  <div className="rounded border border-[#2B2F36] bg-[#0B0E11] px-3 py-2 text-[12px] text-[#6B7280]">No indicators found for this filter.</div>
                )}
                {filteredIndicators.map((item, i) => {
                  const enabled = isStudyEnabled(item)
                  const favorite = favorites.includes(item.id)
                  return (
                    <div
                      key={item.id}
                      className="mb-1 flex cursor-pointer items-center gap-2 rounded px-2 py-2 hover:bg-[#2B2F36] transition-colors animate-scale-in"
                      style={{ animationDelay: `${i * 15}ms` }}
                      onClick={() => toggleStudy(item)}
                    >
                      <button
                        className={`text-[12px] h-6 w-6 flex items-center justify-center rounded hover:bg-white/5 transition-colors ${favorite ? 'text-[#FCD34D]' : 'text-[#6B7280]'}`}
                        onClick={(e) => { e.stopPropagation(); toggleFavorite(item.id) }}
                      >
                        {favorite ? '*' : 'o'}
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-medium text-[#D9DEE3]">{item.label}</div>
                        <div className="text-[10px] text-[#6B7280]">{item.category}</div>
                      </div>
                      <button
                        className={`rounded px-2.5 py-1 text-[10px] font-semibold transition-all ${enabled ? 'bg-[#00C076]/20 text-[#00C076] ring-1 ring-[#00C076]/30' : 'bg-[#1C2128] text-[#AAB0B6] hover:bg-[#2B2F36]'}`}
                        onClick={(e) => { e.stopPropagation(); toggleStudy(item) }}
                      >
                        {enabled ? 'Added' : 'Add'}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )
      }
    </section >
  )
}