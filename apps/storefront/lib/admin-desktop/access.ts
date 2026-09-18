/**
 * Which desktop sections a role may actually load.
 *
 * The section registry is navigation and says so; this is the permission layer
 * that sits beside it. Every entry mirrors the check the matching `/admin` page
 * already makes, so the desktop window refuses exactly what the web panel
 * refuses. Without this the shell would be a way around those checks: the API
 * route behind it is one staff gate, and a STAFF account that the web panel
 * redirects away from `/admin/invoices` could still read invoice customers and
 * balances through `/api/admin/desktop/invoices`.
 *
 * `null` means the section is staff-only, matching a page that has no
 * permission check of its own beyond the admin layout's.
 */

import {
  DESKTOP_SECTIONS,
  findPage,
  pagesFor,
  type DesktopPage,
  type DesktopSection,
  type DesktopSectionId,
} from './sections'

/**
 * Section id to the permission its `/admin` page requires.
 *
 * Keyed by every id in the union, so adding a section without deciding its
 * permission is a type error rather than an accidentally open door.
 */
export const SECTION_PERMISSION: Record<DesktopSectionId, string | null> = {
  // The page gates each widget separately and is otherwise staff-only.
  dashboard: null,
  orders: 'orders:read',
  products: 'products:read',
  inventory: 'products:read',
  customers: 'users:read',
  purchase: 'inventory:read',
  invoices: 'financials:read',
  fundraisers: 'orders:read',
  // No check of its own on /admin/events.
  events: null,
  wholesale: 'users:read',
  ledger: 'financials:read',
  email: 'content:read',
  social: 'social_media:compose',
  content: 'content:read',
  // No check of its own on /admin/lead-generation.
  leads: null,
  reviews: 'content:write',
  analytics: 'analytics:read',
  media: 'content:write',
  messages: 'messaging:read',
  users: 'users:read',
  audit: 'users:read',
  settings: 'settings:read',
  database: 'developer:database',
}

export function canSeeSection(id: DesktopSectionId, permissions: Iterable<string>): boolean {
  const required = SECTION_PERMISSION[id]
  if (!required) return true
  const held = permissions instanceof Set ? permissions : new Set(permissions)
  return held.has(required)
}

/** The sections this permission set may load, in sidebar order. */
export function allowedSections(permissions: Iterable<string>): DesktopSection[] {
  const held = new Set(permissions)
  return DESKTOP_SECTIONS.filter((section) => canSeeSection(section.id, held))
}

export function allowedSectionIds(permissions: Iterable<string>): DesktopSectionId[] {
  return allowedSections(permissions).map((section) => section.id)
}

/**
 * Where to open the window for someone who cannot see the section they asked
 * for — the first section they can see, rather than an error page. Returns
 * `undefined` only if they can see nothing at all, which the caller treats as a
 * refusal.
 */
export function fallbackSection(permissions: Iterable<string>): DesktopSectionId | undefined {
  return allowedSectionIds(permissions)[0]
}

/**
 * Whether an account may load one page inside a section.
 *
 * Two gates, in the order the web panel applies them: the section's permission,
 * then the page's own where it needs more than its section does. A page whose
 * `/admin` equivalent checks something extra — the credential vault, the
 * integrations sheet — is refused here on the same permission, so the page
 * strip never offers a tab that would answer 403.
 */
export function canSeePage(pageId: string, permissions: Iterable<string>): boolean {
  const entry = findPage(pageId)
  if (!entry) return false

  const held = permissions instanceof Set ? permissions : new Set(permissions)
  if (!canSeeSection(entry.section.id, held)) return false
  return !entry.page.permission || held.has(entry.page.permission)
}

/** The pages of a section this permission set may load, in strip order. */
export function allowedPages(section: DesktopSection, permissions: Iterable<string>): DesktopPage[] {
  const held = new Set(permissions)
  return pagesFor(section).filter((page) => !page.permission || held.has(page.permission))
}
