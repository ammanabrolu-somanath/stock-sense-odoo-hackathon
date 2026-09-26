import type { ErrorRequestHandler, NextFunction, Request, Response } from 'express'
import { ZodError, type z, type ZodTypeAny } from 'zod'

import { DomainError, type DomainErrorCode } from '@domain/errors.ts'
import type { SessionUser } from '@domain/api.ts'
import type { AppContext } from './context.ts'

export const SESSION_COOKIE = 'ss_session'

const STATUS: Record<DomainErrorCode, number> = {
  VALIDATION: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  INVALID_STATE: 409,
  INSUFFICIENT_STOCK: 409,
  CONFLICT: 409,
}

/** Parse input with a shared zod schema; failures become a 400 with per-field messages. */
export function parse<S extends ZodTypeAny>(schema: S, data: unknown): z.output<S> {
  const result = schema.safeParse(data)
  if (!result.success) {
    const fields = result.error.flatten().fieldErrors
    const first = result.error.issues[0]
    throw new DomainError('VALIDATION', first?.message ?? 'Invalid request.', { fields })
  }
  return result.data
}

export function idParam(req: Request, name = 'id'): number {
  const n = Number(req.params[name])
  if (!Number.isInteger(n) || n <= 0) throw new DomainError('NOT_FOUND', 'Not found.')
  return n
}

export function currentUser(res: Response): SessionUser {
  return res.locals.user as SessionUser
}

export function requireAuth(ctx: AppContext) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = ctx.auth.userForToken(req.cookies?.[SESSION_COOKIE])
    if (!user) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Please sign in to continue.' } })
      return
    }
    res.locals.user = user
    next()
  }
}

/** One error envelope for the whole API: { error: { code, message, details? } }. */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof DomainError) {
    res.status(STATUS[err.code]).json({ error: { code: err.code, message: err.message, details: err.details } })
    return
  }
  if (err instanceof ZodError) {
    res.status(400).json({ error: { code: 'VALIDATION', message: err.issues[0]?.message ?? 'Invalid request.' } })
    return
  }
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ error: { code: 'VALIDATION', message: 'Request body is not valid JSON.' } })
    return
  }
  if (typeof err?.message === 'string' && /constraint failed/i.test(err.message)) {
    // The schema caught something the service didn't — report it, never leak SQL.
    res.status(409).json({ error: { code: 'CONFLICT', message: 'That change conflicts with existing data.' } })
    return
  }
  console.error('[api] unhandled error', err)
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong on our side. Please try again.' } })
}
