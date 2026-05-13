import {
  adminNavigation,
  filterNavByPermissions,
  type NavItem,
} from '@/lib/permissions-map'

const PRIMARY_HREFS = [
  '/admin',
  '/admin/orders',
  '/admin/products',
  '/admin/messages',
] as const

export interface MobileNav {
  primary: NavItem[]
  more: NavItem[]
}

function findByHref(items: NavItem[], href: string): NavItem | undefined {
  for (const item of items) {
    if (item.href === href) return item
    if (item.children) {
      const hit = findByHref(item.children, href)
      if (hit) return hit
    }
  }
  return undefined
}

export function splitNavForMobile(
  nav: NavItem[],
  userPermissions: readonly string[],
): MobileNav {
  const filtered = filterNavByPermissions(nav, [...userPermissions])

  const primary: NavItem[] = []
  for (const href of PRIMARY_HREFS) {
    const item = findByHref(filtered, href)
    if (item) primary.push(item)
  }

  const primarySet = new Set(primary.map((i) => i.href))
  const more = filtered.filter((item) => !primarySet.has(item.href))

  return { primary, more }
}

export function getMobileNav(userPermissions: readonly string[]): MobileNav {
  return splitNavForMobile(adminNavigation, userPermissions)
}
