import { PrismaClient, PermissionCategory, UserRole } from '@prisma/client'

const prisma = new PrismaClient()

const permissions = [
  // Orders
  { name: 'orders:read', description: 'View orders', category: 'ORDERS' as PermissionCategory },
  { name: 'orders:write', description: 'Create and edit orders', category: 'ORDERS' as PermissionCategory },
  { name: 'orders:export', description: 'Export orders data', category: 'ORDERS' as PermissionCategory },
  
  // Products
  { name: 'products:read', description: 'View products and categories', category: 'PRODUCTS' as PermissionCategory },
  { name: 'products:write', description: 'Create, edit, and delete products', category: 'PRODUCTS' as PermissionCategory },
  { name: 'products:bulk', description: 'Bulk edit products', category: 'PRODUCTS' as PermissionCategory },
  { name: 'products:export', description: 'Export products data', category: 'PRODUCTS' as PermissionCategory },
  
  // Users
  { name: 'users:read', description: 'View users and wholesale accounts', category: 'USERS' as PermissionCategory },
  { name: 'users:write', description: 'Create and edit users', category: 'USERS' as PermissionCategory },
  { name: 'users:impersonate', description: 'Impersonate other users', category: 'USERS' as PermissionCategory },
  { name: 'users:export', description: 'Export users data', category: 'USERS' as PermissionCategory },
  
  // Content
  { name: 'content:read', description: 'View content (media, recipes, locations, etc)', category: 'CONTENT' as PermissionCategory },
  { name: 'content:write', description: 'Create and edit content', category: 'CONTENT' as PermissionCategory },
  { name: 'content:publish', description: 'Publish content', category: 'CONTENT' as PermissionCategory },
  
  // Analytics
  { name: 'analytics:read', description: 'View analytics and reports', category: 'ANALYTICS' as PermissionCategory },
  { name: 'analytics:export', description: 'Export analytics data', category: 'ANALYTICS' as PermissionCategory },
  
  // Financials
  { name: 'financials:read', description: 'View financial data', category: 'FINANCIALS' as PermissionCategory },
  { name: 'financials:refunds', description: 'Process refunds', category: 'FINANCIALS' as PermissionCategory },
  { name: 'financials:export', description: 'Export financial data', category: 'FINANCIALS' as PermissionCategory },
  
  // Settings
  { name: 'settings:read', description: 'View settings', category: 'SETTINGS' as PermissionCategory },
  { name: 'settings:write', description: 'Edit settings', category: 'SETTINGS' as PermissionCategory },
  { name: 'api_keys:manage', description: 'Manage API keys and integrations', category: 'SETTINGS' as PermissionCategory },
  
  // Messaging
  { name: 'messaging:read', description: 'View messages', category: 'MESSAGING' as PermissionCategory },
  { name: 'messaging:reply', description: 'Reply to messages', category: 'MESSAGING' as PermissionCategory },
  { name: 'messaging:assign', description: 'Assign messages to staff', category: 'MESSAGING' as PermissionCategory },
  
  // Social Media
  { name: 'social_media:compose', description: 'Compose social media posts', category: 'SOCIAL_MEDIA' as PermissionCategory },
  { name: 'social_media:schedule', description: 'Schedule social media posts', category: 'SOCIAL_MEDIA' as PermissionCategory },
  { name: 'social_media:publish', description: 'Publish social media posts', category: 'SOCIAL_MEDIA' as PermissionCategory },
]

// Role permission assignments
const rolePermissions = {
  ADMIN: [
    // Admins get ALL permissions
    ...permissions.map(p => p.name)
  ],
  DEVELOPER: [
    // Developers get everything except financials and user impersonation
    'orders:read', 'orders:write', 'orders:export',
    'products:read', 'products:write', 'products:bulk', 'products:export',
    'users:read', 'users:write', 'users:export',
    'content:read', 'content:write', 'content:publish',
    'analytics:read', 'analytics:export',
    'settings:read', 'settings:write', 'api_keys:manage',
    'messaging:read', 'messaging:reply', 'messaging:assign',
    'social_media:compose', 'social_media:schedule', 'social_media:publish',
  ],
  STAFF: [
    // Staff get read access and basic operations
    'orders:read', 'orders:write',
    'products:read', 'products:write',
    'content:read', 'content:write',
    'messaging:read', 'messaging:reply',
    'social_media:compose',
  ],
  WHOLESALE: [
    // Wholesale accounts get limited read access
    'orders:read',
    'products:read',
  ],
  CUSTOMER: [
    // Customers get no admin permissions
  ],
}

async function main() {
  console.log('🌱 Seeding permissions...')

  // Create all permissions
  for (const permission of permissions) {
    await prisma.permission.upsert({
      where: { name: permission.name },
      update: {
        description: permission.description,
        category: permission.category,
      },
      create: permission,
    })
    console.log(`✅ Created/updated permission: ${permission.name}`)
  }

  // Assign permissions to roles
  for (const [role, permissionNames] of Object.entries(rolePermissions)) {
    console.log(`\n👤 Assigning permissions to ${role}...`)
    
    for (const permissionName of permissionNames) {
      const permission = await prisma.permission.findUnique({
        where: { name: permissionName },
      })

      if (!permission) {
        console.warn(`⚠️  Permission not found: ${permissionName}`)
        continue
      }

      await prisma.rolePermission.upsert({
        where: {
          role_permissionId: {
            role: role as UserRole,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          role: role as UserRole,
          permissionId: permission.id,
        },
      })
    }
    
    console.log(`✅ Assigned ${permissionNames.length} permissions to ${role}`)
  }

  console.log('\n✨ Permissions seeded successfully!')
}

main()
  .catch((e) => {
    console.error('❌ Error seeding permissions:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
