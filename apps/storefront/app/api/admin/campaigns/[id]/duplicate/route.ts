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

    const original = await prisma.emailCampaign.findUnique({ where: { id } })
    if (!original) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

    const duplicate = await prisma.emailCampaign.create({
      data: {
        name: `${original.name} (Copy)`,
        templateId: original.templateId,
        subject: original.subject,
        status: 'DRAFT',
        listId: original.listId,
        totalRecipients: 0,
        notes: original.notes,
        createdById: user.id,
        trackOpens: original.trackOpens,
        trackClicks: original.trackClicks,
      },
    })

    await logAuditWithRequest(
      {
        userId: user.id,
        action: 'create',
        entityType: 'email_campaign',
        entityId: duplicate.id,
        changes: { duplicatedFrom: id, name: duplicate.name },
      },
      request
    )

    return NextResponse.json({ success: true, campaignId: duplicate.id })
  } catch {
    return NextResponse.json({ error: 'Failed to duplicate campaign' }, { status: 500 })
  }
}
