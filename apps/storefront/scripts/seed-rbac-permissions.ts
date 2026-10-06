/**
 * Seed RBAC permissions and role-permission assignments.
 * Run with: npx tsx scripts/seed-rbac-permissions.ts
 * Safe to re-run (uses upsert).
 */
import { PrismaClient } from '@prisma/client'
import { permissionDefinitions, defaultRolePermissions } from '@/lib/permissions-data'

const prisma = new PrismaClient()

async function main() {
  console.log('🔐 Seeding RBAC permissions...')

  // Upsert all permission definitions
  for (const perm of permissionDefinitions) {
    await prisma.permission.upsert({
      where: { name: perm.name },
      create: { name: perm.name, description: perm.description, category: perm.category },
      update: { description: perm.description, category: perm.category },
    })
  }
  console.log(`✅ Upserted ${permissionDefinitions.length} permissions`)

  // Seed role-permission mappings
  const roles = ['ADMIN', 'DEVELOPER', 'STAFF'] as const
  let totalRPs = 0

  for (const role of roles) {
    const permNames = defaultRolePermissions[role] ?? []
    for (const permName of permNames) {
      const perm = await prisma.permission.findUnique({ where: { name: permName } })
      if (!perm) {
        console.warn(`  ⚠️ Permission not found: ${permName}`)
        continue
      }
      await prisma.rolePermission.upsert({
        where: { role_permissionId: { role, permissionId: perm.id } },
        create: { role, permissionId: perm.id },
        update: {},
      })
      totalRPs++
    }
    console.log(`✅ ${role}: ${permNames.length} permissions assigned`)
  }

  console.log(`\n🌱 RBAC seed complete — ${totalRPs} role-permission records upserted.`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
