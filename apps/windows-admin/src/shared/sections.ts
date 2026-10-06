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
 *
 * Each path opens the shell at that section rather than the web admin page
 * behind it, so a menu choice stays in the window the operator is already in.
 * Developer Console opens the Developer page inside the Database section, and
 * Battle Arena Codes the game-codes page inside the Fundraisers section.
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
      { label: 'Orders', path: '/admin-desktop?section=orders', accelerator: 'CmdOrCtrl+2' },
      { label: 'Products', path: '/admin-desktop?section=products', accelerator: 'CmdOrCtrl+3' },
      { label: 'Inventory', path: '/admin-desktop?section=inventory', accelerator: 'CmdOrCtrl+4' },
      { label: 'Customers', path: '/admin-desktop?section=customers', accelerator: 'CmdOrCtrl+5' },
      { label: 'Purchase Orders', path: '/admin-desktop?section=purchase' },
      { label: 'Invoices', path: '/admin-desktop?section=invoices' },
    ],
  },
  {
    label: 'Programs',
    sections: [
      { label: 'Fundraisers', path: '/admin-desktop?section=fundraisers', accelerator: 'CmdOrCtrl+7' },
      { label: 'Battle Arena Codes', path: '/admin-desktop?section=fundraisers&page=fundraisers.codes' },
      { label: 'Events & Shows', path: '/admin-desktop?section=events', accelerator: 'CmdOrCtrl+8' },
      { label: 'Wholesale', path: '/admin-desktop?section=wholesale' },
    ],
  },
  {
    label: 'Money',
    sections: [{ label: 'Financials', path: '/admin-desktop?section=ledger', accelerator: 'CmdOrCtrl+6' }],
  },
  {
    label: 'Marketing',
    sections: [
      { label: 'Email Marketing', path: '/admin-desktop?section=email', accelerator: 'CmdOrCtrl+9' },
      { label: 'Social', path: '/admin-desktop?section=social' },
      { label: 'Content & Blog', path: '/admin-desktop?section=content' },
      { label: 'Lead Generation', path: '/admin-desktop?section=leads' },
      { label: 'Reviews', path: '/admin-desktop?section=reviews' },
    ],
  },
  {
    label: 'System',
    sections: [
      { label: 'Analytics', path: '/admin-desktop?section=analytics' },
      { label: 'Media & Documents', path: '/admin-desktop?section=media' },
      { label: 'Messages', path: '/admin-desktop?section=messages' },
      { label: 'Users & Roles', path: '/admin-desktop?section=users' },
      { label: 'Audit Logs', path: '/admin-desktop?section=audit' },
      { label: 'Settings', path: '/admin-desktop?section=settings' },
      { label: 'Developer Console', path: '/admin-desktop?section=database&page=database.developer' },
      { label: 'Database Console', path: '/admin-desktop?section=database' },
    ],
  },
]

export const ADMIN_SECTIONS: AdminSection[] = ADMIN_SECTION_GROUPS.flatMap((group) => group.sections)
