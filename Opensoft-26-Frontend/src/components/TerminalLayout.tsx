import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ComponentType } from 'react'
import { Briefcase, List, Eye, PieChart, Wallet, X, Bot, Crosshair, SlidersHorizontal, TrendingUp, House, Trophy, UserCircle, ChevronRight, Cpu } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import * as api from '../services/api'
import { useLiveMarket } from '../hooks/useLiveMarket'
import type { OrderNotice } from '../hooks/useLiveMarket'
import { useMarketData } from '../hooks/useMarketData'
import { useTradeControls } from '../hooks/useTradeControls'
import { useBulbulBot } from '../hooks/useBulbulBot'
import { usePortfolio } from '../hooks/usePortfolio'
import type { CandlePoint, OpenOrder } from '../types/market'
import { ChartPanel } from './terminal/ChartPanel'
import type { IntervalKey } from './terminal/ChartPanel'
import { ControlPanel } from './terminal/ControlPanel'
import { OrderBookPanel } from './terminal/OrderBookPanel'
import { PortfolioPanel } from './terminal/PortfolioPanel'
import { TrendingPanel } from './terminal/TrendingPanel'
import { WatchlistPanel } from './terminal/WatchlistPanel'
import { BotPanel } from './terminal/BotPanel'
import { LeaderboardPanel } from './terminal/LeaderboardPanel'
import { BulbulEditor } from './bulbul/BulbulEditor'

type DragAxis = 'x' | 'y'
type DragTarget = 'left' | 'rightDrawer'
type AlphaBotLog = { id: number; time: number; type: string; message: string; botID: string }

