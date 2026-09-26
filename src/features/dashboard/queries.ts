import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { api, qs } from '@/lib/api'

export interface PendingKpi {
  pending: number
  overdue: number
  waiting: number
}

export interface DashboardKpis {
  scope: { warehouseId: number | null; locationId: number | null; categoryId: number | null }
  productsInStock: number
  totalProducts: number
  stockValue: number
  lowStock: number
  outOfStock: number
  pendingReceipts: PendingKpi
  pendingDeliveries: PendingKpi
  transfersScheduled: PendingKpi
}

export interface DashboardScope {
  warehouseId?: string
  locationId?: string
  categoryId?: string
}

export function useDashboard(scope: DashboardScope) {
  return useQuery({
    queryKey: ['dashboard', scope],
    queryFn: () => api<DashboardKpis>(`/api/dashboard${qs({ ...scope })}`),
    placeholderData: keepPreviousData,
  })
}
