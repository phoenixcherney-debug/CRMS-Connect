import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, AlertCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../components/ToastProvider'
import { useUnsavedChangesGuard } from '../hooks/useUnsavedChangesGuard'
import type { JobType, LocationType } from '../types'
import { JOB_TYPE_LABELS, LOCATION_TYPE_LABELS, INDUSTRY_OPTIONS, EXPECTED_HOURS_OPTIONS } from '../types'
import Spinner from '../components/Spinner'
import { friendlyError } from '../lib/errors'

const JOB_TYPES: JobType[] = ['internship', 'part-time', 'full-time', 'volunteer', 'mentorship', 'shadow', 'other']
const LOCATION_TYPES: LocationType[] = ['remote', 'in-person', 'hybrid']

interface JobForm {
  title: string
  company: string
  location: string
  location_type: LocationType
  industry: string
  job_type: JobType
  description: string
  how_to_apply: string
  contact_email: string
  deadline: string
  start_date: string
  end_date: string
  expected_weekly_hours: string
  compensation: string
}

const DEFAULT_FORM: JobForm = {
  title: '',
  company: '',
  location: '',
  location_type: 'in-person',
  industry: '',
  job_type: 'internship',
  description: '',
  how_to_apply: '',
  contact_email: '',
  deadline: '',
  start_date: '',
  end_date: '',
  expected_weekly_hours: '',
  compensation: '',
}

const SAVE_FAIL_MSG = 'Could not save the opportunity. Please try again.'

