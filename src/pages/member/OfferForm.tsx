import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Spinner } from '../../components/ui/Spinner'
import { TextField, TextAreaField, SelectField } from '../../components/ui/Field'
import { useToast } from '../../components/ui/Toast'
import { friendlyError } from '../../lib/errors'
import { OFFER_KINDS, OFFER_KIND_META, LOCATION_MODE_LABEL } from '../../types'
import type { LocationMode, OfferKind } from '../../types'

/** Create/edit an offer. Two required fields — kind steers, title + words carry.
 *  Everything else is optional on purpose: friction kills half-formed offers,
 *  and half-formed offers are the product. */
export function OfferForm() {
  const { id } = useParams<{ id?: string }>()
  const editing = !!id
  const { profile } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()

  const [kind, setKind] = useState<OfferKind>('shadow_day')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [locationMode, setLocationMode] = useState<LocationMode>('in_person')
  const [locationText, setLocationText] = useState('')
  const [timeframe, setTimeframe] = useState('')
  const [commitment, setCommitment] = useState('')
  const [spots, setSpots] = useState('1')
  const [status, setStatus] = useState<'draft' | 'open' | 'filled' | 'closed'>('open')
  const [loaded, setLoaded] = useState(!editing)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!editing || !id) return
    let cancelled = false
    supabase.from('offers').select('*').eq('id', id).maybeSingle().then(({ data }) => {
      if (cancelled || !data) {
        if (!cancelled) toast('That offer couldn\'t be loaded.', 'error')
        return
      }
      setKind(data.kind)
      setTitle(data.title)
      setDescription(data.description)
      setLocationMode(data.location_mode)
      setLocationText(data.location_text ?? '')
      setTimeframe(data.timeframe ?? '')
      setCommitment(data.commitment ?? '')
      setSpots(String(data.spots))
      setStatus(data.status)
      setLoaded(true)
    })
    return () => { cancelled = true }
  }, [editing, id, toast])

  if (!profile) return null
  if (!loaded) return <Spinner page />

  async function save(e: FormEvent, asDraft = false) {
    e.preventDefault()
    if (!profile) return
    const payload = {
      kind,
      title: title.trim(),
      description: description.trim(),
      location_mode: locationMode,
      location_text: locationText.trim() || null,
      timeframe: timeframe.trim() || null,
      commitment: commitment.trim() || null,
      spots: Math.min(20, Math.max(1, Number(spots) || 1)),
      status: asDraft ? ('draft' as const) : status === 'draft' ? ('open' as const) : status,
    }
    setSaving(true)
    if (editing && id) {
      const { error } = await supabase.from('offers').update(payload).eq('id', id)
      setSaving(false)
      if (error) {
        toast(friendlyError(error), 'error')
        return
      }
      toast('Offer updated.')
      navigate(`/offers/${id}/manage`)
    } else {
      const { data, error } = await supabase
        .from('offers')
        .insert({ ...payload, posted_by: profile.id })
        .select()
        .single()
      setSaving(false)
      if (error) {
        toast(friendlyError(error), 'error')
        return
      }
      toast(asDraft ? 'Saved as a draft — only you can see it.' : 'Your door is on the board.')
      navigate(`/offers/${data.id}/manage`)
    }
  }

  const valid = title.trim().length >= 4 && description.trim().length >= 1

  return (
    <div className="mx-auto max-w-2xl">
      <Link to="/home" className="text-sm text-faint hover:text-ink">← My offers</Link>
      <h1 className="mt-3 text-3xl">{editing ? 'Edit your offer' : 'Open a door'}</h1>
      {!editing && (
        <p className="mt-2 max-w-lg text-sm text-faint">
          Two minutes, two required fields. Small is good — "one student, one day at my
          clinic" is exactly the kind of door this board exists for.
        </p>
      )}

      <Card className="mt-6">
        <form onSubmit={(e) => save(e)} className="space-y-5">
          <fieldset>
            <legend className="mb-2 block text-sm font-medium text-ink">What kind of door is it?</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {OFFER_KINDS.map((k) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={kind === k}
                  onClick={() => setKind(k)}
                  className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                    kind === k ? 'border-pine bg-meadow' : 'border-line-strong bg-card hover:border-line-strong hover:bg-paper'
                  }`}
                >
                  <span className={`block text-sm font-medium ${kind === k ? 'text-pine' : 'text-ink'}`}>
                    {OFFER_KIND_META[k].label}
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-tight text-faint">{OFFER_KIND_META[k].blurb}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <TextField
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            minLength={4}
            maxLength={90}
            placeholder="e.g. Shadow a large-animal vet for a day"
            required
          />
          <TextAreaField
            label="What you're offering"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={7}
            maxLength={3000}
            placeholder={'What will the student actually do? Who\'s a good fit (no experience is a fine answer)? What should they say when they raise a hand?'}
            required
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField label="Where" value={locationMode} onChange={(e) => setLocationMode(e.target.value as LocationMode)}>
              {(Object.keys(LOCATION_MODE_LABEL) as LocationMode[]).map((m) => (
                <option key={m} value={m}>{LOCATION_MODE_LABEL[m]}</option>
              ))}
            </SelectField>
            <TextField label="Location detail" value={locationText} onChange={(e) => setLocationText(e.target.value)} maxLength={80} placeholder="e.g. Basalt, CO" hint="Optional" />
            <TextField label="When" value={timeframe} onChange={(e) => setTimeframe(e.target.value)} maxLength={80} placeholder="e.g. Summer 2027, any school break" hint="Optional" />
            <TextField label="Commitment" value={commitment} onChange={(e) => setCommitment(e.target.value)} maxLength={80} placeholder="e.g. One full day, ~3 hrs/week" hint="Optional" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Spots"
              type="number"
              inputMode="numeric"
              min={1}
              max={20}
              value={spots}
              onChange={(e) => setSpots(e.target.value)}
              hint="Fills automatically as you accept students."
            />
            {editing && status !== 'draft' && (
              <SelectField label="Status" value={status} onChange={(e) => setStatus(e.target.value as typeof status)} hint="Close a door when it's no longer on offer.">
                <option value="open">Open</option>
                <option value="filled">Filled</option>
                <option value="closed">Closed</option>
              </SelectField>
            )}
          </div>

          <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-5">
            {(!editing || status === 'draft') && (
              <Button type="button" variant="secondary" loading={saving} disabled={!valid} onClick={(e) => save(e, true)}>
                Save as draft
              </Button>
            )}
            <Button type="submit" variant="accent" loading={saving} disabled={!valid}>
              {editing && status !== 'draft' ? 'Save changes' : 'Put it on the board'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
