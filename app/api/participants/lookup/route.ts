import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/rbac'
import { logAudit } from '@/lib/audit'

const LookupQuerySchema = z.object({
  code: z.string().min(1, 'Referral code is required'),
})

/**
 * GET /api/participants/lookup?code=XXX
 * Look up a fundraiser participant by their referral code
 */
export async function GET(request: NextRequest) {
  try {
    // Optional authentication - track user if logged in
    const user = await getCurrentUser()

    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')

    const parsed = LookupQuerySchema.safeParse({ code })

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid referral code.', details: parsed.error.issues },
        { status: 400 }
      )
    }

    const referralCode = parsed.data.code.trim().toUpperCase()

    // Look up participant by referral code with related fundraiser
    const participant = await prisma.fundraiserParticipant.findUnique({
      where: { referralCode },
      include: {
        fundraiser: {
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            organizationName: true,
            startDate: true,
            endDate: true,
            goal: true,
            commissionRate: true,
            status: true,
            isActive: true,
          },
        },
      },
    })

    if (!participant) {
      return NextResponse.json(
        { error: 'Participant not found with this referral code.' },
        { status: 404 }
      )
    }

    // Check if participant is active
    if (participant.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'This participant is no longer active.' },
        { status: 403 }
      )
    }

    // Check if fundraiser is active
    if (!participant.fundraiser.isActive) {
      return NextResponse.json(
        { error: 'This fundraiser is no longer active.' },
        { status: 403 }
      )
    }

    // Audit log the lookup
    await logAudit({
      userId: user?.id || null,
      action: 'READ',
      entityType: 'FundraiserParticipant',
      entityId: participant.id,
      changes: {
        referralCode,
        fundraiserId: participant.fundraiserId,
        isAuthenticated: !!user,
      },
    })

    return NextResponse.json({ participant })
  } catch (error) {
    console.error('Error looking up participant:', error)
    return NextResponse.json(
      { error: 'Unable to lookup participant. Please try again.' },
      { status: 500 }
    )
  }
}
