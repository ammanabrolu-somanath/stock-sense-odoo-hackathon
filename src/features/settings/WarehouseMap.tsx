import { useQueries } from '@tanstack/react-query'
import { Link } from 'react-router'
import { motion, useReducedMotion } from 'motion/react'

import type { WarehouseSummary } from '@domain/api.ts'
import type { Id } from '@domain/types.ts'
import { useProducts } from '@/features/products/queries'
import { api, qs } from '@/lib/api'
import { formatNumber, uomLabel } from '@/lib/format'

/**
 * Floor map: one tile per location, filled in proportion to the units it holds (relative to
 * the fullest location here). Sequential single hue; the number is always printed, so the
 * fill never carries meaning alone. Each tile opens that location's ledger.
 */
export function WarehouseMap({ wh }: { wh: WarehouseSummary }) {
  const reduce = useReducedMotion()
  const products = useProducts()
  const names = new Map((products.data ?? []).map((p) => [p.id, p]))
  const stocks = useQueries({
    queries: wh.locations.map((l) => ({
      queryKey: ['locations', 'stock', l.id],
      queryFn: async () => (await api<{ items: { productId: Id; qty: number }[] }>(`/api/locations/${l.id}/stock`)).items,
    })),
  })
  const max = Math.max(1, ...wh.locations.map((l) => l.onHand))

  return (
    <section aria-labelledby="floor-map" className="mb-6 rounded-lg border">
      <header className="flex h-11 items-center justify-between border-b px-4">
        <h2 id="floor-map" className="text-sm font-medium">
          Floor map
        </h2>
        <span className="text-xs text-muted-foreground">Fill = units held, relative to the fullest location</span>
      </header>
      <ul className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
        {wh.locations.map((l, i) => {
          const share = l.onHand / max
          const top = [...(stocks[i]?.data ?? [])].filter((s) => s.qty > 0).sort((a, b) => b.qty - a.qty).slice(0, 3)
          return (
            <li key={l.id}>
              <Link
                to={`/moves${qs({ locationId: l.id })}`}
                aria-label={`${l.fullName}: ${formatNumber(l.onHand)} units. Open its moves.`}
                className="group relative flex h-full min-h-36 flex-col overflow-hidden rounded-md border bg-background p-3 outline-none transition-colors hover:border-foreground/30 focus-visible:ring-2 focus-visible:ring-ring"
              >
                {/* The fill rises from the floor of the tile. */}
                <motion.div
                  aria-hidden="true"
                  className="absolute inset-x-0 bottom-0 bg-primary/12"
                  initial={reduce ? false : { height: 0 }}
                  animate={{ height: `${Math.max(share * 100, l.onHand > 0 ? 4 : 0)}%` }}
                  transition={{ duration: 0.7, delay: i * 0.08, ease: [0.2, 0.8, 0.2, 1] }}
                />
                <div className="relative flex items-baseline justify-between gap-2">
                  <span className="font-mono text-xs font-medium">{l.name}</span>
                  <span className="text-lg font-semibold tabular-nums">{formatNumber(l.onHand)}</span>
                </div>
                <ul className="relative mt-auto grid gap-0.5 pt-3 text-xs text-muted-foreground">
                  {top.length === 0 ? (
                    <li>Empty</li>
                  ) : (
                    top.map((s) => {
                      const p = names.get(s.productId)
                      return (
                        <li key={s.productId} className="flex justify-between gap-2">
                          <span className="truncate">{p?.name ?? 'Product'}</span>
                          <span className="shrink-0 tabular-nums">
                            {formatNumber(s.qty)} {p ? uomLabel(p.uom, s.qty) : ''}
                          </span>
                        </li>
                      )
                    })
                  )}
                </ul>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
