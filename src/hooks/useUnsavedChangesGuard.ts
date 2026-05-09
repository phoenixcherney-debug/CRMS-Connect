import { useEffect } from 'react'

/**
 * S3.3 — beforeunload guard for forms with unsaved edits.
 *
 * Pass `dirty=true` while the form has unsaved changes; the browser will
 * prompt the user before they close the tab or navigate away.
 *
 * NOTE: this only catches browser-level navigation (close tab, type a URL,
 * back button). For in-app `<Link>` clicks, wrap your Cancel button with
 * `confirm()` directly — react-router doesn't expose a unified hook for
 * navigation guards in v7.
 */
export function useUnsavedChangesGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return
    function handler(e: BeforeUnloadEvent) {
      e.preventDefault()
      // Modern browsers ignore the message string but still show their
      // generic prompt as long as preventDefault is called.
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])
}
