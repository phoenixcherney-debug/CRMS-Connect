import { describe, it, expect } from 'vitest'
import { sanitizeUserText } from './sanitize'

describe('sanitizeUserText', () => {
  it('passes plain prose through unchanged', () => {
    const out = sanitizeUserText('Looking for a marketing internship near Aspen.')
    expect(out.rejected).toBe(false)
    expect(out.clean).toBe('Looking for a marketing internship near Aspen.')
  })

  it('strips angle-bracket tags', () => {
    const out = sanitizeUserText('Hi <script>alert(1)</script> and <b>bold</b>!')
    expect(out.rejected).toBe(false)
    expect(out.clean).toBe('Hi alert(1) and bold!')
  })

  it('handles malformed tags', () => {
    const out = sanitizeUserText('text < not-a-tag > continues <also bogus> end')
    expect(out.rejected).toBe(false)
    expect(out.clean).toBe('text  continues  end')
  })

  it('rejects SQL DROP via -- comment', () => {
    const out = sanitizeUserText("nothing to see ' -- DROP TABLE students;")
    expect(out.rejected).toBe(true)
    expect(out.reason).toBeTruthy()
  })

  it('rejects ;DELETE pattern', () => {
    const out = sanitizeUserText('whatever; DELETE FROM applications')
    expect(out.rejected).toBe(true)
  })

  it('rejects UNION SELECT', () => {
    const out = sanitizeUserText("foo' UNION SELECT id FROM profiles")
    expect(out.rejected).toBe(true)
  })

  it('treats em-dashes as benign', () => {
    const out = sanitizeUserText('I love internships — especially in summer.')
    expect(out.rejected).toBe(false)
    expect(out.clean).toContain('—')
  })

  it('treats null and empty as empty', () => {
    expect(sanitizeUserText('').clean).toBe('')
    expect(sanitizeUserText(null).clean).toBe('')
    expect(sanitizeUserText(undefined).clean).toBe('')
  })
})
