import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Heart, MessageSquare, Trash2, Pencil } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { supabase } from '../lib/supabase'
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
  const [rows, setRows]       = useState<ShortlistRow[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingNote, setEditingNote] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)

  useEffect(() => {
    document.title = 'Shortlist · CRMS Connect'
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

  async function saveNote(id: string) {
    const trimmed = editingNote.trim().slice(0, 200)
    setSavingId(id)
    await supabase
      .from('mentor_shortlist')
      .update({ note: trimmed || null })
      .eq('id', id)
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, note: trimmed || null } : r))
    setEditingId(null)
    setEditingNote('')
    setSavingId(null)
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
    const { data } = await supabase
      .from('conversations')
      .insert({ participant_one: p1, participant_two: p2 })
      .select('id')
      .single()
    if (data) navigate(`/messages/${data.id}`)
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Spinner size="lg" /></div>
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink" style={{ fontFamily: 'var(--font-serif)' }}>
          Shortlist
        </h1>
        <p className="text-sm text-ink-secondary mt-0.5">
          Students you've saved to follow up with. Notes are private to you.
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Heart}
          title="No shortlisted students yet"
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
                        aria-label="Remove from shortlist"
                        title="Remove"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    {s.bio && (
                      <p className="text-xs text-ink-secondary mt-1 line-clamp-2 leading-relaxed">{s.bio}</p>
                    )}

                    {editingId === row.id ? (
                      <div className="mt-2">
                        <textarea
                          rows={2}
                          maxLength={200}
                          value={editingNote}
                          onChange={(e) => setEditingNote(e.target.value)}
                          placeholder="Private note (≤200 chars)…"
                          className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-ink text-xs placeholder:text-ink-placeholder resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                        />
                        <div className="mt-1 flex items-center justify-between">
                          <span className="text-[10px] text-ink-muted">{editingNote.length}/200</span>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => saveNote(row.id)}
                              disabled={savingId === row.id}
                              className="text-xs font-medium text-primary hover:text-primary-light disabled:opacity-50"
                            >
                              {savingId === row.id ? 'Saving…' : 'Save'}
                            </button>
                            <button
                              type="button"
                              onClick={() => { setEditingId(null); setEditingNote('') }}
                              className="text-xs text-ink-muted hover:text-ink"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : row.note ? (
                      <div className="mt-2 p-2 rounded-md bg-primary-faint border border-border text-xs text-ink-secondary flex items-start justify-between gap-2">
                        <span className="whitespace-pre-wrap flex-1">{row.note}</span>
                        <button
                          type="button"
                          onClick={() => { setEditingId(row.id); setEditingNote(row.note ?? '') }}
                          className="text-ink-muted hover:text-primary shrink-0"
                          aria-label="Edit note"
                        >
                          <Pencil size={11} />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => { setEditingId(row.id); setEditingNote('') }}
                        className="mt-2 text-xs font-medium text-primary hover:text-primary-light"
                      >
                        + Add private note
                      </button>
                    )}

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
