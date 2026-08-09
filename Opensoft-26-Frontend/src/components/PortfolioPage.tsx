import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  Wallet,
  PieChart,
  BarChart3,
  RefreshCw,
  Activity,
  Bot,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from 'lucide-react'
import { usePortfolio } from '../hooks/usePortfolio'
import type { PositionView } from '../hooks/usePortfolio'
import * as api from '../services/api'
import type { UserBotPnLRow } from '../services/api'
import AppNavbar from './AppNavbar'
import { useAuth } from '../context/AuthContext'

/* ─── helpers ─── */
const fmt = (n: number, decimals = 2) =>
  new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n)

const fmtCurrency = (n: number, decimals = 2) => `$${fmt(n, decimals)}`

const pnlColor = (v: number) => (v >= 0 ? '#00C076' : '#FF4560')
const pnlBg = (v: number) => (v >= 0 ? 'rgba(0,192,118,0.08)' : 'rgba(255,69,96,0.08)')
const pnlSign = (v: number) => (v >= 0 ? '+' : '')

const ALLOCATION_COLORS = [
  '#3B82F6', // blue
  '#10B981', // emerald
  '#F59E0B', // amber
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#EF4444', // red
  '#14B8A6', // teal
]


/* ─── mock sparkline data (simple visual indicator) ─── */
function generateSparkline(seed: number, points = 24): number[] {
  const data: number[] = []
  let v = seed
  for (let i = 0; i < points; i++) {
    v += (Math.sin(i * 0.7 + seed) * 2 + (Math.random() - 0.5) * 3)
    data.push(v)
  }
  return data
}

