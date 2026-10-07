import { NextResponse } from 'next/server'
import { isAuthorizedCronRequest } from '@/lib/cron/auth'
import { sweepMerchOrders } from '@/lib/merchandise/orders'

/**
 * GET /api/cron/merch-orders
 *
 * Sends paid merch orders to Printify when the buyer never reached the thank-you page
 * (closed the tab after paying), retries orders Printify refused, and expires payment
 * links left unpaid. Safe to run as often as you like: each order is claimed before it is
 * submitted, so it reaches Printify once.
 */

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    return NextResponse.json(await sweepMerchOrders())
  } catch (error) {
    console.error('Merch order sweep failed', error)
    return NextResponse.json({ error: 'Merch order sweep failed' }, { status: 500 })
  }
}
