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
        if (msg.type() === 'error') problems.push(`console.error: ${msg.text()}`)
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
