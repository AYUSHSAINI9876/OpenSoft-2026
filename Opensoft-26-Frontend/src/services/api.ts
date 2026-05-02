const _rawBase = (import.meta.env.VITE_API_BASE_URL as string) || '/api/v1'
const BASE_URL = _rawBase.replace(/\/+$/, '')
const AUTH_URL = `${BASE_URL}/auth`

export type Trade = {
  price: number
  qty: number
  maker_order_id: number
  taker_order_id: number
}

export type ApiResponse<T> = {
  success: boolean
  message?: string
  error?: string
  code?: string
  data?: T
}

export type CandleRaw = {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume?: number
}

export type SavedStrategySummary = {
  name: string
  updated_at?: string
}

type ReqOptions = RequestInit & { auth?: boolean }

const authHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

const requestJSON = async <T>(url: string, options: ReqOptions = {}): Promise<ApiResponse<T>> => {
  const headers: Record<string, string> = {
    ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.auth ? authHeaders() : {}),
    ...(options.headers as Record<string, string> | undefined),
  }

  let response: Response
  try {
    response = await fetch(url, { ...options, headers })
  } catch {
    return { success: false, error: 'Network error while contacting backend' }
  }

  let payload: unknown = null
  try {
    const text = await response.text()
    payload = text ? JSON.parse(text) : null
  } catch {
    payload = null
  }

  const obj = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : null
  const success = typeof obj?.success === 'boolean' ? (obj.success as boolean) : response.ok
  const message = typeof obj?.message === 'string' ? obj.message : undefined
  const error = typeof obj?.error === 'string' ? obj.error : (!success ? `HTTP ${response.status}` : undefined)
  const code = typeof obj?.code === 'string' ? obj.code : undefined

  let data: T | undefined
  if (obj) {
    if ('data' in obj) data = obj.data as T
    else if ('success' in obj) data = obj as T
    else if (!('error' in obj || 'message' in obj || 'code' in obj)) data = obj as T
  }

  return { success, message, error, code, data }
}

const orderResponse = async (path: string, body: unknown): Promise<ApiResponse<any>> =>
  requestJSON<any>(`${BASE_URL}${path}`, {
    method: 'POST',
    auth: true,
    body: JSON.stringify(body),
  })

