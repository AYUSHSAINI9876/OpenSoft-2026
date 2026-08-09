import { describe, expect, it } from 'vitest'

import { decodeToken, isTokenExpired, isTokenValid, millisUntilExpiry } from './jwt'

/** Builds an unsigned-but-well-formed HS256-shaped token for testing. */
const makeToken = (payload: Record<string, unknown>): string => {
  const b64 = (obj: unknown) =>
    btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(obj))))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.signature-not-verified-client-side`
}

const nowSec = () => Math.floor(Date.now() / 1000)

describe('decodeToken', () => {
  it('extracts the backend claim shape', () => {
    const token = makeToken({ user_id: 'u-1', username: 'trader', role: 'HUMAN', exp: nowSec() + 3600 })
    expect(decodeToken(token)).toMatchObject({ user_id: 'u-1', username: 'trader', role: 'HUMAN' })
  })

  it('handles multi-byte usernames without mangling them', () => {
    const token = makeToken({ username: 'दीपक', exp: nowSec() + 60 })
    expect(decodeToken(token)?.username).toBe('दीपक')
  })

  it('returns null for malformed input rather than throwing', () => {
    expect(decodeToken(null)).toBeNull()
    expect(decodeToken('')).toBeNull()
    expect(decodeToken('not-a-jwt')).toBeNull()
    expect(decodeToken('only.two')).toBeNull()
    expect(decodeToken('aaa.!!!not-base64!!!.ccc')).toBeNull()
  })
})

describe('isTokenExpired', () => {
  it('accepts a token that is comfortably in the future', () => {
    expect(isTokenExpired(makeToken({ exp: nowSec() + 3600 }))).toBe(false)
  })

  it('rejects a token whose exp has passed', () => {
    expect(isTokenExpired(makeToken({ exp: nowSec() - 1 }))).toBe(true)
  })

  it('rejects a token inside the clock-skew window before real expiry', () => {
    // 10s of life left, 30s default skew → treated as already expired so an
    // in-flight request cannot land after the server-side expiry.
    expect(isTokenExpired(makeToken({ exp: nowSec() + 10 }))).toBe(true)
    expect(isTokenExpired(makeToken({ exp: nowSec() + 10 }), 0)).toBe(false)
  })

  it('treats missing and malformed tokens as expired', () => {
    expect(isTokenExpired(null)).toBe(true)
    expect(isTokenExpired('garbage')).toBe(true)
  })

  it('treats a token without exp as long-lived', () => {
    expect(isTokenExpired(makeToken({ user_id: 'u-1' }))).toBe(false)
  })
})

describe('millisUntilExpiry', () => {
  it('reports remaining lifetime', () => {
    const ms = millisUntilExpiry(makeToken({ exp: nowSec() + 60 }))
    expect(ms).not.toBeNull()
    expect(ms!).toBeGreaterThan(55_000)
    expect(ms!).toBeLessThanOrEqual(60_000)
  })

  it('returns null when there is no exp claim', () => {
    expect(millisUntilExpiry(makeToken({ user_id: 'u-1' }))).toBeNull()
  })
})

describe('isTokenValid', () => {
  it('is true only for a decodable, unexpired token', () => {
    expect(isTokenValid(makeToken({ exp: nowSec() + 3600 }))).toBe(true)
    expect(isTokenValid(makeToken({ exp: nowSec() - 10 }))).toBe(false)
    expect(isTokenValid('nonsense')).toBe(false)
    expect(isTokenValid(null)).toBe(false)
  })
})
