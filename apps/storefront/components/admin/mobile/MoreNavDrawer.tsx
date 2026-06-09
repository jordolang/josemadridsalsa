'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { signOut } from 'next-auth/react'
import { ChevronRight, LogOut, X } from 'lucide-react'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from '@/components/ui/drawer'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { cn } from '@/lib/utils'
import type { NavItem } from '@/lib/permissions-map'

function getInitials(name: string | null, email: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/)
    const first = parts[0]?.[0] ?? ''
    const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : ''
    return (first + last).toUpperCase() || email[0]!.toUpperCase()
  }
  return email[0]!.toUpperCase()
}

interface MoreNavDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: NavItem[]
  user: { name: string | null; email: string; role: string }
}

export function MoreNavDrawer({
  open,
  onOpenChange,
  items,
  user,
}: MoreNavDrawerProps) {
  const pathname = usePathname()
  const lastPath = useRef(pathname)

  useEffect(() => {
    if (pathname !== lastPath.current) {
      lastPath.current = pathname
      if (open) onOpenChange(false)
    }
  }, [pathname, open, onOpenChange])

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[92vh]">
        <DrawerHeader className="flex items-center justify-between text-left">
          <DrawerTitle>All sections</DrawerTitle>
          <DrawerClose asChild>
            <Button size="icon" variant="ghost" aria-label="Close menu">
              <X className="size-5" aria-hidden />
            </Button>
          </DrawerClose>
        </DrawerHeader>
        <nav
          aria-label="Secondary"
          className="min-h-0 flex-1 overflow-y-auto px-2 pb-4"
        >
          <ul className="space-y-1">
            {items.map((item) => (
              <MoreNavRow key={item.href} item={item} pathname={pathname} />
            ))}
          </ul>
        </nav>
        <div className="border-t p-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
          <div className="flex items-center gap-3">
            <Avatar className="size-9">
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                {getInitials(user.name, user.email)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {user.name ?? user.email}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {user.role}
              </p>
            </div>
            <ThemeToggle />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Sign out"
              onClick={() => signOut({ callbackUrl: '/' })}
            >
              <LogOut className="size-4" aria-hidden />
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  )
}

function MoreNavRow({
  item,
  pathname,
}: {
  item: NavItem
  pathname: string
}) {
  const active =
    pathname === item.href || pathname.startsWith(item.href + '/')
  return (
    <li>
      <Link
        href={item.href}
        className={cn(
          'flex min-h-11 items-center justify-between rounded-md px-3 py-2.5',
          active
            ? 'bg-accent text-accent-foreground'
            : 'text-foreground hover:bg-accent/50',
        )}
      >
        <span className="text-sm font-medium">{item.label}</span>
        <ChevronRight
          className="size-4 text-muted-foreground"
          aria-hidden
        />
      </Link>
      {item.children && item.children.length > 0 && (
        <ul className="ml-3 mt-1 space-y-0.5 border-l pl-2">
          {item.children.map((child) => {
            const childActive = pathname === child.href
            return (
              <li key={child.href}>
                <Link
                  href={child.href}
                  className={cn(
                    'flex min-h-10 items-center rounded-md px-3 py-2 text-sm',
                    childActive
                      ? 'text-primary'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {child.label}
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </li>
  )
}
