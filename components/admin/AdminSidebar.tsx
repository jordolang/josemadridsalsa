'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
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
  ChevronDown,
  ChevronRight,
  Gift,
  TrendingUp,
} from 'lucide-react'
import { useState } from 'react'
import type { NavItem } from '@/lib/permissions-map'

const iconMap = {
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
}

interface AdminSidebarProps {
  navigation: NavItem[]
  className?: string
  onClose?: () => void
}

export function AdminSidebar({ navigation, className = '', onClose }: AdminSidebarProps) {
  const pathname = usePathname()
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const toggleExpanded = (label: string) => {
    setExpanded((prev) => ({ ...prev, [label]: !prev[label] }))
  }

  const isActive = (href: string) => {
    if (href === '/admin') {
      return pathname === '/admin'
    }
    return pathname.startsWith(href)
  }

  const handleLinkClick = () => {
    if (onClose) {
      onClose()
    }
  }

  return (
    <aside className={`w-64 bg-slate-900 text-white dark:bg-slate-950 ${className}`}>
      <div className="flex h-16 items-center justify-between px-6">
        <Link href="/admin" className="text-xl font-bold" onClick={handleLinkClick}>
          Jose Madrid Admin
        </Link>
        {onClose && (
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white lg:hidden"
            aria-label="Close menu"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <nav className="space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const Icon = item.icon ? iconMap[item.icon as keyof typeof iconMap] : null
          const hasChildren = item.children && item.children.length > 0
          const isExpanded = expanded[item.label]
          const active = isActive(item.href)

          return (
            <div key={item.href}>
              {hasChildren ? (
                <>
                  <button
                    onClick={() => toggleExpanded(item.label)}
                  className={`flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      active
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-200 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    {Icon && <Icon className="mr-3 h-5 w-5" />}
                    <span className="flex-1 text-left">{item.label}</span>
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </button>

                  {isExpanded && item.children && (
                    <div className="ml-8 mt-1 space-y-1">
                      {item.children.map((child) => (
                        <Link
                          key={child.href}
                          href={child.href}
                          onClick={handleLinkClick}
                          className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                            isActive(child.href)
                              ? 'bg-slate-800 text-white'
                              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                          }`}
                        >
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <Link
                  href={item.href}
                  onClick={handleLinkClick}
                  className={`flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-200 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  {Icon && <Icon className="mr-3 h-5 w-5" />}
                  {item.label}
                </Link>
              )}
            </div>
          )
        })}
      </nav>
    </aside>
  )
}
