import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { logAuditWithRequest } from '@/lib/audit'
import { getAppSettings, revokeSellerDevices } from '@/lib/fundraiser-app/admin'
import { FundraiserAppError } from '@/lib/fundraiser-app/errors'
import { clearSellerPin } from '@/lib/fundraiser-app/organizer'

const SellerActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('reset-pin') }),
  z.object({ action: z.literal('sign-out'), sessionId: z.string().min(1).max(64).optional() }),
])

/** Reset a seller's PIN (the organizer's included) or sign their phones out. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; participantId: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user || !(await hasPermission(user, 'orders:write'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    const { id, participantId } = await params
    const parsed = SellerActionSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 })
    }

    if (parsed.data.action === 'reset-pin') {
      await clearSellerPin(id, participantId)
    } else {
      await revokeSellerDevices(id, participantId, parsed.data.sessionId)
    }

    await logAuditWithRequest(
      {
        userId: user.id,
        action: 'update',
        entityType: 'fundraiser_participant',
        entityId: participantId,
        changes: { mobileApp: parsed.data, fundraiserId: id },
      },
      req
    )
    return NextResponse.json(await getAppSettings(id))
  } catch (error) {
    if (error instanceof FundraiserAppError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('[Admin fundraiser app] Seller action failed:', error)
    return NextResponse.json({ error: 'Seller action failed' }, { status: 500 })
  }
}
