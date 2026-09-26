import { request, type FullConfig } from '@playwright/test'

/**
 * Every e2e run starts from the seeded demo state, in its own database (data/e2e.db, set in
 * playwright.config.ts), so results never depend on what earlier runs or a developer changed.
 */
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use.baseURL ?? 'http://localhost:5173'
  const api = await request.newContext({ baseURL })
  const login = await api.post('/api/auth/login', { data: { email: 'demo@stocksense.in', password: 'demo1234' } })
  if (!login.ok()) throw new Error(`e2e setup: demo login failed (${login.status()})`)
  const reset = await api.post('/api/demo/reset', { timeout: 60_000 })
  if (!reset.ok()) throw new Error(`e2e setup: demo reset failed (${reset.status()})`)
  await api.dispose()
}
