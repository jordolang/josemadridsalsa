'use client'

import { Fragment, useMemo } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bell } from 'lucide-react'

import { AppSidebar } from '@/components/admin/AppSidebar'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { NavItem } from '@/lib/permissions-map'

interface AdminLayoutClientProps {
  user: {
    name: string | null
    email: string
    role: string
  }
  navigation: NavItem[]
  children: React.ReactNode
}

interface Crumb {
  href: string
  label: string
  isLast: boolean
}

/**
 * Builds a breadcrumb trail by walking the navigation tree to find labels
 * for each pathname segment, falling back to a humanized segment.
 */
function buildBreadcrumbs(pathname: string, navigation: NavItem[]): Crumb[] {
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length === 0) return []

  const labelLookup = new Map<string, string>()
  const collect = (items: NavItem[]) => {
    for (const item of items) {
      labelLookup.set(item.href, item.label)
      if (item.children) collect(item.children)
    }
  }
  collect(navigation)

  const crumbs: Crumb[] = []
  let accumulatedHref = ''
  segments.forEach((segment, index) => {
    accumulatedHref += '/' + segment
    const fromNav = labelLookup.get(accumulatedHref)
    const fallback = segment
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
    crumbs.push({
      href: accumulatedHref,
      label: fromNav ?? fallback,
      isLast: index === segments.length - 1,
    })
  })

  return crumbs
}

export function AdminLayoutClient({
  user,
  navigation,
  children,
}: AdminLayoutClientProps) {
  const pathname = usePathname()
  const breadcrumbs = useMemo(
    () => buildBreadcrumbs(pathname, navigation),
    [pathname, navigation]
  )

  return (
    <TooltipProvider delayDuration={200}>
      <SidebarProvider>
        <AppSidebar user={user} navigation={navigation} />
        <SidebarInset>
          <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/75">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                {breadcrumbs.map((crumb, index) => (
                  <Fragment key={crumb.href}>
                    {index > 0 && <BreadcrumbSeparator />}
                    <BreadcrumbItem>
                      {crumb.isLast ? (
                        <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink asChild>
                          <Link href={crumb.href}>{crumb.label}</Link>
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                  </Fragment>
                ))}
              </BreadcrumbList>
            </Breadcrumb>
            <div className="ml-auto flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="relative size-8"
                    aria-label="Notifications"
                  >
                    <Bell className="size-4" />
                    <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-destructive" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Notifications</TooltipContent>
              </Tooltip>
            </div>
          </header>
          <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
