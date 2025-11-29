import { PrismaClient } from '@prisma/client'
import { withAccelerate } from '@prisma/extension-accelerate'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

let prismaClient: PrismaClient | null = null

const sanitizeUrl = (value?: string | null) => value?.trim()

// Normalize env values (copy/paste into Vercel can leave trailing whitespace/newlines)
process.env.DATABASE_URL = sanitizeUrl(process.env.DATABASE_URL) || undefined
process.env.POSTGRES_URL = sanitizeUrl(process.env.POSTGRES_URL) || undefined
process.env.PRISMA_DATABASE_URL = sanitizeUrl(process.env.PRISMA_DATABASE_URL) || undefined

// Ensure DATABASE_URL is set; some deployments only provide POSTGRES_URL or PRISMA_DATABASE_URL
if (!process.env.DATABASE_URL) {
  if (process.env.PRISMA_DATABASE_URL) {
    process.env.DATABASE_URL = process.env.PRISMA_DATABASE_URL
    console.log('[Prisma] DATABASE_URL not set, fell back to PRISMA_DATABASE_URL')
  } else if (process.env.POSTGRES_URL) {
    process.env.DATABASE_URL = process.env.POSTGRES_URL
    console.log('[Prisma] DATABASE_URL not set, fell back to POSTGRES_URL')
  }
}

try {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set')
  }

  // Support both Prisma Accelerate and direct Postgres URLs
  const usesAccelerate = databaseUrl.startsWith('prisma://') || databaseUrl.startsWith('prisma+postgres://')

  const baseClient = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

  prismaClient = usesAccelerate
    ? (baseClient.$extends(withAccelerate()) as unknown as PrismaClient)
    : baseClient
    
  console.log('[Prisma] Client initialized successfully')
} catch (error) {
  console.error('[Prisma] Failed to initialize client with DATABASE_URL:', error)

  // If a POSTGRES_URL exists, try again with that value as a fallback
  const fallbackUrl = process.env.POSTGRES_URL
  const attemptedUrl = process.env.DATABASE_URL
  if (fallbackUrl && fallbackUrl !== attemptedUrl) {
    try {
      process.env.DATABASE_URL = fallbackUrl
      console.log('[Prisma] Retrying client init with POSTGRES_URL fallback')

      const baseClient = new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
      })

      prismaClient = baseClient
      console.log('[Prisma] Client initialized successfully with POSTGRES_URL fallback')
    } catch (fallbackError) {
      console.error('[Prisma] Fallback initialization also failed:', fallbackError)
      prismaClient = new PrismaClient({ log: ['error'] })
    }
  } else {
    // Create a minimal client that will fail gracefully
    prismaClient = new PrismaClient({
      log: ['error'],
    })
  }
}

export const prisma =
  globalForPrisma.prisma ??
  prismaClient

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

export default prisma
