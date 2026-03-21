import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  ChevronLeft, MessageSquare, UserPlus, UserMinus,
  MapPin, Building2, Pin, Briefcase, GraduationCap,
} from 'lucide-react'
import { format, isPast, parseISO } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Job, Profile } from '../types'
import { JOB_TYPE_LABELS, ROLE_LABELS } from '../types'
import Spinner from '../components/Spinner'

type Tab = 'about' | 'followers' | 'following' | 'jobs'

export default function UserProfile() {
  const { id } = useParams<{ id: string }>()
  const { profile: me } = useAuth()
  const navigate = useNavigate()

  const [person, setPerson] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const [isFollowing, setIsFollowing] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)
  const [followerCount, setFollowerCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)

  const [followers, setFollowers] = useState<Profile[]>([])
  const [following, setFollowing] = useState<Profile[]>([])
  const [jobs, setJobs] = useState<Job[]>([])

  const [tab, setTab] = useState<Tab>('about')
  const [tabLoaded, setTabLoaded] = useState<Set<Tab>>(new Set(['about']))

  const [messaging, setMessaging] = useState(false)

  useEffect(() => {
    if (!id || !me) return
    async function load() {
      setLoading(true)
      const [
        { data: profileData },
        { count: followerC },
        { count: followingC },
        { data: followRow },
      ] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', id!).single(),
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', id!),
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', id!),
        supabase.from('follows').select('id').eq('follower_id', me.id).eq('following_id', id!).maybeSingle(),
      ])
      setPerson(profileData as Profile)
      setFollowerCount(followerC ?? 0)
      setFollowingCount(followingC ?? 0)
      setIsFollowing(!!followRow)
      setLoading(false)
    }
    load()
  }, [id, me])

  async function loadTab(t: Tab) {
    if (tabLoaded.has(t) || !id) return
    setTabLoaded((prev) => new Set(prev).add(t))

    if (t === 'followers') {
      const { data } = await supabase
        .from('follows')
        .select('profiles!follower_id(id, full_name, role, avatar_url, graduation_year)')
        .eq('following_id', id)
      setFollowers(((data ?? []).map((r: { profiles: Profile }) => r.profiles).filter(Boolean)) as Profile[])
    }

    if (t === 'following') {
      const { data } = await supabase
        .from('follows')
        .select('profiles!following_id(id, full_name, role, avatar_url, graduation_year)')
        .eq('follower_id', id)
      setFollowing(((data ?? []).map((r: { profiles: Profile }) => r.profiles).filter(Boolean)) as Profile[])
    }

    if (t === 'jobs') {
      if (person?.role === 'student') {
        // pinned jobs
        const { data } = await supabase
          .from('pinned_jobs')
          .select('jobs(*, profiles(id, full_name, role))')
          .eq('user_id', id)
          .order('created_at', { ascending: false })
        setJobs(
          ((data ?? []).map((r: { jobs: Job | null }) => r.jobs).filter(Boolean)) as Job[]
        )
      } else {
        // posted jobs
        const { data } = await supabase
          .from('jobs')
          .select('*')
          .eq('posted_by', id)
          .order('created_at', { ascending: false })
        setJobs((data as Job[]) ?? [])
      }
    }
  }

  function handleTabChange(t: Tab) {
    setTab(t)
    loadTab(t)
  }

  async function toggleFollow() {
    if (!me || followLoading) return
    setFollowLoading(true)
    if (isFollowing) {
      await supabase.from('follows').delete().eq('follower_id', me.id).eq('following_id', id!)
      setIsFollowing(false)
      setFollowerCount((c) => Math.max(0, c - 1))
    } else {
      await supabase.from('follows').insert({ follower_id: me.id, following_id: id! })
      setIsFollowing(true)
      setFollowerCount((c) => c + 1)
    }
    setFollowLoading(false)
  }

  async function startConversation() {
    if (!me || messaging || !id) return
    setMessaging(true)
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .or(
        `and(participant_one.eq.${me.id},participant_two.eq.${id}),` +
        `and(participant_one.eq.${id},participant_two.eq.${me.id})`
      )
      .maybeSingle()

    if (existing) { navigate(`/inbox/${existing.id}`); return }
    const [p1, p2] = [me.id, id].sort()
    const { data } = await supabase
      .from('conversations')
      .insert({ participant_one: p1, participant_two: p2 })
      .select().single()
    setMessaging(false)
    if (data) navigate(`/inbox/${data.id}`)
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Spinner size="lg" /></div>
  }

  if (!person) {
    return (
      <div className="text-center py-20">
        <p className="text-ink-muted">User not found.</p>
        <Link to="/people" className="mt-3 inline-block text-sm text-primary">← Back to People</Link>
      </div>
    )
  }

  const initials = person.full_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
  const isMe = me?.id === person.id

  const jobsTabLabel = person.role === 'student' ? 'Pinned' : 'Posted'

  const tabs: { id: Tab; label: string }[] = [
    { id: 'about', label: 'About' },
    { id: 'followers', label: `${followerCount} Follower${followerCount !== 1 ? 's' : ''}` },
    { id: 'following', label: `${followingCount} Following` },
    { id: 'jobs', label: jobsTabLabel },
  ]

  return (
    <div className="max-w-xl mx-auto">
      <Link to="/people" className="inline-flex items-center gap-1.5 text-sm text-ink-secondary hover:text-ink mb-6">
        <ChevronLeft size={16} /> People
      </Link>

      <div className="bg-surface rounded-2xl border border-border overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
        {/* Banner */}
        <div className="h-16 bg-gradient-to-r from-primary to-primary-light" />

        <div className="px-6 pb-6">
          {/* Avatar + name row */}
          <div className="-mt-8 mb-4 flex items-end justify-between gap-4">
            <div className="w-16 h-16 rounded-2xl border-4 border-surface bg-primary-muted flex items-center justify-center overflow-hidden shrink-0">
              {person.avatar_url ? (
                <img
                  src={person.avatar_url}
                  alt={person.full_name}
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              ) : (
                <span className="text-primary font-bold text-xl">{initials}</span>
              )}
            </div>

            {!isMe && (
              <div className="flex gap-2 pb-1">
                <button
                  onClick={toggleFollow}
                  disabled={followLoading}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors
                    disabled:opacity-50 disabled:cursor-not-allowed
                    ${isFollowing
                      ? 'bg-primary-muted border-primary/30 text-primary hover:bg-primary-faint'
                      : 'bg-primary hover:bg-primary-light text-white border-transparent'
                    }`}
                >
                  {followLoading ? (
                    <Spinner size="sm" className={isFollowing ? '' : 'border-white/30 border-t-white'} />
                  ) : isFollowing ? (
                    <UserMinus size={14} />
                  ) : (
                    <UserPlus size={14} />
                  )}
                  {isFollowing ? 'Unfollow' : 'Follow'}
                </button>
                <button
                  onClick={startConversation}
                  disabled={messaging}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border border-border
                    text-ink-secondary hover:bg-primary-faint hover:text-ink transition-colors disabled:opacity-50"
                >
                  {messaging ? <Spinner size="sm" /> : <MessageSquare size={14} />}
                  Message
                </button>
              </div>
            )}
          </div>

          {/* Name + role */}
          <div className="mb-5">
            <h1 className="text-xl font-bold text-ink">{person.full_name}</h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-sm text-ink-secondary">
              <span className="capitalize font-medium text-primary">{ROLE_LABELS[person.role]}</span>
              {person.graduation_year && person.role !== 'parent' && (
                <span className="flex items-center gap-1">
                  <GraduationCap size={13} />
                  {person.role === 'student' ? `Class of ${person.graduation_year}` : `Graduated ${person.graduation_year}`}
                </span>
              )}
              {person.company && (person.role === 'alumni' || person.role === 'parent') && (
                <span className="flex items-center gap-1">
                  <Building2 size={13} /> {person.company}
                </span>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-border mb-5 -mx-6 px-6">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => handleTabChange(t.id)}
                className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors
                  ${tab === t.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-ink-secondary hover:text-ink'
                  }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {tab === 'about' && (
            <div className="space-y-4">
              {person.bio ? (
                <p className="text-sm text-ink-secondary leading-relaxed whitespace-pre-wrap">{person.bio}</p>
              ) : (
                <p className="text-sm text-ink-muted italic">No bio yet.</p>
              )}
            </div>
          )}

          {(tab === 'followers' || tab === 'following') && (
            <PersonList people={tab === 'followers' ? followers : following} />
          )}

          {tab === 'jobs' && (
            <JobsList jobs={jobs} isStudent={person.role === 'student'} />
          )}
        </div>
      </div>
    </div>
  )
}

function PersonList({ people }: { people: Profile[] }) {
  if (people.length === 0) {
    return <p className="text-sm text-ink-muted italic text-center py-4">No one here yet.</p>
  }
  return (
    <div className="space-y-2">
      {people.map((p) => {
        const initials = p.full_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
        return (
          <Link
            key={p.id}
            to={`/people/${p.id}`}
            className="flex items-center gap-3 p-3 rounded-xl hover:bg-primary-faint transition-colors"
          >
            <div className="w-9 h-9 rounded-full bg-primary-muted flex items-center justify-center text-primary text-sm font-bold shrink-0 overflow-hidden">
              {p.avatar_url ? (
                <img src={p.avatar_url} alt={p.full_name} className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
              ) : initials}
            </div>
            <div>
              <p className="text-sm font-medium text-ink">{p.full_name}</p>
              <p className="text-xs text-ink-muted capitalize">
                {ROLE_LABELS[p.role]}
                {p.graduation_year ? ` · ${p.graduation_year}` : ''}
              </p>
            </div>
          </Link>
        )
      })}
    </div>
  )
}

function JobsList({ jobs, isStudent }: { jobs: Job[]; isStudent: boolean }) {
  if (jobs.length === 0) {
    return (
      <p className="text-sm text-ink-muted italic text-center py-4">
        {isStudent ? 'No pinned jobs yet.' : 'No posted jobs yet.'}
      </p>
    )
  }
  return (
    <div className="space-y-2">
      {jobs.map((job) => {
        const deadline = parseISO(job.deadline)
        const expired = isPast(deadline)
        return (
          <Link
            key={job.id}
            to={`/jobs/${job.id}`}
            className="flex gap-3 p-3 rounded-xl border border-border hover:shadow-sm hover:bg-primary-faint transition-all"
          >
            <div className="w-9 h-9 rounded-lg bg-primary-muted flex items-center justify-center shrink-0">
              {isStudent ? <Pin size={15} className="text-primary" /> : <Briefcase size={15} className="text-primary" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-ink truncate">{job.title}</p>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-xs text-ink-muted">
                <span className="flex items-center gap-1"><Building2 size={10} /> {job.company}</span>
                <span className="flex items-center gap-1"><MapPin size={10} /> {job.location}</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-primary-faint text-primary">
                  {JOB_TYPE_LABELS[job.job_type]}
                </span>
                {expired && (
                  <span className="text-[10px] font-medium text-ink-muted">
                    Closed · {format(deadline, 'MMM d, yyyy')}
                  </span>
                )}
                {!expired && (
                  <span className="text-[10px] text-ink-muted">
                    Deadline {format(deadline, 'MMM d, yyyy')}
                  </span>
                )}
              </div>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
