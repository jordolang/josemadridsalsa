import { PermissionCategory, UserRole } from '@prisma/client'

export type PermissionDefinition = {
  name: string
  description: string
  category: PermissionCategory
}

export const permissionDefinitions: PermissionDefinition[] = [
  // Orders
  { name: 'orders:read', description: 'View orders', category: 'ORDERS' },
  { name: 'orders:write', description: 'Create and update orders', category: 'ORDERS' },
  { name: 'orders:export', description: 'Export orders to CSV/PDF', category: 'ORDERS' },

  // Products
  { name: 'products:read', description: 'View products', category: 'PRODUCTS' },
  { name: 'products:write', description: 'Create, update, and delete products', category: 'PRODUCTS' },
  { name: 'products:bulk', description: 'Bulk product operations', category: 'PRODUCTS' },
  { name: 'products:export', description: 'Export products', category: 'PRODUCTS' },
  { name: 'products:import', description: 'Import products from files', category: 'PRODUCTS' },

  // Users
  { name: 'users:read', description: 'View users', category: 'USERS' },
  { name: 'users:write', description: 'Create, update, and manage users', category: 'USERS' },
  { name: 'users:impersonate', description: 'Impersonate users', category: 'USERS' },
  { name: 'users:export', description: 'Export user data', category: 'USERS' },

  // Content
  { name: 'content:read', description: 'View content (recipes, media, events)', category: 'CONTENT' },
  { name: 'content:write', description: 'Create and edit content', category: 'CONTENT' },
  { name: 'content:publish', description: 'Publish content', category: 'CONTENT' },

  // Analytics
  { name: 'analytics:read', description: 'View analytics and reports', category: 'ANALYTICS' },
  { name: 'analytics:export', description: 'Export analytics data', category: 'ANALYTICS' },

  // Settings
  { name: 'settings:read', description: 'View settings', category: 'SETTINGS' },
  { name: 'settings:write', description: 'Modify settings', category: 'SETTINGS' },

  // Financials
  { name: 'financials:read', description: 'View financial data', category: 'FINANCIALS' },
  { name: 'financials:refunds', description: 'Process refunds', category: 'FINANCIALS' },
  { name: 'financials:export', description: 'Export financial reports', category: 'FINANCIALS' },

  // API Keys
  { name: 'api_keys:manage', description: 'Manage API keys and integrations', category: 'API_KEYS' },

  // Messaging
  { name: 'messaging:read', description: 'View messages', category: 'MESSAGING' },
  { name: 'messaging:reply', description: 'Reply to messages', category: 'MESSAGING' },
  { name: 'messaging:assign', description: 'Assign messages to staff', category: 'MESSAGING' },

  // Social Media
  { name: 'social_media:compose', description: 'Compose social media posts', category: 'SOCIAL_MEDIA' },
  { name: 'social_media:schedule', description: 'Schedule social media posts', category: 'SOCIAL_MEDIA' },
  { name: 'social_media:publish', description: 'Publish social media posts', category: 'SOCIAL_MEDIA' },
] as const

export const defaultRolePermissions: Record<UserRole, string[]> = {
  ADMIN: permissionDefinitions.map((perm) => perm.name),
  DEVELOPER: permissionDefinitions.map((perm) => perm.name),
  STAFF: [
    'orders:read',
    'orders:write',
    'orders:export',
    'products:read',
    'products:write',
    'products:bulk',
    'products:import',
    'users:read',
    'content:read',
    'content:write',
    'analytics:read',
    'messaging:read',
    'messaging:reply',
    'messaging:assign',
  ],
  CUSTOMER: [],
  WHOLESALE: [],
}

export function fallbackPermissionsFor(role: UserRole): string[] {
  return defaultRolePermissions[role] ?? []
}
