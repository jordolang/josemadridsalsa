/**
 * Domain events → the customer's order confirmation, on the paths that never sent one.
 *
 * Three checkout routes and three webhooks each call `sendOrderConfirmationEmail` by hand. The
 * POS and the manual-order form do not, so a counter sale or a phone order confirmed nothing to
 * anybody. That is the "same automation, forgotten on the fourth path" bug in its purest form.
 *
 * This is the catch-all rather than a fifth hand-wired copy. It listens to the facts and sends a
 * confirmation for any order that has not had one, which makes the omission structurally
 * impossible on paths added later: a route that records a sale gets the confirmation for free.
 *
 * It cannot double-send, because `sendOrderConfirmationEmail` stamps `confirmationEmailSentAt`
 * and this checks it first. The web paths stamp it synchronously during checkout, long before
 * the five-minute drain reaches their event, so those orders are already marked by the time this
 * looks at them.
 */
import type { SalesChannel } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { sendOrderConfirmationEmail } from '@/lib/email/automation'

import { registerDomainEventHandler } from '../subscribe'
import type { DomainEventRecord } from '../subscribe'

/**
 * Channels where creating the order *is* the sale.
 *
 * `order.created` fires on every path that opens an order, and the website, PayPal, Square and
 * POS routes all open one **before** taking payment — confirming those at creation would email
 * people who abandoned checkout. These three are different: an admin recording a phone call, a
 * wholesale table or an event sale is writing down a deal that has already been struck, so there
 * is no later payment fact to wait for. `IMPORT` is absent because the bulk importer
 * deliberately emits nothing; `MARKETPLACE` is absent because its settlement is not modelled yet.
 */
const FINAL_AT_CREATION: SalesChannel[] = ['MANUAL', 'PHONE', 'WHOLESALE']

/**
 * Send the confirmation for one order, if it has not had one.
 *
 * Idempotent through `confirmationEmailSentAt`, which is what makes it safe both under the
 * poller's at-least-once delivery and alongside the hand-wired senders it backs up.
 */
export async function handleOrderConfirmation(event: DomainEventRecord): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: event.entityId },
    select: { id: true, confirmationEmailSentAt: true, salesChannel: true },
  })

  if (!order) return

  // Already confirmed — by a checkout route, a webhook, or an earlier delivery of this event.
  if (order.confirmationEmailSentAt) return

  if (event.type === 'order.created' && !FINAL_AT_CREATION.includes(order.salesChannel)) {
    // Payment has not happened yet on this channel; `payment.completed` will bring us back.
    return
  }

  await sendOrderConfirmationEmail(order.id)
}

/**
 * Subscribe to both facts that can mean "this order is real".
 *
 * Two events rather than one because the two families of channel confirm at different moments:
 * money arriving for anything taken online or at the terminal, and the order being written down
 * for anything an admin records after the fact.
 */
export function registerOrderConfirmationHandlers(): void {
  registerDomainEventHandler('payment.completed', 'order-confirmation', handleOrderConfirmation)
  registerDomainEventHandler('order.created', 'order-confirmation', handleOrderConfirmation)
}
