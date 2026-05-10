import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileText, MessageSquare, BookOpen, ArrowRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

interface Counts {
  newApplications: number
  unreadMessages: number
  matchingStudentPosts: number
}

/**
 * P2-22 — concrete, personal counts for E/M accounts on /explore. Shows
 * applications waiting on a decision, unread messages from anyone, and
 * recent student "looking for" posts whose interests overlap the
 * employer's industry. Hidden when every count is zero so we don't
 * surface emptiness.
 */
export default function EmployerDashboardStrip() {
  const { profile } = useAuth()
  const [counts, setCounts] = useState<Counts | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile || profile.role !== 'employer_mentor') {
      setLoading(false)
      return
    }
    let cancelled = false
    async function load() {
      if (!profile) return
      // 1) New applications to my jobs (status = pending)
      const { data: myJobs } = await supabase
        .from('jobs')
        .select('id')
        .eq('posted_by', profile.id)
      const jobIds = ((myJobs ?? []) as { id: string }[]).map((j) => j.id)

      let newApplications = 0
      if (jobIds.length > 0) {
        const { count } = await supabase
          .from('applications')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending')
          .in('job_id', jobIds)
        newApplications = count ?? 0
      }

      // 2) Unread messages — across any conversation I'm a participant in.
      const { data: convs } = await supabase
        .from('conversations')
        .select('id')
        .or(`participant_one.eq.${profile.id},participant_two.eq.${profile.id}`)
      const convIds = ((convs ?? []) as { id: string }[]).map((c) => c.id)
      let unreadMessages = 0
      if (convIds.length > 0) {
        const { count } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('is_read', false)
          .neq('sender_id', profile.id)
          .in('conversation_id', convIds)
        unreadMessages = count ?? 0
      }

      // 3) Student posts from the last 7 days whose interests overlap
      //    the employer's industry tag.
      let matchingStudentPosts = 0
      if (profile.industry) {
        const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        const { count } = await supabase
          .from('student_posts')
          .select('*', { count: 'exact', head: true })
          .eq('is_closed', false)
          .gte('created_at', since)
          .contains('interests', [profile.industry])
        matchingStudentPosts = count ?? 0
      }

      if (!cancelled) {
        setCounts({ newApplications, unreadMessages, matchingStudentPosts })
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [profile?.id, profile?.role, profile?.industry])

  if (!profile || profile.role !== 'employer_mentor') return null
  if (loading) return null
  if (!counts) return null
  const { newApplications, unreadMessages, matchingStudentPosts } = counts
  if (newApplications === 0 && unreadMessages === 0 && matchingStudentPosts === 0) return null

  const items: { count: number; label: string; to: string; icon: typeof FileText }[] = []
  if (newApplications > 0) {
    items.push({
      count: newApplications,
      label: newApplications === 1 ? 'new application' : 'new applications',
      to: '/my-opportunities',
      icon: FileText,
    })
  }
  if (unreadMessages > 0) {
    items.push({
      count: unreadMessages,
      label: unreadMessages === 1 ? 'unread message' : 'unread messages',
      to: '/messages',
      icon: MessageSquare,
    })
  }
  if (matchingStudentPosts > 0) {
    items.push({
      count: matchingStudentPosts,
      label: matchingStudentPosts === 1
        ? `student matching your industry posted this week`
        : `students matching your industry posted this week`,
      to: '/student-posts',
      icon: BookOpen,
    })
  }

  return (
    <div className="mb-4 rounded-xl border border-primary-muted bg-primary-faint p-4 flex flex-col sm:flex-row sm:items-center gap-3">
      <p className="text-sm text-ink-secondary">You have</p>
      <div className="flex-1 flex flex-wrap gap-2">
        {items.map(({ count, label, to, icon: Icon }) => (
          <Link
            key={label}
            to={to}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary-muted bg-surface text-xs font-medium text-ink hover:border-primary transition-colors"
          >
            <Icon size={13} className="text-primary" />
            <strong className="text-primary">{count}</strong> {label}
          </Link>
        ))}
      </div>
      <Link
        to="/my-opportunities"
        className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-light"
      >
        View all <ArrowRight size={12} />
      </Link>
    </div>
  )
}
