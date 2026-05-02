/* ── AlphaBotEditor – Full-screen node-based strategy builder ── */
import { useCallback, useRef, useState, useMemo } from 'react'
import type { BotNode, NodeType } from '../../types/alphaBot'
import { createNode, uid, type BotStatus, type BotLog } from '../../hooks/useAlphaBot'
import { NodeRenderer } from './NodeRenderer'
import { ConnectionRenderer } from './ConnectionRenderer'
import { NodePalette } from './NodePalette'
import { NodeConfigPanel } from './NodeConfigPanel'
import { monoClass, scrollClass } from '../terminal/constants'
import { BotEditorContext } from './BotEditorContext'
import { ZoomIn, ZoomOut, Maximize } from 'lucide-react'

type DraggingEdge = { fromX: number; fromY: number; toX: number; toY: number }
type PendingPort = { nodeId: string; portId: string; side: 'input' | 'output'; x: number; y: number }

type Props = {
  nodes: BotNode[]
  edges: { id: string; fromNode: string; fromPort: string; toNode: string; toPort: string }[]
  status: BotStatus
  logs: BotLog[]
  /** Bot P&L (sim / tracked for this instance) */
  pnl: number
  accountPnl: number
  onAddNode: (node: BotNode) => void
  onRemoveNode: (id: string) => void
  onUpdateParams: (id: string, params: Record<string, number | string>) => void
  onMoveNode: (id: string, x: number, y: number) => void
  onAddEdge: (edge: { id: string; fromNode: string; fromPort: string; toNode: string; toPort: string }) => void
  onRemoveEdge: (id: string) => void
  onClear: () => void
  onStart: () => void
  onStop: () => void
  onSave: (name: string) => Promise<any>
  onClose: () => void
}

