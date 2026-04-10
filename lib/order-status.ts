/**
 * Shared mapping between order statuses and shadcn Badge variants.
 * Used across the admin dashboard, orders list, order detail, and dialogs
 * so status indicators stay consistent project-wide.
 */

export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'REFUNDED'

export type OrderStatusBadgeVariant =
  | 'default'
  | 'secondary'
  | 'destructive'
  | 'outline'

export const ORDER_STATUS_VARIANT: Record<OrderStatus, OrderStatusBadgeVariant> = {
  PENDING: 'outline',
  CONFIRMED: 'secondary',
  PROCESSING: 'secondary',
  SHIPPED: 'secondary',
  DELIVERED: 'default',
  CANCELLED: 'destructive',
  REFUNDED: 'outline',
}

/**
 * Returns the appropriate Badge variant for an order status string.
 * Falls back to `outline` for unknown statuses so the UI never crashes
 * if the schema gains a new status before this map is updated.
 */
export function getOrderStatusVariant(
  status: string
): OrderStatusBadgeVariant {
  return ORDER_STATUS_VARIANT[status as OrderStatus] ?? 'outline'
}

/**
 * Title-case a SHOUTY status for display (PROCESSING → Processing).
 */
export function formatOrderStatus(status: string): string {
  if (!status) return ''
  return status.charAt(0) + status.slice(1).toLowerCase()
}
