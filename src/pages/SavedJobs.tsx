import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bookmark, ArrowRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Job } from '../types'
import JobCard from '../components/JobCard'
import Spinner from '../components/Spinner'
import EmptyState from '../components/EmptyState'

/**
 * P2-37 — list of opportunities the user has bookmarked via
 * <SaveJobButton/>. Sorted by most-recently-saved.
 */
export default function SavedJobs() {
  const { profile } = useAuth()
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile) return
    let mounted = true
    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('saved_jobs')
        .select('created_at, jobs(*, profiles!jobs_posted_by_fkey(id, full_name, role))')
        .eq('user_id', profile!.id)
        .order('created_at', { ascending: false })
      if (!mounted) return
      // Supabase types the joined `jobs` as an array; in practice with
      // the FK join here it's a single object. Cast accordingly.
      const rows = (data ?? []) as unknown as { created_at: string; jobs: Job | null }[]
      setJobs(rows.map((r) => r.jobs).filter((j): j is Job => !!j))
      setLoading(false)
    }
    load()
    return () => { mounted = false }
  }, [profile?.id])

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink" style={{ fontFamily: 'var(--font-serif)' }}>Saved opportunities</h1>
        <p className="text-ink-secondary text-sm mt-0.5">
          {loading ? 'Loading…' : `${jobs.length} saved opportunit${jobs.length === 1 ? 'y' : 'ies'}`}
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : jobs.length === 0 ? (
        <EmptyState
          icon={Bookmark}
          title="Nothing saved yet."
          description="Tap the bookmark icon on an opportunity to add it here."
          ctaLabel={(<>Browse opportunities <ArrowRight size={13} /></>) as unknown as string}
          ctaTo="/opportunities"
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {jobs.map((job) => (
            <Link key={job.id} to={`/opportunities/${job.id}`}>
              <JobCard job={job} />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
