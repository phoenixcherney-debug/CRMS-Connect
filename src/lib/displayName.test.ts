import { describe, it, expect } from 'vitest'
import { formatDisplayName } from './displayName'

describe('formatDisplayName', () => {
  it('preserves any name with uppercase letters', () => {
    expect(formatDisplayName('Sam Student')).toBe('Sam Student')
    expect(formatDisplayName("Mary-Anne O'Brien")).toBe("Mary-Anne O'Brien")
    expect(formatDisplayName('iOS Joe')).toBe('iOS Joe')
    expect(formatDisplayName('DJ Smith')).toBe('DJ Smith')
  })

  it('title-cases all-lowercase input', () => {
    expect(formatDisplayName('sam student')).toBe('Sam Student')
    expect(formatDisplayName('chill ahh mentor')).toBe('Chill Ahh Mentor')
  })

  it('handles hyphenated tokens', () => {
    expect(formatDisplayName('mary-anne smith')).toBe('Mary-Anne Smith')
  })

  it('trims leading/trailing whitespace', () => {
    expect(formatDisplayName('  alice  ')).toBe('Alice')
  })

  it('treats empty / null / undefined as empty', () => {
    expect(formatDisplayName('')).toBe('')
    expect(formatDisplayName(null)).toBe('')
    expect(formatDisplayName(undefined)).toBe('')
  })
})
