import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const email = process.env.ADMIN_EMAIL || 'admin@josemadridsalsa.com'
  const password = process.env.ADMIN_PASSWORD || 'admin123456' // Change this!
  const name = process.env.ADMIN_NAME || 'Admin User'

  console.log('Creating admin user...')

  // Check if user already exists
  const existing = await prisma.user.findUnique({
    where: { email },
  })

  if (existing) {
    console.log(`❌ User with email ${email} already exists`)
    
    // Update to ADMIN role if not already
    if (existing.role !== 'ADMIN') {
      await prisma.user.update({
        where: { email },
        data: { role: 'ADMIN' },
      })
      console.log(`✅ Updated ${email} to ADMIN role`)
    }
    
    return
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10)

  // Create admin user
  const user = await prisma.user.create({
    data: {
      email,
      name,
      password: hashedPassword,
      role: 'ADMIN',
      isEmailVerified: true,
    },
  })

  console.log('✅ Admin user created successfully!')
  console.log('-----------------------------------')
  console.log(`Email: ${email}`)
  console.log(`Password: ${password}`)
  console.log(`Role: ${user.role}`)
  console.log('-----------------------------------')
  console.log('⚠️  IMPORTANT: Change the password after first login!')
}

main()
  .catch((e) => {
    console.error('Error creating admin user:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
