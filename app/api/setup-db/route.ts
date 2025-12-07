import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/**
 * EMERGENCY DATABASE SEEDING ENDPOINT
 *
 * ⚠️ WARNING: DELETE THIS FILE AFTER RUNNING ONCE!
 *
 * This endpoint seeds the production database.
 * NOTE: Migrations must already be run (tables must exist).
 * Protected by MASTER_KEY to avoid auth middleware.
 *
 * Usage: POST to /api/setup-db?key=YOUR_MASTER_KEY
 */
export async function POST(request: NextRequest) {
  try {
    // Check secret key
    const key = request.nextUrl.searchParams.get('key')
    const masterKey = process.env.MASTER_KEY

    if (!key || !masterKey || key !== masterKey) {
      return NextResponse.json(
        { error: 'Unauthorized - invalid key' },
        { status: 401 }
      )
    }

    console.log('🚀 Starting database seeding...')

    // Import seed function
    const { seedDatabase } = await import('@/lib/seed')

    const result = await seedDatabase()

    return NextResponse.json({
      success: true,
      message: '✅ Database seeded successfully!',
      details: result,
      warning: '⚠️ DELETE /app/api/setup-db/route.ts NOW!'
    })

  } catch (error: any) {
    console.error('💥 Seeding failed:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        stack: error.stack
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get('key')
  const masterKey = process.env.MASTER_KEY

  if (!key || !masterKey || key !== masterKey) {
    return NextResponse.json({
      error: 'Invalid key'
    }, { status: 401 })
  }

  return NextResponse.json({
    message: 'Use POST to run migrations',
    warning: '⚠️ This endpoint should be deleted after first use!'
  })
}
