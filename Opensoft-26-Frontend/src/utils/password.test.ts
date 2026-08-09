import { describe, expect, it } from 'vitest'

import { MIN_PASSWORD_LENGTH, isPasswordAcceptable, scorePassword } from './password'

describe('scorePassword', () => {
  it('scores an empty password as the weakest', () => {
    expect(scorePassword('').score).toBe(0)
  })

  it('rises as each rule is satisfied', () => {
    expect(scorePassword('abcdefgh').score).toBe(1) // length only
    expect(scorePassword('Abcdefgh').score).toBe(2) // + mixed case
    expect(scorePassword('Abcdefg1').score).toBe(3) // + number
    expect(scorePassword('Abcdefg1!').score).toBe(4) // + symbol
  })

  it('does not credit length for a short password', () => {
    // Mixed case + number + symbol but only 6 characters.
    expect(scorePassword('Ab1!cd').score).toBe(3)
  })
})

describe('isPasswordAcceptable', () => {
  it('rejects anything under the minimum length', () => {
    expect(MIN_PASSWORD_LENGTH).toBe(8)
    expect(isPasswordAcceptable('Ab1!cde')).toBe(false)
  })

  it('rejects a long but single-class password', () => {
    expect(isPasswordAcceptable('abcdefghijkl')).toBe(false)
  })

  it('accepts a password of sufficient length and variety', () => {
    expect(isPasswordAcceptable('Abcdefgh')).toBe(true)
    expect(isPasswordAcceptable('trader-2026!')).toBe(true)
  })
})
