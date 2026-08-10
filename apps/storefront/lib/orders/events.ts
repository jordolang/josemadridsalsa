import type { SalesChannel } from '@prisma/client'

import { emitDomainEvent } from '@/lib/domain-events/emit'

/**
 * `order.created`, emitted from every path that takes a live order.
 *
 * A helper rather than five hand-written `emitDomainEvent` calls, so the payload keys stay
 * identical across checkout, PayPal, Square, POS and gift certificates — a consumer reading
 * `salesChannel` should not have to know which route produced the row.
 *
 * The bulk order importer deliberately does **not** emit this. It replays orders that were
 * placed elsewhere, often years ago; announcing thousands of them as new business facts
 * would drown the event log and any automation reading it. History is not news.
 */
export async function emitOrderCreated(order: {
  id: string
  orderNumber: string
  total: unknown
  salesChannel?: SalesChannel | null
  itemCount?: number
  actorUserId?: string | null
}): Promise<void> {
  await emitDomainEvent({
    type: 'order.created',
    entityType: 'order',
    entityId: order.id,
    actorUserId: order.actorUserId ?? null,
    payload: {
      orderNumber: order.orderNumber,
      total: Number(order.total),
      salesChannel: order.salesChannel ?? null,
      itemCount: order.itemCount ?? null,
    },
  })
}
