/* ── Alpha Bot – Strategy Engine Hook ──────────────────────── */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { BotNode, BotEdge, BotStrategy, NodeType } from '../types/alphaBot'
import { getRegistryEntry } from '../types/alphaBot'
import { usePortfolio } from './usePortfolio'
import type { MarketFeed } from './useMockMarket'
import * as api from '../services/api'
import { getToken } from '../services/session'

// ─── Unique ID helper ──────────────────────────────────────
let _uid = 0
export const uid = () => `node_${++_uid}_${Date.now().toString(36)}`

// ─── Create a new node from a type ─────────────────────────
export const createNode = (type: NodeType, x: number, y: number): BotNode => {
  const entry = getRegistryEntry(type)
  const params: Record<string, number | string> = {}
  for (const p of entry.params) params[p.key] = p.default
  return { id: uid(), type, x, y, params, label: entry.label }
}

// ─── Bot status ────────────────────────────────────────────
export type BotStatus = 'idle' | 'running' | 'error'

export type BotLog = {
  id: number
  time: number
  message: string
  type: 'info' | 'trade' | 'error'
  _bk?: string
}

export type BotPreset = 'scalper' | 'meanReversion' | 'breakout'
export type SavedStrategy = { name: string; updatedAt?: string }

const presetLabel = (preset: BotPreset) =>
  preset === 'scalper' ? 'Scalper' : preset === 'meanReversion' ? 'Mean Reversion' : 'Breakout'

const makeSimBotID = (preset: BotPreset, symbol: string) =>
  `alpha_${preset}_${symbol}_${Date.now().toString(36)}`

const BULBUL_SESSION_KEY = 'bulbul_session_v1'
const BULBUL_LOGS_KEY = 'bulbul_logs_v1'
const MAX_BULBUL_LOGS = 500

export type BulbulSession = {
  botId: string
  symbol: string
  mode: 'simulation' | 'live'
  strategyName: string
}

function parseBackendLogs(
  logs: Array<{ id: number; time?: number; message: string; type?: string }>,
): Array<{ backendID: number; time: number; message: string; type: BotLog['type'] }> {
  return logs
    .slice()
    .sort((a, b) => (a.time ?? 0) - (b.time ?? 0))
    .map((e) => ({
      backendID: e.id,
      time: e.time ?? Date.now(),
      message: e.message,
      type: e.type === 'trade' || e.type === 'error' ? e.type : 'info',
    }))
}

