import express, { type Express } from 'express'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'

import type { AppContext } from './context.ts'
import { resetDemo } from './db/reset.ts'
import { errorHandler, requireAuth } from './http.ts'
import { authRoutes } from './routes/auth.ts'
import { eventRoutes, publishWrites } from './routes/events.ts'
import { inventoryRoutes } from './routes/inventory.ts'
import { operationRoutes } from './routes/operations.ts'

export function createApp(ctx: AppContext): Express {
  const app = express()
  app.disable('x-powered-by')
  // Behind Vercel's /api rewrite in production: trust the first proxy for client IPs (rate limits).
  app.set('trust proxy', 1)
  app.use(helmet())
  app.use(express.json({ limit: '100kb' }))
  app.use(cookieParser())

  // ── Public ────────────────────────────────────────────────────────────────
  app.get('/api/health', (_req, res) => {
    const count = (table: string) => ctx.db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`)?.n ?? 0
    res.json({
      ok: true,
      service: 'stocksense-api',
      time: ctx.now().toISOString(),
      db: {
        warehouses: count('warehouses'),
        products: count('products'),
        operations: count('operations'),
        moves: count('stock_moves'),
        reconciled: ctx.stock.conservationCheck().length === 0,
      },
    })
  })
  app.use('/api/auth', authRoutes(ctx))

  // ── Signed in ─────────────────────────────────────────────────────────────
  const authed = express.Router()
  authed.use(requireAuth(ctx))
  authed.use(publishWrites(ctx))
  authed.use(eventRoutes(ctx))
  authed.use('/operations', operationRoutes(ctx))
  authed.use(inventoryRoutes(ctx))
  authed.post('/demo/reset', (_req, res) => {
    res.json({ ok: true, ...resetDemo(ctx) })
  })
  app.use('/api', authed)

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'No such endpoint.' } })
  })
  app.use(errorHandler)
  return app
}
