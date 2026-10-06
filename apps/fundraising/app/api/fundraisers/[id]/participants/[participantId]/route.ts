import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/rbac'
import { logAudit } from '@/lib/audit'

const UpdateParticipantSchema = z.object({
  name: z.string().min(2, 'Participant name is required').optional(),
  email: z.string().email('Valid email is required').optional(),
  phone: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
})

/**
 * GET /api/fundraisers/[id]/participants/[participantId]
 * Get individual participant details with sales stats
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string; participantId: string }> }
) {
  try {
    const { id: fundraiserId, participantId } = await context.params

    // Verify fundraiser exists
    const fundraiser = await prisma.fundraiser.findUnique({
      where: { id: fundraiserId },
    })

    if (!fundraiser) {
      return NextResponse.json({ error: 'Fundraiser not found' }, { status: 404 })
    }

    // Get participant with sales stats
    const participant = await prisma.fundraiserParticipant.findFirst({
      where: {
        id: participantId,
        fundraiserId,
      },
      include: {
        orders: {
          select: {
            id: true,
            orderNumber: true,
            total: true,
            status: true,
            createdAt: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    })

    if (!participant) {
      return NextResponse.json({ error: 'Participant not found' }, { status: 404 })
    }

    // Calculate sales stats
    const stats = {
      totalOrders: participant.totalOrders,
      totalRevenue: participant.totalRevenue.toNumber(),
      totalCommission: participant.totalCommission.toNumber(),
      averageOrderValue: participant.totalOrders > 0
        ? (participant.totalRevenue.toNumber() / participant.totalOrders)
        : 0,
    }

    return NextResponse.json({
      participant: {
        id: participant.id,
        fundraiserId: participant.fundraiserId,
        name: participant.name,
        email: participant.email,
        phone: participant.phone,
        referralCode: participant.referralCode,
        status: participant.status,
        createdAt: participant.createdAt,
        updatedAt: participant.updatedAt,
        stats,
        orders: participant.orders,
      },
    })
  } catch (error) {
    console.error('Error fetching participant:', error)
    return NextResponse.json(
      { error: 'Unable to fetch participant details. Please try again.' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/fundraisers/[id]/participants/[participantId]
 * Update participant information
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; participantId: string }> }
) {
  try {
    // Optional authentication - track user if logged in
    const user = await getCurrentUser()

    const { id: fundraiserId, participantId } = await context.params

    // Verify fundraiser exists
    const fundraiser = await prisma.fundraiser.findUnique({
      where: { id: fundraiserId },
    })

    if (!fundraiser) {
      return NextResponse.json({ error: 'Fundraiser not found' }, { status: 404 })
    }

    // Verify participant exists and belongs to this fundraiser
    const existingParticipant = await prisma.fundraiserParticipant.findFirst({
      where: {
        id: participantId,
        fundraiserId,
      },
    })

    if (!existingParticipant) {
      return NextResponse.json({ error: 'Participant not found' }, { status: 404 })
    }

    const payload = await request.json()
    const parsed = UpdateParticipantSchema.safeParse(payload)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid participant data.', details: parsed.error.issues },
        { status: 400 }
      )
    }

    const data = parsed.data

    // If email is being updated, normalize it and check for duplicates
    if (data.email) {
      const normalizedEmail = data.email.trim().toLowerCase()

      // Check if another participant with this email exists for this fundraiser
      const duplicate = await prisma.fundraiserParticipant.findFirst({
        where: {
          fundraiserId,
          email: normalizedEmail,
          id: { not: participantId }, // Exclude current participant
        },
      })

      if (duplicate) {
        return NextResponse.json(
          { error: 'A participant with this email already exists for this fundraiser.' },
          { status: 409 }
        )
      }

      data.email = normalizedEmail
    }

    // Update participant
    const participant = await prisma.fundraiserParticipant.update({
      where: { id: participantId },
      data,
    })

    // Audit log the update
    await logAudit({
      userId: user?.id || null,
      action: 'UPDATE',
      entityType: 'FundraiserParticipant',
      entityId: participant.id,
      changes: {
        ...data,
        isAuthenticated: !!user,
      },
    })

    return NextResponse.json({ participant })
  } catch (error) {
    console.error('Error updating participant:', error)
    return NextResponse.json(
      { error: 'Unable to update participant. Please try again.' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/fundraisers/[id]/participants/[participantId]
 * Delete a participant (soft delete by setting status to INACTIVE)
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string; participantId: string }> }
) {
  try {
    // Optional authentication - track user if logged in
    const user = await getCurrentUser()

    const { id: fundraiserId, participantId } = await context.params

    // Verify fundraiser exists
    const fundraiser = await prisma.fundraiser.findUnique({
      where: { id: fundraiserId },
    })

    if (!fundraiser) {
      return NextResponse.json({ error: 'Fundraiser not found' }, { status: 404 })
    }

    // Verify participant exists and belongs to this fundraiser
    const existingParticipant = await prisma.fundraiserParticipant.findFirst({
      where: {
        id: participantId,
        fundraiserId,
      },
      include: {
        _count: {
          select: { orders: true },
        },
      },
    })

    if (!existingParticipant) {
      return NextResponse.json({ error: 'Participant not found' }, { status: 404 })
    }

    // If participant has orders, soft delete by setting status to INACTIVE
    // Otherwise, hard delete the record
    if (existingParticipant._count.orders > 0) {
      await prisma.fundraiserParticipant.update({
        where: { id: participantId },
        data: { status: 'INACTIVE' },
      })

      await logAudit({
        userId: user?.id || null,
        action: 'UPDATE',
        entityType: 'FundraiserParticipant',
        entityId: participantId,
        changes: {
          status: 'INACTIVE',
          reason: 'Soft delete - participant has orders',
          isAuthenticated: !!user,
        },
      })

      return NextResponse.json({
        message: 'Participant deactivated successfully',
        softDelete: true,
      })
    } else {
      await prisma.fundraiserParticipant.delete({
        where: { id: participantId },
      })

      await logAudit({
        userId: user?.id || null,
        action: 'DELETE',
        entityType: 'FundraiserParticipant',
        entityId: participantId,
        changes: {
          name: existingParticipant.name,
          email: existingParticipant.email,
          isAuthenticated: !!user,
        },
      })

      return NextResponse.json({
        message: 'Participant deleted successfully',
        softDelete: false,
      })
    }
  } catch (error) {
    console.error('Error deleting participant:', error)
    return NextResponse.json(
      { error: 'Unable to delete participant. Please try again.' },
      { status: 500 }
    )
  }
}
