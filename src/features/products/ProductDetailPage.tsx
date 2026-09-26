import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowDownToLine, ArrowRight, History, Pencil } from 'lucide-react'

import type { MoveRow, ProductDetail } from '@domain/api.ts'
import { EmptyState } from '@/components/shared/EmptyState'
import { Money, Qty } from '@/components/shared/Qty'
import { StockStatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { NotFoundPage } from '@/app/NotFoundPage'
import { ApiError, qs } from '@/lib/api'
import { formatDateTime, formatNumber, formatRate, UOM_LABEL } from '@/lib/format'
import { cn } from '@/lib/utils'
import { ProductSheet } from './ProductSheet'
import { useMoves, useProduct } from './queries'

function Stat({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="px-4 py-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-lg font-semibold tracking-tight">{children}</dd>
      {hint && <dd className="text-xs text-muted-foreground">{hint}</dd>}
    </div>
  )
}

function Section({ title, action, children, className }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-lg border', className)}>
      <header className="flex h-11 items-center justify-between border-b px-4">
        <h2 className="text-sm font-medium">{title}</h2>
        {action}
      </header>
      {children}
    </section>
  )
}

export function ProductDetailPage() {
  const id = Number(useParams().productId)
  const product = useProduct(Number.isInteger(id) ? id : undefined)
  const moves = useMoves({ productId: id, pageSize: 10 })
  const [editing, setEditing] = useState(false)

  if (product.error instanceof ApiError && product.error.status === 404) return <NotFoundPage />
  if (!product.data) return <DetailSkeleton />
  const p = product.data

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">{p.name}</h1>
            <StockStatusBadge status={p.status} />
            {p.archived && <span className="text-xs text-muted-foreground">Archived</span>}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="font-mono">{p.sku}</span> · {p.categoryName}
            {p.supplier && <> · Supplied by {p.supplier}</>}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setEditing(true)}>
            <Pencil data-icon="inline-start" />
            Edit
          </Button>
          <Button asChild>
            <Link to={`/operations/receipts/new${qs({ productId: p.id, qty: p.reorder?.suggestedQty })}`}>
              <ArrowDownToLine data-icon="inline-start" />
              Receive stock
            </Link>
          </Button>
        </div>
      </div>

      <dl className="mb-6 grid grid-cols-2 divide-x divide-y rounded-lg border sm:grid-cols-4 sm:divide-y-0">
        <Stat label="On hand" hint={`across ${p.stock.length} location${p.stock.length === 1 ? '' : 's'}`}>
          <Qty value={p.onHand} uom={p.uom} trace={{ productId: p.id }} />
        </Stat>
        <Stat label="Incoming" hint="on open receipts">
          <Qty value={p.incoming} uom={p.uom} />
        </Stat>
        <Stat label="Stock value" hint={`at cost ${formatNumber(p.cost)} ₹/${p.uom === 'unit' ? 'unit' : p.uom}`}>
          <Money value={p.value} />
        </Stat>
        <Stat label="Days of cover" hint={p.avgDailyDemand > 0 ? `${formatRate(p.avgDailyDemand)} ${UOM_LABEL[p.uom]}/day, last 30 days` : 'No outbound in 30 days'}>
          {p.daysOfCover === null ? '—' : `${p.daysOfCover} days`}
        </Stat>
      </dl>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Section title="Stock by location" className="lg:col-span-2">
          <StockByLocation product={p} />
        </Section>
        <Section title="Reordering rule">
          <ReorderRule product={p} />
        </Section>
      </div>

      <Section
        title="Recent movements"
        action={
          <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
            <Link to={`/moves${qs({ productId: p.id })}`}>
              <History data-icon="inline-start" />
              Full history
            </Link>
          </Button>
        }
      >
        <RecentMoves moves={moves.data?.items} product={p} />
      </Section>

      <ProductSheet open={editing} onOpenChange={setEditing} product={p} />
    </>
  )
}

