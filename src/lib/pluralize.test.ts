import { describe, it, expect } from 'vitest'
import { pluralize } from './pluralize'

describe('pluralize', () => {
  it('pluralizes zero', () => {
    expect(pluralize(0, 'application')).toBe('0 applications')
  })
  it('keeps the singular for one', () => {
    expect(pluralize(1, 'application')).toBe('1 application')
  })
  it('pluralizes n > 1', () => {
    expect(pluralize(3, 'application')).toBe('3 applications')
  })
  it('uses a custom plural when given', () => {
    expect(pluralize(2, 'opportunity', 'opportunities')).toBe('2 opportunities')
  })
  it('does not use the custom plural for one', () => {
    expect(pluralize(1, 'opportunity', 'opportunities')).toBe('1 opportunity')
  })
})
