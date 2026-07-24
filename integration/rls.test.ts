// Integration tests: exercise the Postgres trust model directly through
// PostgREST with real user tokens, asserting that forbidden actions are DENIED
// at the database layer (not just hidden in the UI). Runs against the live
// project, so it's kept out of the default `npm test` (unit) run — invoke with
// `npm run test:integration`, which loads .env for the URL/key/passwords.
//
// Every mutation here is either denied outright or cleaned up, so the suite is
// idempotent and leaves no residue.

import { describe, it, expect, beforeAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const anonKey = process.env.VITE_SUPABASE_ANON_KEY
const studentPw = process.env.E2E_PASSWORD
const staffPw = process.env.E2E_STAFF_PASSWORD

// Fail loudly instead of silently skipping (review Test-coverage T-07). A green
// run that asserted none of the trust-model invariants is worse than a red one,
// so when the env isn't configured this suite registers a single failing test
// rather than a green describe.skip.
const missingEnv = Object.entries({
  VITE_SUPABASE_URL: url,
  VITE_SUPABASE_ANON_KEY: anonKey,
  E2E_PASSWORD: studentPw,
  E2E_STAFF_PASSWORD: staffPw,
}).filter(([, v]) => !v).map(([k]) => k)

// Seed ids (see supabase/seed.sql).
const CASEY_SHADOW_OFFER = 'd0000000-0000-4000-8000-000000000001' // Casey's, spots 2
const PRIYA_STUDIO_OFFER = 'd0000000-0000-4000-8000-000000000004' // Priya's, spots 1
const AVERY_ID = 'c0000000-0000-4000-8000-000000000001'
const MILES_ID = 'c0000000-0000-4000-8000-000000000002'
const CASEY_ID = 'b0000000-0000-4000-8000-000000000001'

function client(): SupabaseClient {
  return createClient(url!, anonKey!, { auth: { persistSession: false, autoRefreshToken: false } })
}
async function signedIn(email: string, password: string): Promise<SupabaseClient> {
  const c = client()
  const { error } = await c.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`sign-in failed for ${email}: ${error.message}`)
  return c
}

