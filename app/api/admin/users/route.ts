import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { requirePermission, getCurrentUser, isOwner } from '@/lib/rbac'
import { ok, fail } from '@/lib/api'
import { logAudit } from '@/lib/audit'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { UserRole } from '@prisma/client'

const userSchema = z.object({
  email: z.string().email(),
  name: z.string().nullable().optional(),
  password: z.string().min(8),
  phone: z.string().nullable().optional(),
  role: z.enum(['CUSTOMER', 'WHOLESALE', 'STAFF', 'ADMIN', 'DEVELOPER', 'OWNER']),
  isEmailVerified: z.boolean().optional(),
})

export async function GET(req: NextRequest) {
  try {
    await requirePermission('users:read')

    const { searchParams } = new URL(req.url)
    const page = Number(searchParams.get('page')) || 1
    const take = 50
    const skip = (page - 1) * take
    const search = searchParams.get('search') || ''
    const role = searchParams.get('role') || ''

    const where: any = {}

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (role && role !== 'all') {
      where.role = role
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isEmailVerified: true,
          phone: true,
          createdAt: true,
          lastLoginAt: true,
        },
      }),
      prisma.user.count({ where }),
    ])

    return ok({ users, total })
  } catch (error: any) {
    return fail(error.message, error.status)
  }
}

export async function POST(req: NextRequest) {
  try {
    const currentUser = await requirePermission('users:write')
    const body = await req.json()
    const data = userSchema.parse(body)

    // OWNER role protection: only the current OWNER can create another OWNER
    // and only one OWNER can exist at a time
    if (data.role === 'OWNER') {
      if (!isOwner(currentUser)) {
        return fail('Only the OWNER can assign the OWNER role', 403)
      }

      // Check if an OWNER already exists
      const existingOwner = await prisma.user.findFirst({
        where: { role: UserRole.OWNER },
      })

      if (existingOwner) {
        return fail(
          'An OWNER account already exists. Only one OWNER is allowed. The existing OWNER must transfer ownership.',
          409
        )
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, 10)

    const user = await prisma.user.create({
      data: {
        ...data,
        password: hashedPassword,
      },
    })

    await logAudit({
      userId: currentUser.id,
      action: 'CREATE',
      entityType: 'User',
      entityId: user.id,
      changes: { email: data.email, role: data.role },
    })

    // Don't return password
    const { password, ...userWithoutPassword } = user

    return ok({ user: userWithoutPassword }, 201)
  } catch (error: any) {
    if (error.code === 'P2002') {
      return fail('User with this email already exists', 409)
    }
    return fail(error.message, 400)
  }
}
