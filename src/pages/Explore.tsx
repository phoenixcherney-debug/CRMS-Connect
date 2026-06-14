import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Search, Briefcase, Users, Building2, ArrowRight, TrendingUp, Rss,
  Heart, CalendarClock, ClipboardList, PlusSquare,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { JOB_COLUMNS } from '../lib/jobColumns'
import { initialsOf } from '../lib/initials'
import { useAuth } from '../contexts/AuthContext'
import type { Job, Profile } from '../types'
import { ROLE_LABELS } from '../types'
import JobCard from '../components/JobCard'
import Spinner from '../components/Spinner'
import MentorModeBanner from '../components/MentorModeBanner'
import EmployerDashboardStrip from '../components/EmployerDashboardStrip'
import InviteMentorButton from '../components/InviteMentorButton'
import EmployerTourModal from '../components/EmployerTourModal'
import OnboardingChecklist from '../components/OnboardingChecklist'
import MentorVisibilityCard from '../components/MentorVisibilityCard'
import PhotoBioNudge from '../components/PhotoBioNudge'
import MentorAnalyticsCard from '../components/MentorAnalyticsCard'
import MentorReconfirmPrompt from '../components/MentorReconfirmPrompt'
import { firstNameOf } from '../lib/preferredName'
import { isPast, parseISO } from 'date-fns'

// Task 24 — greeting first-name resolution lives in lib/preferredName
// so signup, profile, conversation, and admin all agree.

