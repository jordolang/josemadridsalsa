import { NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { isAuthorizedCronRequest } from '@/lib/cron/auth'
import { sendReviewRequestEmail } from '@/lib/email/transactional'
import { reviewRequestRecipient, reviewRequestWhere } from '@/lib/orders/review-requests'

/**
 * GET /api/cron/review-requests
 *
 * Asks customers whose orders were delivered 3-7 days ago what they thought. Selection and
 * copy live in `lib/orders/review-requests.ts` so the window arithmetic and the "already asked"
 * guard are testable — both have been wrong here before, silently.
 */

export const dynamic = 'force-dynamic'

/** Cap the batch so a backlog cannot turn one tick into a very long function. */
const SEND_LIMIT = 50

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const now = new Date()

    const orders = await prisma.order.findMany({
      where: reviewRequestWhere(now),
      include: {
        user: { select: { email: true, name: true } },
        items: { select: { productName: true }, take: 1 },
      },
      take: SEND_LIMIT,
    })

    let sent = 0
    let skipped = 0

    for (const order of orders) {
      const recipient = reviewRequestRecipient(order)
      if (!recipient) {
        skipped++
        continue
      }

      try {
        await sendReviewRequestEmail(recipient)

        // Its own column, so `confirmationEmailSentAt` keeps meaning what its name says. An
        // earlier version overwrote that one here and lost the confirmation timestamp.
        await prisma.order.update({
          where: { id: order.id },
          data: { reviewRequestSentAt: now },
        })

        sent++
      } catch (err) {
        console.error(`Review request failed for order ${order.orderNumber}:`, err)
        skipped++
      }
    }

    return NextResponse.json({ success: true, sent, skipped, total: orders.length })
  } catch (error) {
    console.error('Review requests cron error:', error)
    return NextResponse.json({ error: 'Cron failed' }, { status: 500 })
  }
}
