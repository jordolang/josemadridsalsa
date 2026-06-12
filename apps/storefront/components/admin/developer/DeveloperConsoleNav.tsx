'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const TABS = [
  { label: 'Console', href: '/admin/developer' },
  { label: 'File Explorer', href: '/admin/developer/files' },
  { label: 'Developer Blog', href: '/admin/developer/blog' },
  { label: 'Page Content', href: '/admin/developer/content' },
  { label: 'Salsadocs', href: '/admin/developer/salsadocs' },
] as const

function isActive(pathname: string, href: string): boolean {
  if (href === '/admin/developer') return pathname === '/admin/developer'
  return pathname === href || pathname.startsWith(href + '/')
}

export function DeveloperConsoleNav() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Developer console"
      className="mt-4 flex flex-wrap gap-1 border-t border-zinc-800 pt-3 font-mono text-sm"
    >
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={cn(
            'rounded-md px-3 py-1.5 transition-colors',
            isActive(pathname, tab.href)
              ? 'bg-emerald-500/15 text-emerald-300'
              : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100',
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  )
}
