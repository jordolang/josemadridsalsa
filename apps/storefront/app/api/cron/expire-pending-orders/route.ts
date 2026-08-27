import { NextResponse } from 'next/server'

import prisma from '@/lib/prisma'
import { isAuthorizedCronRequest } from '@/lib/cron/auth'
import { releaseOrderReservation } from '@/lib/inventory-manager'
import { hoursBefore, PENDING_ORDER_EXPIRY_HOURS } from '@/lib/operations/aging'

/**
 * GET /api/cron/expire-pending-orders
 *
 * Hands back the inventory held by orders that were created at checkout and never paid for.
 *
 * Checkout reserves stock before it asks for money, so an order exists and its items are
 * held from the moment the customer reaches the payment step. Every server-side failure
 * already releases that hold, but the last step of a card payment happens in the browser:
 * `confirmCardPayment` runs there, and if it errors — or the customer simply closes the tab —
 * the server is never told. The order stays PENDING and its stock stays reserved forever.
 * Nothing else notices, because nothing failed on the server.
 *
 * The sweep cancels those orders and releases what they were holding. Cancelling is part of
 * the fix rather than tidying: `retry-payment` refuses cancelled orders, so cancelling is
 * what stops a customer from later paying for stock that has already been given back.
 *
 * Safe to run as often as you like. `releaseOrderReservation` claims each order before
 * touching stock, so an order released by any other path is skipped rather than
 * double-released.
 */

export const dynamic = 'force-dynamic'

/** Cap the work per tick so a backlog cannot turn one run into a very long function. */
const SCAN_LIMIT = 100

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const cutoff = hoursBefore(new Date(), PENDING_ORDER_EXPIRY_HOURS)

    const stale = await prisma.order.findMany({
      where: {
        status: 'PENDING',
        // Anything that reached a paid state is out of scope even if the status lagged.
        paymentStatus: { notIn: ['PAID', 'SUCCEEDED', 'REFUNDED', 'PARTIALLY_REFUNDED'] },
        inventoryReleasedAt: null,
        createdAt: { lte: cutoff },
      },
      select: { id: true, orderNumber: true },
      orderBy: { createdAt: 'asc' },
      take: SCAN_LIMIT,
    })

    const expired: string[] = []

    for (const order of stale) {
      const result = await releaseOrderReservation(
        order.id,
        `Unpaid for over ${PENDING_ORDER_EXPIRY_HOURS}h — reservation expired for order ${order.id}`
      )

      if (!result.released) continue

      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: 'CANCELLED',
          paymentStatus: 'FAILED',
          adminNotes: `Cancelled automatically: unpaid for over ${PENDING_ORDER_EXPIRY_HOURS} hours. Inventory reservation released.`,
        },
      })

      expired.push(order.orderNumber)
    }

    // No alert refresh here on purpose: releasing a reservation moves `stockReserved`, not
    // `inventory`, and `releaseInventory` already recomputes `stockStatus` from the new
    // available figure. The low-stock alerts key off actual inventory, which has not moved.

    return NextResponse.json({
      success: true,
      scanned: stale.length,
      expired: expired.length,
      orderNumbers: expired,
    })
  } catch (error) {
    console.error('Expire pending orders cron error:', error)
    return NextResponse.json({ error: 'Cron failed' }, { status: 500 })
  }
}
