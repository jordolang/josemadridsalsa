import { dedupeKeys, type NotificationSpec } from '@/lib/notifications/dispatch'

/**
 * Things that go wrong by sitting still.
 *
 * A paid order nobody shipped and a return request nobody actioned are both silent failures:
 * no error is thrown, no webhook fires, the row just ages. This module decides when age has
 * become a problem and what to say about it, kept separate from the cron route so the
 * thresholds and the wording are testable without a database.
 *
 * Each sweep collapses onto a single rolling notification rather than one per row. Twelve
 * unshipped orders is one situation, not twelve; a list that reports it twelve times is a
 * list operators learn to ignore.
 */

/** How long a paid order may sit unfulfilled before it is worth interrupting someone. */
export const STALE_UNFULFILLED_HOURS = 48

/** How long a customer may wait for a decision on a return before we chase it. */
export const STALE_RETURN_HOURS = 72

/**
 * How long a webhook may sit unprocessed before it counts as stuck.
 *
 * Handlers finish in seconds. Half an hour is far past any plausible slow run or provider
 * retry still in flight, so anything older did not fail transiently — it failed.
 */
export const STUCK_WEBHOOK_MINUTES = 30

/**
 * How long an unpaid order may hold its inventory reservation before the sweep takes it back.
 *
 * A card is confirmed in the browser within seconds, so anything still PENDING hours later
 * is an abandoned tab, a payment that failed without the page reporting back, or a customer
 * who gave up. Two hours is far past any live attempt while still leaving room for the
 * retry-payment flow, which refuses cancelled orders and so has to run before the sweep does.
 */
export const PENDING_ORDER_EXPIRY_HOURS = 2

/** How many order numbers to name before switching to a count. */
const NAMED_EXAMPLES = 3

export function hoursBefore(now: Date, hours: number): Date {
  return new Date(now.getTime() - hours * 60 * 60 * 1000)
}

export function minutesBefore(now: Date, minutes: number): Date {
  return new Date(now.getTime() - minutes * 60 * 1000)
}

/**
 * Render "#1001, #1002 and 4 others" — enough to recognise the work without pasting a queue
 * into a notification body.
 */
export function summariseReferences(references: string[]): string {
  if (references.length === 0) return ''
  if (references.length <= NAMED_EXAMPLES) {
    if (references.length === 1) return references[0]
    return `${references.slice(0, -1).join(', ')} and ${references[references.length - 1]}`
  }

  const named = references.slice(0, NAMED_EXAMPLES).join(', ')
  const rest = references.length - NAMED_EXAMPLES
  return `${named} and ${rest} other${rest === 1 ? '' : 's'}`
}

export const agingDedupeKeys = {
  ordersUnfulfilled: 'orders-unfulfilled-stale',
  returnsAging: 'returns-aging',
  // Reuses the integration-failure identity the notification centre already defines, since
  // a webhook that never finished processing is exactly that.
  webhooksStuck: dedupeKeys.integrationFailed('webhooks'),
}

/**
 * Notification for orders paid but not shipped past the threshold.
 *
 * Returns null when there is nothing to report, so a quiet sweep writes nothing at all
 * instead of an "all clear" that would mark the row unread again on every tick.
 */
export function staleUnfulfilledSpec(
  orderNumbers: string[],
  hours: number = STALE_UNFULFILLED_HOURS
): NotificationSpec | null {
  if (orderNumbers.length === 0) return null

  const count = orderNumbers.length
  return {
    type: 'ORDER_UNFULFILLED_STALE',
    severity: 'WARNING',
    title: `${count} order${count === 1 ? '' : 's'} unshipped after ${hours}h`,
    message: `${summariseReferences(orderNumbers)} ${count === 1 ? 'was' : 'were'} paid more than ${hours} hours ago and ${count === 1 ? 'has' : 'have'} not shipped.`,
    entityType: 'order',
    link: '/admin/orders?view=needs-shipping',
    dedupeKey: agingDedupeKeys.ordersUnfulfilled,
  }
}

export interface StuckWebhook {
  provider: string | null
  type: string
}

/**
 * Notification for webhooks that were received and never finished processing.
 *
 * This is the failure that costs money quietly: the provider took the payment and called us,
 * our handler threw partway, and the row sits at `processed: false` with nothing watching it.
 * Detection only — replaying a payment webhook is not something to do unattended, so this
 * raises it for a human rather than retrying.
 *
 * Rendered as counts per provider rather than a list of event ids, because the useful
 * question is "is Stripe broken or is this one event" and ids answer neither.
 */
export function stuckWebhooksSpec(
  webhooks: StuckWebhook[],
  minutes: number = STUCK_WEBHOOK_MINUTES
): NotificationSpec | null {
  if (webhooks.length === 0) return null

  const byProvider = new Map<string, number>()
  for (const hook of webhooks) {
    const key = hook.provider ?? 'unknown'
    byProvider.set(key, (byProvider.get(key) ?? 0) + 1)
  }

  const breakdown = [...byProvider.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([provider, count]) => `${provider} ${count}`)
    .join(', ')

  const count = webhooks.length
  return {
    type: 'INTEGRATION_FAILED',
    severity: 'CRITICAL',
    title: `${count} webhook${count === 1 ? '' : 's'} stuck unprocessed`,
    message: `${breakdown}. ${count === 1 ? 'It was' : 'They were'} received more than ${minutes} minutes ago and never finished processing — an order may have been paid for without being confirmed.`,
    entityType: 'webhook_event',
    // Deliberately no link, unlike the other two specs: there is no admin page for webhook
    // events to land on. A link to somewhere approximate would be worse than none — this
    // needs the logs, not a screen. Give it one when that page exists.
    dedupeKey: agingDedupeKeys.webhooksStuck,
  }
}

/** Notification for return requests still awaiting a decision past the threshold. */
export function agingReturnsSpec(
  rmaNumbers: string[],
  hours: number = STALE_RETURN_HOURS
): NotificationSpec | null {
  if (rmaNumbers.length === 0) return null

  const count = rmaNumbers.length
  return {
    type: 'RETURN_AGING',
    severity: 'WARNING',
    title: `${count} return${count === 1 ? '' : 's'} awaiting a decision`,
    message: `${summariseReferences(rmaNumbers)} ${count === 1 ? 'has' : 'have'} been open for more than ${hours} hours without being approved or rejected.`,
    entityType: 'return_request',
    link: '/admin/returns?status=REQUESTED',
    dedupeKey: agingDedupeKeys.returnsAging,
  }
}
