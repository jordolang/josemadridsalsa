import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

/**
 * EMERGENCY DATABASE MIGRATION ENDPOINT
 *
 * ⚠️ WARNING: DELETE THIS FILE AFTER RUNNING ONCE!
 *
 * This endpoint runs database migrations on production.
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

    console.log('🚀 Starting database migration...')

    // Run Prisma db push to create tables
    console.log('📋 Creating database tables...')
    const { stdout: pushOutput, stderr: pushError } = await execAsync('npx prisma db push --accept-data-loss --skip-generate')

    if (pushError && !pushError.includes('warning')) {
      console.error('❌ Migration error:', pushError)
      return NextResponse.json(
        {
          success: false,
          error: 'Migration failed',
          details: pushError,
          output: pushOutput
        },
        { status: 500 }
      )
    }

    console.log('✅ Tables created!')
    console.log(pushOutput)

    // Run seed
    console.log('🌱 Seeding database...')
    const { stdout: seedOutput, stderr: seedError } = await execAsync('npm run db:seed')

    if (seedError && !seedError.includes('warning')) {
      console.error('⚠️ Seed warning:', seedError)
    }

    console.log('✅ Database seeded!')
    console.log(seedOutput)

    return NextResponse.json({
      success: true,
      message: '✅ Database migrated and seeded successfully!',
      migration: pushOutput,
      seed: seedOutput,
      warning: '⚠️ DELETE /app/api/setup-db/route.ts NOW!'
    })

  } catch (error: any) {
    console.error('💥 Migration failed:', error)
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
