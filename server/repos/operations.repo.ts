import type { Id, Operation, OperationLine, OperationStatus, OperationType } from '@domain/types.ts'
import type { Db } from '../db/connection.ts'

/** SQL for operations (documents), their lines, and reference sequences. No business rules here. */

const OPERATION_COLUMNS = `
  o.id, o.reference, o.type, o.status, o.partner,
  o.source_location_id AS sourceLocationId, o.dest_location_id AS destLocationId,
  o.scheduled_date AS scheduledDate, o.packed_at AS packedAt, o.reason, o.note,
  o.created_at AS createdAt, o.done_at AS doneAt`

type LineRow = Omit<OperationLine, 'picked'> & { operationId: Id; picked: number }

export interface NewOperation {
  reference: string
  type: OperationType
  partner: string | null
  sourceLocationId: Id
  destLocationId: Id
  scheduledDate: string
  reason: string | null
  note: string | null
  createdBy: Id | null
}

export interface OperationFilter {
  type?: OperationType
  status?: OperationStatus | 'open'
  warehouseId?: Id
  locationId?: Id
  categoryId?: Id
  productId?: Id
  q?: string
}

export function createOperationsRepo(db: Db) {
  function linesFor(ids: Id[]): Map<Id, OperationLine[]> {
    const out = new Map<Id, OperationLine[]>()
    if (ids.length === 0) return out
    const rows = db.all<LineRow>(
      `SELECT id, operation_id AS operationId, product_id AS productId, qty, picked, system_qty AS systemQty
       FROM operation_lines WHERE operation_id IN (SELECT value FROM json_each(:ids)) ORDER BY id`,
      { ids: JSON.stringify(ids) },
    )
    for (const { operationId, picked, ...l } of rows) {
      const list = out.get(operationId) ?? []
      list.push({ ...l, picked: picked === 1 })
      out.set(operationId, list)
    }
    return out
  }

  return {
    /** Next number for a sequence key (e.g. "HYD/IN"), atomically. */
    nextSequence(key: string): number {
      return db.tx(() => {
        db.run('INSERT INTO sequences (key, next_value) VALUES (:key, 1) ON CONFLICT(key) DO NOTHING', { key })
        const n = db.get<{ n: number }>('SELECT next_value AS n FROM sequences WHERE key = :key', { key })!.n
        db.run('UPDATE sequences SET next_value = next_value + 1 WHERE key = :key', { key })
        return n
      })
    },

    insert(op: NewOperation, createdAt: string): Id {
      return db.run(
        `INSERT INTO operations (reference, type, partner, source_location_id, dest_location_id, scheduled_date, reason, note, created_by, created_at)
         VALUES (:reference, :type, :partner, :sourceLocationId, :destLocationId, :scheduledDate, :reason, :note, :createdBy, :createdAt)`,
        { ...op, createdAt },
      ).id
    },

    replaceLines(operationId: Id, lines: { productId: Id; qty: number }[]): void {
      db.run('DELETE FROM operation_lines WHERE operation_id = :operationId', { operationId })
      for (const l of lines) {
        db.run('INSERT INTO operation_lines (operation_id, product_id, qty) VALUES (:operationId, :productId, :qty)', {
          operationId,
          productId: l.productId,
          qty: l.qty,
        })
      }
    },

    get(id: Id): Operation | undefined {
      const op = db.get<Omit<Operation, 'lines'>>(`SELECT ${OPERATION_COLUMNS} FROM operations o WHERE o.id = :id`, { id })
      if (!op) return undefined
      return { ...op, lines: linesFor([id]).get(id) ?? [] }
    },

    list(f: OperationFilter = {}): Operation[] {
      const ops = db.all<Omit<Operation, 'lines'>>(
        `SELECT ${OPERATION_COLUMNS}
         FROM operations o
         JOIN locations src ON src.id = o.source_location_id
         JOIN locations dst ON dst.id = o.dest_location_id
         WHERE (:type IS NULL OR o.type = :type)
           AND (:status IS NULL OR o.status = :status OR (:status = 'open' AND o.status IN ('draft','waiting','ready')))
           AND (:warehouseId IS NULL OR src.warehouse_id = :warehouseId OR dst.warehouse_id = :warehouseId)
           AND (:locationId IS NULL OR o.source_location_id = :locationId OR o.dest_location_id = :locationId)
           AND (:categoryId IS NULL OR EXISTS (
                 SELECT 1 FROM operation_lines ol JOIN products p ON p.id = ol.product_id
                 WHERE ol.operation_id = o.id AND p.category_id = :categoryId))
           AND (:productId IS NULL OR EXISTS (
                 SELECT 1 FROM operation_lines ol WHERE ol.operation_id = o.id AND ol.product_id = :productId))
           AND (:q IS NULL OR o.reference LIKE '%' || :q || '%' OR o.partner LIKE '%' || :q || '%')
         ORDER BY o.scheduled_date DESC, o.id DESC`,
        {
          type: f.type ?? null,
          status: f.status ?? null,
          warehouseId: f.warehouseId ?? null,
          locationId: f.locationId ?? null,
          categoryId: f.categoryId ?? null,
          productId: f.productId ?? null,
          q: f.q?.trim() || null,
        },
      )
      const lines = linesFor(ops.map((o) => o.id))
      return ops.map((o) => ({ ...o, lines: lines.get(o.id) ?? [] }))
    },

    setStatus(id: Id, status: OperationStatus, doneAt: string | null = null): void {
      db.run('UPDATE operations SET status = :status, done_at = :doneAt WHERE id = :id', { id, status, doneAt })
    },
    setPacked(id: Id, packedAt: string | null): void {
      db.run('UPDATE operations SET packed_at = :packedAt WHERE id = :id', { id, packedAt })
    },
    setPicked(operationId: Id, lineId: Id | null, picked: boolean): number {
      return db.run(
        'UPDATE operation_lines SET picked = :picked WHERE operation_id = :operationId AND (:lineId IS NULL OR id = :lineId)',
        { operationId, lineId, picked: picked ? 1 : 0 },
      ).changes
    },
    setSystemQty(operationId: Id, productId: Id, systemQty: number): void {
      db.run(
        'UPDATE operation_lines SET system_qty = :systemQty WHERE operation_id = :operationId AND product_id = :productId',
        { operationId, productId, systemQty },
      )
    },

    /** Qty on receipts not yet done/canceled, per product (the "incoming" in a reorder forecast). */
    incomingByProduct(): Map<Id, number> {
      const rows = db.all<{ productId: Id; qty: number }>(
        `SELECT ol.product_id AS productId, ROUND(SUM(ol.qty), 3) AS qty
         FROM operation_lines ol JOIN operations o ON o.id = ol.operation_id
         WHERE o.type = 'receipt' AND o.status IN ('draft','waiting','ready')
         GROUP BY ol.product_id`,
      )
      return new Map(rows.map((r) => [r.productId, r.qty]))
    },
  }
}

export type OperationsRepo = ReturnType<typeof createOperationsRepo>
