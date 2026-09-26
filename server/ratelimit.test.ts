import request from 'supertest'
import { beforeAll, describe, expect, it } from 'vitest'

import type { Express } from 'express'

/**
 * Production limits (read at module load), so set NODE_ENV before importing the app.
 * An attacker rotating forged X-Forwarded-For values must still be stopped per account.
 */
let app: Express

beforeAll(async () => {
  process.env.NODE_ENV = 'production'
  const { createApp } = await import('./app.ts')
  const { createContext } = await import('./context.ts')
  const { DEMO_USER } = await import('./services/auth.service.ts')
  const ctx = createContext()
  ctx.auth.ensureUser(DEMO_USER)
  app = createApp(ctx)
})

describe('credential rate limits (production)', () => {
  it('lock an account after 10 wrong passwords even when every attempt claims a new IP', async () => {
    const attempt = (i: number) =>
      request(app)
        .post('/api/auth/login')
        .set('X-Forwarded-For', `203.0.113.${i}`)
        .send({ email: 'demo@stocksense.in', password: `guess-${i}` })
    for (let i = 1; i <= 10; i++) expect((await attempt(i)).status).toBe(401)
    const blocked = await attempt(11)
    expect(blocked.status).toBe(429)
    expect(blocked.body.error.code).toBe('RATE_LIMITED')

    // Another account is unaffected.
    const other = await request(app).post('/api/auth/login').set('X-Forwarded-For', '198.51.100.7').send({ email: 'someone@example.com', password: 'whatever1' })
    expect(other.status).toBe(401)
  }, 30_000)
})
