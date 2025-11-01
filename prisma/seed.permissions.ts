import { PrismaClient, UserRole, PermissionCategory } from '@prisma/client'

const prisma = new PrismaClient()

interface PermissionDef {
  name: string
  description: string
  category: PermissionCategory
}

const permissions: PermissionDef[] = [
  // Orders
  { name: 'orders:read', description: 'View orders', category: 'ORDERS' },
  { name: 'orders:write', description: 'Create and update orders', category: 'ORDERS' },
  { name: 'orders:export', description: 'Export orders to CSV/PDF', category: 'ORDERS' },
  
  // Products
  { name: 'products:read', description: 'View products', category: 'PRODUCTS' },
  { name: 'products:write', description: 'Create, update, and delete products', category: 'PRODUCTS' },
  { name: 'products:bulk', description: 'Bulk product operations', category: 'PRODUCTS' },
  { name: 'products:export', description: 'Export products', category: 'PRODUCTS' },
  
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
]

// Define role permissions
const rolePermissions: Record<UserRole, string[]> = {
  ADMIN: permissions.map(p => p.name), // Admins get all permissions
  
  DEVELOPER: permissions.map(p => p.name), // Developers get all permissions
  
  STAFF: [
    // Orders
    'orders:read',
    'orders:write',
    'orders:export',
    // Products
    'products:read',
    'products:write',
    'products:bulk',
    // Users (read only)
    'users:read',
    // Content
    'content:read',
    'content:write',
    // Analytics
    'analytics:read',
    // Messaging
    'messaging:read',
    'messaging:reply',
    'messaging:assign',
  ],
  
  CUSTOMER: [], // No admin permissions
  WHOLESALE: [], // No admin permissions
}

async function main() {
  console.log('🌱 Seeding permissions...')

  // Create all permissions
  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: { name: perm.name },
      update: {
        description: perm.description,
        category: perm.category,
      },
      create: perm,
    })
  }

  console.log(`✅ Created ${permissions.length} permissions`)

  // Assign permissions to roles
  for (const [role, permNames] of Object.entries(rolePermissions)) {
    // Delete existing role permissions
    await prisma.rolePermission.deleteMany({
      where: { role: role as UserRole },
    })

    // Create new role permissions
    for (const permName of permNames) {
      const permission = await prisma.permission.findUnique({
        where: { name: permName },
      })

      if (permission) {
        await prisma.rolePermission.create({
          data: {
            role: role as UserRole,
            permissionId: permission.id,
          },
        })
      }
    }

    console.log(`✅ Assigned ${permNames.length} permissions to ${role}`)
  }

  console.log('🎉 Permission seeding complete!')
}

main()
  .catch((e) => {
    console.error('❌ Error seeding permissions:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
