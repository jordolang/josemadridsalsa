import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const hasDbUrl = !!process.env.DATABASE_URL
    const hasPostgresUrl = !!process.env.POSTGRES_URL

    let prismaStatus = 'not loaded'
    let prismaError = null

    try {
      const { default: prisma } = await import('@/lib/prisma')
      prismaStatus = 'loaded'

      // Try to connect
      await prisma.$connect()
      prismaStatus = 'connected'

      // Try a simple query
      const count = await prisma.product.count()
      prismaStatus = `connected and working (${count} products)`
    } catch (error) {
      prismaError = error instanceof Error ? error.message : String(error)
      prismaStatus = 'error'
    }

    return NextResponse.json({
      environment: process.env.NODE_ENV,
      databaseUrl: {
        hasDatabaseUrl: hasDbUrl,
        hasPostgresUrl: hasPostgresUrl,
      },
      prisma: {
        status: prismaStatus,
        error: prismaError,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Debug endpoint failed',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
