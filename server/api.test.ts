import request from 'supertest'
import { beforeAll, describe, expect, it } from 'vitest'

import { createApp } from './app.ts'
import { createContext, type AppContext } from './context.ts'
import { bootstrap } from './db/reset.ts'
import { DEMO_USER } from './services/auth.service.ts'

const NOW = new Date('2026-09-26T06:30:00Z')

function freshApp() {
  const ctx = createContext({ now: () => NOW })
  ctx.auth.ensureUser(DEMO_USER)
  return { ctx, app: createApp(ctx) }
}

describe('auth', () => {
  it('signs up with an httpOnly session, knows who you are, and signs out', async () => {
    const { app } = freshApp()
    const agent = request.agent(app)
    const res = await agent.post('/api/auth/signup').send({ name: 'Priya Sharma', email: 'Priya@Example.com', password: 'correct horse' })
    expect(res.status).toBe(201)
    expect(res.body.user).toMatchObject({ name: 'Priya Sharma', email: 'priya@example.com' })
    expect(res.body.user.passwordHash).toBeUndefined()
    expect(String(res.headers['set-cookie'])).toMatch(/ss_session=.+HttpOnly/i)

    expect((await agent.get('/api/auth/me')).body.user.email).toBe('priya@example.com')
    expect((await agent.post('/api/auth/logout')).status).toBe(204)
    expect((await agent.get('/api/auth/me')).body.user).toBeNull()
  })

  it('refuses duplicate accounts and bad input with readable messages', async () => {
    const { app } = freshApp()
    const dup = await request(app).post('/api/auth/signup').send({ name: 'X', email: DEMO_USER.email, password: '12345678' })
    expect(dup.status).toBe(409)
    expect(dup.body.error.message).toMatch(/already exists/)

    const bad = await request(app).post('/api/auth/signup').send({ name: '', email: 'nope', password: 'short' })
    expect(bad.status).toBe(400)
    expect(bad.body.error.details.fields).toHaveProperty('email')
    expect(bad.body.error.details.fields).toHaveProperty('password')
  })

  it('gives the same answer for a wrong password and an unknown email', async () => {
    const { app } = freshApp()
    const wrong = await request(app).post('/api/auth/login').send({ email: DEMO_USER.email, password: 'wrong-password' })
    const unknown = await request(app).post('/api/auth/login').send({ email: 'ghost@example.com', password: 'whatever1' })
    expect(wrong.status).toBe(401)
    expect(unknown.status).toBe(401)
    expect(wrong.body.error.message).toBe(unknown.body.error.message)
  })

  it('resets a password with a single-use OTP and signs out old sessions', async () => {
    const { app } = freshApp()
    const oldSession = request.agent(app)
    await oldSession.post('/api/auth/login').send({ email: DEMO_USER.email, password: DEMO_USER.password })

    const req = await request(app).post('/api/auth/otp/request').send({ email: DEMO_USER.email })
    expect(req.body.demoCode).toMatch(/^\d{6}$/)
    const code: string = req.body.demoCode
    const wrongCode = code === '000000' ? '111111' : '000000'

    const miss = await request(app).post('/api/auth/otp/verify').send({ email: DEMO_USER.email, code: wrongCode })
    expect(miss.status).toBe(400)
    expect(miss.body.error.message).toMatch(/4 attempts left/)
    expect((await request(app).post('/api/auth/otp/verify').send({ email: DEMO_USER.email, code })).status).toBe(200)

    const reset = await request(app).post('/api/auth/otp/reset').send({ email: DEMO_USER.email, code, password: 'new-password-1' })
    expect(reset.status).toBe(200)
    expect((await oldSession.get('/api/auth/me')).body.user).toBeNull()

    const again = await request(app).post('/api/auth/otp/reset').send({ email: DEMO_USER.email, code, password: 'another-pass' })
    expect(again.status).toBe(400)
    const login = await request(app).post('/api/auth/login').send({ email: DEMO_USER.email, password: 'new-password-1' })
    expect(login.status).toBe(200)
  })

  it('burns a code after five wrong guesses', async () => {
    const { app } = freshApp()
    const { body } = await request(app).post('/api/auth/otp/request').send({ email: DEMO_USER.email })
    const wrong = body.demoCode === '000000' ? '111111' : '000000'
    for (let i = 0; i < 5; i++) await request(app).post('/api/auth/otp/verify').send({ email: DEMO_USER.email, code: wrong })
    const right = await request(app).post('/api/auth/otp/verify').send({ email: DEMO_USER.email, code: body.demoCode })
    expect(right.status).toBe(400)
    expect(right.body.error.message).toMatch(/Request a new one/)
  })

  it('does not reveal a code for unknown emails', async () => {
    const { app } = freshApp()
    const res = await request(app).post('/api/auth/otp/request').send({ email: 'ghost@example.com' })
    expect(res.status).toBe(200)
    expect(res.body.demoCode).toBeUndefined()
  })

  it('protects everything but health and auth', async () => {
    const { app } = freshApp()
    for (const path of ['/api/products', '/api/operations', '/api/moves', '/api/warehouses', '/api/nope']) {
      const res = await request(app).get(path)
      expect(res.status, path).toBe(401)
      expect(res.body.error.code).toBe('UNAUTHORIZED')
    }
  })
})

