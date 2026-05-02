import { X } from 'lucide-react'
import type { PortfolioPosition } from '../../types/market'
import { monoClass, scrollClass } from './constants'

type Props = {
  positions: PortfolioPosition[]
  cashBalance: number
  blockedBalance: number
  onSelectSymbol?: (symbol: string) => void
  onClosePosition?: (asset: string) => void
}

/** Format a number with commas & 2 decimal places */
const fmt = (n: number) =>
  '$' + new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)

export function PortfolioPanel({ positions, cashBalance, blockedBalance, onSelectSymbol, onClosePosition }: Props) {
  const holdingsValue = positions.reduce((sum, p) => sum + Math.abs(p.markPrice * p.quantity), 0)
  const livePnl = positions.reduce((sum, p) => sum + p.pnl, 0)
  const netExposure = positions.reduce((sum, p) => sum + p.markPrice * p.quantity, 0)
  const equity = cashBalance + blockedBalance + netExposure

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden text-[#D9DEE3]">
      {/* ─── Top Metrics ─── */}
      <div className="p-3">
        <div className="grid grid-cols-2 gap-2 text-[11px] mb-2">
          {/* Cash / Available Margin */}
          <div className="rounded-lg border border-[#2B2F36] bg-[#161a1e] p-3 text-center">
            <div className="text-[10px] text-slate-500 mb-1 uppercase tracking-wider">Avail. Margin</div>
            <div className={`text-sm font-semibold tabular-nums ${monoClass}`}>{fmt(cashBalance)}</div>
          </div>

          {/* Holdings */}
          <div className="rounded-lg border border-[#2B2F36] bg-[#161a1e] p-3 text-center">
            <div className="text-[10px] text-slate-500 mb-1 uppercase tracking-wider">Holdings</div>
            <div className={`text-sm font-semibold tabular-nums ${monoClass}`}>{fmt(holdingsValue)}</div>
          </div>

          {/* Live P&L — conditional background */}
          <div className={`rounded-lg border p-3 text-center ${livePnl >= 0 ? 'border-emerald-500/20 bg-emerald-500/[0.07]' : 'border-red-500/20 bg-red-500/[0.07]'}`}>
            <div className="text-[10px] text-slate-500 mb-1 uppercase tracking-wider">Live P&L</div>
            <div className={`text-sm font-bold tabular-nums ${monoClass} ${livePnl >= 0 ? 'text-[#00C076]' : 'text-[#FF3B30]'}`}>
              {livePnl >= 0 ? '+' : ''}{fmt(livePnl)}
            </div>
          </div>

          {/* Blocked Cash */}
          <div className="rounded-lg border border-[#2B2F36] bg-[#161a1e] p-3 text-center">
            <div className="text-[10px] text-slate-500 mb-1 uppercase tracking-wider">Blocked</div>
            <div className={`text-sm font-semibold tabular-nums ${monoClass}`}>{fmt(blockedBalance)}</div>
          </div>
        </div>

        {/* Total Equity — Full Width */}
        <div className={`rounded-lg border p-3 text-center ${equity >= (cashBalance + blockedBalance) ? 'border-emerald-500/20 bg-emerald-500/[0.07]' : 'border-red-500/20 bg-red-500/[0.07]'}`}>
          <div className="text-[10px] text-slate-500 mb-1 uppercase tracking-wider">Total Equity</div>
          <div className={`text-base font-bold tabular-nums ${monoClass} ${equity >= (cashBalance + blockedBalance) ? 'text-[#00C076]' : 'text-[#FF3B30]'}`}>
            {fmt(equity)}
          </div>
        </div>
      </div>

      {/* ─── Section Label ─── */}
      <div className="px-3 pb-2 flex items-center justify-between border-t border-[#2B2F36] pt-3">
        <span className="text-[11px] font-semibold text-[#EAECEF] uppercase tracking-wider">Open Positions</span>
        <span className="text-[10px] text-slate-500 tabular-nums font-mono">{positions.length} active</span>
      </div>

      {/* ─── Position Cards ─── */}
      <div className={`flex-1 space-y-2 overflow-y-auto px-3 pb-3 ${scrollClass}`}>
        {positions.length === 0 ? (
          <div className="py-8 text-center text-xs text-[#848E9C]">No open positions.</div>
        ) : positions.map((pos) => (
          <div
            key={pos.asset}
            className="relative group flex flex-col gap-1 rounded-lg border border-[#2B2F36] bg-[#161a1e] p-3 text-[11px] transition-colors hover:bg-white/5 cursor-pointer"
            onClick={() => onSelectSymbol?.(pos.asset)}
          >
            {/* Close button */}
            <button
              onClick={(e) => { e.stopPropagation(); onClosePosition?.(pos.asset) }}
              title="Close position"
              className="absolute top-2 right-2 h-5 w-5 flex items-center justify-center rounded bg-[#2B2F36]/80 text-slate-400 opacity-100 hover:bg-red-500/20 hover:text-[#FF3B30] transition-all"
            >
              <X size={11} />
            </button>

            {/* Header row: Asset name + Direction/Qty */}
            <div className="flex justify-between font-semibold pr-6">
              <span className="text-[#EAECEF]">{pos.asset}</span>
              <span className={pos.quantity >= 0 ? 'text-[#00C076]' : 'text-[#FF3B30]'}>
                {pos.quantity >= 0 ? 'LONG' : 'SHORT'}
                <span className="opacity-60 ml-1 font-normal tabular-nums font-mono">
                  ({Math.abs(pos.quantity).toLocaleString('en-US', { minimumFractionDigits: 3 })})
                </span>
              </span>
            </div>

            {/* Details row: Entry price ↔ Live P&L */}
            <div className="flex justify-between mt-1.5 border-t border-[#2B2F36]/60 pt-1.5">
              <div className="flex flex-col">
                <span className="text-[9px] text-slate-500 uppercase tracking-wider">Entry</span>
                <span className={`${monoClass} tabular-nums text-slate-300`}>{fmt(pos.entryPrice)}</span>
              </div>
              <div className="flex flex-col text-right">
                <span className="text-[9px] text-slate-500 uppercase tracking-wider">Live P&L</span>
                <span className={`text-[12px] font-semibold ${monoClass} tabular-nums ${pos.pnl >= 0 ? 'text-[#00C076]' : 'text-[#FF3B30]'}`}>
                  {pos.pnl >= 0 ? '+' : ''}{fmt(pos.pnl)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
