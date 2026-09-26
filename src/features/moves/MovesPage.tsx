import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ChevronLeft, ChevronRight, Download, History } from 'lucide-react'

import type { MoveRow } from '@domain/api.ts'
import { EmptyState } from '@/components/shared/EmptyState'
import { FilterBar, useUrlFilters } from '@/components/shared/FilterBar'
import { PageHeader } from '@/components/shared/PageHeader'
import { Qty } from '@/components/shared/Qty'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { OPERATION_CONFIG, operationUrl } from '@/features/operations/config'
import { useLocations, useMoves, useProducts, useWarehouses } from '@/features/products/queries'
import { qs } from '@/lib/api'
import { formatDateTime, formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'

const FILTER_KEYS = ['q', 'productId', 'type', 'warehouseId', 'locationId', 'from', 'to'] as const
const PAGE_SIZE = 50

/** The ledger. Append-only; every stock number in the app can be traced to rows here. */
export function MovesPage() {
  const filters = useUrlFilters(FILTER_KEYS)
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get('page')) || 1)
  const moves = useMoves({ ...filters.values, page, pageSize: PAGE_SIZE })
  const products = useProducts()
  const warehouses = useWarehouses()
  const locations = useLocations()

  const productId = filters.values.productId ? Number(filters.values.productId) : undefined
  const product = productId ? products.data?.find((p) => p.id === productId) : undefined
  const scopeLabel = [
    filters.values.locationId && locations.data?.find((l) => String(l.id) === filters.values.locationId)?.fullName,
    filters.values.warehouseId && warehouses.data?.find((w) => String(w.id) === filters.values.warehouseId)?.code,
  ].find(Boolean)

  const facets = useMemo(
    () => [
      {
        key: 'productId',
        label: 'Product',
        options: (products.data ?? []).map((p) => ({ value: String(p.id), label: `${p.name} · ${p.sku}` })),
      },
      { key: 'type', label: 'Type', options: Object.values(OPERATION_CONFIG).map((c) => ({ value: c.type, label: c.label })) },
      { key: 'warehouseId', label: 'Warehouse', options: (warehouses.data ?? []).map((w) => ({ value: String(w.id), label: `${w.code} · ${w.name}` })) },
      {
        key: 'locationId',
        label: 'Location',
        options: (locations.data ?? []).filter((l) => l.kind === 'internal').map((l) => ({ value: String(l.id), label: l.fullName })),
      },
    ],
    [products.data, warehouses.data, locations.data],
  )

  // Changing any filter returns to page 1 (useUrlFilters writes the URL; drop the page param with it).
  const setFilter = (key: (typeof FILTER_KEYS)[number], value: string | undefined) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value) next.set(key, value)
        else next.delete(key)
        next.delete('page')
        return next
      },
      { replace: true },
    )
  }
  const goTo = (p: number) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      if (p <= 1) next.delete('page')
      else next.set('page', String(p))
      return next
    })

  const data = moves.data
  const total = data?.total ?? 0
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const showBalance = productId !== undefined

  return (
    <>
      <PageHeader
        title="Move History"
        description={data ? `${formatNumber(total)} move${total === 1 ? '' : 's'} in the ledger${filters.active ? ' match these filters' : ''}. Append-only — nothing here can be edited.` : 'Every stock movement, append-only.'}
        actions={
          <Button variant="outline" asChild>
            <a href={`/api/moves.csv${qs(filters.values)}`} download>
              <Download data-icon="inline-start" />
              Export CSV
            </a>
          </Button>
        }
      />

      <FilterBar
        search={filters.values.q}
        onSearch={(v) => setFilter('q', v)}
        searchPlaceholder="Search reference, SKU or product"
        facets={facets}
        values={filters.values}
        onFacet={(k, v) => setFilter(k as (typeof FILTER_KEYS)[number], v)}
        onClear={filters.clear}
        active={filters.active}
        className="mb-2"
      />
      <div className="mb-3 flex flex-wrap items-center gap-3 text-table">
        <div className="flex items-center gap-2">
          <Label htmlFor="from" className="text-muted-foreground">From</Label>
          <Input id="from" type="date" className="h-8 w-40" value={filters.values.from ?? ''} onChange={(e) => setFilter('from', e.target.value || undefined)} />
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="to" className="text-muted-foreground">To</Label>
          <Input id="to" type="date" className="h-8 w-40" value={filters.values.to ?? ''} onChange={(e) => setFilter('to', e.target.value || undefined)} />
        </div>
      </div>

      {product && (
        <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-lg border bg-muted/40 px-4 py-2.5 text-sm">
          <Link to={`/products/${product.id}`} className="font-medium hover:underline">
            {product.name}
          </Link>
          <span className="font-mono text-xs text-muted-foreground">{product.sku}</span>
          <span className="text-muted-foreground">
            {scopeLabel ? `Balance at ${scopeLabel}` : 'Balance across all locations'} — the newest row equals on-hand now.
          </span>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border">
        <div className="overflow-x-auto">
          <table className="w-full text-table">
            <caption className="sr-only">Stock moves</caption>
            <thead className="bg-muted/60">
              <tr className="border-b text-xs text-muted-foreground">
                <th scope="col" className="h-9 px-3 text-left font-medium">Date</th>
                <th scope="col" className="h-9 px-3 text-left font-medium">Reference</th>
                <th scope="col" className="h-9 px-3 text-left font-medium">Product</th>
                <th scope="col" className="hidden h-9 px-3 text-left font-medium md:table-cell">From → To</th>
                <th scope="col" className="h-9 px-3 text-right font-medium">Change</th>
                {showBalance && <th scope="col" className="h-9 px-3 text-right font-medium">Balance</th>}
              </tr>
            </thead>
            <tbody>
              {!data &&
                Array.from({ length: 10 }, (_, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td colSpan={showBalance ? 6 : 5} className="h-9 px-3">
                      <Skeleton className="h-3.5 w-full" />
                    </td>
                  </tr>
                ))}
              {data?.items.map((m) => <MoveRowView key={m.id} m={m} showBalance={showBalance} />)}
            </tbody>
          </table>
          {data && data.items.length === 0 && (
            <EmptyState
              icon={History}
              title="No moves match these filters"
              action={
                <Button variant="outline" size="sm" onClick={filters.clear}>
                  Clear filters
                </Button>
              }
            />
          )}
        </div>
        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground">
            <span aria-live="polite">
              {formatNumber((page - 1) * PAGE_SIZE + 1)}–{formatNumber(Math.min(total, page * PAGE_SIZE))} of {formatNumber(total)}
            </span>
            <div className="flex items-center gap-1">
              <span className="mr-2">
                Page {page} of {lastPage}
              </span>
              <Button variant="ghost" size="icon-sm" aria-label="Previous page" disabled={page <= 1} onClick={() => goTo(page - 1)}>
                <ChevronLeft />
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label="Next page" disabled={page >= lastPage} onClick={() => goTo(page + 1)}>
                <ChevronRight />
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

function MoveRowView({ m, showBalance }: { m: MoveRow; showBalance: boolean }) {
  return (
    <tr className="h-9 border-b last:border-0">
      <td className="px-3 whitespace-nowrap text-muted-foreground">{formatDateTime(m.createdAt)}</td>
      <td className="px-3 whitespace-nowrap">
        <Link to={operationUrl(m.type, m.operationId)} className="font-mono text-xs hover:underline">
          {m.reference}
        </Link>
        <span className="ml-2 text-xs text-muted-foreground">{OPERATION_CONFIG[m.type].label}</span>
      </td>
      <td className="px-3">
        <Link to={`/products/${m.productId}`} className="hover:underline">
          {m.productName}
        </Link>{' '}
        <span className="font-mono text-xs text-muted-foreground">{m.sku}</span>
      </td>
      <td className="hidden px-3 font-mono text-xs whitespace-nowrap text-muted-foreground md:table-cell">
        {m.fromLocation} → {m.toLocation}
      </td>
      <td className={cn('px-3 text-right font-medium whitespace-nowrap tabular-nums', m.delta > 0 && 'text-success', m.delta < 0 && 'text-danger')}>
        {m.delta === 0 ? (
          <span className="font-normal text-muted-foreground">{formatNumber(m.qty)} moved</span>
        ) : (
          <Qty value={m.delta} uom={m.uom} signed />
        )}
      </td>
      {showBalance && <td className="px-3 text-right tabular-nums">{m.balance === null ? '—' : <Qty value={m.balance} uom={m.uom} />}</td>}
    </tr>
  )
}
