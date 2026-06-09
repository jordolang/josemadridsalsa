'use client'

import { useState } from 'react'
import { MobileTabBar } from '@/components/admin/mobile/MobileTabBar'
import { MoreNavDrawer } from '@/components/admin/mobile/MoreNavDrawer'
import { cn } from '@/lib/utils'
import type { NavItem } from '@/lib/permissions-map'

interface MobileAdminShellProps {
  user: { name: string | null; email: string; role: string }
  primary: NavItem[]
  more: NavItem[]
  className?: string
  children: React.ReactNode
}

export function MobileAdminShell({
  user,
  primary,
  more,
  className,
  children,
}: MobileAdminShellProps) {
  const [moreOpen, setMoreOpen] = useState(false)
  return (
    <div className={cn('flex h-svh flex-col bg-background', className)}>
      <a
        href="#admin-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-background focus:px-3 focus:py-2 focus:text-sm"
      >
        Skip to content
      </a>
      <main
        id="admin-main"
        className="min-h-0 flex-1 overflow-y-auto pt-[env(safe-area-inset-top)]"
      >
        {children}
      </main>
      <MobileTabBar items={primary} onMoreClick={() => setMoreOpen(true)} />
      <MoreNavDrawer
        open={moreOpen}
        onOpenChange={setMoreOpen}
        items={more}
        user={user}
      />
    </div>
  )
}
