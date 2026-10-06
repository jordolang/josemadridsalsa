import type { NotificationSpec } from '@/lib/notifications/dispatch'
import { dedupeKeys } from '@/lib/notifications/dispatch'

/**
 * Turns a newly raised inventory alert into something an operator will actually see.
 *
 * Low stock already sent email, which is where operational mail goes to be ignored. The
 * notification centre has had `INVENTORY_LOW` and `INVENTORY_OUT_OF_STOCK` types and dedupe
 * keys since it shipped, with nothing writing them — this is what fills that gap.
 *
 * Kept separate from `inventory-manager` so the wording and the dedupe identity are testable
 * without a database or an email transport.
 */

export interface RaisedInventoryAlert {
  productId: string
  productName: string
  sku: string | null
  stockLevel: number
  threshold: number
  outOfStock: boolean
}

export function inventoryAlertSpec(alert: RaisedInventoryAlert): NotificationSpec {
  const label = alert.sku ? `${alert.productName} (${alert.sku})` : alert.productName

  if (alert.outOfStock) {
    return {
      type: 'INVENTORY_OUT_OF_STOCK',
      severity: 'CRITICAL',
      title: `${alert.productName} is out of stock`,
      message: `${label} has no sellable units left.`,
      entityType: 'product',
      entityId: alert.productId,
      link: `/admin/inventory?productId=${alert.productId}`,
      // Keyed on the product, not the alert row: the same product going low again after a
      // restock is the same running concern, and should update one line rather than stack.
      dedupeKey: dedupeKeys.inventoryOut(alert.productId),
    }
  }

  return {
    type: 'INVENTORY_LOW',
    severity: 'WARNING',
    title: `${alert.productName} is running low`,
    message: `${label} is down to ${alert.stockLevel}, at or below its threshold of ${alert.threshold}.`,
    entityType: 'product',
    entityId: alert.productId,
    link: `/admin/inventory?productId=${alert.productId}`,
    dedupeKey: dedupeKeys.inventoryLow(alert.productId),
  }
}