const createPresetGraph = (preset: BotPreset): BotStrategy => {
  if (preset === 'scalper') {
    const price = createNode('priceFeed', 80, 120)
    const emaFast = createNode('ema', 320, 60)
    emaFast.params.period = 2
    const emaSlow = createNode('ema', 320, 200)
    emaSlow.params.period = 5
    const cross = createNode('crossover', 560, 130)
    const buy = createNode('marketBuy', 780, 70)
    buy.params.quantity = 1
    const sell = createNode('marketSell', 780, 190)
    sell.params.quantity = 1
    return {
      nodes: [price, emaFast, emaSlow, cross, buy, sell],
      edges: [
        { id: uid(), fromNode: emaFast.id, fromPort: 'result', toNode: cross.id, toPort: 'fast' },
        { id: uid(), fromNode: emaSlow.id, fromPort: 'result', toNode: cross.id, toPort: 'slow' },
        { id: uid(), fromNode: cross.id, fromPort: 'crossUp', toNode: buy.id, toPort: 'trigger' },
        { id: uid(), fromNode: cross.id, fromPort: 'crossDown', toNode: sell.id, toPort: 'trigger' },
      ],
    }
  }
  if (preset === 'meanReversion') {
    const price = createNode('priceFeed', 80, 120)
    const rsi = createNode('rsi', 300, 120)
    rsi.params.period = 3
    const low = createNode('threshold', 520, 70)
    low.params.operator = '<='
    low.params.value = 45
    const high = createNode('threshold', 520, 180)
    high.params.operator = '>='
    high.params.value = 55
    const buy = createNode('marketBuy', 760, 60)
    buy.params.quantity = 1
    const sell = createNode('marketSell', 760, 190)
    sell.params.quantity = 1
    return {
      nodes: [price, rsi, low, high, buy, sell],
      edges: [
        { id: uid(), fromNode: rsi.id, fromPort: 'result', toNode: low.id, toPort: 'value' },
        { id: uid(), fromNode: rsi.id, fromPort: 'result', toNode: high.id, toPort: 'value' },
        { id: uid(), fromNode: low.id, fromPort: 'signal', toNode: buy.id, toPort: 'trigger' },
        { id: uid(), fromNode: high.id, fromPort: 'signal', toNode: sell.id, toPort: 'trigger' },
      ],
    }
  }
  const price = createNode('priceFeed', 80, 120)
  const sma = createNode('sma', 300, 120)
  sma.params.period = 55
  const threshold = createNode('threshold', 520, 120)
  threshold.params.operator = '>'
  threshold.params.value = 0
  const buy = createNode('marketBuy', 740, 90)
  buy.params.quantity = 1
  const stop = createNode('stopLoss', 740, 180)
  stop.params.threshold = 1.8
  stop.params.quantity = 1
  return {
    nodes: [price, sma, threshold, buy, stop],
    edges: [
      { id: uid(), fromNode: sma.id, fromPort: 'result', toNode: threshold.id, toPort: 'value' },
      { id: uid(), fromNode: threshold.id, fromPort: 'signal', toNode: buy.id, toPort: 'trigger' },
      { id: uid(), fromNode: threshold.id, fromPort: 'signal', toNode: stop.id, toPort: 'trigger' },
    ],
  }
}

// ─── The hook ──────────────────────────────────────────────
export type UseAlphaBotOptions = {
  /** Called when a running BulBul session is restored from storage after refresh. */
  onRestoredSession?: (s: { symbol: string; mode: 'simulation' | 'live' }) => void
  /** Current chart evaluation interval (e.g. '1s', '1m'). Sent to backend when starting a bot. */
  evalInterval?: string
}

