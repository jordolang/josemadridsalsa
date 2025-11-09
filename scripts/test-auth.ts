#!/usr/bin/env tsx
/**
 * Diagnostic script to test authentication setup
 * Run with: npx tsx scripts/test-auth.ts
 */

import { prisma } from '../lib/prisma'
import bcrypt from 'bcryptjs'

async function testAuth() {
  console.log('🔍 Testing Authentication Setup...\n')

  // Check environment variables
  console.log('1. Checking environment variables:')
  const nextAuthSecret = process.env.NEXTAUTH_SECRET
  const nextAuthUrl = process.env.NEXTAUTH_URL
  const databaseUrl = process.env.DATABASE_URL

  console.log(`   NEXTAUTH_SECRET: ${nextAuthSecret ? '✅ Set' : '❌ Missing'}`)
  console.log(`   NEXTAUTH_URL: ${nextAuthUrl || '⚠️  Not set (defaults to current URL)'}`)
  console.log(`   DATABASE_URL: ${databaseUrl ? '✅ Set' : '❌ Missing'}\n`)

  if (!nextAuthSecret) {
    console.error('❌ NEXTAUTH_SECRET is required!')
    console.log('   Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"')
    process.exit(1)
  }

  // Test database connection
  console.log('2. Testing database connection:')
  try {
    await prisma.$connect()
    console.log('   ✅ Database connection successful\n')
  } catch (error) {
    console.error('   ❌ Database connection failed:', error)
    process.exit(1)
  }

  // Check for users
  console.log('3. Checking users in database:')
  let users: any[] = []
  try {
    users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        password: true,
      },
    })

    console.log(`   Found ${users.length} user(s):\n`)
    
    users.forEach((user) => {
      const hasPassword = !!user.password
      const passwordHash = user.password ? user.password.substring(0, 20) + '...' : 'None'
      console.log(`   - ${user.email}`)
      console.log(`     Name: ${user.name || 'N/A'}`)
      console.log(`     Role: ${user.role}`)
      console.log(`     Password: ${hasPassword ? '✅ Set (' + passwordHash + ')' : '❌ Not set'}`)
      console.log('')
    })

    if (users.length === 0) {
      console.log('   ⚠️  No users found in database!')
      console.log('   Create an admin user with: npm run create-admin\n')
    }
  } catch (error) {
    console.error('   ❌ Error querying users:', error)
  }

  // Test password hashing
  console.log('4. Testing password hashing:')
  try {
    const testPassword = 'test123'
    const hash = await bcrypt.hash(testPassword, 10)
    const isValid = await bcrypt.compare(testPassword, hash)
    console.log(`   ✅ Bcrypt working: ${isValid ? 'Yes' : 'No'}\n`)
  } catch (error) {
    console.error('   ❌ Bcrypt test failed:', error)
  }

  // Test authentication flow
  if (users && users.length > 0) {
    console.log('5. Testing authentication with first user:')
    const testUser = users[0]
    if (testUser.password) {
      console.log(`   Testing with: ${testUser.email}`)
      console.log('   ⚠️  Cannot test actual password without knowing it')
      console.log('   Try logging in manually to verify\n')
    } else {
      console.log(`   ⚠️  User ${testUser.email} has no password set\n`)
    }
  }

  await prisma.$disconnect()
  console.log('✅ Diagnostic complete!')
}

testAuth().catch((error) => {
  console.error('❌ Diagnostic failed:', error)
  process.exit(1)
})

