import { expect, loginAsDemo, test } from './fixtures'

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
    expect(body.db.warehouses).toBeGreaterThanOrEqual(3) // seeded HYD, BLR, BOM (+ any created by other tests)
    expect(body.db.moves).toBeGreaterThan(500)
    expect(body.db.reconciled).toBe(true)
  })

  for (const [path, heading] of appRoutes) {
    test(`renders ${path}`, async ({ page }) => {
      await loginAsDemo(page)
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
    })
  }

  test('sidebar navigates between modules', async ({ page }) => {
    await loginAsDemo(page)
    await page.goto('/')
    const nav = page.getByRole('navigation', { name: 'Main' })
    await nav.getByRole('link', { name: 'Deliveries' }).click()
    await expect(page).toHaveURL(/\/operations\/deliveries$/)
    await nav.getByRole('link', { name: 'Move History' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Move History' })).toBeVisible()
  })

  test('demo login (prefilled) lands on the dashboard', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible()
  })

  test('signed-out visitors are sent to login and returned afterwards', async ({ page }) => {
    await page.goto('/moves')
    await expect(page).toHaveURL(/\/login\?next=%2Fmoves$/)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Move History' })).toBeVisible()
  })

  test('unknown routes show 404 inside the shell', async ({ page }) => {
    await loginAsDemo(page)
    await page.goto('/does-not-exist')
    await expect(page.getByRole('heading', { name: "This page doesn't exist" })).toBeVisible()
  })
})
