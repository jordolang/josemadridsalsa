import { PrismaClient } from '@prisma/client'
import { withAccelerate } from '@prisma/extension-accelerate'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const baseClient = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
})

// Use Accelerate extension only if DATABASE_URL uses the accelerate protocol
const clientWithAccelerate = process.env.DATABASE_URL?.includes('prisma+postgres://')
  ? baseClient.$extends(withAccelerate())
  : baseClient

export const prisma =
  globalForPrisma.prisma ??
  (clientWithAccelerate as unknown as PrismaClient)

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

export default prisma
