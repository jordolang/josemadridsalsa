import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { logAudit } from '@/lib/audit'
import prisma from '@/lib/prisma'

const FundraiserCreateSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  slug: z.string().min(1, 'Slug is required').regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens only'),
  description: z.string().nullable().optional(),
  organizationName: z.string().min(1, 'Organization name is required'),
  contactEmail: z.string().email('Valid email is required'),
  contactPhone: z.string().nullable().optional(),
  startDate: z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid start date'),
  endDate: z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid end date'),
  goal: z.number().nullable().optional(),
  commissionRate: z.number().min(0).max(100, 'Commission rate must be between 0 and 100'),
  status: z.enum(['DRAFT', 'ACTIVE', 'ENDED', 'CANCELLED']),
  isActive: z.boolean(),
})

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()

    if (!user || !(await hasPermission(user, 'orders:write'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const payload = await request.json()
    const parsed = FundraiserCreateSchema.safeParse(payload)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid fundraiser data', details: parsed.error.issues },
        { status: 400 }
      )
    }

    const data = parsed.data

    // Check for duplicate slug
    const existing = await prisma.fundraiser.findUnique({
      where: { slug: data.slug },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'A fundraiser with this slug already exists' },
        { status: 400 }
      )
    }

    // Validate dates
    const startDate = new Date(data.startDate)
    const endDate = new Date(data.endDate)

    if (endDate <= startDate) {
      return NextResponse.json(
        { error: 'End date must be after start date' },
        { status: 400 }
      )
    }

    // Create fundraiser
    const fundraiser = await prisma.fundraiser.create({
      data: {
        name: data.name,
        slug: data.slug,
        description: data.description || null,
        organizationName: data.organizationName,
        contactEmail: data.contactEmail,
        contactPhone: data.contactPhone || null,
        startDate,
        endDate,
        goal: data.goal || null,
        commissionRate: data.commissionRate,
        status: data.status,
        isActive: data.isActive,
      },
    })

    // Audit log
    await logAudit({
      userId: user.id,
      action: 'CREATE',
      entityType: 'Fundraiser',
      entityId: fundraiser.id,
      changes: {
        name: fundraiser.name,
        slug: fundraiser.slug,
        organizationName: fundraiser.organizationName,
        status: fundraiser.status,
      },
    })

    return NextResponse.json(fundraiser, { status: 201 })
  } catch (error: any) {
    console.error('Error creating fundraiser:', error)
    return NextResponse.json(
      { error: 'Failed to create fundraiser', details: error.message },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const fundraisers = await prisma.fundraiser.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        name: 'asc'
      }
    })

    return NextResponse.json(fundraisers)
  } catch (error: any) {
    console.error('Error fetching fundraisers:', error)
    return NextResponse.json(
      { error: 'Failed to fetch fundraisers' },
      { status: 500 }
    )
  }
}
