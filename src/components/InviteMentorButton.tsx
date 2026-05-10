import { useState } from 'react'
import { Mail, Send, X } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const SIGNUP_URL_BASE = (typeof window !== 'undefined' ? window.location.origin : 'https://crms-connect-sq6y.vercel.app')

/**
 * P2-19 — invite-a-mentor flow. Opens a small modal with an editable
 * mailto template + a referral link. MVP: hand the user's mail client
 * a pre-filled draft. Tracking conversions ("you've invited X, Y joined")
 * is deferred — needs a referrals table the registrar would have to
 * vet first.
 */
export default function InviteMentorButton({ className = '' }: { className?: string }) {
  const { profile } = useAuth()
  const [open, setOpen] = useState(false)
  const inviterName = profile?.full_name?.trim() || 'a CRMS Connect member'
  // Tag the link so a future referral table can attribute by signup query.
  const link = `${SIGNUP_URL_BASE}/signup?ref=${encodeURIComponent(profile?.id ?? '')}`
  const defaultSubject = "You're invited to join CRMS Connect as a mentor"
  const defaultBody = [
    `Hi —`,
    ``,
    `${inviterName} thought you'd be a great mentor for CRMS students.`,
    ``,
    `CRMS Connect is the school's private network for matching students with internships, mentors, and post-grad opportunities. Mentors set their own availability and only see contact details for students they explicitly accept.`,
    ``,
    `If you're interested, sign up here:`,
    link,
    ``,
    `Thanks!`,
  ].join('\n')
  const [subject, setSubject] = useState(defaultSubject)
  const [body, setBody] = useState(defaultBody)

  function send() {
    const url = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    window.open(url, '_blank', 'noopener')
    setOpen(false)
  }

  if (!profile || profile.role !== 'employer_mentor') return null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm text-ink-secondary hover:bg-primary-faint hover:text-ink transition-colors ${className}`}
      >
        <Mail size={14} /> Invite a mentor
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8 overflow-y-auto">
          <div
            className="bg-surface rounded-2xl border border-border max-w-md w-full p-6"
            style={{ boxShadow: 'var(--shadow-modal)' }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-ink">Invite a mentor</h2>
              <button type="button" onClick={() => setOpen(false)} className="text-ink-muted hover:text-ink">
                <X size={16} />
              </button>
            </div>
            <p className="text-xs text-ink-muted mb-4">
              We'll open your email client with a draft. Edit anything before sending.
            </p>
            <label className="block text-xs font-medium text-ink mb-1">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary mb-3"
            />
            <label className="block text-xs font-medium text-ink mb-1">Message</label>
            <textarea
              rows={9}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none mb-4 font-mono"
            />
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-4 py-2 rounded-lg border border-border text-sm text-ink-secondary hover:bg-primary-faint transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={send}
                className="btn-gold px-4 py-2"
              >
                <Send size={13} /> Open email
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
