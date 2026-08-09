import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react'

import { login as apiLogin, logout as apiLogout, onUnauthorized, register as apiRegister } from '../services/api'
import { getSession, refreshSessionFromStorage, subscribe, type SessionUser } from '../services/session'
import { millisUntilExpiry } from '../utils/jwt'
import { useToast } from '../components/ui/Toast'

type AuthResult = { success: boolean; error?: string }

type AuthContextValue = {
  user: SessionUser | null
  token: string | null
  isAuthenticated: boolean
  signIn: (username: string, password: string) => Promise<AuthResult>
  signUp: (username: string, email: string, password: string) => Promise<AuthResult>
  signOut: (options?: { silent?: boolean }) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

/** setTimeout clamps above this; re-arm in chunks for long-lived tokens. */
const MAX_TIMEOUT_MS = 2_147_483_647

export function AuthProvider({ children }: { children: ReactNode }) {
  const toast = useToast()
  // The session store is the external source of truth; this keeps React in sync
  // across tabs, API-driven logouts, and expiry — without prop drilling.
  const session = useSyncExternalStore(subscribe, getSession, getSession)

  // A tab left open past midnight must not resume with a dead token.
  useEffect(() => {
    refreshSessionFromStorage()
    const onFocus = () => refreshSessionFromStorage()
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refreshSessionFromStorage()
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  // Proactively expire the session the moment the token lapses, so the user is
  // told why rather than watching every request fail.
  useEffect(() => {
    if (!session.token) return
    const remaining = millisUntilExpiry(session.token)
    if (remaining === null) return
    const delay = Math.min(Math.max(remaining, 0), MAX_TIMEOUT_MS)
    const timer = setTimeout(() => refreshSessionFromStorage(), delay)
    return () => clearTimeout(timer)
  }, [session.token])

  // The API layer clears the session on a 401; we only surface the reason.
  useEffect(
    () =>
      onUnauthorized(() => {
        toast.warning('Session expired', 'Please sign in again to continue trading.')
      }),
    [toast],
  )

  const signIn = useCallback(async (username: string, password: string): Promise<AuthResult> => {
    const res = await apiLogin(username, password)
    return res.success ? { success: true } : { success: false, error: res.error }
  }, [])

  const signUp = useCallback(
    async (username: string, email: string, password: string): Promise<AuthResult> => {
      const res = await apiRegister(username, email, password)
      return res.success ? { success: true } : { success: false, error: res.error }
    },
    [],
  )

  const signOut = useCallback(
    (options?: { silent?: boolean }) => {
      apiLogout()
      if (!options?.silent) toast.success('Signed out', 'You have been securely logged out.')
    },
    [toast],
  )

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session.user,
      token: session.token,
      isAuthenticated: !!session.token,
      signIn,
      signUp,
      signOut,
    }),
    [session, signIn, signUp, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an <AuthProvider>')
  return ctx
}
