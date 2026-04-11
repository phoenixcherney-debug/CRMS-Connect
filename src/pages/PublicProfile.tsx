import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ChevronLeft, MessageSquare, User, Briefcase, Heart } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Profile, CareerHistory } from '../types'
import { ROLE_LABELS } from '../types'
import Spinner from '../components/Spinner'

export default function PublicProfile() {
  const { id } = useParams<{ id: string }>()
  const { profile: myProfile } = useAuth()
  const navigate = useNavigate()
  const [person, setPerson] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [careerHistory, setCareerHistory] = useState<CareerHistory[]>([])

  const isPoster = person?.role === 'alumni' || person?.role === 'parent'

  useEffect(() => {
    async function load() {
      if (!id) return
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, role, graduation_year, bio, avatar_url, company, industry, open_to_mentorship, created_at')
        .eq('id', id)
        .single()
      setPerson(data as Profile)

      if (data && (data.role === 'alumni' || data.role === 'parent')) {
        const { data: career } = await supabase
          .from('career_history')
          .select('*')
          .eq('profile_id', id)
          .order('is_current', { ascending: false })
          .order('start_year', { ascending: false })
        setCareerHistory((career as CareerHistory[]) ?? [])
      }

      setLoading(false)
    }
    load()
  }, [id])

  async function openConversation() {
    if (!myProfile || !person) return
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .or(
        `and(participant_one.eq.${myProfile.id},participant_two.eq.${person.id}),` +
        `and(participant_one.eq.${person.id},participant_two.eq.${myProfile.id})`
      )
      .maybeSingle()

    if (existing) {
      navigate(`/messages/${existing.id}`)
      return
    }

    const [p1, p2] = [myProfile.id, person.id].sort()
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

  if (!person) {
    return (
      <div className="text-center py-20">
        <p className="text-ink-muted">This profile could not be found.</p>
        <Link to="/people" className="mt-3 inline-block text-sm text-primary hover:text-primary-light">
          &larr; Back to People
        </Link>
      </div>
    )
  }

  const initials = person.full_name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const isSelf = person.id === myProfile?.id

  return (
    <div className="max-w-xl mx-auto">
      <Link
        to="/people"
        className="inline-flex items-center gap-1.5 text-sm text-ink-secondary hover:text-ink mb-6"
      >
        <ChevronLeft size={16} />
        People
      </Link>

      <div
        className="bg-surface rounded-2xl border border-border overflow-hidden"
        style={{ boxShadow: 'var(--shadow-card)' }}
      >
        <div
          className="h-20 relative overflow-hidden"
          style={{
            background: `
              radial-gradient(ellipse 70% 120% at 80% 10%, rgba(74,124,47,0.7) 0%, transparent 60%),
              radial-gradient(ellipse 50% 100% at 10% 90%, rgba(45,80,22,0.5) 0%, transparent 50%),
              linear-gradient(155deg, #2D5016 0%, #3A6B1E 40%, #4A7C2F 70%, #3A6B1E 100%)
            `,
          }}
        >
          <div className="absolute top-[-30%] right-[8%] w-24 h-24 rounded-full opacity-[0.12] border border-white/20"
            style={{ background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.15) 0%, transparent 70%)' }} />
          <div className="absolute top-[-10%] right-[30%] w-14 h-14 rounded-full opacity-[0.09] border border-white/10"
            style={{ background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.12) 0%, transparent 70%)' }} />
          <div className="absolute bottom-[-20%] left-[15%] w-20 h-20 rounded-full opacity-[0.08] border border-white/10"
            style={{ background: 'radial-gradient(circle at 40% 30%, rgba(255,255,255,0.1) 0%, transparent 70%)' }} />
        </div>

        <div className="px-6 pb-6">
          <div className="-mt-8 mb-5 flex items-end gap-4">
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
            <div className="pb-1 flex-1">
              <p className="font-semibold text-ink text-lg">{person.full_name}</p>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary-muted text-primary text-xs font-medium">
                  <User size={11} />
                  {ROLE_LABELS[person.role]}
                </span>
                {isPoster && person.open_to_mentorship && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-success-bg text-success text-xs font-medium">
                    <Heart size={11} />
                    Open to mentorship
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {/* Info card */}
            <div className="p-3 rounded-lg bg-primary-faint border border-border text-sm space-y-1.5">
              <div className="flex gap-2">
                <span className="font-medium text-ink w-28 shrink-0">Member since</span>
                <span className="text-ink-secondary">
                  {new Date(person.created_at).toLocaleDateString('en-US', {
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
              </div>
              {person.graduation_year && person.role !== 'parent' && (
                <div className="flex gap-2">
                  <span className="font-medium text-ink w-28 shrink-0">
                    {person.role === 'student' ? 'Graduating' : 'Graduated'}
                  </span>
                  <span className="text-ink-secondary">{person.graduation_year}</span>
                </div>
              )}
              {isPoster && person.company && (
                <div className="flex gap-2">
                  <span className="font-medium text-ink w-28 shrink-0">Company</span>
                  <span className="text-ink-secondary">{person.company}</span>
                </div>
              )}
              {isPoster && person.industry && (
                <div className="flex gap-2">
                  <span className="font-medium text-ink w-28 shrink-0">Industry</span>
                  <span className="text-ink-secondary">{person.industry}</span>
                </div>
              )}
            </div>

            {/* Bio */}
            {person.bio ? (
              <div>
                <p className="text-sm font-medium text-ink mb-1.5">Bio</p>
                <p className="text-sm text-ink-secondary leading-relaxed whitespace-pre-wrap">
                  {person.bio}
                </p>
              </div>
            ) : (
              <p className="text-sm text-ink-muted italic">This user hasn't added a bio yet.</p>
            )}

            {/* Career History */}
            {isPoster && (
              <div>
                <p className="text-sm font-medium text-ink mb-2 flex items-center gap-1.5">
                  <Briefcase size={14} className="text-ink-muted" />
                  Career History
                </p>
                {careerHistory.length > 0 ? (
                  <div className="space-y-2">
                    {careerHistory.map((entry) => (
                      <div key={entry.id} className="p-3 rounded-lg bg-primary-faint border border-border text-sm">
                        <p className="font-medium text-ink">{entry.title}</p>
                        <p className="text-ink-secondary">
                          {entry.company} · {entry.start_year}–{entry.is_current ? 'Present' : entry.end_year ?? ''}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-ink-muted italic">No career history added yet.</p>
                )}
              </div>
            )}

            {/* Message / Edit buttons */}
            {!isSelf && (
              <button
                onClick={openConversation}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
                  border border-border text-sm font-medium text-ink-secondary
                  hover:bg-primary-faint hover:text-ink transition-colors"
              >
                <MessageSquare size={15} />
                Message {person.full_name.split(' ')[0]}
              </button>
            )}

            {isSelf && (
              <Link
                to="/profile"
                className="block w-full text-center px-4 py-2.5 rounded-lg
                  border border-border text-sm font-medium text-primary
                  hover:bg-primary-faint transition-colors"
              >
                Edit your profile
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
