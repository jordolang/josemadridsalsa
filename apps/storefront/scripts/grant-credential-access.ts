import { PrismaClient } from '@prisma/client'
import { withAccelerate } from '@prisma/extension-accelerate'
import { DEVELOPER_ACCOUNT_EMAIL } from '@/lib/developer/constants'

const baseClient = new PrismaClient()
const prisma = process.env.DATABASE_URL?.includes('prisma+postgres://')
  ? (baseClient.$extends(withAccelerate()) as unknown as PrismaClient)
  : baseClient

const DEFAULT_EMAILS = [DEVELOPER_ACCOUNT_EMAIL, 'mike@josemadridsalsa.com']

async function main() {
  const emails = (process.argv.slice(2).length > 0 ? process.argv.slice(2) : DEFAULT_EMAILS).map(
    (e) => e.toLowerCase().trim()
  )

  for (const email of emails) {
    console.log(`Granting full credential access to ${email}...`)

    const grant = await prisma.credentialAccessGrant.upsert({
      where: { email },
      update: {
        canView: true,
        canAdd: true,
        canEdit: true,
        canDelete: true,
        canUpload: true,
        revokedAt: null,
        grantedByEmail: DEVELOPER_ACCOUNT_EMAIL,
      },
      create: {
        email,
        grantedByEmail: DEVELOPER_ACCOUNT_EMAIL,
        canView: true,
        canAdd: true,
        canEdit: true,
        canDelete: true,
        canUpload: true,
      },
    })

    console.log(`✅ Grant active for ${grant.email}`)

    // Credential routes also require the credentials:read/write RBAC permission,
    // which only ADMIN and DEVELOPER roles have by default.
    const user = await prisma.user.findUnique({
      where: { email },
      select: { role: true },
    })

    if (!user) {
      console.log(
        `⚠️  No user account exists for ${email} yet. The grant will apply once they sign in with an ADMIN or DEVELOPER role.`
      )
    } else if (user.role !== 'ADMIN' && user.role !== 'DEVELOPER') {
      console.log(
        `⚠️  ${email} has role ${user.role}, which lacks the credentials:write permission. Promote them with "npm run create-admin" or "npm run create-developer".`
      )
    }
  }

  console.log('🎉 Done!')
}

main()
  .catch((e) => {
    console.error('Error granting credential access:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
