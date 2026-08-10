import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { triggerCampaignContinuation } from '@/lib/email/queue'
import { isAuthorizedCronRequest } from '@/lib/cron/auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// A recipient stuck in SENDING longer than this was orphaned by a dead run.
const STALE_SENDING_MS = 5 * 60 * 1000

/**
 * Safety-net driver for email campaigns. The normal send path is a
 * self-continuing chain kicked off at launch; this cron recovers anything that
 * stalled (a crashed chain, a deploy mid-send) and starts due scheduled sends.
 * Idempotent — safe to run as often as the plan allows.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const now = new Date()

    // 1. Requeue recipients orphaned in SENDING by an interrupted run.
    const staleCutoff = new Date(now.getTime() - STALE_SENDING_MS)
    const sendingCampaigns = await prisma.emailCampaign.findMany({
      where: { status: 'SENDING' },
      select: { id: true },
    })
    const sendingIds = sendingCampaigns.map((c) => c.id)
    const recovered = sendingIds.length
      ? await prisma.emailRecipient.updateMany({
          where: {
            campaignId: { in: sendingIds },
            status: 'SENDING',
            updatedAt: { lt: staleCutoff },
          },
          data: { status: 'PENDING' },
        })
      : { count: 0 }

    // 2. Start any scheduled campaigns that are now due.
    const dueCampaigns = await prisma.emailCampaign.findMany({
      where: { status: 'SCHEDULED', scheduledAt: { lte: now } },
      take: 25,
      select: { id: true, startedAt: true },
    })
    for (const c of dueCampaigns) {
      await prisma.emailCampaign.update({
        where: { id: c.id },
        data: { status: 'SENDING', startedAt: c.startedAt ?? now },
      })
    }

    // 3. Kick the send chain for every campaign that still has work to do
    //    (covers due-now campaigns and any SENDING campaign whose chain died).
    const active = await prisma.emailCampaign.findMany({
      where: {
        status: 'SENDING',
        recipients: { some: { status: { in: ['PENDING', 'SENDING'] } } },
      },
      take: 25,
      select: { id: true },
    })

    for (const c of active) {
      await triggerCampaignContinuation(c.id)
    }

    return NextResponse.json({
      success: true,
      recovered: recovered.count,
      started: dueCampaigns.length,
      driven: active.length,
    })
  } catch (error) {
    console.error('Campaign cron error:', error)
    return NextResponse.json({ error: 'Cron job failed' }, { status: 500 })
  }
}
