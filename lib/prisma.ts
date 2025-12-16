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
      console.warn('[Prisma] DATABASE_URL is not set. Available env vars:', {
        hasPostgresUrl: !!process.env.POSTGRES_URL,
        hasPrismaUrl: !!process.env.PRISMA_DATABASE_URL,
        hasDatabaseUrl: !!process.env.DATABASE_URL,
      })
      // During build time, return a client without datasource override
      // It will fail at runtime if actually used, but allows build to succeed
      console.warn('[Prisma] Creating client without DATABASE_URL (will fail at runtime if used)')
      return new PrismaClient({ log: ['error'] })
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

    // Return a basic client for build time - it will fail at runtime if used without proper config
    console.warn('[Prisma] Returning basic client (will fail at runtime if DATABASE_URL not set)')
    return new PrismaClient({ log: ['error'] })
  }
}

// Lazy initialization: create client on first use, not at module load time
// This ensures DATABASE_URL is available from Vercel runtime environment
function getPrismaClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    console.log('[Prisma] Creating client on first use')
    globalForPrisma.prisma = createPrismaClient()
  }
  return globalForPrisma.prisma
}

// Export a Proxy that lazily creates the client on first property access
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(target, prop) {
    const client = getPrismaClient()
    const value = (client as any)[prop]
    return typeof value === 'function' ? value.bind(client) : value
  }
})

export default prisma
