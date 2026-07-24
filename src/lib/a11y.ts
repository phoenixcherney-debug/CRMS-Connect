// Keyboard helpers for ARIA widgets (review Accessibility A11Y-03).

/** The index to select for an APG radio-group keydown with a roving tabindex.
 *  Arrow keys wrap; Home/End jump to the ends. Returns null when the key isn't
 *  a navigation key so the caller leaves the event alone. */
export function nextRovingIndex(key: string, current: number, count: number): number | null {
  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
      return (current + 1) % count
    case 'ArrowLeft':
    case 'ArrowUp':
      return (current - 1 + count) % count
    case 'Home':
      return 0
    case 'End':
      return count - 1
    default:
      return null
  }
}
