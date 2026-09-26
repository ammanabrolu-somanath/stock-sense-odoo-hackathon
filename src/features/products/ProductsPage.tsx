import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { PackageSearch, Plus } from 'lucide-react'

import type { ProductSummary } from '@domain/api.ts'
import { DataTable } from '@/components/shared/DataTable'
import { columnsFor } from '@/components/shared/data-table'
import { EmptyState } from '@/components/shared/EmptyState'
import { FilterBar, useUrlFilters } from '@/components/shared/FilterBar'
import { Kbd } from '@/components/shared/Kbd'
import { PageHeader } from '@/components/shared/PageHeader'
import { Money, Qty } from '@/components/shared/Qty'
import { StockStatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { useShortcut } from '@/hooks/use-shortcut'
import { formatMoneyCompact, formatNumber } from '@/lib/format'
import { ProductSheet } from './ProductSheet'
import { useCategories, useProducts, useWarehouses } from './queries'

const col = columnsFor<ProductSummary>()

const columns = [
  col.accessor('name', {
    header: 'Product',
    sortFn: 'text',
    cell: ({ row }) => (
      <div className="min-w-48">
        <div className="font-medium">{row.original.name}</div>
        <div className="font-mono text-xs text-muted-foreground">{row.original.sku}</div>
      </div>
    ),
  }),
  col.accessor('categoryName', { header: 'Category', sortFn: 'text', cell: (c) => <span className="text-muted-foreground">{c.getValue()}</span> }),
  col.accessor('onHand', {
    header: 'On hand',
    sortFn: 'basic',
    meta: { align: 'right' },
    cell: ({ row }) => <Qty value={row.original.onHand} uom={row.original.uom} trace={{ productId: row.original.id }} />,
  }),
  col.accessor('incoming', {
    header: 'Incoming',
    sortFn: 'basic',
    meta: { align: 'right', className: 'hidden md:table-cell' },
    cell: ({ row }) =>
      row.original.incoming > 0 ? <span className="text-muted-foreground tabular-nums">+{formatNumber(row.original.incoming)}</span> : <span className="text-muted-foreground">—</span>,
  }),
  col.accessor('daysOfCover', {
    header: 'Cover',
    sortFn: 'basic',
    meta: { align: 'right', className: 'hidden lg:table-cell' },
    cell: (c) => {
      const d = c.getValue()
      return <span className="text-muted-foreground tabular-nums">{d === null ? '—' : `${d} d`}</span>
    },
  }),
  col.accessor('status', {
    header: 'Status',
    sortFn: 'text',
    cell: (c) => <StockStatusBadge status={c.getValue()} />,
  }),
  col.accessor('value', {
    header: 'Value',
    sortFn: 'basic',
    meta: { align: 'right', className: 'hidden sm:table-cell' },
    cell: (c) => <Money value={c.getValue()} />,
  }),
]

const FILTER_KEYS = ['q', 'categoryId', 'status', 'warehouseId', 'locationId'] as const

export function ProductsPage() {
  const navigate = useNavigate()
  const [sheetOpen, setSheetOpen] = useState(false)
  const filters = useUrlFilters(FILTER_KEYS)
  const products = useProducts(filters.values)
  const categories = useCategories()
  const warehouses = useWarehouses()
  useShortcut('n', () => setSheetOpen(true))

  const facets = useMemo(
    () => [
      { key: 'categoryId', label: 'Category', options: (categories.data ?? []).map((c) => ({ value: String(c.id), label: c.name })) },
      {
        key: 'status',
        label: 'Stock',
        options: [
          { value: 'available', label: 'Any on hand' },
          { value: 'in_stock', label: 'In stock' },
          { value: 'low', label: 'Low stock' },
          { value: 'out', label: 'Out of stock' },
        ],
      },
      { key: 'warehouseId', label: 'Warehouse', options: (warehouses.data ?? []).map((w) => ({ value: String(w.id), label: `${w.code} · ${w.name}` })) },
    ],
    [categories.data, warehouses.data],
  )

  const items = products.data
  const value = items?.reduce((s, p) => s + p.value, 0) ?? 0
  const summary = items ? `${items.length} product${items.length === 1 ? '' : 's'} · ${formatMoneyCompact(value)} in stock` : 'Everything you stock, and where it is.'

  return (
    <>
      <PageHeader
        title="Products"
        description={summary}
        actions={
          <Button onClick={() => setSheetOpen(true)}>
            <Plus data-icon="inline-start" />
            New product
            <Kbd className="ml-1 border-primary-foreground/30 bg-primary-foreground/15 text-primary-foreground">N</Kbd>
          </Button>
        }
      />
      <FilterBar
        search={filters.values.q}
        onSearch={(v) => filters.set('q', v)}
        searchPlaceholder="Search by name or SKU"
        facets={facets}
        values={filters.values}
        onFacet={(k, v) => filters.set(k as (typeof FILTER_KEYS)[number], v)}
        onClear={filters.clear}
        active={filters.active}
      />
      <DataTable
        caption="Products"
        data={items}
        columns={columns}
        isLoading={products.isPending}
        getRowId={(p) => String(p.id)}
        rowLabel={(p) => `${p.name}, ${p.sku}`}
        onRowOpen={(p) => navigate(`/products/${p.id}`)}
        initialSorting={[{ id: 'name', desc: false }]}
        empty={
          filters.active ? (
            <EmptyState
              icon={PackageSearch}
              title="No products match these filters"
              action={
                <Button variant="outline" size="sm" onClick={filters.clear}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={PackageSearch}
              title="No products yet"
              description="Add your first product to start tracking stock."
              action={<Button onClick={() => setSheetOpen(true)}>New product</Button>}
            />
          )
        }
      />
      <ProductSheet open={sheetOpen} onOpenChange={setSheetOpen} onSaved={(p) => navigate(`/products/${p.id}`)} />
    </>
  )
}
