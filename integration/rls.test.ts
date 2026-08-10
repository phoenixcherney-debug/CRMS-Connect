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
// Creating accounts through the real signup trigger is the only way to test the
// account_status gate (blocker), and only the service role can delete the
// throwaway auth users afterwards — there is no profiles DELETE policy by
// design, and leaving residue in auth.users is not acceptable on a live project.
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

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
const JORDAN_ID = 'b0000000-0000-4000-8000-000000000002'
// The seeded Avery↔Casey thread on CASEY_SHADOW_OFFER, which carries messages.
const SEEDED_THREAD = 'e0000000-0000-4000-8000-000000000001'
const PENDING_DEMO = 'a0000000-0000-4000-8000-0000000000fe'
const DISABLED_DEMO = 'a0000000-0000-4000-8000-0000000000da'

function client(): SupabaseClient {
  return createClient(url!, anonKey!, { auth: { persistSession: false, autoRefreshToken: false } })
}
async function signedIn(email: string, password: string): Promise<SupabaseClient> {
  const c = client()
  const { error } = await c.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`sign-in failed for ${email}: ${error.message}`)
  return c
}

/** Remove a throwaway offer. requests.offer_id is ON DELETE RESTRICT since the
 *  cascade-delete blocker, so the thread has to be removed first — each request
 *  delete still cascades its own messages. Staff-only by policy. */
