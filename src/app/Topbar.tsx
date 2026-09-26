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

export type RouteHandle = { crumb?: string }

export function Topbar() {
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
    </header>
  )
}
