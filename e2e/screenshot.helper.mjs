// One-off screenshot capture for visual review. Not a test.
// Usage: node e2e/screenshot.helper.mjs <baseURL> <outDir>
import { chromium } from '@playwright/test'
import { readFileSync } from 'node:fs'

for (const line of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2]
}

const [base = 'http://localhost:5199', out = '/tmp/shots'] = process.argv.slice(2)
const browser = await chromium.launch()

async function login(page, email, password) {
  await page.goto(`${base}/login`)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL(/\/(home|admin)/)
}

async function shot(page, path, name) {
  await page.goto(`${base}${path}`)
  await page.waitForLoadState('networkidle')
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: true })
}

// Anonymous, desktop
let ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
let page = await ctx.newPage()
await shot(page, '/', 'landing-desktop')

// Student
await login(page, 'avery.kim@crms.org', process.env.E2E_PASSWORD)
await shot(page, '/home', 'student-home')
await shot(page, '/board', 'board')
await shot(page, '/requests', 'student-requests')
const thread = await page.locator('a[href^="/requests/"]').first().getAttribute('href')
if (thread) await shot(page, thread, 'thread')
await ctx.close()

// Member
ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
page = await ctx.newPage()
await login(page, 'casey.ortega@example.com', process.env.E2E_PASSWORD)
await shot(page, '/home', 'member-home')
await shot(page, '/offers/new', 'offer-form')
await ctx.close()

// Admin
ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
page = await ctx.newPage()
await login(page, 'phoenix@cherney.com', process.env.E2E_STAFF_PASSWORD)
await shot(page, '/admin', 'admin-dashboard')
await shot(page, '/admin/people', 'admin-people')
await ctx.close()

// Mobile student
ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
page = await ctx.newPage()
await shot(page, '/', 'landing-mobile')
await login(page, 'avery.kim@crms.org', process.env.E2E_PASSWORD)
await shot(page, '/board', 'board-mobile')
await ctx.close()

await browser.close()
console.log('done')
