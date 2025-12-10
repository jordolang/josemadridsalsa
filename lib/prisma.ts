import { PrismaClient, type Prisma } from '@prisma/client'
import { withAccelerate } from '@prisma/extension-accelerate'

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient
}

const sanitizeUrl = (value?: string | null) => value?.trim()

const resolveDatabaseUrl = () => {
  // Normalize env values (copy/paste into Vercel can leave trailing whitespace/newlines)
  process.env.DATABASE_URL = sanitizeUrl(process.env.DATABASE_URL) || undefined
  process.env.POSTGRES_URL = sanitizeUrl(process.env.POSTGRES_URL) || undefined
  process.env.PRISMA_DATABASE_URL = sanitizeUrl(process.env.PRISMA_DATABASE_URL) || undefined

  if (!process.env.DATABASE_URL) {
    if (process.env.PRISMA_DATABASE_URL) {
      process.env.DATABASE_URL = process.env.PRISMA_DATABASE_URL
      console.log('[Prisma] DATABASE_URL not set, fell back to PRISMA_DATABASE_URL')
    } else if (process.env.POSTGRES_URL) {
      process.env.DATABASE_URL = process.env.POSTGRES_URL
      console.log('[Prisma] DATABASE_URL not set, fell back to POSTGRES_URL')
    }
  }

  return process.env.DATABASE_URL
}

const createPrismaClient = (): PrismaClient => {
  const databaseUrl = resolveDatabaseUrl()
  const logLevels: (Prisma.LogLevel | Prisma.LogDefinition)[] =
    process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error']

  try {
    if (!databaseUrl) {
      console.error('[Prisma] DATABASE_URL is not set. Available env vars:', {
        hasPostgresUrl: !!process.env.POSTGRES_URL,
        hasPrismaUrl: !!process.env.PRISMA_DATABASE_URL,
        hasDatabaseUrl: !!process.env.DATABASE_URL,
      })
      throw new Error('DATABASE_URL is not set - check environment variables')
    }

    const usesAccelerate = databaseUrl.startsWith('prisma://') || databaseUrl.startsWith('prisma+postgres://')

    if (usesAccelerate) {
      const baseClient = new PrismaClient({
        log: logLevels,
      })
      const acceleratedClient = baseClient.$extends(withAccelerate()) as unknown as PrismaClient
      console.log('[Prisma] Client initialized successfully with Accelerate')
      return acceleratedClient
    }

    console.log('[Prisma] Client initialized successfully (direct connection)')
    return new PrismaClient({ log: logLevels })
  } catch (error) {
    console.error('[Prisma] Failed to initialize client:', error)

    const fallbackUrl = process.env.POSTGRES_URL
    const attemptedUrl = process.env.DATABASE_URL

    if (fallbackUrl && fallbackUrl !== attemptedUrl) {
      try {
        console.log('[Prisma] Attempting fallback with POSTGRES_URL')
        return new PrismaClient({
          log: logLevels,
          datasources: { db: { url: fallbackUrl } },
        })
      } catch (fallbackError) {
        console.error('[Prisma] Fallback initialization also failed:', fallbackError)
      }
    }

    // Re-throw the error instead of returning a broken client
    // This will help identify configuration issues early
    throw new Error(`Failed to initialize Prisma Client: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

const prismaClient =
  process.env.NODE_ENV !== 'production'
    ? globalForPrisma.prisma ?? (globalForPrisma.prisma = createPrismaClient())
    : createPrismaClient()

export const prisma: PrismaClient = prismaClient

export default prisma