export default function PostJob() {
  const { id } = useParams<{ id?: string }>()
  const isEdit = !!id
  const { profile } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()

  const [form, setForm] = useState<JobForm>(DEFAULT_FORM)
  const [loading, setLoading] = useState(isEdit)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // S3.3 — snapshot of the form as it was loaded (or default for create).
  // Used to detect unsaved changes for the beforeunload guard + Cancel.
  const initialFormRef = useRef<JobForm>(DEFAULT_FORM)
  const [savedJustNow, setSavedJustNow] = useState(false)
  const dirty = !savedJustNow && JSON.stringify(form) !== JSON.stringify(initialFormRef.current)
  useUnsavedChangesGuard(dirty)
  const [showPreview, setShowPreview] = useState(false)
  // Per-field errors so the user sees feedback at the field, not only in the
  // banner at the top of a long form (audit HIGH-5: silent submit on bad dates).
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  // Load existing job for editing
  useEffect(() => {
    if (!isEdit) return
    async function load() {
      const { data } = await supabase.from('jobs').select('*').eq('id', id!).single()
      if (data) {
        const next: JobForm = {
          title: data.title,
          company: data.company,
          location: data.location,
          location_type: data.location_type ?? 'in-person',
          industry: data.industry ?? '',
          job_type: data.job_type,
          description: data.description,
          how_to_apply: data.how_to_apply ?? '',
          contact_email: data.contact_email ?? '',
          deadline: data.deadline ?? '',
          start_date: data.start_date ?? '',
          end_date: data.end_date ?? '',
          expected_weekly_hours: data.expected_weekly_hours ?? '',
          compensation: data.compensation ?? '',
        }
        setForm(next)
        initialFormRef.current = next
      }
      setLoading(false)
    }
    load()
  }, [id, isEdit])

  function set<K extends keyof JobForm>(key: K, value: JobForm[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!profile || submitting) return
    setError(null)
    setFieldErrors({})

    // Trim and validate required fields up front. The browser's `required`
    // attribute catches empty strings but not whitespace-only — strip first
    // so " " is treated the same as "".
    const trim = (s: string) => s.trim()
    const title = trim(form.title)
    const company = trim(form.company)
    // P2-22 — title-case the location on save so the listings stop looking
    // like a grab-bag ("denver, co", "Carbondale, CO", "remote", "Aspen,
    // co"). A full autocomplete + state-code field is the right answer
    // long-term but this is the minimum viable normalization.
    const location = trim(form.location).replace(/\b\w/g, (c) => c.toUpperCase())
    const description = trim(form.description)
    if (!title || !company || !location || !description) {
      setError('Please fill in all required fields (title, company, location, and description).')
      return
    }

    // Date validation. Past-deadline guard only applies on create — editing
    // an already-past posting shouldn't refuse to save unrelated edits.
    const todayIso = new Date().toISOString().split('T')[0]
    const fe: Record<string, string> = {}
    if (form.end_date && form.start_date && form.end_date < form.start_date) {
      fe.end_date = 'End date must be on or after the start date.'
    }
    if (!isEdit && form.deadline && form.deadline < todayIso) {
      fe.deadline = 'Application deadline must be today or later.'
    }
    if (!isEdit && form.start_date && form.start_date < todayIso) {
      fe.start_date = 'Start date must be today or later.'
    }
    // S3.2 — deadline can't be after the role's end date.
    if (form.deadline && form.end_date && form.deadline > form.end_date) {
      fe.deadline = 'Deadline must be on or before the role\'s end date.'
    }
    // Audit task 5 — contact email is optional, but when present it must
    // be a valid address. Browser-native validity check is enough; the
    // form has noValidate so we re-implement the check here.
    const emailValue = form.contact_email.trim()
    if (emailValue && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) {
      fe.contact_email = 'Enter a valid email address (e.g. hiring@example.com).'
    }
    if (Object.keys(fe).length > 0) {
      setFieldErrors(fe)
      setError('Please fix the highlighted fields and try again.')
      // Scroll the form's error banner into view so the user sees feedback
      // even if their viewport was at the bottom of a long form.
      requestAnimationFrame(() => {
        document.getElementById('post-job-error-banner')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
      return
    }

    setSubmitting(true)

    // Always send `how_to_apply` and `contact_email` as strings — the live DB
    // currently has these as NOT NULL until migration 023 is applied. Empty
    // string is accepted by the existing schema and is what the previous code
    // wrote, so this works whether or not the migration has been run yet.
    const payload = {
      title,
      company,
      location,
      location_type: form.location_type,
      industry: form.industry || null,
      job_type: form.job_type,
      description,
      how_to_apply: trim(form.how_to_apply),
      contact_email: trim(form.contact_email),
      deadline: form.deadline || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      expected_weekly_hours: form.expected_weekly_hours || null,
      compensation: form.compensation.trim() || null,
      // opportunity_type is no longer collected (consolidated with job_type),
      // but kept nullable in the schema so legacy rows still display.
      opportunity_type: null,
      opportunity_type_other: null,
      posted_by: profile.id,
      is_active: true,
    }

    // Hard 20s timeout so the button never sits at "Publishing…" forever
    // when the network blips or the Supabase project is paused.
    const TIMEOUT_MS = 20000
    const timeout = new Promise<{ error: Error }>((_, reject) => {
      setTimeout(() => reject(new Error('Request timed out. Please try again.')), TIMEOUT_MS)
    })

    try {
      let result: { error: { message: string } | null }
      if (isEdit) {
        const { posted_by: _omit, ...updatePayload } = payload
        result = await Promise.race([
          supabase.from('jobs').update(updatePayload).eq('id', id!),
          timeout,
        ]) as typeof result
      } else {
        result = await Promise.race([
          supabase.from('jobs').insert(payload),
          timeout,
        ]) as typeof result
      }

      if (result.error) {
        setError(friendlyError(result.error, SAVE_FAIL_MSG))
        return
      }

      // S3.3 — flag clean before navigating so the beforeunload guard
      // doesn't fire on the post-save redirect.
      setSavedJustNow(true)
      toast(isEdit ? 'Saved.' : 'Opportunity published.')
      // P1-8 — nudge employers to fill in the most-filtered fields. Toast
      // only on the create path; for edits the user already saw the form.
      if (!isEdit) {
        const missing: string[] = []
        if (!form.industry) missing.push('an industry')
        if (!form.compensation.trim()) missing.push('compensation')
        if (missing.length > 0) {
          setTimeout(() => {
            toast(
              `Tip: posts with ${missing.join(' and ')} listed get more applications.`,
            )
          }, 600)
        }
      }
      navigate(isEdit ? `/opportunities/${id}` : '/my-opportunities')
    } catch (err) {
      setError(friendlyError(err, SAVE_FAIL_MSG))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Link
        to={isEdit ? `/opportunities/${id}` : '/my-opportunities'}
        className="inline-flex items-center gap-1.5 text-sm text-ink-secondary hover:text-ink mb-6"
      >
        <ChevronLeft size={16} />
        {isEdit ? 'Back to opportunity' : 'My Opportunities'}
      </Link>

      <div className="bg-surface rounded-2xl border border-border p-6 sm:p-8" style={{ boxShadow: 'var(--shadow-card)' }}>
        <h1 className="text-xl font-bold text-ink mb-1" style={{ fontFamily: 'var(--font-serif)' }}>
          {isEdit ? 'Edit opportunity' : 'Post an opportunity'}
        </h1>
        <p className="text-sm text-ink-secondary mb-6">
          Opportunities you share are visible to all CRMS students.
        </p>

        {error && (
          <div id="post-job-error-banner" className="mb-5 flex items-start gap-2.5 rounded-lg bg-error-bg border border-status-rejected-border px-4 py-3">
            <AlertCircle size={15} className="text-error shrink-0 mt-0.5" />
            <p className="text-sm text-error">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          {/* Row: Title + Job type */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">
                Title <span className="text-error">*</span>
              </label>
              <input
                type="text"
                required
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
                placeholder="Software Engineering Intern"
                className="field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">
                Category <span className="text-error">*</span>
              </label>
              <select
                required
                value={form.job_type}
                onChange={(e) => set('job_type', e.target.value as JobType)}
                className="field"
              >
                {JOB_TYPES.map((t) => (
                  <option key={t} value={t}>{JOB_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Opportunity type field removed: Category above is now the single
              source of truth for what this opportunity is. The opportunity_type
              column still exists in the schema for backward compatibility. */}

          {/* Row: Company + Location */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">
                Company / Organization <span className="text-error">*</span>
              </label>
              <input
                type="text"
                required
                value={form.company}
                onChange={(e) => set('company', e.target.value)}
                placeholder="Acme Corp"
                className="field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">
                Location <span className="text-error">*</span>
              </label>
              <input
                type="text"
                required
                value={form.location}
                onChange={(e) => set('location', e.target.value)}
                placeholder="Denver, CO or Remote"
                className="field"
              />
            </div>
          </div>

          {/* Row: Location Type + Industry */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">
                Location type <span className="text-error">*</span>
              </label>
              <select
                required
                value={form.location_type}
                onChange={(e) => set('location_type', e.target.value as LocationType)}
                className="field"
              >
                {LOCATION_TYPES.map((t) => (
                  <option key={t} value={t}>{LOCATION_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">
                Industry{' '}
                <span className="text-ink-muted font-normal">(optional)</span>
              </label>
              <select
                value={form.industry}
                onChange={(e) => set('industry', e.target.value)}
                className="field"
              >
                <option value="">Select an industry…</option>
                {INDUSTRY_OPTIONS.map((ind) => (
                  <option key={ind} value={ind}>{ind}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row: Expected weekly hours + Compensation (P2-36). */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">
                Expected weekly hours{' '}
                <span className="text-ink-muted font-normal">(optional)</span>
              </label>
              <select
                value={form.expected_weekly_hours}
                onChange={(e) => set('expected_weekly_hours', e.target.value)}
                className="field"
              >
                <option value="">Select expected hours…</option>
                {EXPECTED_HOURS_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">
                Compensation{' '}
                <span className="text-ink-muted font-normal">(optional)</span>
              </label>
              <input
                type="text"
                maxLength={200}
                value={form.compensation}
                onChange={(e) => set('compensation', e.target.value)}
                placeholder="e.g. $22/hr"
                className="field"
              />
              {/* L-04 — examples were getting truncated mid-word ("Stiper...")
                  in the placeholder; moved them to help text below. */}
              <p className="text-xs text-ink-muted mt-1">
                Examples: $22/hr · Unpaid (school credit) · Stipend $1,500.
              </p>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">
              Description <span className="text-error">*</span>
            </label>
            <textarea
              required
              rows={5}
              maxLength={4000}
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Describe the role, responsibilities, and what students will learn…"
              className="field resize-none"
            />
          </div>

          {/* How to apply */}
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">
              How to apply{' '}
              <span className="text-ink-muted font-normal">(optional)</span>
            </label>
            <textarea
              rows={3}
              maxLength={2000}
              value={form.how_to_apply}
              onChange={(e) => set('how_to_apply', e.target.value)}
              placeholder="Tell applicants how to apply — e.g. send a resume to careers@example.com, or apply through the form below."
              className="field resize-none"
            />
            <p className="mt-1 text-xs text-ink-muted">
              Leave blank to use the in-app application form.
            </p>
          </div>

          {/* Contact email — optional, only shown to accepted applicants */}
          <div>
            <label htmlFor="contact-email" className="block text-sm font-medium text-ink mb-1.5">
              Contact email{' '}
              <span className="text-ink-muted font-normal">(optional)</span>
            </label>
            <input
              id="contact-email"
              type="email"
              maxLength={200}
              value={form.contact_email}
              onChange={(e) => { set('contact_email', e.target.value); if (fieldErrors.contact_email) setFieldErrors((prev) => ({ ...prev, contact_email: '' })) }}
              placeholder="hiring@example.com"
              aria-invalid={!!fieldErrors.contact_email}
              aria-describedby={fieldErrors.contact_email ? 'contact-email-error' : undefined}
              className="field"
            />
            {fieldErrors.contact_email && (
              <p id="contact-email-error" role="alert" className="mt-1 text-xs text-error">
                {fieldErrors.contact_email}
              </p>
            )}
            <p className="mt-1 text-xs text-ink-muted">
              Shared with applicants only after you accept their application.
            </p>
          </div>

          {/* Timeframe: start + end */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">
                Start date{' '}
                <span className="text-ink-muted font-normal">(optional)</span>
              </label>
              <input
                type="date"
                value={form.start_date}
                onChange={(e) => { set('start_date', e.target.value); if (fieldErrors.start_date || fieldErrors.end_date) setFieldErrors({}) }}
                min={isEdit ? undefined : new Date().toISOString().split('T')[0]}
                aria-invalid={!!fieldErrors.start_date}
                aria-describedby={fieldErrors.start_date ? 'start-date-error' : undefined}
                className="field"
              />
              {fieldErrors.start_date && (
                <p id="start-date-error" role="alert" className="mt-1 text-xs text-error">{fieldErrors.start_date}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">
                End date{' '}
                <span className="text-ink-muted font-normal">(optional)</span>
              </label>
              <input
                type="date"
                value={form.end_date}
                onChange={(e) => { set('end_date', e.target.value); if (fieldErrors.end_date) setFieldErrors((prev) => ({ ...prev, end_date: '' })) }}
                min={form.start_date || undefined}
                aria-invalid={!!fieldErrors.end_date}
                aria-describedby={fieldErrors.end_date ? 'end-date-error' : undefined}
                className="field"
              />
              {fieldErrors.end_date && (
                <p id="end-date-error" role="alert" className="mt-1 text-xs text-error">{fieldErrors.end_date}</p>
              )}
            </div>
          </div>

          {/* Application deadline */}
          <div className="sm:max-w-[calc(50%-0.5rem)]">
            <label className="block text-sm font-medium text-ink mb-1.5">
              Application deadline{' '}
              <span className="text-ink-muted font-normal">(optional — leave blank for rolling)</span>
            </label>
            <input
              type="date"
              value={form.deadline}
              onChange={(e) => { set('deadline', e.target.value); if (fieldErrors.deadline) setFieldErrors((prev) => ({ ...prev, deadline: '' })) }}
              min={isEdit ? undefined : new Date().toISOString().split('T')[0]}
              aria-invalid={!!fieldErrors.deadline}
              aria-describedby={fieldErrors.deadline ? 'deadline-error' : undefined}
              className="field"
            />
            {fieldErrors.deadline && (
              <p id="deadline-error" role="alert" className="mt-1 text-xs text-error">{fieldErrors.deadline}</p>
            )}
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-2 flex-wrap">
            <button
              type="submit"
              disabled={submitting}
              className="btn-gold px-5 py-2.5"
            >
              {submitting && <Spinner size="sm" className="border-white/30 border-t-white" />}
              {submitting
                ? isEdit ? 'Saving…' : 'Publishing…'
                : isEdit ? 'Save changes' : 'Publish opportunity'
              }
            </button>
            {/* P2-21 — preview the form values as a student would see them. */}
            <button
              type="button"
              onClick={() => setShowPreview(true)}
              disabled={!form.title.trim() || !form.company.trim()}
              title="See what students will see"
              className="px-5 py-2.5 rounded-lg border border-border text-sm text-ink-secondary
                hover:bg-primary-faint hover:text-ink transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Preview
            </button>
            <Link
              to={isEdit ? `/opportunities/${id}` : '/my-opportunities'}
              onClick={(e) => {
                // S3.3 — block in-app navigation when there are unsaved changes.
                if (dirty && !window.confirm('Discard your changes?')) e.preventDefault()
              }}
              className="px-5 py-2.5 rounded-lg border border-border text-sm text-ink-secondary
                hover:bg-primary-faint transition-colors"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>

      {/* P2-21 — preview modal. Renders the form values in roughly the
          shape the public detail page uses, so the poster can sanity-
          check copy before publish. */}
      {showPreview && (
        <PostPreview
          form={form}
          posterName={profile?.full_name ?? 'You'}
          onClose={() => setShowPreview(false)}
        />
      )}

      {/* Global field styles via <style> injection */}
      <style>{`
        .field {
          width: 100%;
          padding: 0.625rem 0.875rem;
          border-radius: 0.5rem;
          border: 1px solid var(--color-border);
          background: var(--color-surface);
          color: var(--color-ink);
          font-size: 0.875rem;
          font-family: inherit;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .field::placeholder {
          color: var(--color-ink-placeholder);
        }
        .field:focus {
          outline: none;
          border-color: var(--color-primary);
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 20%, transparent);
        }
      `}</style>
    </div>
  )
}

// ─── PostPreview ────────────────────────────────────────────────────────────
// P2-21 — render the in-progress form values inside a modal that mirrors
// the student-facing detail layout. Intentionally a separate component so
// the live form state is the source of truth (re-renders on close/reopen).
function PostPreview({
  form, posterName, onClose,
}: {
  form: JobForm
  posterName: string
  onClose: () => void
}) {
  const typeLabel = JOB_TYPE_LABELS[form.job_type]
  const locationLabel = LOCATION_TYPE_LABELS[form.location_type]
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 py-8 overflow-y-auto">
      <div
        className="bg-surface rounded-2xl border border-border max-w-3xl w-full overflow-hidden"
        style={{ boxShadow: 'var(--shadow-modal)' }}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-primary-faint">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Preview — what students will see</p>
          <button type="button" onClick={onClose} className="text-xs text-ink-secondary hover:text-ink">Close ×</button>
        </div>
        <div className="p-6 sm:p-8">
          <div className="flex flex-wrap gap-2 mb-3">
            <span className="inline-flex items-center px-2 py-1 rounded-md text-xs border bg-surface border-border text-ink-secondary">
              {typeLabel}
            </span>
            {form.location_type && (
              <span className="inline-flex items-center px-2 py-1 rounded-md text-xs border bg-surface border-border text-ink-secondary">
                {locationLabel}
              </span>
            )}
            {form.industry && (
              <span className="inline-flex items-center px-2 py-1 rounded-md text-xs border bg-surface border-border text-ink-secondary">
                {form.industry}
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold text-ink" style={{ fontFamily: 'var(--font-serif)' }}>
            {form.title || <span className="text-ink-muted italic">(title pending)</span>}
          </h1>
          <p className="text-ink-secondary mt-1">
            {form.company || <span className="text-ink-muted italic">(company pending)</span>}
            {form.location ? <> · {form.location}</> : null}
          </p>
          <p className="text-xs text-ink-muted mt-1">Posted by {posterName}</p>

          <div className="mt-6 grid sm:grid-cols-2 gap-3 text-sm">
            {form.compensation && (
              <div className="p-3 rounded-lg bg-primary-faint border border-border">
                <p className="text-xs text-ink-muted mb-0.5">Compensation</p>
                <p className="text-ink">{form.compensation}</p>
              </div>
            )}
            {form.expected_weekly_hours && (
              <div className="p-3 rounded-lg bg-primary-faint border border-border">
                <p className="text-xs text-ink-muted mb-0.5">Expected hours</p>
                <p className="text-ink">{form.expected_weekly_hours}</p>
              </div>
            )}
            {(form.start_date || form.end_date) && (
              <div className="p-3 rounded-lg bg-primary-faint border border-border">
                <p className="text-xs text-ink-muted mb-0.5">Dates</p>
                <p className="text-ink">{form.start_date || '?'}{(form.start_date || form.end_date) ? ' – ' : ''}{form.end_date || '?'}</p>
              </div>
            )}
            {form.deadline && (
              <div className="p-3 rounded-lg bg-primary-faint border border-border">
                <p className="text-xs text-ink-muted mb-0.5">Apply by</p>
                <p className="text-ink">{form.deadline}</p>
              </div>
            )}
          </div>

          <div className="mt-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted mb-2">About this opportunity</p>
            <p className="text-sm text-ink whitespace-pre-wrap leading-relaxed">
              {form.description || <span className="text-ink-muted italic">(description pending)</span>}
            </p>
          </div>

          {form.how_to_apply && (
            <div className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted mb-2">How to apply</p>
              <p className="text-sm text-ink whitespace-pre-wrap leading-relaxed">{form.how_to_apply}</p>
            </div>
          )}
        </div>
        <div className="px-5 py-3 border-t border-border flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-border text-sm text-ink-secondary hover:bg-primary-faint">
            Back to edit
          </button>
        </div>
      </div>
    </div>
  )
}
