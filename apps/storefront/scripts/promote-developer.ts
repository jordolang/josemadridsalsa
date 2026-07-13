import { PrismaClient } from '@prisma/client'
import { withAccelerate } from '@prisma/extension-accelerate'
import { DEVELOPER_ACCOUNT_EMAIL } from '../lib/developer/constants'

const baseClient = new PrismaClient()
const prisma = process.env.DATABASE_URL?.includes('prisma+postgres://')
  ? (baseClient.$extends(withAccelerate()) as unknown as PrismaClient)
  : baseClient

async function main() {
  const email = (process.env.DEVELOPER_EMAIL || DEVELOPER_ACCOUNT_EMAIL).toLowerCase().trim()

  console.log(`Promoting ${email} to DEVELOPER (super admin)...`)

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true },
  })

  if (!existing) {
    console.log(`❌ No user found with email ${email}`)
    console.log('Sign in once with this account (or create it) and re-run the script.')
    return
  }

  if (existing.role === 'DEVELOPER') {
    console.log(`✅ ${email} already has the DEVELOPER role`)
    return
  }

  await prisma.user.update({
    where: { email },
    data: { role: 'DEVELOPER' },
  })

  console.log(`✅ Updated ${email} from ${existing.role} to DEVELOPER`)
  console.log('Re-seed permissions (npm run db:seed:permissions) to persist the developer:* grants.')
}

main()
  .catch((e) => {
    console.error('Error promoting developer account:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
