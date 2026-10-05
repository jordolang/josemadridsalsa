'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Activity,
  BarChart3,
  Bell,
  Building2,
  Archive,
  CalendarDays,
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
  Table2,
  Terminal,
  TrendingUp,
  Undo2,
  Users,
} from 'lucide-react'

import { NavUser } from '@/components/admin/NavUser'
import {
  groupAdminNav,
  isAdminHrefActive,
  isAdminSectionActive,
} from '@/lib/admin/nav-groups'
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
  Table2,
}

interface AppSidebarProps {
  user: {
    name: string | null
    email: string
    role: string
  }
  navigation: NavItem[]
  collapsed: boolean
}

function NavEntry({
  item,
  pathname,
  collapsed,
}: {
  item: NavItem
  pathname: string
  collapsed: boolean
}) {
  const Icon = item.icon ? iconMap[item.icon] : null
  const children = item.children ?? []
  const sectionActive = isAdminSectionActive(pathname, item)
  // Follows the current page until the operator opens or closes it by hand.
  const [override, setOverride] = useState<boolean | null>(null)
  const expanded = !collapsed && children.length > 0 && (override ?? sectionActive)

  return (
    <li>
      <div className="jma-nav-row">
        <Link
          href={item.href}
          className="jma-nav-item"
          aria-current={sectionActive ? 'page' : undefined}
          title={collapsed ? item.label : undefined}
        >
          {Icon && <Icon className="jma-nav-icon" aria-hidden="true" />}
          <span className="jma-nav-label">{item.label}</span>
        </Link>
        {!collapsed && children.length > 0 && (
          <button
            type="button"
            className="jma-nav-toggle"
            aria-label={`${expanded ? 'Collapse' : 'Expand'} ${item.label}`}
            aria-expanded={expanded}
            onClick={() => setOverride(!expanded)}
          >
            <ChevronRight className="size-3.5" data-open={expanded} />
          </button>
        )}
      </div>
      {expanded && (
        <ul className="jma-nav-sub">
          {children.map((child) => (
            <li key={child.href}>
              <Link
                href={child.href}
                className="jma-nav-subitem"
                aria-current={isAdminHrefActive(pathname, child.href) ? 'page' : undefined}
              >
                {child.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

/**
 * The web admin's sidebar, drawn to match the desktop shell: a serif wordmark,
 * small-caps group headings and dense rows with a gold rule on the current
 * section. Collapsed, it narrows to an icon rail.
 */
export function AppSidebar({ user, navigation, collapsed }: AppSidebarProps) {
  const pathname = usePathname()
  const groups = groupAdminNav(navigation)

  return (
    <nav className="jma-sidebar" aria-label="Admin" data-collapsed={collapsed}>
      <Link href="/admin" className="jma-brand">
        <span className="jma-brand-name">{collapsed ? 'JM' : 'Jose Madrid'}</span>
        {!collapsed && <span className="jma-brand-tag">SALSA · ADMIN</span>}
      </Link>

      <div className="jma-nav">
        {groups.map((group) => (
          <section key={group.label} className="jma-nav-group">
            <h2 className="jma-nav-group-label">{group.label}</h2>
            <ul>
              {group.items.map((item) => (
                <NavEntry
                  key={item.href}
                  item={item}
                  pathname={pathname}
                  collapsed={collapsed}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>

      <NavUser user={user} collapsed={collapsed} />
    </nav>
  )
}
