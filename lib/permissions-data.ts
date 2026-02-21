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
  { name: 'orders:import', description: 'Import orders from CSV/Excel', category: 'ORDERS' },
  { name: 'orders:modify', description: 'Modify existing orders', category: 'ORDERS' },
  { name: 'orders:print-labels', description: 'Print shipping labels', category: 'ORDERS' },
  { name: 'orders:sync-shopify', description: 'Sync orders with Shopify', category: 'ORDERS' },

  // Products
  { name: 'products:read', description: 'View products', category: 'PRODUCTS' },
  { name: 'products:write', description: 'Create, update, and delete products', category: 'PRODUCTS' },
  { name: 'products:bulk', description: 'Bulk product operations', category: 'PRODUCTS' },
  { name: 'products:export', description: 'Export products', category: 'PRODUCTS' },
  { name: 'products:import', description: 'Import products from files', category: 'PRODUCTS' },

  // Inventory
  { name: 'inventory:read', description: 'View inventory levels and history', category: 'INVENTORY' },
  { name: 'inventory:write', description: 'Adjust inventory stock levels', category: 'INVENTORY' },
  { name: 'inventory:bulk', description: 'Bulk inventory operations', category: 'INVENTORY' },
  { name: 'inventory:export', description: 'Export inventory reports', category: 'INVENTORY' },
  { name: 'inventory:import', description: 'Import inventory data from CSV', category: 'INVENTORY' },
  { name: 'inventory:delete', description: 'Delete inventory records', category: 'INVENTORY' },

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

  // Gift Certificates
  { name: 'gift-certificates:read', description: 'View gift certificates', category: 'GIFT_CERTIFICATES' },
  { name: 'gift-certificates:write', description: 'Create and update gift certificates', category: 'GIFT_CERTIFICATES' },
  { name: 'gift-certificates:import', description: 'Import gift certificates', category: 'GIFT_CERTIFICATES' },
  { name: 'gift-certificates:export', description: 'Export gift certificates', category: 'GIFT_CERTIFICATES' },

  // Locations
  { name: 'locations:read', description: 'View locations', category: 'LOCATIONS' },
  { name: 'locations:write', description: 'Create and update locations', category: 'LOCATIONS' },
  { name: 'locations:import', description: 'Import locations', category: 'LOCATIONS' },
  { name: 'locations:export', description: 'Export locations', category: 'LOCATIONS' },

  // Events
  { name: 'events:read', description: 'View events', category: 'EVENTS' },
  { name: 'events:write', description: 'Create and update events', category: 'EVENTS' },
  { name: 'events:sync-calendar', description: 'Sync with Google Calendar', category: 'EVENTS' },

  // SEO
  { name: 'seo:read', description: 'View SEO configuration', category: 'SEO' },
  { name: 'seo:manage', description: 'Manage SEO configuration', category: 'SEO' },
  { name: 'seo:analyze', description: 'Run SEO analysis', category: 'SEO' },

  // AI Training
  { name: 'ai:view-training', description: 'View AI training data', category: 'AI_TRAINING' },
  { name: 'ai:manage-training', description: 'Manage AI training data', category: 'AI_TRAINING' },
  { name: 'ai:view-analytics', description: 'View AI chat analytics', category: 'AI_TRAINING' },
] as const

export const defaultRolePermissions: Record<UserRole, string[]> = {
  // OWNER has all permissions (super admin - only one can exist)
  OWNER: permissionDefinitions.map((perm) => perm.name),
  ADMIN: permissionDefinitions.map((perm) => perm.name),
  DEVELOPER: permissionDefinitions.map((perm) => perm.name),
  STAFF: [
    'orders:read',
    'orders:write',
    'orders:export',
    'orders:import',
    'orders:modify',
    'orders:print-labels',
    'products:read',
    'products:write',
    'products:bulk',
    'products:import',
    'inventory:read',
    'inventory:write',
    'users:read',
    'content:read',
    'content:write',
    'analytics:read',
    'messaging:read',
    'messaging:reply',
    'messaging:assign',
    'gift-certificates:read',
    'gift-certificates:write',
    'locations:read',
    'events:read',
    'seo:read',
    'ai:view-analytics',
  ],
  CUSTOMER: [],
  WHOLESALE: [],
}

export function fallbackPermissionsFor(role: UserRole): string[] {
  return defaultRolePermissions[role] ?? []
}
