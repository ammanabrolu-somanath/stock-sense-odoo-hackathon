import { ChevronsUpDown, LogOut, UserRound } from 'lucide-react'
import { NavLink, useLocation, useNavigate } from 'react-router'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar'
import { useLogout, useSession } from '@/features/auth/queries'
import { useOperationCounts } from '@/features/operations/queries'
import { initials } from '@/lib/format'
import { navGroups } from './nav'
import { Logo } from './Logo'

function isActive(pathname: string, to: string) {
  return to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(`${to}/`)
}

export function AppSidebar() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { data: user } = useSession()
  const logout = useLogout()
  const counts = useOperationCounts()
  if (!user) return null

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-12 justify-center border-b border-sidebar-border px-3 group-data-[collapsible=icon]:px-2">
        <Logo />
      </SidebarHeader>

      <SidebarContent className="gap-0 py-1">
        {navGroups.map((group) => (
          <SidebarGroup key={group.label} className="py-1.5">
            <SidebarGroupLabel className="h-6 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      asChild
                      size="sm"
                      tooltip={item.title}
                      isActive={isActive(pathname, item.to)}
                      className="h-8 text-[13px] data-[active=true]:font-medium"
                    >
                      <NavLink to={item.to} end={item.to === '/'}>
                        <item.icon />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                    {item.badgeKey && counts.data && counts.data[item.badgeKey].pending > 0 && (
                      <SidebarMenuBadge
                        className={counts.data[item.badgeKey].overdue > 0 ? 'text-warning' : 'text-muted-foreground'}
                        aria-label={`${counts.data[item.badgeKey].pending} open${counts.data[item.badgeKey].overdue ? `, ${counts.data[item.badgeKey].overdue} overdue` : ''}`}
                      >
                        {counts.data[item.badgeKey].pending}
                      </SidebarMenuBadge>
                    )}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" aria-label="Profile menu" className="data-[state=open]:bg-sidebar-accent">
                  <Avatar className="size-7 rounded-md">
                    <AvatarFallback className="rounded-md bg-foreground text-[11px] font-medium text-background">
                      {initials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left leading-tight">
                    <span className="truncate text-[13px] font-medium text-foreground">{user.name}</span>
                    <span className="truncate text-xs text-muted-foreground">{user.email}</span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4 text-muted-foreground" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-(--radix-dropdown-menu-trigger-width) min-w-56">
                <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">{user.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => navigate('/profile')}>
                  <UserRound />
                  My Profile
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => logout.mutate(undefined, { onSettled: () => navigate('/login') })}>
                  <LogOut />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