export default function Explore() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [recentJobs, setRecentJobs] = useState<Job[]>([])
  const [recentPeople, setRecentPeople] = useState<Profile[]>([])
  const [mentors, setMentors] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)

  const isEmployerMentor = profile?.role === 'employer_mentor'
  const isStudent = profile?.role === 'student'

  useEffect(() => {
    async function load() {
      const [
        { data: jobs },
        { data: people, error: peopleError },
      ] = await Promise.all([
        supabase
          .from('jobs')
          .select(`${JOB_COLUMNS}, profiles!jobs_posted_by_fkey(id, full_name, role)`)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(4),
        // Audit task 28 — Recently Joined panel now mixes students and EMs,
        // so the heading reflects the actual content. Admin rows are still
        // excluded (RLS migration 030).
        supabase
          .from('profiles')
          .select('id, full_name, role, graduation_year, bio, avatar_url, company, industry, open_to_mentorship, share_grade_with_employers, grade, created_at')
          .neq('role', 'admin')
          .order('created_at', { ascending: false })
          .limit(12),
      ])

      if (peopleError) console.error('Explore: profiles query failed', peopleError)

      const jobList = ((jobs as unknown as Job[]) ?? []).filter(
        (j) => !j.deadline || !isPast(parseISO(j.deadline))
      )
      const peopleList = (people as Profile[]) ?? []

      setRecentJobs(jobList)
      setRecentPeople(peopleList)
      setMentors(peopleList.filter((p) => p.open_to_mentorship && p.role === 'employer_mentor' && p.id !== profile?.id))
      setLoading(false)
    }
    load()
  }, [])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    navigate(search.trim() ? `/opportunities?q=${encodeURIComponent(search.trim())}` : '/opportunities')
  }

  const others = recentPeople.filter((p) => p.id !== profile?.id).slice(0, 8)

  return (
    <div className="max-w-5xl mx-auto space-y-10">

      {/* Hero */}
      <div
        className="relative -mx-4 sm:-mx-6 lg:-mx-8 px-6 sm:px-8 lg:px-10 py-10 rounded-2xl overflow-hidden"
        style={{
          background: `
            radial-gradient(ellipse 80% 60% at 80% 20%, rgba(74,124,47,0.7) 0%, transparent 60%),
            radial-gradient(ellipse 60% 80% at 20% 80%, rgba(45,80,22,0.5) 0%, transparent 50%),
            radial-gradient(ellipse 50% 50% at 50% 50%, rgba(58,107,30,0.3) 0%, transparent 70%),
            linear-gradient(155deg, #2D5016 0%, #3A6B1E 35%, #4A7C2F 65%, #3A6B1E 100%)
          `,
        }}
      >
        {/* Decorative bubbles */}
        <div className="absolute top-[-10%] right-[5%] w-48 h-48 rounded-full opacity-[0.12] border border-white/20"
          style={{ background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.15) 0%, transparent 70%)' }} />
        <div className="absolute top-[15%] right-[18%] w-28 h-28 rounded-full opacity-[0.09] border border-white/10"
          style={{ background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.12) 0%, transparent 70%)' }} />
        <div className="absolute bottom-[-15%] left-[8%] w-36 h-36 rounded-full opacity-[0.10] border border-white/15"
          style={{ background: 'radial-gradient(circle at 40% 30%, rgba(255,255,255,0.1) 0%, transparent 70%)' }} />
        <div className="absolute top-[60%] right-[35%] w-16 h-16 rounded-full opacity-[0.08] border border-white/10"
          style={{ background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.15) 0%, transparent 70%)' }} />
        <div className="absolute top-[5%] left-[30%] w-10 h-10 rounded-full opacity-[0.10] border border-white/15"
          style={{ background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.2) 0%, transparent 70%)' }} />
        <div className="absolute bottom-[10%] right-[10%] w-20 h-20 rounded-full opacity-[0.07] border border-white/10"
          style={{ background: 'radial-gradient(circle at 35% 25%, rgba(255,255,255,0.12) 0%, transparent 70%)' }} />
        <div className="absolute top-[40%] left-[5%] w-12 h-12 rounded-full opacity-[0.06]"
          style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%)' }} />

        <div className="relative z-10">
          <p className="text-white/50 text-xs font-bold uppercase tracking-[0.2em] mb-2">
            {new Date().getHours() < 12 ? 'Good Morning' : new Date().getHours() < 17 ? 'Good Afternoon' : 'Good Evening'}
          </p>
          <h1 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'var(--font-serif)' }}>
            {(() => {
              const first = firstNameOf(profile)
              // M-01 — H1 used to read "{first}'s Dashboard" but the URL is
              // /explore. Reframed as a personal welcome so the heading
              // matches the route's purpose (explore community + stats).
              return first ? `Welcome back, ${first}` : 'Welcome back'
            })()}
          </h1>
          <p className="text-white/65 mb-7 text-base max-w-lg">
            {isEmployerMentor
              ? 'Students are looking — post an opportunity, accept a meeting, or just stay visible.'
              : 'Discover opportunities and connect with employers and mentors in the CRMS community.'}
          </p>

          {/* Task 17 — stat blocks removed from the hero; they were
              decorative chrome at this size. The same numbers still
              ship on the public marketing pages via CommunityStats. */}

          <form onSubmit={handleSearch} className="flex gap-2 max-w-xl">
            <div className="relative flex-1">
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search opportunities by title, company, or keyword…"
                className="w-full pl-10 pr-4 py-3 rounded-xl border-0 bg-surface text-ink text-sm
                  placeholder:text-ink-placeholder
                  focus:outline-none focus:ring-2 focus:ring-white/40
                  transition-colors shadow-lg"
              />
            </div>
            <button
              type="submit"
              className="px-5 py-3 rounded-xl font-bold text-sm transition-colors shadow-lg"
              style={{ backgroundColor: 'var(--color-accent)', color: '#fff' }}
            >
              Search
            </button>
          </form>
        </div>
      </div>

      <MentorModeBanner />
      <PhotoBioNudge />
      {/* Task 11 — completion widget no longer renders on /explore. It
          lives on /profile (inline) where it can't scold the user the
          moment they land on the home dashboard. */}
      {isEmployerMentor && <MentorAnalyticsCard />}
      {isEmployerMentor && <MentorReconfirmPrompt />}
      <EmployerDashboardStrip />
      {isEmployerMentor && (
        <>
          <MentorVisibilityCard />
          <OnboardingChecklist />
          <EmployerTourModal />
        </>
      )}

      {isEmployerMentor && (
        <div className="mb-4 flex justify-end">
          <InviteMentorButton />
        </div>
      )}

      {/* Quick links — role-aware */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {isEmployerMentor ? (
          <>
            <Link to="/opportunities/new" className="bg-surface rounded-xl border border-border p-4 hover:bg-primary-faint hover:border-primary transition-colors" style={{ boxShadow: 'var(--shadow-card)' }}>
              <PlusSquare size={18} className="mb-2" style={{ color: 'var(--color-accent-dark)' }} />
              <p className="text-sm font-semibold text-ink">Post an Opportunity</p>
              <p className="text-xs text-ink-muted mt-0.5">Share opportunities</p>
            </Link>
            <Link to="/my-opportunities" className="bg-surface rounded-xl border border-border p-4 hover:bg-primary-faint hover:border-primary transition-colors" style={{ boxShadow: 'var(--shadow-card)' }}>
              <ClipboardList size={18} className="mb-2" style={{ color: 'var(--color-accent-dark)' }} />
              <p className="text-sm font-semibold text-ink">My Opportunities</p>
              <p className="text-xs text-ink-muted mt-0.5">Manage your opportunities</p>
            </Link>
            <Link to="/availability" className="bg-surface rounded-xl border border-border p-4 hover:bg-primary-faint hover:border-primary transition-colors" style={{ boxShadow: 'var(--shadow-card)' }}>
              <CalendarClock size={18} className="mb-2" style={{ color: 'var(--color-accent-dark)' }} />
              <p className="text-sm font-semibold text-ink">Availability</p>
              <p className="text-xs text-ink-muted mt-0.5">Set mentorship hours</p>
            </Link>
            <Link to="/students" className="bg-surface rounded-xl border border-border p-4 hover:bg-primary-faint hover:border-primary transition-colors" style={{ boxShadow: 'var(--shadow-card)' }}>
              <Users size={18} className="mb-2" style={{ color: 'var(--color-accent-dark)' }} />
              <p className="text-sm font-semibold text-ink">Browse Students</p>
              <p className="text-xs text-ink-muted mt-0.5">Connect & mentor</p>
            </Link>
          </>
        ) : (
          <>
            <Link to="/activity" className="bg-surface rounded-xl border border-border p-4 hover:bg-primary-faint hover:border-primary transition-colors" style={{ boxShadow: 'var(--shadow-card)' }}>
              <Rss size={18} className="mb-2" style={{ color: 'var(--color-accent-dark)' }} />
              <p className="text-sm font-semibold text-ink">Activity</p>
              <p className="text-xs text-ink-muted mt-0.5">Latest activity</p>
            </Link>
            <Link to="/opportunities" className="bg-surface rounded-xl border border-border p-4 hover:bg-primary-faint hover:border-primary transition-colors" style={{ boxShadow: 'var(--shadow-card)' }}>
              <Briefcase size={18} className="mb-2" style={{ color: 'var(--color-accent-dark)' }} />
              <p className="text-sm font-semibold text-ink">Opportunities</p>
              <p className="text-xs text-ink-muted mt-0.5">Jobs & internships</p>
            </Link>
            <Link to="/mentors" className="bg-surface rounded-xl border border-border p-4 hover:bg-primary-faint hover:border-primary transition-colors" style={{ boxShadow: 'var(--shadow-card)' }}>
              <Users size={18} className="mb-2" style={{ color: 'var(--color-accent-dark)' }} />
              <p className="text-sm font-semibold text-ink">Mentors</p>
              <p className="text-xs text-ink-muted mt-0.5">Connect with CRMS mentors</p>
            </Link>
            <Link to="/employers" className="bg-surface rounded-xl border border-border p-4 hover:bg-primary-faint hover:border-primary transition-colors" style={{ boxShadow: 'var(--shadow-card)' }}>
              <Building2 size={18} className="mb-2" style={{ color: 'var(--color-accent-dark)' }} />
              <p className="text-sm font-semibold text-ink">Employers & Mentors</p>
              <p className="text-xs text-ink-muted mt-0.5">Find mentors & employers</p>
            </Link>
          </>
        )}
      </div>

      {/* Mentors section (for students) */}
      {isStudent && mentors.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Heart size={18} className="text-primary" />
              <h2 className="text-lg font-semibold text-ink" style={{ fontFamily: 'var(--font-serif)' }}>Available Mentors</h2>
            </div>
            <Link
              to="/mentors"
              className="text-sm text-primary hover:text-primary-light font-medium flex items-center gap-1"
            >
              View all <ArrowRight size={14} />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {mentors.slice(0, 4).map((person) => {
              const initials = initialsOf(person.full_name)
              return (
                <Link
                  key={person.id}
                  to={`/people/${person.id}`}
                  className="bg-surface rounded-xl border border-border p-4 text-center hover:border-primary hover:bg-primary-faint transition-colors"
                  style={{ boxShadow: 'var(--shadow-card)' }}
                >
                  <div className="w-12 h-12 rounded-full bg-primary-muted flex items-center justify-center text-primary font-bold text-sm mx-auto mb-2 overflow-hidden">
                    {person.avatar_url ? (
                      <img src={person.avatar_url} alt={person.full_name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                    ) : initials}
                  </div>
                  <p className="font-medium text-ink text-sm truncate">{person.full_name}</p>
                  <p className="text-xs text-ink-muted capitalize mt-0.5">{ROLE_LABELS[person.role]}</p>
                  {person.industry && <p className="text-xs text-primary mt-0.5">{person.industry}</p>}
                  <span className="inline-flex items-center gap-0.5 mt-1.5 text-[10px] px-1.5 py-0.5 rounded-md bg-success-bg text-success font-medium">
                    <Heart size={8} /> Open to mentorship
                  </span>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {/* Recent Opportunities */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp size={18} className="text-primary" />
            <h2 className="text-lg font-semibold text-ink" style={{ fontFamily: 'var(--font-serif)' }}>Recent Opportunities</h2>
          </div>
          <Link
            to="/opportunities"
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
            {isEmployerMentor && (
              <Link
                to="/opportunities/new"
                className="mt-3 inline-flex items-center gap-1.5 text-sm text-primary font-medium"
              >
                Post an opportunity <ArrowRight size={13} />
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
            <h2 className="text-lg font-semibold text-ink" style={{ fontFamily: 'var(--font-serif)' }}>Recently Joined</h2>
          </div>
          {/* NAV-010 — surface both directories so the panel header can link
              to /students AND /mentors regardless of viewer role. */}
          <div className="flex items-center gap-3 text-sm font-medium">
            <Link to="/students" className="text-primary hover:text-primary-light flex items-center gap-1">
              All students
            </Link>
            <span className="text-ink-muted">·</span>
            <Link to="/mentors" className="text-primary hover:text-primary-light flex items-center gap-1">
              All mentors <ArrowRight size={14} />
            </Link>
          </div>
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
                <Link
                  key={person.id}
                  to={`/people/${person.id}`}
                  className="bg-surface rounded-xl border border-border p-4 text-center block hover:border-primary transition-colors"
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
                  {/* Only show class year for students who opted into sharing it,
                      matching every other directory surface. */}
                  {person.graduation_year && person.share_grade_with_employers && (
                    <p className="text-xs text-ink-muted">Class of {person.graduation_year}</p>
                  )}
                </Link>
              )
            })}
          </div>
        )}
      </section>

    </div>
  )
}
