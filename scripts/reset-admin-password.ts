import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const email = process.argv[2] || 'admin@josemadridsalsa.com'
  const newPassword = process.argv[3] || 'admin123456'

  console.log(`\n🔄 Resetting password for: ${email}`)

  // Check if user exists
  const user = await prisma.user.findUnique({
    where: { email },
  })

  if (!user) {
    console.error(`❌ User ${email} not found!`)
    console.log('\nAvailable users:')
    const users = await prisma.user.findMany({
      select: { email: true, role: true },
    })
    users.forEach(u => console.log(`  - ${u.email} (${u.role})`))
    process.exit(1)
  }

  // Hash new password with bcrypt (same as in auth.ts)
  console.log('🔐 Hashing password with bcrypt...')
  const hashedPassword = await bcrypt.hash(newPassword, 10)
  
  console.log('Old hash:', user.password?.substring(0, 20) + '...')
  console.log('New hash:', hashedPassword.substring(0, 20) + '...')

  // Test the hash immediately to verify it works
  console.log('\n🧪 Testing password verification...')
  const testResult = await bcrypt.compare(newPassword, hashedPassword)
  console.log('Test result:', testResult ? '✅ PASS' : '❌ FAIL')

  if (!testResult) {
    console.error('❌ Password hashing/verification failed!')
    process.exit(1)
  }

  // Update user password
  await prisma.user.update({
    where: { email },
    data: { 
      password: hashedPassword,
      role: 'ADMIN', // Ensure admin role
      isEmailVerified: true,
    },
  })

  console.log('\n✅ Password reset successfully!')
  console.log('-----------------------------------')
  console.log(`Email: ${email}`)
  console.log(`Password: ${newPassword}`)
  console.log(`Role: ${user.role}`)
  console.log('-----------------------------------')
  console.log('\n🔗 Login at: http://localhost:3000/auth/signin')
  console.log('\n⚠️  IMPORTANT: Change this password after logging in!')
  console.log('\nUsage: npx tsx scripts/reset-admin-password.ts [email] [password]')
}

main()
  .catch((e) => {
    console.error('❌ Error resetting password:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
