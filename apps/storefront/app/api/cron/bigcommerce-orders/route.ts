import { NextResponse } from 'next/server'
import { isAuthorizedCronRequest } from '@/lib/cron/auth'
import { isBigCommerceStorefrontEnabled } from '@/lib/bigcommerce/storefront'
import { isBigCommerceConfigured } from '@/lib/bigcommerce/config'
import { syncBigCommerceOrders } from '@/lib/bigcommerce/orders'

/**
 * GET /api/cron/bigcommerce-orders
 *
 * Re-copies every BigCommerce order changed in the last three days, so an order
 * whose webhook was missed or failed still reaches this site's order table.
 * Mirroring is idempotent, so overlapping with the webhook is harmless. The
 * fundraising store is swept too whenever its credentials are configured.
 */

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const LOOKBACK_MS = 3 * 24 * 60 * 60 * 1000

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // The two stores are independent: the retail mirror follows the storefront switch, while
  // the fundraising store takes orders (and owes groups their share) either way.
  const syncMain = isBigCommerceStorefrontEnabled()
  const syncFundraising = isBigCommerceConfigured('fundraising')
  if (!syncMain && !syncFundraising) {
    return NextResponse.json({ skipped: 'The storefront does not sell through BigCommerce' })
  }

  try {
    const since = new Date(Date.now() - LOOKBACK_MS)
    const main = syncMain ? await syncBigCommerceOrders(since) : null
    const fundraising = syncFundraising ? await syncBigCommerceOrders(since, undefined, 'fundraising') : null
    return NextResponse.json({ ...(main ?? { skipped: 'The storefront does not sell through BigCommerce' }), fundraising })
  } catch (error) {
    console.error('[cron/bigcommerce-orders]', error)
    return NextResponse.json({ error: 'BigCommerce order sync failed' }, { status: 500 })
  }
}
