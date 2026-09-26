import { DomainError } from '@domain/errors.ts'
import {
  assertCan,
  assertHasLines,
  assertShippable,
  needsAvailability,
  statusAfterAvailability,
} from '@domain/lifecycle.ts'
import { formatReference, sequenceKey } from '@domain/references.ts'
import { findShortages, planMoves, type Shortage } from '@domain/stock.ts'
import type { Id, Operation, OperationType, Uom } from '@domain/types.ts'
import type { Db } from '../db/connection.ts'
import type { CatalogRepo } from '../repos/catalog.repo.ts'
import type { OperationsRepo } from '../repos/operations.repo.ts'
import type { StockRepo } from '../repos/stock.repo.ts'

export type Clock = () => Date

export interface OperationInput {
  type: OperationType
  /** Supplier (receipts) or customer (deliveries). */
  partner?: string | null
  /** Internal location: required for transfers (from); ignored for receipts/adjustments. */
  sourceLocationId?: Id
  /** Internal location: required for receipts, transfers (to) and adjustments. Deliveries ship from `sourceLocationId`. */
  destLocationId?: Id
  scheduledDate?: string
  reason?: string | null
  note?: string | null
  lines: { productId: Id; qty: number }[]
  createdBy?: Id | null
}

export type OperationPatch = Partial<Pick<OperationInput, 'partner' | 'scheduledDate' | 'reason' | 'note' | 'lines'>>

export function formatQty(n: number, uom: Uom): string {
  const v = Number.isInteger(n) ? String(n) : n.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')
  return uom === 'unit' ? `${v} ${n === 1 ? 'unit' : 'units'}` : `${v} ${uom}`
}

