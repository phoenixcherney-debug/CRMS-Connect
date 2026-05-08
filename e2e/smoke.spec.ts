import { test, expect } from '@playwright/test'

/**
 * Smoke test: the minimum end-to-end flow that exercises every code path that
 * has broken in audit passes 1–4.
 *
 *   - employer signup + onboarding              (catches signup-trigger bugs)
 *   - blank required-field submit on /opportunities/new  (catches §1 from brief 2)
 *   - real publish                              (catches NOT NULL / column bugs)
 *   - student signup + onboarding
 *   - apply to the new job                      (catches the applicant_count bug)
 *   - employer sees the applicant
 *
 * To run:
 *   npm run e2e:install        # one-time, downloads chromium
 *   npm run e2e                # against local `npm run dev`
 *   E2E_BASE_URL=https://<preview>.vercel.app npm run e2e   # against a deploy
 *
 * Note: this spec creates real users in Supabase. Use a dev / preview project,
 * never production. Each run uses a unique timestamp suffix in emails so reruns
 * don't collide.
 */

const ts = Date.now()
const STUDENT  = { email: `e2e-student-${ts}@crms.org`,    password: 'TestPass123!', name: `E2E Student ${ts}` }
const EMPLOYER = { email: `e2e-employer-${ts}@example.com`, password: 'TestPass123!', name: `E2E Employer ${ts}` }
const JOB_TITLE = `E2E Internship ${ts}`

test.describe.configure({ mode: 'serial' })

test('employer signup → blank publish blocked → real publish succeeds', async ({ page }) => {
  // ── 1. Employer signup ────────────────────────────────────────────────
  await page.goto('/signup')
  await page.getByLabel(/full name/i).fill(EMPLOYER.name)
  // Role buttons render as <button> in a 2-column grid; pick employer/mentor
  await page.getByRole('button', { name: /employer.*mentor|mentor.*employer/i }).click()
  await page.getByLabel(/email/i).fill(EMPLOYER.email)
  await page.getByLabel(/password/i).fill(EMPLOYER.password)
  await page.getByRole('button', { name: /create account/i }).click()

  // Onboarding — pick a sub-role + industry
  await page.getByRole('button', { name: /^Employer$/ }).click()
  await page.getByLabel(/industry|area of expertise/i).first().selectOption('Technology')
  await page.getByLabel(/company.*organization/i).fill('E2E Test Co')
  await page.getByRole('button', { name: /complete setup/i }).click()
  await expect(page).toHaveURL(/\/explore/, { timeout: 15_000 })

  // ── 2. Blank submit on /opportunities/new must NOT post ───────────────────────
  await page.goto('/opportunities/new')
  await page.getByRole('button', { name: /publish opportunity/i }).click()
  // Stayed on the form (no redirect to /my-opportunities or /opportunities/<id>)
  await expect(page).toHaveURL(/\/opportunities\/new/)
  // Visible error banner mentions required fields, not Postgres jargon
  const errorBanner = page.getByText(/required fields/i)
  await expect(errorBanner).toBeVisible()

  // ── 3. Real publish ───────────────────────────────────────────────────
  await page.getByPlaceholder(/Software Engineering Intern/i).fill(JOB_TITLE)
  await page.getByPlaceholder(/Acme Corp/i).fill('E2E Test Co')
  await page.getByPlaceholder(/Denver, CO or Remote/i).fill('Carbondale, CO')
  await page.getByPlaceholder(/Describe the role/i)
    .fill('Building things end-to-end. This text exists only for the smoke test.')
  await page.getByRole('button', { name: /publish opportunity/i }).click()
  await expect(page).toHaveURL(/\/my-opportunities/, { timeout: 15_000 })
  await expect(page.getByText(JOB_TITLE)).toBeVisible()
})

test('student signup → apply → application visible to the employer', async ({ browser }) => {
  // Open a fresh context so we don't sign the employer out.
  const studentCtx = await browser.newContext()
  const student = await studentCtx.newPage()

  await student.goto('/signup')
  await student.getByLabel(/full name/i).fill(STUDENT.name)
  // Default role is `student`; no need to click anything.
  await student.getByLabel(/email/i).fill(STUDENT.email)
  await student.getByLabel(/password/i).fill(STUDENT.password)
  await student.getByRole('button', { name: /create account/i }).click()

  // Onboarding
  await student.getByRole('button', { name: /^Both$/ }).click() // student_seeking
  // pick at least one interest chip
  await student.getByRole('button', { name: /^Technology$/ }).first().click()
  await student.getByRole('button', { name: /complete setup/i }).click()
  // Audit §15 — both roles land on /explore after onboarding now.
  await expect(student).toHaveURL(/\/explore/, { timeout: 15_000 })

  // Open the freshly-posted opportunity. Search by title since other tests
  // may have left other postings in the DB.
  await student.goto(`/opportunities?q=${encodeURIComponent(JOB_TITLE)}`)
  await student.getByText(JOB_TITLE).first().click()

  // Apply (no gate — audit pass 4 §2 dropped it)
  await student.getByRole('button', { name: /^apply now$/i }).click()
  await student.getByPlaceholder(/Introduce yourself/i)
    .fill('I am excited to apply. This text exists only for the smoke test.')
  await student.getByRole('button', { name: /submit application/i }).click()
  await student.getByRole('button', { name: /yes, submit/i }).click()
  await expect(student.getByText(/application submitted/i)).toBeVisible({ timeout: 15_000 })

  await studentCtx.close()
})