describe('inventory API (seeded)', () => {
  let ctx: AppContext
  let agent: ReturnType<typeof request.agent>

  beforeAll(async () => {
    ctx = createContext({ now: () => NOW })
    bootstrap(ctx)
    agent = request.agent(createApp(ctx))
    await agent.post('/api/auth/login').send({ email: DEMO_USER.email, password: DEMO_USER.password })
  }, 60_000)

  it('lists products with stock status computed from the ledger', async () => {
    const { body } = await agent.get('/api/products')
    expect(body.items.length).toBe(34)
    const out = await agent.get('/api/products?status=out')
    expect(out.body.items.map((p: { sku: string }) => p.sku)).toContain('EL-UPS-1K')
    const search = await agent.get('/api/products?q=steel')
    expect(search.body.items[0].sku).toBe('RM-STL-012')
  })

  it('creates a product with initial stock as an audited move, and rejects duplicate SKUs', async () => {
    const shelf = ctx.inventory.listLocations().find((l) => l.fullName === 'HYD/Stock')!
    const created = await agent.post('/api/products').send({
      sku: 'el-scn-bt',
      name: 'Wireless Barcode Scanner',
      categoryId: 2,
      uom: 'unit',
      cost: 2800,
      price: 3999,
      reorderMin: 5,
      reorderMax: 30,
      leadTimeDays: 10,
      initialStock: { locationId: shelf.id, qty: 12 },
    })
    expect(created.status).toBe(201)
    expect(created.body).toMatchObject({ sku: 'EL-SCN-BT', onHand: 12, status: 'in_stock' })
    expect(created.body.stock).toEqual([expect.objectContaining({ fullName: 'HYD/Stock', qty: 12 })])

    const moves = await agent.get(`/api/moves?productId=${created.body.id}`)
    expect(moves.body.items).toHaveLength(1)
    expect(moves.body.items[0]).toMatchObject({ type: 'adjustment', delta: 12, balance: 12, toLocation: 'HYD/Stock' })

    const dup = await agent.post('/api/products').send({ ...created.body, initialStock: null })
    expect(dup.status).toBe(409)
  })

  it('runs a document through its lifecycle over HTTP with a running ledger balance', async () => {
    const shelf = ctx.inventory.listLocations().find((l) => l.fullName === 'BLR/Stock')!
    const product = (await agent.get('/api/products?q=USB-C')).body.items[0]
    const before = product.onHand

    const receipt = await agent.post('/api/operations').send({
      type: 'receipt',
      partner: 'Robu Components',
      destLocationId: shelf.id,
      lines: [{ productId: product.id, qty: 50 }],
    })
    expect(receipt.status).toBe(201)
    expect(receipt.body.reference).toMatch(/^BLR\/IN\/\d{5}$/)
    const done = await agent.post(`/api/operations/${receipt.body.id}/validate`)
    expect(done.body.status).toBe('done')

    const moves = await agent.get(`/api/moves?productId=${product.id}&pageSize=1`)
    expect(moves.body.total).toBeGreaterThan(1)
    expect(moves.body.items[0]).toMatchObject({ reference: receipt.body.reference, delta: 50, balance: before + 50 })
  })

  it('explains an impossible delivery with a 409 and the exact shortage', async () => {
    const shelf = ctx.inventory.listLocations().find((l) => l.fullName === 'HYD/Stock')!
    const product = (await agent.get('/api/products?q=Steel Rods')).body.items[0]
    const op = await agent.post('/api/operations').send({
      type: 'delivery',
      partner: 'Tata Projects',
      sourceLocationId: shelf.id,
      lines: [{ productId: product.id, qty: 999_999 }],
    })
    expect((await agent.post(`/api/operations/${op.body.id}/confirm`)).body.status).toBe('waiting')
    const res = await agent.post(`/api/operations/${op.body.id}/validate`)
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('INSUFFICIENT_STOCK')
    expect(res.body.error.message).toMatch(/^Only .* kg of Steel Rods 12mm on hand at HYD\/Stock — 999999 kg requested\.$/)
  })

  it('filters documents by type and status, enriched with names', async () => {
    const { body } = await agent.get('/api/operations?type=delivery&status=waiting')
    expect(body.items.length).toBeGreaterThan(0)
    const first = body.items[0]
    expect(first.sourceLocation).toMatch(/\/Stock$/)
    expect(first.destLocation).toBe('Partners/Customers')
    expect(first.lines[0]).toHaveProperty('productName')
  })

  it('lists warehouses with utilization and locations', async () => {
    const { body } = await agent.get('/api/warehouses')
    expect(body.items.map((w: { code: string }) => w.code)).toEqual(['HYD', 'BLR', 'BOM'])
    expect(body.items[0].locations.map((l: { name: string }) => l.name)).toEqual(['Stock', 'Rack A', 'Rack B', 'Production Floor'])
    expect(body.items[0].utilization).toBeGreaterThan(0)
  })

  it('returns 404 envelopes for missing records and unknown endpoints', async () => {
    expect((await agent.get('/api/products/99999')).status).toBe(404)
    expect((await agent.get('/api/operations/99999')).body.error.code).toBe('NOT_FOUND')
    expect((await agent.get('/api/nope')).status).toBe(404)
  })

  it('resets demo data without signing the user out', async () => {
    const res = await agent.post('/api/demo/reset')
    expect(res.body.ok).toBe(true)
    expect((await agent.get('/api/auth/me')).body.user.email).toBe(DEMO_USER.email)
    expect((await agent.get('/api/products?q=EL-SCN-BT')).body.items).toEqual([])
  }, 60_000)
})
