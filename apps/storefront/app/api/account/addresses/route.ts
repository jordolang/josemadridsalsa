import { NextRequest } from 'next/server'
import { ok, fail, unauthorized, serverError } from '@/lib/api'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const createAddressSchema = z.object({
  type: z.enum(['SHIPPING', 'BILLING', 'BOTH']).default('SHIPPING'),
  firstName: z.string().trim().min(1, 'First name is required').max(100),
  lastName: z.string().trim().min(1, 'Last name is required').max(100),
  company: z.string().trim().max(200).optional(),
  street: z.string().trim().min(1, 'Street is required').max(300),
  city: z.string().trim().min(1, 'City is required').max(100),
  state: z.string().trim().min(1, 'State is required').max(100),
  zipCode: z.string().trim().min(1, 'Zip code is required').max(20),
  country: z.string().trim().max(2).default('US'),
  phone: z.string().trim().max(30).optional(),
  isDefault: z.boolean().default(false),
})

/**
 * GET /api/account/addresses
 * Authenticated endpoint — list the current user's addresses.
 */
export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return unauthorized()
    }

    const userId = (session.user as { id: string }).id

    const addresses = await prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    })

    return ok(addresses)
  } catch (error: unknown) {
    return serverError('Failed to fetch addresses', error)
  }
}

/**
 * POST /api/account/addresses
 * Authenticated endpoint — create a new address for the current user.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return unauthorized()
    }

    const userId = (session.user as { id: string }).id

    const body = await req.json()
    const parsed = createAddressSchema.safeParse(body)

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]
      return fail(`Validation error: ${firstError.message}`)
    }

    const { isDefault, ...addressData } = parsed.data

    // If this address should be default, unset other defaults of same type
    if (isDefault) {
      await prisma.address.updateMany({
        where: { userId, type: addressData.type, isDefault: true },
        data: { isDefault: false },
      })
    }

    const address = await prisma.address.create({
      data: {
        ...addressData,
        userId,
        isDefault,
      },
    })

    return ok(address, 201)
  } catch (error: unknown) {
    return serverError('Failed to create address', error)
  }
}
