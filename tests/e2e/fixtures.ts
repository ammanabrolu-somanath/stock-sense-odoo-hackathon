import { test as base, expect } from '@playwright/test'

/**
 * Every e2e test fails on: console.error, uncaught page errors, and 5xx API responses.
 * This is the "no console errors" quality gate made executable.
 */
export const test = base.extend<{ guard: void }>({
  guard: [
    async ({ page }, use) => {
      const problems: string[] = []
      page.on('console', (msg) => {
        if (msg.type() !== 'error') return
        // The browser logs every 4xx response itself; those are expected business answers
        // (wrong password, invalid code). 5xx are still caught below, app errors here.
        if (/^Failed to load resource: the server responded with a status of 4\d\d/.test(msg.text())) return
        problems.push(`console.error: ${msg.text()}`)
      })
      page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`))
      page.on('response', (res) => {
        if (res.url().includes('/api/') && res.status() >= 500) problems.push(`HTTP ${res.status()} ${res.url()}`)
      })
      await use()
      expect(problems, problems.join('\n')).toEqual([])
    },
    { auto: true },
  ],
})

export { expect }

export const DEMO = { email: 'demo@stocksense.in', password: 'demo1234' }

/** Sign in through the API; the browser context shares the session cookie. */
export async function loginAsDemo(page: import('@playwright/test').Page) {
  const res = await page.request.post('/api/auth/login', { data: DEMO })
  expect(res.ok(), await res.text()).toBe(true)
}
