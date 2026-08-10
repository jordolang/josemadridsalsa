/**
 * Configurable per-rule routing for order events.
 *
 * `OrderNotificationRule` has existed in the schema with zero code references anywhere: a table
 * describing which events should go to which addresses and Slack channels, that nothing read.
 * This is the evaluation half.
 *
 * Deliberately separate from `notifyOperators`. That dispatcher is the built-in operational
 * floor — payment failed, stock out, orders gone stale — and every operator sees it. This is the
 * opposite: rules an admin writes, sending named events to named recipients who may not be
 * operators at all, like a warehouse address that only wants shipped orders above $200.
 */
import type { OrderNotificationEvent, OrderNotificationRule, OrderStatus } from '@prisma/client'

import type { DomainEventType } from '@/lib/domain-events/types'

/**
 * Which domain event satisfies which configurable trigger.
 *
 * `HIGH_VALUE_ORDER` shares `payment.completed` with `ORDER_PAID` rather than having a fact of
 * its own — "high value" is a threshold on the rule (`minAmount`), not a different thing
 * happening, so the distinction belongs in the filter and not in the event catalogue.
 *
 * `ORDER_CANCELLED` is absent: `order.cancelled` is in the event catalogue but nothing emits it,
 * so a rule using it would sit in the table looking configured and never fire. Listing it here
 * would be the same mistake as mapping `ORDER_REFUNDED` before its producer existed.
 */
export const RULE_EVENT_BY_DOMAIN_EVENT: Partial<
  Record<DomainEventType, OrderNotificationEvent[]>
> = {
  'order.created': ['ORDER_CREATED'],
  'payment.completed': ['ORDER_PAID', 'HIGH_VALUE_ORDER'],
  'order.fulfilled': ['ORDER_SHIPPED'],
  'order.delivered': ['ORDER_DELIVERED'],
  'payment.refunded': ['ORDER_REFUNDED'],
  'payment.failed': ['PAYMENT_FAILED'],
}

/** The order facts a rule is evaluated against. */
export interface RuleOrderContext {
  orderNumber: string
  status: OrderStatus
  total: number
}

/**
 * Does this rule fire for this order?
 *
 * Filters are conjunctive and each is optional, so a rule with neither filter set matches every
 * order carrying its trigger. `minAmount` is inclusive — a rule written for "$100 and up" that
 * skipped a $100 order would be read as broken by whoever wrote it.
 */
export function ruleMatches(
  rule: Pick<OrderNotificationRule, 'isActive' | 'statusFilter' | 'minAmount'>,
  order: RuleOrderContext
): boolean {
  if (!rule.isActive) return false
  if (rule.statusFilter !== null && rule.statusFilter !== order.status) return false
  if (rule.minAmount !== null && order.total < Number(rule.minAmount)) return false
  return true
}

/**
 * The message body, shared by both channels so they cannot drift.
 */
export function ruleMessage(
  event: OrderNotificationEvent,
  order: RuleOrderContext,
  appUrl: string
): { subject: string; text: string; html: string } {
  const label: Record<OrderNotificationEvent, string> = {
    ORDER_CREATED: 'New order',
    ORDER_PAID: 'Order paid',
    ORDER_SHIPPED: 'Order shipped',
    ORDER_DELIVERED: 'Order delivered',
    ORDER_CANCELLED: 'Order cancelled',
    ORDER_REFUNDED: 'Order refunded',
    PAYMENT_FAILED: 'Payment failed',
    HIGH_VALUE_ORDER: 'Large order',
  }

  const headline = `${label[event]}: ${order.orderNumber}`
  const amount = `$${order.total.toFixed(2)}`
  const link = `${appUrl}/admin/orders?search=${encodeURIComponent(order.orderNumber)}`

  return {
    subject: `${headline} — ${amount}`,
    text: `${headline}\nTotal: ${amount}\nStatus: ${order.status}\n${link}`,
    html: `<p><strong>${headline}</strong></p><p>Total: ${amount}<br>Status: ${order.status}</p><p><a href="${link}">View in admin</a></p>`,
  }
}

/**
 * Post to a Slack incoming webhook.
 *
 * Returns rather than throws: a rule pointing at a revoked webhook must not stop the same event
 * reaching the other rules, or the email half of its own rule.
 */
export async function postToSlack(webhookUrl: string, text: string): Promise<boolean> {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
    if (!response.ok) {
      console.warn('[order-rules] Slack webhook rejected the message', { status: response.status })
      return false
    }
    return true
  } catch (error) {
    console.warn('[order-rules] Slack webhook failed', { error })
    return false
  }
}
