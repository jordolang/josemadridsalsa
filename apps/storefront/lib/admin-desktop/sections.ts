/**
 * The section registry for the desktop admin shell.
 *
 * This is the single source for the sidebar, the ⌘-number shortcuts and the
 * command palette. It is navigation, not permission: every section resolves to
 * a real `/admin` path, and the data behind it is loaded through the same RBAC
 * checks the web panel uses, so a STAFF account sees the same refusals here.
 *
 * `kind` records whether the section renders its own data in the desktop shell
 * or hands off to the web admin page. A `link` section still keeps its slot,
 * shortcut and palette entry — the shell shows its views and opens the real
 * page rather than an empty table.
 */

export type DesktopSectionId =
  | 'dashboard'
  | 'orders'
  | 'products'
  | 'inventory'
  | 'customers'
  | 'purchase'
  | 'invoices'
  | 'fundraisers'
  | 'events'
  | 'wholesale'
  | 'ledger'
  | 'email'
  | 'social'
  | 'content'
  | 'leads'
  | 'reviews'
  | 'analytics'
  | 'media'
  | 'messages'
  | 'users'
  | 'audit'
  | 'settings'
  | 'database'

/** How the content pane renders a section. */
export type DesktopViewKind =
  | 'dashboard'
  | 'table'
  | 'events'
  | 'analytics'
  | 'settings'
  | 'link'

export interface DesktopSection {
  id: DesktopSectionId
  label: string
  /** Symbol id in the shell's inline sprite sheet, e.g. `i-gauge`. */
  icon: string
  /** The `/admin` page this section corresponds to. */
  path: string
  kind: DesktopViewKind
  /** Single digit used with ⌘/Ctrl, when the section has a shortcut. */
  digit?: string
  /** Sub-pages, shown for `link` sections and used to explain a section's scope. */
  views?: { label: string; path: string }[]
}

export interface DesktopSectionGroup {
  label: string
  items: DesktopSection[]
}

