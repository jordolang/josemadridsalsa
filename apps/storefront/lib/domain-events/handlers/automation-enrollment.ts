/**
 * Domain events → email automation enrollment.
 *
 * This is the join that makes the automation builder real. `EmailAutomation`, its 17-value
 * trigger enum, the admin builder and the five-minute drain cron were all complete and
 * correct, but `enrollInAutomation` had no callers — so nobody was ever enrolled and the
 * cron drained an empty queue. Mapping committed facts onto triggers is the missing piece.
 */
import { prisma } from '@/lib/prisma'
import type { AutomationTriggerType } from '@/lib/email/automation-engine'
import { enrollInAutomation } from '@/lib/email/automation-engine'

import { registerDomainEventHandler } from '../subscribe'
import type { DomainEventRecord } from '../subscribe'
import type { DomainEventType } from '@/lib/domain-events/types'

/**
 * Which committed fact starts which automation.
 *
 * `payment.completed` rather than `order.created` is deliberate. The Square, PayPal and
 * standard checkout routes all create the order *before* taking payment, so `order.created`
 * also fires for checkouts that are abandoned at the payment step — keying a post-purchase
 * series off it would email people who never bought anything. `payment.completed` is emitted
 * by all three payment webhooks and means the money actually arrived.
 *
 * `order.fulfilled` is the shipped fact: `lib/orders/fulfillment.ts` maps the `shipped`
 * transition onto it. There is no `order.shipped` producer, despite the type existing.
 *
 * `ORDER_REFUNDED` maps to `payment.refunded`, which `lib/payments/refund.ts` emits once a
 * refund settles at the processor. It was left unmapped until that producer existed, because a
 * trigger wired to a fact nobody emits reads as a working automation and is not one.
 */
const TRIGGER_BY_EVENT: Partial<Record<DomainEventType, AutomationTriggerType>> = {
  'payment.completed': 'ORDER_PLACED',
  'order.fulfilled': 'ORDER_SHIPPED',
  'order.delivered': 'ORDER_DELIVERED',
  'customer.created': 'USER_REGISTERED',
  'payment.refunded': 'ORDER_REFUNDED',
  // Emitted by `creditPurchaseLoyaltyPoints` behind its exactly-once claim, keyed on the order.
  'loyalty.points_earned': 'LOYALTY_POINTS_EARNED',
  'loyalty.tier_upgraded': 'LOYALTY_TIER_UPGRADE',
  // There is no product-subscription model; the only subscription anyone can create is a
  // newsletter signup (`/api/newsletter`, `/api/heat-index/subscribe`).
  'newsletter.subscribed': 'SUBSCRIPTION_CREATED',
  // Edge-triggered by `announceAlert` when a new alert row is raised. Stock that drops straight
  // to zero raises only the out-of-stock fact, which is low stock too.
  // ponytail: enrollment is unique per (automation, address), so while one alert's series is
  // still ACTIVE a second product's alert is skipped. Fine for a one-step alert; a multi-step
  // LOW_STOCK series would need per-product enrollments.
  'inventory.low': 'LOW_STOCK',
  'inventory.out_of_stock': 'LOW_STOCK',
}

function payloadOf(event: DomainEventRecord): Record<string, unknown> {
  const { payload } = event
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return {}
  return payload as Record<string, unknown>
}

function readString(source: Record<string, unknown>, key: string): string | null {
  const value = source[key]
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

/**
 * Find the addresses the automation should be sent to.
 *
 * Order events carry no email in their payload — the keys are deliberately small — so the
 * order is read for one. Guest checkouts have no `user`, which is why `guestEmail` is a
 * fallback rather than an edge case; most storefront orders are guest orders.
 *
 * A low-stock alert is for whoever does the ordering, not a customer: it goes to the same
 * `INVENTORY_ALERT_EMAILS` list the restock email already uses.
 */
async function resolveRecipients(event: DomainEventRecord): Promise<string[]> {
  if (event.entityType === 'product') {
    return (process.env.INVENTORY_ALERT_EMAILS ?? '')
      .split(',')
      .map((address) => address.trim())
      .filter(Boolean)
  }

  const payload = payloadOf(event)

  // Cheapest source first: the emitter already knew the address.
  const fromPayload = readString(payload, 'email')
  if (fromPayload) return [fromPayload]

  if (event.entityType === 'order') {
    const order = await prisma.order.findUnique({
      where: { id: event.entityId },
      select: { guestEmail: true, user: { select: { email: true } } },
    })
    const email = order?.user?.email ?? order?.guestEmail
    return email ? [email] : []
  }

  if (event.entityType === 'customer') {
    const user = await prisma.user.findUnique({
      where: { id: event.entityId },
      select: { email: true },
    })
    return user?.email ? [user.email] : []
  }

  return []
}

/**
 * What makes two events the same fact, for `enrollInAutomation`'s duplicate guard.
 *
 * Most facts happen to an entity once — an order is paid once, a customer created once — and
 * may still be recorded twice: the checkout route and the Stripe webhook race and both emit
 * `payment.completed`. Keying on the entity collapses those. A product, though, can go low
 * again after every restock, and each of those is a new alert, so it keys on the event itself.
 * An order can likewise be refunded more than once (partial refunds), so a refund keys on the
 * refund it records.
 */
function dedupeKeyFor(event: DomainEventRecord): string {
  if (event.entityType === 'product') return `${event.type}:${event.id}`
  const refundId = payloadOf(event).refundId
  if (event.type === 'payment.refunded' && typeof refundId === 'string') return `${event.type}:${refundId}`
  return `${event.type}:${event.entityId}`
}

/**
 * Merge the event's own payload into the trigger data the automation templates render.
 *
 * `orderNumber`, `total` and friends come straight from the emitted payload, so a template
 * can use `{{orderNumber}}` without this handler knowing which keys any given event carries.
 */
function triggerDataFor(event: DomainEventRecord, email: string): Record<string, unknown> {
  return {
    ...payloadOf(event),
    email,
    eventType: event.type,
    occurredAt: event.createdAt.toISOString(),
  }
}

/**
 * Enroll the customer behind one event.
 *
 * Idempotent, as the poller's at-least-once delivery requires: `enrollInAutomation` skips
 * anyone already on an ACTIVE enrollment for the same automation, and anyone already enrolled
 * for the same fact (`dedupeKeyFor`), so a replayed or doubly-recorded event is a no-op rather
 * than a second series.
 */
export async function handleAutomationEnrollment(event: DomainEventRecord): Promise<void> {
  const trigger = TRIGGER_BY_EVENT[event.type as DomainEventType]
  if (!trigger) return

  const emails = await resolveRecipients(event)
  if (emails.length === 0) {
    // Not an error worth failing the event over — a POS walk-in has no address to write to,
    // and retrying would never produce one.
    console.warn('[events] No recipient for automation enrollment', {
      eventId: event.id,
      type: event.type,
    })
    return
  }

  for (const email of emails) {
    await enrollInAutomation(trigger, email, triggerDataFor(event, email), dedupeKeyFor(event))
  }
}

/** Subscribe this handler to every event type it maps. */
export function registerAutomationEnrollmentHandlers(): void {
  for (const type of Object.keys(TRIGGER_BY_EVENT) as DomainEventType[]) {
    registerDomainEventHandler(type, 'automation-enrollment', handleAutomationEnrollment)
  }
}

/** Exposed so tests and the admin console can show what is actually mapped. */
export const AUTOMATION_TRIGGER_BY_EVENT = TRIGGER_BY_EVENT