function SparklineSvg({ data, color, width = 80, height = 28 }: { data: number[]; color: string; width?: number; height?: number }) {
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - ((v - min) / range) * (height - 4) - 2
    return `${x},${y}`
  }).join(' ')

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="shrink-0">
      <defs>
        <linearGradient id={`sg-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={`0,${height} ${points} ${width},${height}`}
        fill={`url(#sg-${color.replace('#', '')})`}
      />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/* ─── donut chart ─── */
function DonutChart({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0)
  if (total === 0) {
    return (
      <div className="flex items-center justify-center w-[160px] h-[160px]">
        <div className="w-[140px] h-[140px] rounded-full border-[12px]" style={{ borderColor: 'var(--border-color)' }} />
      </div>
    )
  }

  const radius = 60
  const circumference = 2 * Math.PI * radius
  let cumulativeOffset = 0

  return (
    <div className="relative flex items-center justify-center w-[160px] h-[160px]">
      <svg width="160" height="160" viewBox="0 0 160 160" className="transform -rotate-90">
        {segments.map((seg, i) => {
          const pct = seg.value / total
          const dashLength = circumference * pct
          const dashGap = circumference - dashLength
          const offset = cumulativeOffset
          cumulativeOffset += dashLength
          return (
            <circle
              key={i}
              cx="80"
              cy="80"
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth="14"
              strokeDasharray={`${dashLength} ${dashGap}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
              className="transition-all duration-500"
            />
          )
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[10px] uppercase tracking-wider opacity-60" style={{ color: 'var(--text-primary)' }}>Total</span>
        <span className="text-lg font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>{fmtCurrency(total, 0)}</span>
      </div>
    </div>
  )
}

/* ─── stat card ─── */
function StatCard({
  icon: Icon,
  label,
  value,
  subValue,
  accentColor,
  valueColor,
}: {
  icon: typeof Wallet
  label: string
  value: string
  subValue?: string
  accentColor: string
  valueColor?: string
}) {
  return (
    <div
      className="group relative overflow-hidden rounded-xl border p-5 transition-all duration-300 hover:-translate-y-0.5"
      style={{ 
        backgroundColor: 'var(--bg-secondary)',
        borderColor: 'var(--border-color)',
        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
      }}
    >
      <div className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-0 group-hover:opacity-10 2 blur-[40px] transition-opacity duration-500" style={{ background: accentColor }} />

      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${accentColor}15`, color: accentColor }}>
            <Icon className="w-4 h-4" />
          </div>
          <span className="text-[11px] opacity-60 uppercase tracking-wider font-semibold" style={{ color: 'var(--text-primary)' }}>{label}</span>
        </div>
        <div className="text-xl font-bold tabular-nums" style={{ color: valueColor || 'var(--text-primary)' }}>{value}</div>
        {subValue && <div className="text-[11px] opacity-50 mt-1 tabular-nums" style={{ color: 'var(--text-primary)' }}>{subValue}</div>}
      </div>
    </div>
  )
}

/* ─── position row ─── */
function PositionRow({ pos, index, feed }: { pos: PositionView; index: number; feed: any }) {
  const [expanded, setExpanded] = useState(false)
  const sparkData = useMemo(() => {
    const candles = feed?.getSymbolCandles(pos.symbol)?.candles1s
    if (candles && candles.length > 0) {
      return candles.map((c: any) => c.close)
    }
    return generateSparkline(index * 17 + pos.avg_entry)
  }, [index, pos.avg_entry, pos.symbol, feed])
  const pnlPct = pos.avg_entry > 0 ? (pos.pnl / (pos.avg_entry * Math.abs(pos.quantity))) * 100 : 0
  const marketValue = pos.mark_price * Math.abs(pos.quantity)
  const investedValue = pos.avg_entry * Math.abs(pos.quantity)
  const isUp = pos.pnl >= 0

  return (
    <div className="group border-b last:border-b-0 transition-colors" style={{ borderColor: 'var(--border-color)' }}
      onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(var(--text-primary-rgb), 0.025)')}
      onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}
    >
      <div
        className="grid grid-cols-[2fr_1fr_1fr_1fr_1.2fr_100px_40px] items-center gap-4 px-5 py-3.5 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Symbol */}
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
            style={{ background: `${ALLOCATION_COLORS[index % ALLOCATION_COLORS.length]}15`, color: ALLOCATION_COLORS[index % ALLOCATION_COLORS.length] }}
          >
            {pos.symbol.slice(0, 2)}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[13px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{pos.symbol}</span>
            <span className="text-[10px] opacity-50" style={{ color: 'var(--text-primary)' }}>
              {pos.quantity > 0 ? 'Long' : 'Short'} · {Math.abs(pos.quantity).toFixed(3)} units
            </span>
          </div>
        </div>

        {/* Avg Entry */}
        <div className="text-right">
          <span className="text-[13px] font-mono tabular-nums opacity-80" style={{ color: 'var(--text-primary)' }}>{fmtCurrency(pos.avg_entry)}</span>
        </div>

        {/* Mark Price */}
        <div className="text-right">
          <span className="text-[13px] font-mono tabular-nums font-semibold" style={{ color: 'var(--text-primary)' }}>{fmtCurrency(pos.mark_price)}</span>
        </div>

        {/* Market Value */}
        <div className="text-right">
          <span className="text-[13px] font-mono tabular-nums opacity-80" style={{ color: 'var(--text-primary)' }}>{fmtCurrency(marketValue)}</span>
        </div>

        {/* P&L */}
        <div className="text-right">
          <div className="flex flex-col items-end">
            <span className="text-[13px] font-semibold font-mono tabular-nums" style={{ color: pnlColor(pos.pnl) }}>
              {pnlSign(pos.pnl)}{fmtCurrency(pos.pnl)}
            </span>
            <span
              className="text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded mt-0.5"
              style={{ color: pnlColor(pnlPct), background: pnlBg(pnlPct) }}
            >
              {pnlSign(pnlPct)}{pnlPct.toFixed(2)}%
            </span>
          </div>
        </div>

        {/* Sparkline */}
        <div className="flex justify-end">
          <SparklineSvg data={sparkData} color={pnlColor(pos.pnl)} />
        </div>

        {/* Expand */}
        <div className="flex justify-end">
          {expanded
            ? <ChevronUp className="w-4 h-4 text-slate-500 transition-transform" />
            : <ChevronDown className="w-4 h-4 text-slate-500 transition-transform" />
          }
        </div>
      </div>

      {/* Expanded Detail */}
      {expanded && (
        <div className="px-5 pb-4 grid grid-cols-4 gap-4 animate-[fadeIn_0.2s_ease]">
          <div className="rounded-lg border p-3 transition-colors" style={{ backgroundColor: 'rgba(var(--text-primary-rgb), 0.02)', borderColor: 'var(--border-color)' }}>
            <div className="text-[10px] uppercase tracking-wider mb-1 opacity-50" style={{ color: 'var(--text-primary)' }}>Invested Value</div>
            <div className="text-sm font-mono tabular-nums" style={{ color: 'var(--text-primary)' }}>{fmtCurrency(investedValue)}</div>
          </div>
          <div className="rounded-lg border p-3 transition-colors" style={{ backgroundColor: 'rgba(var(--text-primary-rgb), 0.02)', borderColor: 'var(--border-color)' }}>
            <div className="text-[10px] uppercase tracking-wider mb-1 opacity-50" style={{ color: 'var(--text-primary)' }}>Current Value</div>
            <div className="text-sm font-mono tabular-nums" style={{ color: 'var(--text-primary)' }}>{fmtCurrency(marketValue)}</div>
          </div>
          <div className="rounded-lg border p-3 transition-colors" style={{ backgroundColor: 'rgba(var(--text-primary-rgb), 0.02)', borderColor: 'var(--border-color)' }}>
            <div className="text-[10px] uppercase tracking-wider mb-1 opacity-50" style={{ color: 'var(--text-primary)' }}>Quantity</div>
            <div className="text-sm font-mono tabular-nums" style={{ color: 'var(--text-primary)' }}>{Math.abs(pos.quantity).toFixed(6)}</div>
          </div>
          <div className="rounded-lg border p-3 transition-colors" style={{ backgroundColor: 'rgba(var(--text-primary-rgb), 0.02)', borderColor: 'var(--border-color)' }}>
            <div className="text-[10px] uppercase tracking-wider mb-1 opacity-50" style={{ color: 'var(--text-primary)' }}>Day's Change</div>
            <div className="text-sm font-mono tabular-nums flex items-center gap-1" style={{ color: pnlColor(pos.pnl) }}>
              {isUp ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
              {pnlSign(pnlPct)}{pnlPct.toFixed(2)}%
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════ */
/*              PORTFOLIO PAGE                */
/* ═══════════════════════════════════════════ */
export default function PortfolioPage() {
  const navigate = useNavigate()
  const { user, isAuthenticated: isLoggedIn } = useAuth()
  const username = user?.username || 'Trader'

  const { snapshot, refresh, feed, loaded } = usePortfolio()
  const [botPnLRows, setBotPnLRows] = useState<UserBotPnLRow[]>([])
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [sortBy, setSortBy] = useState<'pnl' | 'value' | 'symbol'>('pnl')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  // Redirect to login if not logged in
  useEffect(() => {
    if (!isLoggedIn) navigate('/login')
  }, [isLoggedIn, navigate])

  const loadBotPnL = useCallback(async () => {
    const res = await api.getPortfolioBotPnL()
    if (res.success && Array.isArray(res.data)) setBotPnLRows(res.data)
  }, [])

  useEffect(() => {
    if (!isLoggedIn) return
    void loadBotPnL()
  }, [isLoggedIn, loadBotPnL, snapshot.updated_at])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await refresh()
    await loadBotPnL()
    setTimeout(() => setIsRefreshing(false), 600)
  }

  /* ── derived data ── */
  const positions = snapshot.positions
  const holdingsValue = useMemo(
    () => positions.reduce((s, p) => s + p.mark_price * Math.abs(p.quantity), 0),
    [positions],
  )
  const investedValue = useMemo(
    () => positions.reduce((s, p) => s + p.avg_entry * Math.abs(p.quantity), 0),
    [positions],
  )
  const totalPnlPct = investedValue > 0 ? (snapshot.total_pnl / investedValue) * 100 : 0

  const sortedPositions = useMemo(() => {
    const arr = [...positions]
    arr.sort((a, b) => {
      let va: number, vb: number
      if (sortBy === 'pnl') { va = a.pnl; vb = b.pnl }
      else if (sortBy === 'value') { va = a.mark_price * Math.abs(a.quantity); vb = b.mark_price * Math.abs(b.quantity) }
      else { return sortDir === 'asc' ? a.symbol.localeCompare(b.symbol) : b.symbol.localeCompare(a.symbol) }
      return sortDir === 'asc' ? va - vb : vb - va
    })
    return arr
  }, [positions, sortBy, sortDir])

  const allocationSegments = useMemo(
    () =>
      positions
        .filter((p) => p.quantity > 0)
        .map((p, i) => ({
          label: p.symbol,
          value: p.mark_price * p.quantity,
          color: ALLOCATION_COLORS[i % ALLOCATION_COLORS.length],
        })),
    [positions],
  )

  /** Slice sizes use |P&L| so wins/losses both contribute to “share of bot activity”. */
  const botPnlDistributionSegments = useMemo(() => {
    return botPnLRows.map((row, i) => {
      const shortId = row.bot_id.length > 14 ? `${row.bot_id.slice(0, 12)}…` : row.bot_id
      return {
        label: row.strategy_name?.trim() || shortId,
        value: Math.abs(row.pnl),
        color: ALLOCATION_COLORS[i % ALLOCATION_COLORS.length],
      }
    })
  }, [botPnLRows])

  const botPnlAbsTotal = useMemo(
    () => botPnLRows.reduce((s, r) => s + Math.abs(r.pnl), 0),
    [botPnLRows],
  )

  const toggleSort = (field: typeof sortBy) => {
    if (sortBy === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortBy(field); setSortDir('desc') }
  }

  const winningCount = positions.filter((p) => p.pnl > 0).length
  const losingCount = positions.filter((p) => p.pnl < 0).length
  const bestPerformer = positions.length > 0
    ? [...positions].sort((a, b) => b.pnl - a.pnl)[0]
    : null
  const worstPerformer = positions.length > 0
    ? [...positions].sort((a, b) => a.pnl - b.pnl)[0]
    : null
  const cashPct = snapshot.equity > 0 ? (snapshot.available_cash / snapshot.equity) * 100 : 100

  if (!loaded) {
    return (
      <div className="min-h-screen transition-colors" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
        <AppNavbar activeTab="portfolio" />
        <div className="max-w-[1400px] mx-auto px-6 md:px-12 py-8 space-y-6 animate-pulse">
          <div className="h-10 w-48 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }} />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 rounded-xl" style={{ backgroundColor: 'var(--bg-secondary)' }} />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
            <div className="h-[400px] rounded-xl" style={{ backgroundColor: 'var(--bg-secondary)' }} />
            <div className="flex flex-col gap-5">
              <div className="h-[200px] rounded-xl" style={{ backgroundColor: 'var(--bg-secondary)' }} />
              <div className="h-[160px] rounded-xl" style={{ backgroundColor: 'var(--bg-secondary)' }} />
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen selection:bg-blue-500/30" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <AppNavbar activeTab="portfolio" />

      {/* ── Content ── */}
      <div className="max-w-[1400px] mx-auto px-6 md:px-12 py-8">

        {/* Header Row */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <button onClick={() => navigate(-1)} className="p-1 rounded-lg hover:bg-white/5" style={{ color: 'var(--text-secondary)' }}>
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-3xl font-extrabold tracking-tight">Portfolio</h1>
            </div>
            <p className="text-sm font-medium ml-9" style={{ color: 'var(--text-secondary)' }}>
              Welcome back, <span style={{ color: 'var(--text-primary)' }}>{username}</span>
            </p>
          </div>
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all hover:bg-white/5"
            style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
          >
            <RefreshCw className={`w-4 h-4 transition-transform ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>


        {/* ── Overview Cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            icon={Wallet}
            label="Total Equity"
            value={fmtCurrency(snapshot.equity)}
            subValue={`Cash: ${fmtCurrency(snapshot.available_cash)}`}
            accentColor="#3B82F6"
          />
          <StatCard
            icon={TrendingUp}
            label="Total P&L"
            value={`${pnlSign(snapshot.total_pnl)}${fmtCurrency(snapshot.total_pnl)}`}
            subValue={`${pnlSign(totalPnlPct)}${totalPnlPct.toFixed(2)}% return`}
            accentColor={pnlColor(snapshot.total_pnl)}
            valueColor={pnlColor(snapshot.total_pnl)}
          />
          <StatCard
            icon={BarChart3}
            label="Holdings Value"
            value={fmtCurrency(holdingsValue)}
            subValue={`${positions.length} active position${positions.length !== 1 ? 's' : ''}`}
            accentColor="#8B5CF6"
          />
          <StatCard
            icon={Activity}
            label="Available Cash"
            value={fmtCurrency(snapshot.available_cash)}
            subValue={`Blocked: ${fmtCurrency(snapshot.blocked_cash)}`}
            accentColor="#F59E0B"
          />
        </div>

        {/* ── Main Content Grid: Table + Sidebar ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">

          {/* ── Positions Table ── */}
          <div
            className="rounded-xl border border-[var(--border-color)] overflow-hidden"
            style={{ backgroundColor: 'var(--bg-secondary)' }}
          >
            {/* Table Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-color)]">
              <h2 className="text-base font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <Wallet className="w-4 h-4 text-blue-400" />
                Open Positions
                <span className="text-[11px] opacity-50 font-normal ml-1">({positions.length})</span>
              </h2>
              <button
                onClick={() => navigate('/terminal')}
                className="text-[12px] text-blue-400 hover:text-blue-300 transition-colors font-medium flex items-center gap-1"
              >
                Trade <ExternalLink className="w-3 h-3" />
              </button>
            </div>

            {/* Column Headers */}
            <div 
              className="grid grid-cols-[2fr_1fr_1fr_1fr_1.2fr_100px_40px] items-center gap-4 px-5 py-2.5 text-[10px] uppercase tracking-wider font-semibold border-b transition-colors"
              style={{ backgroundColor: 'rgba(var(--text-primary-rgb), 0.02)', borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
            >
              <button onClick={() => toggleSort('symbol')} className="text-left hover:opacity-80 transition-opacity flex items-center gap-1">
                Asset {sortBy === 'symbol' && (sortDir === 'asc' ? '↑' : '↓')}
              </button>
              <div className="text-right">Avg Entry</div>
              <div className="text-right">Mark Price</div>
              <button onClick={() => toggleSort('value')} className="text-right hover:opacity-80 transition-opacity flex items-center justify-end gap-1">
                Mkt Value {sortBy === 'value' && (sortDir === 'asc' ? '↑' : '↓')}
              </button>
              <button onClick={() => toggleSort('pnl')} className="text-right hover:opacity-80 transition-opacity flex items-center justify-end gap-1">
                P&L {sortBy === 'pnl' && (sortDir === 'asc' ? '↑' : '↓')}
              </button>
              <div className="text-right">Trend</div>
              <div />
            </div>

            {/* Rows */}
            <div className="max-h-[520px] overflow-y-auto">
              {sortedPositions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16" style={{ color: 'var(--text-secondary)' }}>
                  <PieChart className="w-12 h-12 mb-4 opacity-20" />
                  <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>No open positions</p>
                  <p className="text-[12px] opacity-50 mb-4" style={{ color: 'var(--text-secondary)' }}>Start trading to see your portfolio here.</p>
                  <button
                    onClick={() => navigate('/terminal')}
                    className="px-4 py-2 rounded-lg text-sm font-semibold bg-gradient-to-r from-blue-600 to-violet-600 text-white hover:brightness-110 transition-all"
                  >
                    Open Terminal
                  </button>
                </div>
              ) : (
                sortedPositions.map((pos, i) => <PositionRow key={pos.symbol} pos={pos} index={i} feed={feed} />)
              )}
            </div>
          </div>

          {/* ── Sidebar ── */}
          <div className="flex flex-col gap-5">

            {/* Per-bot P&L — persisted on server */}
            <div
              className="rounded-xl border p-5"
              style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
            >
              <h3 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <Bot className="w-4 h-4 text-emerald-400" />
                Bot P&amp;L
              </h3>
              <p className="text-[10px] mb-3 opacity-70" style={{ color: 'var(--text-secondary)' }}>
                Per-bot simulation / tracked P&amp;L from your runs (updates when you poll bot status).
              </p>
              {botPnLRows.length === 0 ? (
                <p className="text-[12px] opacity-50" style={{ color: 'var(--text-secondary)' }}>
                  No bot sessions recorded yet. Run Oak Capital BYOB from the terminal while logged in.
                </p>
              ) : (
                <>
                  {botPnlAbsTotal > 0 && (
                    <div className="flex justify-center mb-4">
                      <DonutChart segments={botPnlDistributionSegments} />
                    </div>
                  )}
                  <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-1">
                    {botPnLRows.map((row) => {
                      const label = row.strategy_name?.trim() || row.bot_id.slice(0, 18) + '…'
                      const sharePct =
                        botPnlAbsTotal > 0 ? (Math.abs(row.pnl) / botPnlAbsTotal) * 100 : 0
                      return (
                        <div
                          key={row.id}
                          className="flex items-start justify-between gap-2 text-[12px] rounded-lg px-2 py-1.5"
                          style={{ backgroundColor: 'rgba(var(--text-primary-rgb), 0.03)' }}
                        >
                          <div className="min-w-0">
                            <div className="font-medium truncate" style={{ color: 'var(--text-primary)' }} title={row.bot_id}>
                              {label}
                            </div>
                            <div className="text-[10px] opacity-50 truncate">
                              {row.symbol} · {row.mode}
                              {botPnlAbsTotal > 0 ? ` · ${sharePct.toFixed(0)}% of |P&L|` : ''}
                            </div>
                          </div>
                          <span className="shrink-0 font-mono tabular-nums font-semibold" style={{ color: pnlColor(row.pnl) }}>
                            {pnlSign(row.pnl)}{fmtCurrency(row.pnl)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Allocation Donut */}
            <div
              className="rounded-xl border p-5"
              style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
            >
              <h3 className="text-sm font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <PieChart className="w-4 h-4 text-violet-400" />
                Asset Allocation
              </h3>
              <div className="flex justify-center mb-4">
                <DonutChart segments={allocationSegments} />
              </div>
              <div className="flex flex-col gap-2">
                {allocationSegments.map((seg) => {
                  const pct = holdingsValue > 0 ? (seg.value / holdingsValue) * 100 : 0
                  return (
                    <div key={seg.label} className="flex items-center justify-between text-[12px]">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: seg.color }} />
                        <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>{seg.label}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="tabular-nums opacity-60" style={{ color: 'var(--text-primary)' }}>{pct.toFixed(1)}%</span>
                        <span className="tabular-nums font-mono opacity-90" style={{ color: 'var(--text-primary)' }}>{fmtCurrency(seg.value, 0)}</span>
                      </div>
                    </div>
                  )
                })}
                {/* Cash portion */}
                <div className="flex items-center justify-between text-[12px] pt-1 border-t mt-1 transition-colors" style={{ borderColor: 'var(--border-color)' }}>
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-sm shrink-0 bg-slate-500" />
                    <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>Cash</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="tabular-nums opacity-60" style={{ color: 'var(--text-primary)' }}>{cashPct.toFixed(1)}%</span>
                    <span className="tabular-nums font-mono opacity-90" style={{ color: 'var(--text-primary)' }}>{fmtCurrency(snapshot.available_cash, 0)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Account Summary */}
            <div
              className="rounded-xl border p-5"
              style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
            >
              <h3 className="text-sm font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <BarChart3 className="w-4 h-4 text-blue-400" />
                Account Summary
              </h3>
              <div className="flex flex-col gap-3 text-[12px]">
                {[
                  { label: 'Total Equity', val: fmtCurrency(snapshot.equity) },
                  { label: 'Total Cash', val: fmtCurrency(snapshot.total_cash) },
                  { label: 'Available Cash', val: fmtCurrency(snapshot.available_cash) },
                  { label: 'Blocked (Margin)', val: fmtCurrency(snapshot.blocked_cash) },
                  { label: 'Holdings Value', val: fmtCurrency(holdingsValue) },
                  { label: 'Invested Value', val: fmtCurrency(investedValue) },
                ].map((row) => (
                  <div key={row.label} className="flex justify-between items-center">
                    <span style={{ color: 'var(--text-secondary)' }}>{row.label}</span>
                    <span className="font-mono tabular-nums" style={{ color: 'var(--text-primary)' }}>{row.val}</span>
                  </div>
                ))}
                <div className="h-px border-t border-[var(--border-color)] my-1" />
                <div className="flex justify-between items-center">
                  <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>Total P&L</span>
                  <span className="font-bold font-mono tabular-nums" style={{ color: pnlColor(snapshot.total_pnl) }}>
                    {pnlSign(snapshot.total_pnl)}{fmtCurrency(snapshot.total_pnl)}
                  </span>
                </div>
              </div>
            </div>

            {/* Performance Stats */}
            <div
              className="rounded-xl border p-5"
              style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
            >
              <h3 className="text-sm font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <Activity className="w-4 h-4 text-emerald-400" />
                Performance
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg p-3" style={{ background: 'rgba(0,192,118,0.06)', border: '1px solid rgba(0,192,118,0.1)' }}>
                  <div className="text-[10px] uppercase tracking-wider mb-1 opacity-50" style={{ color: 'var(--text-secondary)' }}>Winning</div>
                  <div className="text-lg font-bold text-[#00C076] tabular-nums">{winningCount}</div>
                </div>
                <div className="rounded-lg p-3" style={{ background: 'rgba(255,69,96,0.06)', border: '1px solid rgba(255,69,96,0.1)' }}>
                  <div className="text-[10px] uppercase tracking-wider mb-1 opacity-50" style={{ color: 'var(--text-secondary)' }}>Losing</div>
                  <div className="text-lg font-bold text-[#FF4560] tabular-nums">{losingCount}</div>
                </div>
              </div>
              {bestPerformer && (
                <div className="mt-3 text-[12px]">
                  <div className="flex justify-between items-center py-1.5">
                    <span className="opacity-50" style={{ color: 'var(--text-secondary)' }}>Best Performer</span>
                    <span className="text-[#00C076] font-semibold font-mono">{bestPerformer.symbol} ({pnlSign(bestPerformer.pnl)}{fmtCurrency(bestPerformer.pnl)})</span>
                  </div>
                  {worstPerformer && worstPerformer.pnl < 0 && (
                    <div className="flex justify-between items-center py-1.5">
                      <span className="opacity-50" style={{ color: 'var(--text-secondary)' }}>Worst Performer</span>
                      <span className="text-[#FF4560] font-semibold font-mono">{worstPerformer.symbol} ({fmtCurrency(worstPerformer.pnl)})</span>
                    </div>
                  )}
                </div>
              )}

              {/* Margin Utilization Bar */}
              {(() => {
                const marginUsed = positions.reduce((s, p) => s + p.mark_price * Math.abs(p.quantity) * 0.1, 0) + snapshot.blocked_cash
                const marginPct = snapshot.equity > 0 ? Math.min(100, (marginUsed / snapshot.equity) * 100) : 0
                return (
                  <div className="mt-4">
                    <div className="flex justify-between text-[10px] uppercase tracking-wider mb-1.5 opacity-50" style={{ color: 'var(--text-secondary)' }}>
                      <span>Margin Utilization</span>
                      <span className="tabular-nums">{marginPct.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full overflow-hidden" style={{ backgroundColor: 'var(--border-color)' }}>
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${marginPct}%`,
                          background: marginPct > 80 ? '#FF4560' : marginPct > 50 ? '#F59E0B' : '#3B82F6',
                        }}
                      />
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* ── Fade‑in keyframe ── */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
