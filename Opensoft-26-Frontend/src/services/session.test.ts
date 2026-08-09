import { beforeEach, describe, expect, it, vi } from 'vitest'

const makeToken = (payload: Record<string, unknown>): string => {
  const b64 = (obj: unknown) =>
    btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(obj))))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.sig`
}

const nowSec = () => Math.floor(Date.now() / 1000)
const validToken = () => makeToken({ user_id: 'u-1', username: 'trader', role: 'HUMAN', exp: nowSec() + 3600 })
const expiredToken = () => makeToken({ user_id: 'u-1', username: 'trader', role: 'HUMAN', exp: nowSec() - 60 })

/**
 * The module reads localStorage at import time, so each test re-imports it with
 * a fresh module registry to control the starting state.
 */
const loadSession = async () => {
  vi.resetModules()
  return import('./session')
}

beforeEach(() => {
  localStorage.clear()
})

describe('session bootstrap', () => {
  it('starts empty when no token is stored', async () => {
    const s = await loadSession()
    expect(s.getSession()).toEqual({ token: null, user: null })
    expect(s.getToken()).toBeNull()
  })

  it('hydrates the user from a stored valid token', async () => {
    localStorage.setItem('token', validToken())
    const s = await loadSession()
    expect(s.getSession().user).toEqual({ id: 'u-1', username: 'trader', role: 'HUMAN' })
  })

  it('ignores a stored token that has already expired', async () => {
    localStorage.setItem('token', expiredToken())
    const s = await loadSession()
    expect(s.getToken()).toBeNull()
  })

  it('ignores a corrupt stored token', async () => {
    localStorage.setItem('token', 'not-a-jwt')
    const s = await loadSession()
    expect(s.getToken()).toBeNull()
  })
})

describe('setSession / clearSession', () => {
  it('persists the token and notifies subscribers', async () => {
    const s = await loadSession()
    const listener = vi.fn()
    s.subscribe(listener)

    s.setSession(validToken(), 'trader')

    expect(s.getToken()).not.toBeNull()
    expect(s.getSession().user?.username).toBe('trader')
    expect(localStorage.getItem('token')).not.toBeNull()
    expect(listener).toHaveBeenCalled()
  })

  it('refuses to store an unusable token', async () => {
    const s = await loadSession()
    s.setSession('garbage', 'trader')
    expect(s.getToken()).toBeNull()
    expect(localStorage.getItem('token')).toBeNull()
  })

  it('wipes per-user chart preferences on logout so they cannot leak between accounts', async () => {
    const s = await loadSession()
    s.setSession(validToken(), 'trader')
    localStorage.setItem('oak_capital_chart_interval', '5m')
    localStorage.setItem('synthbull_chart_interval', '1h')

    s.clearSession()

    expect(s.getToken()).toBeNull()
    expect(localStorage.getItem('token')).toBeNull()
    expect(localStorage.getItem('username')).toBeNull()
    expect(localStorage.getItem('oak_capital_chart_interval')).toBeNull()
    expect(localStorage.getItem('synthbull_chart_interval')).toBeNull()
  })

  it('stops notifying after unsubscribe', async () => {
    const s = await loadSession()
    const listener = vi.fn()
    const unsubscribe = s.subscribe(listener)
    unsubscribe()

    s.setSession(validToken(), 'trader')
    expect(listener).not.toHaveBeenCalled()
  })
})

describe('refreshSessionFromStorage', () => {
  it('drops a session whose token expired while the tab was idle', async () => {
    const s = await loadSession()
    s.setSession(validToken(), 'trader')
    expect(s.getToken()).not.toBeNull()

    // Simulate the token ageing out while the tab was in the background.
    localStorage.setItem('token', expiredToken())
    expect(s.refreshSessionFromStorage()).toBe(false)
    expect(s.getToken()).toBeNull()
  })

  it('picks up a token written by another tab', async () => {
    const s = await loadSession()
    expect(s.getToken()).toBeNull()

    localStorage.setItem('token', validToken())
    expect(s.refreshSessionFromStorage()).toBe(true)
    expect(s.getSession().user?.username).toBe('trader')
  })

  it('returns a stable reference when nothing changed, so useSyncExternalStore does not loop', async () => {
    const s = await loadSession()
    s.setSession(validToken(), 'trader')
    const before = s.getSession()
    s.refreshSessionFromStorage()
    expect(s.getSession()).toBe(before)
  })
})
