'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { SITE_DOMAIN } from '@/lib/site-url'

const navItems = [
  { href: '/fundraiser-portal/dashboard', label: 'Dashboard', icon: 'chart' },
  { href: '/fundraiser-portal/page-editor', label: 'Page Editor', icon: 'layout' },
  { href: '/fundraiser-portal/assets', label: 'Media & Uploads', icon: 'image' },
  { href: '/fundraiser-portal/character', label: 'Team Character', icon: 'image' },
  { href: '/fundraiser-portal/settings', label: 'Settings', icon: 'settings' },
  { href: '/fundraiser-portal/advanced-profile', label: 'Advanced Profile', icon: 'layout' },
  { href: '/fundraiser-portal/team', label: 'Team Access', icon: 'settings' },
  { href: '/fundraiser-portal/analytics', label: 'Analytics & SEO', icon: 'chart' },
] as const

type IconName = 'chart' | 'layout' | 'image' | 'settings'

function NavIcon({ name }: { name: IconName }) {
  switch (name) {
    case 'chart':
      return (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      )
    case 'layout':
      return (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
        </svg>
      )
    case 'image':
      return (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      )
    case 'settings':
      return (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      )
  }
}

type PortalNavProps = {
  fundraiserName: string
  subdomain: string | null
}

export function PortalNav({ fundraiserName, subdomain }: PortalNavProps) {
  const pathname = usePathname()

  return (
    <aside className="w-64 flex-shrink-0 border-r border-gray-200 bg-white">
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="border-b border-gray-200 p-4">
          <h2 className="truncate font-serif text-lg font-bold text-gray-900">
            {fundraiserName}
          </h2>
          {subdomain && (
            <p className="mt-1 truncate text-xs text-gray-500">
              {SITE_DOMAIN}/f/{subdomain}
            </p>
          )}
        </div>

        {/* Nav links */}
        <nav className="flex-1 space-y-1 p-3">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-salsa-50 text-salsa-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                )}
              >
                <NavIcon name={item.icon} />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Preview link */}
        {subdomain && (
          <div className="border-t border-gray-200 p-4">
            <Link
              href={`/f/${subdomain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              View Live Page
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </Link>
          </div>
        )}
      </div>
    </aside>
  )
}
