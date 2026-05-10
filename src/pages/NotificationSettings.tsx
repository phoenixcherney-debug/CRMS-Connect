import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, Bell } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/ToastProvider'
import Spinner from '../components/Spinner'
import type { PushEvent } from '../lib/sendPush'

interface CategorySpec {
  key: PushEvent
  label: string
  body: string
  rolesShown: ('student' | 'employer_mentor' | 'admin')[]
}

const CATEGORIES: CategorySpec[] = [
  {
    key: 'message',
    label: 'New message',
    body: 'Someone sends you a direct message.',
    rolesShown: ['student', 'employer_mentor', 'admin'],
  },
  {
    key: 'application_in',
    label: 'New applicant',
    body: 'A student applies to one of your opportunities.',
    rolesShown: ['employer_mentor'],
  },
  {
    key: 'application_status',
    label: 'Application status update',
    body: 'An employer changes the status of one of your applications.',
    rolesShown: ['student'],
  },
  {
    key: 'meeting_request',
    label: 'Meeting request',
    body: 'A student requests a meeting through your availability.',
    rolesShown: ['employer_mentor'],
  },
  {
    key: 'student_post_match',
    label: 'New student post in my industry',
    body: 'A student posts what they\'re looking for and the interests overlap your industry tag.',
    rolesShown: ['employer_mentor'],
  },
]

/**
 * P1-12 — push notification preferences. The send-push edge function
 * reads `profiles.notification_preferences` and skips delivery on any
 * category set to false; the default for unknown keys is "send", so a
 * blank settings page == receive everything.
 */
export default function NotificationSettings() {
  const { profile, refreshProfile } = useAuth()
  const toast = useToast()
  const [prefs, setPrefs] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    if (!profile) return
    setPrefs((profile.notification_preferences as Record<string, boolean> | undefined) ?? {})
    setLoading(false)
  }, [profile?.id])

  async function setPref(key: PushEvent, on: boolean) {
    if (!profile) return
    setSaving(key)
    const next = { ...prefs, [key]: on }
    const { error } = await supabase
      .from('profiles')
      .update({ notification_preferences: next })
      .eq('id', profile.id)
    setSaving(null)
    if (error) {
      toast('Could not save preferences. Please try again.', { kind: 'error' })
      return
    }
    setPrefs(next)
    await refreshProfile()
  }

  if (loading || !profile) {
    return <div className="flex justify-center py-20"><Spinner size="lg" /></div>
  }

  const visible = CATEGORIES.filter((c) =>
    c.rolesShown.includes(profile.role as 'student' | 'employer_mentor' | 'admin')
  )

  return (
    <div className="max-w-2xl mx-auto">
      <Link to="/profile" className="inline-flex items-center gap-1.5 text-sm text-ink-secondary hover:text-ink mb-5">
        <ChevronLeft size={16} /> Profile
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink flex items-center gap-2" style={{ fontFamily: 'var(--font-serif)' }}>
          <Bell size={20} className="text-ink-muted" />
          Notification preferences
        </h1>
        <p className="text-sm text-ink-secondary mt-1">
          Per-category push toggles. Switching one off means we won't send a
          push for that event — you'll still see the activity inside the app.
        </p>
      </div>

      <div className="bg-surface rounded-2xl border border-border divide-y divide-border overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
        {visible.map((c) => {
          // Default to "on" when the key isn't yet stored.
          const on = prefs[c.key] !== false
          return (
            <div key={c.key} className="flex items-start gap-4 px-5 py-4">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-ink text-sm">{c.label}</p>
                <p className="text-xs text-ink-muted mt-0.5">{c.body}</p>
              </div>
              <button
                type="button"
                onClick={() => setPref(c.key, !on)}
                disabled={saving === c.key}
                aria-pressed={on}
                aria-label={`${c.label}: ${on ? 'on' : 'off'}`}
                className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors disabled:opacity-50
                  ${on ? 'bg-primary' : 'bg-border-strong'}`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform
                    ${on ? 'translate-x-5' : 'translate-x-0'}`}
                />
              </button>
            </div>
          )
        })}
      </div>

      <p className="text-xs text-ink-muted mt-4">
        Push notifications need to be enabled in your browser too. Check your
        profile for the master push toggle.
      </p>
    </div>
  )
}
