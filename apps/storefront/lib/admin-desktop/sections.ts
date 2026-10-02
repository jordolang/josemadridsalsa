/**
 * The section and page registry for the desktop admin shell.
 *
 * This is the single source for the sidebar, the ⌘-number shortcuts, the page
 * strip under each section heading and the command palette. It is navigation,
 * not permission: every entry resolves to a real `/admin` path, and the data
 * behind it is loaded through the same RBAC checks the web panel uses, so a
 * STAFF account sees the same refusals here.
 *
 * A section is a place in the sidebar; a **page** is one table, board or
 * settings sheet inside it. The first page of a section is the section's own
 * list — its id is the section id — and every page after it is one the window
 * used to hand off to the web panel and now draws itself.
 *
 * `kind` records how the content pane draws a page. `link` remains a supported
 * kind so that a page added to this registry before its loader exists degrades
 * to a hand-off card rather than an empty table.
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

/** How the content pane renders a page. */
export type DesktopViewKind =
  | 'dashboard'
  | 'table'
  | 'events'
  | 'analytics'
  | 'settings'
  | 'link'

/**
 * One page inside a section.
 *
 * Ids are unique across the whole registry and namespaced by their section
 * (`email.campaigns`), so a command, a URL and a palette entry can all name a
 * page with one string.
 */
