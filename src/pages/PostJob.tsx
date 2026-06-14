import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ChevronLeft, AlertCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { JOB_COLUMNS } from '../lib/jobColumns'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../components/ToastProvider'
import { useUnsavedChangesGuard } from '../hooks/useUnsavedChangesGuard'
import type { Job, JobType, LocationType, CustomQuestion, CustomQuestionType } from '../types'
import { JOB_TYPE_LABELS, LOCATION_TYPE_LABELS, INDUSTRY_OPTIONS, EXPECTED_HOURS_OPTIONS } from '../types'
import Spinner from '../components/Spinner'
import { friendlyError } from '../lib/errors'
import { containsBlockedTerms } from '../lib/textFilter'

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
  /** Phase 3.6 — typed custom questions (≤5). Drafts of blank entries
   *  are filtered out at save time. */
  custom_questions: CustomQuestion[]
}

const MAX_QUESTIONS = 5

function emptyQuestion(): CustomQuestion {
  return { text: '', type: 'short_text', required: true }
}

function normalizeQuestion(q: Partial<CustomQuestion>): CustomQuestion {
  const type: CustomQuestionType =
    q.type === 'long_text' || q.type === 'single_select' || q.type === 'short_text'
      ? q.type
      : 'short_text'
  const out: CustomQuestion = {
    text: typeof q.text === 'string' ? q.text : '',
    type,
    required: typeof q.required === 'boolean' ? q.required : true,
  }
  if (type === 'single_select') {
    out.options = Array.isArray(q.options) ? q.options.map((o) => String(o)) : ['', '']
  }
  return out
}

function readCustomQuestions(row: { custom_questions_v2?: unknown; custom_questions?: unknown }): CustomQuestion[] {
  const v2 = row.custom_questions_v2
  if (Array.isArray(v2) && v2.length > 0) {
    return v2.map((q) => normalizeQuestion(q as Partial<CustomQuestion>))
  }
  const legacy = row.custom_questions
  if (Array.isArray(legacy)) {
    return (legacy as string[])
      .filter((s) => typeof s === 'string' && s.trim())
      .map((text) => ({ text, type: 'short_text' as CustomQuestionType, required: true }))
  }
  return []
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
  custom_questions: [],
}

const SAVE_FAIL_MSG = 'Could not save the opportunity. Please try again.'

