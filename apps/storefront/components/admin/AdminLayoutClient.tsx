'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { PanelLeft } from 'lucide-react'

import { GlobalSearch } from '@/components/admin/GlobalSearch'
import { NotificationBell } from '@/components/admin/NotificationBell'
import { AppSidebar } from '@/components/admin/AppSidebar'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { TooltipProvider } from '@/components/ui/tooltip'
import { findActiveNav } from '@/lib/admin/nav-groups'
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

const COLLAPSED_KEY = 'jma-sidebar-collapsed'

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

function writeCollapsed(value: boolean) {
  try {
    window.localStorage.setItem(COLLAPSED_KEY, value ? '1' : '0')
  } catch {
    // Storage blocked (private window): the choice just lasts for this page.
  }
}

function titleFromPath(pathname: string): string {
  const last = pathname.split('/').filter(Boolean).pop() ?? 'admin'
  return last.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * The web admin frame, drawn after the desktop shell (`/admin-desktop`): a
 * dark-first warm palette, a dense grouped sidebar with a gold rule on the
 * current section, and a header that names the area in small caps over a
 * serif page title. The colours themselves live in `app/admin/admin-shell.css`
 * as theme tokens, so every page and dialog under `/admin` picks them up.
 */
export function AdminLayoutClient({
  user,
  navigation,
  className,
  children,
}: AdminLayoutClientProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    setCollapsed(readCollapsed())
  }, [])

  const toggle = useCallback(() => {
    setCollapsed((value) => {
      writeCollapsed(!value)
      return !value
    })
  }, [])

  // ⌘B / Ctrl+B, the same shortcut the previous sidebar answered to.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'b' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        toggle()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [toggle])

  const active = findActiveNav(pathname, navigation)
  const heading = active?.item.label ?? titleFromPath(pathname)
  // A record page below a listed section links its title back to the list.
  const deeper = active && pathname !== active.item.href ? active.item.href : null

  return (
    <TooltipProvider delayDuration={200}>
      <div className={cn('jma-shell', className)} data-collapsed={collapsed}>
        <AppSidebar user={user} navigation={navigation} collapsed={collapsed} />
        <div className="jma-main">
          <header className="jma-header">
            <button
              type="button"
              className="jma-icon-button"
              onClick={toggle}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-pressed={collapsed}
              title="Toggle sidebar (⌘B)"
            >
              <PanelLeft className="size-4" />
            </button>
            <div className="jma-title">
              <div className="jma-eyebrow">{active?.group ?? 'Admin'}</div>
              <div className="jma-heading">
                {deeper ? <Link href={deeper}>{heading}</Link> : heading}
              </div>
            </div>
            {deeper && (
              <span className="jma-path" title={pathname}>
                {pathname.slice(deeper.length)}
              </span>
            )}
            <div className="jma-header-tools">
              <div className="hidden lg:block">
                <GlobalSearch />
              </div>
              <NotificationBell />
              <ThemeToggle className="size-8 rounded-md px-0" />
            </div>
          </header>
          <main className="jma-content">{children}</main>
        </div>
      </div>
    </TooltipProvider>
  )
}
