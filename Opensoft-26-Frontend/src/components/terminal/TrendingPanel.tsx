import { useState, useMemo } from 'react'
import { Flame, Search } from 'lucide-react'
import type { TrendingStock } from '../../types/market'
import { monoClass, scrollClass } from './constants'

type Props = {
  stocks: TrendingStock[]
  selectedSymbol?: string
  onSelectSymbol?: (symbol: string) => void
}

export function TrendingPanel({ stocks, selectedSymbol, onSelectSymbol }: Props) {
  const [searchQuery, setSearchQuery] = useState('')

  const filteredStocks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return q ? stocks.filter((s) => s.symbol.toLowerCase().includes(q)) : stocks
  }, [stocks, searchQuery])

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded border border-[#2B2F36] bg-[#10141A]">
      <header className="border-b border-[#2B2F36] px-2 py-1 text-[11px] font-semibold tracking-wide text-[#AAB0B6]">
        <div className="flex items-center gap-1">
          <Flame size={14} />
          TRENDING STOCKS
        </div>
      </header>
      <div className="border-b border-[#2B2F36] p-1.5">
        <div className="flex items-center gap-1.5 rounded border border-[#2B2F36] bg-[#0B0E11] px-1.5 py-1 text-[#657080] focus-within:border-[#60A5FA] focus-within:ring-1 focus-within:ring-[#60A5FA] transition-all">
          <Search size={12} />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search trending..."
            className="w-full bg-transparent text-[10px] outline-none placeholder:text-[#657080] text-[#D9DEE3]"
          />
        </div>
      </div>
      <div className="grid grid-cols-[1fr_auto_auto] gap-2 border-b border-[#2B2F36] px-3 py-1 text-[10px] text-[#AAB0B6]">
        <span>Symbol</span>
        <span className="text-right w-[48px]">Price</span>
        <span className="text-right w-[42px]">Change</span>
      </div>
      <div className={`flex-1 space-y-px overflow-y-auto px-1 py-1 ${scrollClass}`}>
        {filteredStocks.map((stock) => {
          const isActive = stock.symbol === selectedSymbol
          return (
            <button
              key={stock.symbol}
              className={`grid w-full grid-cols-[1fr_auto_auto] gap-2 rounded py-1 text-[10px] transition-colors ${isActive ? 'bg-white/[0.04] border-l-[3px] border-[#00C076] pl-1 pr-2' : 'bg-transparent px-2 hover:bg-white/5'}`}
              onClick={() => onSelectSymbol?.(stock.symbol)}
            >
              <span className={`text-left font-medium ${isActive ? 'text-white' : 'text-slate-300'}`}>{stock.symbol}</span>
              <span className={`text-right ${monoClass} tabular-nums w-[48px] ${isActive ? 'text-white' : 'text-[#D9DEE3]'}`}>{stock.price.toFixed(2)}</span>
              <span className={`text-right ${monoClass} tabular-nums min-w-[36px] w-[42px] ${stock.changePct >= 0 ? 'text-[#00C076]' : 'text-[#FF3B30]'}`}>
                {stock.changePct >= 0 ? '+' : ''}
                {stock.changePct.toFixed(2)}%
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
