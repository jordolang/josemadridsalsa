import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser, requirePermission } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'

const DiscountCodeSchema = z.object({
  code: z.string().min(1).max(50).transform(val => val.toUpperCase()),
  description: z.string().optional(),
  type: z.enum(['PERCENTAGE', 'FIXED_AMOUNT']),
  value: z.number().positive(),
  maxUses: z.number().int().positive().optional(),
  maxUsesPerUser: z.number().int().positive().optional(),
  minPurchase: z.number().positive().optional(),
  startsAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),
  isActive: z.boolean().default(true),
})

export async function GET(request: NextRequest) {
  try {
    const hasPermission = await requirePermission('orders:read')

    if (!hasPermission) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const user = await getCurrentUser()

    const searchParams = request.nextUrl.searchParams
    const page = Math.max(parseInt(searchParams.get('page') ?? '1', 10), 1)
    const perPage = Math.min(Math.max(parseInt(searchParams.get('perPage') ?? '20', 10), 1), 100)
    const isActive = searchParams.get('isActive')

    const where: any = {}
    if (isActive !== null) {
      where.isActive = isActive === 'true'
    }

    const [total, codes] = await Promise.all([
      prisma.discountCode.count({ where }),
      prisma.discountCode.findMany({
        where,
        include: {
          _count: {
            select: { usages: true },
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
    ])

    return NextResponse.json({
      data: codes,
      meta: {
        page,
        perPage,
        total,
        totalPages: Math.ceil(total / perPage),
      },
    })
  } catch (error) {
    console.error('Get discount codes error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch discount codes' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const hasPermission = await requirePermission('orders:write')

    if (!hasPermission) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const user = await getCurrentUser()

    const payload = await request.json()
    const parsed = DiscountCodeSchema.safeParse(payload)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid discount code data', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const data = parsed.data

    // Check if code already exists
    const existing = await prisma.discountCode.findUnique({
      where: { code: data.code },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'A discount code with this code already exists' },
        { status: 400 }
      )
    }

    const discountCode = await prisma.discountCode.create({
      data: {
        ...data,
        startsAt: data.startsAt ? new Date(data.startsAt) : null,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        createdById: user?.id,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    await logAudit({
      userId: user?.id || null,
      action: 'CREATE',
      entityType: 'DiscountCode',
      entityId: discountCode.id,
      changes: {
        code: data.code,
        type: data.type,
        value: data.value,
        isActive: data.isActive,
      },
    })

    return NextResponse.json({ data: discountCode }, { status: 201 })
  } catch (error) {
    console.error('Create discount code error:', error)
    return NextResponse.json(
      { error: 'Failed to create discount code' },
      { status: 500 }
    )
  }
}
