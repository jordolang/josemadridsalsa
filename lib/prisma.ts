import { PrismaClient } from '@prisma/client'
import { withAccelerate } from '@prisma/extension-accelerate'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

let prismaClient: PrismaClient | null = null

try {
  // Support both Prisma Accelerate and direct Postgres URLs
  const usesAccelerate = Boolean(
    process.env.DATABASE_URL?.startsWith('prisma://') ||
    process.env.DATABASE_URL?.startsWith('prisma+postgres://')
  )

  const baseClient = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

  prismaClient = usesAccelerate
    ? (baseClient.$extends(withAccelerate()) as unknown as PrismaClient)
    : baseClient
    
  console.log('[Prisma] Client initialized successfully')
} catch (error) {
  console.error('[Prisma] Failed to initialize client:', error)
  // Create a minimal client that will fail gracefully
  prismaClient = new PrismaClient({
    log: ['error'],
  })
}

export const prisma =
  globalForPrisma.prisma ??
  prismaClient

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

export default prisma
