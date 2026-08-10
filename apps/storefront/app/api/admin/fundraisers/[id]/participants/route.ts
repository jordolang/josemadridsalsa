import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { createChangeSnapshot, logAuditWithRequest } from '@/lib/audit'
import prisma from '@/lib/prisma'

const ParticipantStatusSchema = z.object({
  participantId: z.string(),
  status: z.enum(['ACTIVE', 'INACTIVE']),
})

/**
 * PATCH /api/admin/fundraisers/[id]/participants
 * Update participant status (activate/deactivate)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user || !(await hasPermission(user, 'orders:write'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { id: fundraiserId } = await params
    const body = await req.json()
    const parsed = ParticipantStatusSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 })
    }

    const { participantId, status } = parsed.data

    const participant = await prisma.fundraiserParticipant.findFirst({
      where: { id: participantId, fundraiserId },
    })

    if (!participant) {
      return NextResponse.json({ error: 'Participant not found' }, { status: 404 })
    }

    const updated = await prisma.fundraiserParticipant.update({
      where: { id: participantId },
      data: { status },
    })

    await logAuditWithRequest(
      {
        userId: user.id,
        action: 'update',
        entityType: 'fundraiser_participant',
        entityId: participantId,
        changes: { status: { from: participant.status, to: status }, fundraiserId },
      },
      req
    )

    return NextResponse.json(updated)
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: 'Failed to update participant', details: msg }, { status: 500 })
  }
}
