'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ShoppingCart, ClipboardList, Settings, LogOut } from 'lucide-react'

const NAV_ITEMS = [
  { href: '/pos', label: 'Register', icon: ShoppingCart, exact: true },
  { href: '/pos/orders', label: 'Orders', icon: ClipboardList, exact: false },
  { href: '/pos/settings', label: 'Settings', icon: Settings, exact: false },
] as const

export function POSNav() {
  const pathname = usePathname()

  function isActive(href: string, exact: boolean): boolean {
    if (exact) return pathname === href
    return pathname.startsWith(href)
  }

  return (
    <header className="flex items-center justify-between border-b bg-white px-4 py-2 shadow-sm">
      <div className="flex items-center gap-6">
        <Link href="/pos" className="text-lg font-bold text-slate-900">
          JMS POS
        </Link>
        <nav className="flex items-center gap-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
            const active = isActive(href, exact)
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-salsa-50 text-salsa-700'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            )
          })}
        </nav>
      </div>
      <Link
        href="/admin"
        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
      >
        <LogOut className="h-4 w-4" />
        Exit POS
      </Link>
    </header>
  )
}
