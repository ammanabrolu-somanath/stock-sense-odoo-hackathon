import express, { type Express } from 'express'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'

import type { AppContext } from './context.ts'

export function createApp(ctx: AppContext): Express {
  const app = express()
  app.disable('x-powered-by')
  app.use(helmet())
  app.use(express.json({ limit: '100kb' }))
  app.use(cookieParser())

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

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'No such endpoint.' } })
  })

  return app
}
