/* ── NodeRenderer – Single node brick ──────────────────────── */
import { useCallback } from 'react'
import { Radio, LineChart, Zap, Target, X } from 'lucide-react'
import type { BotNode } from '../../types/alphaBot'
import { getRegistryEntry } from '../../types/alphaBot'
import { monoClass } from '../terminal/constants'
import { useBotEditor } from './BotEditorContext'

const PORT_R = 6
const PORT_GAP = 22
const NODE_W = 164
const HEADER_H = 28

type Props = {
  node: BotNode
  onDragStart: (id: string, offsetX: number, offsetY: number) => void
  onPortPointerDown: (nodeId: string, portId: string, side: 'output' | 'input', x: number, y: number) => void
  onPortPointerUp: (nodeId: string, portId: string, side: 'output' | 'input') => void
  onDelete: (id: string) => void
}

export function NodeRenderer({
  node,
  onDragStart,
  onPortPointerDown,
  onPortPointerUp,
  onDelete,
}: Props) {
  const { selectedNodeId, setSelectedNodeId } = useBotEditor()
  const selected = selectedNodeId === node.id
  const entry = getRegistryEntry(node.type)
  const maxPorts = Math.max(entry.inputs.length, entry.outputs.length, 1)
  const bodyH = maxPorts * PORT_GAP + 10
  const totalH = HEADER_H + bodyH

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if ((e.target as HTMLElement).closest('[data-port]') || (e.target as HTMLElement).closest('button')) return
      e.stopPropagation()
      setSelectedNodeId(node.id)
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
      const scale = rect.width / NODE_W
      onDragStart(node.id, (e.clientX - rect.left) / scale, (e.clientY - rect.top) / scale)
    },
    [node.id, onDragStart, setSelectedNodeId],
  )

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
    },
    [],
  )

  const portCenter = (index: number) => HEADER_H + 12 + index * PORT_GAP

  const Icon = 
    entry.category === 'data' ? Radio :
    entry.category === 'indicator' ? LineChart :
    entry.category === 'condition' ? Zap : Target

  return (
    <div
      className="pointer-events-auto absolute select-none group"
      style={{
        left: node.x,
        top: node.y,
        width: NODE_W,
        height: totalH,
        zIndex: selected ? 20 : 10,
      }}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
    >
      {/* Glow ring when selected / Shadow */}
      <div
        className={`absolute inset-0 rounded-lg transition-all duration-200 ${selected ? 'scale-[1.02]' : 'scale-100'}`}
        style={{
          boxShadow: selected ?
            `0 0 0 2px ${entry.color}, 0 0 24px ${entry.color}44` :
            '0 4px 12px rgba(0, 0, 0, 0.4), 0 0 0 1px #2B2F36',
        }}
      />

      {/* Card body */}
      <div className="relative h-full rounded-lg bg-[#11151C]/95 backdrop-blur-md overflow-hidden shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]">
        {/* Header */}
        <div
          className="flex items-center justify-between px-2.5 text-[11px] font-bold tracking-wide text-white shadow-sm"
          style={{ height: HEADER_H, background: `linear-gradient(to right, ${entry.color}DD, ${entry.color}88)` }}
        >
          <div className="flex items-center gap-1.5 overflow-hidden">
            <Icon size={12} className="shrink-0 opacity-90 drop-shadow-sm" />
            <span className="truncate drop-shadow-sm">{node.label}</span>
          </div>
          <button
            className="ml-1 flex h-4 w-4 shrink-0 items-center justify-center rounded text-white/70 transition-colors hover:bg-black/20 hover:text-[#FF3B30] opacity-0 group-hover:opacity-100"
            onClick={(e) => { e.stopPropagation(); onDelete(node.id) }}
            title="Delete node"
          >
            <X size={12} />
          </button>
        </div>

        {/* Port area */}
        <div className="relative" style={{ height: bodyH }}>
          {/* Input ports */}
          {entry.inputs.map((port, i) => {
            const cy = portCenter(i) - HEADER_H
            return (
              <div key={port.id}>
                <div
                  data-port="input"
                  title={`${port.label} (${port.dataType})`}
                  className="absolute cursor-crosshair rounded-full border-[2.5px] border-[#11151C] transition-all hover:scale-125 hover:border-white z-10 shadow-sm"
                  style={{
                    left: -PORT_R,
                    top: cy - PORT_R,
                    width: PORT_R * 2,
                    height: PORT_R * 2,
                    background: port.dataType === 'boolean' ? '#F0B90B' : '#3B82F6',
                    boxShadow: 'inset 0 0 4px rgba(0,0,0,0.6)'
                  }}
                  onPointerDown={(e) => {
                    e.stopPropagation()
                    onPortPointerDown(node.id, port.id, 'input', node.x, node.y + portCenter(i))
                  }}
                  onPointerUp={(e) => {
                    e.stopPropagation()
                    onPortPointerUp(node.id, port.id, 'input')
                  }}
                />
                <span
                  className={`absolute text-[9px] text-[#AAB0B6] ${monoClass}`}
                  style={{ left: PORT_R + 4, top: cy - 6 }}
                >
                  {port.label}
                </span>
              </div>
            )
          })}

          {/* Output ports */}
          {entry.outputs.map((port, i) => {
            const cy = portCenter(i) - HEADER_H
            return (
              <div key={port.id}>
                <div
                  data-port="output"
                  title={`${port.label} (${port.dataType})`}
                  className="absolute cursor-crosshair rounded-full border-[2.5px] border-[#11151C] transition-all hover:scale-125 hover:border-white z-10 shadow-sm"
                  style={{
                    right: -PORT_R,
                    top: cy - PORT_R,
                    width: PORT_R * 2,
                    height: PORT_R * 2,
                    background: port.dataType === 'boolean' ? '#F0B90B' : '#3B82F6',
                    boxShadow: 'inset 0 0 4px rgba(0,0,0,0.6)'
                  }}
                  onPointerDown={(e) => {
                    e.stopPropagation()
                    onPortPointerDown(node.id, port.id, 'output', node.x + NODE_W, node.y + portCenter(i))
                  }}
                  onPointerUp={(e) => {
                    e.stopPropagation()
                    onPortPointerUp(node.id, port.id, 'output')
                  }}
                />
                <span
                  className={`absolute text-right text-[9px] text-[#AAB0B6] ${monoClass}`}
                  style={{ right: PORT_R + 4, top: cy - 6 }}
                >
                  {port.label}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// Exported constants for edge calculations
export { NODE_W, HEADER_H, PORT_GAP, PORT_R }
