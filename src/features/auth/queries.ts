import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { SessionUser } from '@domain/api.ts'
import { api } from '@/lib/api'

export const sessionKey = ['session'] as const

/** The signed-in user, or null when signed out. */
export function useSession() {
  return useQuery({
    queryKey: sessionKey,
    queryFn: async () => (await api<{ user: SessionUser | null }>('/api/auth/me')).user,
    staleTime: 5 * 60_000,
  })
}

function useSetSession() {
  const qc = useQueryClient()
  return (user: SessionUser | null) => {
    if (user === null) qc.clear()
    qc.setQueryData(sessionKey, user)
  }
}

export function useLogin() {
  const setSession = useSetSession()
  return useMutation({
    mutationFn: (body: { email: string; password: string }) =>
      api<{ user: SessionUser }>('/api/auth/login', { method: 'POST', body }),
    onSuccess: ({ user }) => setSession(user),
  })
}

export function useSignup() {
  const setSession = useSetSession()
  return useMutation({
    mutationFn: (body: { name: string; email: string; password: string }) =>
      api<{ user: SessionUser }>('/api/auth/signup', { method: 'POST', body }),
    onSuccess: ({ user }) => setSession(user),
  })
}

export function useLogout() {
  const setSession = useSetSession()
  return useMutation({
    mutationFn: () => api<void>('/api/auth/logout', { method: 'POST' }),
    onSettled: () => setSession(null),
  })
}

export function useRequestOtp() {
  return useMutation({
    mutationFn: (body: { email: string }) =>
      api<{ ok: true; message: string; demoCode?: string }>('/api/auth/otp/request', { method: 'POST', body }),
  })
}

export function useVerifyOtp() {
  return useMutation({
    mutationFn: (body: { email: string; code: string }) => api<{ ok: true }>('/api/auth/otp/verify', { method: 'POST', body }),
  })
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (body: { email: string; code: string; password: string }) =>
      api<{ ok: true; message: string }>('/api/auth/otp/reset', { method: 'POST', body }),
  })
}
