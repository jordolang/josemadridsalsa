import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import bcrypt from 'bcryptjs'

/**
 * Debug endpoint to check auth setup
 * DELETE THIS AFTER DEBUGGING
 */
export async function GET(request: Request) {
  try {
    // Check if we can connect to database
    const userCount = await prisma.user.count()

    // Check if admin user exists
    const adminUser = await prisma.user.findUnique({
      where: { email: 'admin@josemadrid.net' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        password: true, // We'll check if it exists
      },
    })

    // Test password hash
    let passwordValid = false
    if (adminUser?.password) {
      passwordValid = await bcrypt.compare('admin123', adminUser.password)
    }

    return NextResponse.json({
      database: {
        connected: true,
        userCount,
      },
      adminUser: {
        exists: !!adminUser,
        email: adminUser?.email,
        name: adminUser?.name,
        role: adminUser?.role,
        hasPassword: !!adminUser?.password,
        passwordValid,
      },
      env: {
        hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
        nextAuthUrl: process.env.NEXTAUTH_URL || 'not set',
        nodeEnv: process.env.NODE_ENV,
      },
    })
  } catch (error) {
    console.error('[Auth Debug] Error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}
