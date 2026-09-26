import { useMutation, useQueryClient } from '@tanstack/react-query'

import type { LocationSummary, WarehouseSummary } from '@domain/api.ts'
import type { Id } from '@domain/types.ts'
import { api } from '@/lib/api'

export function useCreateWarehouse() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { code: string; name: string; city: string; capacityUnits: number }) =>
      api<WarehouseSummary>('/api/warehouses', { method: 'POST', body }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['warehouses'] })
      void qc.invalidateQueries({ queryKey: ['locations'] })
    },
  })
}

export function useUpdateWarehouse(id: Id) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { name?: string; city?: string; capacityUnits?: number }) =>
      api<WarehouseSummary>(`/api/warehouses/${id}`, { method: 'PATCH', body }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['warehouses'] }),
  })
}

export function useAddLocation(warehouseId: Id) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => api<LocationSummary>(`/api/warehouses/${warehouseId}/locations`, { method: 'POST', body: { name } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['warehouses'] })
      void qc.invalidateQueries({ queryKey: ['locations'] })
    },
  })
}

/** Restores the seeded demo inventory (accounts and sessions are kept). Every cached number is stale after. */
export function useResetDemo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api<{ ok: true; moves: number; operations: number }>('/api/demo/reset', { method: 'POST' }),
    onSuccess: () => void qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== 'session' }),
  })
}
