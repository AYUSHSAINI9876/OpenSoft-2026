import { Gauge, ChevronLeft } from 'lucide-react'
import type { BookLevel } from '../../types/market'
import { monoClass, scrollClass } from './constants'

type Props = {
  symbol: string
  lastPrice?: number
  tickDirection?: 1 | -1 | 0
  bids: BookLevel[]
  asks: BookLevel[]
  onClose?: () => void
}

export function OrderBookPanel({ bids, asks, onClose }: Props) {
  const maxBidDepth = bids[bids.length - 1]?.cumulative ?? 1
  const maxAskDepth = asks[asks.length - 1]?.cumulative ?? 1
  const now = Date.now()

  const spread = asks.length && bids.length ? (asks[0].price - bids[0].price).toFixed(2) : '—'

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden" style={{ background: '#0b0f16' }}>
      {/* Header - compact single line */}
      <header className="flex items-center justify-between border-b border-[#1e2530] px-3 py-1.5 shrink-0 transition-colors duration-200">
        <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-slate-400 uppercase truncate">
          <Gauge size={13} className="text-[#00C076] shrink-0" />
          <span className="truncate">ORDER BOOK</span>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          <span className="text-[10px] text-slate-600">Spread: <span className="text-slate-400 font-mono tabular-nums">{spread}</span></span>
          {onClose && (
            <button 
              onClick={onClose}
              title="Hide Order Book"
              className="flex h-5 w-5 items-center justify-center rounded text-slate-600 hover:bg-slate-800 hover:text-slate-300 transition-all hover:scale-110 active:scale-95"
            >
              <ChevronLeft size={14} />
            </button>
          )}
        </div>
      </header>

      {/* Asks section */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col border-b border-[#1e2530]">
        <div className="grid grid-cols-3 px-3 py-1 border-b border-[#151a22] shrink-0">
          <span className="text-[10px] font-bold text-[#FF4560]/70 uppercase tracking-wider">Ask (Sell)</span>
          <span className="text-right text-[10px] text-slate-600">Qty</span>
          <span className="text-right text-[10px] text-slate-600">Cum</span>
        </div>
        <div className={`flex-1 min-h-0 overflow-y-auto flex flex-col-reverse ${scrollClass}`}>
          {asks
            .slice()
            .map((level, idx) => {
              const depthWidth = `${Math.min(100, (level.cumulative / maxAskDepth) * 100)}%`
              const flashing = level.flashUntil > now
              return (
                <div key={`ask-${idx}-${level.price.toFixed(2)}`} className="relative grid grid-cols-3 px-3 py-[3px] hover:bg-white/[0.02]">
                  <span
                    className={`absolute inset-y-0 right-0 transition-all bg-red-500/10 ${flashing ? 'opacity-100' : 'opacity-70'}`}
                    style={{ width: depthWidth }}
                  />
                  <span className={`relative ${monoClass} tabular-nums text-[#FF6A61] text-[11px]`}>{level.price.toFixed(2)}</span>
                  <span className={`relative text-right ${monoClass} tabular-nums text-slate-400 text-[11px]`}>{level.quantity.toFixed(0)}</span>
                  <span className={`relative text-right ${monoClass} tabular-nums text-slate-600 text-[11px]`}>{level.cumulative.toFixed(2)}</span>
                </div>
              )
            })}
        </div>
      </div>


      {/* Bids section */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        <div className="grid grid-cols-3 px-3 py-1 border-b border-[#1a2030] shrink-0">
          <span className="text-[10px] font-bold text-[#00C076]/70 uppercase tracking-wider">Bid (Buy)</span>
          <span className="text-right text-[10px] text-slate-600">Qty</span>
          <span className="text-right text-[10px] text-slate-600">Cum</span>
        </div>
        <div className={`flex-1 min-h-0 overflow-y-auto ${scrollClass}`}>
          {bids.map((level, idx) => {
            const depthWidth = `${Math.min(100, (level.cumulative / maxBidDepth) * 100)}%`
            const flashing = level.flashUntil > now
            return (
              <div key={`bid-${idx}-${level.price.toFixed(2)}`} className="relative grid grid-cols-3 px-3 py-[3px] hover:bg-white/[0.02]">
                <span
                  className={`absolute inset-y-0 right-0 transition-all ${flashing ? 'opacity-50' : 'opacity-20'}`}
                  style={{ width: depthWidth, background: 'linear-gradient(90deg, transparent, rgba(0,192,118,0.5))' }}
                />
                <span className={`relative ${monoClass} tabular-nums text-[#00C076] text-[11px]`}>{level.price.toFixed(2)}</span>
                <span className={`relative text-right ${monoClass} tabular-nums text-slate-400 text-[11px]`}>{level.quantity.toFixed(0)}</span>
                <span className={`relative text-right ${monoClass} tabular-nums text-slate-600 text-[11px]`}>{level.cumulative.toFixed(2)}</span>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
