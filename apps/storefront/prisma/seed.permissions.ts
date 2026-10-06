import { PrismaClient, UserRole } from '@prisma/client'
import { permissionDefinitions, defaultRolePermissions } from '@/lib/permissions-data'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding permissions...')

  // Create all permissions
  for (const perm of permissionDefinitions) {
    await prisma.permission.upsert({
      where: { name: perm.name },
      update: {
        description: perm.description,
        category: perm.category,
      },
      create: perm,
    })
  }

  console.log(`✅ Created ${permissionDefinitions.length} permissions`)

  // Assign permissions to roles
  for (const [role, permNames] of Object.entries(defaultRolePermissions)) {
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
