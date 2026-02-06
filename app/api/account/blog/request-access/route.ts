import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { ok, fail } from '@/lib/api'

/**
 * GET /api/account/blog/request-access
 * Get the current user's blog access request status
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return fail('Unauthorized', 401)
    }

    const userId = (session.user as any).id as string

    const request = await prisma.blogAccessRequest.findUnique({
      where: { userId },
    })

    return ok({ request })
  } catch (error: any) {
    return fail(error.message, 500)
  }
}

/**
 * POST /api/account/blog/request-access
 * Submit a blog access request
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return fail('Unauthorized', 401)
    }

    const userId = (session.user as any).id as string
    const body = await req.json()
    const { businessName, reason } = body

    // Check if request already exists
    const existing = await prisma.blogAccessRequest.findUnique({
      where: { userId },
    })

    if (existing) {
      return fail('You have already submitted a blog access request', 409)
    }

    const request = await prisma.blogAccessRequest.create({
      data: {
        userId,
        businessName: businessName || null,
        reason: reason || null,
      },
    })

    return ok({ request }, 201)
  } catch (error: any) {
    return fail(error.message, 500)
  }
}
