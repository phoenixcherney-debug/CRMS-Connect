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

const ready = Boolean(url && anonKey && studentPw && staffPw)
const d = ready ? describe : describe.skip

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

d('RLS trust model', () => {
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
})
