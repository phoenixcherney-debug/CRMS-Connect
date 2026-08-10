import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { TextField, TextAreaField } from '../../components/ui/Field'
import { useToast } from '../../components/ui/Toast'
import { friendlyError } from '../../lib/errors'
import { MAX_TAGS } from '../../lib/constants'
import { affiliationLabel } from '../../types'

export function ProfileEdit() {
  const { profile, refreshProfile } = useAuth()
  const toast = useToast()

  // Gate guarantees profile is loaded before this page renders, so the form
  // can seed straight from it — no sync-with-effect needed.
  const [fullName, setFullName] = useState(() => profile?.full_name ?? '')
  const [title, setTitle] = useState(() => profile?.title ?? '')
  const [organization, setOrganization] = useState(() => profile?.organization ?? '')
  const [location, setLocation] = useState(() => profile?.location ?? '')
  const [bio, setBio] = useState(() => profile?.bio ?? '')
  const [tags, setTags] = useState(() => profile?.tags.join(', ') ?? '')
  const [openToRequests, setOpenToRequests] = useState(() => profile?.open_to_requests ?? true)
  const [saving, setSaving] = useState(false)

  if (!profile) return null
  const isMember = profile.role === 'member'
  const isStudent = profile.role === 'student'

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!profile) return
    const tagList = tags.split(',').map((t) => t.trim()).filter(Boolean).slice(0, MAX_TAGS)
    setSaving(true)
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: fullName.trim(),
        title: title.trim() || null,
        organization: organization.trim() || null,
        location: location.trim() || null,
        bio: bio.trim() || null,
        tags: tagList,
        open_to_requests: openToRequests,
      })
      .eq('id', profile.id)
    setSaving(false)
    if (error) {
      toast(friendlyError(error), 'error')
      return
    }
    await refreshProfile()
    toast('Profile saved.')
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-3xl">Your profile</h1>
        <Link to={`/people/${profile.id}`} className="text-sm text-pine hover:underline">
          See it as others do
        </Link>
      </div>
      <p className="mt-2 text-sm text-faint">
        You appear as <span className="font-medium text-ink">{affiliationLabel(profile)}</span> — that part comes
        from the school and can't be edited here.
      </p>

      <Card className="mt-6">
        <form onSubmit={save} className="space-y-4">
          <TextField label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={80} required />
          {isMember && (
            <>
              <TextField label="Role or title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} hint="e.g. Veterinarian & Owner" />
              <TextField label="Organization" value={organization} onChange={(e) => setOrganization(e.target.value)} maxLength={80} />
            </>
          )}
          <TextField label="Location" value={location} onChange={(e) => setLocation(e.target.value)} maxLength={80} hint="e.g. Carbondale, CO" />
          <TextAreaField
            label="About you"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={4}
            maxLength={1000}
            hint={isMember
              ? 'What you do, and what kind of doors you can open. Students read this before knocking.'
              : 'What you\'re into and what you\'re hoping to find. Members read this when you knock.'}
          />
          <TextField
            label={isMember ? 'What you can help with' : 'Your interests'}
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            hint={`Comma-separated, up to ${MAX_TAGS} — e.g. Veterinary medicine, Animal science`}
          />
          {isMember && (
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line bg-paper px-4 py-3">
              <input
                type="checkbox"
                checked={openToRequests}
                onChange={(e) => setOpenToRequests(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-pine"
              />
              <span>
                <span className="block text-sm font-medium text-ink">Open to knocks</span>
                <span className="block text-xs text-faint">
                  Uncheck to take a pause — students won't be able to knock on your offers until you're back.
                </span>
              </span>
            </label>
          )}
          {isStudent && (
            <p className="rounded-lg bg-meadow px-3.5 py-2.5 text-xs leading-relaxed text-pine">
              Your profile is visible only to approved CRMS community members — never to the public.
              Your email is never shown to anyone.
            </p>
          )}
          <div className="flex justify-end">
            <Button type="submit" loading={saving}>Save profile</Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
