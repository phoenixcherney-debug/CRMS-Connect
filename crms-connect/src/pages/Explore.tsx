import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Briefcase, Users, Building2, CalendarDays, Newspaper,
  ArrowRight, Sparkles, MapPin, MessageSquare,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Job, Profile } from '../types'
import { JOB_TYPE_LABELS } from '../types'
import Spinner from '../components/Spinner'

export default function Explore() {
  const { profile, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [featuredJobs, setFeaturedJobs] = useState<Job[]>([])
  const [suggestedPeople, setSuggestedPeople] = useState<Profile[]>([])
  const [stats, setStats] = useState({ jobs: 0, members: 0, companies: 0 })
  const [loading, setLoading] = useState(true)
  const [messaging, setMessaging] = useState<string | null>(null)

  const isStudent = profile?.role === 'student'

  useEffect(() => {
    async function load() {
      const [
        { data: jobs, count: jobCount },
        { data: profiles, count: memberCount },
        { data: allJobs },
      ] = await Promise.all([
        supabase
          .from('jobs')
          .select('*, profiles(id, full_name, role)', { count: 'exact' })
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(6),
        supabase
          .from('profiles')
          .select('*', { count: 'exact' })
          .eq('onboarding_complete', true)
          .neq('id', profile?.id ?? '')
          .limit(50),
        supabase
          .from('jobs')
          .select('company'),
      ])

      setFeaturedJobs((jobs as Job[]) ?? [])

      // Pick random suggested people (different role from current user)
      const otherRole = (profiles as Profile[] ?? []).filter(
        (p) => isStudent ? p.role !== 'student' : p.role === 'student'
      )
      const shuffled = otherRole.sort(() => 0.5 - Math.random()).slice(0, 6)
      setSuggestedPeople(shuffled)

      // Count unique companies across ALL jobs
      const companies = new Set(((allJobs as { company: string }[]) ?? []).map((j) => j.company.toLowerCase().trim()))
      setStats({
        jobs: jobCount ?? 0,
        members: memberCount ?? 0,
        companies: companies.size,
      })

      setLoading(false)
    }
    if (profile) {
      load()
    } else if (!authLoading) {
      // Auth finished but no profile found — stop the spinner
      setLoading(false)
    }
  }, [profile?.id, authLoading])

  async function startConversation(otherId: string) {
    if (!profile || messaging) return
    setMessaging(otherId)

    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .or(
        `and(participant_one.eq.${profile.id},participant_two.eq.${otherId}),` +
        `and(participant_one.eq.${otherId},participant_two.eq.${profile.id})`
      )
      .maybeSingle()

    if (existing) {
      setMessaging(null)
      navigate(`/inbox/${existing.id}`)
      return
    }

    const [p1, p2] = [profile.id, otherId].sort()
    const { data } = await supabase
      .from('conversations')
      .insert({ participant_one: p1, participant_two: p2 })
      .select()
      .single()

    setMessaging(null)
    if (data) navigate(`/inbox/${data.id}`)
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Spinner size="lg" /></div>
  }

  const greeting = (() => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
  })()

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <div
        className="rounded-2xl overflow-hidden relative"
        style={{ background: 'linear-gradient(140deg, #162d08 0%, #2D5016 45%, #3d6b20 80%, #4d7f28 100%)' }}
      >
        {/* Decorative background circles */}
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/[0.04] pointer-events-none" />
        <div className="absolute -bottom-14 -left-6 w-56 h-56 rounded-full bg-white/[0.03] pointer-events-none" />
        <div className="absolute top-6 right-20 w-20 h-20 rounded-full bg-white/[0.05] pointer-events-none" />

        <div className="relative z-10 px-6 py-7">
          <p
            className="text-xs font-semibold mb-3 tracking-widest uppercase"
            style={{ color: 'rgba(167, 210, 140, 0.85)' }}
          >
            {greeting}
          </p>
          <h1 className="text-2xl font-extrabold text-white leading-tight">
            {profile?.full_name.split(' ')[0]}'s<br />Dashboard
          </h1>
          <p className="text-sm mt-2 leading-relaxed" style={{ color: 'rgba(200, 230, 175, 0.85)' }}>
            {isStudent
              ? 'Discover opportunities and connect with the CRMS community.'
              : 'See what\'s happening in the CRMS community.'}
          </p>

          {/* Inline stats row inside hero */}
          <div className="mt-5 flex items-center gap-5 border-t border-white/10 pt-4">
            <Link to="/jobs" className="flex flex-col items-center gap-0.5 group">
              <span className="text-xl font-bold text-white group-hover:text-green-200 transition-colors">
                {stats.jobs}
              </span>
              <span className="text-[10px] font-medium" style={{ color: 'rgba(167, 210, 140, 0.75)' }}>
                Jobs
              </span>
            </Link>
            <div className="w-px h-8 bg-white/15" />
            <Link to="/people" className="flex flex-col items-center gap-0.5 group">
              <span className="text-xl font-bold text-white group-hover:text-green-200 transition-colors">
                {stats.members}
              </span>
              <span className="text-[10px] font-medium" style={{ color: 'rgba(167, 210, 140, 0.75)' }}>
                Members
              </span>
            </Link>
            <div className="w-px h-8 bg-white/15" />
            <Link to="/employers" className="flex flex-col items-center gap-0.5 group">
              <span className="text-xl font-bold text-white group-hover:text-green-200 transition-colors">
                {stats.companies}
              </span>
              <span className="text-[10px] font-medium" style={{ color: 'rgba(167, 210, 140, 0.75)' }}>
                Companies
              </span>
            </Link>
          </div>
        </div>
      </div>

      {/* Quick links grid */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          to="/feed"
          className="card-lift flex items-center gap-3 bg-surface rounded-xl border border-border p-4"
          style={{ boxShadow: 'var(--shadow-card)' }}
        >
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
            <Newspaper size={19} className="text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-ink">Feed</p>
            <p className="text-xs text-ink-muted">Latest activity</p>
          </div>
        </Link>
        <Link
          to="/events"
          className="card-lift flex items-center gap-3 bg-surface rounded-xl border border-border p-4"
          style={{ boxShadow: 'var(--shadow-card)' }}
        >
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
            <CalendarDays size={19} className="text-amber-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-ink">Events</p>
            <p className="text-xs text-ink-muted">Upcoming dates</p>
          </div>
        </Link>
        <Link
          to="/people"
          className="card-lift flex items-center gap-3 bg-surface rounded-xl border border-border p-4"
          style={{ boxShadow: 'var(--shadow-card)' }}
        >
          <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center shrink-0">
            <Users size={19} className="text-purple-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-ink">People</p>
            <p className="text-xs text-ink-muted">Community directory</p>
          </div>
        </Link>
        <Link
          to="/employers"
          className="card-lift flex items-center gap-3 bg-surface rounded-xl border border-border p-4"
          style={{ boxShadow: 'var(--shadow-card)' }}
        >
          <div className="w-10 h-10 rounded-xl bg-primary-muted flex items-center justify-center shrink-0">
            <Building2 size={19} className="text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-ink">Employers</p>
            <p className="text-xs text-ink-muted">Companies hiring</p>
          </div>
        </Link>
      </div>

      {/* Featured opportunities */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-primary" />
            <h2 className="text-base font-bold text-ink">Latest Opportunities</h2>
          </div>
          <Link to="/jobs" className="flex items-center gap-1 text-sm text-primary hover:text-primary-light font-medium">
            View all <ArrowRight size={13} />
          </Link>
        </div>
        {featuredJobs.length === 0 ? (
          <div className="text-center py-10 bg-surface rounded-xl border border-border">
            <Briefcase size={28} className="text-ink-muted mx-auto mb-2" />
            <p className="text-sm text-ink-muted">No opportunities posted yet.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {featuredJobs.slice(0, 4).map((job) => (
              <Link
                key={job.id}
                to={`/jobs/${job.id}`}
                className="card-lift bg-surface rounded-xl border border-border p-4"
                style={{ boxShadow: 'var(--shadow-card)' }}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-semibold text-ink text-sm leading-snug line-clamp-1">
                    {job.title}
                  </h3>
                  <span className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary-muted text-primary">
                    {JOB_TYPE_LABELS[job.job_type]}
                  </span>
                </div>
                <p className="text-xs text-ink-secondary flex items-center gap-1 mb-1">
                  <Building2 size={11} /> {job.company}
                </p>
                <p className="text-xs text-ink-muted flex items-center gap-1">
                  <MapPin size={11} /> {job.location}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Suggested connections */}
      {suggestedPeople.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-ink">
              {isStudent ? 'Connect with Alumni & Parents' : 'Meet Students'}
            </h2>
            <Link to="/people" className="flex items-center gap-1 text-sm text-primary hover:text-primary-light font-medium">
              See all <ArrowRight size={13} />
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {suggestedPeople.slice(0, 6).map((person) => {
              const initials = person.full_name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2)
              return (
                <div
                  key={person.id}
                  className="card-lift bg-surface rounded-xl border border-border p-4"
                  style={{ boxShadow: 'var(--shadow-card)' }}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary-muted flex items-center justify-center text-primary font-bold text-sm shrink-0">
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-ink truncate">{person.full_name}</p>
                      <p className="text-xs text-ink-muted capitalize">
                        {person.role}
                        {person.graduation_year ? ` · Class of ${person.graduation_year}` : ''}
                      </p>
                    </div>
                  </div>
                  {person.bio && (
                    <p className="text-xs text-ink-secondary mt-2 leading-relaxed line-clamp-2">{person.bio}</p>
                  )}
                  <button
                    onClick={() => startConversation(person.id)}
                    disabled={messaging === person.id}
                    className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg
                      border border-border text-xs font-medium text-ink-secondary hover:bg-primary-faint
                      hover:text-ink transition-colors disabled:opacity-50"
                  >
                    {messaging === person.id ? (
                      <Spinner size="sm" />
                    ) : (
                      <MessageSquare size={13} />
                    )}
                    Message
                  </button>
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