export interface DesktopPage {
  id: string
  label: string
  /** The `/admin` page this mirrors, shown in the title bar. */
  path: string
  /** How the pane draws it. Defaults to the section's own kind. */
  kind?: DesktopViewKind
  /**
   * A permission this page needs on top of its section's, mirroring the check
   * the matching `/admin` page makes. Absent means the section's is enough.
   */
  permission?: string
}

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
  /**
   * The pages this section draws, in strip order. The first is where the
   * section opens and its id is always the section id. Omitted when the
   * section is a single page.
   */
  pages?: DesktopPage[]
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
      {
        id: 'orders',
        label: 'Orders',
        icon: 'i-receipt',
        path: '/admin/orders',
        kind: 'table',
        digit: '2',
        pages: [
          { id: 'orders', label: 'Orders', path: '/admin/orders' },
          { id: 'orders.returns', label: 'Returns & RMAs', path: '/admin/returns' },
          { id: 'orders.shipping', label: 'Shipping labels', path: '/admin/shipping' },
        ],
      },
      { id: 'products', label: 'Products', icon: 'i-package', path: '/admin/products', kind: 'table', digit: '3' },
      { id: 'inventory', label: 'Inventory', icon: 'i-boxes', path: '/admin/inventory', kind: 'table', digit: '4' },
      {
        id: 'customers',
        label: 'Customers',
        icon: 'i-users',
        path: '/admin/customers',
        kind: 'table',
        digit: '5',
        pages: [
          { id: 'customers', label: 'Customers', path: '/admin/customers' },
          {
            id: 'customers.rewards',
            label: 'Loyalty rewards',
            path: '/admin/settings/loyalty-rewards',
            permission: 'settings:read',
          },
        ],
      },
      {
        id: 'purchase',
        label: 'Purchase Orders',
        icon: 'i-truck',
        path: '/admin/purchase-orders',
        kind: 'table',
        pages: [
          { id: 'purchase', label: 'Purchase orders', path: '/admin/purchase-orders' },
          { id: 'purchase.suppliers', label: 'Suppliers', path: '/admin/purchase-orders/suppliers' },
        ],
      },
      { id: 'invoices', label: 'Invoices', icon: 'i-file', path: '/admin/invoices', kind: 'table' },
    ],
  },
  {
    label: 'PROGRAMS',
    items: [
      {
        id: 'fundraisers',
        label: 'Fundraisers',
        icon: 'i-gift',
        path: '/admin/fundraisers',
        kind: 'table',
        digit: '7',
        pages: [
          { id: 'fundraisers', label: 'Fundraisers', path: '/admin/fundraisers' },
          { id: 'fundraisers.arena', label: 'Battle arena', path: '/admin/fundraisers/battle-arena' },
        ],
      },
      {
        id: 'events',
        label: 'Events & Shows',
        icon: 'i-calendar',
        path: '/admin/events',
        kind: 'events',
        digit: '8',
        pages: [
          { id: 'events', label: 'Calendar', path: '/admin/events' },
          { id: 'events.manifests', label: 'Packing manifests', path: '/admin/events', kind: 'table' },
        ],
      },
      {
        id: 'wholesale',
        label: 'Wholesale',
        icon: 'i-truck',
        path: '/admin/wholesale',
        kind: 'table',
        pages: [
          { id: 'wholesale', label: 'Accounts', path: '/admin/wholesale' },
          {
            id: 'wholesale.locations',
            label: 'Store locator',
            path: '/admin/locations',
            permission: 'content:read',
          },
        ],
      },
    ],
  },
  {
    label: 'MONEY',
    items: [
      {
        id: 'ledger',
        label: 'Financials',
        icon: 'i-wallet',
        path: '/admin/financials/ledger',
        kind: 'table',
        digit: '6',
        pages: [
          { id: 'ledger', label: 'Ledger', path: '/admin/financials/ledger' },
          {
            id: 'ledger.reconciliation',
            label: 'Reconciliation',
            path: '/admin/financials/reconciliation',
          },
        ],
      },
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
        kind: 'table',
        digit: '9',
        pages: [
          { id: 'email', label: 'Campaigns', path: '/admin/email-marketing' },
          { id: 'email.templates', label: 'Templates', path: '/admin/email-templates' },
          { id: 'email.automations', label: 'Automations', path: '/admin/email-marketing/automations' },
          {
            id: 'email.lists',
            label: 'Lists & subscribers',
            path: '/admin/communications/lists',
            permission: 'content:write',
          },
          { id: 'email.suppressions', label: 'Suppressions', path: '/admin/communications/suppressions' },
          { id: 'email.logs', label: 'Send log', path: '/admin/email-marketing/logs' },
          {
            id: 'email.brand',
            label: 'Brand kit',
            path: '/admin/email-marketing/brand-kit',
            kind: 'settings',
            permission: 'settings:read',
          },
        ],
      },
      {
        id: 'social',
        label: 'Social',
        icon: 'i-share',
        path: '/admin/social',
        kind: 'table',
        pages: [
          { id: 'social', label: 'Posts', path: '/admin/social' },
          { id: 'social.accounts', label: 'Connected accounts', path: '/admin/social' },
          { id: 'social.feeds', label: 'Product feeds', path: '/admin/feeds' },
          { id: 'social.analytics', label: 'Reach', path: '/admin/analytics/social' },
        ],
      },
      {
        id: 'content',
        label: 'Content & Blog',
        icon: 'i-file',
        path: '/admin/content',
        kind: 'table',
        pages: [
          { id: 'content', label: 'Blog posts', path: '/admin/blog/posts' },
          { id: 'content.pages', label: 'Pages', path: '/admin/content/pages' },
          { id: 'content.banners', label: 'Banners', path: '/admin/content/banners' },
          { id: 'content.faqs', label: 'FAQs', path: '/admin/content/faqs' },
          { id: 'content.redirects', label: 'Redirects', path: '/admin/content/redirects' },
          { id: 'content.seo', label: 'SEO', path: '/admin/seo', kind: 'settings' },
        ],
      },
      {
        id: 'leads',
        label: 'Lead Generation',
        icon: 'i-target',
        path: '/admin/lead-generation',
        kind: 'table',
        pages: [
          { id: 'leads', label: 'Leads', path: '/admin/lead-generation' },
          { id: 'leads.campaigns', label: 'Campaigns', path: '/admin/lead-generation' },
        ],
      },
      {
        id: 'reviews',
        label: 'Reviews',
        icon: 'i-star',
        path: '/admin/reviews',
        kind: 'table',
        pages: [
          { id: 'reviews', label: 'Reviews', path: '/admin/reviews' },
          { id: 'reviews.forms', label: 'Forms', path: '/admin/forms', permission: 'content:read' },
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
        pages: [
          { id: 'analytics', label: 'Overview', path: '/admin/analytics' },
          { id: 'analytics.retention', label: 'Retention', path: '/admin/analytics/retention', kind: 'table' },
          { id: 'analytics.margin', label: 'Margin', path: '/admin/analytics/margin', kind: 'table' },
          {
            id: 'analytics.attribution',
            label: 'Attribution',
            path: '/admin/analytics/attribution',
            kind: 'table',
          },
        ],
      },
      {
        id: 'media',
        label: 'Media & Docs',
        icon: 'i-image',
        path: '/admin/media',
        kind: 'table',
        pages: [
          { id: 'media', label: 'Media library', path: '/admin/media' },
          {
            id: 'media.documents',
            label: 'Documents archive',
            path: '/admin/archive/documents',
            permission: 'analytics:read',
          },
          {
            id: 'media.mileage',
            label: 'Mileage log',
            path: '/admin/archive/mileage',
            permission: 'analytics:read',
          },
          {
            id: 'media.shows',
            label: 'Show archive',
            path: '/admin/archive/shows',
            permission: 'analytics:read',
          },
        ],
      },
      {
        id: 'messages',
        label: 'Messages',
        icon: 'i-message',
        path: '/admin/messages',
        kind: 'table',
        pages: [
          { id: 'messages', label: 'Inbox', path: '/admin/messages' },
          { id: 'messages.email', label: 'Customer email', path: '/admin/inbox' },
          { id: 'messages.live', label: 'Live chat', path: '/admin/messages/live' },
          { id: 'messages.notifications', label: 'Notifications', path: '/admin/notifications' },
        ],
      },
      {
        id: 'users',
        label: 'Users & Roles',
        icon: 'i-shield',
        path: '/admin/users',
        kind: 'table',
        pages: [
          { id: 'users', label: 'Staff accounts', path: '/admin/users' },
          {
            id: 'users.credentials',
            label: 'Credential vault',
            path: '/admin/credentials',
            permission: 'credentials:read',
          },
        ],
      },
      { id: 'audit', label: 'Audit Logs', icon: 'i-history', path: '/admin/audit-logs', kind: 'table' },
      {
        id: 'settings',
        label: 'Settings',
        icon: 'i-settings',
        path: '/admin/settings',
        kind: 'settings',
        pages: [
          { id: 'settings', label: 'Store', path: '/admin/settings' },
          { id: 'settings.payments', label: 'Payments', path: '/admin/settings/payments' },
          { id: 'settings.shipping', label: 'Shipping', path: '/admin/settings/shipping' },
          {
            id: 'settings.integrations',
            label: 'Integrations',
            path: '/admin/settings/integrations',
            kind: 'table',
            permission: 'api_keys:manage',
          },
        ],
      },
      {
        id: 'database',
        label: 'Database Console',
        icon: 'i-database',
        path: '/admin/developer/database',
        kind: 'table',
        pages: [
          { id: 'database', label: 'Tables', path: '/admin/developer/database' },
          // The Developer Console's overview. It lives here rather than as a
          // section of its own because both are the DEVELOPER account's tools,
          // and it asks for the permission /admin/developer checks.
          {
            id: 'database.developer',
            label: 'Developer',
            path: '/admin/developer',
            kind: 'settings',
            permission: 'developer:system',
          },
        ],
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

/**
 * Every page in a section, in strip order.
 *
 * A section with no `pages` is one page — itself — so callers never have to
 * special-case the single-page sections.
 */
export function pagesFor(section: DesktopSection): DesktopPage[] {
  return (
    section.pages ?? [{ id: section.id, label: section.label, path: section.path, kind: section.kind }]
  )
}

export const DESKTOP_PAGES: { section: DesktopSection; page: DesktopPage }[] = DESKTOP_SECTIONS.flatMap(
  (section) => pagesFor(section).map((page) => ({ section, page })),
)

const PAGE_BY_ID = new Map(DESKTOP_PAGES.map((entry) => [entry.page.id, entry]))

export function findPage(id: string): { section: DesktopSection; page: DesktopPage } | undefined {
  return PAGE_BY_ID.get(id)
}

export function isDesktopPageId(value: string): boolean {
  return PAGE_BY_ID.has(value)
}

/** The id of the page a section opens at. */
export function defaultPageId(section: DesktopSection): string {
  return pagesFor(section)[0].id
}

/** How the pane should draw a page — its own kind, or its section's. */
export function pageKind(section: DesktopSection, page: DesktopPage): DesktopViewKind {
  return page.kind ?? section.kind
}
