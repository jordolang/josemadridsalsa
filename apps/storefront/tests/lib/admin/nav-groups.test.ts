import { describe, it, expect } from 'vitest'
import {
  findActiveNav,
  groupAdminNav,
  isAdminHrefActive,
} from '@/lib/admin/nav-groups'
import { adminNavigation, type NavItem } from '@/lib/permissions-map'

describe('groupAdminNav', () => {
  it('places every top-level admin entry in a named group, not "More"', () => {
    const groups = groupAdminNav(adminNavigation)
    expect(groups.map((g) => g.label)).not.toContain('More')
    const grouped = groups.flatMap((g) => g.items.map((i) => i.href))
    expect([...grouped].sort()).toEqual(adminNavigation.map((i) => i.href).sort())
  })

  it('orders groups like the desktop sidebar and drops empty ones', () => {
    const nav: NavItem[] = [
      { label: 'Settings', href: '/admin/settings' },
      { label: 'Dashboard', href: '/admin' },
      { label: 'Financials', href: '/admin/financials' },
    ]
    expect(groupAdminNav(nav).map((g) => g.label)).toEqual(['Operations', 'Money', 'System'])
  })

  it('collects unknown entries under "More" at the end', () => {
    const nav: NavItem[] = [
      { label: 'New thing', href: '/admin/new-thing' },
      { label: 'Orders', href: '/admin/orders' },
    ]
    const groups = groupAdminNav(nav)
    expect(groups.map((g) => g.label)).toEqual(['Operations', 'More'])
    expect(groups[1].items[0].href).toBe('/admin/new-thing')
  })
})

describe('isAdminHrefActive', () => {
  it('matches the dashboard only exactly', () => {
    expect(isAdminHrefActive('/admin', '/admin')).toBe(true)
    expect(isAdminHrefActive('/admin/orders', '/admin')).toBe(false)
  })

  it('matches nested paths but not shared prefixes', () => {
    expect(isAdminHrefActive('/admin/orders/123', '/admin/orders')).toBe(true)
    expect(isAdminHrefActive('/admin/orders-archive', '/admin/orders')).toBe(false)
  })
})

describe('findActiveNav', () => {
  it('prefers the most specific child entry', () => {
    const active = findActiveNav('/admin/email-marketing/logs', adminNavigation)
    expect(active?.group).toBe('Marketing')
    expect(active?.item.href).toBe('/admin/email-marketing/logs')
  })

  it('resolves a customer record page to the Customers section', () => {
    const active = findActiveNav('/admin/customers/cus_123', adminNavigation)
    expect(active?.group).toBe('Operations')
    expect(active?.item.href).toBe('/admin/customers')
  })

  it('returns null for a page outside the navigation', () => {
    expect(findActiveNav('/admin/unlisted', adminNavigation)).toBeNull()
  })
})
