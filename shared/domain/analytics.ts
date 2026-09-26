import type { Id, Uom } from './types.ts'

/** Response shape of GET /api/analytics (shared by the API and the web app). */
export type AbcClass = 'A' | 'B' | 'C'

export interface AbcRow {
  id: Id
  sku: string
  name: string
  categoryName: string
  uom: Uom
  /** Units delivered in the last 30 days × unit cost (₹). */
  consumptionValue: number
  share: number
  cumulativeShare: number
  abc: AbcClass
  stockValue: number
}

export interface CategoryRow {
  categoryId: Id
  name: string
  products: number
  stockValue: number
  outbound30dValue: number
  /** Annualised cost of goods out ÷ stock value held (times per year). Null when nothing is held. */
  turnover: number | null
  /** Stock value ÷ average daily cost of goods out. Null when nothing moved out. */
  daysOfInventory: number | null
}

export interface Analytics {
  totals: { stockValue: number; outbound30dValue: number; turnover: number | null; daysOfInventory: number | null }
  abc: { rows: AbcRow[]; summary: Record<AbcClass, { products: number; valueShare: number }> }
  categories: CategoryRow[]
}
