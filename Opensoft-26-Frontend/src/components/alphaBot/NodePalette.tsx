/* ── NodePalette – Draggable node list sidebar ─────────────── */
import { NODE_REGISTRY, type NodeCategory, type NodeType } from '../../types/alphaBot'
import { scrollClass } from '../terminal/constants'
import { Radio, LineChart, Zap, Target } from 'lucide-react'

type Props = {
  onAddNode: (type: NodeType, x: number, y: number) => void
}

const CATEGORIES: { key: NodeCategory; label: string; icon: React.ElementType }[] = [
  { key: 'data', label: 'Data Sources', icon: Radio },
  { key: 'indicator', label: 'Indicators', icon: LineChart },
  { key: 'condition', label: 'Conditions', icon: Zap },
  { key: 'action', label: 'Actions', icon: Target },
]

export function NodePalette({ onAddNode }: Props) {
  const handleDragStart = (e: React.DragEvent, type: NodeType) => {
    e.dataTransfer.setData('application/alphabot-node', type)
    e.dataTransfer.effectAllowed = 'copy'
  }

  const handleDoubleClick = (type: NodeType) => {
    // Quick-add at a default position
    onAddNode(type, 200 + Math.random() * 200, 100 + Math.random() * 200)
  }

  return (
    <aside className={`flex h-full min-h-0 w-[200px] shrink-0 flex-col border-r border-[#2B2F36] bg-[#10141A] overflow-y-auto overscroll-contain ${scrollClass}`}>
      <header className="shrink-0 border-b border-[#2B2F36] px-3 py-2 text-[11px] font-bold tracking-widest text-[#AAB0B6]">
        NODE PALETTE
      </header>

      <div className="min-h-0 flex-1 p-2 space-y-3">
        {CATEGORIES.map((cat) => {
          const items = NODE_REGISTRY.filter((n) => n.category === cat.key)
          if (items.length === 0) return null
          return (
            <div key={cat.key}>
              <div className="mb-2 mt-4 flex items-center gap-1.5 text-[10px] font-bold tracking-widest text-[#7E8794] uppercase">
                <cat.icon size={13} strokeWidth={2.5} className="text-[#6D7480]" />
                <span>{cat.label}</span>
              </div>
              <div className="space-y-1.5">
                {items.map((entry) => (
                  <div
                    key={entry.type}
                    draggable
                    onDragStart={(e) => handleDragStart(e, entry.type)}
                    onDoubleClick={() => handleDoubleClick(entry.type)}
                    className="group flex cursor-grab items-center gap-2 rounded-md border border-[#2B2F36] bg-[#1A1E26] px-2.5 py-1.5 text-[11px] font-medium text-[#D9DEE3] transition-all duration-200 hover:-translate-y-[1px] hover:border-[#3A404A] hover:bg-[#22272E] hover:shadow-lg hover:shadow-black/20 active:cursor-grabbing active:scale-95 active:opacity-75"
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full border border-white/10 transition-transform group-hover:scale-125 hover:shadow-sm"
                      style={{ background: entry.color }}
                    />
                    <span className="truncate group-hover:text-white">{entry.label}</span>
                    <span className="ml-auto flex items-center gap-[2px] text-[9px] text-[#5A616B] font-mono group-hover:text-[#AAB0B6]">
                      {entry.inputs.length > 0 ? <span className="mr-0.5">{entry.inputs.length}</span> : ''}
                      {entry.inputs.length > 0 || entry.outputs.length > 0 ? '→' : ''}
                      {entry.outputs.length > 0 ? <span className="ml-0.5">{entry.outputs.length}</span> : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <footer className="shrink-0 border-t border-[#2B2F36] px-3 py-2 text-[9px] text-[#6D7480]">
        Drag nodes onto canvas or double-click to add
      </footer>
    </aside>
  )
}
