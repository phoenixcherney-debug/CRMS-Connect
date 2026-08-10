import type { APIRequestContext, Page } from '@playwright/test'
import { expect } from '@playwright/test'

/** Seeded demo accounts (see supabase/seed.sql). Passwords come from env so
 *  they never live in this public repo. */
export const ACCOUNTS = {
  student: { email: 'avery.kim@crms.org', password: process.env.E2E_PASSWORD ?? '' },
  student2: { email: 'miles.tanaka@crms.org', password: process.env.E2E_PASSWORD ?? '' },
  member: { email: 'casey.ortega@example.com', password: process.env.E2E_PASSWORD ?? '' },
  // Dedicated demo admin, separate from the owner's real phoenix@cherney.com
  // account (whose password the owner controls).
  admin: { email: 'demo.admin@example.com', password: process.env.E2E_STAFF_PASSWORD ?? '' },
}

// Seed ids used by the setup/cleanup helpers (see supabase/seed.sql).
export const AVERY_ID = 'c0000000-0000-4000-8000-000000000001'

/** Fail loudly instead of defaulting to ''. With an empty base URL every REST
 *  helper below collapses to a path relative to the app preview, so arrange and
 *  cleanup calls silently no-op — which is how `E2E published offer <ts>` rows
 *  ended up stranded on the shared board, degrading every later board and search
 *  assertion. Mirrors integration/rls.test.ts's no-silent-skip contract. */
function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `${name} is not set. The e2e suite's REST arrange/cleanup helpers need it; ` +
      'without it they resolve against the app preview and silently do nothing. ' +
      'Set it in .env locally, or in the e2e job\'s env: block in CI.',
    )
  }
  return value
}

const SUPABASE_URL = requireEnv('VITE_SUPABASE_URL')
const ANON = requireEnv('VITE_SUPABASE_ANON_KEY')

export async function login(page: Page, account: { email: string; password: string }) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(account.email)
  await page.getByLabel('Password').fill(account.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/(home|admin)/, { timeout: 15_000 })
}

// --- Direct REST helpers, used to arrange/clean up state around UI tests -----
export async function apiToken(request: APIRequestContext, account: { email: string; password: string }): Promise<string> {
  const res = await request.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    data: { email: account.email, password: account.password },
  })
  return (await res.json()).access_token as string
}

function authHeaders(token: string) {
  return { apikey: ANON, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

export async function restInsert(request: APIRequestContext, token: string, table: string, row: Record<string, unknown>) {
  return request.post(`${SUPABASE_URL}/rest/v1/${table}`, {
    headers: { ...authHeaders(token), Prefer: 'return=representation' },
    data: row,
  })
}

export async function restDelete(request: APIRequestContext, token: string, table: string, query: string) {
  return request.delete(`${SUPABASE_URL}/rest/v1/${table}?${query}`, { headers: authHeaders(token) })
}

export async function restPatch(
  request: APIRequestContext, token: string, table: string, query: string, patch: Record<string, unknown>,
) {
  return request.patch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: { ...authHeaders(token), Prefer: 'return=representation' },
    data: patch,
  })
}
