#!/usr/bin/env tsx
/**
 * Task 8 — fetches every footer link referenced from the public
 * pages and asserts each returns 200 (or a redirect that resolves
 * to 200). Wire into CI (npm script `check:links`) so future drops
 * like /why → 404 get caught before deploy.
 *
 * Usage:
 *   BASE_URL=https://crms-connect-sq6y.vercel.app npx tsx scripts/check-links.ts
 *
 * Defaults to localhost:5173 when BASE_URL isn't set.
 */

// Mirror the footer links from Landing.tsx + the global Footer.
// Update this list when you add new global links.
const FOOTER_PATHS = [
  '/',
  '/about',
  '/why',          // Task 8 — must redirect to /about
  '/privacy',
  '/contact',
  '/for-mentors',
  '/for-employers',
  '/login',
  '/signup',
]

const BASE = (process.env.BASE_URL ?? 'http://localhost:5173').replace(/\/$/, '')

async function checkOne(path: string): Promise<{ path: string; ok: boolean; status: number; note?: string }> {
  const url = `${BASE}${path}`
  try {
    const res = await fetch(url, { redirect: 'follow' })
    return {
      path,
      ok: res.ok,
      status: res.status,
      note: res.redirected ? `→ ${new URL(res.url).pathname}` : undefined,
    }
  } catch (err) {
    return {
      path,
      ok: false,
      status: 0,
      note: err instanceof Error ? err.message : String(err),
    }
  }
}

async function main() {
  console.log(`Checking ${FOOTER_PATHS.length} paths under ${BASE}`)
  const results = await Promise.all(FOOTER_PATHS.map(checkOne))
  let failed = 0
  for (const r of results) {
    const tag = r.ok ? 'ok' : 'FAIL'
    const note = r.note ? ` (${r.note})` : ''
    console.log(`  [${tag}] ${r.status} ${r.path}${note}`)
    if (!r.ok) failed++
  }
  if (failed > 0) {
    console.error(`\n${failed} link(s) failed.`)
    process.exit(1)
  }
  console.log('\nAll links OK.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
