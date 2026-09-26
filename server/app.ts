import express, { type Express } from 'express'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'

export function createApp(): Express {
  const app = express()
  app.disable('x-powered-by')
  app.use(helmet())
  app.use(express.json({ limit: '100kb' }))
  app.use(cookieParser())

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'stocksense-api', time: new Date().toISOString() })
  })

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'No such endpoint.' } })
  })

  return app
}
