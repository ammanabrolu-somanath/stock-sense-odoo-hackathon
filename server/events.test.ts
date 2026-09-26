import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createApp } from './app.ts'
import { createContext, type AppContext } from './context.ts'
import { DEMO_USER } from './services/auth.service.ts'

let ctx: AppContext
let base: string
let close: () => void
let cookie: string

beforeAll(async () => {
  ctx = createContext({ now: () => new Date('2026-09-26T06:00:00Z') })
  ctx.auth.ensureUser(DEMO_USER)
  ctx.catalog.insertCategory('Raw Materials')
  const server = createApp(ctx).listen(0)
  await new Promise((r) => server.once('listening', r))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  close = () => server.close()
  const login = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: DEMO_USER.email, password: DEMO_USER.password }),
  })
  cookie = login.headers.get('set-cookie')!.split(';')[0]
})
afterAll(() => close())

describe('live updates (SSE)', () => {
  it('requires a session', async () => {
    expect((await fetch(`${base}/api/events`)).status).toBe(401)
  })

  it('streams a change event after a successful write, and nothing for a failed one', async () => {
    const controller = new AbortController()
    const res = await fetch(`${base}/api/events`, { headers: { cookie }, signal: controller.signal })
    expect(res.headers.get('content-type')).toMatch(/text\/event-stream/)
    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let received = ''
    const until = async (needle: string) => {
      while (!received.includes(needle)) received += decoder.decode((await reader.read()).value)
    }
    await until(': connected')

    // A failed write (validation error) must not broadcast…
    await fetch(`${base}/api/categories`, { method: 'POST', headers: { cookie, 'Content-Type': 'application/json' }, body: '{"name":""}' })
    // …a successful one must.
    await fetch(`${base}/api/categories`, { method: 'POST', headers: { cookie, 'Content-Type': 'application/json' }, body: '{"name":"Tools"}' })
    await until('event: change')
    controller.abort()

    const events = received.split('\n\n').filter((b) => b.startsWith('event: change'))
    expect(events).toHaveLength(1)
    const data = JSON.parse(events[0].split('data: ')[1])
    expect(data).toMatchObject({ method: 'POST', path: '/api/categories', userId: expect.any(Number) })
  })
})
