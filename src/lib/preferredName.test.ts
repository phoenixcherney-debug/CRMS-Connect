import { describe, it, expect } from 'vitest'
import { firstNameOf, displayNameOf } from './preferredName'

describe('firstNameOf', () => {
  it('uses preferred_name when set', () => {
    expect(firstNameOf({ full_name: 'Mary Catherine Smith-Johnson', preferred_name: 'Mary' })).toBe('Mary')
  })
  it('falls back to first token of full_name', () => {
    expect(firstNameOf({ full_name: 'Mary Catherine Smith-Johnson' })).toBe('Mary')
  })
  it('strips stray surrounding quotes', () => {
    expect(firstNameOf({ full_name: "'Mary Catherine Smith-Johnson'" })).toBe('Mary')
    expect(firstNameOf({ preferred_name: '"Mary"' })).toBe('Mary')
  })
  it('returns empty string for empty input', () => {
    expect(firstNameOf({})).toBe('')
    expect(firstNameOf(null)).toBe('')
  })
})

describe('displayNameOf', () => {
  it('returns full_name trimmed', () => {
    expect(displayNameOf({ full_name: '  Mary Catherine Smith ' })).toBe('Mary Catherine Smith')
  })
  it('handles missing input', () => {
    expect(displayNameOf(null)).toBe('')
  })
})
