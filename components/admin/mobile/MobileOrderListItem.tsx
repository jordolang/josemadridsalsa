import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import {
  formatOrderStatus,
  getOrderStatusVariant,
} from '@/lib/order-status'

export interface MobileOrderRow {
  id: string
  orderNumber: string
  status: string
  total: string | number
  createdAt: string
  customerName: string
  itemCount: number
}

interface MobileOrderListItemProps {
  order: MobileOrderRow
}

export function MobileOrderListItem({ order }: MobileOrderListItemProps) {
  return (
    <li>
      <Link
        href={`/admin/orders/${order.id}`}
        className="flex min-h-[72px] items-center gap-3 rounded-lg border bg-card p-3 active:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Order ${order.orderNumber}, ${order.customerName}, $${Number(order.total).toFixed(2)}, status ${order.status}`}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold">
              {order.orderNumber}
            </span>
            <Badge
              variant={getOrderStatusVariant(order.status)}
              className="shrink-0"
              aria-hidden
            >
              {formatOrderStatus(order.status)}
            </Badge>
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="truncate">{order.customerName}</span>
            <span aria-hidden>·</span>
            <span>{new Date(order.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
        <span className="shrink-0 text-sm font-semibold tabular-nums">
          ${Number(order.total).toFixed(2)}
        </span>
      </Link>
    </li>
  )
}
