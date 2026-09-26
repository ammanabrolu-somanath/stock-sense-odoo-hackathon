import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'

import type { AbcClass, Analytics } from '@domain/analytics.ts'
import { PageHeader } from '@/components/shared/PageHeader'
import { Skeleton } from '@/components/ui/skeleton'
import { Panel } from '@/features/dashboard/Panel'
import { api } from '@/lib/api'
import { formatMoney, formatMoneyCompact, formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'

/** One hue, three ordered steps: ABC is an ordinal ranking, not three unrelated categories. */
const ABC_FILL: Record<AbcClass, string> = { A: 'bg-primary', B: 'bg-primary/55', C: 'bg-primary/25' }
const ABC_MEANING: Record<AbcClass, string> = {
  A: 'the few products carrying most of the value moved — count and reorder these tightly',
  B: 'steady middle — review on a regular cycle',
  C: 'many products, little value moved — candidates for leaner stock',
}
const pct = (n: number) => `${Math.round(n * 100)}%`

export function AnalyticsPage() {
  const q = useQuery({ queryKey: ['analytics'], queryFn: () => api<Analytics>('/api/analytics') })
  const a = q.data

  return (
    <>
      <PageHeader title="Analytics" description="Where the value sits and how fast it moves — from the same ledger as every other number." />
      {!a ? (
        <div className="grid gap-6" role="status" aria-busy="true" aria-label="Loading analytics">
          <Skeleton className="h-24" />
          <Skeleton className="h-80" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          <dl className="grid grid-cols-2 divide-x divide-y rounded-lg border sm:grid-cols-4 sm:divide-y-0">
            <Stat label="Stock value at cost" value={formatMoneyCompact(a.totals.stockValue)} hint={formatMoney(a.totals.stockValue)} />
            <Stat label="Cost of goods out, 30 days" value={formatMoneyCompact(a.totals.outbound30dValue)} hint="delivered × unit cost" />
            <Stat label="Inventory turnover" value={a.totals.turnover === null ? '—' : `${a.totals.turnover}×`} hint="per year, annualised" />
            <Stat label="Days of inventory" value={a.totals.daysOfInventory === null ? '—' : `${a.totals.daysOfInventory} days`} hint="stock ÷ daily cost out" />
          </dl>

          <Panel title="ABC analysis — by 30-day consumption value">
            <div className="grid gap-4 p-4 md:grid-cols-3">
              {(['A', 'B', 'C'] as const).map((k) => (
                <div key={k} className="rounded-md border p-3">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-semibold">Class {k}</span>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {a.abc.summary[k].products} products · {pct(a.abc.summary[k].valueShare)} of value
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-muted" aria-hidden="true">
                    <div className={cn('h-full rounded-full', ABC_FILL[k])} style={{ width: pct(a.abc.summary[k].valueShare) }} />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{ABC_MEANING[k]}</p>
                </div>
              ))}
            </div>
            <div className="max-h-[420px] overflow-auto border-t">
              <table className="w-full text-table">
                <caption className="sr-only">Products ranked by consumption value</caption>
                <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                  <tr className="border-b text-xs text-muted-foreground">
                    <th scope="col" className="h-9 px-4 text-left font-medium">Class</th>
                    <th scope="col" className="h-9 px-4 text-left font-medium">Product</th>
                    <th scope="col" className="hidden h-9 px-4 text-left font-medium md:table-cell">Category</th>
                    <th scope="col" className="h-9 px-4 text-right font-medium">30-day value</th>
                    <th scope="col" className="h-9 w-48 px-4 text-left font-medium">Cumulative share</th>
                  </tr>
                </thead>
                <tbody>
                  {a.abc.rows.map((r) => (
                    <tr key={r.id} className="h-9 border-b last:border-0">
                      <td className="px-4">
                        <span className={cn('inline-grid size-5 place-items-center rounded text-[11px] font-semibold', r.abc === 'A' ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
                          {r.abc}
                        </span>
                      </td>
                      <td className="px-4">
                        <Link to={`/products/${r.id}`} className="hover:underline">
                          {r.name}
                        </Link>{' '}
                        <span className="font-mono text-xs text-muted-foreground">{r.sku}</span>
                      </td>
                      <td className="hidden px-4 text-muted-foreground md:table-cell">{r.categoryName}</td>
                      <td className="px-4 text-right tabular-nums">{formatMoney(r.consumptionValue)}</td>
                      <td className="px-4">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 flex-1 rounded-full bg-muted" aria-hidden="true">
                            <div className={cn('h-full rounded-full', ABC_FILL[r.abc])} style={{ width: pct(r.cumulativeShare) }} />
                          </div>
                          <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">{pct(r.cumulativeShare)}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel title="By category">
            <div className="overflow-x-auto">
              <table className="w-full text-table">
                <caption className="sr-only">Turnover by category</caption>
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th scope="col" className="h-9 px-4 text-left font-medium">Category</th>
                    <th scope="col" className="h-9 px-4 text-right font-medium">Products</th>
                    <th scope="col" className="h-9 px-4 text-right font-medium">Stock value</th>
                    <th scope="col" className="h-9 px-4 text-right font-medium">Out, 30 days</th>
                    <th scope="col" className="h-9 px-4 text-right font-medium">Turnover</th>
                    <th scope="col" className="h-9 px-4 text-right font-medium">Days of inventory</th>
                  </tr>
                </thead>
                <tbody>
                  {a.categories.map((c) => (
                    <tr key={c.categoryId} className="h-9 border-b last:border-0">
                      <td className="px-4">
                        <Link to={`/products?categoryId=${c.categoryId}`} className="hover:underline">
                          {c.name}
                        </Link>
                      </td>
                      <td className="px-4 text-right tabular-nums text-muted-foreground">{formatNumber(c.products)}</td>
                      <td className="px-4 text-right tabular-nums">{formatMoney(c.stockValue)}</td>
                      <td className="px-4 text-right tabular-nums">{formatMoney(c.outbound30dValue)}</td>
                      <td className="px-4 text-right tabular-nums">{c.turnover === null ? '—' : `${c.turnover}×`}</td>
                      <td className="px-4 text-right tabular-nums">{c.daysOfInventory === null ? '—' : `${c.daysOfInventory} d`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      )}
    </>
  )
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="px-4 py-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-kpi font-semibold tracking-tight">{value}</dd>
      <dd className="text-xs text-muted-foreground">{hint}</dd>
    </div>
  )
}
