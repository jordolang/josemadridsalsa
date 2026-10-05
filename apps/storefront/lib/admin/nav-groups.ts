import type { NavItem } from '@/lib/permissions-map'

/**
 * Sidebar groups for the web admin, matching the desktop shell's sidebar
 * (`lib/admin-desktop/sections.ts`) so an operator who moves between the
 * window and the browser finds each area under the same heading.
 *
 * Grouping is presentation only: the navigation passed in is already filtered
 * by permission, and empty groups are dropped.
 */
export const ADMIN_NAV_GROUPS = [
  'Operations',
  'Programs',
  'Money',
  'Marketing',
  'Insights',
  'System',
] as const

export type AdminNavGroupLabel = (typeof ADMIN_NAV_GROUPS)[number] | 'More'

const GROUP_BY_HREF: Record<string, AdminNavGroupLabel> = {
  '/admin': 'Operations',
  '/admin/orders': 'Operations',
  '/admin/notifications': 'Operations',
  '/admin/returns': 'Operations',
  '/admin/gift-certificates': 'Operations',
  '/admin/products': 'Operations',
  '/admin/customers': 'Operations',
  '/admin/archive': 'Operations',
  '/admin/events': 'Programs',
  '/admin/fundraisers': 'Programs',
  '/admin/wholesale': 'Programs',
  '/admin/financials': 'Money',
  '/admin/email-marketing': 'Marketing',
  '/admin/communications': 'Marketing',
  '/admin/forms': 'Marketing',
  '/admin/social': 'Marketing',
  '/admin/feeds': 'Marketing',
  '/admin/content': 'Marketing',
  '/admin/data': 'Insights',
  '/admin/analytics': 'Insights',
  '/admin/growth': 'Insights',
  '/admin/users': 'System',
  '/admin/settings': 'System',
  '/admin/credentials': 'System',
  '/admin/developer': 'System',
}

export interface AdminNavGroup {
  label: AdminNavGroupLabel
  items: NavItem[]
}

/** Bucket top-level nav items into labelled groups, keeping their order. */
export function groupAdminNav(navigation: NavItem[]): AdminNavGroup[] {
  const buckets = new Map<AdminNavGroupLabel, NavItem[]>()
  for (const item of navigation) {
    const label = GROUP_BY_HREF[item.href] ?? 'More'
    const bucket = buckets.get(label) ?? []
    bucket.push(item)
    buckets.set(label, bucket)
  }

  return [...ADMIN_NAV_GROUPS, 'More' as const]
    .filter((label) => buckets.has(label))
    .map((label) => ({ label, items: buckets.get(label) ?? [] }))
}

export function isAdminHrefActive(pathname: string, href: string): boolean {
  if (href === '/admin') return pathname === '/admin'
  return pathname === href || pathname.startsWith(href + '/')
}

export function isAdminSectionActive(pathname: string, item: NavItem): boolean {
  if (isAdminHrefActive(pathname, item.href)) return true
  return (item.children ?? []).some((child) => isAdminHrefActive(pathname, child.href))
}

/**
 * The nav entry and group the current page belongs to, for the header's
 * eyebrow and title. Child matches win over their parent, and the longest
 * matching href wins so `/admin/email-marketing/logs` resolves to "Email Logs"
 * rather than the marketing dashboard.
 */
export function findActiveNav(
  pathname: string,
  navigation: NavItem[],
): { group: AdminNavGroupLabel; item: NavItem } | null {
  let best: { group: AdminNavGroupLabel; item: NavItem } | null = null
  for (const group of groupAdminNav(navigation)) {
    for (const parent of group.items) {
      for (const candidate of [parent, ...(parent.children ?? [])]) {
        if (!isAdminHrefActive(pathname, candidate.href)) continue
        if (!best || candidate.href.length > best.item.href.length) {
          best = { group: group.label, item: candidate }
        }
      }
    }
  }
  return best
}
