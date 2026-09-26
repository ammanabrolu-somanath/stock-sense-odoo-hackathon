import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { useTable, type RowData, type SortingState } from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { dataTableFeatures, type DataColumn } from './data-table'

/**
 * Shared table: sorting + pagination (TanStack Table v9), dense 36px rows, keyboard row
 * navigation (↑/↓ move, Enter opens). Search/filters live in FilterBar and the API.
 */
interface DataTableProps<T extends RowData> {
  data: T[] | undefined
  columns: DataColumn<T>[]
  getRowId: (row: T) => string
  onRowOpen?: (row: T) => void
  rowLabel?: (row: T) => string
  isLoading?: boolean
  empty?: ReactNode
  initialSorting?: SortingState
  pageSize?: number
  caption?: string
}

export function DataTable<T extends RowData>({
  data,
  columns,
  getRowId,
  onRowOpen,
  rowLabel,
  isLoading,
  empty,
  initialSorting = [],
  pageSize = 25,
  caption,
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>(initialSorting)
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize })
  const bodyRef = useRef<HTMLTableSectionElement>(null)

  const table = useTable({
    features: dataTableFeatures,
    columns,
    data: data ?? [],
    getRowId,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    autoResetPageIndex: true,
  })

  function onRowKey(e: KeyboardEvent<HTMLTableRowElement>, row: T) {
    const rows = Array.from(bodyRef.current?.querySelectorAll<HTMLTableRowElement>('tr[data-row]') ?? [])
    const i = rows.indexOf(e.currentTarget)
    if (e.key === 'ArrowDown') rows[i + 1]?.focus()
    else if (e.key === 'ArrowUp') rows[i - 1]?.focus()
    else if (e.key === 'Enter' && onRowOpen) onRowOpen(row)
    else return
    e.preventDefault()
  }

  const total = data?.length ?? 0
  const rows = table.getRowModel().rows
  const first = total === 0 ? 0 : pagination.pageIndex * pagination.pageSize + 1
  const last = Math.min(total, (pagination.pageIndex + 1) * pagination.pageSize)

  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="overflow-x-auto">
        <table className="w-full text-table">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead className="sticky top-0 z-[1] bg-muted/60 backdrop-blur-sm">
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id} className="border-b">
                {group.headers.map((header) => {
                  const meta = header.column.columnDef.meta
                  const canSort = header.column.getCanSort()
                  const sorted = header.column.getIsSorted()
                  const SortIcon = sorted === 'asc' ? ArrowUp : sorted === 'desc' ? ArrowDown : ChevronsUpDown
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : undefined}
                      className={cn(
                        'h-9 px-3 text-left text-xs font-medium whitespace-nowrap text-muted-foreground',
                        meta?.align === 'right' && 'text-right',
                        meta?.className,
                      )}
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className={cn(
                            'inline-flex items-center gap-1 rounded-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring',
                            meta?.align === 'right' && 'flex-row-reverse',
                            sorted && 'text-foreground',
                          )}
                        >
                          <table.FlexRender header={header} />
                          <SortIcon className={cn('size-3', !sorted && 'opacity-40')} aria-hidden="true" />
                        </button>
                      ) : (
                        <table.FlexRender header={header} />
                      )}
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody ref={bodyRef}>
            {isLoading &&
              Array.from({ length: 8 }, (_, i) => (
                <tr key={i} className="border-b last:border-0">
                  {columns.map((_, j) => (
                    <td key={j} className="h-9 px-3">
                      <Skeleton className="h-3.5 w-full max-w-40" />
                    </td>
                  ))}
                </tr>
              ))}
            {!isLoading &&
              rows.map((row) => (
                <tr
                  key={row.id}
                  data-row
                  tabIndex={onRowOpen ? 0 : undefined}
                  aria-label={rowLabel?.(row.original)}
                  onClick={onRowOpen ? () => onRowOpen(row.original) : undefined}
                  onKeyDown={onRowOpen ? (e) => onRowKey(e, row.original) : undefined}
                  className={cn(
                    'h-9 border-b transition-colors last:border-0',
                    onRowOpen && 'cursor-pointer outline-none hover:bg-muted/50 focus-visible:bg-accent focus-visible:shadow-[inset_2px_0_0_var(--ring)]',
                  )}
                >
                  {row.getAllCells().map((cell) => {
                    const meta = cell.column.columnDef.meta
                    return (
                      <td
                        key={cell.id}
                        className={cn('px-3 py-1.5 align-middle', meta?.align === 'right' && 'text-right', meta?.className)}
                      >
                        <table.FlexRender cell={cell} />
                      </td>
                    )
                  })}
                </tr>
              ))}
          </tbody>
        </table>
        {!isLoading && total === 0 && <div className="border-t">{empty}</div>}
      </div>

      {!isLoading && total > pagination.pageSize && (
        <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground">
          <span aria-live="polite">
            {first}–{last} of {total}
          </span>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon-sm" aria-label="Previous page" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
              <ChevronLeft />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Next page" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
              <ChevronRight />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
