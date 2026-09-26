import { Fragment } from 'react'
import { Link, useMatches } from 'react-router'

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { Moon, Sun } from 'lucide-react'
import type { LiveStatus } from '@/hooks/use-live-updates'
import { cn } from '@/lib/utils'
import { AlertCenter } from './AlertCenter'
import { CommandMenu } from './CommandMenu'
import { useTheme } from './theme'

export type RouteHandle = { crumb?: string }

const LIVE_LABEL: Record<LiveStatus, string> = {
  live: 'Live — updates from other users appear automatically',
  connecting: 'Connecting to live updates…',
  offline: 'Live updates offline — refresh to reconnect',
}

export function Topbar({ live }: { live: LiveStatus }) {
  const { theme, setTheme } = useTheme()
  const crumbs = useMatches()
    .filter((m) => (m.handle as RouteHandle | undefined)?.crumb)
    .map((m) => ({ label: (m.handle as RouteHandle).crumb as string, to: m.pathname }))

  return (
    <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur-sm supports-backdrop-filter:bg-background/80">
      <SidebarTrigger className="-ml-1.5 text-muted-foreground" />
      <Separator orientation="vertical" className="mr-1 self-center data-[orientation=vertical]:h-4" />
      <Breadcrumb>
        <BreadcrumbList className="text-[13px]">
          {crumbs.map((c, i) => (
            <Fragment key={`${i}:${c.to}`}>
              {i > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem>
                {i === crumbs.length - 1 ? (
                  <BreadcrumbPage className="font-medium">{c.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link to={c.to}>{c.label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
      <div className="ml-auto flex items-center gap-1.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <span role="status" aria-label={LIVE_LABEL[live]} className="mr-1 hidden items-center gap-1.5 text-xs text-muted-foreground md:flex">
              <span className={cn('size-1.5 rounded-full', live === 'live' ? 'bg-success' : live === 'connecting' ? 'bg-warning' : 'bg-danger')} aria-hidden="true" />
              {live === 'live' ? 'Live' : live === 'connecting' ? 'Connecting' : 'Offline'}
            </span>
          </TooltipTrigger>
          <TooltipContent>{LIVE_LABEL[live]}</TooltipContent>
        </Tooltip>
        <CommandMenu />
        <AlertCenter />
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground"
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          {theme === 'dark' ? <Sun /> : <Moon />}
        </Button>
      </div>
    </header>
  )
}
