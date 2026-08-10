'use client'

import { Fragment, useMemo } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bell } from 'lucide-react'

import { GlobalSearch } from '@/components/admin/GlobalSearch'
import { NotificationBell } from '@/components/admin/NotificationBell'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import {
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { NavItem } from '@/lib/permissions-map'

interface AdminLayoutClientProps {
  user: {
    name: string | null
    email: string
    role: string
  }
  navigation: NavItem[]
  className?: string
  children: React.ReactNode
}

interface Crumb {
  href: string
  label: string
  isLast: boolean
}

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

function AdminLayoutInner({
  user,
  navigation,
  children,
  breadcrumbs,
  className,
}: AdminLayoutClientProps & { breadcrumbs: Crumb[] }) {
  const { state } = useSidebar()

  // Desktop sidebar width depends on collapsed state. On mobile (<md) the
  // sidebar renders as an off-canvas Sheet, so the grid column is forced to
  // 0 via CSS — independent of JS hydration to avoid layout breakage in
  // mobile portrait before useIsMobile resolves.
  const desktopSidebarWidth =
    state === 'collapsed'
      ? 'calc(3rem + 1rem)' // icon width + inset padding
      : '16rem'

  return (
    <div
      className={cn(
        'grid h-svh w-screen overflow-hidden [grid-template-columns:0_minmax(0,1fr)] md:[grid-template-columns:var(--admin-sidebar-w)_minmax(0,1fr)]',
        className,
      )}
      style={{ '--admin-sidebar-w': desktopSidebarWidth } as React.CSSProperties}
    >
      <AppSidebar user={user} navigation={navigation} />
      <div className="flex h-svh min-w-0 flex-col overflow-hidden">
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
            <div className="mr-1 hidden md:block">
              <GlobalSearch />
            </div>
            <NotificationBell />
            <Tooltip>
              <TooltipTrigger asChild>
                <ThemeToggle className="size-8 rounded-md px-0" />
              </TooltipTrigger>
              <TooltipContent>Toggle theme</TooltipContent>
            </Tooltip>
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="relative size-8"
                      aria-label="Notifications"
                    >
                      <Bell className="size-4" />
                      <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-destructive" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>Notifications</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/admin/messages">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">New contact form messages</span>
                      <span className="text-xs text-muted-foreground">View storefront contact form submissions</span>
                    </div>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/admin/orders">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">Recent orders</span>
                      <span className="text-xs text-muted-foreground">Review and fulfill open orders</span>
                    </div>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/admin/reviews">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">Customer reviews</span>
                      <span className="text-xs text-muted-foreground">Moderate new product reviews</span>
                    </div>
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="flex-1 min-h-0 min-w-0 overflow-auto p-3 sm:p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}

export function AdminLayoutClient({
  user,
  navigation,
  className,
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
        <AdminLayoutInner
          user={user}
          navigation={navigation}
          breadcrumbs={breadcrumbs}
          className={className}
        >
          {children}
        </AdminLayoutInner>
      </SidebarProvider>
    </TooltipProvider>
  )
}
