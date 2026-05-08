import { describe, it, expect } from 'vitest'
import { validateExternalUrl, safeExternalHref } from './url'

describe('validateExternalUrl', () => {
  it('returns null for empty / nullish input', () => {
    expect(validateExternalUrl('').safe).toBe(null)
    expect(validateExternalUrl('   ').safe).toBe(null)
    expect(validateExternalUrl(null).safe).toBe(null)
    expect(validateExternalUrl(undefined).safe).toBe(null)
  })

  it('accepts http and https URLs', () => {
    expect(validateExternalUrl('https://example.com/me').safe).toBe('https://example.com/me')
    expect(validateExternalUrl('http://example.com').safe).toBe('http://example.com/')
  })

  it('coerces bare hosts to https', () => {
    expect(validateExternalUrl('linkedin.com/in/foo').safe).toBe('https://linkedin.com/in/foo')
  })

  it('rejects script-bearing schemes', () => {
    expect(validateExternalUrl('javascript:alert(1)').safe).toBe(null)
    expect(validateExternalUrl('JAVASCRIPT:alert(1)').safe).toBe(null)
    expect(validateExternalUrl('data:text/html,<script>x</script>').safe).toBe(null)
    expect(validateExternalUrl('vbscript:msgbox').safe).toBe(null)
    expect(validateExternalUrl('file:///etc/passwd').safe).toBe(null)
  })

  it('rejects malformed URLs', () => {
    expect(validateExternalUrl('http://').safe).toBe(null)
  })

  it('safeExternalHref returns just the safe href', () => {
    expect(safeExternalHref('https://example.com')).toBe('https://example.com/')
    expect(safeExternalHref('javascript:alert(1)')).toBe(null)
  })
})
