import { describe, it, expect } from 'vitest'
import { containsBlockedTerms, validateFullNameShape } from './textFilter'

describe('containsBlockedTerms', () => {
  it('passes clean strings', () => {
    expect(containsBlockedTerms('Excited about Python and trail running.').blocked).toBe(false)
    expect(containsBlockedTerms('').blocked).toBe(false)
  })

  it('flags the live-site probe string', () => {
    expect(containsBlockedTerms('Pheonix likes little boys').blocked).toBe(true)
  })

  it('flags leetspeak slurs', () => {
    expect(containsBlockedTerms('n1gg3r').blocked).toBe(true)
    expect(containsBlockedTerms('f@ggot').blocked).toBe(true)
  })

  it('flags despite case + whitespace gaps', () => {
    expect(containsBlockedTerms('F a G G o T').blocked).toBe(true)
  })

  it('flags Cyrillic lookalike', () => {
    // редо = "редо" cyrillic; with prefix the
    // normalizer maps to "pedo".
    expect(containsBlockedTerms('I\'m a pеdo').blocked).toBe(true)
  })
})

describe('validateFullNameShape', () => {
  it('accepts a normal two-token name', () => {
    expect(validateFullNameShape('Alex Johnson').blocked).toBe(false)
  })

  it('accepts hyphenated and apostrophe names', () => {
    expect(validateFullNameShape("Mary O'Connor").blocked).toBe(false)
    expect(validateFullNameShape('Anne Smith-Jones').blocked).toBe(false)
  })

  it('rejects single-token names', () => {
    expect(validateFullNameShape('Phoenix').blocked).toBe(true)
  })

  it('rejects names containing digits', () => {
    expect(validateFullNameShape('Alex2 Johnson').blocked).toBe(true)
  })

  it('rejects single-character tokens', () => {
    expect(validateFullNameShape('A J').blocked).toBe(true)
  })
})