// -- Auth --
export const login = async (username: string, password: string) => {
  const result = await requestJSON<{ token: string }>(`${AUTH_URL}/login`, {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
  const token = result.data && (result.data as any).token
  if (result.success && token) {
    localStorage.setItem('token', token)
    localStorage.setItem('username', username)
    return { success: true, data: { token } } as ApiResponse<{ token: string }>
  }
  return { success: false, error: result.error || result.message || 'Login failed' } as ApiResponse<{ token: string }>
}

export const register = async (username: string, email: string, password: string) => {
  const result = await requestJSON<{ token: string }>(`${AUTH_URL}/register`, {
    method: 'POST',
    body: JSON.stringify({ username, email, password }),
  })
  const token = result.data && (result.data as any).token
  if (result.success && token) {
    localStorage.setItem('token', token)
    localStorage.setItem('username', username)
    return { success: true, data: { token } } as ApiResponse<{ token: string }>
  }
  return { success: false, error: result.error || result.message || 'Registration failed' } as ApiResponse<{ token: string }>
}

export const logout = () => {
  localStorage.removeItem('token')
  localStorage.removeItem('username')
  localStorage.removeItem('oak_capital_chart_interval')
  localStorage.removeItem('oak_capital_secondary_chart_interval')
  localStorage.removeItem('synthbull_chart_interval')
  localStorage.removeItem('synthbull_secondary_chart_interval')
  window.dispatchEvent(new Event('auth-change'))
}

export const requestPasswordReset = async (username: string, email: string) =>
  requestJSON(`${AUTH_URL}/forgot-password`, {
    method: 'POST',
    body: JSON.stringify({ username, email }),
  })

export const submitNewPassword = async (token: string, newPassword: string) =>
  requestJSON(`${AUTH_URL}/reset-password`, {
    method: 'POST',
    body: JSON.stringify({ token, new_password: newPassword }),
  })

// -- Orders --
export const submitMarketOrder = async (symbol: string, side: 'buy' | 'sell', quantity: number) =>
  orderResponse('/order/market', { symbol, side, quantity })
export const submitLimitOrder = async (symbol: string, side: 'buy' | 'sell', quantity: number, limit_price: number) =>
  orderResponse('/order/limit/add', { symbol, side, quantity, limit_price })
export const cancelLimitOrder = async (symbol: string, order_id: number) =>
  orderResponse('/order/limit/cancel', { symbol, order_id })
export const modifyLimitOrder = async (symbol: string, order_id: number, quantity: number, limit_price: number) =>
  orderResponse('/order/limit/modify', { symbol, order_id, quantity, limit_price })
export const submitStopOrder = async (symbol: string, side: 'buy' | 'sell', quantity: number, stop_price: number) =>
  orderResponse('/order/stop/add', { symbol, side, quantity, stop_price })
export const cancelStopOrder = async (symbol: string, order_id: number) =>
  orderResponse('/order/stop/cancel', { symbol, order_id })
export const modifyStopOrder = async (symbol: string, order_id: number, quantity: number, stop_price: number) =>
  orderResponse('/order/stop/modify', { symbol, order_id, quantity, stop_price })
export const submitStopLimitOrder = async (symbol: string, side: 'buy' | 'sell', quantity: number, limit_price: number, stop_price: number) =>
  orderResponse('/order/stop-limit/add', { symbol, side, quantity, limit_price, stop_price })
export const cancelStopLimitOrder = async (symbol: string, order_id: number) =>
  orderResponse('/order/stop-limit/cancel', { symbol, order_id })
export const modifyStopLimitOrder = async (symbol: string, order_id: number, quantity: number, limit_price: number, stop_price: number) =>
  orderResponse('/order/stop-limit/modify', { symbol, order_id, quantity, limit_price, stop_price })
export const listOpenOrders = async () =>
  requestJSON<{ orders: any[] }>(`${BASE_URL}/orders`, { method: 'GET', auth: true })

// -- Market data --
export const getBookDepth = async (symbol: string) =>
  requestJSON<{ symbol: string; bids: Array<{ price: number; quantity: number }>; asks: Array<{ price: number; quantity: number }> }>(
    `${BASE_URL}/book/depth?symbol=${encodeURIComponent(symbol)}`,
  )
export const getBookInfo = async (symbol: string) =>
  requestJSON<{ symbol: string; best_bid: number; best_ask: number; last_executed_price: number }>(
    `${BASE_URL}/book/info?symbol=${encodeURIComponent(symbol)}`,
  )
export const listActiveBooks = async () =>
  requestJSON<{ count: number; symbols: string[] }>(`${BASE_URL}/book/list`)
export const getCandles = async (symbol: string, interval: string, limit = 500): Promise<CandleRaw[]> => {
  const res = await requestJSON<CandleRaw[]>(
    `${BASE_URL}/candles?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&limit=${limit}`,
  )
  return res.success && Array.isArray(res.data) ? res.data : []
}

// -- Portfolio --
export const getPortfolio = async () =>
  requestJSON<any>(`${BASE_URL}/portfolio`, { method: 'GET', auth: true })

export type UserBotPnLRow = {
  id: number
  user_id: string
  bot_id: string
  strategy_name: string
  symbol: string
  mode: string
  pnl: number
  status: string
  updated_at: string
  created_at: string
}

export const getPortfolioBotPnL = async () =>
  requestJSON<UserBotPnLRow[]>(`${BASE_URL}/portfolio/bot-pnl`, { method: 'GET', auth: true })

export type LeaderboardEntry = {
  user_id: string
  username: string
  bot_id: string
  strategy_name: string
  symbol: string
  mode: string
  pnl: number
  status: string
  updated_at: string
  is_public: boolean
  share_strategy: boolean
  owned_by_me: boolean
  ranking_scope: 'weekly' | 'all'
  ranking_metric: 'weekly_pnl'
}

export const getLeaderboard = async (
  includePublic = true,
  scope: 'weekly' | 'all' = 'weekly',
) =>
  requestJSON<LeaderboardEntry[]>(
    `${BASE_URL}/leaderboard?include_public=${includePublic ? 'true' : 'false'}&scope=${scope}`,
    { method: 'GET', auth: true },
  )

export const setLeaderboardPublish = async (
  botID: string,
  isPublic: boolean,
  shareStrategy: boolean,
) =>
  requestJSON(`${BASE_URL}/leaderboard/publish`, {
    method: 'POST',
    auth: true,
    body: JSON.stringify({
      bot_id: botID,
      is_public: isPublic,
      share_strategy: shareStrategy,
    }),
  })

// -- Watchlist --
export const getWatchlist = async () =>
  requestJSON<any[]>(`${BASE_URL}/watchlist`, { method: 'GET', auth: true })
export const addWatchlistSymbol = async (symbol: string) =>
  requestJSON(`${BASE_URL}/watchlist`, { method: 'POST', auth: true, body: JSON.stringify({ symbol }) })
export const removeWatchlistSymbol = async (symbol: string) =>
  requestJSON(`${BASE_URL}/watchlist`, { method: 'DELETE', auth: true, body: JSON.stringify({ symbol }) })

// -- Bots --
export const createBot = async (payload: any) =>
  requestJSON(`${BASE_URL}/bot/start`, { method: 'POST', auth: true, body: JSON.stringify(payload) })
export const stopBot = async (botID: string) =>
  requestJSON(`${BASE_URL}/bot/stop`, { method: 'POST', auth: true, body: JSON.stringify({ bot_id: botID }) })
export const listBots = async () =>
  requestJSON<any[]>(`${BASE_URL}/bots`, { method: 'GET', auth: true })
export const saveBotStrategy = async (name: string, strategy: any) =>
  requestJSON(`${BASE_URL}/bots/strategy`, { method: 'POST', auth: true, body: JSON.stringify({ name, strategy }) })
export const listBotStrategies = async () =>
  requestJSON<SavedStrategySummary[]>(`${BASE_URL}/bots/strategies`, { method: 'GET', auth: true })
export const getBotStrategy = async (name: string) =>
  requestJSON<{ name: string; strategy: any }>(`${BASE_URL}/bots/strategies/${encodeURIComponent(name)}`, { method: 'GET', auth: true })
export const uploadBotScript = async (file: File) => {
  const form = new FormData()
  form.append('script', file)
  return requestJSON<any>(`${BASE_URL}/bots/scripts/upload`, {
    method: 'POST',
    auth: true,
    body: form,
  })
}

// -- Sim bots --
export const startSimBot = async (
  bot_id: string,
  symbol: string,
  strategy: any,
  mode: 'simulation' | 'live' = 'simulation',
  strategy_name?: string,
  eval_interval?: string,
) =>
  requestJSON(`${BASE_URL}/simbot/start`, {
    method: 'POST',
    auth: true,
    body: JSON.stringify({ bot_id, symbol, strategy, mode, strategy_name: strategy_name ?? '', eval_interval: eval_interval ?? '' }),
  })
export const stopSimBot = async (bot_id: string) =>
  requestJSON(`${BASE_URL}/simbot/stop`, { method: 'POST', auth: true, body: JSON.stringify({ bot_id }) })
export const getSimBotStatus = async (bot_id: string) =>
  requestJSON(`${BASE_URL}/simbot/status?bot_id=${encodeURIComponent(bot_id)}`, { method: 'GET', auth: true })
export const listSimBots = async () =>
  requestJSON<{ count: number; bots: any[] }>(`${BASE_URL}/simbot/list`, { method: 'GET', auth: true })
export const FLAGSHIP_STRATEGIES = [
  { name: 'flagship_v2',             label: 'Flagship v2 (EMA 9/21 + RSI)' },
  { name: 'bollinger_mean_reversion', label: 'Bollinger Mean Reversion' },
  { name: 'macd_momentum',            label: 'MACD Momentum' },
  { name: 'rsi_reversal',             label: 'RSI Reversal' },
  { name: 'fast_ema_trend',           label: 'Fast EMA Trend' },
  { name: 'macd_bollinger_breakout',  label: 'MACD + Bollinger Breakout' },
] as const

export type FlagshipStrategyName = typeof FLAGSHIP_STRATEGIES[number]['name']

export const startFlagshipBot = async (
  symbol: string,
  mode: 'simulation' | 'live' = 'simulation',
  bot_id?: string,
  strategy_name?: FlagshipStrategyName,
  eval_interval?: string,
) =>
  requestJSON(`${BASE_URL}/flagship/start`, {
    method: 'POST',
    auth: true,
    body: JSON.stringify({ symbol, mode, bot_id, strategy_name: strategy_name ?? '', eval_interval: eval_interval ?? '' }),
  })

// -- Market simulation admin --
export const listMarketSymbols = async () =>
  requestJSON<{ symbols: string[] }>(`${BASE_URL}/market/symbols`, { method: 'GET', auth: true })
export const getMarketSymbol = async (symbol: string) =>
  requestJSON<any>(`${BASE_URL}/market/symbols/${encodeURIComponent(symbol)}`, { method: 'GET', auth: true })
export const startMarketSymbol = async (symbol: string) =>
  requestJSON(`${BASE_URL}/market/symbols/${encodeURIComponent(symbol)}/start`, { method: 'POST', auth: true })
export const stopMarketSymbol = async (symbol: string) =>
  requestJSON(`${BASE_URL}/market/symbols/${encodeURIComponent(symbol)}/stop`, { method: 'POST', auth: true })