async function removeOffer(admin: SupabaseClient, offerId: string) {
  await admin.from('requests').delete().eq('offer_id', offerId)
  await admin.from('offers').delete().eq('id', offerId)
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
  let member2: SupabaseClient // Jordan — not a party to the seeded Avery↔Casey thread
  let pending: SupabaseClient // pending.demo (member, awaiting staff approval)
  let disabled: SupabaseClient // disabled.demo (student, revoked)
  let admin: SupabaseClient // Demo Staff

  /** Service-role client — used only to tear down the throwaway accounts the
   *  signup test creates. Scoped to that one test rather than the suite-wide
   *  env gate, so a missing key fails exactly the test that needs it instead of
   *  taking every other trust-model assertion down with it. */
  function serviceClient(): SupabaseClient {
    if (!serviceKey) {
      throw new Error(
        'SUPABASE_SERVICE_ROLE_KEY is not set. The signup gate can only be tested by creating ' +
        'real accounts, and only the service role can delete them again (there is no profiles ' +
        'DELETE policy by design). Add it to .env and to the repo secrets, then re-run. ' +
        'This test must never be skipped silently.',
      )
    }
    return createClient(url!, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  }

  beforeAll(async () => {
    anon = client()
    student = await signedIn('avery.kim@crms.org', studentPw!)
    student2 = await signedIn('miles.tanaka@crms.org', studentPw!)
    member = await signedIn('casey.ortega@example.com', studentPw!)
    member2 = await signedIn('jordan.whitfield@example.com', studentPw!)
    pending = await signedIn('pending.demo@example.com', studentPw!)
    disabled = await signedIn('disabled.demo@example.com', studentPw!)
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
      await removeOffer(admin, offerId)
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
      await removeOffer(admin, offerId)
    }
  })

  it('a student cannot knock on a filled offer (raise-hand gating)', async () => {
    // offers_insert now pins the initial status to draft/open, so reach 'filled'
    // the way the product does — by transitioning an open offer.
    const offer = await member.from('offers').insert({
      posted_by: CASEY_ID, kind: 'career_chat', title: 'E2E filled-gate offer',
      description: 'Integration test offer — safe to remove.', spots: 1, status: 'open',
    }).select().single()
    expect(offer.error).toBeNull()
    const offerId = offer.data!.id
    try {
      const fill = await member.from('offers').update({ status: 'filled' }).eq('id', offerId).select().single()
      expect(fill.error).toBeNull()
      const raise = await student.from('requests')
        .insert({ offer_id: offerId, student_id: AVERY_ID, note: 'should be blocked by requests_insert' })
        .select()
      expect(raise.error).not.toBeNull() // with-check requires the offer to be open
    } finally {
      await removeOffer(admin, offerId)
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

  // ==========================================================================
  // (Blocker) An offer can never be round-tripped through `draft` to
  // cascade-delete the threads hanging off it.
  // ==========================================================================
  it('an owner cannot demote a live offer back to draft', async () => {
    const offer = await member.from('offers').insert({
      posted_by: CASEY_ID, kind: 'career_chat', title: 'E2E draft-door offer',
      description: 'Integration test offer — safe to remove.', spots: 1, status: 'open',
    }).select().single()
    expect(offer.error).toBeNull()
    const offerId = offer.data!.id
    try {
      const demote = await member.from('offers').update({ status: 'draft' }).eq('id', offerId).select()
      expect(demote.error).not.toBeNull() // enforce_offer_guard: draft is a one-way door
      const still = await member.from('offers').select('status').eq('id', offerId).single()
      expect(still.data!.status).toBe('open')
    } finally {
      await removeOffer(admin, offerId)
    }
  })

  it('an owner cannot delete a live offer, but can still bin an untouched draft', async () => {
    const live = await member.from('offers').insert({
      posted_by: CASEY_ID, kind: 'career_chat', title: 'E2E live-delete offer',
      description: 'Integration test offer — safe to remove.', spots: 1, status: 'open',
    }).select().single()
    const liveId = live.data!.id
    try {
      // RLS filters the row out rather than erroring, so assert on survival.
      await member.from('offers').delete().eq('id', liveId)
      const survived = await member.from('offers').select('id').eq('id', liveId).maybeSingle()
      expect(survived.data?.id).toBe(liveId) // offers_delete still requires status = 'draft'
    } finally {
      await removeOffer(admin, liveId)
    }

    // The legitimate path is untouched: an owner may delete their own draft.
    const draft = await member.from('offers').insert({
      posted_by: CASEY_ID, kind: 'career_chat', title: 'E2E draft-delete offer',
      description: 'Integration test offer — safe to remove.', spots: 1, status: 'draft',
    }).select().single()
    expect(draft.error).toBeNull()
    const draftId = draft.data!.id
    const del = await member.from('offers').delete().eq('id', draftId)
    expect(del.error).toBeNull()
    const gone = await member.from('offers').select('id').eq('id', draftId).maybeSingle()
    expect(gone.data).toBeNull()
  })

  it('the database itself refuses to cascade a thread away with its offer', async () => {
    const offer = await member.from('offers').insert({
      posted_by: CASEY_ID, kind: 'career_chat', title: 'E2E restrict-fk offer',
      description: 'Integration test offer — safe to remove.', spots: 1, status: 'open',
    }).select().single()
    const offerId = offer.data!.id
    try {
      const raise = await student.from('requests')
        .insert({ offer_id: offerId, student_id: AVERY_ID, note: 'Integration restrict-fk — please ignore.' })
        .select().single()
      expect(raise.error).toBeNull()

      // Even staff cannot erase a thread as a side effect of removing an offer.
      const del = await admin.from('offers').delete().eq('id', offerId)
      expect(del.error).not.toBeNull() // requests_offer_id_fkey is ON DELETE RESTRICT
      const stillThere = await admin.from('requests').select('id').eq('offer_id', offerId)
      expect(stillThere.data ?? []).toHaveLength(1)
    } finally {
      await removeOffer(admin, offerId)
    }
  })

  // ==========================================================================
  // (Blocker) Re-knocking after a withdrawal preserves the thread.
  // ==========================================================================
  it('re-knocking revives the withdrawn request and keeps the whole thread', async () => {
    const offer = await member.from('offers').insert({
      posted_by: CASEY_ID, kind: 'career_chat', title: 'E2E re-knock offer',
      description: 'Integration test offer — safe to remove.', spots: 1, status: 'open',
    }).select().single()
    const offerId = offer.data!.id
    try {
      const raise = await student.from('requests')
        .insert({ offer_id: offerId, student_id: AVERY_ID, note: 'Integration re-knock — please ignore.' })
        .select().single()
      expect(raise.error).toBeNull()
      const reqId = raise.data!.id

      // A real adult↔minor exchange now hangs off this request.
      const reply = await member.from('messages')
        .insert({ request_id: reqId, sender_id: CASEY_ID, body: 'Glad you knocked — tell me more.' })
        .select().single()
      expect(reply.error).toBeNull()

      const withdrawn = await student.from('requests')
        .update({ status: 'withdrawn' }).eq('id', reqId).select().single()
      expect(withdrawn.error).toBeNull()

      // The old client DELETEd here, cascading the thread away. The retract
      // policy must now refuse, because this thread carries messages.
      await student.from('requests').delete().eq('id', reqId)
      const survived = await student.from('requests').select('id').eq('id', reqId).maybeSingle()
      expect(survived.data?.id).toBe(reqId)

      // Re-knock is an UPDATE: withdrawn → sent, note rewritten, decided_at cleared.
      const reknock = await student.from('requests')
        .update({ status: 'sent', note: 'Integration re-knock, second time — please ignore.' })
        .eq('id', reqId).select().single()
      expect(reknock.error).toBeNull()
      expect(reknock.data!.status).toBe('sent')
      expect(reknock.data!.decided_at).toBeNull()

      // ...and the earlier conversation is still on the record for staff.
      const msgs = await admin.from('messages').select('id').eq('request_id', reqId)
      expect(msgs.data ?? []).toHaveLength(1)
    } finally {
      await removeOffer(admin, offerId)
    }
  })

  it('a re-knock is re-gated — a withdrawn request cannot be revived on a closed door', async () => {
    const offer = await member.from('offers').insert({
      posted_by: CASEY_ID, kind: 'career_chat', title: 'E2E re-knock gate offer',
      description: 'Integration test offer — safe to remove.', spots: 1, status: 'open',
    }).select().single()
    const offerId = offer.data!.id
    try {
      const raise = await student.from('requests')
        .insert({ offer_id: offerId, student_id: AVERY_ID, note: 'Integration re-knock gate — please ignore.' })
        .select().single()
      expect(raise.error).toBeNull()
      const reqId = raise.data!.id
      await student.from('requests').update({ status: 'withdrawn' }).eq('id', reqId)

      // The poster closes the door before the student knocks again.
      await member.from('offers').update({ status: 'closed' }).eq('id', offerId)

      const revive = await student.from('requests').update({ status: 'sent' }).eq('id', reqId).select()
      // An UPDATE never runs requests_insert's with-check, so the trigger has to
      // re-assert every gate that policy applies.
      expect(revive.error).not.toBeNull()
    } finally {
      await removeOffer(admin, offerId)
    }
  })

  it('a student cannot delete a declined thread', async () => {
    const offer = await member.from('offers').insert({
      posted_by: CASEY_ID, kind: 'career_chat', title: 'E2E declined-delete offer',
      description: 'Integration test offer — safe to remove.', spots: 1, status: 'open',
    }).select().single()
    const offerId = offer.data!.id
    try {
      const raise = await student.from('requests')
        .insert({ offer_id: offerId, student_id: AVERY_ID, note: 'Integration declined-delete — please ignore.' })
        .select().single()
      expect(raise.error).toBeNull()
      const reqId = raise.data!.id
      const dec = await member.from('requests').update({ status: 'declined' }).eq('id', reqId).select().single()
      expect(dec.error).toBeNull()

      await student.from('requests').delete().eq('id', reqId)
      const survived = await student.from('requests').select('id').eq('id', reqId).maybeSingle()
      expect(survived.data?.id).toBe(reqId) // 'declined' is no longer a deletable state
    } finally {
      await removeOffer(admin, offerId)
    }
  })

  // ==========================================================================
  // (Blocker) app_is_active() is enforced at the database layer, not just by
  // the client Gate. Every one of these is a denial, so the suite stays idempotent.
  // ==========================================================================
  it('a pending account is denied every insert path', async () => {
    const offer = await pending.from('offers').insert({
      posted_by: PENDING_DEMO, kind: 'career_chat', title: 'E2E pending offer',
      description: 'Should never be written.', spots: 1, status: 'open',
    }).select()
    expect(offer.error, 'offers_insert must require app_is_active()').not.toBeNull()

    const request = await pending.from('requests')
      .insert({ offer_id: CASEY_SHADOW_OFFER, student_id: PENDING_DEMO, note: 'Should never be written.' })
      .select()
    expect(request.error, 'requests_insert must require app_is_active()').not.toBeNull()

    const message = await pending.from('messages')
      .insert({ request_id: SEEDED_THREAD, sender_id: PENDING_DEMO, body: 'Should never be written.' })
      .select()
    expect(message.error, 'messages_insert must require app_is_active()').not.toBeNull()

    const report = await pending.from('reports')
      .insert({ reporter_id: PENDING_DEMO, target: 'offer', target_id: CASEY_SHADOW_OFFER, reason: 'Should never be written.' })
      .select()
    expect(report.error, 'reports_insert must require app_is_active()').not.toBeNull()
  })

  it('a disabled account is denied every insert path', async () => {
    const offer = await disabled.from('offers').insert({
      posted_by: DISABLED_DEMO, kind: 'career_chat', title: 'E2E disabled offer',
      description: 'Should never be written.', spots: 1, status: 'open',
    }).select()
    expect(offer.error, 'offers_insert must require app_is_active()').not.toBeNull()

    const request = await disabled.from('requests')
      .insert({ offer_id: CASEY_SHADOW_OFFER, student_id: DISABLED_DEMO, note: 'Should never be written.' })
      .select()
    expect(request.error, 'requests_insert must require app_is_active()').not.toBeNull()

    const message = await disabled.from('messages')
      .insert({ request_id: SEEDED_THREAD, sender_id: DISABLED_DEMO, body: 'Should never be written.' })
      .select()
    expect(message.error, 'messages_insert must require app_is_active()').not.toBeNull()

    const report = await disabled.from('reports')
      .insert({ reporter_id: DISABLED_DEMO, target: 'offer', target_id: CASEY_SHADOW_OFFER, reason: 'Should never be written.' })
      .select()
    expect(report.error, 'reports_insert must require app_is_active()').not.toBeNull()
  })

  // ==========================================================================
  // (Blocker) Cross-thread message isolation — the predicate that makes "no
  // unmoderated adult contact with a student" true.
  // ==========================================================================
  it('a non-participant member cannot read or write another student’s thread', async () => {
    const read = await member2.from('messages').select('id').eq('request_id', SEEDED_THREAD)
    expect(read.data ?? [], 'messages_select leaked a thread to a non-participant member').toHaveLength(0)

    const write = await member2.from('messages')
      .insert({ request_id: SEEDED_THREAD, sender_id: JORDAN_ID, body: 'Should never reach this thread.' })
      .select()
    expect(write.error, 'messages_insert let a non-participant member into a thread').not.toBeNull()
  })

  it('a non-participant student cannot read or write another student’s thread', async () => {
    const read = await student2.from('messages').select('id').eq('request_id', SEEDED_THREAD)
    expect(read.data ?? [], 'messages_select leaked a thread to a non-participant student').toHaveLength(0)

    const write = await student2.from('messages')
      .insert({ request_id: SEEDED_THREAD, sender_id: MILES_ID, body: 'Should never reach this thread.' })
      .select()
    expect(write.error, 'messages_insert let a non-participant student into a thread').not.toBeNull()
  })

  it('the participants and staff can read that same thread', async () => {
    const staffRead = await admin.from('messages').select('id').eq('request_id', SEEDED_THREAD)
    expect(staffRead.error).toBeNull()
    expect((staffRead.data ?? []).length).toBeGreaterThan(0)

    const participantRead = await student.from('messages').select('id').eq('request_id', SEEDED_THREAD)
    expect((participantRead.data ?? []).length).toBeGreaterThan(0)
  })

  // ==========================================================================
  // (Blocker) The signup → account_status gate. Nothing else in any suite
  // creates an account, so handle_new_user's branches were entirely unpinned.
  // ==========================================================================
  it('handle_new_user gates account_status by role and school email, and never grants admin', async () => {
    const service = serviceClient()
    const stamp = Date.now()
    const password = `Integration-${stamp}-pw`
    const cases = [
      {
        label: 'school-email student', email: `itest-${stamp}-a@crms.org`,
        meta: { role: 'student', full_name: 'Integration Student A', class_year: '2027' },
        status: 'active', role: 'student',
      },
      {
        label: 'outside-email student', email: `itest-${stamp}-b@example.com`,
        meta: { role: 'student', full_name: 'Integration Student B', class_year: '2027' },
        status: 'pending', role: 'student',
      },
      {
        label: 'member', email: `itest-${stamp}-c@example.com`,
        meta: { role: 'member', full_name: 'Integration Member C', affiliation: 'friend' },
        status: 'pending', role: 'member',
      },
      {
        // Metadata must never be able to claim staff, even on a school address.
        label: 'admin claim', email: `itest-${stamp}-d@crms.org`,
        meta: { role: 'admin', full_name: 'Integration Faker D', class_year: '2027' },
        status: 'active', role: 'student',
      },
    ]
    const created: string[] = []
    try {
      for (const c of cases) {
        const { data, error } = await client().auth.signUp({
          email: c.email, password, options: { data: c.meta },
        })
        expect(error, `${c.label}: signUp failed`).toBeNull()
        const id = data.user!.id
        created.push(id)

        // handle_new_user only trusts a school address once it is confirmed.
        // This project auto-confirms, so the 'active' expectations below hold;
        // if confirmations are ever switched on, this assertion fails first and
        // says why, rather than the status assertion failing mysteriously.
        const authUser = await service.auth.admin.getUserById(id)
        expect(
          authUser.data.user?.email_confirmed_at,
          `${c.label}: project no longer auto-confirms signups — handle_new_user's ` +
          'school-email branch now defers to the on_auth_user_confirmed trigger',
        ).toBeTruthy()

        const { data: prof, error: profErr } = await service
          .from('profiles').select('role, account_status').eq('id', id).single()
        expect(profErr, `${c.label}: no profile row was created`).toBeNull()
        expect(prof!.account_status, `${c.label}: account_status`).toBe(c.status)
        expect(prof!.role, `${c.label}: role`).toBe(c.role)
      }
    } finally {
      for (const id of created) await service.auth.admin.deleteUser(id)
    }
  })

  // ==========================================================================
  // (Major) The status machines are enforced on INSERT too, not just UPDATE.
  // ==========================================================================
  it('a student cannot post a request that is already accepted', async () => {
    const offer = await member.from('offers').insert({
      posted_by: CASEY_ID, kind: 'career_chat', title: 'E2E insert-status offer',
      description: 'Integration test offer — safe to remove.', spots: 1, status: 'open',
    }).select().single()
    const offerId = offer.data!.id
    try {
      const forged = await student.from('requests').insert({
        offer_id: offerId, student_id: AVERY_ID,
        note: 'Should never be written as accepted.', status: 'accepted',
      }).select()
      expect(forged.error, 'requests_insert must pin the initial status').not.toBeNull()

      const forgedDecision = await student.from('requests').insert({
        offer_id: offerId, student_id: AVERY_ID,
        note: 'Should never be written pre-decided.', decided_at: new Date().toISOString(),
      }).select()
      expect(forgedDecision.error, 'requests_insert must reject a client decided_at').not.toBeNull()

      // The honest insert still works.
      const ok = await student.from('requests')
        .insert({ offer_id: offerId, student_id: AVERY_ID, note: 'Integration insert-status — please ignore.' })
        .select().single()
      expect(ok.error).toBeNull()
      expect(ok.data!.status).toBe('sent')
    } finally {
      await removeOffer(admin, offerId)
    }
  })

  it('a member cannot post an offer that is already filled, and a report cannot arrive resolved', async () => {
    const forged = await member.from('offers').insert({
      posted_by: CASEY_ID, kind: 'career_chat', title: 'E2E prefilled offer',
      description: 'Should never be written.', spots: 1, status: 'filled',
    }).select()
    expect(forged.error, 'offers_insert must pin the initial status').not.toBeNull()

    const forgedReport = await student.from('reports').insert({
      reporter_id: AVERY_ID, target: 'offer', target_id: CASEY_SHADOW_OFFER,
      reason: 'Should never bypass the staff queue.', status: 'resolved',
    }).select()
    expect(forgedReport.error, 'reports_insert must pin status to open').not.toBeNull()
  })

  // ==========================================================================
  // (Major) The two requests_insert denial clauses that had no test behind them.
  // ==========================================================================
  it('a member cannot raise a hand — students always initiate contact', async () => {
    const { error } = await member.from('requests')
      .insert({ offer_id: PRIYA_STUDIO_OFFER, student_id: CASEY_ID, note: 'Members must never initiate contact.' })
      .select()
    expect(error, 'requests_insert must require app_role() = student').not.toBeNull()
  })

  it('a paused member takes their offers off the board and stops new knocks', async () => {
    const CASEY_MENTORSHIP = 'd0000000-0000-4000-8000-000000000005' // Casey's, nobody has applied
    // Visible to a student who never applied, while Casey is open.
    const before = await student2.from('offers').select('id').eq('id', CASEY_MENTORSHIP).maybeSingle()
    expect(before.data?.id).toBe(CASEY_MENTORSHIP)

    const pause = await member.from('profiles').update({ open_to_requests: false }).eq('id', CASEY_ID).select().single()
    expect(pause.error).toBeNull()
    try {
      // offers_select: a paused member's offers leave the open board.
      const after = await student2.from('offers').select('id').eq('id', CASEY_MENTORSHIP).maybeSingle()
      expect(after.data, 'a paused member’s offer stayed on the board').toBeNull()

      // requests_insert: and no new knock lands on one either.
      const knock = await student.from('requests')
        .insert({ offer_id: CASEY_MENTORSHIP, student_id: AVERY_ID, note: 'Should be blocked by the pause switch.' })
        .select()
      expect(knock.error, 'requests_insert must honour the member pause switch').not.toBeNull()
    } finally {
      await member.from('profiles').update({ open_to_requests: true }).eq('id', CASEY_ID)
    }

    // Restored.
    const restored = await student2.from('offers').select('id').eq('id', CASEY_MENTORSHIP).maybeSingle()
    expect(restored.data?.id).toBe(CASEY_MENTORSHIP)
  })

  // ==========================================================================
  // (Major) Staff can redact an abusive message, and it is audited.
  // ==========================================================================
  it('staff can hide a message, removing it from the participants’ view', async () => {
    const SEEDED_MESSAGE = 'f0000000-0000-4000-8000-000000000001'
    // Visible to the student in the thread to begin with.
    const before = await student.from('messages').select('id').eq('id', SEEDED_MESSAGE).maybeSingle()
    expect(before.data?.id).toBe(SEEDED_MESSAGE)

    const hide = await admin.from('messages')
      .update({ hidden_at: new Date().toISOString() }).eq('id', SEEDED_MESSAGE).select().single()
    expect(hide.error).toBeNull()
    try {
      expect(hide.data!.hidden_by, 'enforce_message_guard must stamp hidden_by').not.toBeNull()

      const gone = await student.from('messages').select('id').eq('id', SEEDED_MESSAGE).maybeSingle()
      expect(gone.data, 'a hidden message stayed visible to the student').toBeNull()

      // Staff keep the full record.
      const staffStillSees = await admin.from('messages').select('id').eq('id', SEEDED_MESSAGE).maybeSingle()
      expect(staffStillSees.data?.id).toBe(SEEDED_MESSAGE)

      const logged = await admin.from('audit_log').select('action')
        .eq('target_id', SEEDED_MESSAGE).eq('action', 'hide_message')
      expect((logged.data ?? []).length, 'hiding a message must be audited').toBeGreaterThan(0)
    } finally {
      await admin.from('messages').update({ hidden_at: null }).eq('id', SEEDED_MESSAGE)
    }

    const restored = await student.from('messages').select('id').eq('id', SEEDED_MESSAGE).maybeSingle()
    expect(restored.data?.id).toBe(SEEDED_MESSAGE)
  })

  it('not even staff can rewrite what a message said', async () => {
    const SEEDED_MESSAGE = 'f0000000-0000-4000-8000-000000000001'
    const rewrite = await admin.from('messages')
      .update({ body: 'Rewritten history.' }).eq('id', SEEDED_MESSAGE).select()
    expect(rewrite.error, 'enforce_message_guard must keep the body immutable').not.toBeNull()
  })

  // ==========================================================================
  // Minor trust hardening (2026-07-24 review).
  // ==========================================================================
  it('a disabled account reads no thread content through notifications', async () => {
    // notifications.body carries left(message.body, 140), so this was a live
    // read path for a revoked account whose only block was the client Gate.
    const { data, error } = await disabled.from('notifications').select('id, kind')
    expect(error).toBeNull()
    for (const n of data ?? []) {
      expect(n.kind, 'a disabled account should only see account_update notices').toBe('account_update')
    }
  })

  it('an active user still reads their own notifications', async () => {
    const { error } = await student.from('notifications').select('id').limit(1)
    expect(error).toBeNull()
  })

  it('a member cannot rename themselves into the staff label', async () => {
    const { data: before } = await member.from('profiles').select('full_name').eq('id', CASEY_ID).single()
    const original = before!.full_name
    try {
      for (const name of ['CRMS Staff', 'crms  staff', 'CRMS Connect', 'Administrator']) {
        const attempt = await member.from('profiles').update({ full_name: name }).eq('id', CASEY_ID).select()
        expect(attempt.error, `"${name}" must be rejected`).not.toBeNull()
      }
      // An ordinary rename still works, and is audited.
      const ok = await member.from('profiles').update({ full_name: 'Casey Ortega Jr' }).eq('id', CASEY_ID).select().single()
      expect(ok.error).toBeNull()
      const logged = await admin.from('audit_log').select('action')
        .eq('target_id', CASEY_ID).eq('action', 'rename_profile')
      expect((logged.data ?? []).length, 'renames must be audited').toBeGreaterThan(0)
    } finally {
      await member.from('profiles').update({ full_name: original }).eq('id', CASEY_ID)
    }
  })

  it('a member cannot backdate their offer to the top of the board', async () => {
    const offer = await member.from('offers').insert({
      posted_by: CASEY_ID, kind: 'career_chat', title: 'E2E created-at offer',
      description: 'Integration test offer — safe to remove.', spots: 1, status: 'open',
    }).select().single()
    const offerId = offer.data!.id
    const original = offer.data!.created_at
    try {
      // The board sorts on created_at, so this would pin the offer permanently.
      await member.from('offers').update({ created_at: '2099-01-01T00:00:00Z' }).eq('id', offerId)
      const after = await member.from('offers').select('created_at').eq('id', offerId).single()
      expect(after.data!.created_at).toBe(original)
    } finally {
      await removeOffer(admin, offerId)
    }
  })
})
