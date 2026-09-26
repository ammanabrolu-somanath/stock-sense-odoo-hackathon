import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'

import type { OperationView } from '@domain/api.ts'
import type { Id, OperationType } from '@domain/types.ts'
import { useInvalidateStock } from '@/features/products/queries'
import { api, qs } from '@/lib/api'

export interface OperationFilter {
  type?: OperationType
  status?: string
  warehouseId?: string
  locationId?: string
  categoryId?: string
  q?: string
}

export function useOperations(filter: OperationFilter) {
  return useQuery({
    queryKey: ['operations', filter],
    queryFn: async () => (await api<{ items: OperationView[] }>(`/api/operations${qs({ ...filter })}`)).items,
    placeholderData: keepPreviousData,
  })
}

export function useOperation(id: Id | undefined) {
  return useQuery({
    queryKey: ['operation', id],
    queryFn: () => api<OperationView>(`/api/operations/${id}`),
    enabled: id !== undefined,
  })
}

export type PendingCounts = Record<OperationType, { pending: number; overdue: number }>

export function useOperationCounts() {
  return useQuery({
    queryKey: ['operations', 'counts'],
    queryFn: () => api<PendingCounts>('/api/operations/counts'),
    staleTime: 30_000,
  })
}

/** On-hand per product at one location (availability / recorded quantity in line editors). */
export function useLocationStock(locationId: Id | undefined) {
  return useQuery({
    queryKey: ['locations', 'stock', locationId],
    queryFn: async () => {
      const { items } = await api<{ items: { productId: Id; qty: number }[] }>(`/api/locations/${locationId}/stock`)
      return new Map(items.map((i) => [i.productId, i.qty]))
    },
    enabled: locationId !== undefined,
  })
}

export function useCreateOperation() {
  const invalidate = useInvalidateStock()
  return useMutation({
    mutationFn: (body: unknown) => api<OperationView>('/api/operations', { method: 'POST', body }),
    onSuccess: () => void invalidate(),
  })
}

export function useUpdateOperation(id: Id) {
  const invalidate = useInvalidateStock()
  return useMutation({
    mutationFn: (body: unknown) => api<OperationView>(`/api/operations/${id}`, { method: 'PATCH', body }),
    onSuccess: () => void invalidate(),
  })
}

export type OperationAction = 'confirm' | 'check' | 'pick' | 'pack' | 'validate' | 'cancel'

/**
 * Lifecycle actions. Every action (success or failure) refetches, because a failed
 * validate can still mean the world changed (e.g. stock moved elsewhere).
 */
export function useOperationAction(id: Id) {
  const invalidate = useInvalidateStock()
  return useMutation({
    mutationFn: ({ action, body }: { action: OperationAction; body?: unknown }) =>
      api<OperationView>(`/api/operations/${id}/${action}`, { method: 'POST', body: body ?? {} }),
    onSettled: () => void invalidate(),
  })
}