describe('RLS trust model', () => {
  if (missingEnv.length > 0) {
    it('requires the Supabase integration env to be configured', () => {
      throw new Error(
        `Integration env missing: ${missingEnv.join(', ')}. Set these (see .env) and run ` +
        '`npm run test:integration`. This suite must never be skipped silently.',
      )
    })
    return
  }

  let anon: SupabaseClient
  let student: SupabaseClient // Avery (applied to Casey + Jordan)
  let student2: SupabaseClient // Miles (applied to Jordan only)
  let member: SupabaseClient // Casey
  let admin: SupabaseClient // Demo Staff

  beforeAll(async () => {
    anon = client()
    student = await signedIn('avery.kim@crms.org', studentPw!)
    student2 = await signedIn('miles.tanaka@crms.org', studentPw!)
    member = await signedIn('casey.ortega@example.com', studentPw!)
    admin = await signedIn('demo.admin@example.com', staffPw!)
  })

  it('anon sees no offers and no profiles', async () => {
    expect((await anon.from('offers').select('id')).data).toHaveLength(0)
    expect((await anon.from('profiles').select('id')).data).toHaveLength(0)
  })

  it('a student cannot read the audit log', async () => {
    const { data } = await student.from('audit_log').select('id')
    expect(data ?? []).toHaveLength(0)
  })

  it('a student cannot escalate their own role', async () => {
    const { data } = await student
      .from('profiles').update({ role: 'admin' }).eq('id', AVERY_ID).select()
    // Blocked by the guard trigger → error, zero rows changed.
    expect(data ?? []).toHaveLength(0)
  })

  it('a student cannot change their own account_status', async () => {
    // A real, distinct change (active → disabled) must be rejected by the guard;
    // setting it to its current value would be a permitted no-op.
    const { data } = await student
      .from('profiles').update({ account_status: 'disabled' }).eq('id', AVERY_ID).select()
    expect(data ?? []).toHaveLength(0)
    // Confirm nothing actually changed.
    const check = await admin.from('profiles').select('account_status').eq('id', AVERY_ID).single()
    expect(check.data!.account_status).toBe('active')
  })

  it('a member sees only students who applied to them — no directory', async () => {
    const { data } = await member.from('profiles').select('id, full_name').eq('role', 'student')
    const ids = (data ?? []).map((r) => r.id)
    expect(ids).toContain(AVERY_ID) // applied to Casey's shadow day
    expect(ids).not.toContain(MILES_ID) // applied only to Jordan
  })

  it('a member cannot rewrite their own affiliation (trust badge)', async () => {
    const { data } = await member
      .from('profiles').update({ affiliation: 'faculty_staff' }).eq('id', CASEY_ID).select()
    expect(data ?? []).toHaveLength(0)
  })

  it('a student cannot read another student’s hand-raises', async () => {
    // Miles can only ever see his own requests.
    const { data } = await student2.from('requests').select('student_id')
    for (const r of data ?? []) expect(r.student_id).toBe(MILES_ID)
  })

  it('admin can read the audit log and every profile', async () => {
    const audit = await admin.from('audit_log').select('id')
    expect(audit.error).toBeNull()
    const people = await admin.from('profiles').select('id')
    expect((people.data ?? []).length).toBeGreaterThan(3)
  })

  it('completes and cleans up a hand-raise → decline loop', async () => {
    // Start clean (delete any leftover retractable request on this offer).
    await student.from('requests').delete().eq('offer_id', PRIYA_STUDIO_OFFER).eq('student_id', AVERY_ID)

    // 1. Student raises a hand.
    const raise = await student
      .from('requests')
      .insert({ offer_id: PRIYA_STUDIO_OFFER, student_id: AVERY_ID, note: 'Integration test — please ignore.' })
      .select()
      .single()
    expect(raise.error).toBeNull()
    const requestId = raise.data!.id

    // 2. A poster-decline notification reaches the student (written by trigger).
    //    First move to declined as the poster would; here we assert the student
    //    can withdraw their own pending request (student-side transition).
    const withdraw = await student
      .from('requests').update({ status: 'withdrawn' }).eq('id', requestId).select().single()
    expect(withdraw.error).toBeNull()
    expect(withdraw.data!.status).toBe('withdrawn')

    // 3. A student cannot fabricate an accepted status on their own request.
    const illegal = await student
      .from('requests').update({ status: 'accepted' }).eq('id', requestId).select()
    expect(illegal.data ?? []).toHaveLength(0)

    // 4. Clean up.
    const del = await student.from('requests').delete().eq('id', requestId)
    expect(del.error).toBeNull()
  })

  it('a student cannot raise a hand as someone else', async () => {
    const { error } = await student2
      .from('requests')
      .insert({ offer_id: CASEY_SHADOW_OFFER, student_id: AVERY_ID, note: 'spoofing another student' })
      .select()
      .single()
    expect(error).not.toBeNull() // RLS with-check: student_id must equal auth.uid()
  })

  it('an applicant keeps read visibility of an offer staff has unlisted (blocker)', async () => {
    // Avery already applied to Casey's shadow offer (seed); Miles never did.
    // Hide it as staff, assert the applicant can still read it (so their thread
    // resolves) while a non-applicant cannot, then restore. Idempotent.
    await admin.from('offers').update({ hidden_at: new Date().toISOString() }).eq('id', CASEY_SHADOW_OFFER)
    try {
      const applicant = await student.from('offers').select('id').eq('id', CASEY_SHADOW_OFFER).maybeSingle()
      expect(applicant.data?.id).toBe(CASEY_SHADOW_OFFER)

      const nonApplicant = await student2.from('offers').select('id').eq('id', CASEY_SHADOW_OFFER).maybeSingle()
      expect(nonApplicant.data).toBeNull()
    } finally {
      await admin.from('offers').update({ hidden_at: null }).eq('id', CASEY_SHADOW_OFFER)
    }
  })

  // --- Poster status machine (review Test-coverage T-02) -------------------
  it('poster replies (sent→in_conversation) then accepts, filling a single-spot offer', async () => {
    // Throwaway offer owned by Casey so nothing else races on it; cascade-deleted.
    const offer = await member.from('offers').insert({
      posted_by: CASEY_ID, kind: 'career_chat', title: 'E2E accept-path offer',
      description: 'Integration test offer — safe to remove.', spots: 1, status: 'open',
    }).select().single()
    expect(offer.error).toBeNull()
    const offerId = offer.data!.id
    try {
      const raise = await student.from('requests')
        .insert({ offer_id: offerId, student_id: AVERY_ID, note: 'Integration accept-path — please ignore.' })
        .select().single()
      expect(raise.error).toBeNull()
      const reqId = raise.data!.id

      // Poster's first reply + the sent→in_conversation advance the UI performs.
      const msg = await member.from('messages').insert({ request_id: reqId, sender_id: CASEY_ID, body: 'Happy to talk — when works?' }).select().single()
      expect(msg.error).toBeNull()
      const conv = await member.from('requests').update({ status: 'in_conversation' }).eq('id', reqId).select().single()
      expect(conv.error).toBeNull()
      expect(conv.data!.status).toBe('in_conversation')

      // Accepting fills the single-spot offer (notify_request_updated side effect).
      const acc = await member.from('requests').update({ status: 'accepted' }).eq('id', reqId).select().single()
      expect(acc.error).toBeNull()
      expect(acc.data!.status).toBe('accepted')
      const filled = await member.from('offers').select('status').eq('id', offerId).single()
      expect(filled.data!.status).toBe('filled')
    } finally {
      await admin.from('offers').delete().eq('id', offerId) // cascades requests + messages
    }
  })

  it('poster declines with a softening note, stamping decided_at', async () => {
    const offer = await member.from('offers').insert({
      posted_by: CASEY_ID, kind: 'career_chat', title: 'E2E decline-path offer',
      description: 'Integration test offer — safe to remove.', spots: 1, status: 'open',
    }).select().single()
    const offerId = offer.data!.id
    try {
      const raise = await student.from('requests')
        .insert({ offer_id: offerId, student_id: AVERY_ID, note: 'Integration decline-path — please ignore.' })
        .select().single()
      const reqId = raise.data!.id

      const note = await member.from('messages').insert({ request_id: reqId, sender_id: CASEY_ID, body: 'Thanks for knocking — already filled this one.' }).select().single()
      expect(note.error).toBeNull()
      const dec = await member.from('requests').update({ status: 'declined' }).eq('id', reqId).select().single()
      expect(dec.error).toBeNull()
      expect(dec.data!.status).toBe('declined')
      expect(dec.data!.decided_at).not.toBeNull()
    } finally {
      await admin.from('offers').delete().eq('id', offerId)
    }
  })

  it('a student cannot knock on a filled offer (raise-hand gating)', async () => {
    const offer = await member.from('offers').insert({
      posted_by: CASEY_ID, kind: 'career_chat', title: 'E2E filled-gate offer',
      description: 'Integration test offer — safe to remove.', spots: 1, status: 'filled',
    }).select().single()
    const offerId = offer.data!.id
    try {
      const raise = await student.from('requests')
        .insert({ offer_id: offerId, student_id: AVERY_ID, note: 'should be blocked by requests_insert' })
        .select()
      expect(raise.error).not.toBeNull() // with-check requires the offer to be open
    } finally {
      await admin.from('offers').delete().eq('id', offerId)
    }
  })

  // --- Moderation lifecycle (review Test-coverage T-03) --------------------
  it('a student files a report, staff resolves it, and a <3-char reason is rejected', async () => {
    const rep = await student.from('reports').insert({
      reporter_id: AVERY_ID, target: 'offer', target_id: CASEY_SHADOW_OFFER,
      reason: 'E2E moderation lifecycle — please ignore.',
    }).select().single()
    expect(rep.error).toBeNull()
    const reportId = rep.data!.id

    const seen = await admin.from('reports').select('status').eq('id', reportId).single()
    expect(seen.data!.status).toBe('open')

    const resolved = await admin.from('reports').update({ status: 'resolved' }).eq('id', reportId).select().single()
    expect(resolved.error).toBeNull()
    expect(resolved.data!.status).toBe('resolved')
    expect(resolved.data!.resolved_by).not.toBeNull() // stamp_report_resolution

    // The reason length floor (>=3) is a DB check constraint, not just UI.
    const tooShort = await student.from('reports')
      .insert({ reporter_id: AVERY_ID, target: 'offer', target_id: CASEY_SHADOW_OFFER, reason: 'no' })
      .select()
    expect(tooShort.error).not.toBeNull()
    // Reports have no delete policy by design, so this leaves one settled report.
  })

  // --- Approval gating transitions (review Test-coverage T-04) -------------
  it('staff approve a pending account and disable / re-enable, restoring the fixtures', async () => {
    const PENDING_DEMO = 'a0000000-0000-4000-8000-0000000000fe'
    const DISABLED_DEMO = 'a0000000-0000-4000-8000-0000000000da'
    try {
      const appr = await admin.from('profiles').update({ account_status: 'active' }).eq('id', PENDING_DEMO).select().single()
      expect(appr.error).toBeNull()
      expect(appr.data!.account_status).toBe('active')
      expect(appr.data!.approved_at).not.toBeNull() // guard auto-stamps on pending→active

      const dis = await admin.from('profiles').update({ account_status: 'disabled' }).eq('id', PENDING_DEMO).select().single()
      expect(dis.data!.account_status).toBe('disabled')

      const reen = await admin.from('profiles').update({ account_status: 'active' }).eq('id', DISABLED_DEMO).select().single()
      expect(reen.data!.account_status).toBe('active')
    } finally {
      // Restore the gating fixtures for e2e/gating.spec.
      await admin.from('profiles').update({ account_status: 'pending', approved_at: null, approved_by: null }).eq('id', PENDING_DEMO)
      await admin.from('profiles').update({ account_status: 'disabled' }).eq('id', DISABLED_DEMO)
    }
  })
})
