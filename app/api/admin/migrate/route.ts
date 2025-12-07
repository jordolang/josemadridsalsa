import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

/**
 * EMERGENCY DATABASE MIGRATION ENDPOINT
 *
 * ⚠️ WARNING: DELETE THIS FILE AFTER RUNNING ONCE!
 *
 * This endpoint runs database migrations on production.
 * It should ONLY be used once to set up the database initially.
 *
 * Usage: POST to /api/admin/migrate
 */
export async function POST() {
  try {
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
      warning: '⚠️ DELETE /app/api/admin/migrate/route.ts NOW!'
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

export async function GET() {
  return NextResponse.json({
    message: 'Use POST to run migrations',
    warning: '⚠️ This endpoint should be deleted after first use!'
  })
}
