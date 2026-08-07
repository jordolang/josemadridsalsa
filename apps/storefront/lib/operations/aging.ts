import type { NotificationSpec } from '@/lib/notifications/dispatch'

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

/** How many order numbers to name before switching to a count. */
const NAMED_EXAMPLES = 3

export function hoursBefore(now: Date, hours: number): Date {
  return new Date(now.getTime() - hours * 60 * 60 * 1000)
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
