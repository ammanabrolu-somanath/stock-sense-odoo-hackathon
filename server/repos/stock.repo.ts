import type { Id, PlannedMove } from '@domain/types.ts'
import type { Db } from '../db/connection.ts'

/** Ledger writes (append-only) and quantity reads over the stock_quants view. */
export function createStockRepo(db: Db) {
  return {
    insertMoves(operationId: Id, moves: PlannedMove[], createdAt: string): void {
      for (const m of moves) {
        db.run(
          `INSERT INTO stock_moves (operation_id, product_id, from_location_id, to_location_id, qty, unit_cost, created_at)
           VALUES (:operationId, :productId, :fromLocationId, :toLocationId, :qty, :unitCost, :createdAt)`,
          { operationId, ...m, createdAt },
        )
      }
    },

    /** Quantity of one product at one location, straight from the ledger (index-backed). */
    qtyAt(productId: Id, locationId: Id): number {
      const r = db.get<{ qty: number | null }>(
        `SELECT ROUND(
            COALESCE((SELECT SUM(qty) FROM stock_moves WHERE product_id = :productId AND to_location_id = :locationId), 0)
          - COALESCE((SELECT SUM(qty) FROM stock_moves WHERE product_id = :productId AND from_location_id = :locationId), 0), 3) AS qty`,
        { productId, locationId },
      )
      return r?.qty ?? 0
    },

    /** Total on hand per product across all internal locations. */
    onHandByProduct(): Map<Id, number> {
      const rows = db.all<{ productId: Id; qty: number }>(
        'SELECT product_id AS productId, ROUND(SUM(qty), 3) AS qty FROM internal_quants GROUP BY product_id',
      )
      return new Map(rows.map((r) => [r.productId, r.qty]))
    },

    /** Per-location breakdown (non-zero only). */
    quants(filter: { productId?: Id } = {}): { productId: Id; locationId: Id; warehouseId: Id; qty: number }[] {
      return db.all(
        `SELECT product_id AS productId, location_id AS locationId, warehouse_id AS warehouseId, qty
         FROM internal_quants WHERE qty <> 0 AND (:productId IS NULL OR product_id = :productId)
         ORDER BY product_id, location_id`,
        { productId: filter.productId ?? null },
      )
    },

    /** Σ over ALL locations (internal + virtual) per product — must be 0 by double-entry. */
    conservationCheck(): { productId: Id; total: number }[] {
      return db.all(
        `SELECT product_id AS productId, ROUND(SUM(qty), 3) AS total FROM stock_quants
         GROUP BY product_id HAVING ROUND(SUM(qty), 3) <> 0`,
      )
    },

    countMoves(): number {
      return db.get<{ n: number }>('SELECT COUNT(*) AS n FROM stock_moves')?.n ?? 0
    },
  }
}

export type StockRepo = ReturnType<typeof createStockRepo>
