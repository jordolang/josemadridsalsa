import { PrismaClient, UserRole } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Creating OWNER account...')

  // Check if an OWNER already exists
  const existingOwner = await prisma.user.findFirst({
    where: { role: UserRole.OWNER },
  })

  if (existingOwner) {
    console.log(`OWNER account already exists: ${existingOwner.email}`)
    console.log('Only one OWNER account is allowed. Skipping creation.')
    return
  }

  const ownerEmail = 'mike@josemadridsalsa.com'
  const ownerPassword = 'Jl101213@wan'

  // Check if user with this email already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: ownerEmail },
  })

  if (existingUser) {
    // Upgrade existing user to OWNER
    await prisma.user.update({
      where: { email: ownerEmail },
      data: {
        role: UserRole.OWNER,
        password: await bcrypt.hash(ownerPassword, 12),
        isEmailVerified: true,
        name: existingUser.name || 'Mike',
      },
    })
    console.log(`Upgraded existing user ${ownerEmail} to OWNER role.`)
  } else {
    // Create new OWNER account
    const hashedPassword = await bcrypt.hash(ownerPassword, 12)

    await prisma.user.create({
      data: {
        email: ownerEmail,
        password: hashedPassword,
        name: 'Mike',
        role: UserRole.OWNER,
        isEmailVerified: true,
      },
    })
    console.log(`Created OWNER account: ${ownerEmail}`)
  }

  console.log('OWNER account setup complete!')
}

main()
  .catch((e) => {
    console.error('Error creating OWNER account:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
