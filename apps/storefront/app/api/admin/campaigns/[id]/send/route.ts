import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { triggerCampaignContinuation } from '@/lib/email/queue'

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

    const campaign = await prisma.emailCampaign.findUnique({ where: { id } })
    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    if (!['DRAFT', 'PAUSED', 'SCHEDULED'].includes(campaign.status)) {
      return NextResponse.json(
        { error: `Cannot send campaign in ${campaign.status} status` },
        { status: 400 }
      )
    }

    // Recover any recipients left mid-flight by a previously interrupted run.
    await prisma.emailRecipient.updateMany({
      where: { campaignId: id, status: 'SENDING' },
      data: { status: 'PENDING' },
    })
    await prisma.emailCampaign.update({
      where: { id },
      data: { status: 'SENDING', startedAt: campaign.startedAt ?? new Date() },
    })

    // Start the self-continuing send chain (survives serverless freezes).
    await triggerCampaignContinuation(id)

    return NextResponse.json({ success: true, message: 'Campaign sending started' })
  } catch (error) {
    console.error('Send campaign error:', error)
    return NextResponse.json({ error: 'Failed to start campaign' }, { status: 500 })
  }
}
