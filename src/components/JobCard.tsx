import { Link } from 'react-router-dom'
import { MapPin, Calendar, Building2, Clock } from 'lucide-react'
import { formatDistanceToNow, isPast, parseISO } from 'date-fns'
import type { Job, JobType, LocationType } from '../types'
import { JOB_TYPE_LABELS, LOCATION_TYPE_LABELS } from '../types'

const JOB_TYPE_COLORS: Record<JobType, string> = {
  internship: 'bg-badge-internship-bg text-badge-internship-text border-badge-internship-border',
  'part-time': 'bg-badge-parttime-bg text-badge-parttime-text border-badge-parttime-border',
  'full-time': 'bg-primary-muted text-primary border-primary-muted',
  volunteer: 'bg-badge-volunteer-bg text-badge-volunteer-text border-badge-volunteer-border',
}

const LOCATION_TYPE_COLORS: Record<LocationType, string> = {
  remote: 'bg-badge-remote-bg text-badge-remote-text border-badge-remote-border',
  'in-person': 'bg-badge-inperson-bg text-badge-inperson-text border-badge-inperson-border',
  hybrid: 'bg-badge-hybrid-bg text-badge-hybrid-text border-badge-hybrid-border',
}

interface JobCardProps {
  job: Job
  /** Show edit/delete actions (for My Postings page) */
  actions?: React.ReactNode
  /** Applicant count badge (for My Postings page) */
  applicantCount?: number
}

export default function JobCard({ job, actions, applicantCount }: JobCardProps) {
  const deadline = job.deadline ? parseISO(job.deadline) : null
  const expired = deadline ? isPast(deadline) : false

  return (
    <div
      className={`bg-surface rounded-xl border transition-shadow duration-200 flex flex-col overflow-hidden
        ${expired || !job.is_active ? 'border-border opacity-60' : 'border-border hover:shadow-md'}`}
      style={{
        boxShadow: 'var(--shadow-card)',
        borderLeft: expired || !job.is_active ? undefined : '3px solid var(--color-primary)',
      }}
    >
      <Link to={`/jobs/${job.id}`} className="flex-1 p-5 flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-ink text-base leading-snug line-clamp-1">
              {job.title}
            </h3>
            <div className="flex items-center gap-1.5 mt-1 text-sm text-ink-secondary">
              <Building2 size={13} className="shrink-0" />
              <span className="truncate">{job.company}</span>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <div className="flex items-center gap-1">
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${JOB_TYPE_COLORS[job.job_type]}`}
              >
                {JOB_TYPE_LABELS[job.job_type]}
              </span>
              {job.location_type && (
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${LOCATION_TYPE_COLORS[job.location_type]}`}
                >
                  {LOCATION_TYPE_LABELS[job.location_type]}
                </span>
              )}
            </div>
            {(expired || !job.is_active) && (
              <span className="text-[11px] font-medium text-ink-muted bg-border/40 px-1.5 py-0.5 rounded">
                Closed
              </span>
            )}
          </div>
        </div>

        {/* Meta */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
          <span className="flex items-center gap-1">
            <MapPin size={12} />
            {job.location}
          </span>
          <span className="flex items-center gap-1">
            <Calendar size={12} />
            {expired ? 'Expired' : deadline ? `Due ${formatDistanceToNow(deadline, { addSuffix: true })}` : 'Rolling'}
          </span>
          {job.profiles && (
            <span className="flex items-center gap-1">
              Posted by {job.profiles.full_name}
            </span>
          )}
        </div>

        {/* Description preview */}
        <p className="text-sm text-ink-secondary leading-relaxed line-clamp-2">
          {job.description}
        </p>
      </Link>

      {/* Footer — actions or applicant count */}
      {(actions || applicantCount !== undefined) && (
        <div className="px-5 py-3 border-t border-border flex items-center justify-between">
          {applicantCount !== undefined && (
            <span className="text-xs text-ink-muted font-medium flex items-center gap-1">
              <Clock size={12} />
              {applicantCount} {applicantCount === 1 ? 'applicant' : 'applicants'}
            </span>
          )}
          {actions && <div className="flex items-center gap-2 ml-auto">{actions}</div>}
        </div>
      )}
    </div>
  )
}
