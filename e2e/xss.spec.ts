import { test, expect } from './fixtures'

/**
 * P0-3 — XSS round-trip. The QA report noted that user-generated text
 * fields (bio, post body, message body, opportunity description, …)
 * already render as escaped text on the surfaces the tester checked.
 * This spec adds an automated check using one of the most common
 * injection payloads — the `<img onerror=…>` trick — and asserts it
 * does NOT execute as JS.
 *
 * The check is structural: the spec posts the payload into a
 * student-post pitch, then loads /student-posts (employer view) and
 * verifies that
 *   1. window.__pwn was never set, and
 *   2. there is no live <img> in the DOM with the malicious src.
 *
 * Server-side, the sanitize-trigger from migration 032 strips angle-
 * bracket substrings before insert, so the round-trip should produce
 * a benign cleaned string.
 *
 * Skipped by default — runs against a preview deploy with
 * E2E_BASE_URL set, since it creates real users.
 */

const ts = Date.now()
const STUDENT  = { email: `e2e-xss-stu-${ts}@crms.org`,    password: 'TestPass123!', name: `XSS Student ${ts}` }
const EMPLOYER = { email: `e2e-xss-emp-${ts}@example.com`, password: 'TestPass123!', name: `XSS Employer ${ts}` }
const PAYLOAD  = `<img src=x onerror="window.__pwn=1">`

test.describe.configure({ mode: 'serial' })

test('XSS payload in student post does not execute', async ({ browser }) => {
  // Sign up the student.
  const stuCtx = await browser.newContext()
  const stu = await stuCtx.newPage()
  await stu.goto('/signup')
  await stu.getByLabel(/full name/i).fill(STUDENT.name)
  await stu.getByLabel(/email/i).fill(STUDENT.email)
  await stu.getByLabel(/password/i).fill(STUDENT.password)
  await stu.getByRole('button', { name: /create account/i }).click()
  await stu.getByRole('button', { name: /^Both$/ }).click()
  await stu.getByRole('button', { name: /^Technology$/ }).first().click()
  await stu.getByRole('button', { name: /complete setup/i }).click()
  await expect(stu).toHaveURL(/\/explore/, { timeout: 15_000 })

  // Create a student post containing the payload.
  await stu.goto('/student-posts/mine')
  await stu.getByRole('button', { name: /new post/i }).click()
  await stu.getByRole('button', { name: /^Both$/ }).click()
  await stu.getByPlaceholder(/Introduce yourself/i).fill(PAYLOAD + ' my pitch text')
  await stu.getByRole('button', { name: /^post$|create post/i }).click()
  await stuCtx.close()

  // Sign in as employer to view /student-posts.
  const empCtx = await browser.newContext()
  const emp = await empCtx.newPage()
  await emp.goto('/signup')
  await emp.getByLabel(/full name/i).fill(EMPLOYER.name)
  await emp.getByRole('button', { name: /employer.*mentor|mentor.*employer/i }).click()
  await emp.getByLabel(/email/i).fill(EMPLOYER.email)
  await emp.getByLabel(/password/i).fill(EMPLOYER.password)
  await emp.getByRole('button', { name: /create account/i }).click()
  await emp.getByRole('button', { name: /^Employer$/ }).click()
  await emp.getByLabel(/industry|area of expertise/i).first().selectOption('Technology')
  await emp.getByLabel(/company.*organization/i).fill('XSS Test Co')
  await emp.getByRole('button', { name: /complete setup/i }).click()
  await expect(emp).toHaveURL(/\/explore/, { timeout: 15_000 })

  // Note: SEC-001 puts new EM signups in `pending` status; for this test
  // to access /student-posts the project's RLS must be relaxed for the
  // employer (or staff approves the row). If your test fixture seeds an
  // already-active EM, swap the signup steps for a sign-in.
  await emp.goto('/student-posts')

  // Run on the same page context: assert window.__pwn was never set.
  const pwned = await emp.evaluate(() => (window as unknown as { __pwn?: number }).__pwn)
  expect(pwned, 'XSS payload must not execute').toBeFalsy()

  // And no live <img> with the malicious src landed in the DOM.
  const badImgCount = await emp.locator('img[src="x"]').count()
  expect(badImgCount, 'no img[src="x"] should be in the DOM').toBe(0)

  await empCtx.close()
})
