/**
 * Domain events → the restock email, with a recommended order quantity.
 *
 * `createRestockNotification` computes urgency, days of stock remaining and how much to buy to
 * cover thirty days of sales, renders an email, and writes a `RestockNotification` row. It had
 * no callers, so none of that ever happened — the only thing a low stock level produced was the
 * in-app operator notification, which says a product is low but not what to do about it.
 *
 * Distinct from that in-app alert on purpose. `notifyOperators` is a dashboard badge someone sees
 * when they next look; this is a mail telling whoever does the ordering to place an order.
 */
import { prisma } from '@/lib/prisma'
import { createRestockNotification } from '@/lib/inventory-manager'

import { registerDomainEventHandler } from '../subscribe'
import type { DomainEventRecord } from '../subscribe'

/**
 * How long to stay quiet about a product after mailing about it.
 *
 * Stock sits below its threshold continuously until someone restocks, and `inventory.low` fires
 * on every sale that keeps it there. Without a cooldown a slow-moving product would generate a
 * restock email per order, which is how a genuinely useful alert becomes a filter rule.
 *
 * Seven days is roughly a purchasing cycle: long enough not to nag, short enough that a forgotten
 * product resurfaces before it runs out.
 */
export const RESTOCK_COOLDOWN_DAYS = 7

function readString(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key]
  return typeof value === 'string' && value.length > 0 ? value : null
}

function readNumber(payload: Record<string, unknown>, key: string): number | null {
  const value = payload[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/**
 * Mail the restock recommendation for a product that has just gone low.
 *
 * The cooldown is what makes this safe under the poller's at-least-once delivery as well: a
 * replayed event inside the window sends nothing.
 */
export async function handleRestockAlert(event: DomainEventRecord): Promise<void> {
  const payload =
    event.payload && typeof event.payload === 'object' && !Array.isArray(event.payload)
      ? (event.payload as Record<string, unknown>)
      : {}

  const productName = readString(payload, 'productName')
  const sku = readString(payload, 'sku')
  const stockLevel = readNumber(payload, 'stockLevel')
  const threshold = readNumber(payload, 'threshold')

  // The payload is the contract with `announceAlert`. Rather than re-reading the product and
  // risking a different stock level than the one that triggered the alert, skip on a shape we
  // do not recognise.
  if (productName === null || sku === null || stockLevel === null || threshold === null) {
    console.warn('[events] Incomplete inventory payload for restock alert', { eventId: event.id })
    return
  }

  const cooldownStart = new Date(
    event.createdAt.getTime() - RESTOCK_COOLDOWN_DAYS * 24 * 60 * 60 * 1000
  )

  const recent = await prisma.restockNotification.findFirst({
    where: { productId: event.entityId, createdAt: { gte: cooldownStart } },
    select: { id: true },
  })

  if (recent) return

  await createRestockNotification(event.entityId, productName, sku, stockLevel, threshold)
}

/** Subscribe to stock falling low or running out. */
export function registerRestockAlertHandlers(): void {
  registerDomainEventHandler('inventory.low', 'restock-alert', handleRestockAlert)
  registerDomainEventHandler('inventory.out_of_stock', 'restock-alert', handleRestockAlert)
}
