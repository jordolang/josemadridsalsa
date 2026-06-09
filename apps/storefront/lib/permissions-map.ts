/**
 * Permission mappings for admin features
 */

export interface NavItem {
  label: string
  href: string
  icon?: string
  permission?: string
  children?: NavItem[]
}

/**
 * Admin sidebar navigation structure
 * Items without permissions are visible to all staff
 */
export const adminNavigation: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/admin',
    icon: 'LayoutDashboard',
  },
  {
    label: 'Orders',
    href: '/admin/orders',
    icon: 'ShoppingCart',
    permission: 'orders:read',
  },
  {
    label: 'Gift Certificates',
    href: '/admin/gift-certificates',
    icon: 'Gift',
    permission: 'orders:read',
  },
  {
    label: 'Products',
    href: '/admin/products',
    icon: 'Package',
    permission: 'products:read',
    children: [
      {
        label: 'All Products',
        href: '/admin/products',
        permission: 'products:read',
      },
      {
        label: 'Categories',
        href: '/admin/categories',
        permission: 'products:read',
      },
      {
        label: 'Tags',
        href: '/admin/tags',
        permission: 'content:read',
      },
    ],
  },
  {
    label: 'Users',
    href: '/admin/users',
    icon: 'Users',
    permission: 'users:read',
  },
  {
    label: 'Content',
    href: '/admin/content',
    icon: 'FileText',
    permission: 'content:read',
    children: [
      {
        label: 'Media Library',
        href: '/admin/media',
        permission: 'content:read',
      },
      {
        label: 'Locations',
        href: '/admin/locations',
        permission: 'content:read',
      },
      {
        label: 'Events',
        href: '/admin/events',
        permission: 'content:read',
      },
      {
        label: 'SEO',
        href: '/admin/seo',
        permission: 'content:write',
      },
      {
        label: 'The Heat Index (Blog)',
        href: '/admin/blog',
        permission: 'content:read',
      },
    ],
  },
  {
    label: 'Fundraisers',
    href: '/admin/fundraisers',
    icon: 'Heart',
    permission: 'content:read',
    children: [
      {
        label: 'All Fundraisers',
        href: '/admin/fundraisers',
        permission: 'content:read',
      },
      {
        label: 'Fundraiser Accounts',
        href: '/admin/fundraisers/accounts',
        permission: 'orders:write',
      },
    ],
  },
  {
    label: 'Analytics',
    href: '/admin/analytics',
    icon: 'BarChart3',
    permission: 'analytics:read',
    children: [
      {
        label: 'Overview',
        href: '/admin/analytics',
        permission: 'analytics:read',
      },
      {
        label: 'Order Analytics',
        href: '/admin/analytics/orders',
        permission: 'analytics:read',
      },
    ],
  },
  {
    label: 'Growth Dashboard',
    href: '/admin/growth',
    icon: 'TrendingUp',
    permission: 'analytics:read',
  },
  {
    label: 'Email Marketing',
    href: '/admin/email-marketing',
    icon: 'Mail',
    permission: 'messaging:read',
    children: [
      { label: 'Dashboard', href: '/admin/email-marketing', permission: 'messaging:read' },
      { label: 'Campaigns', href: '/admin/email-campaigns', permission: 'content:write' },
      { label: 'Automations', href: '/admin/email-marketing/automations', permission: 'content:write' },
      { label: 'Templates', href: '/admin/emails', permission: 'content:read' },
      { label: 'Mailing Lists', href: '/admin/communications/lists', permission: 'messaging:read' },
      { label: 'Suppression List', href: '/admin/communications/suppressions', permission: 'content:write' },
      { label: 'Email Logs', href: '/admin/email-marketing/logs', permission: 'content:read' },
      { label: 'Settings', href: '/admin/settings/email', permission: 'settings:write' },
    ],
  },
  {
    label: 'Communications',
    href: '/admin/communications',
    icon: 'MessageSquare',
    permission: 'messaging:read',
    children: [
      { label: 'Contact Form Messages', href: '/admin/messages', permission: 'messaging:read' },
      { label: 'Live Chats', href: '/admin/messages/live', permission: 'messaging:read' },
      { label: 'Lead Generation', href: '/admin/lead-generation', permission: 'messaging:read' },
      { label: 'Reviews', href: '/admin/reviews', permission: 'content:read' },
      { label: 'AI Training', href: '/admin/training-data', permission: 'content:write' },
    ],
  },
  {
    label: 'Forms',
    href: '/admin/forms',
    icon: 'FileText',
    permission: 'content:read',
  },
  {
    label: 'Social Media',
    href: '/admin/social',
    icon: 'Share2',
    permission: 'social_media:compose',
  },
  {
    label: 'Financials',
    href: '/admin/financials',
    icon: 'DollarSign',
    permission: 'financials:read',
    children: [
      {
        label: 'Overview',
        href: '/admin/financials',
        permission: 'financials:read',
      },
      {
        label: 'Invoices',
        href: '/admin/invoices',
        permission: 'financials:read',
      },
      {
        label: 'Payroll',
        href: '/admin/financials/payroll',
        permission: 'financials:read',
      },
      {
        label: 'Expenses',
        href: '/admin/financials/expenses',
        permission: 'financials:read',
      },
      {
        label: 'Taxes',
        href: '/admin/financials/taxes',
        permission: 'financials:read',
      },
    ],
  },
  {
    label: 'Wholesale',
    href: '/admin/wholesale',
    icon: 'Building2',
    permission: 'users:read',
  },
  {
    label: 'Settings',
    href: '/admin/settings',
    icon: 'Settings',
    permission: 'settings:read',
    children: [
      {
        label: 'General',
        href: '/admin/settings',
        permission: 'settings:read',
      },
      {
        label: 'My Profile',
        href: '/admin/settings/profile',
      },
      {
        label: 'Integrations',
        href: '/admin/settings/integrations',
        permission: 'api_keys:manage',
      },
      {
        label: 'Email Settings',
        href: '/admin/settings/email',
        permission: 'settings:write',
      },
      {
        label: 'Payments',
        href: '/admin/settings/payments',
        permission: 'settings:read',
      },
      {
        label: 'Discount Codes',
        href: '/admin/settings/discount-codes',
        permission: 'settings:read',
      },
      {
        label: 'Audit Logs',
        href: '/admin/audit-logs',
        permission: 'settings:read',
      },
    ],
  },
  {
    label: 'Credentials',
    href: '/admin/credentials',
    icon: 'Lock',
    permission: 'credentials:read',
  },
]

