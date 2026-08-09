/**
 * Password policy shared by the signup form and its strength meter.
 *
 * Kept out of the component file so Fast Refresh keeps working (a module that
 * exports both components and constants loses its refresh boundary).
 */

export type PasswordStrength = {
  score: 0 | 1 | 2 | 3 | 4
  label: string
  color: string
}

/** The backend enforces `min=6`; we hold the UI to a stronger bar than that. */
export const MIN_PASSWORD_LENGTH = 8

export const PASSWORD_RULES = [
  {
    id: 'length',
    label: `At least ${MIN_PASSWORD_LENGTH} characters`,
    test: (p: string) => p.length >= MIN_PASSWORD_LENGTH,
  },
  { id: 'case', label: 'Upper and lowercase letters', test: (p: string) => /[a-z]/.test(p) && /[A-Z]/.test(p) },
  { id: 'number', label: 'At least one number', test: (p: string) => /\d/.test(p) },
  { id: 'symbol', label: 'At least one symbol', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
] as const

const STRENGTH: Record<number, PasswordStrength> = {
  0: { score: 0, label: 'Too weak', color: '#FF4560' },
  1: { score: 1, label: 'Weak', color: '#FF4560' },
  2: { score: 2, label: 'Fair', color: '#F5A623' },
  3: { score: 3, label: 'Strong', color: '#4C9AFF' },
  4: { score: 4, label: 'Excellent', color: '#00C076' },
}

export const scorePassword = (password: string): PasswordStrength => {
  if (!password) return STRENGTH[0]
  const passed = PASSWORD_RULES.filter((r) => r.test(password)).length
  return STRENGTH[passed] ?? STRENGTH[0]
}

/** A password is submittable once it clears length + at least one other rule. */
export const isPasswordAcceptable = (password: string): boolean =>
  password.length >= MIN_PASSWORD_LENGTH && scorePassword(password).score >= 2
