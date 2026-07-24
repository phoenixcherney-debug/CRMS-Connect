import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

export function Modal({ open, onClose, title, children }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null)
  // Link the heading as the dialog's accessible name (review A11Y-05).
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  if (!open) return null

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        // Backdrop click: the dialog element itself is the click target.
        if (e.target === ref.current) onClose()
      }}
      className="m-auto w-[min(92vw,28rem)] rounded-xl border border-line bg-card p-0 text-ink shadow-none backdrop:bg-ink/40"
    >
      <div className="p-6">
        <h2 id={titleId} className="text-xl">{title}</h2>
        <div className="mt-4">{children}</div>
      </div>
    </dialog>
  )
}
