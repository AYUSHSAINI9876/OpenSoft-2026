import { createContext, useContext } from 'react'

export type Viewport = { x: number; y: number; scale: number }

export type BotEditorContextType = {
  selectedNodeId: string | null
  setSelectedNodeId: (id: string | null) => void
  updateNodeData: (id: string, params: Record<string, number | string>) => void
  viewport: Viewport
  setViewport: (v: Viewport | ((prev: Viewport) => Viewport)) => void
}

export const BotEditorContext = createContext<BotEditorContextType | null>(null)

export function useBotEditor() {
  const ctx = useContext(BotEditorContext)
  if (!ctx) throw new Error('useBotEditor must be used within BotEditorProvider')
  return ctx
}
