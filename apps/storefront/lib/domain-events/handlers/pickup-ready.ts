/**
 * Domain events → "your order is ready to collect".
 *
 * A local-pickup order got no notification at all. The shipped email is sent from the EasyPost
 * tracking webhook (`lib/tracking/webhook-handlers.ts`), and a pickup order never has a label,
 * so no tracker is ever created and nothing fires. `sendOrderReadyForPickupEmail` was written
 * for exactly this and had no callers.
 *
 * Subscribing to `order.fulfilled` puts the notice where the fact is, rather than in whichever
 * admin route happened to mark the order fulfilled. Shipped orders are filtered out here rather
 * than being a second code path: they already get their email from the tracking webhook, and
 * sending both would tell the same customer to expect a parcel and to come and collect it.
 */
import { prisma } from '@/lib/prisma'
import { sendOrderReadyForPickupEmail } from '@/lib/email/transactional'
import { LOCAL_PICKUP_SHIPPING_METHOD } from '@/lib/orders/order-filters'

import { registerDomainEventHandler } from '../subscribe'
import type { DomainEventRecord } from '../subscribe'

/**
 * Email the customer when a pickup order is marked fulfilled.
 *
 * Idempotent in the sense the poller needs — it reads the order fresh each time and only acts
 * on pickup orders — but not deduplicated: a replayed `order.fulfilled` would send a second
 * notice. That is why the drain marks an event consumed after its handlers finish, and why a
 * replay only happens on a crash mid-batch. Telling someone twice that their salsa is ready is
 * the mild failure; never telling them is the one worth fixing.
 */
export async function handlePickupReady(event: DomainEventRecord): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: event.entityId },
    select: {
      orderNumber: true,
      shippingMethod: true,
      guestEmail: true,
      user: { select: { name: true, email: true } },
    },
  })

  if (!order) {
    console.warn('[events] Order not found for pickup notice', {
      eventId: event.id,
      orderId: event.entityId,
    })
    return
  }

  if (order.shippingMethod !== LOCAL_PICKUP_SHIPPING_METHOD) return

  const email = order.user?.email ?? order.guestEmail
  if (!email) {
    // A counter sale entered by hand may have no address on file. Nothing to retry.
    console.warn('[events] No recipient for pickup notice', { orderId: event.entityId })
    return
  }

  await sendOrderReadyForPickupEmail({
    email,
    name: order.user?.name ?? 'there',
    orderNumber: order.orderNumber,
  })
}

/** Subscribe to the fact that an order was fulfilled, whatever route recorded it. */
export function registerPickupReadyHandlers(): void {
  registerDomainEventHandler('order.fulfilled', 'pickup-ready', handlePickupReady)
}
