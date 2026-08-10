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
import type { DomainEventType } from '../types'

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
 * Find the address the automation should be sent to.
 *
 * Order events carry no email in their payload — the keys are deliberately small — so the
 * order is read for one. Guest checkouts have no `user`, which is why `guestEmail` is a
 * fallback rather than an edge case; most storefront orders are guest orders.
 */
async function resolveRecipient(event: DomainEventRecord): Promise<string | null> {
  const payload = payloadOf(event)

  // Cheapest source first: the emitter already knew the address.
  const fromPayload = readString(payload, 'email')
  if (fromPayload) return fromPayload

  if (event.entityType === 'order') {
    const order = await prisma.order.findUnique({
      where: { id: event.entityId },
      select: { guestEmail: true, user: { select: { email: true } } },
    })
    return order?.user?.email ?? order?.guestEmail ?? null
  }

  if (event.entityType === 'customer') {
    const user = await prisma.user.findUnique({
      where: { id: event.entityId },
      select: { email: true },
    })
    return user?.email ?? null
  }

  return null
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
 * anyone already on an ACTIVE enrollment for the same automation, so a replayed event is a
 * no-op rather than a second welcome series.
 */
export async function handleAutomationEnrollment(event: DomainEventRecord): Promise<void> {
  const trigger = TRIGGER_BY_EVENT[event.type as DomainEventType]
  if (!trigger) return

  const email = await resolveRecipient(event)
  if (!email) {
    // Not an error worth failing the event over — a POS walk-in has no address to write to,
    // and retrying would never produce one.
    console.warn('[events] No recipient for automation enrollment', {
      eventId: event.id,
      type: event.type,
    })
    return
  }

  await enrollInAutomation(trigger, email, triggerDataFor(event, email))
}

/** Subscribe this handler to every event type it maps. */
export function registerAutomationEnrollmentHandlers(): void {
  for (const type of Object.keys(TRIGGER_BY_EVENT) as DomainEventType[]) {
    registerDomainEventHandler(type, 'automation-enrollment', handleAutomationEnrollment)
  }
}

/** Exposed so tests and the admin console can show what is actually mapped. */
export const AUTOMATION_TRIGGER_BY_EVENT = TRIGGER_BY_EVENT
