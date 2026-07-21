import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { DoorOpen, Hand, ShieldCheck, UserCheck, Eye, MessageSquare } from 'lucide-react'
import { PublicShell } from './PublicShell'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { OFFER_KINDS, OFFER_KIND_META } from '../../types'

interface Stats {
  members: number
  students: number
  offers: number
  connections: number
}

export function Landing() {
  const { user, loading } = useAuth()
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    supabase.rpc('community_stats').then(({ data }) => {
      if (data && typeof data === 'object') setStats(data as unknown as Stats)
    })
  }, [])

  if (!loading && user) return <Navigate to="/home" replace />

  return (
    <PublicShell>
      {/* Hero */}
      <section className="border-b border-line">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:py-24">
          <p className="eyebrow text-clay">Colorado Rocky Mountain School</p>
          <h1 className="mt-4 max-w-2xl text-4xl leading-tight sm:text-5xl">
            The doors only Oysters can open.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-faint">
            CRMS alumni and parents post internships, mentorships, and first jobs here
            that never reach a public job board — because this one is only for our school.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/signup" className="rounded-xl bg-pine px-5 py-2.5 font-medium text-white hover:bg-pine-deep">
              I'm a CRMS student
            </Link>
            <Link to="/signup?role=member" className="rounded-xl border border-line-strong bg-card px-5 py-2.5 font-medium text-ink hover:border-pine hover:text-pine">
              I'm an alum, parent, or friend
            </Link>
          </div>

          {stats && (stats.members > 0 || stats.offers > 0) && (
            <dl className="mt-12 flex flex-wrap gap-x-10 gap-y-4">
              {[
                [stats.offers, 'doors on the board'],
                [stats.members, 'approved alumni & parents'],
                [stats.connections, 'connections made'],
              ].map(([n, label]) => (
                <div key={String(label)}>
                  <dt className="sr-only">{label}</dt>
                  <dd className="font-display text-3xl font-semibold text-pine">{n}</dd>
                  <dd className="text-sm text-faint">{label}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-5xl px-4 py-16">
        <h2 className="text-3xl">One board, one loop</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            {
              icon: DoorOpen,
              title: 'A member opens a door',
              body: 'An alum or parent posts an offer in two minutes — even "my clinic can take one student for a shadow day."',
            },
            {
              icon: Hand,
              title: 'A student raises a hand',
              body: 'A short note about why they\'re interested. No resume required, no cold emails, no networking voodoo.',
            },
            {
              icon: MessageSquare,
              title: 'They talk, staff can see',
              body: 'The conversation lives in a thread scoped to that offer — and CRMS staff can read every word.',
            },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-xl border border-line bg-card p-6">
              <Icon className="h-6 w-6 text-clay" aria-hidden />
              <h3 className="mt-4 text-lg">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-faint">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Kinds of doors */}
      <section className="border-y border-line bg-card/50">
        <div className="mx-auto max-w-5xl px-4 py-16">
          <h2 className="text-3xl">Doors come in every size</h2>
          <p className="mt-3 max-w-xl text-faint">
            The best opportunities are often the smallest ones. Nothing here is too minor to post.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {OFFER_KINDS.filter((k) => k !== 'other').map((k) => (
              <div key={k} className="flex items-baseline gap-3 rounded-xl border border-line bg-card px-4 py-3">
                <span className={`eyebrow rounded-full px-2.5 py-1 ${OFFER_KIND_META[k].tint}`}>
                  {OFFER_KIND_META[k].label}
                </span>
                <span className="text-sm text-faint">{OFFER_KIND_META[k].blurb}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="mx-auto max-w-5xl px-4 py-16">
        <h2 className="text-3xl">Built for a school, not a network</h2>
        <p className="mt-3 max-w-xl text-faint">
          Most people on the student side of this platform are minors. The rules are strict on purpose.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            {
              icon: UserCheck,
              title: 'Every adult is vouched for',
              body: 'Alumni, parents, and friends of the school are approved one by one by CRMS staff before they can post anything.',
            },
            {
              icon: Hand,
              title: 'Students always go first',
              body: 'Adults can\'t browse students or start conversations. Contact begins only when a student raises a hand on an offer.',
            },
            {
              icon: Eye,
              title: 'Staff can see everything',
              body: 'Every thread between a student and an adult is readable by school staff. No private channels, no exposed contact info.',
            },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-xl border border-line bg-card p-6">
              <Icon className="h-6 w-6 text-pine" aria-hidden />
              <h3 className="mt-4 text-lg">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-faint">{body}</p>
            </div>
          ))}
        </div>
        <div className="mt-10 flex items-center gap-3 rounded-xl border border-pine/20 bg-meadow px-5 py-4">
          <ShieldCheck className="h-5 w-5 shrink-0 text-pine" aria-hidden />
          <p className="text-sm text-pine">
            Once an Oyster, always an Oyster. If you've been part of CRMS in any era,
            there's a student here who could use the door you can open.{' '}
            <Link to="/signup?role=member" className="font-medium underline">Join as a member.</Link>
          </p>
        </div>
      </section>
    </PublicShell>
  )
}
