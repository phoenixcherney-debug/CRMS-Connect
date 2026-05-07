import { describe, it, expect, vi, beforeEach } from 'vitest'
import { friendlyError } from './errors'

beforeEach(() => {
  // Silence the console.error in tests — we just want to assert the return.
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('friendlyError', () => {
  it('maps Postgres NOT NULL (23502) to a "required fields" message', () => {
    expect(friendlyError({ code: '23502', message: 'null value in column "company"' }))
      .toMatch(/required fields/i)
    expect(friendlyError({ message: 'null value in column "x"' }))
      .toMatch(/required fields/i)
  })

  it('maps Postgres UNIQUE (23505) to "already exists"', () => {
    expect(friendlyError({ code: '23505', message: 'duplicate key value violates unique constraint "..."' }))
      .toMatch(/already exists/i)
  })

  it('maps Postgres FK (23503) to a friendly link error', () => {
    expect(friendlyError({ code: '23503', message: 'insert or update on table "x" violates foreign key constraint' }))
      .toMatch(/refresh|account/i)
  })

  it('maps CHECK constraint (23514) to "invalid value"', () => {
    expect(friendlyError({ code: '23514', message: 'new row violates check constraint' }))
      .toMatch(/invalid/i)
  })

  it('hides "column does not exist" (42703) behind a generic message', () => {
    const out = friendlyError({ message: 'column "applicant_count" does not exist' })
    expect(out).toMatch(/something went wrong/i)
    expect(out).not.toMatch(/column/i)
    expect(out).not.toMatch(/applicant_count/)
  })

  it('maps RLS errors to "permission"', () => {
    expect(friendlyError({ message: 'new row violates row-level security policy for table "x"' }))
      .toMatch(/permission/i)
    expect(friendlyError({ message: 'permission denied for table x' }))
      .toMatch(/permission/i)
  })

  it('maps "already registered" auth error', () => {
    expect(friendlyError({ message: 'User already registered' }))
      .toMatch(/already exists/i)
  })

  it('maps "Invalid login credentials" auth error', () => {
    expect(friendlyError({ message: 'Invalid login credentials' }))
      .toMatch(/incorrect/i)
  })

  it('maps offline / fetch errors', () => {
    expect(friendlyError({ message: 'Failed to fetch' }))
      .toMatch(/connection|reach/i)
    expect(friendlyError({ message: 'NetworkError when attempting to fetch resource' }))
      .toMatch(/connection|reach/i)
  })

  it('maps timeouts', () => {
    expect(friendlyError({ message: 'Request timed out' }))
      .toMatch(/timed out|connection/i)
  })

  it('falls back when given falsy input', () => {
    expect(friendlyError(null)).toMatch(/something went wrong/i)
    expect(friendlyError(undefined)).toMatch(/something went wrong/i)
  })

  it('hides any message containing a quoted SQL identifier', () => {
    // We never want to leak `"some_column"` to the user.
    const out = friendlyError({ message: 'failed to insert into "jobs" because "company" was empty' })
    expect(out).not.toMatch(/"jobs"|"company"/)
  })

  it('uses the custom fallback when provided', () => {
    expect(friendlyError(null, 'My custom fallback'))
      .toBe('My custom fallback')
  })
})
