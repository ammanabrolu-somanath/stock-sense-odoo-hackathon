import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router'
import { Plus } from 'lucide-react'

import type { OperationView } from '@domain/api.ts'
import type { OperationType } from '@domain/types.ts'
import { DataTable } from '@/components/shared/DataTable'
import { columnsFor } from '@/components/shared/data-table'
import { EmptyState } from '@/components/shared/EmptyState'
import { FilterBar, useUrlFilters } from '@/components/shared/FilterBar'
import { Kbd } from '@/components/shared/Kbd'
import { PageHeader } from '@/components/shared/PageHeader'
import { OperationStatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { useCategories, useLocations, useWarehouses } from '@/features/products/queries'
import { useShortcut } from '@/hooks/use-shortcut'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { OPERATION_CONFIG, operationUrl } from './config'
import { useOperations } from './queries'
import { isOpen, isOverdue } from './utils'

const col = columnsFor<OperationView>()
function buildColumns(type: OperationType) {
  const config = OPERATION_CONFIG[type]
  return [
    col.accessor('reference', {
      header: 'Reference',
      sortFn: 'text',
      cell: (c) => <span className="font-mono text-xs font-medium">{c.getValue()}</span>,
    }),
    ...(config.partner
      ? [col.accessor('partner', { header: config.partner.label, sortFn: 'text', cell: (c) => c.getValue() ?? <span className="text-muted-foreground">—</span> })]
      : []),
    col.display({
      id: 'route',
      header: type === 'adjustment' ? 'Location' : 'From → To',
      meta: { className: 'hidden md:table-cell' },
      cell: ({ row }) => (
        <span className="font-mono text-xs whitespace-nowrap text-muted-foreground">
          {type === 'adjustment' ? row.original.destLocation : `${row.original.sourceLocation} → ${row.original.destLocation}`}
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
    col.display({
      id: 'lines',
      header: 'Products',
      meta: { align: 'right', className: 'hidden lg:table-cell' },
      cell: ({ row }) => {
        const n = row.original.lines.length
        return <span className="text-muted-foreground tabular-nums">{n}</span>
      },
    }),
    col.accessor('status', { header: 'Status', sortFn: 'text', cell: (c) => <OperationStatusBadge status={c.getValue()} /> }),
  ]
}

const FILTER_KEYS = ['q', 'status', 'warehouseId', 'locationId', 'categoryId'] as const

export function OperationListPage({ type }: { type: OperationType }) {
  const config = OPERATION_CONFIG[type]
  const navigate = useNavigate()
  const filters = useUrlFilters(FILTER_KEYS)
  const operations = useOperations({ type, ...filters.values })
  const warehouses = useWarehouses()
  const categories = useCategories()
  const locations = useLocations()
  const columns = useMemo(() => buildColumns(type), [type])
  useShortcut('n', () => navigate(operationUrl(type, 'new')))

  const facets = useMemo(
    () => [
      {
        key: 'status',
        label: 'Status',
        options: [
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

  const items = operations.data
  const open = items?.filter(isOpen).length ?? 0
  const late = items?.filter(isOverdue).length ?? 0

  return (
    <>
      <PageHeader
        title={config.plural}
        description={items ? `${open} open${late ? ` · ${late} overdue` : ''} · ${items.length} total` : config.description}
        actions={
          <Button asChild>
            <Link to={operationUrl(type, 'new')}>
              <Plus data-icon="inline-start" />
              New {config.label.toLowerCase()}
              <Kbd className="ml-1 border-primary-foreground/30 bg-primary-foreground/15 text-primary-foreground">N</Kbd>
            </Link>
          </Button>
        }
      />
      <FilterBar
        search={filters.values.q}
        onSearch={(v) => filters.set('q', v)}
        searchPlaceholder={config.partner ? `Search reference or ${config.partner.label.toLowerCase()}` : 'Search reference'}
        facets={facets}
        values={filters.values}
        onFacet={(k, v) => filters.set(k as (typeof FILTER_KEYS)[number], v)}
        onClear={filters.clear}
        active={filters.active}
      />
      <DataTable
        caption={config.plural}
        data={items}
        columns={columns}
        isLoading={operations.isPending}
        getRowId={(op) => String(op.id)}
        rowLabel={(op) => `${op.reference}, ${op.status}`}
        onRowOpen={(op) => navigate(operationUrl(type, op.id))}
        empty={
          <EmptyState
            icon={config.icon}
            title={filters.active ? `No ${config.plural.toLowerCase()} match these filters` : config.emptyTitle}
            description={filters.active ? undefined : config.description}
            action={
              filters.active ? (
                <Button variant="outline" size="sm" onClick={filters.clear}>
                  Clear filters
                </Button>
              ) : (
                <Button asChild>
                  <Link to={operationUrl(type, 'new')}>New {config.label.toLowerCase()}</Link>
                </Button>
              )
            }
          />
        }
      />
    </>
  )
}
