import { useState } from 'react'
import { Flag } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from './ToastProvider'
import ConfirmDialog from './ConfirmDialog'

/**
 * SEC-003 — surface "Report" on profile cards. Inserts a row into
 * \`user_reports\`. The DB's partial unique index prevents the same
 * reporter from filing more than one open report against the same
 * target at a time.
 */
export default function ReportUserButton({ targetId, targetName }: {
  targetId: string
  targetName?: string
}) {
  const { profile } = useAuth()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Don't expose the button if the viewer would be reporting themselves.
  if (!profile || profile.id === targetId) return null

  async function submit() {
    if (!reason.trim() || !profile) return
    setSubmitting(true)
    const { error } = await supabase.from('user_reports').insert({
      reporter_id: profile.id,
      reported_id: targetId,
      reason: reason.trim(),
    })
    setSubmitting(false)
    if (error) {
      // Unique-index violation = duplicate open report.
      if (error.code === '23505') {
        toast('You already have an open report for this person.', { kind: 'info' })
      } else {
        toast('Could not submit the report. Try again later.', { kind: 'error' })
      }
      return
    }
    toast('Report sent. School staff will review.')
    setOpen(false)
    setReason('')
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { setOpen(true); setReason('') }}
        className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-error transition-colors"
        aria-label={targetName ? `Report ${targetName}` : 'Report this user'}
      >
        <Flag size={11} /> Report
      </button>
      <ConfirmDialog
        open={open}
        title={`Report ${targetName ?? 'this user'}?`}
        description="School staff will review the report. We'll only act if a policy is broken; abusive reports are themselves a violation."
        confirmLabel={submitting ? 'Sending…' : 'Send report'}
        confirmDisabled={submitting || !reason.trim()}
        destructive={false}
        onConfirm={submit}
        onCancel={() => { if (!submitting) setOpen(false) }}
      >
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={4}
          maxLength={500}
          placeholder="What's the issue? (display name, message content, profile content, etc.)"
          className="w-full mb-3 px-3.5 py-2.5 rounded-lg border border-border bg-surface text-ink text-sm
            placeholder:text-ink-placeholder resize-none
            focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
        />
      </ConfirmDialog>
    </>
  )
}
