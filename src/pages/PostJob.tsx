import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, AlertCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { JobType, LocationType, OpportunityType } from '../types'
import { JOB_TYPE_LABELS, LOCATION_TYPE_LABELS, INDUSTRY_OPTIONS, EXPECTED_HOURS_OPTIONS, OPPORTUNITY_TYPE_LABELS } from '../types'
import Spinner from '../components/Spinner'

const JOB_TYPES: JobType[] = ['internship', 'part-time', 'full-time', 'volunteer']
const LOCATION_TYPES: LocationType[] = ['remote', 'in-person', 'hybrid']

const OPPORTUNITY_TYPES: OpportunityType[] = ['job_internship', 'mentorship', 'volunteer', 'shadow', 'other']

interface JobForm {
  title: string
  company: string
  location: string
  location_type: LocationType
  industry: string
  job_type: JobType
  opportunity_type: OpportunityType | ''
  opportunity_type_other: string
  description: string
  deadline: string
  start_date: string
  end_date: string
  expected_weekly_hours: string
}

const DEFAULT_FORM: JobForm = {
  title: '',
  company: '',
  location: '',
  location_type: 'in-person',
  industry: '',
  job_type: 'internship',
  opportunity_type: '',
  opportunity_type_other: '',
  description: '',
  deadline: '',
  start_date: '',
  end_date: '',
  expected_weekly_hours: '',
}

export default function PostJob() {
  const { id } = useParams<{ id?: string }>()
  const isEdit = !!id
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState<JobForm>(DEFAULT_FORM)
  const [loading, setLoading] = useState(isEdit)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load existing job for editing
  useEffect(() => {
    if (!isEdit) return
    async function load() {
      const { data } = await supabase.from('jobs').select('*').eq('id', id!).single()
      if (data) {
        setForm({
          title: data.title,
          company: data.company,
          location: data.location,
          location_type: data.location_type ?? 'in-person',
          industry: data.industry ?? '',
          job_type: data.job_type,
          opportunity_type: data.opportunity_type ?? '',
          opportunity_type_other: data.opportunity_type_other ?? '',
          description: data.description,
          deadline: data.deadline ?? '',
          start_date: data.start_date ?? '',
          end_date: data.end_date ?? '',
          expected_weekly_hours: data.expected_weekly_hours ?? '',
        })
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
    if (!profile) return
    setError(null)
    setSubmitting(true)

    const payload = {
      ...form,
      industry: form.industry || null,
      deadline: form.deadline || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      expected_weekly_hours: form.expected_weekly_hours || null,
      opportunity_type: form.opportunity_type || null,
      opportunity_type_other: form.opportunity_type === 'other' ? form.opportunity_type_other || null : null,
      how_to_apply: '',
      contact_email: '',
      posted_by: profile.id,
      is_active: true,
    }

    let error
    if (isEdit) {
      // Use the same payload structure but exclude posted_by (can't change poster)
      const { posted_by: _, ...updatePayload } = payload
      const { error: e } = await supabase.from('jobs').update(updatePayload).eq('id', id!)
      error = e
    } else {
      const { error: e } = await supabase.from('jobs').insert(payload)
      error = e
    }

    setSubmitting(false)
    if (error) {
      setError(error.message)
      return
    }

    navigate(isEdit ? `/jobs/${id}` : '/my-postings')
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
        to={isEdit ? `/jobs/${id}` : '/my-postings'}
        className="inline-flex items-center gap-1.5 text-sm text-ink-secondary hover:text-ink mb-6"
      >
        <ChevronLeft size={16} />
        {isEdit ? 'Back to opportunity' : 'My postings'}
      </Link>

      <div className="bg-surface rounded-2xl border border-border p-6 sm:p-8" style={{ boxShadow: 'var(--shadow-card)' }}>
        <h1 className="text-xl font-bold text-ink mb-1" style={{ fontFamily: 'var(--font-serif)' }}>
          {isEdit ? 'Edit opportunity' : 'Post an opportunity'}
        </h1>
        <p className="text-sm text-ink-secondary mb-6">
          Opportunities you share are visible to all CRMS students.
        </p>

        {error && (
          <div className="mb-5 flex items-start gap-2.5 rounded-lg bg-error-bg border border-status-rejected-border px-4 py-3">
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

          {/* Opportunity type */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">
                Opportunity type{' '}
                <span className="text-ink-muted font-normal">(optional)</span>
              </label>
              <select
                value={form.opportunity_type}
                onChange={(e) => set('opportunity_type', e.target.value as OpportunityType | '')}
                className="field"
              >
                <option value="">Select type…</option>
                {OPPORTUNITY_TYPES.map((t) => (
                  <option key={t} value={t}>{OPPORTUNITY_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            {form.opportunity_type === 'other' && (
              <div>
                <label className="block text-sm font-medium text-ink mb-1.5">
                  Please describe <span className="text-error">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.opportunity_type_other}
                  onChange={(e) => set('opportunity_type_other', e.target.value)}
                  placeholder="Describe the opportunity type"
                  className="field"
                />
              </div>
            )}
          </div>

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

          {/* Expected weekly hours */}
          <div className="sm:max-w-[calc(50%-0.5rem)]">
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

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">
              Description <span className="text-error">*</span>
            </label>
            <textarea
              required
              rows={5}
              maxLength={5000}
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Describe the role, responsibilities, and what students will learn…"
              className="field resize-none"
            />
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
                onChange={(e) => set('start_date', e.target.value)}
                className="field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">
                End date{' '}
                <span className="text-ink-muted font-normal">(optional)</span>
              </label>
              <input
                type="date"
                value={form.end_date}
                onChange={(e) => set('end_date', e.target.value)}
                min={form.start_date || undefined}
                className="field"
              />
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
              onChange={(e) => set('deadline', e.target.value)}
              min={isEdit ? undefined : new Date().toISOString().split('T')[0]}
              className="field"
            />
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-2">
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
            <Link
              to={isEdit ? `/jobs/${id}` : '/my-postings'}
              className="px-5 py-2.5 rounded-lg border border-border text-sm text-ink-secondary
                hover:bg-primary-faint transition-colors"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>

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