function StockByLocation({ product: p }: { product: ProductDetail }) {
  if (p.stock.length === 0) {
    return <EmptyState icon={ArrowDownToLine} title="Not stocked anywhere yet" description="Receive stock or post an opening count to see it here." />
  }
  const max = Math.max(...p.stock.map((s) => s.qty))
  return (
    <table className="w-full text-table">
      <caption className="sr-only">Stock by location</caption>
      <thead>
        <tr className="border-b text-xs text-muted-foreground">
          <th scope="col" className="h-9 px-4 text-left font-medium">Location</th>
          <th scope="col" className="h-9 px-4 text-right font-medium">On hand</th>
          <th scope="col" className="hidden h-9 w-2/5 px-4 font-medium sm:table-cell"><span className="sr-only">Share</span></th>
        </tr>
      </thead>
      <tbody>
        {p.stock.map((s) => (
          <tr key={s.locationId} className="h-9 border-b last:border-0">
            <td className="px-4 font-mono text-xs">{s.fullName}</td>
            <td className="px-4 text-right">
              <Qty value={s.qty} uom={p.uom} trace={{ productId: p.id, locationId: s.locationId }} />
            </td>
            <td className="hidden px-4 sm:table-cell">
              <div className="h-1.5 rounded-full bg-muted" aria-hidden="true">
                <div className="h-full rounded-full bg-primary/70" style={{ width: `${Math.max(2, (s.qty / max) * 100)}%` }} />
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function ReorderRule({ product: p }: { product: ProductDetail }) {
  return (
    <div className="grid gap-4 p-4 text-sm">
      <dl className="grid grid-cols-3 gap-3">
        <div>
          <dt className="text-xs text-muted-foreground">Minimum</dt>
          <dd className="mt-0.5 font-medium tabular-nums">{formatNumber(p.reorderMin)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Maximum</dt>
          <dd className="mt-0.5 font-medium tabular-nums">{formatNumber(p.reorderMax)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Lead time</dt>
          <dd className="mt-0.5 font-medium tabular-nums">{p.leadTimeDays} d</dd>
        </div>
      </dl>
      {p.reorder ? (
        <div className="rounded-md border border-warning/30 bg-warning/5 p-3">
          <p className="font-medium">
            Reorder {formatNumber(p.reorder.suggestedQty)} {UOM_LABEL[p.uom]}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{p.reorder.reason}</p>
          <Button size="sm" className="mt-3" asChild>
            <Link to={`/operations/receipts/new${qs({ productId: p.id, qty: p.reorder.suggestedQty })}`}>
              Create receipt
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          On hand plus incoming is above the minimum — no reorder needed.
        </p>
      )}
    </div>
  )
}

const TYPE_LABEL = { receipt: 'Receipt', delivery: 'Delivery', transfer: 'Transfer', adjustment: 'Adjustment' } as const

function RecentMoves({ moves, product: p }: { moves: MoveRow[] | undefined; product: ProductDetail }) {
  if (!moves) return <div className="p-4"><Skeleton className="h-24 w-full" /></div>
  if (moves.length === 0) return <EmptyState icon={History} title="No movements yet" />
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-table">
        <caption className="sr-only">Recent movements</caption>
        <thead>
          <tr className="border-b text-xs text-muted-foreground">
            <th scope="col" className="h-9 px-4 text-left font-medium">Date</th>
            <th scope="col" className="h-9 px-4 text-left font-medium">Reference</th>
            <th scope="col" className="hidden h-9 px-4 text-left font-medium md:table-cell">From → To</th>
            <th scope="col" className="h-9 px-4 text-right font-medium">Change</th>
            <th scope="col" className="h-9 px-4 text-right font-medium">Balance</th>
          </tr>
        </thead>
        <tbody>
          {moves.map((m) => (
            <tr key={m.id} className="h-9 border-b last:border-0">
              <td className="px-4 whitespace-nowrap text-muted-foreground">{formatDateTime(m.createdAt)}</td>
              <td className="px-4 whitespace-nowrap">
                <span className="font-mono text-xs">{m.reference}</span>
                <span className="ml-2 text-xs text-muted-foreground">{TYPE_LABEL[m.type]}</span>
              </td>
              <td className="hidden px-4 font-mono text-xs whitespace-nowrap text-muted-foreground md:table-cell">
                {m.fromLocation} → {m.toLocation}
              </td>
              <td className={cn('px-4 text-right font-medium tabular-nums', m.delta > 0 && 'text-success', m.delta < 0 && 'text-danger')}>
                {m.delta === 0 ? <span className="font-normal text-muted-foreground">moved</span> : `${m.delta > 0 ? '+' : ''}${formatNumber(m.delta)}`}
              </td>
              <td className="px-4 text-right tabular-nums">{m.balance === null ? '—' : <Qty value={m.balance} uom={p.uom} />}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DetailSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading product">
      <Skeleton className="h-7 w-64" />
      <Skeleton className="mt-2 h-4 w-80" />
      <Skeleton className="mt-6 h-20 w-full" />
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Skeleton className="h-48 lg:col-span-2" />
        <Skeleton className="h-48" />
      </div>
    </div>
  )
}
