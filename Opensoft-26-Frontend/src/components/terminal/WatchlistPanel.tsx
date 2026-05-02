import { useState, useMemo } from 'react'
import { Search, Plus, Trash2, X } from 'lucide-react'
import { scrollClass } from './constants'

type WatchlistStock = {
  symbol: string
  price: number
  changePct: number
}

type Props = {
  watchlist: string[]
  marketSummary: WatchlistStock[]
  availableAssets: string[]
  selectedSymbol: string
  onSelectSymbol?: (symbol: string) => void
  onAddSymbol?: (symbol: string) => void
  onRemoveSymbol?: (symbol: string) => void
}

export function WatchlistPanel({ watchlist, marketSummary, availableAssets, selectedSymbol, onSelectSymbol, onAddSymbol, onRemoveSymbol }: Props) {
  const [searchQuery, setSearchQuery] = useState('')
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [addQuery, setAddQuery] = useState('')

  const displayList = useMemo(() => {
    // Map watchlist symbols to their market data, defaulting to 0s if not found
    const stocks = watchlist.map((sym) => {
      const data = marketSummary.find((s) => s.symbol === sym)
      return data || { symbol: sym, price: 0, changePct: 0 }
    })
    
    const q = searchQuery.trim().toLowerCase()
    return q ? stocks.filter((s) => s.symbol.toLowerCase().includes(q)) : stocks
  }, [watchlist, marketSummary, searchQuery])

  const filteredAvailable = useMemo(() => {
    const q = addQuery.trim().toLowerCase()
    const available = availableAssets.filter((sym) => !watchlist.includes(sym))
    return q ? available.filter((sym) => sym.toLowerCase().includes(q)) : available
  }, [availableAssets, watchlist, addQuery])

  return (
    <div className="flex-1 overflow-hidden flex flex-col p-3 pb-0">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] font-semibold tracking-wide text-[#AAB0B6]">WATCHLIST</div>
        <button 
          onClick={() => setShowAddMenu(!showAddMenu)}
          className="p-1 rounded bg-[#1C2128] text-[#AAB0B6] hover:text-[#D9DEE3] hover:bg-[#2B2F36] transition-colors"
          title="Add Symbol"
        >
          <Plus size={12} />
        </button>
      </div>

      {showAddMenu && (
        <div className="mb-2 p-2 rounded border border-[#2B2F36] bg-[#11161E]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-[#AAB0B6]">Add Symbol</span>
            <button onClick={() => setShowAddMenu(false)} className="text-[#6D7480] hover:text-[#D9DEE3]"><X size={10} /></button>
          </div>
          <div className="flex items-center gap-1.5 rounded border border-[#2B2F36] bg-[#0B0E11] px-1.5 py-1 text-[#657080] focus-within:border-[#60A5FA] focus-within:ring-1 focus-within:ring-[#60A5FA] transition-all mb-2">
            <Search size={10} />
            <input
              value={addQuery}
              onChange={(e) => setAddQuery(e.target.value)}
              placeholder="Search assets..."
              className="w-full bg-transparent text-[10px] outline-none text-[#D9DEE3]"
            />
          </div>
          <div className={`max-h-32 overflow-y-auto ${scrollClass}`}>
            {filteredAvailable.length === 0 ? (
               <div className="text-[10px] text-[#6D7480] p-1 text-center">No more assets</div>
            ) : (
                filteredAvailable.map((asset) => (
                  <button
                    key={asset}
                    onClick={() => { onAddSymbol?.(asset); setAddQuery(''); setShowAddMenu(false) }}
                    className="block w-full text-left rounded px-2 py-1 text-[10px] text-[#D9DEE3] hover:bg-[#1C2128]"
                  >
                    {asset}
                  </button>
                ))
            )}
          </div>
        </div>
      )}

      <div className="mb-2 flex items-center gap-1.5 rounded border border-[#2B2F36] bg-[#11161E] px-1.5 py-1 text-[#657080] focus-within:border-[#60A5FA] focus-within:ring-1 focus-within:ring-[#60A5FA] transition-all">
        <Search size={12} />
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search watchlist..."
          className="w-full bg-transparent text-[10px] outline-none text-[#D9DEE3] placeholder:text-[#657080]"
        />
      </div>

      <div className={`flex-1 space-y-1 overflow-y-auto pb-3 ${scrollClass}`}>
        {displayList.length === 0 ? (
            <div className="text-center text-[#6D7480] text-[10px] py-4">No symbols found</div>
        ) : (
            displayList.map((row) => {
              const isActive = row.symbol === selectedSymbol
              return (
                <div key={row.symbol} className={`group flex items-center rounded border border-[#2B2F36] hover:bg-white/5 transition-colors overflow-hidden ${isActive ? 'bg-white/[0.04] border-l-[3px] border-l-[#00C076] pl-[9px]' : 'bg-[#11161E] px-3'}`}>
                  <button 
                    onClick={() => onSelectSymbol?.(row.symbol)} 
                    className="flex-1 grid grid-cols-[1fr_auto_auto] items-center py-1 text-[10px] text-left gap-2 min-w-0"
                  >
                    <span className={`truncate transition-colors ${isActive ? 'text-white font-bold' : 'text-slate-300 group-hover:text-white font-medium'}`}>{row.symbol}</span>
                    <span className={`text-right font-mono tabular-nums ${isActive ? 'text-white' : 'text-slate-300'}`}>{row.price ? row.price.toFixed(2) : '--'}</span>
                    <span className={`text-right font-mono tabular-nums min-w-[36px] ${row.changePct >= 0 ? 'text-[#00C076]' : 'text-[#FF3B30]'}`}>
                      {row.changePct >= 0 && row.changePct !== 0 ? '+' : ''}{row.changePct.toFixed(2)}%
                    </span>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onRemoveSymbol?.(row.symbol); }}
                    title="Remove from watchlist"
                    className="pr-1 pl-2 py-1 text-[#6D7480] hover:text-[#FF3B30] transition-colors opacity-0 focus:opacity-100 group-hover:opacity-100"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              )
            })
        )}
      </div>
    </div>
  )
}
