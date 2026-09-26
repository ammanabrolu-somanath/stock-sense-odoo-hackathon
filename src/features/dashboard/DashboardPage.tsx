import { useMemo } from 'react'
import { useNavigate } from 'react-router'
import { Inbox } from 'lucide-react'

import type { OperationView } from '@domain/api.ts'
import type { OperationType } from '@domain/types.ts'
import { DataTable } from '@/components/shared/DataTable'
import { columnsFor } from '@/components/shared/data-table'
import { EmptyState } from '@/components/shared/EmptyState'
import { FilterBar, useUrlFilters } from '@/components/shared/FilterBar'
import { PageHeader } from '@/components/shared/PageHeader'
import { OperationStatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { OPERATION_CONFIG, operationUrl } from '@/features/operations/config'
import { useOperations } from '@/features/operations/queries'
import { isOpen, isOverdue } from '@/features/operations/utils'
import { useCategories, useLocations, useWarehouses } from '@/features/products/queries'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { HealthScoreCard } from './HealthScoreCard'
import { useInsights } from './insights'
import { KpiGrid } from './KpiGrid'
import { LowStockPanel } from './LowStockPanel'
import { MovementChart } from './MovementChart'
import { ActivityFeed, WarehouseUtilization } from './SidePanels'
import { useDashboard } from './queries'

/** The spec's dynamic filters: document type · status · warehouse or location · product category. */
const FILTER_KEYS = ['q', 'type', 'status', 'warehouseId', 'locationId', 'categoryId'] as const
const ANY_STATUS = 'any'

const col = columnsFor<OperationView>()
const columns = [
  col.accessor('reference', { header: 'Reference', sortFn: 'text', cell: (c) => <span className="font-mono text-xs font-medium">{c.getValue()}</span> }),
  col.accessor('type', { header: 'Type', sortFn: 'text', cell: (c) => <span className="text-muted-foreground">{OPERATION_CONFIG[c.getValue()].label}</span> }),
  col.accessor('partner', {
    header: 'Partner',
    sortFn: 'text',
    meta: { className: 'hidden md:table-cell' },
    cell: (c) => c.getValue() ?? <span className="text-muted-foreground">—</span>,
  }),
  col.display({
    id: 'route',
    header: 'From → To',
    // Status matters more than the route here (it's on the document); show the route only when there's room.
    meta: { className: 'hidden 2xl:table-cell' },
    cell: ({ row }) => (
      <span className="font-mono text-xs whitespace-nowrap text-muted-foreground">
        {row.original.sourceLocation} → {row.original.destLocation}
      </span>
    ),
  }),
  col.accessor('scheduledDate', {
    header: 'Scheduled',
    sortFn: 'datetime',
    cell: ({ row }) => {
      const late = isOverdue(row.original)
      return (
        <span className={cn('whitespace-nowrap', late ? 'font-medium text-danger' : 'text-muted-foreground')}>
          {formatDate(row.original.scheduledDate)}
          {late && <span className="ml-1.5 text-xs">Overdue</span>}
        </span>
      )
    },
  }),
  col.accessor('status', { header: 'Status', sortFn: 'text', cell: (c) => <OperationStatusBadge status={c.getValue()} /> }),
]

export function DashboardPage() {
  const navigate = useNavigate()
  const filters = useUrlFilters(FILTER_KEYS)
  const { q, type, status, warehouseId, locationId, categoryId } = filters.values
  const scope = { warehouseId, locationId, categoryId }
  const kpis = useDashboard(scope)
  const insights = useInsights(scope)
  // Unset = open work, filtered on the server (not 900+ documents filtered in the browser).
  const serverStatus = !status ? 'open' : status === ANY_STATUS ? undefined : status
  const operations = useOperations({ type: type as OperationType | undefined, status: serverStatus, warehouseId, locationId, categoryId, q })
  const warehouses = useWarehouses()
  const locations = useLocations()
  const categories = useCategories()

  // No status chosen = open work (draft, waiting, ready), overdue first — what a manager acts on.
  const rows = useMemo(() => {
    const items = operations.data ?? []
    if (status) return items
    return items.filter(isOpen).sort((a, b) => Number(isOverdue(b)) - Number(isOverdue(a)) || a.scheduledDate.localeCompare(b.scheduledDate))
  }, [operations.data, status])

  const facets = useMemo(
    () => [
      { key: 'type', label: 'Document', options: Object.values(OPERATION_CONFIG).map((c) => ({ value: c.type, label: c.plural })) },
      {
        key: 'status',
        label: 'Status',
        allLabel: 'Open',
        options: [
          { value: ANY_STATUS, label: 'All statuses' },
          { value: 'draft', label: 'Draft' },
          { value: 'waiting', label: 'Waiting' },
          { value: 'ready', label: 'Ready' },
          { value: 'done', label: 'Done' },
          { value: 'canceled', label: 'Canceled' },
        ],
      },
      { key: 'warehouseId', label: 'Warehouse', options: (warehouses.data ?? []).map((w) => ({ value: String(w.id), label: `${w.code} · ${w.name}` })) },
      {
        key: 'locationId',
        label: 'Location',
        options: (locations.data ?? []).filter((l) => l.kind === 'internal').map((l) => ({ value: String(l.id), label: l.fullName })),
      },
      { key: 'categoryId', label: 'Category', options: (categories.data ?? []).map((c) => ({ value: String(c.id), label: c.name })) },
    ],
    [warehouses.data, locations.data, categories.data],
  )

  return (
    <>
      <PageHeader title="Dashboard" description="A snapshot of inventory operations. Every number opens the list behind it." />
      <FilterBar
        search={q}
        onSearch={(v) => filters.set('q', v)}
        searchPlaceholder="Search reference or partner"
        facets={facets}
        values={filters.values}
        onFacet={(k, v) => filters.set(k as (typeof FILTER_KEYS)[number], v)}
        onClear={filters.clear}
        active={filters.active}
      />
      <KpiGrid kpis={kpis.data} scope={scope} />

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="grid min-w-0 grid-cols-1 content-start gap-6 lg:col-span-2">
          {insights.data ? <MovementChart series={insights.data.series} /> : <Skeleton className="h-[330px]" />}
      <section aria-labelledby="overview-title">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 id="overview-title" className="text-sm font-medium">
            {status ? 'Operations' : 'Open operations'}
          </h2>
          <span className="text-xs text-muted-foreground" aria-live="polite">
            {operations.data ? `${rows.length} document${rows.length === 1 ? '' : 's'}` : ''}
          </span>
        </div>
        <DataTable
          caption="Operations overview"
          data={operations.data ? rows : undefined}
          columns={columns}
          isLoading={operations.isPending}
          pageSize={10}
          getRowId={(op) => String(op.id)}
          rowLabel={(op) => `${op.reference}, ${op.status}`}
          onRowOpen={(op) => navigate(operationUrl(op.type, op.id))}
          empty={
            <EmptyState
              icon={Inbox}
              title={filters.active ? 'Nothing matches these filters' : 'No open operations'}
              action={
                filters.active ? (
                  <Button variant="outline" size="sm" onClick={filters.clear}>
                    Clear filters
                  </Button>
                ) : undefined
              }
            />
          }
        />
      </section>
        </div>
        <div className="grid min-w-0 grid-cols-1 content-start gap-6">
          {insights.data ? (
            <>
              <HealthScoreCard health={insights.data.health} />
              <LowStockPanel total={insights.data.alerts.total} items={insights.data.alerts.items} />
              <WarehouseUtilization warehouses={insights.data.utilization} />
              <ActivityFeed items={insights.data.activity} />
            </>
          ) : (
            <>
              <Skeleton className="h-80" />
              <Skeleton className="h-64" />
            </>
          )}
        </div>
      </div>
    </>
  )
}