export const useAlphaBot = (_feed: MarketFeed, symbol: string, options?: UseAlphaBotOptions) => {
  const [nodes, setNodes] = useState<BotNode[]>([])
  const [edges, setEdges] = useState<BotEdge[]>([])
  const [status, setStatus] = useState<BotStatus>('idle')
  const [logs, setLogs] = useState<BotLog[]>([])
  const [botPnl, setBotPnl] = useState(0)
  const { snapshot: portfolio } = usePortfolio()
  const accountPnl = portfolio.total_pnl
  const [selectedPreset, setSelectedPreset] = useState<BotPreset>('scalper')
  const [mode, setMode] = useState<'simulation' | 'live'>('simulation')
  const [savedStrategies, setSavedStrategies] = useState<SavedStrategy[]>([])
  const [activeStrategyName, setActiveStrategyName] = useState<string>('Scalper')
  const [runningBotID, setRunningBotID] = useState<string | null>(null)
  const [runningBotIDs, setRunningBotIDs] = useState<string[]>([])

  const logId = useRef(0)
  const runningRef = useRef(false)
  const runningBotIDRef = useRef<string | null>(null)
  const runningBotIDsRef = useRef<string[]>([])
  const nodesRef = useRef(nodes)
  const edgesRef = useRef(edges)
  const sessionRestoredRef = useRef(false)
  const seenBackendLogKeysRef = useRef<Set<string>>(new Set())
  const evalIntervalRef = useRef(options?.evalInterval)

  useEffect(() => { nodesRef.current = nodes }, [nodes])
  useEffect(() => { edgesRef.current = edges }, [edges])
  useEffect(() => { evalIntervalRef.current = options?.evalInterval }, [options?.evalInterval])
  useEffect(() => { runningBotIDsRef.current = runningBotIDs }, [runningBotIDs])
  useEffect(() => {
    runningRef.current = runningBotIDs.length > 0
    setStatus(runningBotIDs.length > 0 ? 'running' : 'idle')
  }, [runningBotIDs])

  const clearBulbulSession = useCallback(() => {
    try {
      localStorage.removeItem(BULBUL_SESSION_KEY)
    } catch {
      /* ignore */
    }
  }, [])

  const persistBulbulSession = useCallback((sess: BulbulSession) => {
    try {
      localStorage.setItem(BULBUL_SESSION_KEY, JSON.stringify(sess))
    } catch {
      /* ignore */
    }
  }, [])

  const persistLogs = useCallback((logs: BotLog[]) => {
    try { localStorage.setItem(BULBUL_LOGS_KEY, JSON.stringify(logs)) } catch { /* ignore */ }
  }, [])

  const addLog = useCallback((message: string, type: BotLog['type'] = 'info') => {
    logId.current++
    const entry: BotLog = { id: logId.current, time: Date.now(), message, type }
    setLogs((prev) => {
      const next = [entry, ...prev].slice(0, MAX_BULBUL_LOGS)
      persistLogs(next)
      return next
    })
  }, [persistLogs])

  const appendBackendLogs = useCallback((
    botID: string,
    logsFromBackend: Array<{ id: number; time?: number; message: string; type?: string }>,
  ) => {
    const parsed = parseBackendLogs(logsFromBackend)
    if (parsed.length === 0) return
    const fresh: BotLog[] = []
    for (const item of parsed) {
      const key = `${botID}:${item.backendID}`
      if (seenBackendLogKeysRef.current.has(key)) continue
      seenBackendLogKeysRef.current.add(key)
      logId.current++
      fresh.push({
        id: logId.current,
        time: item.time,
        message: item.message,
        type: item.type,
        _bk: key,
      })
    }
    if (fresh.length === 0) return
    setLogs((prev) => {
      const next = [...fresh.slice().reverse(), ...prev].slice(0, MAX_BULBUL_LOGS)
      persistLogs(next)
      return next
    })
  }, [persistLogs])

  const validateStrategy = useCallback((graph: BotStrategy): string[] => {
    const issues: string[] = []
    const byId = new Map(graph.nodes.map((n) => [n.id, n]))
    const actionNodes = graph.nodes.filter((n) => n.type === 'marketBuy' || n.type === 'marketSell' || n.type === 'stopLoss')
    if (actionNodes.length === 0) {
      issues.push('Add at least one action node (Market Buy, Market Sell, or Stop Loss).')
    }
    for (const node of actionNodes) {
      const hasTrigger = graph.edges.some((e) => e.toNode === node.id && e.toPort === 'trigger')
      if (!hasTrigger) issues.push(`Node '${node.label || node.type}' is missing a trigger input.`)
      const qty = Number(node.params.quantity ?? 0)
      if ((node.type === 'marketBuy' || node.type === 'marketSell') && (!Number.isFinite(qty) || qty < 1)) {
        issues.push(`'${node.label || node.type}' quantity must be at least 1 share.`)
      }
      if (node.type === 'stopLoss') {
        const threshold = Number(node.params.threshold ?? 0)
        if (!Number.isFinite(threshold) || threshold <= 0) {
          issues.push(`'${node.label || node.type}' threshold must be greater than 0.`)
        }
      }
      if (!byId.has(node.id)) issues.push(`Unknown node id '${node.id}' in strategy graph.`)
    }
    return issues
  }, [])

  const refreshSavedStrategies = useCallback(async () => {
    try {
      const res = await api.listBotStrategies()
      if (!res.success || !Array.isArray(res.data)) return
      setSavedStrategies(
        res.data
          .map((item) => ({ name: item.name, updatedAt: item.updated_at }))
          .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')),
      )
    } catch {
      // Best-effort loading; avoid noisy logs for unauthenticated users.
    }
  }, [])

  // ── Node / Edge CRUD ──
  const addNode = useCallback((node: BotNode) => {
    setNodes((prev) => [...prev, node])
  }, [])

  const removeNode = useCallback((id: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== id))
    setEdges((prev) => prev.filter((e) => e.fromNode !== id && e.toNode !== id))
  }, [])

  const updateNodeParams = useCallback((id: string, params: Record<string, number | string>) => {
    setNodes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, params: { ...n.params, ...params } } : n)),
    )
  }, [])

  const moveNode = useCallback((id: string, x: number, y: number) => {
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, x, y } : n)))
  }, [])

  const addEdge = useCallback((edge: BotEdge) => {
    setEdges((prev) => {
      // Prevent duplicate connections to same input port
      const filtered = prev.filter(
        (e) => !(e.toNode === edge.toNode && e.toPort === edge.toPort),
      )
      return [...filtered, edge]
    })
  }, [])

  const removeEdge = useCallback((id: string) => {
    setEdges((prev) => prev.filter((e) => e.id !== id))
  }, [])

  // ── Start / Stop ──
  const extractBackendBotID = (payload: unknown): string | null => {
    if (!payload || typeof payload !== 'object') return null
    const obj = payload as Record<string, unknown>
    const candidate = obj.bot_id ?? obj.id
    if (typeof candidate === 'string' && candidate.trim() !== '') return candidate
    if (typeof candidate === 'number' && Number.isFinite(candidate)) return String(candidate)
    return null
  }

  const startBot = useCallback(() => {
    if (nodesRef.current.length === 0) {
      addLog('Cannot start — no nodes in strategy', 'error')
      return
    }
    const graph: BotStrategy = { nodes: nodesRef.current, edges: edgesRef.current }
    const validationIssues = validateStrategy(graph)
    if (validationIssues.length > 0) {
      validationIssues.forEach((issue) => addLog(`Validation: ${issue}`, 'error'))
      return
    }
    
    const botID = makeSimBotID(selectedPreset, symbol)
    api.startSimBot(botID, symbol, graph, mode, activeStrategyName, evalIntervalRef.current)
      .then((data) => {
        if (data.success) {
          const returnedBotID = extractBackendBotID(data.data) ?? botID
          if (!returnedBotID) {
            addLog('Error starting bot: backend did not return bot id', 'error')
            return
          }
          runningBotIDRef.current = returnedBotID
          setRunningBotID(returnedBotID)
          setRunningBotIDs((prev) => (prev.includes(returnedBotID) ? prev : [...prev, returnedBotID]))
          runningRef.current = true
          setBotPnl(0)
          persistBulbulSession({
            botId: returnedBotID,
            symbol,
            mode,
            strategyName: activeStrategyName,
          })
          addLog(`BulBul '${activeStrategyName}' started on ${symbol} (${mode.toUpperCase()})`, 'info')
        } else {
          addLog(`Error starting bot: ${data.error || 'Unknown error'}`, 'error')
        }
      })
      .catch((err: Error) => {
        addLog(`API Error: ${err.message}`, 'error')
      })
  }, [activeStrategyName, addLog, mode, persistBulbulSession, selectedPreset, symbol, validateStrategy])

  const stopBot = useCallback(() => {
    const botID = runningBotIDRef.current
    if (!botID) {
      addLog('Cannot stop bot: missing running bot id', 'error')
      return
    }

    api.stopSimBot(botID)
      .then((data) => {
        if (data.success) {
          setRunningBotIDs((prev) => {
            const next = prev.filter((id) => id !== botID)
            const nextActive = next.length > 0 ? next[next.length - 1] : null
            runningBotIDRef.current = nextActive
            setRunningBotID(nextActive)
            if (!nextActive) {
              setBotPnl(0)
              clearBulbulSession()
            }
            return next
          })
          addLog('BulBul stopped', 'info')
        } else {
          addLog(`Error stopping bot: ${data.error || 'Unknown error'}`, 'error')
        }
      })
      .catch((err: Error) => {
        addLog(`API Error: ${err.message}`, 'error')
      })
  }, [addLog, clearBulbulSession])

  const clearAll = useCallback(() => {
    const ids = [...runningBotIDsRef.current]
    if (ids.length > 0) {
      void Promise.allSettled(ids.map((id) => api.stopSimBot(id))).finally(() => {
        clearBulbulSession()
      })
    }
    clearBulbulSession()
    runningBotIDRef.current = null
    setRunningBotID(null)
    setRunningBotIDs([])
    runningRef.current = false
    setStatus('idle')
    setBotPnl(0)
    setNodes([])
    setEdges([])
    setLogs([])
    seenBackendLogKeysRef.current = new Set()
    persistLogs([])
  }, [clearBulbulSession, persistLogs])

  const loadPreset = useCallback((preset: BotPreset) => {
    if (runningRef.current) {
      stopBot();
    }
    setStatus('idle')
    const strategy = createPresetGraph(preset)
    setNodes(strategy.nodes)
    setEdges(strategy.edges)
    setSelectedPreset(preset)
    setActiveStrategyName(presetLabel(preset))
    addLog(`Loaded ${presetLabel(preset)} preset`, 'info')
  }, [addLog, stopBot])

  const loadSavedStrategy = useCallback(async (name: string) => {
    try {
      const res = await api.getBotStrategy(name)
      const strategy = res.data?.strategy
      if (!res.success || !strategy || !Array.isArray(strategy.nodes) || !Array.isArray(strategy.edges)) {
        addLog(`Unable to load strategy '${name}'`, 'error')
        return false
      }
      if (runningRef.current) stopBot()
      setNodes(strategy.nodes as BotNode[])
      setEdges(strategy.edges as BotEdge[])
      setActiveStrategyName(name)
      addLog(`Loaded saved strategy '${name}'`, 'info')
      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      addLog(`Error loading strategy '${name}': ${message}`, 'error')
      return false
    }
  }, [addLog, stopBot])

  const saveStrategy = useCallback(async (name: string) => {
    try {
      const response = await api.saveBotStrategy(name, {
        nodes: nodesRef.current,
        edges: edgesRef.current,
      })
      if (!response.success) {
        throw new Error(response.error || response.message || 'Failed to save strategy')
      }
      setActiveStrategyName(name)
      await refreshSavedStrategies()
      addLog(`Strategy '${name}' saved successfully!`, 'info')
      return response.data
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unknown error occurred'
      addLog(`Error saving strategy: ${message}`, 'error')
    }
  }, [addLog, refreshSavedStrategies])

  // Restore persisted logs from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(BULBUL_LOGS_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as BotLog[]
      if (!Array.isArray(parsed) || parsed.length === 0) return
      const restored = parsed
        .filter((x) => x && typeof x.id === 'number' && typeof x.message === 'string')
        .slice(0, MAX_BULBUL_LOGS)
      setLogs(restored)
      logId.current = Math.max(logId.current, ...restored.map((l) => l.id))
      for (const log of restored) {
        if (log._bk) seenBackendLogKeysRef.current.add(log._bk)
      }
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    if (nodesRef.current.length > 0 || edgesRef.current.length > 0) return
    const strategy = createPresetGraph('scalper')
    setNodes(strategy.nodes)
    setEdges(strategy.edges)
  }, [])

  useEffect(() => {
    const token = getToken()
    if (!token) return
    void refreshSavedStrategies()
  }, [refreshSavedStrategies])

  const onRestoreRef = useRef(options?.onRestoredSession)
  onRestoreRef.current = options?.onRestoredSession

  useEffect(() => {
    if (sessionRestoredRef.current) return
    if (typeof window === 'undefined') return
    const token = getToken()
    if (!token) return
    const raw = localStorage.getItem(BULBUL_SESSION_KEY)
    if (!raw) return
    let session: BulbulSession
    try {
      session = JSON.parse(raw) as BulbulSession
    } catch {
      clearBulbulSession()
      return
    }
    if (!session.botId) return
    sessionRestoredRef.current = true
    onRestoreRef.current?.({ symbol: session.symbol, mode: session.mode })
    runningBotIDRef.current = session.botId
    setRunningBotID(session.botId)
      setRunningBotIDs((prev) => (prev.includes(session.botId) ? prev : [...prev, session.botId]))
    runningRef.current = true
    setActiveStrategyName(session.strategyName)
    setMode(session.mode)

    void (async () => {
      const res = await api.getSimBotStatus(session.botId)
      if (!res.success || !res.data) {
        const err = (res.error || '').toLowerCase()
        if (err.includes('not found') || err.includes('forbidden') || err.includes('unauthorized')) {
          setRunningBotIDs((prev) => prev.filter((id) => id !== session.botId))
          if (runningBotIDRef.current === session.botId) {
            runningBotIDRef.current = null
            setRunningBotID(null)
            setBotPnl(0)
          }
          clearBulbulSession()
        }
        return
      }
      const payload = res.data as {
        status?: string
        pnl?: number
        logs?: Array<{ id: number; time?: number; message: string; type?: string }>
      }
      if (payload.status === 'stopped' || payload.status === 'error') {
        setRunningBotIDs((prev) => prev.filter((id) => id !== session.botId))
        if (runningBotIDRef.current === session.botId) {
          runningBotIDRef.current = null
          setRunningBotID(null)
          setBotPnl(0)
        }
        clearBulbulSession()
        return
      }
      if (typeof payload.pnl === 'number') setBotPnl(payload.pnl)
      if (Array.isArray(payload.logs) && payload.logs.length > 0) {
        appendBackendLogs(session.botId, payload.logs)
      }
    })()
  }, [appendBackendLogs, clearBulbulSession])

  useEffect(() => {
    if (runningBotIDs.length === 0) return
    let cancelled = false

    const poll = async () => {
      try {
        const ids = [...runningBotIDsRef.current]
        const stoppedIDs: string[] = []
        for (const id of ids) {
          const res = await api.getSimBotStatus(id)
          if (!res.success || cancelled) continue
          const payload = res.data as {
            status?: string
            pnl?: number
            logs?: Array<{ id: number; time?: number; message: string; type?: string }>
          }
          if (id === runningBotIDRef.current && typeof payload.pnl === 'number') setBotPnl(payload.pnl)
          if (Array.isArray(payload.logs) && payload.logs.length > 0) {
            appendBackendLogs(id, payload.logs)
          }
          if (payload.status === 'stopped' || payload.status === 'error') {
            stoppedIDs.push(id)
          }
        }
        if (stoppedIDs.length > 0) {
          setRunningBotIDs((prev) => {
            const next = prev.filter((id) => !stoppedIDs.includes(id))
            if (runningBotIDRef.current && stoppedIDs.includes(runningBotIDRef.current)) {
              const nextActive = next.length > 0 ? next[next.length - 1] : null
              runningBotIDRef.current = nextActive
              setRunningBotID(nextActive)
              if (!nextActive) {
                setBotPnl(0)
                clearBulbulSession()
              }
            }
            return next
          })
        }
      } catch {
        // keep polling; transient API/network errors are expected
      }
    }

    void poll()
    const interval = setInterval(poll, 1500)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [appendBackendLogs, clearBulbulSession, runningBotIDs])

  const strategy: BotStrategy = { nodes, edges }

  return {
    strategy,
    nodes,
    edges,
    status,
    logs,
    runningBotID,
    runningBotIDs,
    botPnl,
    accountPnl,
    selectedPreset,
    mode,
    activeStrategyName,
    savedStrategies,
    addNode,
    removeNode,
    updateNodeParams,
    moveNode,
    addEdge,
    removeEdge,
    clearAll,
    startBot,
    stopBot,
    loadPreset,
    loadSavedStrategy,
    refreshSavedStrategies,
    saveStrategy,
    setMode,
  }
}
