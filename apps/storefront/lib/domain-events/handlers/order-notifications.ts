/**
 * Domain events → "you have a new order" for the people running the shop.
 *
 * Three separate mechanisms existed for this and none of them fired. `notifyAdminsOfNewOrder`
 * had no callers, and would have returned early anyway — it reads `OrderNotificationSetting`,
 * a table with no rows, no seed and no UI to create one. `sendAdminNewOrderNotification` was
 * called only from `lib/stripe/webhooks.ts`, which nothing imports. The net effect was that a
 * new order notified nobody, on any payment path.
 *
 * Rather than hand-wire a fourth attempt into each payment route — the pattern that produced
 * this mess — this subscribes to the fact. `payment.completed` is emitted by the Stripe,
 * PayPal and Square webhooks, so one handler covers every path, including ones added later.
 */
import { prisma } from '@/lib/prisma'
import { sendAdminNewOrderNotification } from '@/lib/email/automation'
import { dedupeKeys, notifyOperators } from '@/lib/notifications/dispatch'
import type { NotificationSpec } from '@/lib/notifications/dispatch'

import { registerDomainEventHandler } from '../subscribe'
import type { DomainEventRecord } from '../subscribe'

/**
 * What counts as an order worth flagging separately.
 *
 * Matches the default `OrderNotificationSetting.highValueThreshold` so the number does not
 * change meaning if per-operator thresholds are ever switched on. A constant rather than a
 * settings lookup because that table is empty — reading it would reintroduce exactly the
 * silent no-op this handler exists to fix.
 */
export const HIGH_VALUE_ORDER_THRESHOLD = 100

export interface NewOrderSummary {
  id: string
  orderNumber: string
  total: number
  customer: string
}

/** Notification for any paid order. */
export function newOrderSpec(order: NewOrderSummary): NotificationSpec {
  return {
    type: 'ORDER_NEW',
    severity: 'INFO',
    title: `New order ${order.orderNumber}`,
    message: `${order.customer} paid $${order.total.toFixed(2)}.`,
    entityType: 'order',
    entityId: order.id,
    link: `/admin/orders/${order.id}`,
    dedupeKey: dedupeKeys.newOrder(order.id),
  }
}

/**
 * Notification for an order above the threshold.
 *
 * Deliberately a second notification rather than a louder version of the first: the two carry
 * different dedupe keys, so acknowledging the routine "new order" does not also clear the
 * flag saying this one is unusually large.
 */
export function highValueOrderSpec(order: NewOrderSummary): NotificationSpec | null {
  if (order.total < HIGH_VALUE_ORDER_THRESHOLD) return null

  return {
    type: 'ORDER_HIGH_VALUE',
    severity: 'INFO',
    title: `Large order ${order.orderNumber} — $${order.total.toFixed(2)}`,
    message: `${order.customer} placed an order above the $${HIGH_VALUE_ORDER_THRESHOLD} threshold.`,
    entityType: 'order',
    entityId: order.id,
    link: `/admin/orders/${order.id}`,
    dedupeKey: dedupeKeys.highValueOrder(order.id),
  }
}

/**
 * Raise the in-app notifications and send the admin email for one paid order.
 *
 * Idempotent, as the poller's at-least-once delivery requires: both notifications carry a
 * dedupe key derived from the order id, so a replayed event refreshes one row rather than
 * adding another.
 */
export async function handleNewOrderNotifications(event: DomainEventRecord): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: event.entityId },
    select: {
      id: true,
      orderNumber: true,
      total: true,
      guestEmail: true,
      user: { select: { name: true, email: true } },
    },
  })

  if (!order) {
    console.warn('[events] Order not found for new-order notification', {
      eventId: event.id,
      orderId: event.entityId,
    })
    return
  }

  const summary: NewOrderSummary = {
    id: order.id,
    orderNumber: order.orderNumber,
    total: Number(order.total),
    customer: order.user?.name ?? order.user?.email ?? order.guestEmail ?? 'Guest customer',
  }

  await notifyOperators(newOrderSpec(summary))

  const highValue = highValueOrderSpec(summary)
  if (highValue) await notifyOperators(highValue)

  // The email is best-effort and reports failure by return value rather than throwing; it is
  // also the part most likely to be unconfigured (it needs ORDER_NOTIFICATION_EMAILS). Let a
  // missing mailing list cost the email, not the in-app notifications already raised above.
  try {
    await sendAdminNewOrderNotification(order.id)
  } catch (error) {
    console.warn('[events] Admin new-order email failed', { orderId: order.id, error })
  }
}

/** Subscribe to the fact that money arrived, on every payment path. */
export function registerOrderNotificationHandlers(): void {
  registerDomainEventHandler('payment.completed', 'new-order-notifications', handleNewOrderNotifications)
}
