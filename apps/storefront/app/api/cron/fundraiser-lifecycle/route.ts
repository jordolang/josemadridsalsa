import { NextResponse } from 'next/server'

import { isAuthorizedCronRequest } from '@/lib/cron/auth'
import { runFundraiserLifecycle } from '@/lib/fundraising/lifecycle'
import { syncSiteFundraisersToStore } from '@/lib/bigcommerce/fundraising-store-listing'

/**
 * GET /api/cron/fundraiser-lifecycle
 *
 * Announces campaigns that have opened, closes campaigns whose end date has passed, and sends
 * the closing summary, then makes sure live campaigns are listed in the BigCommerce fundraising
 * store's checkout dropdown too (`syncSiteFundraisersToStore`). Daily is the right cadence: both ends of a campaign are dated, not
 * timed, and a coordinator does not need to hear at 3am that their fundraiser opened.
 *
 * Idempotent through sent-markers on the campaign, so re-running it sends nothing twice.
 */

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runFundraiserLifecycle()
    // A store that cannot be reached must not fail the coordinator emails above.
    const storeListing = await syncSiteFundraisersToStore().catch((error: unknown) => {
      console.error('Fundraiser store listing failed:', error)
      return null
    })
    return NextResponse.json({ success: true, ...result, storeListing })
  } catch (error) {
    console.error('Fundraiser lifecycle cron error:', error)
    return NextResponse.json({ error: 'Cron failed' }, { status: 500 })
  }
}
