import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, AlertCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { JobType } from '../types'
import { JOB_TYPE_LABELS } from '../types'
import Spinner from '../components/Spinner'

const JOB_TYPES: JobType[] = ['internship', 'part-time', 'full-time', 'volunteer']

interface JobForm {
  title: string
  company: string
  location: string
  job_type: JobType
  description: string
  how_to_apply: string
  contact_email: string
  deadline: string
  capacity: number
  required_skills: string
}

const DEFAULT_FORM: JobForm = {
  title: '',
  company: '',
  location: '',
  job_type: 'internship',
  description: '',
  how_to_apply: '', // kept for DB compat; not shown in UI
  contact_email: '',
  deadline: '',
  capacity: 1,
  required_skills: '',
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

  // Autofill company from profile when profile loads (handles async case)
  useEffect(() => {
    if (!isEdit && profile?.company) {
      setForm((f) => ({ ...f, company: f.company || profile.company || '' }))
    }
  }, [profile?.company, isEdit])

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
          job_type: data.job_type,
          description: data.description,
          how_to_apply: data.how_to_apply,
          contact_email: data.contact_email,
          deadline: data.deadline,
          capacity: data.capacity ?? 1,
          required_skills: data.required_skills ?? '',
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

    const payload = { ...form, posted_by: profile.id, is_active: true }

    let error
    if (isEdit) {
      const { error: e } = await supabase.from('jobs').update(form).eq('id', id!)
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
        {isEdit ? 'Back to listing' : 'My postings'}
      </Link>

      <div className="bg-surface rounded-2xl border border-border p-6 sm:p-8" style={{ boxShadow: 'var(--shadow-card)' }}>
        <h1 className="text-xl font-bold text-ink mb-1">
          {isEdit ? 'Edit listing' : 'Post an opportunity'}
        </h1>
        <p className="text-sm text-ink-secondary mb-6">
          Opportunities you share are visible to all CRMS students.
        </p>

        {error && (
          <div className="mb-5 flex items-start gap-2.5 rounded-lg bg-error-bg border border-red-200 px-4 py-3">
            <AlertCircle size={15} className="text-error shrink-0 mt-0.5" />
            <p className="text-sm text-error">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          {/* Row: Title + Type */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">
                Job title <span className="text-error">*</span>
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
                Opportunity type <span className="text-error">*</span>
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

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">
              Description <span className="text-error">*</span>
            </label>
            <textarea
              required
              rows={5}
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Describe the role, responsibilities, and what students will learn…"
              className="field resize-none"
            />
          </div>

          {/* Row: Contact email + Deadline */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">
                Contact email <span className="text-error">*</span>
              </label>
              <input
                type="email"
                required
                value={form.contact_email}
                onChange={(e) => set('contact_email', e.target.value)}
                placeholder="hiring@example.com"
                className="field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">
                Application deadline <span className="text-error">*</span>
              </label>
              <input
                type="date"
                required
                value={form.deadline}
                onChange={(e) => set('deadline', e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="field"
              />
            </div>
          </div>

          {/* Spots available */}
          <div className="sm:max-w-[50%] sm:pr-2">
            <label className="block text-sm font-medium text-ink mb-1.5">
              Spots available <span className="text-error">*</span>
            </label>
            <input
              type="number"
              required
              min={1}
              max={999}
              value={form.capacity}
              onChange={(e) => set('capacity', Math.max(1, parseInt(e.target.value) || 1))}
              className="field"
            />
            <p className="mt-1.5 text-xs text-ink-muted">How many students can be accepted for this opportunity.</p>
          </div>

          {/* Required skills / classes */}
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">
              Required skills / classes{' '}
              <span className="text-ink-muted font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={form.required_skills}
              onChange={(e) => set('required_skills', e.target.value)}
              placeholder="e.g. Python, Environmental Science, AP Biology"
              className="field"
            />
            <p className="mt-1.5 text-xs text-ink-muted">Separate with commas. Students will see these as tags.</p>
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg
                bg-primary hover:bg-primary-light text-white font-medium text-sm
                disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting && <Spinner size="sm" className="border-white/30 border-t-white" />}
              {submitting
                ? isEdit ? 'Saving…' : 'Publishing…'
                : isEdit ? 'Save changes' : 'Publish listing'
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
