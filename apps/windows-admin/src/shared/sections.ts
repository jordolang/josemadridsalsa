/**
 * The admin areas that get a menu entry and a keyboard shortcut.
 *
 * This is navigation, not permission: the pages themselves enforce roles, so a
 * STAFF account clicking "Financials" lands on the same redirect it would get in
 * a browser.
 */
export interface AdminSection {
  label: string
  path: string
  /** Electron accelerator, e.g. "CmdOrCtrl+1". */
  accelerator?: string
}

export const ADMIN_SECTIONS: AdminSection[] = [
  { label: 'Dashboard', path: '/admin', accelerator: 'CmdOrCtrl+1' },
  { label: 'Orders', path: '/admin/orders', accelerator: 'CmdOrCtrl+2' },
  { label: 'Products', path: '/admin/products', accelerator: 'CmdOrCtrl+3' },
  { label: 'Inventory', path: '/admin/inventory', accelerator: 'CmdOrCtrl+4' },
  { label: 'Customers', path: '/admin/customers', accelerator: 'CmdOrCtrl+5' },
  { label: 'Financials', path: '/admin/financials', accelerator: 'CmdOrCtrl+6' },
  { label: 'Fundraisers', path: '/admin/fundraisers', accelerator: 'CmdOrCtrl+7' },
  { label: 'Events & Shows', path: '/admin/events', accelerator: 'CmdOrCtrl+8' },
  { label: 'Email Marketing', path: '/admin/email-marketing', accelerator: 'CmdOrCtrl+9' },
  { label: 'Analytics', path: '/admin/analytics' },
  { label: 'Media & Documents', path: '/admin/media' },
  { label: 'Social', path: '/admin/social' },
  { label: 'Wholesale', path: '/admin/wholesale' },
  { label: 'Messages', path: '/admin/messages' },
  { label: 'Audit Logs', path: '/admin/audit-logs' },
  { label: 'Settings', path: '/admin/settings' },
  { label: 'Developer Console', path: '/admin/developer' },
  { label: 'Database Console', path: '/admin/developer/database' },
]