export default function PostJob() {
  const { id } = useParams<{ id?: string }>()
  const isEdit = !!id
  const { profile } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  // P1-4 — `?from=<id>` prefills the form from a previous opportunity.
  // Editing a real row still uses the path param; `from` is for create-
  // mode only.
  const [searchParams] = useSearchParams()
  const fromId = !isEdit ? searchParams.get('from') : null

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
      const { data: raw } = await supabase.from('jobs').select(JOB_COLUMNS).eq('id', id!).single()
      const data = raw as unknown as Job | null
      if (data) {
        // contact_email is column-revoked; the poster reads it via the RPC.
        const { data: ce } = await supabase.rpc('job_contact_email', { job_uuid: id })
        const next: JobForm = {
          title: data.title,
          company: data.company,
          location: data.location,
          location_type: data.location_type ?? 'in-person',
          industry: data.industry ?? '',
          job_type: data.job_type,
          description: data.description,
          how_to_apply: data.how_to_apply ?? '',
          contact_email: (ce as string | null) ?? '',
          deadline: data.deadline ?? '',
          start_date: data.start_date ?? '',
          end_date: data.end_date ?? '',
          expected_weekly_hours: data.expected_weekly_hours ?? '',
          compensation: data.compensation ?? '',
          custom_questions: readCustomQuestions(data),
        }
        setForm(next)
        initialFormRef.current = next
      }
      setLoading(false)
    }
    load()
  }, [id, isEdit])

  // P1-4 — prefill from `?from=<id>` for create mode. Date / deadline
  // fields are intentionally left blank (the user almost certainly wants
  // a different cycle).
  useEffect(() => {
    if (!fromId || isEdit) return
    let cancelled = false
    async function prefill() {
      const { data: raw } = await supabase.from('jobs').select(JOB_COLUMNS).eq('id', fromId!).single()
      const data = raw as unknown as Job | null
      if (cancelled || !data) return
      const { data: ce } = await supabase.rpc('job_contact_email', { job_uuid: fromId })
      if (cancelled) return
      const next: JobForm = {
        title: data.title ?? '',
        company: data.company ?? '',
        location: data.location ?? '',
        location_type: data.location_type ?? 'in-person',
        industry: data.industry ?? '',
        job_type: data.job_type,
        description: data.description ?? '',
        how_to_apply: data.how_to_apply ?? '',
        contact_email: (ce as string | null) ?? '',
        deadline: '',
        start_date: '',
        end_date: '',
        expected_weekly_hours: data.expected_weekly_hours ?? '',
        compensation: data.compensation ?? '',
        custom_questions: readCustomQuestions(data),
      }
      setForm(next)
    }
    prefill()
    return () => { cancelled = true }
  }, [fromId, isEdit])

  function set<K extends keyof JobForm>(key: K, value: JobForm[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    await submitForm({ asDraft: false })
  }

  async function submitForm({ asDraft }: { asDraft: boolean }) {
    if (!profile || submitting) return
    setError(null)
    setFieldErrors({})

    const trim = (s: string) => s.trim()
    const title = trim(form.title)
    const company = trim(form.company)
    // P2-22 — title-case the location on save so the listings stop looking
    // like a grab-bag ("denver, co", "Carbondale, CO", "remote", "Aspen,
    // co"). A full autocomplete + state-code field is the right answer
    // long-term but this is the minimum viable normalization.
    const location = trim(form.location).replace(/\b\w/g, (c) => c.toUpperCase())
    const description = trim(form.description)
    // P1-4 — drafts skip required-field validation. Publish still
    // enforces it.
    if (!asDraft && (!title || !company || !location || !description)) {
      setError('Please fill in all required fields (title, company, location, and description).')
      return
    }

    // Date validation runs even on drafts — keeps bad dates from quietly
    // landing in storage and surprising the poster on publish.
    const todayIso = new Date().toISOString().split('T')[0]
    const fe: Record<string, string> = {}
    if (form.end_date && form.start_date && form.end_date < form.start_date) {
      fe.end_date = 'End date must be on or after the start date.'
    }
    if (!isEdit && !asDraft && form.deadline && form.deadline < todayIso) {
      fe.deadline = 'Application deadline must be today or later.'
    }
    if (!isEdit && !asDraft && form.start_date && form.start_date < todayIso) {
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
      requestAnimationFrame(() => {
        document.getElementById('post-job-error-banner')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
      return
    }

    // Task 1 — text filter on title, description, how_to_apply, company.
    for (const [label, value] of [
      ['title',         title] as const,
      ['description',   description] as const,
      ['how_to_apply',  form.how_to_apply.trim()] as const,
      ['company',       company] as const,
      ['compensation',  form.compensation.trim()] as const,
    ]) {
      const term = containsBlockedTerms(value)
      if (term.blocked) {
        setFieldErrors({ [label]: term.reason ?? 'Please revise this text.' })
        setError('Please revise the highlighted text and try again.')
        return
      }
    }

    setSubmitting(true)

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
      // Phase 3.6 — clean the typed-question list before send: drop blanks,
      // trim text, and normalize option arrays. The DB trigger backstops
      // anything we miss here.
      custom_questions_v2: form.custom_questions
        .map((q) => {
          const text = q.text.trim()
          const base: CustomQuestion = { text, type: q.type, required: !!q.required }
          if (q.type === 'single_select') {
            base.options = (q.options ?? [])
              .map((o) => o.trim())
              .filter(Boolean)
          }
          return base
        })
        .filter((q) =>
          q.text.length > 0
          && (q.type !== 'single_select' || (q.options && q.options.length >= 2))
        ),
      // Legacy column kept for one more cycle so older clients still render
      // something during the rollout. Schema migration 069 already backfilled
      // existing rows; we just mirror the question text here.
      custom_questions: form.custom_questions
        .filter((q) => q.text.trim())
        .map((q) => q.text.trim())
        .slice(0, 5),
      // opportunity_type is no longer collected (consolidated with job_type),
      // but kept nullable in the schema so legacy rows still display.
      opportunity_type: null,
      opportunity_type_other: null,
      posted_by: profile.id,
      // P1-4 — drafts stay invisible until the poster publishes.
      is_active: !asDraft,
      is_draft: asDraft,
    }

    // Hard 20s timeout so the button never sits at "Publishing…" forever
    // when the network blips or the Supabase project is paused.
    const TIMEOUT_MS = 20000
    const timeout = new Promise<{ error: Error }>((_, reject) => {
      setTimeout(() => reject(new Error('Request timed out. Please try again.')), TIMEOUT_MS)
    })

    try {
      let result: { data?: { id: string }[] | null; error: { message: string } | null }
      if (isEdit) {
        const { posted_by: _omit, ...updatePayload } = payload
        result = await Promise.race([
          supabase.from('jobs').update(updatePayload).eq('id', id!).select('id'),
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
      // RLS silently matches zero rows when editing a job you don't own — without
      // this guard the UI would falsely report "Saved." and redirect.
      if (isEdit && (!result.data || result.data.length === 0)) {
        setError('You can only edit opportunities you posted.')
        return
      }

      // S3.3 — flag clean before navigating so the beforeunload guard
      // doesn't fire on the post-save redirect.
      setSavedJustNow(true)
      toast(asDraft ? 'Draft saved.' : isEdit ? 'Saved.' : 'Opportunity published.')
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

          {/* Phase 3.6 — typed custom questions (≤5). Each has a type
              (short / long / single-select), a required flag, and (for
              single-select) a 2–8 entry option list. */}
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">
              Custom questions{' '}
              <span className="text-ink-muted font-normal">(optional · max {MAX_QUESTIONS})</span>
            </label>
            <p className="text-xs text-ink-muted mb-2">
              Pick a type, mark it required if it's a deal-breaker, and applicants will see it on the apply form.
            </p>
            <div className="space-y-3">
              {form.custom_questions.map((q, i) => (
                <div key={i} className="p-3 rounded-lg border border-border bg-primary-faint space-y-2">
                  <div className="flex items-start gap-2">
                    <input
                      type="text"
                      maxLength={200}
                      value={q.text}
                      onChange={(e) => {
                        const next = form.custom_questions.slice()
                        next[i] = { ...q, text: e.target.value }
                        set('custom_questions', next)
                      }}
                      placeholder="e.g. What attracted you to this opportunity?"
                      className="field flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        set(
                          'custom_questions',
                          form.custom_questions.filter((_, idx) => idx !== i),
                        )
                      }}
                      className="text-ink-muted hover:text-error p-2"
                      aria-label="Remove question"
                      title="Remove question"
                    >
                      ×
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <label className="flex items-center gap-1.5">
                      <span className="text-ink-muted">Type:</span>
                      <select
                        value={q.type}
                        onChange={(e) => {
                          const newType = e.target.value as CustomQuestionType
                          const next = form.custom_questions.slice()
                          const updated: CustomQuestion = { ...q, type: newType }
                          if (newType === 'single_select' && (!q.options || q.options.length < 2)) {
                            updated.options = ['', '']
                          } else if (newType !== 'single_select') {
                            delete updated.options
                          }
                          next[i] = updated
                          set('custom_questions', next)
                        }}
                        className="px-2 py-1 rounded-md border border-border bg-surface text-ink text-xs"
                      >
                        <option value="short_text">Short text</option>
                        <option value="long_text">Long text</option>
                        <option value="single_select">Single select</option>
                      </select>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={q.required}
                        onChange={(e) => {
                          const next = form.custom_questions.slice()
                          next[i] = { ...q, required: e.target.checked }
                          set('custom_questions', next)
                        }}
                        className="rounded border-border text-primary focus:ring-primary/30"
                      />
                      Required
                    </label>
                  </div>
                  {q.type === 'single_select' && (
                    <div className="space-y-1.5 pl-2 border-l-2 border-border">
                      <p className="text-[11px] text-ink-muted">Options (2–8, ≤80 chars each)</p>
                      {(q.options ?? []).map((opt, oi) => (
                        <div key={oi} className="flex gap-1.5">
                          <input
                            type="text"
                            maxLength={80}
                            value={opt}
                            onChange={(e) => {
                              const next = form.custom_questions.slice()
                              const options = (next[i].options ?? []).slice()
                              options[oi] = e.target.value
                              next[i] = { ...q, options }
                              set('custom_questions', next)
                            }}
                            placeholder={`Option ${oi + 1}`}
                            className="field text-xs flex-1"
                          />
                          {(q.options ?? []).length > 2 && (
                            <button
                              type="button"
                              onClick={() => {
                                const next = form.custom_questions.slice()
                                const options = (next[i].options ?? []).filter((_, idx) => idx !== oi)
                                next[i] = { ...q, options }
                                set('custom_questions', next)
                              }}
                              className="text-ink-muted hover:text-error px-1.5"
                              aria-label="Remove option"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      ))}
                      {(q.options ?? []).length < 8 && (
                        <button
                          type="button"
                          onClick={() => {
                            const next = form.custom_questions.slice()
                            const options = [...(next[i].options ?? []), '']
                            next[i] = { ...q, options }
                            set('custom_questions', next)
                          }}
                          className="text-xs font-medium text-primary hover:text-primary-light"
                        >
                          + Add option
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {form.custom_questions.length < MAX_QUESTIONS && (
              <button
                type="button"
                onClick={() => set('custom_questions', [...form.custom_questions, emptyQuestion()])}
                className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary-light"
              >
                + Add question
              </button>
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
            {/* P1-4 — Save as draft. Skips required-field validation; the
                row goes to /my-opportunities with a "Draft" pill. */}
            <button
              type="button"
              onClick={() => submitForm({ asDraft: true })}
              disabled={submitting}
              className="px-5 py-2.5 rounded-lg border border-border text-sm text-ink-secondary
                hover:bg-primary-faint hover:text-ink transition-colors disabled:opacity-50"
            >
              Save as draft
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
