import AxeBuilder from '@axe-core/playwright'

import { expect, loginAsDemo, test } from './fixtures'

/** WCAG 2.x A/AA scan of every main screen; serious and critical violations fail the build. */
async function scan(page: import('@playwright/test').Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  return results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id} (${v.impact}): ${v.help} → ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`)
}

test.describe('@smoke accessibility', () => {
  test('sign-in screen', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('button', { name: 'Sign in' }).waitFor()
    expect(await scan(page)).toEqual([])
  })

  test('main screens, light and dark', async ({ page }) => {
    test.setTimeout(120_000)
    await loginAsDemo(page)
    const delivery = (await (await page.request.get('/api/operations?type=delivery&status=ready')).json()).items[0]
    const steel = (await (await page.request.get('/api/products?q=RM-STL-012')).json()).items[0]
    const screens: [string, string][] = [
      ['/', 'Operations overview'],
      ['/products', 'Products'],
      [`/products/${steel.id}`, 'Recent movements'],
      ['/operations/deliveries', 'Deliveries'],
      [`/operations/deliveries/${delivery.id}`, 'Product lines'],
      ['/operations/adjustments/new', 'Product lines'],
      [`/moves?productId=${steel.id}`, 'Stock moves'],
      ['/settings/warehouses', 'Warehouses'],
    ]
    await page.goto('/')
    for (const theme of ['light', 'dark'] as const) {
      await page.evaluate((t) => localStorage.setItem('stocksense:theme', t), theme)
      for (const [path, table] of screens) {
        await page.goto(path)
        await page.getByRole('table', { name: table }).first().waitFor()
        expect(await scan(page), `${theme} ${path}`).toEqual([])
      }
    }
    await page.evaluate(() => localStorage.setItem('stocksense:theme', 'light'))
  })

  test('keyboard only: skip to a product with the table keys', async ({ page }) => {
    await loginAsDemo(page)
    await page.goto('/products')
    const first = page.locator('tbody tr[data-row]').first()
    await first.focus()
    await page.keyboard.press('ArrowDown')
    await expect(page.locator('tbody tr[data-row]').nth(1)).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/products\/\d+$/)
  })
})

test.describe('@smoke mobile layout', () => {
  test('no horizontal scrolling at 390px on the main screens', async ({ page }) => {
    test.setTimeout(90_000)
    await page.setViewportSize({ width: 390, height: 844 })
    await loginAsDemo(page)
    const steel = (await (await page.request.get('/api/products?q=RM-STL-012')).json()).items[0]
    const hyd = (await (await page.request.get('/api/warehouses')).json()).items[0]
    const delivery = (await (await page.request.get('/api/operations?type=delivery&status=ready')).json()).items[0]
    const paths = ['/', '/products', `/products/${steel.id}`, '/operations/deliveries', `/operations/deliveries/${delivery.id}`, '/operations/receipts/new', '/moves', '/settings/warehouses', `/settings/warehouses/${hyd.id}`, '/profile']
    for (const path of paths) {
      await page.goto(path)
      await page.getByRole('heading', { level: 1 }).waitFor()
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      expect(overflow, path).toBeLessThanOrEqual(0)
    }
  })
})
