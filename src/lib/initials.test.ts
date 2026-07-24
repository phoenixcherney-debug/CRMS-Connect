import { describe, it, expect } from 'vitest'
import { initialsOf } from './initials'

describe('initialsOf', () => {
  it('takes the first + last token, not every token (the "CQ" regression)', () => {
    expect(initialsOf('Claude QA Student')).toBe('CS')
  })
  it('handles a normal two-token name', () => {
    expect(initialsOf('Avery Kim')).toBe('AK')
  })
  it('uses just the first letter of a single-token name', () => {
    expect(initialsOf('Cher')).toBe('C')
  })
  it('uppercases regardless of input case', () => {
    expect(initialsOf('avery kim')).toBe('AK')
  })
  it('returns "?" for null, undefined, or whitespace-only names', () => {
    expect(initialsOf(null)).toBe('?')
    expect(initialsOf(undefined)).toBe('?')
    expect(initialsOf('   ')).toBe('?')
    expect(initialsOf('')).toBe('?')
  })
})
