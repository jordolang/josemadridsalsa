/**
 * The admin areas that get a menu entry and a keyboard shortcut.
 *
 * This is navigation, not permission: the pages themselves enforce roles, so a
 * STAFF account clicking "Financials" lands on the same redirect it would get in
 * a browser.
 *
 * The grouping and the shortcuts match the desktop shell's own sidebar
 * (`apps/storefront/lib/admin-desktop/sections.ts`) and the macOS app's
 * `AdminSections.swift`, so ⌘/Ctrl+4 means Inventory in the window, in the menu
 * bar, and on both platforms.
 */
export interface AdminSection {
  label: string
  path: string
  /** Electron accelerator, e.g. "CmdOrCtrl+1". */
  accelerator?: string
}

export interface AdminSectionGroup {
  label: string
  sections: AdminSection[]
}

export const ADMIN_SECTION_GROUPS: AdminSectionGroup[] = [
  {
    label: 'Operations',
    sections: [
      { label: 'Dashboard', path: '/admin-desktop', accelerator: 'CmdOrCtrl+1' },
      { label: 'Orders', path: '/admin/orders', accelerator: 'CmdOrCtrl+2' },
      { label: 'Products', path: '/admin/products', accelerator: 'CmdOrCtrl+3' },
      { label: 'Inventory', path: '/admin/inventory', accelerator: 'CmdOrCtrl+4' },
      { label: 'Customers', path: '/admin/customers', accelerator: 'CmdOrCtrl+5' },
      { label: 'Purchase Orders', path: '/admin/purchase-orders' },
      { label: 'Invoices', path: '/admin/invoices' },
    ],
  },
  {
    label: 'Programs',
    sections: [
      { label: 'Fundraisers', path: '/admin/fundraisers', accelerator: 'CmdOrCtrl+7' },
      { label: 'Events & Shows', path: '/admin/events', accelerator: 'CmdOrCtrl+8' },
      { label: 'Wholesale', path: '/admin/wholesale' },
    ],
  },
  {
    label: 'Money',
    sections: [{ label: 'Financials', path: '/admin/financials/ledger', accelerator: 'CmdOrCtrl+6' }],
  },
  {
    label: 'Marketing',
    sections: [
      { label: 'Email Marketing', path: '/admin/email-marketing', accelerator: 'CmdOrCtrl+9' },
      { label: 'Social', path: '/admin/social' },
      { label: 'Content & Blog', path: '/admin/content' },
      { label: 'Lead Generation', path: '/admin/lead-generation' },
      { label: 'Reviews', path: '/admin/reviews' },
    ],
  },
  {
    label: 'System',
    sections: [
      { label: 'Analytics', path: '/admin/analytics' },
      { label: 'Media & Documents', path: '/admin/media' },
      { label: 'Messages', path: '/admin/messages' },
      { label: 'Users & Roles', path: '/admin/users' },
      { label: 'Audit Logs', path: '/admin/audit-logs' },
      { label: 'Settings', path: '/admin/settings' },
      { label: 'Developer Console', path: '/admin/developer' },
      { label: 'Database Console', path: '/admin/developer/database' },
    ],
  },
]

export const ADMIN_SECTIONS: AdminSection[] = ADMIN_SECTION_GROUPS.flatMap((group) => group.sections)
