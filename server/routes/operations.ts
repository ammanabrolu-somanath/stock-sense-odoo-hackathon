import { Router } from 'express'

import { operationInputSchema, operationPatchSchema, operationQuerySchema, pickSchema } from '@domain/schemas.ts'
import type { AppContext } from '../context.ts'
import { currentUser, idParam, parse } from '../http.ts'

/** Documents and their lifecycle actions. Every action returns the updated, enriched document. */
export function operationRoutes(ctx: AppContext): Router {
  const r = Router()
  const view = (id: number) => ctx.inventory.getOperation(id)

  r.get('/', (req, res) => {
    const filter = parse(operationQuerySchema, req.query)
    res.json({ items: ctx.inventory.enrichOperations(ctx.operations.list(filter)) })
  })

  r.get('/counts', (_req, res) => {
    res.json(ctx.inventory.pendingCounts())
  })

  r.post('/', (req, res) => {
    const input = parse(operationInputSchema, req.body)
    const op = ctx.ops.create({ ...input, createdBy: currentUser(res).id })
    res.status(201).json(view(op.id))
  })

  r.get('/:id', (req, res) => {
    res.json(view(idParam(req)))
  })

  r.patch('/:id', (req, res) => {
    const patch = parse(operationPatchSchema, req.body)
    res.json(view(ctx.ops.update(idParam(req), patch).id))
  })

  r.post('/:id/confirm', (req, res) => {
    res.json(view(ctx.ops.confirm(idParam(req)).id))
  })
  r.post('/:id/check', (req, res) => {
    res.json(view(ctx.ops.checkAvailability(idParam(req)).operation.id))
  })
  r.post('/:id/pick', (req, res) => {
    const { lineId, picked } = parse(pickSchema, req.body ?? {})
    res.json(view(ctx.ops.pick(idParam(req), lineId ?? null, picked).id))
  })
  r.post('/:id/pack', (req, res) => {
    res.json(view(ctx.ops.pack(idParam(req)).id))
  })
  r.post('/:id/validate', (req, res) => {
    res.json(view(ctx.ops.validate(idParam(req)).id))
  })
  r.post('/:id/cancel', (req, res) => {
    res.json(view(ctx.ops.cancel(idParam(req)).id))
  })

  return r
}
