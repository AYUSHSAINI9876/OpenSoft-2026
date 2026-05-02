import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, TrendingUp, TrendingDown, Globe, Zap, ArrowUpRight,
  ArrowDownRight, BarChart2, Activity, ChevronUp, ChevronDown,
  ChevronsUpDown, Star
} from 'lucide-react';
import { useLiveMarket } from '../../hooks/useLiveMarket';
import { useMarketData } from '../../hooks/useMarketData';
import { MarketCard } from './MarketCard';
import AppNavbar from '../AppNavbar';
import {
  indianStocks, indices, worldIndices, highestVolume,
  mostVolatile, gainers, losers
} from '../../data/marketData';
import type { StockData } from '../../data/marketData';

type LiveStockRow = StockData & { volume: number };


// ── helpers ──────────────────────────────────────────────────────────────────
function symbolColor(s: string): string {
  const c = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444', '#14b8a6', '#f97316', '#06b6d4'];
  let h = 0;
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return c[Math.abs(h) % c.length];
}

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '');
  const value = Number.parseInt(normalized, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function iconChipStyle(symbol: string): React.CSSProperties {
  const accent = symbolColor(symbol);
  return {
    background: hexToRgba(accent, 0.14),
    border: `1px solid ${hexToRgba(accent, 0.38)}`,
    color: accent,
  };
}

function generateSparkPoints(count: number, isPositive: boolean): number[] {
  const pts: number[] = [];
  let val = 50;
  for (let i = 0; i < count; i++) {
    val += (Math.random() - 0.5) * 20;
    val = Math.max(10, Math.min(90, val));
    pts.push(val);
  }
  const first = pts[0];
  const last = pts[pts.length - 1];
  if (isPositive && last < first) pts.reverse();
  if (!isPositive && last > first) pts.reverse();
  return pts;
}

function toSparkPath(pts: number[], w: number, h: number): string {
  const stepX = w / (pts.length - 1);
  const min = Math.min(...pts), max = Math.max(...pts);
  const range = max - min || 1;
  return pts.map((p, i) => {
    const x = i * stepX;
    const y = h - ((p - min) / range) * (h * 0.75) - h * 0.125;
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
}

function volatilityScore(row: LiveStockRow): number {
  return Math.abs(row.changePercent) * Math.log10(Math.max(1, row.volume) + 10);
}

// ── Mini sparkline ─────────────────────────────────────────────────────────
function Spark({ isPositive, w = 64, h = 28, values }: { isPositive: boolean; w?: number; h?: number; values?: number[] }) {
  const pts = useMemo(() => {
    if (values && values.length >= 2) {
      return values.slice(-20);
    }
    return generateSparkPoints(20, isPositive);
  }, [isPositive, values]);
  const path = toSparkPath(pts, w, h);
  const color = isPositive ? '#00C076' : '#FF4560';
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="shrink-0">
      <path d={path} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Heat-map cell ─────────────────────────────────────────────────────────
function HeatCell({ data, onSelect }: { data: StockData; onSelect: (s: string) => void }) {
  const pct = data.changePercent;
  const abs = Math.abs(pct);
  const intensity = Math.min(abs / 12, 1);
  const accent = pct >= 0 ? '#00C076' : '#FF4560';
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={() => onSelect(data.symbol)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="group relative flex flex-col items-start justify-between rounded-xl p-3 text-left transition-all duration-200 cursor-pointer"
      style={{
        background: `linear-gradient(145deg, rgba(255,255,255,0.03), ${hexToRgba(accent, 0.08 + intensity * 0.08)})`,
        border: `1px solid ${hexToRgba(accent, 0.18 + intensity * 0.18)}`,
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        boxShadow: hovered ? `0 10px 20px ${hexToRgba(accent, 0.16)}` : 'none',
      }}
    >
      <div className="mb-2 flex w-full items-start justify-between gap-2">
        <div className="h-6 w-6 rounded-md flex items-center justify-center text-[9px] font-black" style={iconChipStyle(data.symbol)}>
          {data.symbol.slice(0, 2).toUpperCase()}
        </div>
        <div className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold font-mono tabular-nums ${pct >= 0 ? 'text-[#00C076] bg-[#00C076]/12' : 'text-[#FF4560] bg-[#FF4560]/12'}`}>
          {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
        </div>
      </div>

      <div className="w-full min-w-0">
        <div className="truncate text-[11px] font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>{data.symbol}</div>
        <div className="truncate text-[10px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>{data.name}</div>
      </div>


    </button>
  );
}

// ── Sort icon helper ──────────────────────────────────────────────────────
function SortIcon({ field, sort }: { field: string; sort: { field: string; dir: 'asc' | 'desc' } }) {
  if (sort.field !== field) return <ChevronsUpDown className="w-3 h-3 text-slate-600 opacity-50 transition-colors" />;
  return sort.dir === 'asc'
    ? <ChevronUp className="w-3 h-3 text-[#00C076] transition-colors" />
    : <ChevronDown className="w-3 h-3 text-[#00C076] transition-colors" />;
}

// ── Stat card at top ──────────────────────────────────────────────────────
// function StatCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
//   return (
//     <div className="flex flex-col gap-0.5 px-4 py-3 rounded-xl border flex-1 min-w-[120px]" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
//       <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>{label}</span>
//       <span className="text-[18px] font-extrabold tracking-tight" style={{ color }}>{value}</span>
//       <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>{sub}</span>
//     </div>
//   );
// }

// ── Row in sortable table ─────────────────────────────────────────────────
function TableRow({ data, rank, onSelect, sparkValues }: { data: StockData; rank: number; onSelect: (s: string) => void; sparkValues?: number[] }) {
  const isUp = data.changePercent >= 0;

  return (
    <tr
      onClick={() => onSelect(data.symbol)}
      className="cursor-pointer transition-colors duration-150 border-b border-[var(--border-color)] hover:bg-[rgba(var(--text-primary-rgb),0.03)]"
    >
      <td className="pl-4 pr-2 py-3 text-[11px] opacity-40 w-8" style={{ color: 'var(--text-primary)' }}>{rank}</td>
      <td className="pr-3 py-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[9px] font-black shrink-0" style={iconChipStyle(data.symbol)}>
            {(data.tokenSymbol || data.symbol).slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="text-[12px] font-bold truncate" style={{ color: 'var(--text-primary)' }}>{data.name || data.symbol}</div>
            <div className="text-[10px] opacity-50" style={{ color: 'var(--text-primary)' }}>{data.tokenSymbol || data.symbol}</div>
          </div>
        </div>
      </td>
      <td className="px-3 py-3">
        <div className="flex justify-center items-center">
          <Spark isPositive={isUp} w={56} h={24} values={sparkValues} />
        </div>
      </td>
      <td className="pr-4 py-3 text-right">
        <span className="inline-block text-[13px] font-bold font-mono tabular-nums px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
          {data.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </td>
      <td className="pr-4 py-3 text-right">
        <span className={`text-[12px] font-bold font-mono tabular-nums px-2 py-0.5 rounded-md ${isUp ? 'text-[#00C076] bg-[#00C076]/10' : 'text-[#FF4560] bg-[#FF4560]/10'}`}>
          {isUp ? '+' : ''}{data.changePercent.toFixed(2)}%
        </span>
      </td>
    </tr>
  );
}

// ── Main component ────────────────────────────────────────────────────────
export const MarketsPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'all' | 'indian' | 'global' | 'movers' | 'volatile'>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<{ field: string; dir: 'asc' | 'desc' }>({ field: 'changePercent', dir: 'desc' });
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showAllRows, setShowAllRows] = useState(false);

  // Real WebSocket traffic
  const feed = useLiveMarket();
  const { snapshot: market } = useMarketData(feed, 100);

  const openTerminal = (symbol: string) => navigate(`/terminal?symbol=${encodeURIComponent(symbol)}`);

  const worldSymbolSet = useMemo(() => new Set(worldIndices.map((row) => row.symbol)), []);
  const indexSymbolSet = useMemo(() => new Set(indices.map((row) => row.symbol)), []);

  const symbolMeta = useMemo(() => {
    const map = new Map<string, Pick<StockData, 'name' | 'currency' | 'isDerived'>>();
    [...indices, ...indianStocks, ...worldIndices, ...highestVolume, ...mostVolatile, ...gainers, ...losers].forEach((row) => {
      if (!map.has(row.symbol)) {
        map.set(row.symbol, {
          name: row.name,
          currency: row.currency,
          isDerived: row.isDerived,
        });
      }
    });
    return map;
  }, []);

  const liveRows = useMemo<LiveStockRow[]>(() => {
    return market.trendingStocks
      .filter((row) => Number.isFinite(row.price) && row.price > 0)
      .map((row) => {
        const meta = symbolMeta.get(row.symbol);
        return {
          symbol: row.symbol,
          name: meta?.name ?? row.symbol,
          currency: meta?.currency ?? 'USD',
          price: row.price,
          changePercent: row.changePct,
          isDerived: meta?.isDerived,
          volume: row.volume,
        };
      });
  }, [market.trendingStocks, symbolMeta, worldSymbolSet]);

  const topGainers = useMemo(() => {
    return [...liveRows]
      .filter((row) => row.changePercent >= 0)
      .sort((a, b) => b.changePercent - a.changePercent)
      .slice(0, 4);
  }, [liveRows]);

  const topLosers = useMemo(() => {
    return [...liveRows]
      .filter((row) => row.changePercent < 0)
      .sort((a, b) => a.changePercent - b.changePercent)
      .slice(0, 4);
  }, [liveRows]);

  const heatmapData = useMemo(() => {
    return [...liveRows]
      .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))
      .slice(0, 24);
  }, [liveRows]);

  const featuredCards = useMemo(() => {
    const ranked = [...liveRows].sort((a, b) => b.volume - a.volume);
    const featured: LiveStockRow[] = [];

    for (const row of ranked) {
      if (indexSymbolSet.has(row.symbol)) featured.push(row);
      if (featured.length >= 3) break;
    }
    for (const row of ranked) {
      if (!featured.some((existing) => existing.symbol === row.symbol)) {
        featured.push(row);
      }
      if (featured.length >= 6) break;
    }

    return featured;
  }, [indexSymbolSet, liveRows]);

  const liveWorldIndices = useMemo(() => {
    return liveRows.filter((row) => worldSymbolSet.has(row.symbol) || row.currency !== 'USD');
  }, [liveRows, worldSymbolSet]);

  // const niftyRow = useMemo(() => liveRows.find((row) => row.symbol === 'NIFTY50'), [liveRows]);
  // const sensexRow = useMemo(() => liveRows.find((row) => row.symbol === 'SENSEX'), [liveRows]);

  const filteredRows = useMemo(() => {
    let rows: LiveStockRow[] = liveRows;

    if (activeTab === 'indian') {
      rows = liveRows.filter((row) => row.currency === 'USD' && !worldSymbolSet.has(row.symbol));
    } else if (activeTab === 'global') {
      rows = liveWorldIndices;
    } else if (activeTab === 'movers') {
      rows = [...liveRows].sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));
    } else if (activeTab === 'volatile') {
      rows = [...liveRows].sort((a, b) => volatilityScore(b) - volatilityScore(a));
    }

    const q = query.trim().toLowerCase();
    let result = rows;
    if (q) {
      result = result.filter((row) => row.symbol.toLowerCase().includes(q) || row.name.toLowerCase().includes(q));
    }

    return [...result].sort((a, b) => {
      const dir = sort.dir === 'asc' ? 1 : -1;
      if (sort.field === 'changePercent') return dir * (a.changePercent - b.changePercent);
      if (sort.field === 'price') return dir * (a.price - b.price);
      if (sort.field === 'name') return dir * a.symbol.localeCompare(b.symbol);
      return 0;
    });
  }, [activeTab, liveRows, liveWorldIndices, query, sort, worldSymbolSet]);

  const marketDataReady = liveRows.length > 0;

  const sparkValuesBySymbol = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const row of liveRows) {
      const candles = feed.getSymbolCandles(row.symbol);
      const source = candles.candles1s;
      if (source.length >= 2) {
        map.set(row.symbol, source.slice(-30).map((candle) => candle.close));
      } else {
        map.set(row.symbol, [row.price, row.price]);
      }
    }
    return map;
  }, [feed, liveRows, market]);

  const toggleSort = (field: string) => {
    setSort(prev => prev.field === field
      ? { field, dir: prev.dir === 'desc' ? 'asc' : 'desc' }
      : { field, dir: 'desc' }
    );
  };

  const tabs = [
    { id: 'all', label: 'All', icon: <Globe className="w-3.5 h-3.5" /> },
    { id: 'indian', label: 'US', icon: <TrendingUp className="w-3.5 h-3.5" /> },
    { id: 'global', label: 'Global', icon: <Globe className="w-3.5 h-3.5" /> },
    { id: 'movers', label: 'Movers', icon: <Zap className="w-3.5 h-3.5" /> },
    { id: 'volatile', label: 'Volatile', icon: <Activity className="w-3.5 h-3.5" /> },
  ] as const;

  const liveStatusLabel = feed.wsStatus === 'connected'
    ? 'Live stream connected'
    : feed.wsStatus === 'connecting'
      ? 'Connecting to websocket feed...'
      : 'Websocket disconnected';

  const liveStatusClass = feed.wsStatus === 'connected'
    ? 'text-[#00C076]'
    : feed.wsStatus === 'connecting'
      ? 'text-yellow-400'
      : 'text-[#FF4560]';

  return (
    <div className="min-h-screen w-full overflow-y-auto no-scrollbar" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <AppNavbar activeTab="markets" />
      <div className="mx-auto max-w-[1340px] px-5 py-6 space-y-5">

        {/* ── Page Header ── */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>Markets</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>Click any stock to open in terminal</p>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setShowHeatmap(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[12px] font-semibold transition-all ${showHeatmap ? 'text-violet-400 border-violet-500/30 bg-violet-500/10' : 'text-slate-500 hover:opacity-100 hover:bg-white/5'}`}
              style={{
                borderColor: 'var(--border-color)',
                backgroundColor: showHeatmap ? '' : 'var(--bg-secondary)',
                color: showHeatmap ? '' : 'var(--text-secondary)'
              }}
            >
              <BarChart2 className="w-3.5 h-3.5" /> Heatmap
            </button>
          </div>
        </div>

        <div className="rounded-xl border px-3 py-2 text-[12px]" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
          <span className={`font-semibold ${liveStatusClass}`}>{liveStatusLabel}</span>
          <span className="ml-2" style={{ color: 'var(--text-secondary)' }}>
            {marketDataReady ? `${liveRows.length} symbols streaming` : 'Waiting for first market snapshot'}
          </span>
        </div>

        {/* ── Featured Horizontal Scroll ── */}
        <div className="rounded-2xl border" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
          <div className="px-4 py-2.5 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-color)' }}>
            <span className="text-[12px] font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
              Featured
            </span>
            <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>Scroll to see more →</span>
          </div>
          <div className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto p-4">
            {featuredCards.length > 0 ? (
              featuredCards.map((row, i) => (
                <MarketCard
                  key={`f-${i}-${row.symbol}`}
                  data={row}
                  onSelect={openTerminal}
                  sparkValues={sparkValuesBySymbol.get(row.symbol)}
                />
              ))
            ) : (
              <div className="w-full rounded-xl border px-4 py-6 text-[12px] text-center" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
                No featured symbols in the live feed yet.
              </div>
            )}
          </div>
        </div>

        {/* ── Heatmap (togglable) ── */}
        {showHeatmap && (
          <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
            <div className="px-4 py-2.5 border-b flex items-center justify-between gap-2" style={{ borderColor: 'var(--border-color)' }}>
              <span className="flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-blue-400" />
                <span className="text-[12px] font-bold" style={{ color: 'var(--text-primary)' }}>Market Heatmap</span>
              </span>
              <span className="text-[10px] uppercase tracking-wider opacity-50" style={{ color: 'var(--text-primary)' }}>Top Movers</span>
            </div>
            <div className="p-4 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5">
              {heatmapData.length > 0 ? (
                heatmapData.map((s, i) => <HeatCell key={i} data={s} onSelect={openTerminal} />)
              ) : (
                <div className="col-span-full rounded-xl border px-4 py-6 text-[12px] text-center" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
                  Waiting for websocket movers to render the heatmap.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Side-by-side: Gainers + Losers strip ── */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-2xl border overflow-hidden" style={{ background: 'rgba(0,192,118,0.03)', borderColor: 'var(--border-color)' }}>
            <div className="px-4 py-2.5 border-b flex items-center gap-1.5" style={{ borderColor: 'var(--border-color)' }}>
              <TrendingUp className="w-3.5 h-3.5 text-[#00C076]" />
              <span className="text-[11px] font-bold text-[#00C076] uppercase tracking-wider">Top Gainers</span>
            </div>
            <div className="divide-y divide-[rgba(var(--text-primary-rgb),0.05)]" style={{ borderColor: 'var(--border-color)' }}>
              {topGainers.length > 0 ? (
                topGainers.map((s, i) => (
                  <button key={i} onClick={() => openTerminal(s.symbol)} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.03] transition-colors text-left group">
                    <span className="text-[10px] opacity-40 w-4" style={{ color: 'var(--text-primary)' }}>{i + 1}</span>
                    <div className="w-6 h-6 rounded-md flex items-center justify-center text-[8px] font-black shrink-0" style={iconChipStyle(s.symbol)}>{s.symbol.slice(0, 2).toUpperCase()}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-black truncate group-hover:text-[#00C076] transition-colors" style={{ color: 'var(--text-primary)' }}>{s.symbol}</div>
                      <div className="text-[11px] opacity-50 truncate" style={{ color: 'var(--text-primary)' }}>{s.name}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[12px] font-bold font-mono tabular-nums" style={{ color: 'var(--text-primary)' }}>{s.price.toFixed(2)}</div>
                      <div className="text-[12px] font-extrabold text-[#00C076] font-mono tabular-nums">+{s.changePercent.toFixed(2)}%</div>
                    </div>
                    <ArrowUpRight className="w-3.5 h-3.5 text-[#00C076] opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))
              ) : (
                <div className="px-4 py-6 text-[12px] text-center" style={{ color: 'var(--text-secondary)' }}>
                  No gainers in the current live snapshot.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border overflow-hidden" style={{ background: 'rgba(255,69,96,0.03)', borderColor: 'var(--border-color)' }}>
            <div className="px-4 py-2.5 border-b flex items-center gap-1.5" style={{ borderColor: 'var(--border-color)' }}>
              <TrendingDown className="w-3.5 h-3.5 text-[#FF4560]" />
              <span className="text-[11px] font-bold text-[#FF4560] uppercase tracking-wider">Top Losers</span>
            </div>
            <div className="divide-y divide-[rgba(var(--text-primary-rgb),0.05)]" style={{ borderColor: 'var(--border-color)' }}>
              {topLosers.length > 0 ? (
                topLosers.map((s, i) => (
                  <button key={i} onClick={() => openTerminal(s.symbol)} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.03] transition-colors text-left group">
                    <span className="text-[10px] opacity-40 w-4" style={{ color: 'var(--text-primary)' }}>{i + 1}</span>
                    <div className="w-6 h-6 rounded-md flex items-center justify-center text-[8px] font-black shrink-0" style={iconChipStyle(s.symbol)}>{s.symbol.slice(0, 2).toUpperCase()}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-black truncate group-hover:text-[#FF4560] transition-colors" style={{ color: 'var(--text-primary)' }}>{s.symbol}</div>
                      <div className="text-[11px] opacity-50 truncate" style={{ color: 'var(--text-primary)' }}>{s.name}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[12px] font-bold font-mono tabular-nums" style={{ color: 'var(--text-primary)' }}>{s.price.toFixed(2)}</div>
                      <div className="text-[12px] font-extrabold text-[#FF4560] font-mono tabular-nums">{s.changePercent.toFixed(2)}%</div>
                    </div>
                    <ArrowDownRight className="w-3.5 h-3.5 text-[#FF4560] opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))
              ) : (
                <div className="px-4 py-6 text-[12px] text-center" style={{ color: 'var(--text-secondary)' }}>
                  No losers in the current live snapshot.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Main sortable table ── */}
        <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
          {/* Table filters row */}
          <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b" style={{ borderColor: 'var(--border-color)' }}>
            {/* Tabs */}
            <div className="flex items-center gap-1 rounded-xl p-1 border" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}>
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-all duration-200 ${activeTab === tab.id ? 'text-[#00C076]' : 'text-slate-500 hover:text-slate-300'}`}
                  style={activeTab === tab.id ? { background: 'rgba(0,192,118,0.1)', border: '1px solid rgba(0,192,118,0.2)' } : {}}
                >
                  {tab.icon}{tab.label}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="flex items-center gap-2 rounded-xl border px-3 py-2 flex-1 min-w-[180px] max-w-[300px] transition-all focus-within:border-[#00C076]/30" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}>
              <Search className="h-3.5 w-3.5 text-slate-500 shrink-0" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search symbol..."
                className="w-full bg-transparent text-[12px] outline-none placeholder:text-slate-600"
                style={{ color: 'var(--text-primary)' }}
              />
              {query && <button onClick={() => setQuery('')} className="text-slate-500 hover:text-white text-xs">✕</button>}
            </div>

            <div className="ml-auto flex items-center gap-3 text-[11px]">
              <span className={liveStatusClass}>{feed.wsStatus}</span>
              <span style={{ color: 'var(--text-secondary)' }}>{filteredRows.length} results</span>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b" style={{ background: 'rgba(var(--text-primary-rgb), 0.02)', borderColor: 'var(--border-color)' }}>
                  <th className="pl-4 pr-2 py-3 text-left w-8 text-[10px] opacity-50" style={{ color: 'var(--text-primary)' }}>#</th>
                  <th className="pr-3 py-3 text-left">
                    <button onClick={() => toggleSort('name')} className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider transition-colors" style={{ color: 'var(--text-secondary)' }}>
                      Name <SortIcon field="name" sort={sort} />
                    </button>
                  </th>
                  <th className="px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Chart</th>
                  <th className="pr-4 py-3 text-right">
                    <button onClick={() => toggleSort('price')} className="flex items-center gap-1 justify-end w-full text-[11px] font-bold uppercase tracking-wider transition-colors" style={{ color: 'var(--text-secondary)' }}>
                      PRICE (USD) <SortIcon field="price" sort={sort} />
                    </button>
                  </th>
                  <th className="pr-4 py-3 text-right">
                    <button onClick={() => toggleSort('changePercent')} className="flex items-center gap-1 justify-end w-full text-[11px] font-bold uppercase tracking-wider transition-colors" style={{ color: 'var(--text-secondary)' }}>
                      Change <SortIcon field="changePercent" sort={sort} />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.slice(0, showAllRows ? filteredRows.length : 10).map((row, i) => (
                  <TableRow
                    key={`${row.symbol}-${i}`}
                    data={row}
                    rank={i + 1}
                    onSelect={openTerminal}
                    sparkValues={sparkValuesBySymbol.get(row.symbol)}
                  />
                ))}
                {filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-16 text-center opacity-50 text-sm" style={{ color: 'var(--text-primary)' }}>
                      {marketDataReady
                        ? (query
                          ? `No results for "${query}"`
                          : 'No symbols match this tab in the current live feed.')
                        : `Waiting for websocket market data (${feed.wsStatus})...`}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {filteredRows.length > 10 && !showAllRows && (
            <button
              onClick={() => setShowAllRows(true)}
              className="w-full py-3 text-[12px] font-bold transition-all border-t hover:bg-[rgba(var(--text-primary-rgb),0.03)]"
              style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
            >
              See {filteredRows.length - 10} more assets ↓
            </button>
          )}
          {showAllRows && filteredRows.length > 10 && (
            <button
              onClick={() => setShowAllRows(false)}
              className="w-full py-3 text-[12px] font-bold transition-all border-t hover:bg-[rgba(var(--text-primary-rgb),0.03)]"
              style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
            >
              Show less ↑
            </button>
          )}
        </div>

        {/* ── World Indices ── */}
        {/* <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
          <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: 'var(--border-color)' }}>
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-blue-400" />
              <span className="text-[12px] font-bold" style={{ color: 'var(--text-primary)' }}>World Indices</span>
            </div>
            <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>Live websocket data</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0 divide-y" style={{ borderColor: 'var(--border-color)' }}>
            {liveWorldIndices.length === 0 && (
              <div className="col-span-full px-4 py-8 text-center text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                No global symbols are currently streamed by the backend.
              </div>
            )}
            {liveWorldIndices.map((row, i) => {
              const isUp = row.changePercent >= 0;
              return (
                <button
                  key={i}
                  onClick={() => openTerminal(row.symbol)}
                  className="flex items-center gap-3 px-4 py-3.5 hover:bg-[rgba(var(--text-primary-rgb),0.03)] transition-colors text-left group"
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0" style={iconChipStyle(row.symbol)}>
                    {row.symbol.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-black truncate group-hover:text-blue-300 transition-colors" style={{ color: 'var(--text-primary)' }}>{row.symbol}</div>
                    <div className="text-[11px] opacity-50" style={{ color: 'var(--text-primary)' }}>{row.name}</div>
                  </div>
                  <Spark
                    key={`spark-${row.symbol}`}
                    isPositive={isUp}
                    w={56}
                    h={24}
                    values={sparkValuesBySymbol.get(row.symbol)}
                  />
                  <div className="text-right shrink-0 w-28">
                    <div className="text-[13px] font-bold font-mono tabular-nums" style={{ color: 'var(--text-primary)' }}>{row.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    <div className={`text-[12px] font-bold font-mono tabular-nums ${isUp ? 'text-[#00C076]' : 'text-[#FF4560]'}`}>
                      {isUp ? '▲' : '▼'} {Math.abs(row.changePercent).toFixed(2)}%
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div> */}

      </div>
    </div>
  );
};
