import { describe, it, expect, afterEach, vi } from 'vitest'
import { timeAgo, shortDate, messageTime } from './format'

// Dates are constructed from LOCAL components and round-tripped through
// toISOString(), so the formatted wall-clock output is deterministic regardless
// of the machine's timezone.

afterEach(() => {
  vi.useRealTimers()
})

describe('timeAgo', () => {
  it('renders a strict distance with suffix', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 2, 4, 12, 0))
    expect(timeAgo(new Date(2026, 2, 1, 12, 0).toISOString())).toBe('3 days ago')
  })
})

describe('shortDate', () => {
  it('formats a calendar date', () => {
    const iso = new Date(2026, 2, 4, 14, 15).toISOString()
    expect(shortDate(iso)).toBe('Mar 4, 2026')
  })
})

describe('messageTime', () => {
  it('formats a date + time', () => {
    const iso = new Date(2026, 2, 4, 14, 15).toISOString()
    expect(messageTime(iso)).toBe('Mar 4, 2:15 PM')
  })
})
