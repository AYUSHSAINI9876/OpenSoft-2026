import { useEffect, useState } from 'react'
import { Activity, Bot, Play, Square, SlidersHorizontal, TrendingUp, TrendingDown, Info, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { scrollClass } from './constants'

type BotPanelProps = {
  status: 'idle' | 'running' | 'error'
  /** Simulated / tracked P&L for this bot instance */
  botPnl: number
  /** User portfolio total P&L (reference) */
  accountPnl: number
  logs: { id: number; type: 'info' | 'trade' | 'error'; message: string; time: number }[]
  selectedPreset: 'scalper' | 'meanReversion' | 'breakout'
  activeStrategyName: string
  mode: 'simulation' | 'live'
  savedStrategies: { name: string; updatedAt?: string }[]
  onSelectPreset: (preset: 'scalper' | 'meanReversion' | 'breakout') => void
  onLoadSavedStrategy: (name: string) => void
  onRefreshSavedStrategies: () => void
  onModeChange: (mode: 'simulation' | 'live') => void
  onStart: () => void
  onStop: () => void
  onOpenEditor: () => void
  onClear: () => void
  canPublishCurrent: boolean
  isPublishingCurrent: boolean
  currentPublishEnabled: boolean
  currentShareStrategyEnabled: boolean
  onTogglePublishCurrent: (enabled: boolean) => void
  onToggleShareCurrentStrategy: (enabled: boolean) => void
  isLoggedIn: boolean
  onAuthRequired: () => void
}

const PRESET_LABELS: Record<'scalper' | 'meanReversion' | 'breakout', string> = {
  scalper: 'Scalper',
  meanReversion: 'Mean Reversion',
  breakout: 'Breakout',
}

export function BotPanel({
  status,
  botPnl,
  accountPnl,
  logs,
  selectedPreset,
  activeStrategyName,
  mode,
  savedStrategies,
  onSelectPreset,
  onLoadSavedStrategy,
  onRefreshSavedStrategies,
  onModeChange,
  onStart,
  onStop,
  onOpenEditor,
  onClear,
  canPublishCurrent,
  isPublishingCurrent,
  currentPublishEnabled,
  currentShareStrategyEnabled,
  onTogglePublishCurrent,
  onToggleShareCurrentStrategy,
  isLoggedIn,
  onAuthRequired,
}: BotPanelProps) {
  const hasSaved = savedStrategies.length > 0
  const [selectedSavedName, setSelectedSavedName] = useState('')
  useEffect(() => {
    if (savedStrategies.some((s) => s.name === activeStrategyName)) {
      setSelectedSavedName(activeStrategyName)
    }
  }, [activeStrategyName, savedStrategies])
  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#0F1319]">
      <div className="border-b border-[#2B2F36] px-3 pt-3 pb-2 shrink-0">
        <div className="text-[13px] font-bold text-[#E8ECF3] tracking-tight">BulBul</div>
        <div className="text-[10px] text-[#7E8794] leading-snug mt-0.5">Build Your Own Bot</div>
      </div>

      <div className="grid grid-cols-2 gap-2 border-b border-[#2B2F36] p-3 shrink-0">
        <div className={`relative rounded border bg-[#101720] px-2 py-1.5 overflow-hidden transition-colors ${status === 'running' ? 'border-[#00C076]/40' : 'border-[#2B2F36]'}`}>
          {status === 'running' && <div className="absolute inset-0 bg-gradient-to-r from-[#00C076]/10 to-transparent animate-pulse" />}
          <div className="relative text-[10px] text-[#7E8794]">Status</div>
          <div className="relative mt-0.5 flex items-center gap-1.5">
            {status === 'running' && (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00C076] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00C076]"></span>
              </span>
            )}
            <div className={`text-[11px] font-bold tracking-wide ${status === 'running' ? 'text-[#00C076]' : status === 'error' ? 'text-[#FF3B30]' : 'text-[#D9DEE3]'}`}>
              {status.toUpperCase()}
            </div>
          </div>
        </div>
        <div className={`rounded border bg-[#101720] px-2 py-1.5 transition-colors ${botPnl > 0 ? 'border-[#00C076]/30 bg-[#00C076]/5' : botPnl < 0 ? 'border-[#FF3B30]/30 bg-[#FF3B30]/5' : 'border-[#2B2F36]'}`}>
          <div className="text-[10px] text-[#7E8794]">Bot P&L</div>
          <div className={`mt-0.5 flex items-center gap-1 text-[11px] font-bold tabular-nums ${botPnl > 0 ? 'text-[#00C076]' : botPnl < 0 ? 'text-[#FF3B30]' : 'text-[#D9DEE3]'}`}>
            {botPnl > 0 ? <TrendingUp size={10} /> : botPnl < 0 ? <TrendingDown size={10} /> : null}
            ${Math.abs(botPnl).toFixed(2)}
          </div>
        </div>
      </div>
      <div className="px-3 pb-2 text-[10px] text-[#6D7480] border-b border-[#2B2F36]">
        Account P&amp;L:{' '}
        <span className={`tabular-nums font-medium ${accountPnl >= 0 ? 'text-[#8FA0B2]' : 'text-[#FF6B6B]'}`}>
          {accountPnl >= 0 ? '+' : ''}${accountPnl.toFixed(2)}
        </span>
      </div>

      <div className="border-b border-[#2B2F36] p-3 shrink-0">
        <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-[#AAB0B6]">
          <Bot className="h-3.5 w-3.5" />
          Bot Selection
        </div>
        <div className="flex gap-1.5">
          {(['scalper', 'meanReversion', 'breakout'] as const).map((preset) => (
            <button
              key={preset}
              className={`rounded border px-2 py-1 text-[10px] font-semibold transition-colors ${
                selectedPreset === preset
                  ? 'border-transparent bg-slate-700 text-white'
                  : 'border-[#2B2F36] bg-[#141A22] text-[#AAB0B6] hover:bg-[#1B232E] hover:text-[#D9DEE3]'
              }`}
              onClick={() => isLoggedIn ? onSelectPreset(preset) : onAuthRequired()}
            >
              {PRESET_LABELS[preset]}
            </button>
          ))}
        </div>
        <div className="mt-2 flex items-center justify-between text-[10px] text-[#7E8794]">
          <span>Active: {activeStrategyName}</span>
          <button
            onClick={() => isLoggedIn ? onRefreshSavedStrategies() : onAuthRequired()}
            className="text-[#AAB0B6] hover:text-white"
          >
            Refresh saved
          </button>
        </div>
        <div className="mt-2 flex gap-1.5">
          <button
            onClick={() => isLoggedIn ? onModeChange('simulation') : onAuthRequired()}
            className={`rounded border px-2 py-1 text-[10px] font-semibold ${mode === 'simulation' ? 'border-[#00C076]/50 bg-[#00C076]/15 text-[#00C076]' : 'border-[#2B2F36] bg-[#141A22] text-[#AAB0B6]'}`}
          >
            Simulation Mode
          </button>
          <button
            onClick={() => isLoggedIn ? onModeChange('live') : onAuthRequired()}
            className={`rounded border px-2 py-1 text-[10px] font-semibold ${mode === 'live' ? 'border-[#3B82F6]/50 bg-[#3B82F6]/15 text-[#93C5FD]' : 'border-[#2B2F36] bg-[#141A22] text-[#AAB0B6]'}`}
          >
            Live Mode
          </button>
        </div>
        <div className="mt-1 text-[10px] text-[#7E8794]">
          {mode === 'simulation'
            ? 'Simulation runs on live market data without affecting your account portfolio.'
            : 'Live mode places real account orders and updates portfolio PnL.'}
        </div>
        <div className="mt-2 flex gap-1.5">
          <select
            className="min-w-0 flex-1 rounded border border-[#2B2F36] bg-[#141A22] px-2 py-1 text-[10px] text-[#D9DEE3]"
            disabled={!isLoggedIn || !hasSaved}
            value={selectedSavedName}
            onChange={(e) => {
              const next = e.target.value
              setSelectedSavedName(next)
              if (next) {
                onLoadSavedStrategy(next)
              }
            }}
          >
            <option value="">Load saved strategy...</option>
            {savedStrategies.map((item) => (
              <option key={item.name} value={item.name}>{item.name}</option>
            ))}
          </select>
        </div>
        <div className="mt-2 rounded border border-[#2B2F36] bg-[#101720] px-2 py-1.5">
          <div className="text-[10px] text-[#7E8794] mb-1">Weekly Leaderboard</div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-[10px] text-[#AAB0B6]">
              <input
                type="checkbox"
                checked={currentPublishEnabled}
                disabled={!canPublishCurrent || isPublishingCurrent}
                onChange={(e) => onTogglePublishCurrent(e.target.checked)}
                className="h-3.5 w-3.5 accent-[#3B82F6]"
              />
              Publish Result
            </label>
            <label className="flex items-center gap-1.5 text-[10px] text-[#AAB0B6]">
              <input
                type="checkbox"
                checked={currentShareStrategyEnabled}
                disabled={!canPublishCurrent || isPublishingCurrent}
                onChange={(e) => onToggleShareCurrentStrategy(e.target.checked)}
                className="h-3.5 w-3.5 accent-[#8B5CF6]"
              />
              Share Strategy Logic
            </label>
          </div>
          {!canPublishCurrent && (
            <div className="mt-1 text-[9px] text-[#6D7480]">
              Start BulBul once so this bot can be published to weekly leaderboard.
            </div>
          )}
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5 relative">
          {!isLoggedIn && (
            <div 
              className="absolute inset-0 z-10 cursor-pointer" 
              onClick={onAuthRequired}
              title="Sign in to use bot"
            />
          )}
          <button onClick={onStart} className="inline-flex items-center gap-1 rounded bg-[#00C076] px-2 py-1 text-[10px] font-semibold text-black hover:brightness-110">
            <Play className="h-3 w-3" />
            {status === 'running' ? 'Start Another' : 'Start'}
          </button>
          {status === 'running' && (
            <button onClick={onStop} className="inline-flex items-center gap-1 rounded bg-[#FF3B30] px-2 py-1 text-[10px] font-semibold text-white hover:brightness-110">
              <Square className="h-3 w-3" />
              Stop Latest
            </button>
          )}
          <button onClick={onOpenEditor} className="inline-flex items-center gap-1 rounded border border-[#2B2F36] bg-[#141A22] px-2 py-1 text-[10px] font-semibold text-[#D9DEE3] hover:bg-[#1B232E] transition-colors">
            <SlidersHorizontal className="h-3 w-3" />
            Editor
          </button>
          <button onClick={onClear} className="rounded border border-[#FF3B30]/40 bg-[#FF3B30]/10 px-2 py-1 text-[10px] font-semibold text-[#FF3B30] hover:bg-[#FF3B30]/20 transition-colors">
            Clear
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col p-3">
        <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-[#AAB0B6] shrink-0">
          <Activity className="h-3.5 w-3.5" />
          Bot Activity
        </div>
        <div className={`flex-1 min-h-0 overflow-y-auto space-y-1 ${scrollClass}`}>
          {logs.slice(0, 50).map((log) => (
            <div key={log.id} className={`flex items-start gap-1.5 rounded bg-[#10151D] px-2 py-1.5 text-[10px] border-l-2 mb-1 ${log.type === 'trade' ? 'border-[#00C076] text-[#D9DEE3]' :
                log.type === 'error' ? 'border-[#FF3B30] text-[#FF3B30]' :
                  'border-[#3B82F6] text-[#AAB0B6]'
              }`}>
              <div className="mt-0.5 shrink-0">
                {log.type === 'trade' ? <CheckCircle2 size={10} className="text-[#00C076]" /> :
                  log.type === 'error' ? <AlertTriangle size={10} /> :
                    <Info size={10} className="text-[#3B82F6]" />}
              </div>
              <div>
                <span className="mr-1.5 font-mono tabular-nums text-[9px] text-slate-500">
                  {new Date(log.time).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
                <span className={log.type === 'trade' ? 'font-medium' : ''}>{log.message}</span>
              </div>
            </div>
          ))}
          {logs.length === 0 && (
            <div className="flex items-center justify-center rounded border border-dashed border-[#2B2F36] bg-[#10151D] py-4 text-[10px] text-[#7E8794]">
              No activity yet
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
