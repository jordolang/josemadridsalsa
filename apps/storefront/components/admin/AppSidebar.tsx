'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Activity,
  BarChart3,
  Bell,
  Building2,
  Archive,
  CalendarDays,
  ChefHat,
  ChevronRight,
  Contact,
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
  Rss,
  Settings,
  Share2,
  ShoppingCart,
  Terminal,
  TrendingUp,
  Undo2,
  Users,
} from 'lucide-react'

import { NavUser } from '@/components/admin/NavUser'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from '@/components/ui/sidebar'
import type { NavItem } from '@/lib/permissions-map'

const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
  Bell,
  Archive,
  ShoppingCart,
  Package,
  Users,
  FileText,
  CalendarDays,
  Contact,
  Heart,
  BarChart3,
  Activity,
  MessageSquare,
  Share2,
  Rss,
  DollarSign,
  Building2,
  Settings,
  Gift,
  TrendingUp,
  Undo2,
  Lock,
  Mail,
  Terminal,
}

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  user: {
    name: string | null
    email: string
    role: string
  }
  navigation: NavItem[]
}

function isHrefActive(pathname: string, href: string): boolean {
  if (href === '/admin') return pathname === '/admin'
  return pathname === href || pathname.startsWith(href + '/')
}

function isSectionActive(pathname: string, item: NavItem): boolean {
  if (isHrefActive(pathname, item.href)) return true
  return (item.children ?? []).some((child) => isHrefActive(pathname, child.href))
}

export function AppSidebar({ user, navigation, ...props }: AppSidebarProps) {
  const pathname = usePathname()

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
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
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.map((item) => {
                const Icon = item.icon ? iconMap[item.icon] : null
                const hasChildren = (item.children?.length ?? 0) > 0
                const sectionActive = isSectionActive(pathname, item)

                if (!hasChildren) {
                  const active = isHrefActive(pathname, item.href)
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        tooltip={item.label}
                        isActive={active}
                      >
                        <Link href={item.href}>
                          {Icon && <Icon />}
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                }

                const parentActive = isHrefActive(pathname, item.href)

                return (
                  <Collapsible
                    key={item.href}
                    asChild
                    defaultOpen={sectionActive}
                    className="group/collapsible"
                  >
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        tooltip={item.label}
                        isActive={parentActive || sectionActive}
                      >
                        <Link href={item.href}>
                          {Icon && <Icon />}
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuAction
                          aria-label={`Toggle ${item.label} submenu`}
                          className="data-[state=open]:rotate-90"
                        >
                          <ChevronRight />
                        </SidebarMenuAction>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {item.children?.map((child) => {
                            const active = isHrefActive(pathname, child.href)
                            return (
                              <SidebarMenuSubItem key={child.href}>
                                <SidebarMenuSubButton asChild isActive={active}>
                                  <Link href={child.href}>
                                    <span>{child.label}</span>
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            )
                          })}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