export const DESKTOP_SECTION_GROUPS: DesktopSectionGroup[] = [
  {
    label: 'OPERATIONS',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: 'i-gauge', path: '/admin', kind: 'dashboard', digit: '1' },
      { id: 'orders', label: 'Orders', icon: 'i-receipt', path: '/admin/orders', kind: 'table', digit: '2' },
      { id: 'products', label: 'Products', icon: 'i-package', path: '/admin/products', kind: 'table', digit: '3' },
      { id: 'inventory', label: 'Inventory', icon: 'i-boxes', path: '/admin/inventory', kind: 'table', digit: '4' },
      { id: 'customers', label: 'Customers', icon: 'i-users', path: '/admin/customers', kind: 'table', digit: '5' },
      {
        id: 'purchase',
        label: 'Purchase Orders',
        icon: 'i-truck',
        path: '/admin/purchase-orders',
        kind: 'link',
        views: [
          { label: 'Open POs', path: '/admin/purchase-orders' },
          { label: 'New PO', path: '/admin/purchase-orders/new' },
          { label: 'Receiving', path: '/admin/inventory' },
        ],
      },
      {
        id: 'invoices',
        label: 'Invoices',
        icon: 'i-file',
        path: '/admin/invoices',
        kind: 'link',
        views: [
          { label: 'All invoices', path: '/admin/invoices' },
          { label: 'Returns & RMAs', path: '/admin/returns' },
          { label: 'Shipping', path: '/admin/shipping' },
        ],
      },
    ],
  },
  {
    label: 'PROGRAMS',
    items: [
      { id: 'fundraisers', label: 'Fundraisers', icon: 'i-gift', path: '/admin/fundraisers', kind: 'table', digit: '7' },
      { id: 'events', label: 'Events & Shows', icon: 'i-calendar', path: '/admin/events', kind: 'events', digit: '8' },
      {
        id: 'wholesale',
        label: 'Wholesale',
        icon: 'i-truck',
        path: '/admin/wholesale',
        kind: 'link',
        views: [
          { label: 'Accounts', path: '/admin/wholesale' },
          { label: 'Locations', path: '/admin/locations' },
          { label: 'Merchandise', path: '/admin/merchandise' },
        ],
      },
    ],
  },
  {
    label: 'MONEY',
    items: [
      { id: 'ledger', label: 'Financials', icon: 'i-wallet', path: '/admin/financials/ledger', kind: 'table', digit: '6' },
    ],
  },
  {
    label: 'MARKETING',
    items: [
      {
        id: 'email',
        label: 'Email Marketing',
        icon: 'i-mail',
        path: '/admin/email-marketing',
        kind: 'link',
        digit: '9',
        views: [
          { label: 'Dashboard', path: '/admin/email-marketing' },
          { label: 'Campaigns', path: '/admin/email-campaigns' },
          { label: 'Automations', path: '/admin/email-marketing/automations' },
          { label: 'Lists & subscribers', path: '/admin/communications/lists' },
          { label: 'Suppressions', path: '/admin/communications/suppressions' },
          { label: 'Brand kit', path: '/admin/email-marketing/brand-kit' },
        ],
      },
      {
        id: 'social',
        label: 'Social',
        icon: 'i-share',
        path: '/admin/social',
        kind: 'link',
        views: [
          { label: 'Scheduled posts', path: '/admin/social' },
          { label: 'Social analytics', path: '/admin/analytics/social' },
          { label: 'Feeds', path: '/admin/feeds' },
        ],
      },
      {
        id: 'content',
        label: 'Content & Blog',
        icon: 'i-file',
        path: '/admin/content',
        kind: 'link',
        views: [
          { label: 'Pages', path: '/admin/content/pages' },
          { label: 'Blog posts', path: '/admin/blog/posts' },
          { label: 'Banners', path: '/admin/content/banners' },
          { label: 'FAQs', path: '/admin/content/faqs' },
          { label: 'Redirects', path: '/admin/content/redirects' },
          { label: 'SEO', path: '/admin/seo' },
        ],
      },
      {
        id: 'leads',
        label: 'Lead Generation',
        icon: 'i-target',
        path: '/admin/lead-generation',
        kind: 'link',
        views: [{ label: 'Campaigns', path: '/admin/lead-generation' }],
      },
      {
        id: 'reviews',
        label: 'Reviews',
        icon: 'i-star',
        path: '/admin/reviews',
        kind: 'link',
        views: [
          { label: 'Reviews', path: '/admin/reviews' },
          { label: 'Forms', path: '/admin/forms' },
        ],
      },
    ],
  },
  {
    label: 'SYSTEM',
    items: [
      {
        id: 'analytics',
        label: 'Analytics',
        icon: 'i-chart',
        path: '/admin/analytics',
        kind: 'analytics',
        views: [
          { label: 'Overview', path: '/admin/analytics' },
          { label: 'Report builder', path: '/admin/data' },
        ],
      },
      {
        id: 'media',
        label: 'Media & Docs',
        icon: 'i-image',
        path: '/admin/media',
        kind: 'link',
        views: [
          { label: 'Media library', path: '/admin/media' },
          { label: 'Documents archive', path: '/admin/archive/documents' },
          { label: 'Mileage log', path: '/admin/archive/mileage' },
          { label: 'Show archive', path: '/admin/archive/shows' },
        ],
      },
      {
        id: 'messages',
        label: 'Messages',
        icon: 'i-message',
        path: '/admin/messages',
        kind: 'link',
        views: [
          { label: 'Inbox', path: '/admin/messages' },
          { label: 'Notifications', path: '/admin/notifications' },
        ],
      },
      {
        id: 'users',
        label: 'Users & Roles',
        icon: 'i-shield',
        path: '/admin/users',
        kind: 'link',
        views: [
          { label: 'Staff accounts', path: '/admin/users' },
          { label: 'Credentials', path: '/admin/credentials' },
        ],
      },
      { id: 'audit', label: 'Audit Logs', icon: 'i-history', path: '/admin/audit-logs', kind: 'table' },
      { id: 'settings', label: 'Settings', icon: 'i-settings', path: '/admin/settings', kind: 'settings' },
      {
        id: 'database',
        label: 'Database Console',
        icon: 'i-database',
        path: '/admin/developer/database',
        kind: 'table',
      },
    ],
  },
]

export const DESKTOP_SECTIONS: DesktopSection[] = DESKTOP_SECTION_GROUPS.flatMap((group) => group.items)

const BY_ID = new Map(DESKTOP_SECTIONS.map((section) => [section.id, section]))

export function findSection(id: string): DesktopSection | undefined {
  return BY_ID.get(id as DesktopSectionId)
}

export function isDesktopSectionId(value: string): value is DesktopSectionId {
  return BY_ID.has(value as DesktopSectionId)
}
