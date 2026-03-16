import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/rbac'
import { logAudit } from '@/lib/audit'
import { sendParticipantWelcomeEmail } from '@/lib/email/automation'

const ParticipantSchema = z.object({
  name: z.string().min(2, 'Participant name is required'),
  email: z.string().email('Valid email is required'),
  phone: z.string().optional(),
})

/**
 * Generates a unique fundraiser participant referral code
 * Format: FR-XXXX-XXXX (8 alphanumeric characters)
 */
function generateReferralCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const randomPart1 = Array.from({ length: 4 }, () =>
    chars.charAt(Math.floor(Math.random() * chars.length))
  ).join('')
  const randomPart2 = Array.from({ length: 4 }, () =>
    chars.charAt(Math.floor(Math.random() * chars.length))
  ).join('')
  return `FR-${randomPart1}-${randomPart2}`
}

/**
 * Generates a unique referral code that doesn't exist in the database
 */
async function generateUniqueReferralCode(): Promise<string> {
  let attempts = 0
  const maxAttempts = 10

  while (attempts < maxAttempts) {
    const code = generateReferralCode()
    const existing = await prisma.fundraiserParticipant.findUnique({
      where: { referralCode: code },
    })

    if (!existing) {
      return code
    }

    attempts++
  }

  // Fallback: add timestamp to ensure uniqueness
  const timestamp = Date.now().toString(36).toUpperCase().slice(-4)
  return `FR-${timestamp}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`
}

/**
 * GET /api/fundraisers/[id]/participants
 * List all participants for a fundraiser
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: fundraiserId } = await context.params

    // Verify fundraiser exists
    const fundraiser = await prisma.fundraiser.findUnique({
      where: { id: fundraiserId },
    })

    if (!fundraiser) {
      return NextResponse.json({ error: 'Fundraiser not found' }, { status: 404 })
    }

    // Get all participants for this fundraiser
    const participants = await prisma.fundraiserParticipant.findMany({
      where: { fundraiserId },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ participants })
  } catch (error) {
    console.error('Error fetching participants:', error)
    return NextResponse.json(
      { error: 'Unable to fetch participants. Please try again.' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/fundraisers/[id]/participants
 * Create a new participant for a fundraiser
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Optional authentication - track user if logged in
    const user = await getCurrentUser()

    const { id: fundraiserId } = await context.params

    // Verify fundraiser exists
    const fundraiser = await prisma.fundraiser.findUnique({
      where: { id: fundraiserId },
    })

    if (!fundraiser) {
      return NextResponse.json({ error: 'Fundraiser not found' }, { status: 404 })
    }

    const payload = await request.json()
    const parsed = ParticipantSchema.safeParse(payload)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid participant data.', details: parsed.error.issues },
        { status: 400 }
      )
    }

    const data = parsed.data
    const normalizedEmail = data.email.trim().toLowerCase()

    // Check if participant with this email already exists for this fundraiser
    const existingParticipant = await prisma.fundraiserParticipant.findFirst({
      where: {
        fundraiserId,
        email: normalizedEmail,
      },
    })

    if (existingParticipant) {
      return NextResponse.json(
        { error: 'A participant with this email already exists for this fundraiser.' },
        { status: 409 }
      )
    }

    // Generate unique referral code
    const referralCode = await generateUniqueReferralCode()

    // Create participant
    const participant = await prisma.fundraiserParticipant.create({
      data: {
        fundraiserId,
        name: data.name,
        email: normalizedEmail,
        phone: data.phone,
        referralCode,
        status: 'ACTIVE',
      },
    })

    // Audit log the participant creation
    await logAudit({
      userId: user?.id || null,
      action: 'CREATE',
      entityType: 'FundraiserParticipant',
      entityId: participant.id,
      changes: {
        fundraiserId,
        name: data.name,
        email: normalizedEmail,
        phone: data.phone,
        referralCode,
        isAuthenticated: !!user,
      },
    })

    // Send welcome email to participant
    try {
      await sendParticipantWelcomeEmail({
        email: normalizedEmail,
        participantName: data.name,
        fundraiserName: fundraiser.name,
        referralCode,
        fundraiserId,
      })
    } catch (emailError) {
      // Log email error but don't fail the participant creation
      console.error('[ParticipantAPI] Failed to send welcome email:', emailError)
    }

    return NextResponse.json({ participant }, { status: 201 })
  } catch (error) {
    console.error('Error creating participant:', error)
    return NextResponse.json(
      { error: 'Unable to create participant. Please try again.' },
      { status: 500 }
    )
  }
}
