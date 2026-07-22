import { NextResponse } from 'next/server'
import { getConnection } from '@/lib/quickbooks/connection'
import { drainQueue, enqueuePaidOrders } from '@/lib/quickbooks/sync'

/**
 * GET /api/cron/quickbooks-sync
 *
 * Sweeps paid orders into the sync ledger, then drains what's due. Runs hourly.
 * Deliberately the only thing that talks to QuickBooks on a schedule — checkout
 * stays entirely out of it, so a QBO outage can never cost us a sale.
 */

export const dynamic = 'force-dynamic'

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true // No secret configured → allow (matches other crons).
  return request.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Nothing connected is the normal state until an admin runs the connect flow,
  // so it is a no-op rather than an error the cron log fills up with.
  const connection = await getConnection()
  if (!connection) {
    return NextResponse.json({ skipped: 'QuickBooks is not connected' })
  }

  try {
    const enqueued = await enqueuePaidOrders()
    const tally = await drainQueue()
    return NextResponse.json({ enqueued, ...tally })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'QuickBooks sync failed'
    console.error('[cron/quickbooks-sync]', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
