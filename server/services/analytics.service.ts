import type { AbcClass, AbcRow, Analytics, CategoryRow } from '@domain/analytics.ts'
import type { Id } from '@domain/types.ts'
import type { InventoryService } from './inventory.service.ts'

const round = (n: number, dp = 2) => Math.round(n * 10 ** dp) / 10 ** dp
const turnover = (out30: number, held: number) => (held > 0 ? round((out30 * 365) / 30 / held, 1) : null)
const daysOf = (out30: number, held: number) => (out30 > 0 ? Math.round(held / (out30 / 30)) : null)

/**
 * Classic inventory analytics, computed from the same ledger-derived product summaries:
 * ABC by 30-day consumption value (A ≤ 80 % cumulative, B ≤ 95 %, C the rest), and
 * turnover / days of inventory per category.
 */
export function createAnalyticsService(deps: { inventory: InventoryService }) {
  return {
    compute(): Analytics {
      const products = deps.inventory.listProducts()
      const withValue = products.map((p) => ({ p, consumption: p.outbound30d * p.cost, stockValue: Math.max(0, p.value) }))
      const totalConsumption = withValue.reduce((s, x) => s + x.consumption, 0)

      let cumulative = 0
      const rows: AbcRow[] = [...withValue]
        .sort((a, b) => b.consumption - a.consumption || a.p.name.localeCompare(b.p.name))
        .map(({ p, consumption, stockValue }) => {
          const share = totalConsumption > 0 ? consumption / totalConsumption : 0
          // Class by where the item *starts* in the cumulative curve, so the item that crosses 80 % is still A.
          const abc: AbcClass = cumulative < 0.8 && share > 0 ? 'A' : cumulative < 0.95 && share > 0 ? 'B' : 'C'
          cumulative += share
          return {
            id: p.id,
            sku: p.sku,
            name: p.name,
            categoryName: p.categoryName,
            uom: p.uom,
            consumptionValue: Math.round(consumption),
            share: round(share, 4),
            cumulativeShare: round(Math.min(1, cumulative), 4),
            abc,
            stockValue: Math.round(stockValue),
          }
        })

      const summary = { A: { products: 0, valueShare: 0 }, B: { products: 0, valueShare: 0 }, C: { products: 0, valueShare: 0 } }
      for (const r of rows) {
        summary[r.abc].products++
        summary[r.abc].valueShare = round(summary[r.abc].valueShare + r.share, 4)
      }

      const byCategory = new Map<Id, CategoryRow>()
      for (const { p, consumption, stockValue } of withValue) {
        const row = byCategory.get(p.categoryId) ?? {
          categoryId: p.categoryId,
          name: p.categoryName,
          products: 0,
          stockValue: 0,
          outbound30dValue: 0,
          turnover: null,
          daysOfInventory: null,
        }
        row.products++
        row.stockValue += stockValue
        row.outbound30dValue += consumption
        byCategory.set(p.categoryId, row)
      }
      const categories = [...byCategory.values()]
        .map((c) => ({
          ...c,
          stockValue: Math.round(c.stockValue),
          outbound30dValue: Math.round(c.outbound30dValue),
          turnover: turnover(c.outbound30dValue, c.stockValue),
          daysOfInventory: daysOf(c.outbound30dValue, c.stockValue),
        }))
        .sort((a, b) => b.stockValue - a.stockValue)

      const stockValue = Math.round(withValue.reduce((s, x) => s + x.stockValue, 0))
      const outbound30dValue = Math.round(totalConsumption)
      return {
        totals: { stockValue, outbound30dValue, turnover: turnover(outbound30dValue, stockValue), daysOfInventory: daysOf(outbound30dValue, stockValue) },
        abc: { rows, summary },
        categories,
      }
    },
  }
}

export type AnalyticsService = ReturnType<typeof createAnalyticsService>
