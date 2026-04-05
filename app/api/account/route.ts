import { NextRequest } from 'next/server'
import { ok, unauthorized, serverError } from '@/lib/api'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/account
 * Authenticated endpoint — fetch the current user's profile.
 */
export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return unauthorized()
    }

    const userId = (session.user as { id: string }).id

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        createdAt: true,
        lastLoginAt: true,
      },
    })

    if (!user) {
      return unauthorized('User not found')
    }

    return ok(user)
  } catch (error: unknown) {
    return serverError('Failed to fetch account', error)
  }
}
