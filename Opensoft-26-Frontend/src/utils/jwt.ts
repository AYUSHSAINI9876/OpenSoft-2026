/**
 * Minimal, dependency-free JWT helpers.
 *
 * The backend signs HS256 tokens with a `Claims` payload of
 * { user_id, username, role, exp, iat }. We never verify the signature client
 * side (only the server can) — we decode purely to know when a session has
 * expired so the UI can log out proactively instead of firing doomed requests.
 */

export type JwtClaims = {
  user_id?: string
  username?: string
  role?: string
  sub?: string
  exp?: number
  iat?: number
}

/** Decodes a base64url segment without relying on Buffer/Node APIs. */
const decodeSegment = (segment: string): string => {
  const padded = segment.replace(/-/g, '+').replace(/_/g, '/')
  const withPadding = padded + '='.repeat((4 - (padded.length % 4)) % 4)
  const binary = atob(withPadding)
  // Handle multi-byte UTF-8 (usernames may be non-ASCII).
  const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

export const decodeToken = (token: string | null | undefined): JwtClaims | null => {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  try {
    const claims = JSON.parse(decodeSegment(parts[1])) as unknown
    if (!claims || typeof claims !== 'object') return null
    return claims as JwtClaims
  } catch {
    return null
  }
}

/**
 * `skewSeconds` treats a token as expired slightly early so an in-flight
 * request cannot land on the server after the real expiry.
 */
export const isTokenExpired = (token: string | null | undefined, skewSeconds = 30): boolean => {
  const claims = decodeToken(token)
  if (!claims) return true
  if (typeof claims.exp !== 'number') return false // no expiry claim → treat as long-lived
  return Date.now() >= (claims.exp - skewSeconds) * 1000
}

/** Milliseconds until expiry, or null when the token has no `exp`. */
export const millisUntilExpiry = (token: string | null | undefined): number | null => {
  const claims = decodeToken(token)
  if (!claims || typeof claims.exp !== 'number') return null
  return claims.exp * 1000 - Date.now()
}

export const isTokenValid = (token: string | null | undefined): boolean =>
  !!token && decodeToken(token) !== null && !isTokenExpired(token)
