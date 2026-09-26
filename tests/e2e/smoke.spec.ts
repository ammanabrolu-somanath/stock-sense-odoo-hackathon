import { expect, test } from './fixtures'

const appRoutes: [path: string, heading: string][] = [
  ['/', 'Dashboard'],
  ['/products', 'Products'],
  ['/operations/receipts', 'Receipts'],
  ['/operations/deliveries', 'Deliveries'],
  ['/operations/transfers', 'Transfers'],
  ['/operations/adjustments', 'Adjustments'],
  ['/moves', 'Move History'],
  ['/settings/warehouses', 'Warehouses'],
  ['/settings/general', 'General'],
  ['/profile', 'My Profile'],
]

test.describe('@smoke shell', () => {
  test('API serves a seeded, reconciled ledger through the dev proxy', async ({ request }) => {
    const res = await request.get('/api/health')
    expect(res.ok()).toBe(true)
    const body = await res.json()
    expect(body.ok).toBe(true)
    // Hour 2: the API serves a seeded, reconciled ledger.
    expect(body.db.warehouses).toBe(3)
    expect(body.db.moves).toBeGreaterThan(500)
    expect(body.db.reconciled).toBe(true)
  })

  for (const [path, heading] of appRoutes) {
    test(`renders ${path}`, async ({ page }) => {
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
    })
  }

  test('sidebar navigates between modules', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: 'Deliveries' }).click()
    await expect(page).toHaveURL(/\/operations\/deliveries$/)
    await page.getByRole('link', { name: 'Move History' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Move History' })).toBeVisible()
  })

  test('login → dashboard', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/\/$/)
  })

  test('forgot password walks email → OTP → new password', async ({ page }) => {
    await page.goto('/forgot-password')
    await page.getByLabel('Email').fill('demo@stocksense.in')
    await page.getByRole('button', { name: 'Send code' }).click()
    await page.keyboard.type('123456')
    await page.getByRole('button', { name: 'Verify code' }).click()
    await expect(page.getByLabel('New password')).toBeVisible()
  })

  test('unknown routes show 404 inside the shell', async ({ page }) => {
    await page.goto('/does-not-exist')
    await expect(page.getByRole('heading', { name: "This page doesn't exist" })).toBeVisible()
  })
})
