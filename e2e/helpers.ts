import type { Page } from '@playwright/test'
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

export async function login(page: Page, account: { email: string; password: string }) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(account.email)
  await page.getByLabel('Password').fill(account.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/(home|admin)/, { timeout: 15_000 })
}
