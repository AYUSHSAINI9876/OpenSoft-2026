/**
 * Single source of truth for the auth session.
 *
 * Previously the token lived in `localStorage` and was read ad-hoc at render
 * time, so React never re-rendered when it changed and a logout in one tab left
 * other tabs in a stale "logged in" state. Everything now flows through here:
 * writes notify subscribers synchronously, and `storage` events keep tabs in
 * sync. `useSyncExternalStore` in AuthContext consumes this.
 */

import { decodeToken, isTokenValid } from '../utils/jwt'

const TOKEN_KEY = 'token'
const USERNAME_KEY = 'username'

/** Per-user UI preferences that must not leak across accounts on logout. */
const SCOPED_KEYS = [
  'oak_capital_chart_interval',
  'oak_capital_secondary_chart_interval',
  'synthbull_chart_interval',
  'synthbull_secondary_chart_interval',
]

export type SessionUser = {
  id: string
  username: string
  role: string
}

export type Session = {
  token: string | null
  user: SessionUser | null
}

const EMPTY: Session = { token: null, user: null }

const readStorage = (key: string): string | null => {
  try {
    return localStorage.getItem(key)
  } catch {
    // Safari private mode / disabled storage — degrade to in-memory only.
    return null
  }
}

const writeStorage = (key: string, value: string | null) => {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    /* storage unavailable — in-memory session still works for this tab */
  }
}

const buildSession = (token: string | null): Session => {
  if (!isTokenValid(token)) return EMPTY
  const claims = decodeToken(token)
  return {
    token,
    user: {
      id: claims?.user_id ?? '',
      // Fall back to the cached username for tokens minted without the claim.
      username: claims?.username || readStorage(USERNAME_KEY) || 'Trader',
      role: claims?.role || 'HUMAN',
    },
  }
}

let current: Session = buildSession(readStorage(TOKEN_KEY))
const listeners = new Set<() => void>()

const emit = () => {
  for (const listener of listeners) listener()
  // Kept for backwards compatibility with pre-existing listeners.
  window.dispatchEvent(new Event('auth-change'))
}

export const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Stable reference so `useSyncExternalStore` does not loop. */
export const getSession = (): Session => current

export const getToken = (): string | null => current.token

export const setSession = (token: string, username?: string) => {
  writeStorage(TOKEN_KEY, token)
  if (username) writeStorage(USERNAME_KEY, username)
  current = buildSession(token)
  if (!current.token) {
    // Server handed us something unusable — do not pretend we are logged in.
    clearSession()
    return
  }
  emit()
}

export const clearSession = () => {
  writeStorage(TOKEN_KEY, null)
  writeStorage(USERNAME_KEY, null)
  for (const key of SCOPED_KEYS) writeStorage(key, null)
  current = EMPTY
  emit()
}

/**
 * Re-reads storage and drops the session if the token has since expired.
 * Returns true when the session is still valid.
 */
export const refreshSessionFromStorage = (): boolean => {
  const token = readStorage(TOKEN_KEY)
  const next = buildSession(token)
  const changed = next.token !== current.token
  if (token && !next.token) {
    // Token present but expired/corrupt — purge it.
    clearSession()
    return false
  }
  if (changed) {
    current = next
    emit()
  }
  return !!current.token
}

// Cross-tab sync: a login or logout anywhere updates every open tab.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === TOKEN_KEY || event.key === null) refreshSessionFromStorage()
  })
}