export function createOperationsService(deps: {
  db: Db
  catalog: CatalogRepo
  operations: OperationsRepo
  stock: StockRepo
  now: Clock
}) {
  const { db, catalog, operations, stock, now } = deps
  const iso = () => now().toISOString()

  function load(id: Id): Operation {
    const op = operations.get(id)
    if (!op) throw new DomainError('NOT_FOUND', `Operation ${id} does not exist.`)
    return op
  }

  function internal(id: Id | undefined, role: string) {
    const loc = id === undefined ? undefined : catalog.getLocation(id)
    if (!loc) throw new DomainError('VALIDATION', `Choose a ${role} location.`)
    if (loc.kind !== 'internal') throw new DomainError('VALIDATION', `${loc.fullName} is not a warehouse location.`)
    return loc
  }

  /** Resolve the double-entry endpoints for a document type. */
  function endpoints(input: OperationInput) {
    switch (input.type) {
      case 'receipt': {
        const dest = internal(input.destLocationId, 'destination')
        return { source: catalog.virtualLocation('vendor'), dest: dest.id, warehouseCode: dest.warehouseCode! }
      }
      case 'delivery': {
        const src = internal(input.sourceLocationId, 'source')
        return { source: src.id, dest: catalog.virtualLocation('customer'), warehouseCode: src.warehouseCode! }
      }
      case 'transfer': {
        const src = internal(input.sourceLocationId, 'source')
        const dest = internal(input.destLocationId, 'destination')
        if (src.id === dest.id) throw new DomainError('VALIDATION', 'Source and destination must be different locations.')
        return { source: src.id, dest: dest.id, warehouseCode: src.warehouseCode! }
      }
      case 'adjustment': {
        const dest = internal(input.destLocationId, 'counted')
        return { source: catalog.virtualLocation('adjustment'), dest: dest.id, warehouseCode: dest.warehouseCode! }
      }
    }
  }

  function assertProducts(lines: { productId: Id }[]) {
    for (const l of lines) {
      const p = catalog.getProduct(l.productId)
      if (!p) throw new DomainError('VALIDATION', `Product ${l.productId} does not exist.`)
      if (p.archived) throw new DomainError('VALIDATION', `${p.name} is archived and can't be moved.`)
    }
  }

  function shortagesFor(op: Operation): Shortage[] {
    if (!needsAvailability(op.type)) return []
    return findShortages(op.lines, (productId) => stock.qtyAt(productId, op.sourceLocationId))
  }

  function shortageMessage(op: Operation, shortages: Shortage[]): string {
    const where = catalog.getLocation(op.sourceLocationId)?.fullName ?? 'the source location'
    const [first] = shortages
    const p = catalog.getProduct(first.productId)!
    const more = shortages.length > 1 ? ` (+${shortages.length - 1} more product${shortages.length > 2 ? 's' : ''} short)` : ''
    return `Only ${formatQty(first.available, p.uom)} of ${p.name} on hand at ${where} — ${formatQty(first.requested, p.uom)} requested${more}.`
  }

  const service = {
    get: load,

    create(input: OperationInput): Operation {
      return db.tx(() => {
        const { source, dest, warehouseCode } = endpoints(input)
        assertProducts(input.lines)
        const n = operations.nextSequence(sequenceKey(warehouseCode, input.type))
        const id = operations.insert(
          {
            reference: formatReference(warehouseCode, input.type, n),
            type: input.type,
            partner: input.partner?.trim() || null,
            sourceLocationId: source,
            destLocationId: dest,
            scheduledDate: input.scheduledDate ?? iso(),
            reason: input.reason ?? null,
            note: input.note ?? null,
            createdBy: input.createdBy ?? null,
          },
          iso(),
        )
        operations.replaceLines(id, input.lines)
        return load(id)
      })
    },

    update(id: Id, patch: OperationPatch): Operation {
      return db.tx(() => {
        const op = load(id)
        assertCan('edit', op)
        if (patch.lines) {
          assertProducts(patch.lines)
          operations.replaceLines(id, patch.lines)
        }
        db.run(
          `UPDATE operations SET
             partner = COALESCE(:partner, partner), scheduled_date = COALESCE(:scheduledDate, scheduled_date),
             reason = COALESCE(:reason, reason), note = COALESCE(:note, note)
           WHERE id = :id`,
          {
            id,
            partner: patch.partner ?? null,
            scheduledDate: patch.scheduledDate ?? null,
            reason: patch.reason ?? null,
            note: patch.note ?? null,
          },
        )
        return load(id)
      })
    },

    /** Draft → Ready (or Waiting when the source can't cover a delivery/transfer yet). */
    confirm(id: Id): Operation {
      return db.tx(() => {
        const op = load(id)
        assertCan('confirm', op)
        assertHasLines(op)
        operations.setStatus(id, statusAfterAvailability(op.type, shortagesFor(op).length > 0))
        return load(id)
      })
    },

    /** Re-evaluate availability (stock may have arrived since confirmation). */
    checkAvailability(id: Id): { operation: Operation; shortages: Shortage[] } {
      return db.tx(() => {
        const op = load(id)
        assertCan('check', op)
        const shortages = shortagesFor(op)
        const next = statusAfterAvailability(op.type, shortages.length > 0)
        if (next !== op.status) {
          operations.setStatus(id, next)
          // Losing availability invalidates picking and packing.
          if (next === 'waiting') {
            operations.setPicked(id, null, false)
            operations.setPacked(id, null)
          }
        }
        return { operation: load(id), shortages }
      })
    },

    /** Mark one line (or every line when lineId is null) as picked. */
    pick(id: Id, lineId: Id | null = null, picked = true): Operation {
      return db.tx(() => {
        const op = load(id)
        assertCan('pick', op)
        if (lineId !== null && !op.lines.some((l) => l.id === lineId)) {
          throw new DomainError('NOT_FOUND', `Line ${lineId} is not on ${op.reference}.`)
        }
        operations.setPicked(id, lineId, picked)
        if (!picked) operations.setPacked(id, null)
        return load(id)
      })
    },

    pack(id: Id): Operation {
      return db.tx(() => {
        const op = load(id)
        assertCan('pack', op)
        const unpicked = op.lines.filter((l) => !l.picked).length
        if (unpicked > 0) {
          throw new DomainError('INVALID_STATE', `Pick all items before packing — ${unpicked} line${unpicked === 1 ? '' : 's'} left.`)
        }
        operations.setPacked(id, iso())
        return load(id)
      })
    },

    /**
     * Post the document to the ledger. One transaction: re-check availability against the
     * live ledger, plan double-entry moves, append them, mark done. Any failure rolls back all of it.
     */
    validate(id: Id): Operation {
      return db.tx(() => {
        const op = load(id)
        assertCan('validate', op)
        assertHasLines(op)
        const shortages = shortagesFor(op)
        if (shortages.length > 0) {
          // The throw rolls back this transaction; the document keeps its status and the user sees why.
          throw new DomainError('INSUFFICIENT_STOCK', shortageMessage(op, shortages), { shortages })
        }
        if (op.status !== 'ready' && op.type === 'delivery') {
          throw new DomainError('INVALID_STATE', `${op.reference} must be confirmed, picked and packed before it ships.`)
        }
        assertShippable(op)

        const { moves, adjustments } = planMoves(op, {
          unitCost: (productId) => catalog.getProduct(productId)?.cost ?? 0,
          systemQty: (productId) => stock.qtyAt(productId, op.destLocationId),
        })
        const at = iso()
        for (const a of adjustments) operations.setSystemQty(id, a.productId, a.systemQty)
        stock.insertMoves(id, moves, at)
        operations.setStatus(id, 'done', at)
        return load(id)
      })
    },

    cancel(id: Id): Operation {
      return db.tx(() => {
        const op = load(id)
        assertCan('cancel', op)
        operations.setStatus(id, 'canceled')
        return load(id)
      })
    },

    /** Convenience for opening balances: an "Initial stock" adjustment, validated immediately. */
    postInitialStock(productId: Id, locationId: Id, qty: number, createdBy: Id | null = null): Operation {
      return db.tx(() => {
        const op = service.create({
          type: 'adjustment',
          destLocationId: locationId,
          reason: 'Initial stock',
          lines: [{ productId, qty: stock.qtyAt(productId, locationId) + qty }],
          createdBy,
        })
        return service.validate(op.id)
      })
    },
  }
  return service
}

export type OperationsService = ReturnType<typeof createOperationsService>
