'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  MessageSquare,
  Menu,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { NavItem } from '@/lib/permissions-map'

interface TabConfig {
  label: string
  icon: LucideIcon
}

// Tabs the mobile bar can render — keyed by href. Anything not in this map is
// ignored, so adding a new primary tab requires an explicit entry here.
const TAB_CONFIG: Record<string, TabConfig> = {
  '/admin': { label: 'Home', icon: LayoutDashboard },
  '/admin/orders': { label: 'Orders', icon: ShoppingCart },
  '/admin/products': { label: 'Products', icon: Package },
  '/admin/messages': { label: 'Contact', icon: MessageSquare },
}

interface MobileTabBarProps {
  items: NavItem[]
  onMoreClick: () => void
  className?: string
}

function isActive(pathname: string, href: string): boolean {
  if (href === '/admin') return pathname === '/admin'
  return pathname === href || pathname.startsWith(href + '/')
}

export function MobileTabBar({ items, onMoreClick, className }: MobileTabBarProps) {
  const pathname = usePathname()
  return (
    <nav
      aria-label="Primary"
      className={cn(
        'sticky bottom-0 z-40 grid grid-cols-5 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75',
        'pb-[max(env(safe-area-inset-bottom),0.25rem)]',
        className,
      )}
    >
      {items.map((item) => {
        const config = TAB_CONFIG[item.href]
        if (!config) return null
        const { label, icon: Icon } = config
        const active = isActive(pathname, item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            aria-label={label}
            className={cn(
              'flex min-h-11 flex-col items-center justify-center gap-0.5 px-1 py-2 text-xs',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              active
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="size-5" aria-hidden />
            <span>{label}</span>
          </Link>
        )
      })}
      <button
        type="button"
        onClick={onMoreClick}
        aria-label="More sections"
        className="flex min-h-11 flex-col items-center justify-center gap-0.5 px-1 py-2 text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Menu className="size-5" aria-hidden />
        <span>More</span>
      </button>
    </nav>
  )
}
