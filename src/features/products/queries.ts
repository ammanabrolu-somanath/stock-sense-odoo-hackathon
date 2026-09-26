import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { LocationSummary, MoveRow, Page, ProductDetail, ProductSummary, WarehouseSummary } from '@domain/api.ts'
import type { Category, Id } from '@domain/types.ts'
import { api, qs } from '@/lib/api'

export interface ProductFilter {
  q?: string
  categoryId?: string
  warehouseId?: string
  status?: string
}

/** Everything whose numbers depend on the ledger; invalidated after any stock-changing mutation. */
export const stockKeys = ['products', 'product', 'moves', 'warehouses', 'locations', 'operations', 'operation', 'dashboard'] as const

export function useInvalidateStock() {
  const qc = useQueryClient()
  return () => Promise.all(stockKeys.map((k) => qc.invalidateQueries({ queryKey: [k] })))
}

export function useProducts(filter: ProductFilter = {}) {
  return useQuery({
    queryKey: ['products', filter],
    queryFn: async () => (await api<{ items: ProductSummary[] }>(`/api/products${qs({ ...filter })}`)).items,
    placeholderData: keepPreviousData,
  })
}

export function useProduct(id: Id | undefined) {
  return useQuery({
    queryKey: ['product', id],
    queryFn: () => api<ProductDetail>(`/api/products/${id}`),
    enabled: id !== undefined,
  })
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => (await api<{ items: Category[] }>('/api/categories')).items,
    staleTime: 5 * 60_000,
  })
}

export function useWarehouses() {
  return useQuery({
    queryKey: ['warehouses'],
    queryFn: async () => (await api<{ items: WarehouseSummary[] }>('/api/warehouses')).items,
  })
}

export function useLocations() {
  return useQuery({
    queryKey: ['locations'],
    queryFn: async () => (await api<{ items: LocationSummary[] }>('/api/locations')).items,
  })
}

export function useMoves(filter: Record<string, string | number | undefined>) {
  return useQuery({
    queryKey: ['moves', filter],
    queryFn: () => api<Page<MoveRow>>(`/api/moves${qs(filter)}`),
    placeholderData: keepPreviousData,
  })
}

export function useCreateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => api<Category>('/api/categories', { method: 'POST', body: { name } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  })
}

export function useSaveProduct(id?: Id) {
  const invalidate = useInvalidateStock()
  return useMutation({
    mutationFn: (body: unknown) =>
      id === undefined
        ? api<ProductDetail>('/api/products', { method: 'POST', body })
        : api<ProductDetail>(`/api/products/${id}`, { method: 'PATCH', body }),
    onSuccess: () => void invalidate(),
  })
}
