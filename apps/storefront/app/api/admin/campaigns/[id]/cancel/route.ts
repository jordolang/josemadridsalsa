import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { logAuditWithRequest } from '@/lib/audit'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await getCurrentUser()
    if (!user || !(await hasPermission(user, 'content:write'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await prisma.$transaction([
      prisma.emailCampaign.update({
        where: { id },
        data: { status: 'CANCELLED', completedAt: new Date() },
      }),
      prisma.emailRecipient.updateMany({
        where: { campaignId: id, status: { in: ['PENDING', 'SENDING'] } },
        data: { status: 'FAILED', errorMessage: 'Campaign cancelled', failedAt: new Date() },
      }),
    ])

    await logAuditWithRequest(
      {
        userId: user.id,
        action: 'update',
        entityType: 'email_campaign',
        entityId: id,
        changes: { status: { to: 'CANCELLED' } },
      },
      request
    )

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to cancel campaign' }, { status: 500 })
  }
}
