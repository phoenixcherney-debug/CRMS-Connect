import { useState } from 'react'
import { Flag } from 'lucide-react'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { TextAreaField } from './ui/Field'
import { useToast } from './ui/Toast'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { friendlyError } from '../lib/errors'
import type { ReportTarget } from '../types'

/** "Flag for staff" — files a report only school staff can see. */
export function ReportButton({ target, targetId, label = 'Flag for staff' }: {
  target: ReportTarget
  targetId: string
  label?: string
}) {
  const { user } = useAuth()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!user) return null

  async function submit() {
    if (!user || reason.trim().length < 3) return
    setSubmitting(true)
    const { error } = await supabase.from('reports').insert({
      reporter_id: user.id,
      target,
      target_id: targetId,
      reason: reason.trim(),
    })
    setSubmitting(false)
    if (error) {
      toast(friendlyError(error), 'error')
      return
    }
    setOpen(false)
    setReason('')
    toast('Flagged. CRMS staff will take a look.')
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs text-faint hover:text-danger"
      >
        <Flag className="h-3.5 w-3.5" aria-hidden /> {label}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Flag for staff">
        <p className="text-sm text-faint">
          This goes straight to CRMS staff — not to the person you're flagging.
          Use it for anything that feels off, even if you're not sure.
        </p>
        <div className="mt-4">
          <TextAreaField
            label="What happened?"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            maxLength={500}
            required
          />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="danger" onClick={submit} loading={submitting} disabled={reason.trim().length < 3}>
            Send to staff
          </Button>
        </div>
      </Modal>
    </>
  )
}
