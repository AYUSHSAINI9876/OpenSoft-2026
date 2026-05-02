/* ── ConnectionRenderer – SVG edges between nodes ──────────── */
import type { BotEdge, BotNode } from '../../types/alphaBot'
import { getRegistryEntry } from '../../types/alphaBot'
import { NODE_W, HEADER_H, PORT_GAP, PORT_R } from './NodeRenderer'

type Props = {
  nodes: BotNode[]
  edges: BotEdge[]
  /** Temporary dragging edge while user draws a connection */
  draggingEdge: { fromX: number; fromY: number; toX: number; toY: number } | null
  status?: string
  onDeleteEdge?: (id: string) => void
}

const portPos = (node: BotNode, portId: string, side: 'input' | 'output'): { x: number; y: number } | null => {
  const entry = getRegistryEntry(node.type)
  const ports = side === 'input' ? entry.inputs : entry.outputs
  const idx = ports.findIndex((p) => p.id === portId)
  if (idx < 0) return null
  const cy = node.y + HEADER_H + 12 + idx * PORT_GAP
  const cx = side === 'input' ? node.x - PORT_R : node.x + NODE_W + PORT_R
  return { x: cx, y: cy }
}

const bezierPath = (x1: number, y1: number, x2: number, y2: number) => {
  const dx = Math.abs(x2 - x1) * 0.5
  return `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`
}

export function ConnectionRenderer({ nodes, edges, draggingEdge, status, onDeleteEdge }: Props) {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))

  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" style={{ zIndex: 5 }}>
      <style>{`
        @keyframes dashFlow {
          from { stroke-dashoffset: 24; }
          to { stroke-dashoffset: 0; }
        }
        .edge-path {
          transition: stroke-width 0.2s, filter 0.2s, stroke 0.2s;
        }
        .edge-hit:hover + .edge-path {
          stroke: #FF3B30 !important;
          stroke-width: 4px;
          filter: drop-shadow(0 0 4px rgba(255,59,48,0.8));
        }
      `}</style>
      <defs>
        <linearGradient id="edge-grad-num" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.4" />
        </linearGradient>
        <linearGradient id="edge-grad-bool" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#F0B90B" stopOpacity="1" />
          <stop offset="100%" stopColor="#F0B90B" stopOpacity="0.5" />
        </linearGradient>
        <filter id="edge-glow">
          <feGaussianBlur stdDeviation="3" result="glow" />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {edges.map((edge) => {
        const fromNode = nodeMap.get(edge.fromNode)
        const toNode = nodeMap.get(edge.toNode)
        if (!fromNode || !toNode) return null
        const from = portPos(fromNode, edge.fromPort, 'output')
        const to = portPos(toNode, edge.toPort, 'input')
        if (!from || !to) return null

        // Detect data type from source port
        const fromEntry = getRegistryEntry(fromNode.type)
        const sourcePort = fromEntry.outputs.find((p) => p.id === edge.fromPort)
        const isBool = sourcePort?.dataType === 'boolean'

        const pathString = bezierPath(from.x, from.y, to.x, to.y)

        return (
          <g key={edge.id}>
            {/* Invisible wider hit area for hover interactions */}
            <path
              d={pathString}
              fill="none"
              stroke="transparent"
              strokeWidth={16}
              className="edge-hit pointer-events-auto cursor-pointer"
              onClick={(e) => {
                e.stopPropagation()
                onDeleteEdge?.(edge.id)
              }}
            >
              <title>Click to delete connection</title>
            </path>
            {/* Visible edge */}
            <path
              d={pathString}
              fill="none"
              stroke={`url(#edge-grad-${isBool ? 'bool' : 'num'})`}
              strokeWidth={3}
              filter="url(#edge-glow)"
              className="edge-path"
              style={status === 'running' ? {
                strokeDasharray: '8 4',
                animation: 'dashFlow 0.5s linear infinite'
              } : undefined}
            />
          </g>
        )
      })}

      {/* Temporary edge being drawn */}
      {draggingEdge && (
        <path
          d={bezierPath(
            draggingEdge.fromX,
            draggingEdge.fromY,
            draggingEdge.toX,
            draggingEdge.toY,
          )}
          fill="none"
          stroke="#00C076"
          strokeWidth={3}
          strokeDasharray="8 4"
          opacity={0.8}
          style={{ animation: 'dashFlow 0.5s linear infinite' }}
          filter="url(#edge-glow)"
        />
      )}
    </svg>
  )
}
