import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Heart, MessageSquare, Trash2 } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/ToastProvider'
import { friendlyError } from '../lib/errors'
import { useAuth } from '../contexts/AuthContext'
import Spinner from '../components/Spinner'
import EmptyState from '../components/EmptyState'
import { initialsOf } from '../lib/initials'
import type { Profile } from '../types'

interface ShortlistRow {
  id: string
  student_id: string
  note: string | null
  created_at: string
  student: Pick<Profile, 'id' | 'full_name' | 'avatar_url' | 'grade' | 'graduation_year' | 'bio' | 'share_grade_with_employers'>
}

export default function Shortlist() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [rows, setRows]       = useState<ShortlistRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    document.title = 'Saved candidates · CRMS Connect'
    return () => { document.title = 'CRMS Connect' }
  }, [])

  useEffect(() => {
    if (!profile) return
    if (profile.role !== 'employer_mentor') { navigate('/explore'); return }
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from('mentor_shortlist')
        .select(`
          id, student_id, note, created_at,
          student:profiles!mentor_shortlist_student_id_fkey(
            id, full_name, avatar_url, grade, graduation_year, bio, share_grade_with_employers
          )
        `)
        .eq('mentor_id', profile.id)
        .order('created_at', { ascending: false })
      if (!cancelled) {
        setRows((data ?? []) as unknown as ShortlistRow[])
        setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [profile?.id, profile?.role, navigate])

  async function remove(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id))
    await supabase.from('mentor_shortlist').delete().eq('id', id)
  }

  async function saveNote(id: string, value: string) {
    const note = value.trim().slice(0, 200) || null
    const current = rows.find((r) => r.id === id)?.note ?? null
    if (note === current) return
    const { error } = await supabase.from('mentor_shortlist').update({ note }).eq('id', id)
    if (error) { toast(friendlyError(error, 'Could not save your note.'), { kind: 'error' }); return }
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, note } : r))
    toast('Note saved.')
  }

  async function openConversation(studentId: string) {
    if (!profile) return
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .or(
        `and(participant_one.eq.${profile.id},participant_two.eq.${studentId}),` +
        `and(participant_one.eq.${studentId},participant_two.eq.${profile.id})`
      )
      .maybeSingle()
    if (existing) { navigate(`/messages/${existing.id}`); return }
    const [p1, p2] = [profile.id, studentId].sort()
    const { data, error } = await supabase
      .from('conversations')
      .insert({ participant_one: p1, participant_two: p2 })
      .select('id')
      .single()
    if (error || !data) {
      toast(friendlyError(error, 'Could not message this candidate. They may not be open to outreach.'), { kind: 'error' })
      return
    }
    navigate(`/messages/${data.id}`)
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Spinner size="lg" /></div>
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink" style={{ fontFamily: 'var(--font-serif)' }}>
          Saved candidates
        </h1>
        <p className="text-sm text-ink-secondary mt-0.5">
          Students you've saved to follow up with later.
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Heart}
          title="No saved candidates yet"
          description="Tap the heart on a student's profile or directory card to add them here."
          ctaLabel="Browse students"
          ctaTo="/students"
        />
      ) : (
        <div className="space-y-3">
          {rows.map((row) => {
            const s = row.student
            const initials = initialsOf(s.full_name)
            const showGrade = s.share_grade_with_employers && s.grade
            return (
              <div
                key={row.id}
                className="bg-surface rounded-xl border border-border p-4"
                style={{ boxShadow: 'var(--shadow-card)' }}
              >
                <div className="flex items-start gap-3">
                  <Link to={`/people/${s.id}`} className="shrink-0">
                    <div className="w-11 h-11 rounded-full bg-primary-muted flex items-center justify-center text-primary font-bold overflow-hidden">
                      {s.avatar_url ? (
                        <img src={s.avatar_url} alt={s.full_name} className="w-full h-full object-cover" />
                      ) : initials}
                    </div>
                  </Link>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link
                          to={`/people/${s.id}`}
                          className="font-semibold text-ink hover:text-primary transition-colors block truncate"
                        >
                          {s.full_name}
                        </Link>
                        <div className="text-xs text-ink-muted mt-0.5">
                          {showGrade && <span>{s.grade}</span>}
                          {showGrade && <span> · </span>}
                          Added {format(parseISO(row.created_at), 'MMM d, yyyy')}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => remove(row.id)}
                        className="text-ink-muted hover:text-error p-1"
                        aria-label="Remove from saved candidates"
                        title="Remove"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    {s.bio && (
                      <p className="text-xs text-ink-secondary mt-1 line-clamp-2 leading-relaxed">{s.bio}</p>
                    )}

                    <textarea
                      defaultValue={row.note ?? ''}
                      onBlur={(e) => saveNote(row.id, e.target.value)}
                      placeholder="Add a private note about this candidate…"
                      rows={2}
                      maxLength={200}
                      className="mt-2 w-full px-2.5 py-1.5 rounded-lg border border-border bg-surface text-ink text-xs
                        placeholder:text-ink-placeholder resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                    />

                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => openConversation(s.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border text-xs font-medium text-ink-secondary hover:bg-primary-faint transition-colors"
                      >
                        <MessageSquare size={11} /> Message
                      </button>
                      <Link
                        to={`/people/${s.id}`}
                        className="inline-flex items-center px-2.5 py-1.5 rounded-lg border border-border text-xs font-medium text-ink-secondary hover:bg-primary-faint transition-colors"
                      >
                        View profile
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
