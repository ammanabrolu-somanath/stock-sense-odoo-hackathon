import {
  createColumnHelper,
  createPaginatedRowModel,
  createSortedRowModel,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
  type ColumnDef,
  type RowData,
} from '@tanstack/react-table'

/** Table features and column helpers shared by every DataTable (TanStack Table v9). */
export const dataTableFeatures = tableFeatures({
  rowSortingFeature,
  rowPaginationFeature,
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, text: sortFn_text, basic: sortFn_basic, datetime: sortFn_datetime },
  columnMeta: {} as { align?: 'left' | 'right'; className?: string },
})

export type DataTableFeatures = typeof dataTableFeatures
// oxlint-disable-next-line typescript/no-explicit-any -- column value types differ per column
export type DataColumn<T extends RowData> = ColumnDef<DataTableFeatures, T, any>
export const columnsFor = <T extends RowData>() => createColumnHelper<DataTableFeatures, T>()
