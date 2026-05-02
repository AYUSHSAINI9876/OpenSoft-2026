import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { scrollClass } from './constants'
import type { LeaderboardEntry } from '../../services/api'

type Props = {
  rows: LeaderboardEntry[]
  includePublic: boolean
  onToggleIncludePublic: (next: boolean) => void
  onPublishChange: (botID: string, isPublic: boolean, shareStrategy: boolean) => void
  onOpenEditor?: (botName: string) => void
}

export function LeaderboardPanel({
  rows,
  includePublic,
  onToggleIncludePublic,
  onPublishChange,
  onOpenEditor,
}: Props) {
  const [search, setSearch] = useState('')

  const leaderboard = useMemo(
    () => rows.slice().sort((a, b) => b.pnl - a.pnl),
    [rows],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return leaderboard
    return leaderboard.filter((r) => {
      const strategy = r.strategy_name || ''
      const owner = r.username || ''
      return strategy.toLowerCase().includes(q) || owner.toLowerCase().includes(q) || r.symbol.toLowerCase().includes(q)
    })
  }, [leaderboard, search])

  const maxAbsPnl = Math.max(...leaderboard.map((r) => Math.abs(r.pnl)), 1)

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#0F1319]">
      {/* Search */}
      <div className="border-b border-[#2B2F36] p-3 shrink-0 flex flex-col gap-2">
        <div className="flex items-center justify-between text-[11px] text-[#7E8794]">
          <span>{leaderboard.length} bots ranked (weekly)</span>
          <label className="flex items-center gap-1.5 text-[10px] text-[#9AA5B1] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includePublic}
              onChange={(e) => onToggleIncludePublic(e.target.checked)}
              className="h-3.5 w-3.5 accent-[#3B82F6]"
            />
            Show Public
          </label>
        </div>
        <div className="flex items-center gap-1.5 rounded border border-[#2B2F36] bg-[#0B0E11] px-2 py-1.5 text-[#657080] focus-within:border-[#60A5FA] focus-within:ring-1 focus-within:ring-[#60A5FA] transition-all">
          <Search size={12} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search bots..."
            className="w-full bg-transparent text-[11px] outline-none text-[#D9DEE3] placeholder:text-[#657080]"
          />
        </div>
      </div>

      {/* Leaderboard list */}
      <div className={`flex-1 min-h-0 overflow-y-auto p-3 space-y-1.5 ${scrollClass}`}>
        {filtered.map((row) => {
          const globalIdx = leaderboard.indexOf(row)
          const fillPct = Math.max(0, (Math.abs(row.pnl) / maxAbsPnl) * 100)
          const strategyLabel = row.share_strategy || row.owned_by_me
            ? (row.strategy_name || 'Untitled strategy')
            : 'Private strategy'
          const ownerLabel = row.owned_by_me ? 'You' : row.username

          return (
            <div 
              key={`${row.user_id}-${row.bot_id}`}
              className="relative overflow-hidden rounded border border-[#2B2F36] bg-[#111821] px-2.5 py-2 hover:bg-white/[0.05] transition-colors cursor-pointer group"
              onClick={() => row.owned_by_me && onOpenEditor?.(strategyLabel)}
            >
              {fillPct > 0 && (
                <div className="absolute bottom-0 left-0 top-0 bg-[#D9DEE3] opacity-[0.04]" style={{ width: `${fillPct}%` }} />
              )}
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold ${
                    globalIdx === 0 ? 'bg-[#F0B90B] text-black' :
                    globalIdx === 1 ? 'bg-[#E3E8ED] text-black' :
                    globalIdx === 2 ? 'bg-[#B08D57] text-white' :
                    'bg-[#2B2F36] text-[#7E8794]'
                  }`}>
                    {globalIdx + 1}
                  </span>
                  <div className="flex flex-col leading-tight">
                    <span className="text-[11px] font-bold text-[#D9DEE3]">{strategyLabel}</span>
                    <span className="text-[9px] text-[#7E8794]">{ownerLabel} · {row.symbol} · {row.mode}</span>
                  </div>
                </div>
                <span className={`text-[11px] font-bold font-mono tabular-nums text-right ${row.pnl >= 0 ? 'text-[#00C076]' : 'text-[#FF3B30]'}`}>
                  ${row.pnl.toFixed(2)}
                </span>
              </div>
              <div className="relative mt-1 flex items-center justify-between text-[10px]">
                <div className="flex items-center gap-2 text-[#7E8794]">
                  <span className="font-mono tabular-nums">
                    Updated {new Date(row.updated_at).toLocaleString([], { hour12: false, month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-right">
                  {row.status === 'running' && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#00C076]" />}
                  <span className={`capitalize font-mono tabular-nums ${row.status === 'running' ? 'text-[#00C076]' : 'text-[#7E8794]'}`}>{row.status}</span>
                </div>
              </div>
              {row.owned_by_me && (
                <div className="relative mt-2 flex items-center gap-3 text-[10px] text-[#9AA5B1]">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={row.is_public}
                      onChange={(e) => onPublishChange(row.bot_id, e.target.checked, row.share_strategy)}
                      className="h-3.5 w-3.5 accent-[#3B82F6]"
                      onClick={(e) => e.stopPropagation()}
                    />
                    Publish Result
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={row.share_strategy}
                      onChange={(e) => onPublishChange(row.bot_id, row.is_public, e.target.checked)}
                      className="h-3.5 w-3.5 accent-[#8B5CF6]"
                      onClick={(e) => e.stopPropagation()}
                    />
                    Share Strategy Logic
                  </label>
                </div>
              )}
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div className="rounded border border-dashed border-[#2B2F36] bg-[#10151D] px-3 py-4 text-[11px] text-[#7E8794] text-center">
            No leaderboard entries found.
          </div>
        )}
      </div>
    </div>
  )
}
