import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Search, Briefcase, Users, Building2, ArrowRight, TrendingUp, Rss,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Job, Profile } from '../types'
import { ROLE_LABELS } from '../types'
import JobCard from '../components/JobCard'
import Spinner from '../components/Spinner'
import { isPast, parseISO } from 'date-fns'

export default function Explore() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [recentJobs, setRecentJobs] = useState<Job[]>([])
  const [recentPeople, setRecentPeople] = useState<Profile[]>([])
  const [stats, setStats] = useState({ jobs: 0, people: 0, companies: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: jobs }, { data: people }, { count: totalJobs }, { count: totalPeople }] = await Promise.all([
        supabase
          .from('jobs')
          .select('*, profiles(id, full_name, role)')
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(4),
        supabase
          .from('profiles')
          .select('id, full_name, role, graduation_year, bio, avatar_url, created_at')
          .order('created_at', { ascending: false })
          .limit(12),
        supabase
          .from('jobs')
          .select('*', { count: 'exact', head: true })
          .eq('is_active', true),
        supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true }),
      ])

      const jobList = ((jobs as Job[]) ?? []).filter(
        (j) => j.deadline && !isPast(parseISO(j.deadline))
      )
      const peopleList = (people as Profile[]) ?? []

      setRecentJobs(jobList)
      setRecentPeople(peopleList)
      setStats({
        jobs: totalJobs ?? jobList.length,
        people: totalPeople ?? peopleList.length,
        companies: new Set(jobList.map((j) => j.company)).size,
      })
      setLoading(false)
    }
    load()
  }, [])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    navigate(search.trim() ? `/jobs?q=${encodeURIComponent(search.trim())}` : '/jobs')
  }

  const others = recentPeople.filter((p) => p.id !== profile?.id).slice(0, 8)

  return (
    <div className="max-w-5xl mx-auto space-y-10">

      {/* Hero */}
      <div className="text-center pt-6 pb-2">
        <h1 className="text-3xl font-bold text-ink mb-2">
          {profile?.full_name
            ? `Welcome back, ${profile.full_name.split(' ')[0]}`
            : 'Welcome to CRMS Connect'}
        </h1>
        <p className="text-ink-secondary mb-7 text-base">
          Discover opportunities, connect with the CRMS community, and build your future.
        </p>
        <form onSubmit={handleSearch} className="flex gap-2 max-w-xl mx-auto">
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search jobs, companies, people…"
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-border bg-surface text-ink text-sm
                placeholder:text-ink-placeholder
                focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary
                transition-colors"
            />
          </div>
          <button
            type="submit"
            className="px-5 py-3 rounded-xl bg-primary hover:bg-primary-light text-white font-semibold text-sm transition-colors"
          >
            Search
          </button>
        </form>
      </div>

      {/* Stats */}
      {!loading && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { icon: Briefcase,  label: 'Active Jobs',  value: stats.jobs,      to: '/jobs'      },
            { icon: Users,      label: 'Members',      value: stats.people,    to: '/people'    },
            { icon: Building2,  label: 'Employers',    value: stats.companies,  to: '/employers' },
          ].map(({ icon: Icon, label, value, to }) => (
            <Link
              key={label}
              to={to}
              className="bg-surface rounded-2xl border border-border p-5 flex flex-col items-center gap-2
                hover:border-primary hover:bg-primary-faint transition-colors text-center group"
              style={{ boxShadow: 'var(--shadow-card)' }}
            >
              <div className="w-10 h-10 rounded-xl bg-primary-muted flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                <Icon size={20} />
              </div>
              <p className="text-2xl font-bold text-ink">{value}</p>
              <p className="text-xs text-ink-muted font-medium">{label}</p>
            </Link>
          ))}
        </div>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Browse Feed',    to: '/feed',          icon: Rss,       desc: 'Latest activity' },
          { label: 'Opportunities',  to: '/jobs',          icon: Briefcase, desc: 'Jobs & internships' },
          { label: 'Community',      to: '/people',        icon: Users,     desc: 'Meet members' },
          { label: 'Employers',      to: '/employers',     icon: Building2, desc: "Who's hiring" },
        ].map(({ label, to, icon: Icon, desc }) => (
          <Link
            key={to}
            to={to}
            className="bg-surface rounded-xl border border-border p-4 hover:bg-primary-faint hover:border-primary transition-colors"
            style={{ boxShadow: 'var(--shadow-card)' }}
          >
            <Icon size={18} className="text-primary mb-2" />
            <p className="text-sm font-semibold text-ink">{label}</p>
            <p className="text-xs text-ink-muted mt-0.5">{desc}</p>
          </Link>
        ))}
      </div>

      {/* Recent Opportunities */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp size={18} className="text-primary" />
            <h2 className="text-lg font-semibold text-ink">Recent Opportunities</h2>
          </div>
          <Link
            to="/jobs"
            className="text-sm text-primary hover:text-primary-light font-medium flex items-center gap-1"
          >
            View all <ArrowRight size={14} />
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-10"><Spinner size="lg" /></div>
        ) : recentJobs.length === 0 ? (
          <div className="text-center py-12 bg-surface rounded-2xl border border-border">
            <Briefcase size={32} className="mx-auto text-ink-muted mb-3" />
            <p className="text-ink-muted text-sm">No active opportunities right now.</p>
            {(profile?.role === 'alumni' || profile?.role === 'parent') && (
              <Link
                to="/jobs/new"
                className="mt-3 inline-flex items-center gap-1.5 text-sm text-primary font-medium"
              >
                Post the first one <ArrowRight size={13} />
              </Link>
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {recentJobs.map((job) => <JobCard key={job.id} job={job} />)}
          </div>
        )}
      </section>

      {/* Recently Joined */}
      <section className="pb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-primary" />
            <h2 className="text-lg font-semibold text-ink">Recently Joined</h2>
          </div>
          <Link
            to="/people"
            className="text-sm text-primary hover:text-primary-light font-medium flex items-center gap-1"
          >
            View all <ArrowRight size={14} />
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-10"><Spinner size="lg" /></div>
        ) : others.length === 0 ? (
          <div className="text-center py-12 bg-surface rounded-2xl border border-border">
            <p className="text-ink-muted text-sm">No other members yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {others.map((person) => {
              const initials = person.full_name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2)
              return (
                <div
                  key={person.id}
                  className="bg-surface rounded-xl border border-border p-4 text-center"
                  style={{ boxShadow: 'var(--shadow-card)' }}
                >
                  <div className="w-12 h-12 rounded-full bg-primary-muted flex items-center justify-center text-primary font-bold text-sm mx-auto mb-2 overflow-hidden">
                    {person.avatar_url ? (
                      <img
                        src={person.avatar_url}
                        alt={person.full_name}
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                      />
                    ) : initials}
                  </div>
                  <p className="font-medium text-ink text-sm truncate">{person.full_name}</p>
                  <p className="text-xs text-ink-muted capitalize mt-0.5">
                    {ROLE_LABELS[person.role]}
                  </p>
                  {person.graduation_year && (
                    <p className="text-xs text-ink-muted">Class of {person.graduation_year}</p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

    </div>
  )
}
