import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { CheckCircle2, AlertCircle, X } from 'lucide-react'

/**
 * Tiny in-app toast system. One provider, one viewport in the corner of
 * the page, accessed via `useToast()`. Audit task 6 — needed a single
 * primitive so success messages stop varying per page.
 *
 * Usage:
 *   const toast = useToast()
 *   toast('Opportunity closed.')                  // info, default 3.5s
 *   toast('Application accepted.', { kind: 'success' })
 *   toast('Could not save.',         { kind: 'error', duration: 6000 })
 */

type ToastKind = 'info' | 'success' | 'error'

interface ToastItem {
  id: number
  message: string
  kind: ToastKind
  duration: number
}

interface ToastOptions {
  kind?: ToastKind
  duration?: number
}

type ToastFn = (message: string, opts?: ToastOptions) => void

const ToastContext = createContext<ToastFn | null>(null)

export function useToast(): ToastFn {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>')
  return ctx
}

let toastIdSeq = 1

export default function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback<ToastFn>((message, opts = {}) => {
    const id = toastIdSeq++
    const item: ToastItem = {
      id,
      message,
      kind: opts.kind ?? 'success',
      duration: opts.duration ?? 3500,
    }
    setItems((prev) => [...prev, item])
  }, [])

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {items.map((t) => (
          <Toast key={t.id} item={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function Toast({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  useEffect(() => {
    const id = window.setTimeout(onDismiss, item.duration)
    return () => window.clearTimeout(id)
  }, [item.duration, onDismiss])

  const Icon = item.kind === 'error' ? AlertCircle : CheckCircle2
  const accent =
    item.kind === 'error'
      ? 'border-status-rejected-border text-error bg-error-bg'
      : item.kind === 'success'
        ? 'border-status-accepted-border text-success bg-success-bg'
        : 'border-border text-ink bg-surface'

  return (
    <div
      role="status"
      className={`pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 shadow-md text-sm ${accent}`}
      style={{ boxShadow: 'var(--shadow-modal)' }}
    >
      <Icon size={16} className="shrink-0 mt-0.5" />
      <p className="flex-1 leading-snug">{item.message}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
      >
        <X size={14} />
      </button>
    </div>
  )
}
