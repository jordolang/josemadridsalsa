import { prisma } from '@/lib/prisma'

export async function resolveTemplateOwner(preferredUserId?: string | null) {
  if (preferredUserId) {
    const preferredUser = await prisma.user.findUnique({ where: { id: preferredUserId } })
    if (preferredUser) {
      return preferredUser
    }
  }

  const configuredEmail = process.env.SYSTEM_OWNER_EMAIL
  if (configuredEmail) {
    const configuredUser = await prisma.user.findUnique({ where: { email: configuredEmail } })
    if (configuredUser) {
      return configuredUser
    }
    console.warn(`SYSTEM_OWNER_EMAIL user ${configuredEmail} not found – falling back to first admin.`)
  }

  const fallback = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
    orderBy: { createdAt: 'asc' },
  })

  if (!fallback) {
    throw new Error('Unable to determine fallback form template owner. Create an admin user or set SYSTEM_OWNER_EMAIL.')
  }

  return fallback
}
