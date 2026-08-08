import { NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { isAuthorizedCronRequest } from '@/lib/cron/auth'
import { notifyOperators } from '@/lib/notifications/dispatch'
import { getSavedView } from '@/lib/orders/order-filters'
import {
  agingReturnsSpec,
  hoursBefore,
  minutesBefore,
  STALE_RETURN_HOURS,
  STALE_UNFULFILLED_HOURS,
  staleUnfulfilledSpec,
  STUCK_WEBHOOK_MINUTES,
  stuckWebhooksSpec,
} from '@/lib/operations/aging'

/**
 * GET /api/cron/operations-sweep
 *
 * Finds work that has gone quiet — paid orders nobody shipped, returns nobody decided,
 * webhooks that were received and never finished — and raises one notification per
 * condition. Nothing else notices these: they produce no error and fire no webhook, they
 * just sit.
 *
 * Read-only apart from the notifications it writes, and idempotent through the dispatcher's
 * dedupe keys, so the frequency can be raised without consequence.
 */

export const dynamic = 'force-dynamic'

/** Cap the scan so a backlog cannot turn one tick into a very long function. */
const SCAN_LIMIT = 100

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const now = new Date()

    // Same predicate as the "Needs Shipping" saved view, so the notification and the link it
    // points at can never disagree about which orders count.
    const needsShipping = getSavedView('needs-shipping')?.where ?? {}

    const [staleOrders, agingReturns, stuckWebhooks] = await Promise.all([
      prisma.order.findMany({
        where: { ...needsShipping, createdAt: { lte: hoursBefore(now, STALE_UNFULFILLED_HOURS) } },
        select: { orderNumber: true },
        orderBy: { createdAt: 'asc' },
        take: SCAN_LIMIT,
      }),
      prisma.returnRequest.findMany({
        where: {
          status: 'REQUESTED',
          createdAt: { lte: hoursBefore(now, STALE_RETURN_HOURS) },
        },
        select: { rmaNumber: true },
        orderBy: { createdAt: 'asc' },
        take: SCAN_LIMIT,
      }),
      prisma.webhookEvent.findMany({
        where: {
          processed: false,
          createdAt: { lte: minutesBefore(now, STUCK_WEBHOOK_MINUTES) },
        },
        select: { provider: true, type: true },
        orderBy: { createdAt: 'asc' },
        take: SCAN_LIMIT,
      }),
    ])

    const specs = [
      staleUnfulfilledSpec(staleOrders.map((o) => o.orderNumber)),
      agingReturnsSpec(agingReturns.map((r) => r.rmaNumber)),
      stuckWebhooksSpec(stuckWebhooks.map((w) => ({ provider: w.provider, type: w.type }))),
    ].filter((spec) => spec !== null)

    for (const spec of specs) {
      await notifyOperators(spec)
    }

    return NextResponse.json({
      success: true,
      staleOrders: staleOrders.length,
      agingReturns: agingReturns.length,
      stuckWebhooks: stuckWebhooks.length,
      notificationsRaised: specs.length,
    })
  } catch (error) {
    console.error('Operations sweep cron error:', error)
    return NextResponse.json({ error: 'Cron failed' }, { status: 500 })
  }
}