const MIN_PANEL_PX = 140
const ALPHABOT_SESSION_KEY = 'alphabot_session_v1'
const ALPHABOT_LOGS_KEY = 'alphabot_logs_v1'
const MAX_ALPHABOT_LOGS = 300
const RIGHT_PANEL_TAB_KEY = 'terminal_right_panel_tab_v1'
const LEADERBOARD_REFRESH_MS = 5 * 60 * 1000

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function normalizeSymbol(symbol: string) {
  return symbol.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

function aggregateCandles(candles: CandlePoint[], bucketSeconds: number): CandlePoint[] {
  if (bucketSeconds <= 1) return candles
  const output: CandlePoint[] = []
  let current: CandlePoint | null = null
  for (const candle of candles) {
    const bucketTime = Math.floor(candle.time / bucketSeconds) * bucketSeconds
    if (!current || current.time !== bucketTime) {
      if (current) output.push(current)
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
  if (current) output.push(current)
  return output
}

type NavRailButtonProps = {
  icon: ComponentType<{ className?: string; strokeWidth?: number }>
  label: string
  isActive: boolean
  onClick: () => void
  onMouseEnter?: (label: string, e: React.MouseEvent<HTMLButtonElement>) => void
  onMouseLeave?: () => void
  className?: string
}

function NavRailButton({ icon: Icon, label, isActive, onClick, onMouseEnter, onMouseLeave, className = '' }: NavRailButtonProps) {
  return (
    <button
      onClick={onClick}
      onMouseEnter={(e) => onMouseEnter?.(label, e)}
      onMouseLeave={onMouseLeave}
      className={`relative flex w-[80%] aspect-square items-center justify-center rounded-lg transition-all ${isActive ? 'shadow-sm' : 'hover:bg-white/[0.04]'
        } ${className}`}
      style={{
        backgroundColor: isActive ? 'var(--bg-secondary)' : 'transparent',
        color: isActive ? 'var(--accent-color)' : 'var(--text-secondary)'
      }}
    >
      <Icon className="h-[18px] w-[18px]" strokeWidth={isActive ? 2 : 1.6} />
    </button>
  )
}

export default function TerminalLayout() {
  const [chartInterval, setChartInterval] = useState<IntervalKey>(() =>
    (localStorage.getItem('oak_capital_chart_interval') as IntervalKey)
    || (localStorage.getItem('synthbull_chart_interval') as IntervalKey)
    || '1m'
  )
  const [sidebarTip, setSidebarTip] = useState<{ text: string, top: number, x: number } | null>(null)

  const handleNavMouseEnter = useCallback((label: string, e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setSidebarTip({
      text: label,
      top: rect.top + rect.height / 2,
      x: rect.left - 8 // Position to the left of the right rail
    })
  }, [])
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const defaultAssetOptions = ['AAPL', 'MSFT', 'BTCUSD', 'ETHUSD', 'NVDA']
  const [selectedSymbol, setSelectedSymbol] = useState(() => {
    const routeSymbol = searchParams.get('symbol')
    if (routeSymbol) {
      const normalizedRaw = normalizeSymbol(routeSymbol)
      if (normalizedRaw) return normalizedRaw
    }
    const savedSymbol = localStorage.getItem('oak_capital_last_symbol') || localStorage.getItem('synthbull_last_symbol')
    if (savedSymbol) {
      return savedSymbol
    }
    return defaultAssetOptions[0]
  })

  const handleSymbolChange = useCallback((newSymbol: string) => {
    if (newSymbol === selectedSymbol) return
    localStorage.setItem('synthbull_last_symbol', newSymbol)
    window.location.href = `/terminal?symbol=${encodeURIComponent(newSymbol)}`
  }, [selectedSymbol])

  useEffect(() => {
    localStorage.setItem('oak_capital_last_symbol', selectedSymbol)
  }, [selectedSymbol])

  // Live feed (always mounted for auto-reconnect)
  const feed = useLiveMarket(selectedSymbol);

  const { snapshot: market, telemetry } = useMarketData(feed, 100);
  // Live persistent portfolio from backend (falls back to market snapshot while unauthenticated)
  const { snapshot: livePortfolio, refresh: portfolioRefresh } = usePortfolio();
  const assetOptions = useMemo(
    () => market.trendingStocks.map((row) => row.symbol),
    [market.trendingStocks],
  )
  const [secondarySymbol, setSecondarySymbol] = useState(() => assetOptions[1] || defaultAssetOptions[1])
  const [watchlist, setWatchlist] = useState<string[]>([])
  const [isWatchlistLoaded, setIsWatchlistLoaded] = useState(false)
  const [editingOrder, setEditingOrder] = useState<OpenOrder | null>(null)
  const [editForm, setEditForm] = useState({ quantity: '', price: '', stopLoss: '', takeProfit: '' })

  useEffect(() => {
    if (assetOptions.length === 0) return
    if (!assetOptions.includes(selectedSymbol)) setSelectedSymbol(assetOptions[0])
  }, [assetOptions, selectedSymbol])

  useEffect(() => {
    const routeSymbol = searchParams.get('symbol')
    if (!routeSymbol) return
    if (assetOptions.length === 0) return
    const normalizedRaw = normalizeSymbol(routeSymbol)
    const resolved = assetOptions.find((symbol) => normalizeSymbol(symbol) === normalizedRaw)
    if (resolved && resolved !== selectedSymbol) {
      setSelectedSymbol(resolved)
    }
  }, [searchParams, assetOptions, selectedSymbol])
  useEffect(() => {
    feed.subscribeSymbol(selectedSymbol);
  }, [feed, selectedSymbol]);

  const [chartSplitViewOpen, setChartSplitViewOpen] = useState(false)
  useEffect(() => {
    feed.setSplitComparisonSymbol(chartSplitViewOpen ? secondarySymbol : null)
  }, [feed, chartSplitViewOpen, secondarySymbol])

  const marketView = useMemo(() => {
    const symbolMatch = market.activeSymbol === selectedSymbol
    const candles1s = symbolMatch ? aggregateCandles(market.candles1s, 1) : []
    const latest = candles1s[candles1s.length - 1]
    const prev = candles1s[candles1s.length - 2]
    const tickDirection: 1 | -1 | 0 = !latest || !prev ? market.tickDirection : latest.close > prev.close ? 1 : latest.close < prev.close ? -1 : 0
    return {
      ...market,
      tickDirection,
      lastPrice: symbolMatch ? market.lastPrice : 0,
      bids: symbolMatch ? market.bids : [],
      asks: symbolMatch ? market.asks : [],
      candles1s,
    }
  }, [market, selectedSymbol])

  // Recompute when the market snapshot flushes: `liveFeed` is a stable ref, so we must
  // depend on `market` (new object each flush) or secondary candles never update.
  const secondaryMarketView = useMemo(() => {
    const sc = feed.getSymbolCandles(secondarySymbol)
    return {
      candles1s: aggregateCandles(sc.candles1s, 1),
    }
  }, [secondarySymbol, feed, market])

  const controls = useTradeControls(marketView.lastPrice, selectedSymbol, (request) => feed.executeOrder(request))
  const controlsRef = useRef(controls)
  const onBulbulSessionRestored = useCallback((s: { symbol: string }) => {
    if (s.symbol) setSelectedSymbol(s.symbol)
  }, [])
  const bot = useBulbulBot(feed, selectedSymbol, { onRestoredSession: onBulbulSessionRestored, evalInterval: chartInterval })
  const [showBotEditor, setShowBotEditor] = useState(false)

  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return !!localStorage.getItem('token')
  })

  useEffect(() => {
    const handleStorageChange = () => {
      setIsLoggedIn(!!localStorage.getItem('token'))
    }
    window.addEventListener('storage', handleStorageChange)

    // Custom event for same-tab logout
    const handleAuthChange = () => handleStorageChange()
    window.addEventListener('auth-change', handleAuthChange)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('auth-change', handleAuthChange)
    }
  }, [])

  const [showSignInModal, setShowSignInModal] = useState(false)
  const [orderToast, setOrderToast] = useState<OrderNotice | null>(null)
  const orderToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleAuthRequired = useCallback(() => {
    setShowSignInModal(true)
  }, [])

  // Sync watchlist with backend
  useEffect(() => {
    if (!isLoggedIn) {
      setWatchlist([]) // Guests start with an empty watchlist
      setIsWatchlistLoaded(false)
      return
    }
    if (isWatchlistLoaded) return

    api.getWatchlist().then((res) => {
      if (res.success && Array.isArray(res.data)) {
        const symbols = res.data.map((item: any) => item.symbol)
        if (symbols.length > 0) {
          setWatchlist(symbols)
        }
        setIsWatchlistLoaded(true)
      }
    }).catch(console.error)
  }, [isLoggedIn, isWatchlistLoaded])

  useEffect(() => {
    controlsRef.current = controls
  }, [controls])

  useEffect(() => {
    const unsubscribe = feed.onOrderNotice((notice) => {
      setOrderToast(notice)
      if (orderToastTimer.current) {
        clearTimeout(orderToastTimer.current)
      }
      orderToastTimer.current = setTimeout(() => {
        setOrderToast(null)
        orderToastTimer.current = null
      }, 4500)
    })

    return () => {
      unsubscribe()
      if (orderToastTimer.current) {
        clearTimeout(orderToastTimer.current)
        orderToastTimer.current = null
      }
    }
  }, [feed])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const tag = target?.tagName?.toLowerCase()
      const isTyping =
        tag === 'input' || tag === 'textarea' || target?.isContentEditable === true
      if (isTyping) return
      const key = event.key.toLowerCase()

      const tradeKeys = ['l', 'k', 'q', 'e', 'm', 'n', 'b', 's']
      if (tradeKeys.includes(key)) {
        event.preventDefault()
        if (!isLoggedIn) {
          handleAuthRequired()
          return
        }
        if (key === 'l') { controlsRef.current.setLong() }
        else if (key === 'k') { controlsRef.current.setShort() }
        else if (key === 'q') { controlsRef.current.quickBuy() }
        else if (key === 'e') { controlsRef.current.quickSell() }
        else if (key === 'm') { controlsRef.current.setOrderType('market') }
        else if (key === 'n') { controlsRef.current.setOrderType('limit') }
        else if (key === 'b') { controlsRef.current.execute('buy') }
        else if (key === 's') { controlsRef.current.execute('sell') }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isLoggedIn, handleAuthRequired])

  const containerRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<{ target: DragTarget; axis: DragAxis; startPos: number; startValue: number } | null>(null)

  const [leftWidth, setLeftWidth] = useState(22)
  const [showOrderBook, setShowOrderBook] = useState(true)
  const [rightDrawerWidth, setRightDrawerWidth] = useState(280)
  const [rightNavTab, setRightNavTab] = useState<string | null>(() => {
    const saved = localStorage.getItem(RIGHT_PANEL_TAB_KEY)
    return saved || 'controls'
  })
  const [ordersTab, setOrdersTab] = useState<'open' | 'history'>('open')
  const [alphabotBotID, setAlphabotBotID] = useState<string | null>(null)
  const [alphabotStatus, setAlphabotStatus] = useState<'idle' | 'running' | 'error'>('idle')
  const [alphabotLogs, setAlphabotLogs] = useState<AlphaBotLog[]>([])
  const [alphabotPnl, setAlphabotPnl] = useState(0)
  // Persist strategy selection across page refreshes
  const [alphabotStrategy, setAlphabotStrategyRaw] = useState<import('../services/api').FlagshipStrategyName>(
    () => (localStorage.getItem('alphabot_strategy') as import('../services/api').FlagshipStrategyName | null) ?? 'flagship_v2'
  )
  const setAlphabotStrategy = (s: import('../services/api').FlagshipStrategyName) => {
    localStorage.setItem('alphabot_strategy', s)
    setAlphabotStrategyRaw(s)
  }
  const seenAlphaLogKeysRef = useRef<Set<string>>(new Set())
  const [leaderboardRows, setLeaderboardRows] = useState<api.LeaderboardEntry[]>([])
  const [isPublishingCurrentBulbul, setIsPublishingCurrentBulbul] = useState(false)
  const [showPublicLeaderboard, setShowPublicLeaderboard] = useState<boolean>(() => {
    return localStorage.getItem('leaderboard_show_public_v1') !== 'false'
  })

  useEffect(() => {
    if (!isLoggedIn) return
    if (rightNavTab !== 'bot') return
    void bot.refreshSavedStrategies()
  }, [bot.refreshSavedStrategies, isLoggedIn, rightNavTab])

  const toggleRightNav = (tab: string) => {
    setRightNavTab((prev) => (prev === tab ? null : tab))
  }

  // On mount: check if an alphabot is still running on the server and restore state
  useEffect(() => {
    if (!isLoggedIn) return
    const restore = async () => {
      const res = await api.listSimBots()
      if (!res.success || !res.data) return
      const bots = (res.data as any)?.bots as Array<{ bot_id: string; status: string; pnl?: number }> | undefined
      if (!Array.isArray(bots)) return
      const running = bots.find((b) => b.status === 'running')
      if (running) {
        setAlphabotBotID(running.bot_id)
        setAlphabotStatus('running')
        if (typeof running.pnl === 'number') setAlphabotPnl(running.pnl)
      }
    }
    void restore()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn])

  useEffect(() => {
    if (!rightNavTab) {
      localStorage.removeItem(RIGHT_PANEL_TAB_KEY)
      return
    }
    localStorage.setItem(RIGHT_PANEL_TAB_KEY, rightNavTab)
  }, [rightNavTab])

  const loadLeaderboard = useCallback(async () => {
    if (!isLoggedIn) return
    const res = await api.getLeaderboard(showPublicLeaderboard, 'weekly')
    if (res.success && Array.isArray(res.data)) {
      setLeaderboardRows(res.data)
    }
  }, [isLoggedIn, showPublicLeaderboard])

  useEffect(() => {
    if (!isLoggedIn) return
    void loadLeaderboard()
    const timer = setInterval(() => { void loadLeaderboard() }, LEADERBOARD_REFRESH_MS)
    return () => clearInterval(timer)
  }, [isLoggedIn, loadLeaderboard])

  useEffect(() => {
    localStorage.setItem('leaderboard_show_public_v1', showPublicLeaderboard ? 'true' : 'false')
  }, [showPublicLeaderboard])

  const persistAlphaLogs = useCallback((rows: AlphaBotLog[]) => {
    try {
      localStorage.setItem(ALPHABOT_LOGS_KEY, JSON.stringify(rows))
    } catch {
      // ignore storage failures
    }
  }, [])

  const appendAlphabotLogs = useCallback((botID: string, rows: Array<{ id: number; time: number; type: string; message: string }>) => {
    if (!Array.isArray(rows) || rows.length === 0) return
    const ordered = rows.slice().sort((a, b) => (a.time ?? 0) - (b.time ?? 0))
    const fresh: AlphaBotLog[] = []
    for (const row of ordered) {
      const key = `${botID}:${row.id}`
      if (seenAlphaLogKeysRef.current.has(key)) continue
      seenAlphaLogKeysRef.current.add(key)
      fresh.push({ id: row.id, time: row.time, type: row.type, message: row.message, botID })
    }
    if (fresh.length === 0) return
    setAlphabotLogs((prev) => {
      const next = [...fresh.slice().reverse(), ...prev].slice(0, MAX_ALPHABOT_LOGS)
      persistAlphaLogs(next)
      return next
    })
  }, [persistAlphaLogs])

  const clearAlphabotSession = useCallback(() => {
    try {
      localStorage.removeItem(ALPHABOT_SESSION_KEY)
    } catch {
      // ignore storage failures
    }
  }, [])

  const refreshAlphabotStatus = useCallback(async () => {
    if (!alphabotBotID) return
    const res = await api.getSimBotStatus(alphabotBotID)
    if (!res.success || !res.data) {
      const err = (res.error || '').toLowerCase()
      if (err.includes('not found') || err.includes('forbidden') || err.includes('unauthorized')) {
        setAlphabotStatus('idle')
        setAlphabotBotID(null)
        setAlphabotPnl(0)
        clearAlphabotSession()
      }
      return
    }
    const payload = res.data as { status?: 'running' | 'idle' | 'error'; pnl?: number; logs?: Array<{ id: number; time: number; type: string; message: string }> }
    if (payload.status) setAlphabotStatus(payload.status as 'running' | 'idle' | 'error')
    if (typeof payload.pnl === 'number') setAlphabotPnl(payload.pnl)
    if (Array.isArray(payload.logs)) appendAlphabotLogs(alphabotBotID, payload.logs)
    if (payload.status === 'idle' || payload.status === 'error') {
      setAlphabotBotID(null)
      clearAlphabotSession()
    }
    // Refresh portfolio so equity reflects bot fills
    void portfolioRefresh()
  }, [alphabotBotID, appendAlphabotLogs, clearAlphabotSession, portfolioRefresh])

  useEffect(() => {
    if (!isLoggedIn) return
    if (alphabotBotID) return
    try {
      const raw = localStorage.getItem(ALPHABOT_SESSION_KEY)
      if (!raw) return
      const session = JSON.parse(raw) as { botId?: string; symbol?: string }
      if (!session?.botId) return
      if (session.symbol) setSelectedSymbol(session.symbol)
      setAlphabotBotID(session.botId)
      setAlphabotStatus('running')
    } catch {
      clearAlphabotSession()
    }
  }, [alphabotBotID, clearAlphabotSession, isLoggedIn])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(ALPHABOT_LOGS_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as AlphaBotLog[]
      if (!Array.isArray(parsed)) return
      const normalized = parsed
        .filter((x) => x && typeof x.id === 'number' && typeof x.message === 'string' && typeof x.botID === 'string')
        .slice(0, MAX_ALPHABOT_LOGS)
      setAlphabotLogs(normalized)
      const seen = new Set<string>()
      for (const row of normalized) seen.add(`${row.botID}:${row.id}`)
      seenAlphaLogKeysRef.current = seen
    } catch {
      // ignore storage parsing issues
    }
  }, [])

  useEffect(() => {
    if (!alphabotBotID) return
    void refreshAlphabotStatus()
    const timer = setInterval(() => { void refreshAlphabotStatus() }, 1800)
    return () => clearInterval(timer)
  }, [alphabotBotID, refreshAlphabotStatus])

  const renderAuthOverlay = (title: string, description: string) => (
    <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center justify-center" style={{ color: 'var(--text-secondary)' }}>
      <div className="mb-6 rounded-2xl p-6 border shadow-sm flex items-center justify-center transition-colors" style={{ backgroundColor: 'rgba(var(--text-primary-rgb), 0.05)', borderColor: 'var(--border-color)' }}>
        <UserCircle className="h-10 w-10 opacity-30" strokeWidth={1} style={{ color: 'var(--text-primary)' }} />
      </div>
      <h3 className="mb-2 font-bold text-[14px]" style={{ color: 'var(--text-primary)' }}>{title}</h3>
      <p className="text-[12px] font-medium text-center max-w-[200px] mb-6 leading-relaxed opacity-80" style={{ color: 'var(--text-secondary)' }}>
        {description}
      </p>
      <button
        onClick={handleAuthRequired}
        className="w-full max-w-[200px] rounded-lg bg-gradient-to-r from-[#00C076] to-white py-2.5 text-[12px] font-bold text-[#0B0E14] shadow-lg shadow-[#00C076]/20 transition-all hover:opacity-90 hover:scale-[1.02] active:scale-[0.98]"
      >
        Sign In to Access
      </button>
    </div>
  )

  const onPointerDown = useCallback((target: DragTarget, axis: DragAxis, event: React.PointerEvent) => {
    event.preventDefault()
    const startPos = axis === 'x' ? event.clientX : event.clientY
    const startValue = target === 'left' ? leftWidth : rightDrawerWidth
    dragRef.current = { target, axis, startPos, startValue }
    document.body.style.cursor = axis === 'x' ? 'col-resize' : 'row-resize'
    document.body.style.userSelect = 'none'
  }, [leftWidth, rightDrawerWidth])

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const drag = dragRef.current
      if (!drag) return
      const container = containerRef.current
      if (!container) return
      const rect = container.getBoundingClientRect()
      const delta = (drag.axis === 'x' ? event.clientX : event.clientY) - drag.startPos
      const totalPx = drag.axis === 'x' ? rect.width : rect.height
      const deltaPct = (delta / totalPx) * 100
      const minPct = (MIN_PANEL_PX / totalPx) * 100

      if (drag.target === 'left') {
        setLeftWidth(clamp(drag.startValue + deltaPct, minPct, 35))
      } else if (drag.target === 'rightDrawer') {
        const minDrawerPx = 280
        const maxDrawerPx = Math.max(360, rect.width * 0.58)
        setRightDrawerWidth(clamp(drag.startValue - delta, minDrawerPx, maxDrawerPx))
      }
    }

    const onPointerUp = () => {
      dragRef.current = null
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [])

  const centerWidth = 100 - (showOrderBook ? leftWidth : 0)

  return (
    <div className="flex h-screen w-screen overflow-hidden" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <main className="flex-1 overflow-hidden p-1 flex flex-col min-w-0" style={{ paddingRight: rightNavTab ? 0 : '4px' }}>
        <div
          ref={containerRef}
          className="flex h-full flex-col gap-0 border rounded-lg overflow-hidden min-w-0 shadow-sm transition-colors"
          style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
        >
          <div className="flex min-h-0 min-w-0 flex-1">
            {showOrderBook ? (
              <>
                <div className="min-h-0 overflow-hidden" style={{ width: `${leftWidth}%`, minWidth: '220px' }}>
                  <OrderBookPanel
                    symbol={selectedSymbol}
                    lastPrice={marketView.lastPrice}
                    tickDirection={marketView.tickDirection}
                    bids={marketView.bids}
                    asks={marketView.asks}
                    onClose={() => setShowOrderBook(false)}
                  />
                </div>

                <div
                  className="group relative z-10 flex w-[3px] shrink-0 cursor-col-resize items-center justify-center bg-transparent"
                  onPointerDown={(e) => onPointerDown('left', 'x', e)}
                >
                  <div className="h-full w-px bg-transparent transition-colors group-hover:bg-[#00C076]/35" />
                </div>
              </>
            ) : (
              <button
                onClick={() => setShowOrderBook(true)}
                title="Show Order Book"
                className="flex w-[26px] shrink-0 flex-col items-center justify-center transition-all border-r"
                style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
              >
                <ChevronRight className="mb-2 h-4 w-4" />
                <div className="[writing-mode:vertical-lr] text-[11px] font-bold tracking-[0.2em] uppercase text-center rotate-180 opacity-50">
                  Order Book
                </div>
              </button>
            )}

            <div className="min-h-0 min-w-0 overflow-hidden" style={{ width: `${centerWidth}%` }}>
              <ChartPanel
                lastPrice={marketView.lastPrice}
                tickDirection={marketView.tickDirection}
                candles1s={marketView.candles1s}
                symbol={selectedSymbol}
                secondarySymbol={secondarySymbol}
                secondaryCandles1s={secondaryMarketView.candles1s}
                onSelectSecondaryAsset={setSecondarySymbol}
                assets={assetOptions}
                onSelectAsset={handleSymbolChange}
                onSplitViewChange={setChartSplitViewOpen}
                wsStatus={feed.wsStatus}
                onIntervalChange={setChartInterval}
                onQuickTrade={(action, quantity, orderType, limitPrice) => {
                  if (!isLoggedIn) {
                    handleAuthRequired()
                    return
                  }
                  feed.executeOrder({
                    asset: selectedSymbol,
                    action,
                    direction: action === 'buy' ? 'long' : 'short',
                    quantity,
                    orderType,
                    limitPrice: orderType === 'limit' ? limitPrice : marketView.lastPrice,
                    timestamp: Date.now(),
                  })
                }}
              />
            </div>
          </div>
        </div>
      </main>

      {/* Right Drawer */}
      {rightNavTab && (
        <div
          className="relative shrink-0 border-l flex flex-col transition-colors"
          style={{ width: `${rightDrawerWidth}px`, backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
        >
          {/* Resize Overlay */}
          <div
            className="absolute top-0 bottom-0 left-0 z-50 w-[4px] cursor-col-resize bg-transparent transition-colors hover:bg-[#00C076]/40"
            onPointerDown={(e) => onPointerDown('rightDrawer', 'x', e)}
          />
          <div className="flex items-center justify-between border-b p-4" style={{ borderColor: 'var(--border-color)' }}>
            <h2 className="text-sm font-semibold capitalize tracking-wide" style={{ color: 'var(--text-primary)' }}>
              {rightNavTab === 'bot' ? 'BulBul' : rightNavTab}
            </h2>
            <button onClick={() => setRightNavTab(null)} style={{ color: 'var(--text-secondary)' }} className="hover:text-white transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>

          {rightNavTab === 'trending' ? (
            <div className="flex-1 overflow-hidden flex flex-col">
              <TrendingPanel stocks={market.trendingStocks} selectedSymbol={selectedSymbol} onSelectSymbol={handleSymbolChange} />
            </div>
          ) : rightNavTab === 'portfolio' ? (
            !isLoggedIn ? renderAuthOverlay('Portfolio Access', 'Sign in to view your portfolio and track your performance.') : (
              <div className="flex-1 min-h-0 overflow-y-auto flex flex-col">
                <PortfolioPanel
                  positions={livePortfolio.positions.map(p => ({
                    asset: p.symbol,
                    quantity: p.quantity,
                    entryPrice: p.avg_entry,
                    markPrice: p.mark_price,
                    pnl: p.pnl,
                  }))}
                  cashBalance={livePortfolio.available_cash}
                  blockedBalance={livePortfolio.blocked_cash}
                  onSelectSymbol={handleSymbolChange}
                  onClosePosition={(asset) => {
                    const position = livePortfolio.positions.find(p => p.symbol === asset);
                    if (!position) return;

                    const quantity = Math.abs(position.quantity);
                    const action = position.quantity > 0 ? 'sell' : 'buy';

                    feed.executeOrder({
                      asset: asset,
                      action: action,
                      direction: action === 'buy' ? 'long' : 'short',
                      quantity: quantity,
                      orderType: 'market',
                      limitPrice: 0, // Market order
                      timestamp: Date.now(),
                    });
                  }}
                />
              </div>
            )
          ) : rightNavTab === 'controls' ? (
            <div className="flex-1 overflow-hidden flex flex-col">
              <ControlPanel
                symbol={selectedSymbol}
                lastPrice={marketView.lastPrice}
                tickDirection={marketView.tickDirection}
                direction={controls.direction}
                orderType={controls.orderType}
                quantityText={controls.quantityText}
                priceText={controls.priceText}
                stopLossText={controls.stopLossText}
                targetText={controls.targetText}
                intent={controls.intent}
                onSetLong={controls.setLong}
                onSetShort={controls.setShort}
                onSetOrderType={controls.setOrderType}
                onQuantityChange={controls.setQuantityText}
                onPriceChange={controls.setPriceText}
                onStopLossChange={controls.setStopLossText}
                onTargetChange={controls.setTargetText}
                onQuickBuy={controls.quickBuy}
                onQuickSell={controls.quickSell}
                onBuy={() => controls.execute('buy')}
                onSell={() => controls.execute('sell')}
                telemetry={telemetry}
                fills={marketView.fills.filter((fill) => fill.asset === selectedSymbol)}
                cashBalance={livePortfolio.available_cash}
                isLoggedIn={isLoggedIn}
                onAuthRequired={handleAuthRequired}
              />
            </div>
          ) : rightNavTab === 'bot' ? (
            !isLoggedIn ? renderAuthOverlay('BulBul', 'Sign in to configure and launch Build Your Own Bot.') : (
              <div className="flex-1 overflow-hidden flex flex-col">
                {/* BulBul launch banner */}
                <button
                  onClick={() => setShowBotEditor(true)}
                  className="shrink-0 mx-3 mt-3 mb-1 flex items-center gap-2.5 rounded-lg border border-[#3B4AFF]/40 bg-gradient-to-r from-[#1a1f3a] to-[#111827] px-3 py-2.5 text-left transition-all hover:border-[#3B4AFF]/70 hover:brightness-110 group"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#3B4AFF]/20 text-[#818CF8] group-hover:bg-[#3B4AFF]/30 transition-colors">
                    <Bot className="h-4 w-4" />
                  </span>
                  <span className="flex flex-col">
                    <span className="text-[12px] font-semibold text-[#C7D2FE]">BulBul</span>
                    <span className="text-[10px] text-[#6B7280]">Build Your Own Bot</span>
                  </span>
                  <span className="ml-auto text-[#6B7280] group-hover:text-[#818CF8] transition-colors text-[10px]">Open →</span>
                </button>
                <BotPanel
                  status={bot.status}
                  botPnl={bot.botPnl}
                  accountPnl={bot.accountPnl}
                  logs={bot.logs}
                  selectedPreset={bot.selectedPreset}
                  activeStrategyName={bot.activeStrategyName}
                  mode={bot.mode}
                  savedStrategies={bot.savedStrategies}
                  onSelectPreset={bot.loadPreset}
                  onLoadSavedStrategy={(name) => { void bot.loadSavedStrategy(name) }}
                  onRefreshSavedStrategies={() => { void bot.refreshSavedStrategies() }}
                  onModeChange={bot.setMode}
                  onStart={bot.startBot}
                  onStop={bot.stopBot}
                  onOpenEditor={() => setShowBotEditor(true)}
                  onClear={bot.clearAll}
                  canPublishCurrent={!!bot.runningBotID}
                  isPublishingCurrent={isPublishingCurrentBulbul}
                  currentPublishEnabled={!!leaderboardRows.find((r) => r.owned_by_me && r.bot_id === bot.runningBotID)?.is_public}
                  currentShareStrategyEnabled={!!leaderboardRows.find((r) => r.owned_by_me && r.bot_id === bot.runningBotID)?.share_strategy}
                  onTogglePublishCurrent={async (enabled) => {
                    const botID = bot.runningBotID
                    if (!botID) return
                    setIsPublishingCurrentBulbul(true)
                    const currentShare = !!leaderboardRows.find((r) => r.owned_by_me && r.bot_id === botID)?.share_strategy
                    const res = await api.setLeaderboardPublish(botID, enabled, currentShare)
                    setIsPublishingCurrentBulbul(false)
                    if (res.success) void loadLeaderboard()
                  }}
                  onToggleShareCurrentStrategy={async (enabled) => {
                    const botID = bot.runningBotID
                    if (!botID) return
                    setIsPublishingCurrentBulbul(true)
                    const currentPublic = !!leaderboardRows.find((r) => r.owned_by_me && r.bot_id === botID)?.is_public
                    const res = await api.setLeaderboardPublish(botID, currentPublic, enabled)
                    setIsPublishingCurrentBulbul(false)
                    if (res.success) void loadLeaderboard()
                  }}
                  isLoggedIn={isLoggedIn}
                  onAuthRequired={handleAuthRequired}
                />
              </div>
            )
          ) : rightNavTab === 'alphabot' ? (
          !isLoggedIn ? renderAuthOverlay('Alphabot', 'Sign in to run the advanced non-GUI alpha bot.') : (
              <div className="flex-1 flex flex-col min-h-0 bg-[#0B0E11]">
                {/* Header */}
                <div className="px-3 pt-3 pb-2 shrink-0">
                  <div className="text-[11px] font-semibold text-[#AAB0B6] uppercase tracking-wide mb-1">Alphabot — Strategy Selector</div>
                  <p className="text-[10px] text-[#848E9C]">Pick a prebuilt server-side strategy and launch it on {selectedSymbol}.</p>
                </div>

                {/* Status bar */}
                <div className="mx-3 mb-2 rounded border border-[#2B2F36] bg-[#101720] px-3 py-2 shrink-0 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[9px] text-[#7E8794] uppercase tracking-wide">Status</div>
                    <div className={`text-[12px] font-bold ${alphabotStatus === 'running' ? 'text-[#00C076]' : alphabotStatus === 'error' ? 'text-[#FF3B30]' : 'text-[#6B7280]'}`}>
                      {alphabotStatus.toUpperCase()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[9px] text-[#7E8794] uppercase tracking-wide">PnL</div>
                    <div className={`text-[12px] font-bold tabular-nums ${alphabotPnl >= 0 ? 'text-[#00C076]' : 'text-[#FF3B30]'}`}>
                      {alphabotPnl >= 0 ? '+' : ''}{alphabotPnl.toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* Strategy cards */}
                <div className="flex-1 overflow-y-auto px-3 pb-2 flex flex-col gap-1.5">
                  {(() => {
                    const STRATEGY_DESCRIPTIONS: Record<string, string> = {
                      flagship_v2:             'EMA 9/21 crossover · RSI≥50 confirm · 1.2% stop',
                      bollinger_mean_reversion:'Buy lower band · Sell upper band · RSI≥28 gate',
                      macd_momentum:           'MACD/Signal cross · RSI 45–55 confirm · 1.2% stop',
                      rsi_reversal:            'RSI≤30 → buy · RSI≥70 → sell · 2% stop',
                      fast_ema_trend:           'EMA 9/21 fast cross · RSI neutral gate · high freq',
                      macd_bollinger_breakout: 'MACD cross AND price crosses Bollinger mid · RSI gate',
                    }
                    const STRATEGY_LABELS: Record<string, string> = {
                      flagship_v2:             'Flagship v2',
                      bollinger_mean_reversion:'Bollinger Mean Reversion',
                      macd_momentum:           'MACD Momentum',
                      rsi_reversal:            'RSI Reversal',
                      fast_ema_trend:           'Fast EMA Trend',
                      macd_bollinger_breakout: 'MACD + Bollinger Breakout',
                    }
                    const names = Object.keys(STRATEGY_LABELS)
                    return names.map((name) => {
                      const isSelected = alphabotStrategy === name
                      return (
                        <button
                          key={name}
                          disabled={alphabotStatus === 'running'}
                          onClick={() => setAlphabotStrategy(name as typeof alphabotStrategy)}
                          className={`w-full text-left rounded-lg border px-3 py-2 transition-all ${
                            isSelected
                              ? 'border-[#00C076]/60 bg-[#00C076]/10'
                              : 'border-[#2B2F36] bg-[#101720] hover:border-[#3B4AFF]/40 hover:bg-[#1a1f3a]'
                          } ${alphabotStatus === 'running' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className={`text-[11px] font-semibold truncate ${isSelected ? 'text-[#00C076]' : 'text-[#C7D2FE]'}`}>
                              {STRATEGY_LABELS[name]}
                            </span>
                            {isSelected && (
                              <span className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide bg-[#00C076]/20 text-[#00C076]">
                                Selected
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 text-[9px] text-[#6B7280] leading-relaxed">{STRATEGY_DESCRIPTIONS[name]}</p>
                        </button>
                      )
                    })
                  })()}
                </div>

                {/* Action button */}
                <div className="px-3 pb-3 shrink-0">
                  {alphabotStatus === 'running' ? (
                    <button
                      onClick={async () => {
                        if (!alphabotBotID) return
                        await api.stopSimBot(alphabotBotID)
                        setAlphabotStatus('idle')
                        setAlphabotBotID(null)
                        clearAlphabotSession()
                      }}
                      className="w-full rounded-lg bg-gradient-to-r from-[#FF3B30] to-[#FF6B6B] py-2.5 text-[11px] font-bold text-white transition-all hover:opacity-90 active:scale-95 shadow-lg shadow-[#FF3B30]/20"
                    >
                      ⏹ Stop Alphabot
                    </button>
                  ) : (
                    <button
                      onClick={async () => {
                        const resp = await api.startFlagshipBot(
                          selectedSymbol,
                          bot.mode,
                          undefined,
                          (alphabotStrategy || 'flagship_v2') as import('../services/api').FlagshipStrategyName,
                          chartInterval,
                        )
                        if (!resp.success) return
                        const botID = (resp.data as any)?.bot_id as string
                        if (botID) {
                          setAlphabotBotID(botID)
                          setAlphabotStatus('running')
                          try {
                            localStorage.setItem(ALPHABOT_SESSION_KEY, JSON.stringify({
                              botId: botID,
                              symbol: selectedSymbol,
                            }))
                          } catch {
                            // ignore storage failures
                          }
                          void refreshAlphabotStatus()
                        }
                      }}
                      className="w-full rounded-lg bg-gradient-to-r from-[#00C076] to-[#00E09A] py-2.5 text-[11px] font-bold text-[#0B0E14] transition-all hover:opacity-90 active:scale-95 shadow-lg shadow-[#00C076]/25"
                    >
                      ▶ Start Alphabot
                    </button>
                  )}
                </div>
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-[10px] opacity-60" style={{ color: 'var(--text-secondary)' }}>Recent logs</div>
                  <button
                    onClick={() => {
                      setAlphabotLogs([])
                      persistAlphaLogs([])
                    }}
                    className="rounded border border-[#2B2F36] px-2 py-0.5 text-[10px] text-[#AAB0B6] hover:bg-[#1B232E] hover:text-white transition-colors"
                  >
                    Clear Logs
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto space-y-1">
                  {alphabotLogs.slice(0, 30).map((l) => (
                    <div key={`${l.botID}-${l.id}`} className="rounded bg-[#10151D] border border-[#2B2F36] px-2 py-1 text-[10px]">
                      <span className="text-slate-500 mr-1">{new Date(l.time).toLocaleTimeString([], { hour12: false })}</span>
                      <span
                        className={
                          l.type === 'error'
                            ? 'text-[#FF3B30]'
                            : l.type === 'trade'
                              ? (l.message.toLowerCase().includes('sell')
                                  ? 'text-[#FF4560]'
                                  : l.message.toLowerCase().includes('buy')
                                    ? 'text-[#00C076]'
                                    : 'text-[#7DD3FC]')
                              : 'text-[#D9DEE3]'
                        }
                      >
                        {l.message}
                      </span>
                    </div>
                  ))}
                  {alphabotLogs.length === 0 && <div className="text-[10px] text-[#6D7480]">No logs yet</div>}
                </div>
              </div>
            )
          ) : rightNavTab === 'leaderboard' ? (
            <div className="flex-1 overflow-hidden flex flex-col">
              <LeaderboardPanel
                rows={leaderboardRows}
                includePublic={showPublicLeaderboard}
                onToggleIncludePublic={(next) => setShowPublicLeaderboard(next)}
                onPublishChange={async (botID, isPublic, shareStrategy) => {
                  const prev = leaderboardRows
                  setLeaderboardRows((rows) => rows.map((r) =>
                    r.bot_id === botID && r.owned_by_me
                      ? { ...r, is_public: isPublic, share_strategy: shareStrategy }
                      : r,
                  ))
                  const res = await api.setLeaderboardPublish(botID, isPublic, shareStrategy)
                  if (!res.success) setLeaderboardRows(prev)
                  void loadLeaderboard()
                }}
                onOpenEditor={(botName) => {
                  console.log(`[Leaderboard] Loading bot: ${botName}`)
                  setShowBotEditor(true)
                }}
              />
            </div>
          ) : rightNavTab === 'orders' ? (
            !isLoggedIn ? renderAuthOverlay('Orders', 'Sign in to view your open and historical orders.') : (
              <div className="flex-1 flex flex-col min-h-0 transition-colors" style={{ backgroundColor: 'var(--bg-primary)' }}>
                <div className="p-3 shrink-0 flex flex-col gap-3">
                  <div className="flex items-center gap-1 p-0.5 rounded-md border transition-colors" style={{ backgroundColor: 'rgba(var(--text-primary-rgb), 0.05)', borderColor: 'var(--border-color)' }}>
                    <button
                      onClick={() => setOrdersTab('open')}
                      className={`flex-1 rounded py-1 text-[11px] font-medium transition-all ${ordersTab === 'open' ? 'shadow-sm text-white' : 'opacity-60'}`}
                      style={{
                        backgroundColor: ordersTab === 'open' ? 'var(--accent-color)' : 'transparent',
                        color: ordersTab === 'open' ? '#0B0E14' : 'var(--text-secondary)'
                      }}
                    >
                      Open
                    </button>
                    <button
                      onClick={() => setOrdersTab('history')}
                      className={`flex-1 rounded py-1 text-[11px] font-medium transition-all ${ordersTab === 'history' ? 'shadow-sm text-white' : 'opacity-60'}`}
                      style={{
                        backgroundColor: ordersTab === 'history' ? 'var(--accent-color)' : 'transparent',
                        color: ordersTab === 'history' ? '#0B0E14' : 'var(--text-secondary)'
                      }}
                    >
                      History
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr] gap-x-2 px-3 pb-2 text-[10px] uppercase tracking-wider border-b transition-colors shrink-0" style={{ color: 'var(--text-secondary)', borderColor: 'var(--border-color)' }}>
                  <div>Symbol</div>
                  <div>Side</div>
                  <div className="text-right">Qty</div>
                  <div className="text-right pr-2">Price</div>
                </div>

                <div className="flex-1 overflow-y-auto w-full">
                  <div className="flex flex-col">
                    {ordersTab === 'open' ? (
                      marketView.openOrders.length > 0 ? (
                        marketView.openOrders.map((order) => (
                          <div key={order.id} className="group relative grid grid-cols-[1.5fr_1fr_1fr_1fr] items-center gap-x-2 border-b px-3 py-2 text-[11px] hover:bg-[rgba(var(--text-primary-rgb),0.03)] transition-colors" style={{ borderColor: 'var(--border-color)' }}>
                            <div className="flex flex-col truncate">
                              <span className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>{order.asset}</span>
                              <span className="text-[9px] opacity-50" style={{ color: 'var(--text-primary)' }}>
                                {new Date(order.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                              </span>
                            </div>
                            <div className="flex flex-col">
                              <span className={`font-semibold ${order.action === 'buy' ? 'text-[#00C076]' : 'text-[#FF4560]'}`}>
                                {order.action.toUpperCase()}
                              </span>
                              <span className="text-[9px] opacity-50" style={{ color: 'var(--text-primary)' }}>LIMIT</span>
                            </div>
                            <span className="text-right font-mono tabular-nums opacity-80" style={{ color: 'var(--text-primary)' }}>
                              {Math.round(order.quantity)}
                            </span>
                            <span className="text-right font-mono tabular-nums pr-2 font-semibold" style={{ color: 'var(--text-primary)' }}>
                              {order.limitPrice.toFixed(2)}
                            </span>

                            <button
                              className="absolute right-2 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-slate-500 hover:text-white rounded hover:bg-[#FF3B30]/80"
                              title="Cancel Order"
                              onClick={() => feed.cancelOrder(order.id)}
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ))
                      ) : (
                        <div className="p-4 text-center text-[11px] text-[#6D7480]">No open orders</div>
                      )
                    ) : (
                      marketView.fills.length > 0 ? (
                        marketView.fills.slice(0, 20).map((fill) => (
                          <div key={fill.id} className="group relative grid grid-cols-[1.5fr_1fr_1fr_1fr] items-center gap-x-2 border-b px-3 py-2 text-[11px] hover:bg-[rgba(var(--text-primary-rgb),0.03)] transition-colors" style={{ borderColor: 'var(--border-color)' }}>
                            <div className="flex flex-col truncate">
                              <span className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>{fill.asset}</span>
                              <span className="text-[9px] opacity-50" style={{ color: 'var(--text-primary)' }}>
                                {new Date(fill.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                              </span>
                            </div>
                            <div className="flex flex-col">
                              <span className={`font-semibold ${fill.action === 'buy' ? 'text-[#00C076]' : 'text-[#FF4560]'}`}>
                                {fill.action.toUpperCase()}
                              </span>
                              <span className="text-[9px] opacity-50" style={{ color: 'var(--text-primary)' }}>FILL</span>
                            </div>
                            <span className="text-right font-mono tabular-nums opacity-80" style={{ color: 'var(--text-primary)' }}>
                              {fill.quantity.toFixed(3)}
                            </span>
                            <span className="text-right font-mono tabular-nums pr-2 font-semibold" style={{ color: 'var(--text-primary)' }}>
                              {fill.price.toFixed(2)}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="p-4 text-center text-[11px] text-[#6D7480]">No order history</div>
                      )
                    )}
                  </div>
                </div>
              </div>
            )
          ) : rightNavTab === 'positions' ? (
            !isLoggedIn ? renderAuthOverlay('Open Positions', 'Sign in to monitor your active trades and unrealized P&L.') : (
              <div className="flex-1 flex flex-col min-h-0 transition-colors" style={{ backgroundColor: 'var(--bg-primary)' }}>
                <div className="p-3 shrink-0">
                  <div className="text-[11px] font-semibold tracking-wide uppercase" style={{ color: 'var(--text-secondary)' }}>OPEN POSITIONS</div>
                </div>

                <div className="grid grid-cols-[1fr_0.8fr_1fr_1.2fr] gap-x-2 px-3 pb-2 text-[10px] uppercase tracking-wider border-b transition-colors shrink-0" style={{ color: 'var(--text-secondary)', borderColor: 'var(--border-color)' }}>
                  <div>Symbol</div>
                  <div className="text-right">Qty</div>
                  <div className="text-right">Avg Price</div>
                  <div className="text-right pr-6">Unrealized P&L</div>
                </div>

                <div className="flex-1 overflow-y-auto">
                  <div className="flex flex-col">
                    {livePortfolio.positions.length === 0 ? (
                      <div className="p-4 text-center text-[11px] opacity-40 italic" style={{ color: 'var(--text-secondary)' }}>No open positions</div>
                    ) : livePortfolio.positions.map((pos) => {
                      const formattedQty = Number.isInteger(pos.quantity) ? pos.quantity.toString() : pos.quantity.toFixed(3)
                      const pnlSign = pos.pnl > 0 ? '+' : ''
                      const formattedPnl = `${pnlSign}${pos.pnl.toFixed(2)}`

                      return (
                        <div key={pos.symbol} className="group relative grid grid-cols-[1fr_0.8fr_1fr_1.2fr] items-center gap-x-2 border-b px-3 py-2 text-[11px] hover:bg-[rgba(var(--text-primary-rgb),0.03)] transition-colors" style={{ borderColor: 'var(--border-color)' }}>
                          <span className="truncate font-medium" style={{ color: 'var(--text-primary)' }}>{pos.symbol}</span>
                          <span className={`text-right font-mono tabular-nums ${pos.quantity >= 0 ? 'text-[#00C076]' : 'text-[#FF4560]'}`}>
                            {formattedQty}
                          </span>
                          <span className="text-right font-mono tabular-nums opacity-80" style={{ color: 'var(--text-primary)' }}>
                            {pos.avg_entry.toFixed(2)}
                          </span>
                          <span className={`text-right font-mono tabular-nums pr-6 ${pos.pnl >= 0 ? 'text-[#00C076]' : 'text-[#FF4560]'}`}>
                            {formattedPnl}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )
          ) : rightNavTab === 'watchlist' ? (
            !isLoggedIn ? renderAuthOverlay('Watchlist', 'Sign in to create and manage your personal watchlist.') : (
              <WatchlistPanel
                watchlist={watchlist}
                marketSummary={market.trendingStocks}
                availableAssets={assetOptions}
                selectedSymbol={selectedSymbol}
                onSelectSymbol={handleSymbolChange}
                onAddSymbol={(sym) => {
                  setWatchlist((prev) => Array.from(new Set([...prev, sym])))
                  if (isLoggedIn) api.addWatchlistSymbol(sym).catch(console.error)
                }}
                onRemoveSymbol={(sym) => {
                  setWatchlist((prev) => prev.filter((s) => s !== sym))
                  if (isLoggedIn) api.removeWatchlistSymbol(sym).catch(console.error)
                }}
              />
            )
          ) : rightNavTab === 'holdings' ? (
            !isLoggedIn ? renderAuthOverlay('Holdings', 'Sign in to view your asset allocation and portfolio holdings.') : (
              <div className="flex-1 flex flex-col min-h-0 transition-colors" style={{ backgroundColor: 'var(--bg-primary)' }}>
                <div className="p-3 shrink-0 flex flex-col gap-4">
                  <div className="text-[11px] font-semibold tracking-wide uppercase" style={{ color: 'var(--text-secondary)' }}>HOLDINGS</div>

                  {(() => {
                    const actualList = livePortfolio.positions.filter((p) => p.quantity > 0)
                    const totalValue = actualList.reduce((acc, p) => acc + (p.quantity * p.mark_price), 0)
                    const colors = ['bg-[#3B82F6]', 'bg-[#10B981]', 'bg-[#F59E0B]', 'bg-[#8B5CF6]', 'bg-[#EC4899]']

                    if (actualList.length === 0) {
                      return <div className="text-[11px] opacity-40 italic" style={{ color: 'var(--text-secondary)' }}>No current holdings.</div>
                    }

                    return (
                      <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-center text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                          <span>Asset Allocation</span>
                        </div>
                        <div className="flex h-1.5 w-full rounded-full overflow-hidden transition-colors" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                          {actualList.map((pos, idx) => {
                            const weight = totalValue > 0 ? ((pos.quantity * pos.mark_price) / totalValue) * 100 : 0
                            return <div key={pos.symbol} className={`h-full ${colors[idx % colors.length]}`} style={{ width: `${weight}%` }} title={`${pos.symbol}: ${weight.toFixed(1)}%`} />
                          })}
                        </div>
                      </div>
                    )
                  })()}
                </div>

                <div className="grid grid-cols-[1.5fr_1fr_1fr_1.2fr] gap-x-2 px-3 pb-2 text-[10px] uppercase tracking-wider border-b transition-colors shrink-0" style={{ color: 'var(--text-secondary)', borderColor: 'var(--border-color)' }}>
                  <div>Symbol</div>
                  <div className="text-right">Qty</div>
                  <div className="text-right">Mark Price</div>
                  <div className="text-right pr-2">Unrealized P&L</div>
                </div>

                <div className="flex-1 overflow-y-auto">
                  <div className="flex flex-col">
                    {livePortfolio.positions.filter((p) => p.quantity > 0).length === 0 ? (
                      <div className="p-4 text-center text-[11px] opacity-40 italic" style={{ color: 'var(--text-secondary)' }}>No active holdings</div>
                    ) : livePortfolio.positions.filter((p) => p.quantity > 0).map((pos) => {
                      const formattedQty = Number.isInteger(pos.quantity) ? pos.quantity.toString() : pos.quantity.toFixed(3)
                      const pnlSign = pos.pnl > 0 ? '+' : ''
                      const formattedPnl = `${pnlSign}${pos.pnl.toFixed(2)}`

                      return (
                        <div key={pos.symbol} className="grid grid-cols-[1.5fr_1fr_1fr_1.2fr] items-center gap-x-2 border-b px-3 py-2 text-[11px] hover:bg-[rgba(var(--text-primary-rgb),0.03)] transition-colors" style={{ borderColor: 'var(--border-color)' }}>
                          <span className="truncate font-medium" style={{ color: 'var(--text-primary)' }}>{pos.symbol}</span>
                          <span className="text-right font-mono tabular-nums opacity-80" style={{ color: 'var(--text-primary)' }}>
                            {formattedQty}
                          </span>
                          <span className="text-right font-mono tabular-nums opacity-80" style={{ color: 'var(--text-primary)' }}>
                            {pos.mark_price.toFixed(2)}
                          </span>
                          <span className={`text-right font-mono tabular-nums pr-2 ${pos.pnl >= 0 ? 'text-[#00C076]' : 'text-[#FF4560]'}`}>
                            {formattedPnl}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )
          ) : rightNavTab === 'balance' ? (
            !isLoggedIn ? renderAuthOverlay('Account Balance', 'Sign in to view your cash, equity, and margin usage.') : (
              <div className="flex-1 flex flex-col min-h-0 transition-colors" style={{ backgroundColor: 'var(--bg-primary)' }}>
                <div className="p-3 shrink-0">
                  <div className="text-[11px] font-semibold tracking-wide uppercase" style={{ color: 'var(--text-secondary)' }}>BALANCE</div>
                </div>
                <div className="flex-1 overflow-y-auto px-3">
                  <div className="flex flex-col gap-3 max-w-sm mt-2">
                    {(() => {
                      const cash = livePortfolio.available_cash
                      const equity = livePortfolio.equity
                      const blocked = livePortfolio.blocked_cash || 0
                      const holdingsValueAbs = livePortfolio.positions.reduce((acc, p) => acc + (p.mark_price * Math.abs(p.quantity)), 0)

                      // Margin = 10% of absolute position value + 100% of blocked cash (for limit orders)
                      const marginUsed = (holdingsValueAbs * 0.1) + blocked
                      const marginPct = equity > 0 ? Math.min(100, (marginUsed / (equity + marginUsed)) * 100) : (marginUsed > 0 ? 100 : 0)

                      return (
                        <>
                          <div className="flex justify-between items-center py-1">
                            <span className="text-sm opacity-60" style={{ color: 'var(--text-secondary)' }}>Cash</span>
                            <span className="text-sm font-medium tabular-nums" style={{ color: 'var(--text-primary)' }}>{new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cash)}</span>
                          </div>
                          <div className="flex justify-between items-center py-1">
                            <span className="text-sm opacity-60" style={{ color: 'var(--text-secondary)' }}>Equity</span>
                            <span className="text-sm font-medium tabular-nums" style={{ color: 'var(--text-primary)' }}>{new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(equity)}</span>
                          </div>

                          <div className="w-full h-px my-1" style={{ backgroundColor: 'var(--border-color)' }} />

                          <div className="flex flex-col gap-2 pt-1">
                            <div className="flex justify-between items-center">
                              <span className="text-sm opacity-60" style={{ color: 'var(--text-secondary)' }}>Margin Used</span>
                              <span className="text-sm font-medium tabular-nums" style={{ color: 'var(--text-primary)' }}>{new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(marginUsed)}</span>
                            </div>

                            <div className="flex flex-col gap-1.5 pt-1">
                              <div className="h-1.5 w-full rounded-full overflow-hidden transition-colors" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                                <div className="h-full bg-blue-500 rounded-full transition-all duration-300" style={{ width: `${marginPct}%` }} />
                              </div>
                              <div className="text-[10px] text-right opacity-50" style={{ color: 'var(--text-secondary)' }}>
                                {marginPct.toFixed(1)}% Utilized
                              </div>
                            </div>
                          </div>
                        </>
                      )
                    })()}
                  </div>
                </div>
              </div>
            )
          ) : (
            <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center justify-center" style={{ color: 'var(--text-secondary)' }}>
              <div className="mb-6 rounded-2xl p-8 border shadow-sm transition-colors" style={{ backgroundColor: 'rgba(var(--text-primary-rgb), 0.05)', borderColor: 'var(--border-color)' }}>
                {rightNavTab === 'positions' && <Crosshair className="h-10 w-10 text-[#00C076]" strokeWidth={1} />}
                {rightNavTab === 'orders' && <List className="h-10 w-10 text-[#00C076]" strokeWidth={1} />}
                {rightNavTab === 'watchlist' && <Eye className="h-10 w-10 text-[#00C076]" strokeWidth={1} />}
                {rightNavTab === 'holdings' && <PieChart className="h-10 w-10 text-[#00C076]" strokeWidth={1} />}
                {rightNavTab === 'balance' && <Wallet className="h-10 w-10 text-[#00C076]" strokeWidth={1} />}
              </div>
              <p className="text-sm font-medium">You have no open {rightNavTab}</p>
              <button className="mt-4 px-4 py-1.5 text-xs text-[#00C076] hover:bg-[#00C076]/10 rounded-md transition-colors font-medium">
                Refresh
              </button>
            </div>
          )}
        </div>
      )}

      {/* Right Navigation Rail */}
      <div className="w-[48px] shrink-0 border-l transition-colors flex flex-col items-center py-3 gap-1.5 z-20 overflow-y-auto" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }} onMouseLeave={() => setSidebarTip(null)}>
        <NavRailButton icon={House} label="Home" isActive={false} onClick={() => navigate('/')} onMouseEnter={handleNavMouseEnter} onMouseLeave={() => setSidebarTip(null)} />
        <NavRailButton icon={SlidersHorizontal} label="Controls" isActive={rightNavTab === 'controls'} onClick={() => toggleRightNav('controls')} onMouseEnter={handleNavMouseEnter} onMouseLeave={() => setSidebarTip(null)} />
        <NavRailButton icon={TrendingUp} label="Trending" isActive={rightNavTab === 'trending'} onClick={() => toggleRightNav('trending')} onMouseEnter={handleNavMouseEnter} onMouseLeave={() => setSidebarTip(null)} />
        <NavRailButton icon={Briefcase} label="Portfolio" isActive={rightNavTab === 'portfolio'} onClick={() => toggleRightNav('portfolio')} onMouseEnter={handleNavMouseEnter} onMouseLeave={() => setSidebarTip(null)} />
        <NavRailButton icon={Bot} label="BulBul" isActive={rightNavTab === 'bot'} onClick={() => toggleRightNav('bot')} onMouseEnter={handleNavMouseEnter} onMouseLeave={() => setSidebarTip(null)} />
        <NavRailButton icon={Cpu} label="Alphabot" isActive={rightNavTab === 'alphabot'} onClick={() => toggleRightNav('alphabot')} onMouseEnter={handleNavMouseEnter} onMouseLeave={() => setSidebarTip(null)} />
        <NavRailButton icon={Trophy} label="Leaderboard" isActive={rightNavTab === 'leaderboard'} onClick={() => toggleRightNav('leaderboard')} onMouseEnter={handleNavMouseEnter} onMouseLeave={() => setSidebarTip(null)} />
        <NavRailButton icon={Crosshair} label="Positions" isActive={rightNavTab === 'positions'} onClick={() => toggleRightNav('positions')} onMouseEnter={handleNavMouseEnter} onMouseLeave={() => setSidebarTip(null)} />
        <NavRailButton icon={List} label="Orders" isActive={rightNavTab === 'orders'} onClick={() => toggleRightNav('orders')} onMouseEnter={handleNavMouseEnter} onMouseLeave={() => setSidebarTip(null)} />
        <NavRailButton icon={Eye} label="Watchlist" isActive={rightNavTab === 'watchlist'} onClick={() => toggleRightNav('watchlist')} onMouseEnter={handleNavMouseEnter} onMouseLeave={() => setSidebarTip(null)} />
        <NavRailButton icon={PieChart} label="Holdings" isActive={rightNavTab === 'holdings'} onClick={() => toggleRightNav('holdings')} onMouseEnter={handleNavMouseEnter} onMouseLeave={() => setSidebarTip(null)} />
        <NavRailButton icon={Wallet} label="Balance" isActive={rightNavTab === 'balance'} onClick={() => toggleRightNav('balance')} onMouseEnter={handleNavMouseEnter} onMouseLeave={() => setSidebarTip(null)} />

        <div className="mt-auto flex w-full flex-col gap-2">
          <div className="w-full h-px bg-[#2B2F36] my-1" />
          <NavRailButton icon={UserCircle} label="My Portfolio" isActive={false} onClick={() => navigate('/portfolio')} onMouseEnter={handleNavMouseEnter} onMouseLeave={() => setSidebarTip(null)} />
        </div>
      </div>

      {/* ─── SIDEBAR TOOLTIP (Matching ChartPanel style) ─── */}
      {sidebarTip && (
        <div
          style={{
            position: 'fixed',
            left: sidebarTip.x,
            top: sidebarTip.top,
            transform: 'translate(-100%, -50%)', // Translate LEFT to show it on the left of the cursor
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
      {showBotEditor && (
        <BulbulEditor
          nodes={bot.nodes}
          edges={bot.edges}
          status={bot.status}
          logs={bot.logs}
          pnl={bot.botPnl}
          accountPnl={bot.accountPnl}
          onAddNode={bot.addNode}
          onRemoveNode={bot.removeNode}
          onUpdateParams={bot.updateNodeParams}
          onMoveNode={bot.moveNode}
          onAddEdge={bot.addEdge}
          onRemoveEdge={bot.removeEdge}
          onClear={bot.clearAll}
          onStart={bot.startBot}
          onStop={bot.stopBot}
          onSave={bot.saveStrategy}
          onClose={() => setShowBotEditor(false)}
        />
      )}

      {orderToast && (
        <div className="pointer-events-none fixed right-4 top-4 z-[9998] w-[min(420px,calc(100vw-2rem))]">
          <div className={`rounded-xl px-4 py-3 shadow-2xl shadow-black/40 backdrop-blur-sm ${orderToast.level === 'success'
            ? 'border border-[#4ADE80]/45 bg-[#0E2518]/95'
            : 'border border-[#FF6B6B]/40 bg-[#2A1217]/95'
            }`}>
            <div className="flex items-start gap-2.5">
              <div className={`mt-1 h-2 w-2 shrink-0 rounded-full ${orderToast.level === 'success' ? 'bg-[#22C55E]' : 'bg-[#FF5C5C]'}`} />
              <div className="min-w-0">
                <p className={`text-[11px] font-bold uppercase tracking-[0.12em] ${orderToast.level === 'success' ? 'text-[#93F5B7]' : 'text-[#FF9E9E]'}`}>
                  {orderToast.level === 'success' ? 'Order Accepted' : 'Order Rejected'}
                </p>
                <p className={`mt-1 text-[12px] leading-5 break-words ${orderToast.level === 'success' ? 'text-[#D8FFE8]' : 'text-[#FFE3E3]'}`}>
                  {orderToast.message}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modify Order Modal */}
      {editingOrder && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-[4px] border shadow-2xl transition-colors" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
            <div className="flex items-center justify-between border-b p-3 text-[13px] font-semibold transition-colors" style={{ color: 'var(--text-primary)', borderColor: 'var(--border-color)' }}>
              <span>Modify Order: {editingOrder.asset} ({editingOrder.action.toUpperCase()})</span>
              <button onClick={() => setEditingOrder(null)} className="opacity-50 hover:opacity-100 transition-opacity" style={{ color: 'var(--text-primary)' }}>
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3 p-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[11px] font-medium opacity-60" style={{ color: 'var(--text-secondary)' }}>Quantity</label>
                  <input
                    type="text"
                    value={editForm.quantity}
                    onChange={(e) => setEditForm(prev => ({ ...prev, quantity: e.target.value.replace(/[^0-9]/g, '') }))}
                    className="w-full rounded-[4px] border px-2 py-1.5 text-[12px] font-mono outline-none transition-all focus:border-[#00C076]"
                    style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium opacity-60" style={{ color: 'var(--text-secondary)' }}>Limit Price</label>
                  <input
                    type="number"
                    value={editForm.price}
                    onChange={(e) => setEditForm(prev => ({ ...prev, price: e.target.value }))}
                    className="w-full rounded-[4px] border px-2 py-1.5 text-[12px] font-mono outline-none transition-colors focus:border-[#00C076]"
                    style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[11px] font-medium opacity-60" style={{ color: 'var(--text-secondary)' }}>Stop Loss (Opt)</label>
                  <input
                    type="number"
                    value={editForm.stopLoss}
                    onChange={(e) => setEditForm(prev => ({ ...prev, stopLoss: e.target.value }))}
                    className="w-full rounded-[4px] border px-2 py-1.5 text-[12px] font-mono outline-none transition-colors focus:border-[#00C076]"
                    style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium opacity-60" style={{ color: 'var(--text-secondary)' }}>Target (Opt)</label>
                  <input
                    type="number"
                    value={editForm.takeProfit}
                    onChange={(e) => setEditForm(prev => ({ ...prev, takeProfit: e.target.value }))}
                    className="w-full rounded-[4px] border px-2 py-1.5 text-[12px] font-mono outline-none transition-colors focus:border-[#00C076]"
                    style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  onClick={() => setEditingOrder(null)}
                  className="rounded-[4px] px-3 py-1.5 text-[11px] font-medium transition-colors"
                  style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (editForm.price && editForm.quantity) {
                      feed.modifyOrder(editingOrder.id, {
                        limitPrice: Number(editForm.price),
                        quantity: Number(editForm.quantity),
                        stopLoss: editForm.stopLoss ? Number(editForm.stopLoss) : undefined,
                        takeProfit: editForm.takeProfit ? Number(editForm.takeProfit) : undefined
                      })
                      setEditingOrder(null)
                    }
                  }}
                  className="rounded-[4px] bg-[#00C076] px-3 py-1.5 text-[11px] font-medium text-white hover:bg-[#00A163] transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sign In Required Modal */}
      {showSignInModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border shadow-2xl relative overflow-hidden transition-colors" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
            <div className="p-6 relative z-10">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full mb-4 transition-colors" style={{ backgroundColor: 'rgba(var(--text-primary-rgb), 0.05)' }}>
                <UserCircle className="h-8 w-8 opacity-40" style={{ color: 'var(--text-primary)' }} />
              </div>
              <h3 className="mb-2 text-center text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Authentication Required</h3>
              <p className="mb-6 text-center text-[13px] opacity-70 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                You must be signed in to execute trades and access personalized features. Sign in to continue.
              </p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => navigate('/login')}
                  className="w-full rounded-xl bg-[#3B4AFF] py-3 text-[14px] font-bold text-white transition-all hover:bg-[#2D3AE0] shadow-lg shadow-[#3B4AFF]/20"
                >
                  Sign In to Continue
                </button>
                <button
                  onClick={() => setShowSignInModal(false)}
                  className="w-full rounded-xl border py-3 text-[14px] font-bold transition-all hover:bg-white/5 opacity-60 hover:opacity-100"
                  style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                >
                  Cancel
                </button>
              </div>
            </div>
            <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#3B4AFF]/10 to-transparent pointer-events-none" />
          </div>
        </div>
      )}
    </div>
  )
}
