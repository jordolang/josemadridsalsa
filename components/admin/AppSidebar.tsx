'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Activity,
  BarChart3,
  Building2,
  ChefHat,
  DollarSign,
  FileText,
  Gift,
  Heart,
  LayoutDashboard,
  Lock,
  type LucideIcon,
  Mail,
  MessageSquare,
  Package,
  Settings,
  Share2,
  ShoppingCart,
  TrendingUp,
  Users,
} from 'lucide-react'

import { NavUser } from '@/components/admin/NavUser'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import type { NavItem } from '@/lib/permissions-map'

// Map navigation icon strings to lucide components
const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  FileText,
  Heart,
  BarChart3,
  Activity,
  MessageSquare,
  Share2,
  DollarSign,
  Building2,
  Settings,
  Gift,
  TrendingUp,
  Lock,
  Mail,
}

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  user: {
    name: string | null
    email: string
    role: string
  }
  navigation: NavItem[]
}

/**
 * Returns the navigation item whose href best matches the current pathname.
 * Prefers the longest matching href so child routes activate the correct parent.
 */
function findActiveItem(navigation: NavItem[], pathname: string): NavItem | null {
  let best: NavItem | null = null
  let bestLength = -1

  for (const item of navigation) {
    const candidates: NavItem[] = [item, ...(item.children ?? [])]
    for (const candidate of candidates) {
      const matches =
        candidate.href === '/admin'
          ? pathname === '/admin'
          : pathname === candidate.href || pathname.startsWith(candidate.href + '/')
      if (matches && candidate.href.length > bestLength) {
        best = item
        bestLength = candidate.href.length
      }
    }
  }

  return best ?? navigation[0] ?? null
}

export function AppSidebar({ user, navigation, ...props }: AppSidebarProps) {
  const pathname = usePathname()
  const { setOpen } = useSidebar()
  const [search, setSearch] = React.useState('')

  const activeItem = React.useMemo(
    () => findActiveItem(navigation, pathname),
    [navigation, pathname]
  )

  const childItems = React.useMemo(() => {
    const items = activeItem?.children ?? []
    if (!search.trim()) return items
    const needle = search.trim().toLowerCase()
    return items.filter((child) => child.label.toLowerCase().includes(needle))
  }, [activeItem, search])

  const isChildActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin'
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <Sidebar
      collapsible="icon"
      className="overflow-hidden [&>[data-sidebar=sidebar]]:flex-row"
      {...props}
    >
      {/* Icon rail — top-level admin sections */}
      <Sidebar
        collapsible="none"
        className="!w-[calc(var(--sidebar-width-icon)_+_1px)] border-r"
      >
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild className="md:h-8 md:p-0">
                <Link href="/admin">
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                    <ChefHat className="size-4" />
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">Jose Madrid</span>
                    <span className="truncate text-xs">Admin Panel</span>
                  </div>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent className="px-1.5 md:px-0">
              <SidebarMenu>
                {navigation.map((item) => {
                  const Icon = item.icon ? iconMap[item.icon] : null
                  const hasChildren = (item.children?.length ?? 0) > 0
                  const isActive = activeItem?.href === item.href

                  // Items with children: open the contextual panel.
                  // Leaf items: navigate directly.
                  if (hasChildren) {
                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                          tooltip={{ children: item.label, hidden: false }}
                          onClick={() => setOpen(true)}
                          isActive={isActive}
                          className="px-2.5 md:px-2"
                        >
                          {Icon && <Icon />}
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  }

                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        tooltip={{ children: item.label, hidden: false }}
                        isActive={isActive}
                        className="px-2.5 md:px-2"
                      >
                        <Link href={item.href} onClick={() => setOpen(false)}>
                          {Icon && <Icon />}
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <NavUser user={user} />
        </SidebarFooter>
      </Sidebar>

      {/* Contextual panel — sub-navigation for the active section */}
      <Sidebar collapsible="none" className="hidden flex-1 md:flex">
        <SidebarHeader className="gap-3.5 border-b p-4">
          <div className="flex w-full items-center justify-between">
            <div className="text-base font-medium text-foreground">
              {activeItem?.label ?? 'Admin'}
            </div>
          </div>
          {(activeItem?.children?.length ?? 0) > 0 && (
            <SidebarInput
              placeholder={`Search ${activeItem?.label ?? ''}...`}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          )}
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup className="px-0">
            <SidebarGroupContent>
              {childItems.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">
                  {activeItem?.children?.length
                    ? 'No matching items.'
                    : 'No sub-sections for this area.'}
                </div>
              ) : (
                childItems.map((child) => {
                  const active = isChildActive(child.href)
                  return (
                    <Link
                      key={child.href}
                      href={child.href}
                      data-active={active}
                      className="flex flex-col items-start gap-1 whitespace-nowrap border-b p-4 text-sm leading-tight last:border-b-0 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground"
                    >
                      <span className="font-medium">{child.label}</span>
                      <span className="line-clamp-1 w-full text-xs text-muted-foreground">
                        {child.href}
                      </span>
                    </Link>
                  )
                })
              )}
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
    </Sidebar>
  )
}
