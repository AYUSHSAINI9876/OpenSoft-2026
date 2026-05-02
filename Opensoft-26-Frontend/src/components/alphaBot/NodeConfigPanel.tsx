/* ── NodeConfigPanel – Hyperparameter editing sidebar ───────── */
import { useState, useEffect } from 'react'
import type { BotNode } from '../../types/alphaBot'
import { getRegistryEntry } from '../../types/alphaBot'
import { monoClass, scrollClass } from '../terminal/constants'
import { Settings, Trash2, X } from 'lucide-react'
import { useBotEditor } from './BotEditorContext'

type Props = {
  nodes: BotNode[]
  onDelete: (id: string) => void
}

export function NodeConfigPanel({ nodes, onDelete }: Props) {
  const { selectedNodeId, setSelectedNodeId, updateNodeData } = useBotEditor()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const node = nodes.find((n) => n.id === selectedNodeId) ?? null

  const onClose = () => setSelectedNodeId(null)

  useEffect(() => {
    setConfirmDelete(false)
  }, [node?.id])

  if (!node) {
    return (
      <aside className="flex h-full w-[220px] shrink-0 flex-col items-center justify-center border-l border-[#2B2F36] bg-[#0B0E11] text-[11px] text-[#6D7480]">
        <div className="flex flex-col items-center px-4 text-center opacity-70">
          <Settings className="mb-3 h-8 w-8 text-[#AAB0B6] animate-[spin_4s_linear_infinite]" strokeWidth={1.5} />
          <p className="font-medium text-[#AAB0B6]">Select a node to edit its parameters</p>
        </div>
      </aside>
    )
  }

  const entry = getRegistryEntry(node.type)

  return (
    <aside className={`flex h-full min-h-0 w-[220px] shrink-0 flex-col border-l border-[#2B2F36] bg-[#10141A] overflow-y-auto overscroll-contain ${scrollClass}`}>
      {/* Header */}
      <header className="shrink-0 border-b border-[#2B2F36] px-3 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className="h-3 w-3 rounded-full border border-white/20 shadow-sm"
              style={{ background: entry.color }}
            />
            <span className="text-[13px] font-bold text-[#D9DEE3] truncate">{node.label}</span>
          </div>
          <button
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[#6D7480] transition-colors hover:bg-[#2B2F36] hover:text-white"
            onClick={onClose}
            title="Close config"
          >
            <X size={14} />
          </button>
        </div>
        <div className="mt-1 text-[9px] text-[#6D7480] uppercase tracking-wide">
          {entry.category} · {entry.type}
        </div>
      </header>

      {/* Port info */}
      <div className="shrink-0 border-b border-[#2B2F36] px-3 py-3">
        <div className="mb-2 text-[10px] font-bold tracking-widest text-[#7E8794] uppercase">Ports</div>
        <div className="space-y-2 text-[10px]">
          {entry.inputs.length > 0 && (
            <div className="flex items-start gap-2">
              <span className="mt-[2px] w-6 shrink-0 text-[#6D7480] font-medium">In:</span>
              <div className="flex flex-wrap gap-1.5">
                {entry.inputs.map((p) => (
                  <span key={p.id} className="flex items-center gap-1.5 rounded bg-[#1A1E26] px-1.5 py-0.5 text-[#D9DEE3] shadow-sm tracking-wide">
                    <span className="h-2 w-2 rounded-full border border-black/40" style={{ background: p.dataType === 'boolean' ? '#F0B90B' : '#3B82F6' }} />
                    {p.label}
                  </span>
                ))}
              </div>
            </div>
          )}
          {entry.outputs.length > 0 && (
            <div className="flex items-start gap-2">
              <span className="mt-[2px] w-6 shrink-0 text-[#6D7480] font-medium">Out:</span>
              <div className="flex flex-wrap gap-1.5">
                {entry.outputs.map((p) => (
                  <span key={p.id} className="flex items-center gap-1.5 rounded bg-[#1A1E26] px-1.5 py-0.5 text-[#D9DEE3] shadow-sm tracking-wide">
                    <span className="h-2 w-2 rounded-full border border-black/40" style={{ background: p.dataType === 'boolean' ? '#F0B90B' : '#3B82F6' }} />
                    {p.label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Parameters */}
      <div className="min-h-0 flex-1 p-3 space-y-4">
        {entry.params.length > 0 ? (
          <>
            <div className="text-[10px] font-bold tracking-widest text-[#7E8794] uppercase">Parameters</div>
            {entry.params.map((param) => {
              const val = node.params[param.key] ?? param.default
              return (
                <div key={param.key} className="space-y-1.5">
                  <label className="block text-[11px] font-medium text-[#D9DEE3]">{param.label}</label>
                  {param.type === 'select' ? (
                    <select
                      className={`w-full rounded border border-[#2B2F36] bg-[#1A1E26] px-2 py-1.5 text-[11px] text-[#AAB0B6] ${monoClass} focus:border-[#00C076] focus:outline-none focus:ring-1 focus:ring-[#00C076]/50 transition-colors shadow-sm`}
                      value={String(val)}
                      onChange={(e) =>
                        updateNodeData(node.id, { [param.key]: e.target.value })
                      }
                    >
                      {param.options?.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="space-y-2">
                      <input
                        type="number"
                        className={`w-full rounded border border-[#2B2F36] bg-[#1A1E26] px-2 py-1.5 text-[11px] text-[#AAB0B6] ${monoClass} focus:border-[#00C076] focus:outline-none focus:ring-1 focus:ring-[#00C076]/50 transition-colors shadow-sm`}
                        value={val}
                        min={param.min}
                        max={param.max}
                        step={param.step}
                        onChange={(e) =>
                          updateNodeData(node.id, { [param.key]: Number(e.target.value) })
                        }
                      />
                      {param.min !== undefined && param.max !== undefined && (
                        <input
                          type="range"
                          className="w-full accent-[#00C076] h-1.5 bg-[#2B2F36] rounded-lg appearance-none cursor-pointer"
                          value={Number(val)}
                          min={param.min}
                          max={param.max}
                          step={param.step}
                          onChange={(e) =>
                            updateNodeData(node.id, { [param.key]: Number(e.target.value) })
                          }
                        />
                      )}
                      {param.min !== undefined && param.max !== undefined && (
                        <div className={`flex justify-between text-[9px] font-bold text-[#6D7480] ${monoClass}`}>
                          <span>{param.min}</span>
                          <span>{param.max}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-center opacity-60">
            <div className="text-[11px] text-[#AAB0B6] italic">No configurable parameters</div>
          </div>
        )}
      </div>

      {/* Node ID & Delete */}
      <div className="shrink-0 border-t border-[#2B2F36] bg-[#0B0E11] p-3 space-y-3">
        <div className={`text-[9px] text-[#6D7480] font-mono tracking-wider truncate text-center`}>
          ID: {node.id.split('-')[0]}
        </div>
        
        {confirmDelete ? (
          <button
            className="flex w-full items-center justify-center gap-1.5 rounded bg-[#FF3B30] px-2 py-2 text-[11px] font-bold text-white shadow-sm transition-all hover:bg-[#FF3B30]/90 active:scale-95"
            onClick={() => { onDelete(node.id); setConfirmDelete(false) }}
          >
            Confirm Delete
          </button>
        ) : (
          <button
            className="flex w-full items-center justify-center gap-1.5 rounded border border-[#FF3B30]/30 bg-[#FF3B30]/10 px-2 py-2 text-[11px] font-bold text-[#FF3B30] transition-colors hover:bg-[#FF3B30]/20"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 size={13} strokeWidth={2.5} />
            Delete Node
          </button>
        )}
      </div>
    </aside>
  )
}