export function AlphaBotEditor({
  nodes,
  edges,
  status,
  logs,
  pnl,
  accountPnl,
  onAddNode,
  onRemoveNode,
  onUpdateParams,
  onMoveNode,
  onAddEdge,
  onRemoveEdge,
  onClear,
  onStart,
  onStop,
  onSave,
  onClose,
}: Props) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [draggingEdge, setDraggingEdge] = useState<DraggingEdge | null>(null)
  const [showLogs, setShowLogs] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [viewport, setViewport] = useState({ x: 0, y: 0, scale: 1 })

  // ── Node dragging state ──
  const nodeDragRef = useRef<{
    nodeId: string
    offsetX: number
    offsetY: number
  } | null>(null)

  // ── Canvas panning state ──
  const canvasDragRef = useRef<{ startX: number; startY: number; startVx: number; startVy: number } | null>(null)

  // ── Port connection state ──
  const pendingPortRef = useRef<PendingPort | null>(null)

  // ── Canvas offset for coordinate transforms ──
  const getCanvasOffset = useCallback(() => {
    if (!canvasRef.current) return { x: 0, y: 0 }
    const rect = canvasRef.current.getBoundingClientRect()
    return { x: rect.left, y: rect.top }
  }, [])

  // ── Add node from palette ──
  const handleAddNode = useCallback(
    (type: NodeType, x: number, y: number) => {
      const node = createNode(type, x, y)
      onAddNode(node)
    },
    [onAddNode],
  )

  // ── Drop from palette ──
  const handleCanvasDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const type = e.dataTransfer.getData('application/alphabot-node') as NodeType
      if (!type) return
      const offset = getCanvasOffset()
      const x = (e.clientX - offset.x - 82 - viewport.x) / viewport.scale
      const y = (e.clientY - offset.y - 14 - viewport.y) / viewport.scale
      handleAddNode(type, x, y)
    },
    [getCanvasOffset, handleAddNode, viewport],
  )

  const handleCanvasDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  // ── Node drag ──
  const handleNodeDragStart = useCallback((nodeId: string, offsetX: number, offsetY: number) => {
    nodeDragRef.current = { nodeId, offsetX: offsetX * viewport.scale, offsetY: offsetY * viewport.scale }
  }, [viewport.scale])

  const handleCanvasPointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('.group')) return
    canvasDragRef.current = { startX: e.clientX, startY: e.clientY, startVx: viewport.x, startVy: viewport.y }
  }, [viewport])

  const handleCanvasPointerMove = useCallback(
    (e: React.PointerEvent) => {
      // Canvas Panning
      const canvasDrag = canvasDragRef.current
      if (canvasDrag) {
        setViewport(v => ({
           ...v,
           x: canvasDrag.startVx + (e.clientX - canvasDrag.startX),
           y: canvasDrag.startVy + (e.clientY - canvasDrag.startY)
        }))
        return
      }

      // Node dragging
      if (nodeDragRef.current) {
        const offset = getCanvasOffset()
        const x = (e.clientX - offset.x - nodeDragRef.current.offsetX - viewport.x) / viewport.scale
        const y = (e.clientY - offset.y - nodeDragRef.current.offsetY - viewport.y) / viewport.scale
        onMoveNode(nodeDragRef.current.nodeId, x, y)
      }
      // Edge dragging
      if (pendingPortRef.current) {
        const offset = getCanvasOffset()
        setDraggingEdge({
          fromX: pendingPortRef.current.x,
          fromY: pendingPortRef.current.y,
          toX: (e.clientX - offset.x - viewport.x) / viewport.scale,
          toY: (e.clientY - offset.y - viewport.y) / viewport.scale,
        })
      }
    },
    [getCanvasOffset, onMoveNode, viewport],
  )

  const handleCanvasPointerUp = useCallback(() => {
    nodeDragRef.current = null
    canvasDragRef.current = null
    pendingPortRef.current = null
    setDraggingEdge(null)
  }, [])

  // ── Port connection ──
  const handlePortPointerDown = useCallback(
    (nodeId: string, portId: string, side: 'output' | 'input', x: number, y: number) => {
      pendingPortRef.current = { nodeId, portId, side, x, y }
    },
    [],
  )

  const handlePortPointerUp = useCallback(
    (nodeId: string, portId: string, side: 'output' | 'input') => {
      const pending = pendingPortRef.current
      if (!pending) return
      // Must connect output→input, different nodes
      if (pending.side === side) return
      if (pending.nodeId === nodeId) return

      const fromNode = side === 'input' ? pending.nodeId : nodeId
      const fromPort = side === 'input' ? pending.portId : portId
      const toNode = side === 'input' ? nodeId : pending.nodeId
      const toPort = side === 'input' ? portId : pending.portId

      onAddEdge({
        id: uid(),
        fromNode,
        fromPort,
        toNode,
        toPort,
      })

      pendingPortRef.current = null
      setDraggingEdge(null)
    },
    [onAddEdge],
  )

  const handleWheel = useCallback((e: React.WheelEvent) => {
    // React synthetic wheel events are passive by default, preventDefault throws an error
    
    // Normalize scroll delta between trackpads and traditional mice
    const zoomSensitivity = 0.002
    const delta = -e.deltaY * zoomSensitivity
    const newScale = Math.min(Math.max(0.2, viewport.scale + delta), 2.5)
    
    const offset = getCanvasOffset()
    const mouseX = e.clientX - offset.x
    const mouseY = e.clientY - offset.y
    
    const scaleRatio = newScale / viewport.scale
    const newX = mouseX - (mouseX - viewport.x) * scaleRatio
    const newY = mouseY - (mouseY - viewport.y) * scaleRatio
    
    setViewport({ x: newX, y: newY, scale: newScale })
  }, [viewport, getCanvasOffset])

  const handleZoomIn = useCallback(() => {
    setViewport(v => {
      const newScale = Math.min(v.scale + 0.2, 2.5)
      // Zoom into center of screen instead of cursor
      const rect = canvasRef.current?.getBoundingClientRect()
      const centerX = rect ? rect.width / 2 : 500
      const centerY = rect ? rect.height / 2 : 500
      const scaleRatio = newScale / v.scale
      const newX = centerX - (centerX - v.x) * scaleRatio
      const newY = centerY - (centerY - v.y) * scaleRatio
      return { x: newX, y: newY, scale: newScale }
    })
  }, [getCanvasOffset])

  const handleZoomOut = useCallback(() => {
    setViewport(v => {
      const newScale = Math.max(v.scale - 0.2, 0.2)
      const rect = canvasRef.current?.getBoundingClientRect()
      const centerX = rect ? rect.width / 2 : 500
      const centerY = rect ? rect.height / 2 : 500
      const scaleRatio = newScale / v.scale
      const newX = centerX - (centerX - v.x) * scaleRatio
      const newY = centerY - (centerY - v.y) * scaleRatio
      return { x: newX, y: newY, scale: newScale }
    })
  }, [getCanvasOffset])

  const handleZoomReset = useCallback(() => {
    setViewport({ x: 0, y: 0, scale: 1 })
  }, [])

  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.group')) return
    setSelectedNodeId(null)
  }, [])

  const ctxValue = useMemo(() => ({
    selectedNodeId,
    setSelectedNodeId,
    updateNodeData: onUpdateParams,
    viewport,
    setViewport
  }), [selectedNodeId, onUpdateParams, viewport])

  return (
    <BotEditorContext.Provider value={ctxValue}>
      <div className="fixed inset-0 z-50 flex flex-col bg-[#0B0E11]">
      {/* ── Top Toolbar ── */}
      <header className="relative z-10 flex shrink-0 items-center justify-between border-b border-[#2B2F36] bg-[#10141A]/80 px-4 py-3 backdrop-blur-md shadow-sm">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-3">
          <span className="bg-gradient-to-r from-[#00C076] to-[#3B82F6] bg-clip-text text-[15px] font-extrabold text-transparent">
            BulBul
          </span>
          <span className="rounded border border-[#2B2F36] bg-[#0B0E11]/50 px-2 py-0.5 text-[10px] font-medium text-[#7E8794]">
            {nodes.length} nodes · {edges.length} edges
          </span>
          </div>
          <span className="text-[11px] text-[#7E8794] pl-0.5">Build Your Own Bot</span>
        </div>

        <div className="flex items-center gap-2">
          {/* P&L */}
          <div className="rounded border border-[#2B2F36] bg-[#0B0E11] px-3 py-1.5 text-[11px] shadow-inner">
            <span className="text-[#AAB0B6]">Bot P&amp;L: </span>
            <span className={`${monoClass} font-bold ${pnl >= 0 ? 'text-[#00C076]' : 'text-[#FF3B30]'}`}>
              {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
            </span>
            <span className="block text-[9px] text-[#6D7480] mt-0.5">
              Account {accountPnl >= 0 ? '+' : ''}${accountPnl.toFixed(2)}
            </span>
          </div>

          {/* Status indicator */}
          <div className={`relative flex items-center gap-2 overflow-hidden rounded border px-3 py-1.5 text-[11px] font-bold ${status === 'running' ? 'border-[#00C076]/40 bg-[#00C076]/10 text-[#00C076]' : status === 'error' ? 'border-[#FF3B30]/40 bg-[#FF3B30]/10 text-[#FF3B30]' : 'border-[#2B2F36] bg-[#0B0E11] text-[#AAB0B6]'}`}>
            {status === 'running' && <div className="absolute inset-0 bg-gradient-to-r from-[#00C076]/10 to-transparent animate-pulse" />}
            <span className="relative flex h-2 w-2">
              {status === 'running' && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00C076] opacity-75" />}
              <span className={`relative inline-flex h-2 w-2 rounded-full ${status === 'running' ? 'bg-[#00C076]' : status === 'error' ? 'bg-[#FF3B30]' : 'bg-[#6D7480]'}`} />
            </span>
            <span className="relative uppercase tracking-wide">{status}</span>
          </div>

          <div className="ml-2 h-6 w-px bg-[#2B2F36]" />

          {/* Controls */}
          {status === 'running' ? (
            <button
              className="flex items-center gap-1.5 rounded bg-[#FF3B30] px-3 py-1.5 text-[11px] font-bold text-white shadow shadow-[#FF3B30]/20 transition-all hover:bg-[#FF3B30]/90 hover:shadow-md hover:shadow-[#FF3B30]/30 active:scale-95"
              onClick={onStop}
            >
              <div className="h-2 w-2 bg-white rounded-sm" /> Stop Engine
            </button>
          ) : (
            <button
              className="flex items-center gap-1.5 rounded bg-[#00C076] px-3 py-1.5 text-[11px] font-bold text-black shadow shadow-[#00C076]/20 transition-all hover:bg-[#00C076]/90 hover:shadow-md hover:shadow-[#00C076]/30 active:scale-95"
              onClick={onStart}
            >
               ▶ Start Engine
            </button>
          )}

          <button
            className={`rounded border border-[#2B2F36] px-3 py-1.5 text-[11px] font-medium transition-colors ${showLogs ? 'bg-[#22272E] text-white' : 'bg-[#1A1E26] text-[#AAB0B6] hover:bg-[#22272E] hover:text-[#D9DEE3]'}`}
            onClick={() => setShowLogs((p) => !p)}
          >
            {showLogs ? 'Hide Logs' : 'View Logs'}
          </button>

          <button
            className="rounded border border-[#FF3B30]/30 bg-[#FF3B30]/10 px-3 py-1.5 text-[11px] font-medium text-[#FF3B30] transition-colors hover:bg-[#FF3B30]/20 active:scale-95"
            onClick={onClear}
          >
            Clear Canvas
          </button>

          <button
            className="rounded border border-[#3B82F6]/30 bg-[#3B82F6]/10 px-3 py-1.5 text-[11px] font-medium text-[#3B82F6] transition-colors hover:bg-[#3B82F6]/20 active:scale-95"
            disabled={isSaving}
            onClick={async () => {
              if (isSaving) return
              const name = prompt('Enter a name for this strategy:');
              if (name) {
                try {
                  setIsSaving(true)
                  await onSave(name)
                } catch (error) {
                  console.error('Failed to save strategy:', error)
                  alert('Failed to save strategy. Please try again.')
                } finally {
                  setIsSaving(false)
                }
              }
            }}
          >
            {isSaving ? 'Saving...' : 'Save Strategy'}
          </button>

          <button
            className="ml-2 rounded text-[#7E8794] transition-colors hover:text-[#D9DEE3] px-2 py-1.5"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
      </header>

      {/* ── Main content area ── */}
      <div className="flex min-h-0 flex-1">
        {/* Left: node palette */}
        <NodePalette onAddNode={handleAddNode} />

        {/* Center: canvas */}
        <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden" onWheel={handleWheel}>
          <div
            ref={canvasRef}
            className={`absolute inset-0 bg-[#0B0E11] ${canvasDragRef.current ? 'cursor-grabbing' : 'cursor-grab'}`}
            style={{
              backgroundImage: 'radial-gradient(circle, #2B2F36 1.5px, transparent 1.5px)',
              backgroundSize: `${32 * viewport.scale}px ${32 * viewport.scale}px`,
              backgroundPosition: `${viewport.x}px ${viewport.y}px`,
            }}
            onPointerDown={handleCanvasPointerDown}
            onPointerMove={handleCanvasPointerMove}
            onPointerUp={handleCanvasPointerUp}
            onPointerLeave={handleCanvasPointerUp}
            onDrop={handleCanvasDrop}
            onDragOver={handleCanvasDragOver}
            onClick={handleCanvasClick}
          >
            {/* Infinite Board Layer */}
            <div 
              style={{
                transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`,
                transformOrigin: '0 0',
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none'
              }}
            >
              {/* Edges layer */}
              <div style={{ pointerEvents: 'none', position: 'absolute', inset: 0, overflow: 'visible' }}>
                <ConnectionRenderer
                  nodes={nodes}
                  edges={edges}
                  draggingEdge={draggingEdge}
                  status={status}
                  onDeleteEdge={onRemoveEdge}
                />
              </div>

              {/* Nodes layer */}
              <div style={{ pointerEvents: 'auto' }}>
                {nodes.map((node) => (
                  <NodeRenderer
                    key={node.id}
                    node={node}
                    onDragStart={handleNodeDragStart}
                    onPortPointerDown={handlePortPointerDown}
                    onPortPointerUp={handlePortPointerUp}
                    onDelete={onRemoveNode}
                  />
                ))}
              </div>
            </div>

            {/* Viewport Scale UI Controls */}
            <div className="absolute bottom-4 right-4 flex flex-col gap-1.5 z-40 bg-[#10141A]/80 backdrop-blur-md p-1.5 rounded-lg border border-[#2B2F36] shadow-xl pointer-events-auto">
              <button onClick={handleZoomIn} className="p-2 text-[#AAB0B6] hover:text-white hover:bg-[#2B2F36] rounded transition-colors" title="Zoom In">
                <ZoomIn size={16} />
              </button>
              <button onClick={handleZoomReset} className="p-2 text-[#AAB0B6] hover:text-white hover:bg-[#2B2F36] rounded transition-colors" title="Reset Scale">
                <Maximize size={16} />
              </button>
              <button onClick={handleZoomOut} className="p-2 text-[#AAB0B6] hover:text-white hover:bg-[#2B2F36] rounded transition-colors" title="Zoom Out">
                <ZoomOut size={16} />
              </button>
              <div className="text-center text-[10px] font-mono text-[#6D7480] pt-1 border-t border-[#2B2F36] mt-1">
                {Math.round(viewport.scale * 100)}%
              </div>
            </div>

            {/* Empty state */}
            {nodes.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none opacity-80">
                <div className="relative mb-4 flex h-24 w-24 items-center justify-center rounded-full border border-dashed border-[#2B2F36] bg-[#10141A]">
                  <div className="absolute inset-2 rounded-full border border-[#00C076]/20 bg-[#00C076]/5 animate-pulse" />
                  <span className="text-4xl text-[#00C076]">🧩</span>
                </div>
                <h3 className="mb-2 text-[18px] font-bold text-[#D9DEE3]">Strategy Canvas is Empty</h3>
                <p className="max-w-[300px] text-center text-[13px] text-[#7E8794]">
                  Drag nodes from the palette on the left to start building your automated trading logic.
                </p>
              </div>
            )}
          </div>

          {/* Log panel overlay at bottom */}
          {showLogs && (
            <div className={`absolute bottom-0 left-0 right-0 h-[220px] rounded-t-xl border-t border-[#2B2F36] bg-[#10141A]/95 shadow-2xl overflow-hidden flex flex-col backdrop-blur-md`}>
              <div className="flex shrink-0 items-center justify-between border-b border-[#2B2F36] bg-[#0B0E11]/80 px-4 py-2">
                <div className="text-[11px] font-bold tracking-widest text-[#AAB0B6]">ACTIVITY LOG</div>
                <button onClick={() => setShowLogs(false)} className="text-[#6D7480] hover:text-[#D9DEE3]">✕</button>
              </div>
              <div className={`flex-1 overflow-y-auto p-3 space-y-1.5 ${scrollClass}`}>
                {logs.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-[11px] text-[#6D7480] italic">No activity yet</div>
                ) : (
                  logs.map((log) => (
                    <div
                      key={log.id}
                      className={`flex gap-3 rounded bg-[#1A1E26]/80 px-3 py-2 text-[12px] border-l-[3px] shadow-sm ${
                        log.type === 'trade'
                          ? 'border-[#00C076] text-[#D9DEE3]'
                          : log.type === 'error'
                            ? 'border-[#FF3B30] text-[#FF3B30]'
                            : 'border-[#3B82F6] text-[#AAB0B6]'
                      }`}
                    >
                      <span className={`shrink-0 font-mono text-[11px] ${log.type === 'trade' ? 'text-[#00C076]/70' : 'text-[#7E8794]'}`}>
                        {new Date(log.time).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit', fractionalSecondDigits: 3 })}
                      </span>
                      <span className={log.type === 'trade' ? 'font-medium text-[#00C076]' : ''}>{log.message}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right: config panel */}
        <NodeConfigPanel
          nodes={nodes}
          onDelete={(id) => {
            onRemoveNode(id)
            if (selectedNodeId === id) setSelectedNodeId(null)
          }}
        />
      </div>
      </div>
    </BotEditorContext.Provider>
  )
}
