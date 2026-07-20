import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { runCampaignChunkAndContinue } from '@/lib/email/queue'

// Give the post-response worker up to 60s to send a chunk before it hands off.
export const maxDuration = 60
export const dynamic = 'force-dynamic'

/**
 * Internal endpoint that drives a campaign one bounded chunk at a time.
 * Each call processes ~45s of sends after responding, then triggers the next
 * call itself — chaining until the whole list is drained. Secured by CRON_SECRET
 * (same convention as the cron routes); it never handles user auth.
 */
export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let campaignId: string | undefined
  try {
    campaignId = (await request.json())?.campaignId
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }
  if (!campaignId) {
    return NextResponse.json({ error: 'campaignId is required' }, { status: 400 })
  }

  // Do the actual sending after the response returns; Vercel keeps the
  // invocation alive for after() work up to maxDuration.
  after(async () => {
    try {
      await runCampaignChunkAndContinue(campaignId!)
    } catch (err) {
      console.error(`[campaign ${campaignId}] chunk failed:`, err)
    }
  })

  return NextResponse.json({ ok: true, campaignId })
}
