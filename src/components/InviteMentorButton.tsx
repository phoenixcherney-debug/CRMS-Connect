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
  // Phase 1.3 — link lands on /for-mentors?from=<id> so the recipient
  // sees the inviter's name in a banner before deciding to sign up.
  const link = `${SIGNUP_URL_BASE}/for-mentors?from=${encodeURIComponent(profile?.id ?? '')}`
  const defaultSubject = `${inviterName} invited you to CRMS Connect`
  const defaultBody = [
    `Hi —`,
    ``,
    `${inviterName} thought you'd be a great mentor for CRMS students.`,
    ``,
    `CRMS Connect is the school's private network for matching students with internships, mentors, and post-grad opportunities. Mentors set their own availability and only see contact details for students they explicitly accept.`,
    ``,
    `Have a look:`,
    link,
    ``,
    `Thanks!`,
  ].join('\n')
  const [subject, setSubject] = useState(defaultSubject)
  const [body, setBody] = useState(defaultBody)
  const [copied, setCopied] = useState(false)

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
            <div className="flex flex-wrap gap-2 justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-4 py-2 rounded-lg border border-border text-sm text-ink-secondary hover:bg-primary-faint transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(link)
                    setCopied(true)
                    setTimeout(() => setCopied(false), 1500)
                  } catch {
                    // Fallback: do nothing — open email still works.
                  }
                }}
                className="px-4 py-2 rounded-lg border border-border text-sm text-ink-secondary hover:bg-primary-faint transition-colors"
              >
                {copied ? 'Copied!' : 'Copy link'}
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
