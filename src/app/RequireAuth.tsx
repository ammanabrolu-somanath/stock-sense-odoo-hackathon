import { Navigate, Outlet, useLocation, useSearchParams } from 'react-router'

import { Skeleton } from '@/components/ui/skeleton'
import { useSession } from '@/features/auth/queries'

function ShellSkeleton() {
  return (
    <div className="flex min-h-svh" aria-busy="true" aria-label="Loading StockSense">
      <div className="hidden w-60 border-r bg-sidebar p-3 md:block">
        <Skeleton className="h-6 w-28" />
        <div className="mt-8 grid gap-2">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-6 w-full" />
          ))}
        </div>
      </div>
      <div className="flex-1 p-6">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="mt-6 h-64 w-full" />
      </div>
    </div>
  )
}

/** Gate for the app shell: signed-out users go to /login and come back afterwards. */
export function RequireAuth() {
  const { data: user, isPending } = useSession()
  const location = useLocation()
  if (isPending) return <ShellSkeleton />
  if (!user) {
    const next = location.pathname + location.search
    return <Navigate to={next === '/' ? '/login' : `/login?next=${encodeURIComponent(next)}`} replace />
  }
  return <Outlet />
}

/** Only same-site paths — `?next=//evil.example` must not become an open redirect. */
function safeNext(value: string | null): string {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/'
}

/** Gate for auth screens: signed-in users (including the moment they sign in) go to `next` or the app. */
export function GuestOnly() {
  const { data: user, isPending } = useSession()
  const [params] = useSearchParams()
  if (isPending) return null
  if (user) return <Navigate to={safeNext(params.get('next'))} replace />
  return <Outlet />
}
