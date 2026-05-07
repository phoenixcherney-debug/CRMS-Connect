import { test, expect } from '@playwright/test'

/**
 * Auth-correctness regressions worth protecting:
 *
 *   §1  Signing out lands on /login and the previous user's name is no
 *       longer in the DOM (no manual reload required).
 *   §2  Visiting /jobs/{X}/applicants as an employer who does NOT own job X
 *       returns a "Page not found" view — not the inbox chrome.
 *
 * Like e2e/smoke.spec.ts these tests create real users in Supabase. Use a
 * dev / preview project, never production.
 */

const ts = Date.now()
const EMPLOYER_A = { email: `e2e-emp-a-${ts}@example.com`, password: 'TestPass123!', name: `E2E EmpA ${ts}` }
const EMPLOYER_B = { email: `e2e-emp-b-${ts}@example.com`, password: 'TestPass123!', name: `E2E EmpB ${ts}` }
const JOB_TITLE  = `Auth-Spec Internship ${ts}`

test.describe.configure({ mode: 'serial' })

async function signUpEmployer(page: import('@playwright/test').Page, who: typeof EMPLOYER_A) {
  await page.goto('/signup')
  await page.getByLabel(/full name/i).fill(who.name)
  await page.getByRole('button', { name: /employer.*mentor|mentor.*employer/i }).click()
  await page.getByLabel(/email/i).fill(who.email)
  await page.getByLabel(/password/i).fill(who.password)
  await page.getByRole('button', { name: /create account/i }).click()

  // Onboarding
  await page.getByRole('button', { name: /^Employer$/ }).click()
  await page.getByLabel(/industry|area of expertise/i).first().selectOption('Technology')
  await page.getByLabel(/company.*organization/i).fill('AuthSpec Co')
  await page.getByRole('button', { name: /complete setup/i }).click()
  await expect(page).toHaveURL(/\/explore/, { timeout: 15_000 })
}

test('§2: non-owner cannot view /jobs/:id/applicants', async ({ browser }) => {
  // Employer A signs up and posts a job.
  const ctxA = await browser.newContext()
  const a    = await ctxA.newPage()
  await signUpEmployer(a, EMPLOYER_A)
  await a.goto('/jobs/new')
  await a.getByPlaceholder(/Software Engineering Intern/i).fill(JOB_TITLE)
  await a.getByPlaceholder(/Acme Corp/i).fill('AuthSpec Co')
  await a.getByPlaceholder(/Denver, CO or Remote/i).fill('Carbondale, CO')
  await a.getByPlaceholder(/Describe the role/i).fill('Auth spec — applicants 404 test.')
  await a.getByRole('button', { name: /publish opportunity/i }).click()
  await expect(a).toHaveURL(/\/my-postings/, { timeout: 15_000 })

  // Pull the new job's id from the link-out on the My Opportunities row.
  const jobLink = a.locator('a[href^="/jobs/"]').first()
  const href    = await jobLink.getAttribute('href')
  const match   = href?.match(/\/jobs\/([0-9a-f-]+)/)
  expect(match, 'expected /jobs/{id} link on My Opportunities').toBeTruthy()
  const jobId = match![1]
  await ctxA.close()

  // Employer B signs up in a fresh context and visits A's applicants URL.
  const ctxB = await browser.newContext()
  const b    = await ctxB.newPage()
  await signUpEmployer(b, EMPLOYER_B)
  await b.goto(`/jobs/${jobId}/applicants`)
  // Should see the 404 view, NOT the "Applicants" inbox chrome.
  await expect(b.getByRole('heading', { name: /page not found/i })).toBeVisible()
  await expect(b.getByText(/no new applicants/i)).toHaveCount(0)
  await ctxB.close()
})

test('§1: sign-out redirects to /login and clears the previous user from the DOM', async ({ page }) => {
  // Sign in as employer A (created above).
  await page.goto('/login')
  await page.getByLabel(/email/i).fill(EMPLOYER_A.email)
  await page.getByLabel(/password/i).fill(EMPLOYER_A.password)
  await page.getByRole('button', { name: /^sign in$/i }).click()
  await expect(page).toHaveURL(/\/explore|\/jobs|\/my-postings/, { timeout: 15_000 })

  // Confirm the dashboard greeting includes the user's first name.
  const firstName = EMPLOYER_A.name.split(' ')[0]
  await expect(page.getByText(firstName).first()).toBeVisible()

  // Open the menu and click Sign out.
  await page.getByRole('button', { name: /open menu/i }).click()
  await page.getByRole('button', { name: /^sign out$/i }).click()

  // Land on /login within a generous timeout. No manual reload required.
  await expect(page).toHaveURL(/\/login/, { timeout: 5_000 })

  // The previous user's name should be gone from the DOM.
  await expect(page.getByText(firstName)).toHaveCount(0)
})
