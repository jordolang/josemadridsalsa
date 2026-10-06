#!/usr/bin/env tsx
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

async function testAuth() {
  console.log('🔍 Testing Authentication Setup...\n')

  // Test 1: Check database connection
  console.log('1. Testing database connection...')
  try {
    const userCount = await prisma.user.count()
    console.log(`✅ Database connected. Found ${userCount} users.\n`)
  } catch (error) {
    console.error('❌ Database connection failed:', error)
    process.exit(1)
  }

  // Test 2: Check users
  console.log('2. Checking users...')
  const users = await prisma.user.findMany({
    select: {
      email: true,
      role: true,
      password: true,
      name: true,
    },
  })

  for (const user of users) {
    console.log(`   📧 ${user.email}`)
    console.log(`   👤 Role: ${user.role}`)
    console.log(`   🔐 Password hash: ${user.password ? 'SET' : 'NOT SET'}`)
    console.log(`   📛 Name: ${user.name || 'Not set'}`)
    console.log('')
  }

  // Test 3: Verify NextAuth environment variables
  console.log('3. Checking NextAuth environment variables...')
  const requiredEnvVars = [
    'NEXTAUTH_SECRET',
    'NEXTAUTH_URL',
    'DATABASE_URL',
  ]

  for (const envVar of requiredEnvVars) {
    const value = process.env[envVar]
    console.log(`   ${envVar}: ${value ? '✅ SET' : '❌ NOT SET'}`)
  }

  console.log('\n✅ Authentication setup test complete!')
  console.log('\nNext steps:')
  console.log('1. Start dev server: npm run dev')
  console.log('2. Navigate to: http://localhost:3000/auth/signin')
  console.log('3. Login with one of the admin accounts above')
  console.log('4. Check browser console and terminal for detailed logs')
}

testAuth()
  .catch((error) => {
    console.error('Test failed:', error)
    process.exit(1)
  })
  .finally(() => {
    prisma.$disconnect()
  })
