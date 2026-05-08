import { describe, it, expect } from 'vitest'
import { validateDisplayName } from './nameFilter'

describe('validateDisplayName', () => {
  it('accepts ordinary names', () => {
    expect(validateDisplayName('Alice Doe').ok).toBe(true)
    expect(validateDisplayName("Mary-Anne O'Brien").ok).toBe(true)
    expect(validateDisplayName('sam student').ok).toBe(true)
    expect(validateDisplayName('张伟').ok).toBe(true)
  })

  it('rejects empty / over-length', () => {
    expect(validateDisplayName('').ok).toBe(false)
    expect(validateDisplayName('  ').ok).toBe(false)
    expect(validateDisplayName('A').ok).toBe(false)
    expect(validateDisplayName('x'.repeat(120)).ok).toBe(false)
  })

  it('rejects the live test payload', () => {
    expect(validateDisplayName('Pheonix likes little boys').ok).toBe(false)
  })

  it('rejects slurs even with leetspeak / spaces', () => {
    expect(validateDisplayName('John N1gger').ok).toBe(false)
    expect(validateDisplayName('big f@ggot').ok).toBe(false)
    expect(validateDisplayName('R 3 t @ r d guy').ok).toBe(false)
  })

  it('rejects platform impersonation', () => {
    expect(validateDisplayName('CRMS Staff').ok).toBe(false)
    expect(validateDisplayName('Registrar').ok).toBe(false)
    expect(validateDisplayName('Site Admin').ok).toBe(false)
  })

  // Trade-off: the haystack is flattened to alphanumerics-only before
  // matching, so we tolerate over-matching surnames that contain a slur
  // as a substring (e.g. "Sniggers"). A real user blocked this way can
  // email the registrar; the alternative is more reliably letting
  // adversarial l33t-speak through, which is worse.
})
