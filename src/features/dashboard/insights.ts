import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'

import type { OperationView, ProductSummary, WarehouseSummary } from '@domain/api.ts'
import type { HealthScore } from '@domain/health-score.ts'
import type { Id, OperationType } from '@domain/types.ts'
import { useInvalidateStock } from '@/features/products/queries'
import { api, qs } from '@/lib/api'
import type { DashboardScope } from './queries'

export interface SeriesPoint {
  date: string
  inbound: number
  outbound: number
}

export interface DashboardInsights {
  health: HealthScore
  alerts: { total: number; items: ProductSummary[] }
  series: SeriesPoint[]
  utilization: WarehouseSummary[]
  activity: { id: Id; reference: string; type: OperationType; partner: string | null; doneAt: string; lines: number }[]
}

export function useInsights(scope: DashboardScope) {
  return useQuery({
    queryKey: ['dashboard', 'insights', scope],
    queryFn: () => api<DashboardInsights>(`/api/dashboard/insights${qs({ ...scope })}`),
    placeholderData: keepPreviousData,
  })
}

/** One click: a draft receipt pre-filled from the smart reorder suggestion. */
export function useReorder() {
  const invalidate = useInvalidateStock()
  return useMutation({
    mutationFn: (productId: Id) => api<OperationView>(`/api/products/${productId}/reorder`, { method: 'POST' }),
    onSuccess: () => void invalidate(),
  })
}
