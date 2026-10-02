import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { createChangeSnapshot, logAuditWithRequest } from '@/lib/audit'
import prisma from '@/lib/prisma'

const FundraiserUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  organizationName: z.string().min(1).optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().nullable().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  goal: z.number().nullable().optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'ENDED', 'CANCELLED']).optional(),
  isActive: z.boolean().optional(),
  subdomain: z.string().min(3).max(50).regex(/^[a-z0-9-]+$/).nullable().optional(),
  logoUrl: z.string().nullable().optional(),
  coverPhotoUrl: z.string().nullable().optional(),
  missionStatement: z.string().nullable().optional(),
  bio: z.string().nullable().optional(),
  pageConfig: z.record(z.string(), z.unknown()).nullable().optional(),
  commissionRate: z.number().min(0).max(100).optional(),
  // What this fundraiser's store charges per jar absent a per-product price.
  defaultUnitPrice: z.number().min(0).optional(),
  thankYouHeadline: z.string().max(120).nullable().optional(),
  thankYouMessage: z.string().max(2000).nullable().optional(),
  thankYouImageUrl: z.string().nullable().optional(),
  thankYouCtaLabel: z.string().max(60).nullable().optional(),
  thankYouCtaUrl: z.string().nullable().optional(),
  // How the group runs its drive, and the terms that follow from it.
  fulfillmentMethod: z.enum(['ORDER_FORMS_AND_BULK', 'ONLINE_ONLY']).optional(),
  brochureOption: z.enum(['PRINT_YOUR_OWN', 'PROFESSIONAL_100']).nullable().optional(),
  brochureFee: z.number().min(0).nullable().optional(),
  bulkDeliveryFee: z.number().min(0).nullable().optional(),
  resaleNumber: z.string().max(60).nullable().optional(),
})

/**
 * GET /api/admin/fundraisers/[id]
 * Fetch full fundraiser with products, participants, and recent orders
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user || !(await hasPermission(user, 'orders:read'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { id } = await params

    const fundraiser = await prisma.fundraiser.findUnique({
      where: { id },
      include: {
        products: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                price: true,
                featuredImage: true,
                isActive: true,
              },
            },
          },
        },
        participants: {
          orderBy: { totalRevenue: 'desc' },
        },
        orders: {
          orderBy: { createdAt: 'desc' },
          take: 50,
          select: {
            id: true,
            orderNumber: true,
            status: true,
            total: true,
            createdAt: true,
            participant: {
              select: { name: true },
            },
          },
        },
        _count: {
          select: {
            orders: true,
            products: true,
            participants: true,
          },
        },
      },
    })

    if (!fundraiser) {
      return NextResponse.json({ error: 'Fundraiser not found' }, { status: 404 })
    }

    return NextResponse.json(fundraiser)
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: 'Failed to fetch fundraiser', details: msg }, { status: 500 })
  }
}

/**
 * PUT /api/admin/fundraisers/[id]
 * Update fundraiser fields
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user || !(await hasPermission(user, 'orders:write'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { id } = await params
    const body = await req.json()
    const parsed = FundraiserUpdateSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 })
    }

    const existing = await prisma.fundraiser.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Fundraiser not found' }, { status: 404 })
    }

    const data = parsed.data
    const updateData: Record<string, unknown> = {}

    if (data.name !== undefined) updateData.name = data.name
    if (data.organizationName !== undefined) updateData.organizationName = data.organizationName
    if (data.contactEmail !== undefined) updateData.contactEmail = data.contactEmail
    if (data.contactPhone !== undefined) updateData.contactPhone = data.contactPhone
    if (data.startDate !== undefined) updateData.startDate = new Date(data.startDate)
    if (data.endDate !== undefined) updateData.endDate = new Date(data.endDate)
    if (data.goal !== undefined) updateData.goal = data.goal
    if (data.status !== undefined) updateData.status = data.status
    if (data.isActive !== undefined) updateData.isActive = data.isActive
    if (data.commissionRate !== undefined) updateData.commissionRate = data.commissionRate
    if (data.subdomain !== undefined) updateData.subdomain = data.subdomain
    if (data.logoUrl !== undefined) updateData.logoUrl = data.logoUrl
    if (data.coverPhotoUrl !== undefined) updateData.coverPhotoUrl = data.coverPhotoUrl
    if (data.missionStatement !== undefined) updateData.missionStatement = data.missionStatement
    if (data.bio !== undefined) updateData.bio = data.bio
    if (data.pageConfig !== undefined) updateData.pageConfig = data.pageConfig
    if (data.defaultUnitPrice !== undefined) updateData.defaultUnitPrice = data.defaultUnitPrice
    if (data.fulfillmentMethod !== undefined) updateData.fulfillmentMethod = data.fulfillmentMethod
    if (data.brochureOption !== undefined) updateData.brochureOption = data.brochureOption
    if (data.brochureFee !== undefined) updateData.brochureFee = data.brochureFee
    if (data.bulkDeliveryFee !== undefined) updateData.bulkDeliveryFee = data.bulkDeliveryFee
    if (data.resaleNumber !== undefined) {
      updateData.resaleNumber = data.resaleNumber || null
      // A changed certificate is an unverified certificate: whoever checked the last one did
      // not check this one.
      if ((data.resaleNumber || null) !== existing.resaleNumber) updateData.resaleVerifiedAt = null
    }
    for (const field of [
      'thankYouHeadline',
      'thankYouMessage',
      'thankYouImageUrl',
      'thankYouCtaLabel',
      'thankYouCtaUrl',
    ] as const) {
      // Blank means "use the standard wording" — see `lib/fundraising/thank-you.ts`.
      if (data[field] !== undefined) updateData[field] = data[field] || null
    }

    // Subdomain uniqueness check
    if (data.subdomain && data.subdomain !== existing.subdomain) {
      const conflict = await prisma.fundraiser.findUnique({ where: { subdomain: data.subdomain } })
      if (conflict) {
        return NextResponse.json({ error: 'Subdomain already taken' }, { status: 409 })
      }
    }

    const updated = await prisma.fundraiser.update({ where: { id }, data: updateData })

    await logAuditWithRequest(
      {
        userId: user.id,
        action: 'update',
        entityType: 'fundraiser',
        entityId: id,
        changes: createChangeSnapshot(existing, updateData),
      },
      req
    )

    return NextResponse.json(updated)
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: 'Failed to update fundraiser', details: msg }, { status: 500 })
  }
}

// Every field is optional, so PUT already behaves as a partial update; PATCH is the same handler.
export const PATCH = PUT
