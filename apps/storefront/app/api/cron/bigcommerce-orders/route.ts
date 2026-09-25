import { NextResponse } from 'next/server'
import { isAuthorizedCronRequest } from '@/lib/cron/auth'
import { isBigCommerceStorefrontEnabled } from '@/lib/bigcommerce/storefront'
import { syncBigCommerceOrders } from '@/lib/bigcommerce/orders'

/**
 * GET /api/cron/bigcommerce-orders
 *
 * Re-copies every BigCommerce order changed in the last three days, so an order
 * whose webhook was missed or failed still reaches this site's order table.
 * Mirroring is idempotent, so overlapping with the webhook is harmless.
 */

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const LOOKBACK_MS = 3 * 24 * 60 * 60 * 1000

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!isBigCommerceStorefrontEnabled()) {
    return NextResponse.json({ skipped: 'The storefront does not sell through BigCommerce' })
  }

  try {
    const tally = await syncBigCommerceOrders(new Date(Date.now() - LOOKBACK_MS))
    return NextResponse.json(tally)
  } catch (error) {
    console.error('[cron/bigcommerce-orders]', error)
    return NextResponse.json({ error: 'BigCommerce order sync failed' }, { status: 500 })
  }
}
