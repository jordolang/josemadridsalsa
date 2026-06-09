import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { processCampaign } from '@/lib/email/queue'

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

    // Start processing asynchronously (don't await)
    processCampaign({ campaignId: id }).catch((err) =>
      console.error(`Campaign ${id} processing error:`, err)
    )

    return NextResponse.json({ success: true, message: 'Campaign sending started' })
  } catch (error) {
    console.error('Send campaign error:', error)
    return NextResponse.json({ error: 'Failed to start campaign' }, { status: 500 })
  }
}
