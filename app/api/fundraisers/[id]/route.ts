import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { logAudit } from '@/lib/audit'
import prisma from '@/lib/prisma'

const FundraiserUpdateSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  slug: z.string().min(1, 'Slug is required').regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens only').optional(),
  description: z.string().nullable().optional(),
  organizationName: z.string().min(1, 'Organization name is required').optional(),
  contactEmail: z.string().email('Valid email is required').optional(),
  contactPhone: z.string().nullable().optional(),
  startDate: z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid start date').optional(),
  endDate: z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid end date').optional(),
  goal: z.number().nullable().optional(),
  commissionRate: z.number().min(0).max(100, 'Commission rate must be between 0 and 100').optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'ENDED', 'CANCELLED']).optional(),
  isActive: z.boolean().optional(),
  subdomain: z.string().min(3).max(50).regex(/^[a-z0-9-]+$/).nullable().optional(),
  missionStatement: z.string().nullable().optional(),
  bio: z.string().nullable().optional(),
  logoUrl: z.string().url().nullable().optional(),
  coverPhotoUrl: z.string().url().nullable().optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const fundraiser = await prisma.fundraiser.findUnique({
      where: { id },
      include: {
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
  } catch (error: any) {
    console.error('Error fetching fundraiser:', error)
    return NextResponse.json(
      { error: 'Failed to fetch fundraiser', details: error.message },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()

    if (!user || !(await hasPermission(user, 'orders:write'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { id } = await params
    const payload = await request.json()
    const parsed = FundraiserUpdateSchema.safeParse(payload)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid fundraiser data', details: parsed.error.issues },
        { status: 400 }
      )
    }

    const data = parsed.data

    // Check if fundraiser exists
    const existing = await prisma.fundraiser.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Fundraiser not found' }, { status: 404 })
    }

    // Check for duplicate slug if slug is being updated
    if (data.slug && data.slug !== existing.slug) {
      const slugExists = await prisma.fundraiser.findUnique({
        where: { slug: data.slug },
      })

      if (slugExists) {
        return NextResponse.json(
          { error: 'A fundraiser with this slug already exists' },
          { status: 400 }
        )
      }
    }

    // Validate dates if both are provided
    if (data.startDate && data.endDate) {
      const startDate = new Date(data.startDate)
      const endDate = new Date(data.endDate)

      if (endDate <= startDate) {
        return NextResponse.json(
          { error: 'End date must be after start date' },
          { status: 400 }
        )
      }
    }

    // Build update data
    const updateData: any = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.slug !== undefined) updateData.slug = data.slug
    if (data.description !== undefined) updateData.description = data.description
    if (data.organizationName !== undefined) updateData.organizationName = data.organizationName
    if (data.contactEmail !== undefined) updateData.contactEmail = data.contactEmail
    if (data.contactPhone !== undefined) updateData.contactPhone = data.contactPhone
    if (data.startDate !== undefined) updateData.startDate = new Date(data.startDate)
    if (data.endDate !== undefined) updateData.endDate = new Date(data.endDate)
    if (data.goal !== undefined) updateData.goal = data.goal
    if (data.commissionRate !== undefined) updateData.commissionRate = data.commissionRate
    if (data.status !== undefined) updateData.status = data.status
    if (data.isActive !== undefined) updateData.isActive = data.isActive
    if (data.subdomain !== undefined) updateData.subdomain = data.subdomain
    if (data.missionStatement !== undefined) updateData.missionStatement = data.missionStatement
    if (data.bio !== undefined) updateData.bio = data.bio
    if (data.logoUrl !== undefined) updateData.logoUrl = data.logoUrl
    if (data.coverPhotoUrl !== undefined) updateData.coverPhotoUrl = data.coverPhotoUrl

    // Check subdomain uniqueness if changed
    if (data.subdomain && data.subdomain !== existing.subdomain) {
      const subdomainExists = await prisma.fundraiser.findUnique({
        where: { subdomain: data.subdomain },
      })
      if (subdomainExists) {
        return NextResponse.json(
          { error: 'A fundraiser with this subdomain already exists' },
          { status: 400 }
        )
      }
    }

    // Update fundraiser
    const fundraiser = await prisma.fundraiser.update({
      where: { id },
      data: updateData,
    })

    // Audit log
    await logAudit({
      userId: user.id,
      action: 'UPDATE',
      entityType: 'Fundraiser',
      entityId: fundraiser.id,
      changes: updateData,
    })

    return NextResponse.json(fundraiser)
  } catch (error: any) {
    console.error('Error updating fundraiser:', error)
    return NextResponse.json(
      { error: 'Failed to update fundraiser', details: error.message },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()

    if (!user || !(await hasPermission(user, 'orders:write'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { id } = await params

    // Check if fundraiser exists
    const existing = await prisma.fundraiser.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            orders: true,
            participants: true,
          },
        },
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Fundraiser not found' }, { status: 404 })
    }

    // Don't allow deletion if there are orders or participants
    if (existing._count.orders > 0 || existing._count.participants > 0) {
      return NextResponse.json(
        { error: 'Cannot delete fundraiser with existing orders or participants. Set to CANCELLED instead.' },
        { status: 400 }
      )
    }

    // Delete fundraiser
    await prisma.fundraiser.delete({
      where: { id },
    })

    // Audit log
    await logAudit({
      userId: user.id,
      action: 'DELETE',
      entityType: 'Fundraiser',
      entityId: id,
      changes: {
        name: existing.name,
        slug: existing.slug,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting fundraiser:', error)
    return NextResponse.json(
      { error: 'Failed to delete fundraiser', details: error.message },
      { status: 500 }
    )
  }
}
