import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { processCampaign } from '@/lib/email/queue'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const now = new Date()
    const dueCampaigns = await prisma.emailCampaign.findMany({
      where: {
        status: 'SCHEDULED',
        scheduledAt: { lte: now },
      },
      take: 10,
    })

    const results = []
    for (const campaign of dueCampaigns) {
      try {
        processCampaign({ campaignId: campaign.id }).catch(console.error)
        results.push({ campaignId: campaign.id, started: true })
      } catch {
        results.push({ campaignId: campaign.id, started: false })
      }
    }

    return NextResponse.json({ success: true, processed: results.length, results })
  } catch (error) {
    console.error('Campaign cron error:', error)
    return NextResponse.json({ error: 'Cron job failed' }, { status: 500 })
  }
}