/**
 * Feature permission requirements
 */
export const featurePermissions = {
  // Dashboard
  'dashboard:view': null, // All staff can view
  'dashboard:revenue': 'financials:read',
  
  // Orders
  'orders:list': 'orders:read',
  'orders:view': 'orders:read',
  'orders:create': 'orders:write',
  'orders:edit': 'orders:write',
  'orders:export': 'orders:export',
  'orders:print': 'orders:read',
  
  // Products
  'products:list': 'products:read',
  'products:view': 'products:read',
  'products:create': 'products:write',
  'products:edit': 'products:write',
  'products:delete': 'products:write',
  'products:bulk': 'products:bulk',
  'products:export': 'products:export',
  
  // Users
  'users:list': 'users:read',
  'users:view': 'users:read',
  'users:create': 'users:write',
  'users:edit': 'users:write',
  'users:impersonate': 'users:impersonate',
  'users:export': 'users:export',
  
  // Content
  'content:list': 'content:read',
  'content:view': 'content:read',
  'content:create': 'content:write',
  'content:edit': 'content:write',
  'content:delete': 'content:write',
  'content:publish': 'content:publish',
  
  // Analytics
  'analytics:view': 'analytics:read',
  'analytics:export': 'analytics:export',
  
  // Financials
  'financials:view': 'financials:read',
  'financials:refund': 'financials:refunds',
  'financials:export': 'financials:export',
  
  // Settings
  'settings:view': 'settings:read',
  'settings:edit': 'settings:write',
  'settings:api-keys': 'api_keys:manage',
  
  // Messaging
  'messaging:list': 'messaging:read',
  'messaging:reply': 'messaging:reply',
  'messaging:assign': 'messaging:assign',
  
  // Social Media
  'social:compose': 'social_media:compose',
  'social:schedule': 'social_media:schedule',
  'social:publish': 'social_media:publish',
} as const

/**
 * Get required permission for a feature
 */
export function getFeaturePermission(feature: keyof typeof featurePermissions): string | null {
  return featurePermissions[feature]
}

/**
 * Filter navigation items based on user permissions
 */
export function filterNavByPermissions(
  nav: NavItem[],
  userPermissions: string[]
): NavItem[] {
  return nav
    .filter((item) => {
      // No permission required = visible to all staff
      if (!item.permission) return true
      // Check if user has the required permission
      return userPermissions.includes(item.permission)
    })
    .map((item) => {
      // Recursively filter children
      if (item.children) {
        return {
          ...item,
          children: filterNavByPermissions(item.children, userPermissions),
        }
      }
      return item
    })
}
