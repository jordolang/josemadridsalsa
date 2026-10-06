/**
 * Domain event catalogue.
 *
 * These are business facts, recorded after they happen. Consumers (notifications,
 * automation rules, activity timelines, analytics) subscribe to them instead of being
 * hand-wired into each route that causes the fact.
 *
 * Names are `<entity>.<past-tense-verb>` and are stable — they are persisted in
 * `domain_events.type` and read by consumers, so renaming one is a data migration.
 */
export const DOMAIN_EVENT_TYPES = [
  'order.created',
  'order.cancelled',
  'order.fulfilled',
  'order.partially_fulfilled',
  'order.shipped',
  'order.delivered',
  'order.returned',
  'payment.completed',
  'payment.failed',
  'payment.refunded',
  'inventory.low',
  'inventory.out_of_stock',
  'inventory.adjusted',
  'shipment.created',
  'customer.created',
  'refund.completed',
  'loyalty.points_earned',
  'loyalty.tier_upgraded',
  'newsletter.subscribed',
] as const

export type DomainEventType = (typeof DOMAIN_EVENT_TYPES)[number]

/** The entity a domain event hangs off, used to build per-entity timelines. */
export type DomainEventEntityType =
  | 'order'
  | 'payment'
  | 'product'
  | 'customer'
  | 'fulfillment'
  | 'refund'
  /** A mailing-list address that may have no account; the entity id is the address itself. */
  | 'subscriber'

export interface DomainEventInput {
  type: DomainEventType
  entityType: DomainEventEntityType
  entityId: string
  /** Small, serialisable detail. Not a full entity snapshot — keep these cheap to read. */
  payload?: Record<string, unknown> | null
  /** The admin or customer who caused it, when there is one. Null for webhook-driven facts. */
  actorUserId?: string | null
}
