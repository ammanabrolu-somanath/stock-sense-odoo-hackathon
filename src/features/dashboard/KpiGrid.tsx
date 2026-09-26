import { Link } from 'react-router'
import { ArrowUpRight } from 'lucide-react'

import { AnimatedNumber } from '@/components/shared/AnimatedNumber'
import { Skeleton } from '@/components/ui/skeleton'
import { qs } from '@/lib/api'
import { formatMoneyCompact, formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { DashboardKpis, DashboardScope } from './queries'

/**
 * The five KPIs the problem statement asks for, each a link to the exact list it counts
 * (same scope, same filters). No icons, no gradients, no invented trends.
 */
export function KpiGrid({ kpis, scope }: { kpis: DashboardKpis | undefined; scope: DashboardScope }) {
  if (!kpis) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" role="status" aria-busy="true" aria-label="Loading KPIs">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-[104px]" />
        ))}
      </div>
    )
  }
  // Every link carries the same scope the KPI was computed with, so the list count equals the KPI.
  const s = { warehouseId: scope.warehouseId, locationId: scope.locationId, categoryId: scope.categoryId }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <Kpi
        label="Total products in stock"
        value={kpis.productsInStock}
        to={`/products${qs({ ...s, status: 'available' })}`}
        hint={`of ${formatNumber(kpis.totalProducts)} · ${formatMoneyCompact(kpis.stockValue)} at cost`}
      />
      <div className="grid rounded-lg border sm:col-span-1">
        <div className="px-4 pt-3 text-xs text-muted-foreground">Low stock / Out of stock</div>
        <div className="grid grid-cols-2 divide-x">
          <KpiLink to={`/products${qs({ ...s, status: 'low' })}`} label="Low stock" value={kpis.lowStock} tone={kpis.lowStock > 0 ? 'warning' : undefined} />
          <KpiLink to={`/products${qs({ ...s, status: 'out' })}`} label="Out of stock" value={kpis.outOfStock} tone={kpis.outOfStock > 0 ? 'danger' : undefined} />
        </div>
      </div>
      <Kpi
        label="Pending receipts"
        value={kpis.pendingReceipts.pending}
        to={`/operations/receipts${qs(s)}`}
        hint={kpis.pendingReceipts.overdue > 0 ? `${kpis.pendingReceipts.overdue} overdue` : 'None overdue'}
        tone={kpis.pendingReceipts.overdue > 0 ? 'warning' : undefined}
      />
      <Kpi
        label="Pending deliveries"
        value={kpis.pendingDeliveries.pending}
        to={`/operations/deliveries${qs(s)}`}
        hint={[
          kpis.pendingDeliveries.waiting > 0 ? `${kpis.pendingDeliveries.waiting} waiting for stock` : null,
          kpis.pendingDeliveries.overdue > 0 ? `${kpis.pendingDeliveries.overdue} overdue` : null,
        ]
          .filter(Boolean)
          .join(' · ') || 'All on schedule'}
        tone={kpis.pendingDeliveries.waiting + kpis.pendingDeliveries.overdue > 0 ? 'warning' : undefined}
      />
      <Kpi
        label="Internal transfers scheduled"
        value={kpis.transfersScheduled.pending}
        to={`/operations/transfers${qs(s)}`}
        hint={kpis.transfersScheduled.overdue > 0 ? `${kpis.transfersScheduled.overdue} overdue` : 'None overdue'}
        tone={kpis.transfersScheduled.overdue > 0 ? 'warning' : undefined}
      />
    </div>
  )
}

type Tone = 'warning' | 'danger' | undefined

function Kpi({ label, value, hint, to, tone }: { label: string; value: number; hint: string; to: string; tone?: Tone }) {
  return (
    <Link
      to={to}
      aria-label={`${label}: ${value}. ${hint}`}
      className="group relative rounded-lg border px-4 py-3 outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="pr-5 text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-kpi font-semibold tracking-tight">
        <AnimatedNumber value={value} />
      </div>
      <div className={cn('mt-0.5 text-xs text-muted-foreground', tone === 'warning' && 'text-warning', tone === 'danger' && 'text-danger')}>{hint}</div>
      <ArrowUpRight className="absolute top-3 right-3 size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden="true" />
    </Link>
  )
}

function KpiLink({ to, label, value, tone }: { to: string; label: string; value: number; tone?: Tone }) {
  return (
    <Link
      to={to}
      aria-label={`${label}: ${value}`}
      className="px-4 pt-1 pb-3 outline-none transition-colors first:rounded-bl-lg last:rounded-br-lg hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring"
    >
      {/* Size and colour on separate elements: the class merger treats custom text-kpi and text-warning as conflicting. */}
      <div className="text-kpi font-semibold tracking-tight">
        <span className={cn(tone === 'warning' && 'text-warning', tone === 'danger' && 'text-danger')}>
          <AnimatedNumber value={value} />
        </span>
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </Link>
  )
}
