import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser, hasPermission, isStaff } from '@/lib/rbac'
import { SECTION_PERMISSION } from '@/lib/admin-desktop/access'
import { loadReceipt, loadReceipts } from '@/lib/admin-desktop/fulfil'

/**
 * Order tickets for the receipt printer.
 *
 * `?since=` is the poll the desktop shell runs while a desktop app with a
 * receipt printer is open: every order to fulfil that changed after `since`,
 * with `now` to pass back next time — the last order reached, with
 * `more`, when a burst fills a batch. The app keeps the ids it has printed, so
 * the overlap between polls never prints twice. `?orderId=` is one order's
 * ticket, for a reprint. Gated like the Orders section — a ticket is the order.
 */

export const dynamic = 'force-dynamic'

const Query = z.union([
  z.object({ orderId: z.string().trim().min(1).max(64) }),
  z.object({ since: z.string().datetime({ offset: true }).optional() }),
])

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user || !isStaff(user)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }
  const permission = SECTION_PERMISSION.orders
  if (permission && !(await hasPermission(user, permission))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const parsed = Query.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query' }, { status: 400 })
  }

  try {
    const headers = { 'Cache-Control': 'no-store' }
    if ('orderId' in parsed.data) {
      const receipt = await loadReceipt(parsed.data.orderId)
      if (!receipt) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
      return NextResponse.json({ receipt }, { headers })
    }

    // Read the clock before the query, so an order saved while it runs is
    // inside the next poll's window rather than between the two.
    const now = new Date()
    const since = parsed.data.since ? new Date(parsed.data.since) : null
    const { receipts, next, more } = await loadReceipts(since, now)
    return NextResponse.json({ now: next.toISOString(), more, receipts }, { headers })
  } catch (error) {
    console.error('[admin-desktop] receipts failed:', error)
    return NextResponse.json({ error: 'Could not load receipts' }, { status: 500 })
  }
}
