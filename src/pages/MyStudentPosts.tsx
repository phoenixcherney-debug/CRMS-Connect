import { useEffect, useState } from 'react'
import { FileText, Plus, X, RefreshCw, Archive, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { StudentPost, StudentSeeking } from '../types'
import {
  STUDENT_SEEKING_LABELS, WEEKLY_AVAILABILITY_OPTIONS, INTEREST_OPTIONS,
} from '../types'
import Spinner from '../components/Spinner'

export default function MyStudentPosts() {
  const { profile } = useAuth()

  const [posts, setPosts] = useState<StudentPost[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // Form state
  const [pitch, setPitch]               = useState('')
  const [seeking, setSeeking]           = useState<StudentSeeking | ''>('')
  const [seekingOther, setSeekingOther] = useState('')
  const [interests, setInterests]       = useState<string[]>([])
  const [availability, setAvailability] = useState('')

  function openForm() {
    // Pre-fill from profile, but leave pitch blank (post-specific)
    setSeeking((profile?.student_seeking as StudentSeeking | null) ?? '')
    setSeekingOther(profile?.student_seeking_other ?? '')
    setInterests(profile?.interests ?? [])
    setAvailability(profile?.weekly_availability ?? '')
    setPitch('')
    setShowForm(true)
  }

  useEffect(() => {
    load()
  }, [profile?.id])

  async function load() {
    if (!profile) return
    setLoading(true)
    const { data } = await supabase
      .from('student_posts')
      .select('*')
      .eq('student_id', profile.id)
      .order('created_at', { ascending: false })
    setPosts((data as StudentPost[]) ?? [])
    setLoading(false)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!profile || !seeking) return
    setSubmitting(true)

    const { data, error } = await supabase
      .from('student_posts')
      .insert({
        student_id:    profile.id,
        pitch:         pitch.trim(),
        seeking:       seeking,
        seeking_other: seeking === 'other' ? seekingOther.trim() || null : null,
        interests,
        availability:  availability || null,
        is_closed:     false,
      })
      .select()
      .single()

    setSubmitting(false)
    if (!error && data) {
      setPosts((prev) => [data as StudentPost, ...prev])
      setPitch('')
      setSeeking('')
      setSeekingOther('')
      setInterests([])
      setAvailability('')
      setShowForm(false)
    }
  }

  async function toggleClosed(post: StudentPost) {
    const { error } = await supabase
      .from('student_posts')
      .update({ is_closed: !post.is_closed })
      .eq('id', post.id)
    if (!error) {
      setPosts((prev) => prev.map((p) => p.id === post.id ? { ...p, is_closed: !p.is_closed } : p))
    }
  }

  async function handleDelete(postId: string) {
    const { error } = await supabase.from('student_posts').delete().eq('id', postId)
    if (!error) {
      setPosts((prev) => prev.filter((p) => p.id !== postId))
      setDeleteId(null)
    }
  }

  const openPosts   = posts.filter((p) => !p.is_closed)
  const closedPosts = posts.filter((p) => p.is_closed)

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink" style={{ fontFamily: 'var(--font-serif)' }}>My Posts</h1>
          <p className="text-ink-secondary text-sm mt-0.5">
            Let employers and mentors know what you're looking for
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => openForm()}
            className="btn-gold flex items-center gap-1.5 px-4 py-2"
          >
            <Plus size={15} />
            New post
          </button>
        )}
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-surface border border-border rounded-xl p-5 mb-6" style={{ boxShadow: 'var(--shadow-card)' }}>
          <div className="flex items-center justify-between mb-4">
            <p className="font-semibold text-ink">Create a post</p>
            <button onClick={() => setShowForm(false)} className="text-ink-muted hover:text-ink">
              <X size={16} />
            </button>
          </div>

          <form onSubmit={handleCreate} className="space-y-4">
            {/* What are you looking for */}
            <div>
              <label className="block text-sm font-medium text-ink mb-2">
                What are you looking for? <span className="text-error">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.entries(STUDENT_SEEKING_LABELS) as [StudentSeeking, string][]).map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setSeeking(val === seeking ? '' : val)}
                    className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors
                      ${seeking === val
                        ? 'border-primary text-primary'
                        : 'border-border text-ink-secondary hover:border-border-strong hover:bg-primary-faint'
                      }`}
                    style={seeking === val ? { backgroundColor: 'var(--color-primary-muted)' } : {}}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {seeking === 'other' && (
                <input
                  type="text"
                  value={seekingOther}
                  onChange={(e) => setSeekingOther(e.target.value)}
                  placeholder="Please describe…"
                  required
                  className="mt-2 w-full px-3.5 py-2.5 rounded-lg border border-border bg-surface text-ink text-sm
                    placeholder:text-ink-placeholder focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                />
              )}
            </div>

            {/* Pitch */}
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">
                About you <span className="text-ink-muted font-normal">(optional)</span>
              </label>
              <textarea
                rows={3}
                value={pitch}
                onChange={(e) => setPitch(e.target.value)}
                placeholder="Introduce yourself — what are your interests, goals, or experience?"
                className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-surface text-ink text-sm
                  placeholder:text-ink-placeholder resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
              />
            </div>

            {/* Availability */}
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">
                Weekly availability <span className="text-ink-muted font-normal">(optional)</span>
              </label>
              <select
                value={availability}
                onChange={(e) => setAvailability(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-surface text-ink text-sm
                  focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
              >
                <option value="">Select availability…</option>
                {WEEKLY_AVAILABILITY_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>

            {/* Interests */}
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">
                Interests <span className="text-ink-muted font-normal">(optional — select all that apply)</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                {INTEREST_OPTIONS.map((opt) => {
                  const selected = interests.includes(opt)
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setInterests((prev) => selected ? prev.filter((i) => i !== opt) : [...prev, opt])}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                        selected ? 'bg-primary text-white border-primary' : 'bg-surface text-ink-secondary border-border hover:border-primary hover:text-ink'
                      }`}
                    >
                      {opt}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button type="submit" disabled={submitting || !seeking || (seeking === 'other' && !seekingOther.trim())} className="btn-gold px-5 py-2.5">
                {submitting && <Spinner size="sm" className="border-white/30 border-t-white" />}
                {submitting ? 'Posting…' : 'Post'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2.5 rounded-lg border border-border text-sm text-ink-secondary hover:bg-primary-faint transition-colors">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : posts.length === 0 && !showForm ? (
        <div className="text-center py-20 bg-surface rounded-2xl border border-border">
          <FileText size={32} className="mx-auto text-ink-muted mb-3" />
          <p className="text-ink-muted font-medium">No posts yet</p>
          <p className="text-xs text-ink-muted mt-1 mb-4">Post to let employers and mentors know what you're looking for.</p>
          <button onClick={() => openForm()} className="btn-gold px-4 py-2">
            <Plus size={14} /> Create your first post
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Open posts */}
          {openPosts.length > 0 && (
            <div className="space-y-4">
              {openPosts.map((post) => <PostCard key={post.id} post={post} onToggle={toggleClosed} onDelete={setDeleteId} />)}
            </div>
          )}

          {/* Closed posts */}
          {closedPosts.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-3">Closed posts</p>
              <div className="space-y-4 opacity-60">
                {closedPosts.map((post) => <PostCard key={post.id} post={post} onToggle={toggleClosed} onDelete={setDeleteId} />)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Delete confirmation overlay */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-2xl border border-border p-6 max-w-sm w-full" style={{ boxShadow: 'var(--shadow-modal)' }}>
            <h3 className="font-semibold text-ink mb-2">Delete this post?</h3>
            <p className="text-sm text-ink-secondary mb-5">This can't be undone. Employers and mentors will no longer see it.</p>
            <div className="flex gap-3">
              <button onClick={() => handleDelete(deleteId)} className="flex-1 py-2.5 rounded-lg bg-error text-white text-sm font-medium hover:opacity-90 transition-opacity">
                Delete
              </button>
              <button onClick={() => setDeleteId(null)} className="flex-1 py-2.5 rounded-lg border border-border text-sm text-ink-secondary hover:bg-primary-faint transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface PostCardProps {
  post: StudentPost
  onToggle: (post: StudentPost) => void
  onDelete: (id: string) => void
}

function PostCard({ post, onToggle, onDelete }: PostCardProps) {
  const seekingLabel = STUDENT_SEEKING_LABELS[post.seeking] ?? post.seeking
  const displaySeeking = post.seeking === 'other' && post.seeking_other ? post.seeking_other : seekingLabel

  return (
    <div className="bg-surface rounded-xl border border-border p-5" style={{ boxShadow: 'var(--shadow-card)' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-2">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${post.is_closed ? 'bg-border text-ink-muted' : 'bg-success-bg text-success'}`}>
              {post.is_closed ? 'Closed' : 'Open'}
            </span>
            <span className="text-xs px-1.5 py-0.5 rounded-md bg-primary-faint text-primary font-medium">
              Looking for: {displaySeeking}
            </span>
            {post.availability && (
              <span className="text-xs text-ink-muted">{post.availability}</span>
            )}
          </div>

          {post.pitch && (
            <p className="text-sm text-ink-secondary leading-relaxed">{post.pitch}</p>
          )}

          {post.interests && post.interests.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {post.interests.map((interest) => (
                <span key={interest} className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-primary-muted text-primary">
                  {interest}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => onToggle(post)}
            title={post.is_closed ? 'Reopen' : 'Close post'}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border text-xs font-medium text-ink-secondary hover:bg-primary-faint hover:text-ink transition-colors"
          >
            {post.is_closed ? <RefreshCw size={12} /> : <Archive size={12} />}
            {post.is_closed ? 'Reopen' : 'Close'}
          </button>
          <button
            onClick={() => onDelete(post.id)}
            title="Delete post"
            className="p-1.5 rounded-lg border border-border text-ink-muted hover:text-error hover:border-error transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
