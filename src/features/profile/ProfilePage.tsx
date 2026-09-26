import { LogOut } from 'lucide-react'
import { useNavigate } from 'react-router'

import { PageHeader } from '@/components/shared/PageHeader'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { useLogout, useSession } from '@/features/auth/queries'
import { formatDate, initials } from '@/lib/format'

export function ProfilePage() {
  const { data: user } = useSession()
  const logout = useLogout()
  const navigate = useNavigate()
  if (!user) return null

  return (
    <>
      <PageHeader title="My Profile" description="Your account details." />
      <section className="max-w-xl rounded-lg border">
        <div className="flex items-center gap-4 p-5">
          <Avatar className="size-12 rounded-lg">
            <AvatarFallback className="rounded-lg bg-foreground text-base font-medium text-background">{initials(user.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate font-medium">{user.name}</p>
            <p className="truncate text-sm text-muted-foreground">{user.email}</p>
          </div>
        </div>
        <dl className="grid grid-cols-[140px_1fr] gap-y-3 border-t p-5 text-sm">
          <dt className="text-muted-foreground">Member since</dt>
          <dd>{formatDate(user.createdAt)}</dd>
          <dt className="text-muted-foreground">Password</dt>
          <dd>Change it anytime with a one-time code from the sign-in screen.</dd>
        </dl>
        <div className="flex justify-end border-t p-4">
          <Button variant="outline" onClick={() => logout.mutate(undefined, { onSettled: () => navigate('/login') })} disabled={logout.isPending}>
            <LogOut data-icon="inline-start" />
            Log out
          </Button>
        </div>
      </section>
    </>
  )
}
