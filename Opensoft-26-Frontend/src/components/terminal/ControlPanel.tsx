import type { TradeIntent } from '../../hooks/useTradeControls'
import type { MarketTelemetry } from '../../hooks/useMarketData'
import type { TradeFill } from '../../types/market'
import { monoClass, scrollClass } from './constants'
import { Activity } from 'lucide-react'

type Props = {
  symbol: string
  lastPrice: number
  tickDirection: 1 | -1 | 0
  direction: 'long' | 'short'
  orderType: 'limit' | 'market'
  quantityText: string
  priceText: string
  stopLossText: string
  targetText: string
  intent: TradeIntent
  onSetLong: () => void
  onSetShort: () => void
  onSetOrderType: (value: 'limit' | 'market') => void
  onQuantityChange: (value: string) => void
  onPriceChange: (value: string) => void
  onStopLossChange: (value: string) => void
  onTargetChange: (value: string) => void
  onQuickBuy: () => void
  onQuickSell: () => void
  onBuy: () => void
  onSell: () => void
  telemetry: MarketTelemetry
  fills: TradeFill[]
  cashBalance: number
  isLoggedIn: boolean
  onAuthRequired: () => void
}

export function ControlPanel({
  symbol,
  lastPrice,
  orderType,
  quantityText,
  priceText,
  stopLossText,
  targetText,
  intent,
  onSetOrderType,
  onQuantityChange,
  onPriceChange,
  onStopLossChange,
  onTargetChange,
  onBuy,
  onSell,
  fills,
  cashBalance,
  isLoggedIn,
  onAuthRequired,
}: Props) {
  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden text-[#D9DEE3]" style={{ background: '#0d1117' }}>
      {/* Header */}
      <header className="shrink-0 border-b border-[#1e2530] px-3 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-[#00C076]" />
          <span className="text-[11px] font-bold tracking-wider text-slate-300 uppercase">Orders · {symbol}</span>
        </div>

      </header>

      <div className={`flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 ${scrollClass}`}>
        {!isLoggedIn ? (
          <div className="flex flex-1 items-center justify-center flex-col gap-4 text-center p-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#161A1E] border border-[#2B2F36]">
              <Activity className="h-8 w-8 text-[#848E9C]" />
            </div>
            <div>
              <p className="text-[13px] text-[#AAB0B6] mb-4 leading-relaxed">
                You need to be signed in to place orders and manage your trades.
              </p>
              <button 
                onClick={onAuthRequired}
                className="w-full rounded-lg bg-gradient-to-r from-[#00C076] to-white py-2.5 text-[13px] font-bold text-[#0B0E14] shadow-lg shadow-[#00C076]/20 transition-all hover:opacity-90 hover:scale-[1.02] active:scale-[0.98]"
              >
                Sign In / Sign Up
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Order Type Buttons */}
        <div className="grid grid-cols-2 gap-1.5 text-[11px] font-bold shrink-0">
          <button
            className={`rounded-lg py-2 transition-all duration-200 ${orderType === 'market'
              ? 'bg-slate-700 text-white shadow-sm'
              : 'bg-transparent text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            onClick={() => onSetOrderType('market')}
          >
            MARKET
          </button>
          <button
            className={`rounded-lg py-2 transition-all duration-200 ${orderType === 'limit'
              ? 'bg-slate-700 text-white shadow-sm'
              : 'bg-transparent text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            onClick={() => onSetOrderType('limit')}
          >
            LIMIT
          </button>
        </div>



        {/* QTY + PRICE Inputs */}
        <div className="grid grid-cols-2 gap-2 shrink-0">
          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider">QTY</span>
            <input
              className={`w-full rounded-lg border border-[#2B2F36] px-2.5 py-2 text-[12px] text-[#E2E8F0] outline-none transition-all focus:border-blue-500 focus:ring-1 focus:ring-blue-500 ${monoClass}`}
              style={{ background: 'rgba(255,255,255,0.03)' }}
              value={quantityText}
              onChange={(e) => onQuantityChange(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="0"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider">PRICE</span>
            <input
              className={`w-full rounded-lg border border-[#2B2F36] px-2.5 py-2 text-[12px] text-[#E2E8F0] outline-none transition-all focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-40 ${monoClass}`}
              style={{ background: 'rgba(255,255,255,0.03)' }}
              value={orderType === 'market' ? lastPrice.toFixed(2) : priceText}
              disabled={orderType === 'market'}
              onChange={(e) => onPriceChange(e.target.value)}
            />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2 shrink-0">
          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider">STOP LOSS <span className="text-slate-600 lowercase">(Opt)</span></span>
            <input
              className={`w-full rounded-lg border border-[#2B2F36] px-2.5 py-2 text-[12px] text-[#E2E8F0] outline-none transition-all focus:border-blue-500 focus:ring-1 focus:ring-blue-500 ${monoClass}`}
              style={{ background: 'rgba(255,255,255,0.03)' }}
              value={stopLossText}
              placeholder="0.00"
              onChange={(e) => onStopLossChange(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider">TARGET <span className="text-slate-600 lowercase">(Opt)</span></span>
            <input
              className={`w-full rounded-lg border border-[#2B2F36] px-2.5 py-2 text-[12px] text-[#E2E8F0] outline-none transition-all focus:border-blue-500 focus:ring-1 focus:ring-blue-500 ${monoClass}`}
              style={{ background: 'rgba(255,255,255,0.03)' }}
              value={targetText}
              placeholder="0.00"
              onChange={(e) => onTargetChange(e.target.value)}
            />
          </label>
        </div>

        {/* Intent label */}
        <div className="shrink-0 rounded-lg border border-[#1e2530] px-2.5 py-1.5 font-medium" style={{ background: 'rgba(255,255,255,0.02)' }}>
          <div className="text-[9px] text-slate-500 uppercase tracking-widest mb-0.5 font-bold">INTENT</div>
          <div className="text-[10px] text-slate-300">{intent.sideLabel}</div>
        </div>

        {/* Order Summary */}
        <div className="shrink-0 flex flex-col gap-2 rounded-lg border border-[#1e2530] px-3 py-2" style={{ background: 'rgba(255,255,255,0.02)' }}>
          <div className="flex justify-between items-center">
            <span className="text-[11px] text-slate-400 font-medium">Total Value</span>
            <span className={`text-[13px] font-bold text-[#E2E8F0] ${monoClass} tabular-nums`}>
              ${((Number(quantityText) || 0) * (orderType === 'market' ? lastPrice : Number(priceText) || 0)).toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between items-center border-t border-[#1e2530]/50 pt-2">
            <span className="text-[11px] text-slate-400 font-medium">Available Balance</span>
            <span className={`text-[13px] font-bold text-[#00C076] ${monoClass} tabular-nums`}>
              ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cashBalance)}
            </span>
          </div>
        </div>

        {/* BUY / SELL Buttons */}
        <div className="grid grid-cols-2 gap-2 shrink-0">
          <button
            className="rounded-xl py-3 text-[12px] font-extrabold tracking-wider text-black disabled:opacity-40 transition-all hover:brightness-110 hover:scale-[1.02] active:scale-100"
            style={{ background: intent.canSubmit ? 'linear-gradient(135deg, #00C076, #00A060)' : '#00C076', boxShadow: intent.canSubmit ? '0 0 16px rgba(0,192,118,0.35)' : 'none' }}
            disabled={!intent.canSubmit}
            onClick={onBuy}
          >
            BUY
          </button>
          <button
            className="rounded-xl py-3 text-[12px] font-extrabold tracking-wider text-white disabled:opacity-40 transition-all hover:brightness-110 hover:scale-[1.02] active:scale-100"
            style={{ background: intent.canSubmit ? 'linear-gradient(135deg, #FF4560, #CC2040)' : '#FF4560', boxShadow: intent.canSubmit ? '0 0 16px rgba(255,69,96,0.35)' : 'none' }}
            disabled={!intent.canSubmit}
            onClick={onSell}
          >
            SELL
          </button>
        </div>

        {/* Recent Fills */}
        <div className="shrink-0 rounded-xl border border-[#1e2530] overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)' }}>
          <div className="px-3 py-2 border-b border-[#1e2530] flex items-center justify-between">
            <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">Recent Fills</span>
            {fills.length > 0 && (
              <span className="text-[10px] text-slate-600">{fills.length} fills</span>
            )}
          </div>
          <div className="space-y-px">
            {fills.length === 0 ? (
              <div className="py-6 text-center text-[11px] text-slate-600">No fills yet</div>
            ) : (
              fills.slice(0, 6).map((fill) => (
                <div key={fill.id} className="grid grid-cols-4 px-3 py-2 text-[10px] hover:bg-white/[0.02] transition-colors">
                  <span className="truncate text-slate-400 font-medium">{fill.asset}</span>
                  <span className={`font-bold ${fill.action === 'buy' ? 'text-[#00C076]' : 'text-[#FF4560]'}`}>{fill.action.toUpperCase()}</span>
                  <span className={`text-right text-slate-300 ${monoClass}`}>{Math.round(fill.quantity)}</span>
                  <span className={`text-right text-slate-300 ${monoClass}`}>{fill.price.toFixed(2)}</span>
                </div>
              ))
            )}
          </div>
        </div>
          </>
        )}
      </div>
    </section>
  )
}
