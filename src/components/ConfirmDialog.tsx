import { useEffect, useRef } from 'react'
import { AlertTriangle, X } from 'lucide-react'

/**
 * Reusable confirmation dialog. Use this for every destructive action so
 * the look and behavior is consistent across pages. Audit task 6.
 *
 * Pass `open=false` to keep it unmounted (the parent owns the toggle).
 * Closes on Escape and on backdrop click.
 *
 * Example:
 *   <ConfirmDialog
 *     open={confirmDeleteId !== null}
 *     title="Delete this opportunity?"
 *     description="This permanently removes the posting and all its applicants."
 *     confirmLabel="Delete"
 *     destructive
 *     onConfirm={() => handleDelete(confirmDeleteId!)}
 *     onCancel={() => setConfirmDeleteId(null)}
 *   />
 */

interface ConfirmDialogProps {
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  /** Renders the confirm button in red. */
  destructive?: boolean
  /** Disable the confirm button (useful when typing-to-confirm). */
  confirmDisabled?: boolean
  onConfirm: () => void | Promise<void>
  onCancel: () => void
  /** Optional content rendered between description and the buttons. */
  children?: React.ReactNode
}

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  confirmDisabled = false,
  onConfirm,
  onCancel,
  children,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    // Move focus to the cancel button so the safer choice is reachable
    // immediately for keyboard users.
    cancelRef.current?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null

  const confirmClass = destructive
    ? 'flex-1 px-4 py-2.5 rounded-lg bg-error hover:bg-error/90 text-white font-medium text-sm transition-colors disabled:opacity-50'
    : 'flex-1 px-4 py-2.5 rounded-lg bg-primary hover:bg-primary-light text-white font-medium text-sm transition-colors disabled:opacity-50'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={(e) => {
        // Backdrop click cancels — ignore clicks inside the panel.
        if (e.target === e.currentTarget) onCancel()
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby={description ? 'confirm-dialog-desc' : undefined}
    >
      <div
        className="bg-surface rounded-2xl border border-border p-6 max-w-md w-full"
        style={{ boxShadow: 'var(--shadow-modal)' }}
      >
        <div className="flex items-start justify-between mb-4 gap-3">
          <div className="flex items-start gap-3">
            {destructive && <AlertTriangle size={20} className="text-error shrink-0 mt-0.5" />}
            <h2 id="confirm-dialog-title" className="text-base font-semibold text-ink">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close"
            className="w-7 h-7 -mr-2 -mt-1 flex items-center justify-center rounded-lg text-ink-muted hover:text-ink hover:bg-primary-faint transition-colors shrink-0"
          >
            <X size={16} />
          </button>
        </div>
        {description && (
          <p id="confirm-dialog-desc" className="text-sm text-ink-secondary mb-4 leading-relaxed">
            {description}
          </p>
        )}
        {children}
        <div className="flex gap-3 mt-2">
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirmDisabled}
            className={confirmClass}
          >
            {confirmLabel}
          </button>
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm text-ink-secondary hover:bg-primary-faint transition-colors"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
