import { EventEmitter } from 'node:events'
import { Router, type NextFunction, type Request, type Response } from 'express'

import type { AppContext } from '../context.ts'

export interface ChangeEvent {
  at: string
  method: string
  path: string
  /** The session user who caused it, so a client can ignore its own echo if it wants. */
  userId: number | null
}

/** In-process pub/sub: one API instance, so no broker is needed. */
export function createEventBus() {
  const bus = new EventEmitter()
  bus.setMaxListeners(200)
  return {
    publish: (e: ChangeEvent) => bus.emit('change', e),
    subscribe: (fn: (e: ChangeEvent) => void) => {
      bus.on('change', fn)
      return () => bus.off('change', fn)
    },
  }
}
export type EventBus = ReturnType<typeof createEventBus>

/** After any successful write, tell every connected client that stock-derived numbers changed. */
export function publishWrites(ctx: AppContext) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET') {
      res.on('finish', () => {
        if (res.statusCode < 400) {
          ctx.events.publish({ at: ctx.now().toISOString(), method: req.method, path: req.originalUrl, userId: res.locals.user?.id ?? null })
        }
      })
    }
    next()
  }
}

/** Server-Sent Events stream: `event: change` per write, a comment heartbeat every 25 s. */
export function eventRoutes(ctx: AppContext): Router {
  const r = Router()
  r.get('/events', (req, res) => {
    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    })
    res.flushHeaders()
    res.write('retry: 3000\n: connected\n\n')
    const unsubscribe = ctx.events.subscribe((e) => res.write(`event: change\ndata: ${JSON.stringify(e)}\n\n`))
    const heartbeat = setInterval(() => res.write(': ping\n\n'), 25_000)
    req.on('close', () => {
      clearInterval(heartbeat)
      unsubscribe()
    })
  })
  return r
}
