import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendReviewRequestEmail } from '@/lib/email/transactional'

// Send review requests to customers whose orders were delivered 3–7 days ago
// and haven't already received a review request.
const MIN_DAYS_AFTER_DELIVERY = 3
const MAX_DAYS_AFTER_DELIVERY = 7

export async function GET() {
  try {
    const now = new Date()
    const minDelivery = new Date(now.getTime() - MAX_DAYS_AFTER_DELIVERY * 24 * 60 * 60 * 1000)
    const maxDelivery = new Date(now.getTime() - MIN_DAYS_AFTER_DELIVERY * 24 * 60 * 60 * 1000)

    const orders = await prisma.order.findMany({
      where: {
        status: 'DELIVERED',
        deliveredAt: { gte: minDelivery, lte: maxDelivery },
        // Use confirmationEmailSentAt as a proxy for "review request sent"
        // In a future migration this could be a dedicated reviewRequestSentAt field
        confirmationEmailSentAt: null,
        OR: [
          { userId: { not: null } },
          { guestEmail: { not: null } },
        ],
      },
      include: {
        user: { select: { email: true, name: true } },
        items: { select: { productName: true }, take: 1 },
      },
      take: 50,
    })

    let sent = 0
    let skipped = 0

    for (const order of orders) {
      const email = order.user?.email ?? order.guestEmail
      if (!email) { skipped++; continue }

      const name = order.user?.name ?? 'there'
      const productName = order.items[0]?.productName ?? 'your José Madrid Salsa'

      try {
        await sendReviewRequestEmail({
          email,
          name,
          orderNumber: order.orderNumber,
          productName,
        })

        // Mark review request sent so we don't re-send
        await prisma.order.update({
          where: { id: order.id },
          data: { confirmationEmailSentAt: now },
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
